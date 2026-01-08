package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type OpenAIProvider struct {
	config  *OpenAIConfig
	baseCfg *ImageGenConfig
	service *ImageGenService
}



// Generate implements ImageGenProvider.Generate for OpenAIProvider
func (p *OpenAIProvider) generateImage(prompt string, contextData string) (string, error) {
	// Combine prompt and context for better generation
	fullPrompt := prompt
	if contextData != "" {
		fullPrompt = fmt.Sprintf("Context information:\n%s\n\nBased on the above context, generate an image for: %s", contextData, prompt)
	}

	// Prepare the request payload for OpenAI Image Generation (DALL-E)
	payload := map[string]interface{}{
		"model":  p.config.Model,
		"prompt": fullPrompt,
		"n":      1,
	}
	// Add response_format for OpenAI Image API when using dall-e models
	if !strings.Contains(p.config.BaseURL, "api.openai.com") || (strings.Contains(p.config.BaseURL, "api.openai.com") && (p.config.Model == "dall-e-3" || p.config.Model == "dall-e-2")) {
		payload["response_format"] = "b64_json"
	}
	url := fmt.Sprintf("%s/images/generations", strings.TrimSuffix(p.config.BaseURL, "/"))

	// Convert payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request payload: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.config.APIKey))

	// Send request
	client := &http.Client{Timeout: 180 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request to OpenAI: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result struct {
		Data []struct {
			B64JSON string `json:"b64_json"`
		} `json:"data"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if result.Error != nil {
		return "", fmt.Errorf("OpenAI API error: %s", result.Error.Message)
	}



	if len(result.Data) == 0 || result.Data[0].B64JSON == "" {
		return "", fmt.Errorf("no image data in response")
	}

	// Create data URL and save the image
	dataURL := fmt.Sprintf("data:image/png;base64,%s", result.Data[0].B64JSON)
	return p.service.downloadAndSaveImage(dataURL)
}

func (p *OpenAIProvider) generateWithChatCompletion(prompt string, contextData string, refImages []string) (string, error) {
	// NOTE:
	// Phase 4: reference images are handled via the Responses API (/v1/responses),
	// not via /chat/completions and not via /images/edits.
	//
	// Payload shape (simplified):
	// {
	//   "model": "...",
	//   "input": [{ "role":"user", "content":[{"type":"input_text","text":"..."},{"type":"input_image","image_url":"data:..."}]}],
	//   "tools": [{ "type":"image_generation" }]
	// }
	//
	// Response contains:
	// response.output[].type === "image_generation_call" with output[].result (base64 image).

	// Combine prompt and context
	fullPrompt := prompt
	if contextData != "" {
		fullPrompt = fmt.Sprintf("Context information:\n%s\n\nBased on the above context, generate an image for: %s", contextData, prompt)
	}

	// Enforce max 5 reference images (as per spec)
	if len(refImages) > 5 {
		refImages = refImages[:5]
	}

	// Build Responses API input content
	type responsesInputContent struct {
		Type     string `json:"type"`
		Text     string `json:"text,omitempty"`
		ImageURL string `json:"image_url,omitempty"`
	}

	type responsesInputItem struct {
		Role    string                 `json:"role"`
		Content []responsesInputContent `json:"content"`
	}

	type responsesRequest struct {
		Model      string                   `json:"model"`
		Input      []responsesInputItem     `json:"input"`
		Tools      []map[string]interface{} `json:"tools"`
		ToolChoice interface{}              `json:"tool_choice,omitempty"`
	}

	content := make([]responsesInputContent, 0, 1+len(refImages))
	// Strongly steer the model to call the image_generation tool (otherwise it may answer in text).
	// Keep this instruction inside the user content to work across OpenAI-compatible providers.
	content = append(content, responsesInputContent{
		Type: "input_text",
		Text: "You MUST generate an image by calling the image_generation tool exactly once. Do not answer with text.\n\n" + fullPrompt,
	})
	for _, img := range refImages {
		// Expect img to be a data URL: data:image/...;base64,...
		content = append(content, responsesInputContent{
			Type:     "input_image",
			ImageURL: img,
		})
	}

	// Model selection notes:
	// In the Responses API, the top-level `model` is the *controller* (a chat/reasoning model like gpt-5)
	// that decides when to call tools.
	// The actual image is produced by the `image_generation` tool, which can be configured with its own
	// image model (e.g. gpt-image-1.5).

	requestedModel := strings.TrimSpace(p.config.Model)

	// If the config model is an image model, treat it as the desired image_generation tool model.
	imageToolModel := ""
	if strings.HasPrefix(requestedModel, "gpt-image-") {
		imageToolModel = requestedModel
	}

	// Choose controller model candidates.
	// Prefer gpt-5; fall back if the provider/org doesn't allow it.
	var modelCandidates []string
	isChatModel := strings.HasPrefix(requestedModel, "gpt-") || requestedModel == "chatgpt-4o-latest"

	switch {
	case requestedModel == "":
		modelCandidates = []string{"gpt-5", "gpt-5-mini", "gpt-4o-mini"}
	case imageToolModel != "":
		// Config is an image model like gpt-image-1.5 → use gpt-5 as controller.
		modelCandidates = []string{"gpt-5", "gpt-5-mini", "gpt-4o-mini"}
	case isChatModel:
		// Config is a controller model (gpt-5, gpt-4o-mini, etc.).
		modelCandidates = []string{requestedModel, "gpt-5", "gpt-5-mini", "gpt-4o-mini"}
	default:
		modelCandidates = []string{"gpt-5", "gpt-5-mini", "gpt-4o-mini"}
	}

	// Parse Responses API response
	type responsesOutputItem struct {
		Type         string `json:"type"`
		Result       string `json:"result,omitempty"`        // base64 image for image_generation_call
		OutputFormat string `json:"output_format,omitempty"` // "png" | "jpeg" | "webp" (may be omitted)
	}

	type responsesResponse struct {
		Output []responsesOutputItem `json:"output"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	// Use /responses endpoint
	baseURL := strings.TrimSuffix(p.config.BaseURL, "/")
	url := fmt.Sprintf("%s/responses", baseURL)

	client := &http.Client{Timeout: 180 * time.Second}

	var lastErr error
	for _, model := range modelCandidates {
			tool := map[string]interface{}{"type": "image_generation"}
			// If an image model was specified in config (e.g. gpt-image-1.5), request it for the tool.
			// (This is separate from the controller `model`.)
			if imageToolModel != "" {
				tool["model"] = imageToolModel
				tool["quality"] = "medium"
				tool["size"] = "1536x1024"
			}

			reqBody := responsesRequest{
			Model: model,
			Input: []responsesInputItem{
				{
					Role:    "user",
					Content: content,
				},
			},
			Tools: []map[string]interface{}{tool},
			// Force the tool call so we get an image_generation_call output instead of plain text.
			ToolChoice: map[string]interface{}{"type": "image_generation"},
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			return "", fmt.Errorf("failed to marshal request payload: %w", err)
		}

		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			return "", fmt.Errorf("failed to create HTTP request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		if p.config.APIKey != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.config.APIKey))
		}

		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("failed to send request: %w", err)
			continue
		}

		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return "", fmt.Errorf("failed to read response body: %w", readErr)
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("API returned error status %d: %s", resp.StatusCode, string(body))
			continue
		}

		var result responsesResponse
		if err := json.Unmarshal(body, &result); err != nil {
			return "", fmt.Errorf("failed to unmarshal response: %w", err)
		}
		if result.Error != nil {
			lastErr = fmt.Errorf("OpenAI API error: %s", result.Error.Message)
			continue
		}

		// Find the first image_generation_call
		var imgB64 string
		mime := "image/png"
		for _, o := range result.Output {
			if o.Type != "image_generation_call" {
				continue
			}
			if o.Result == "" {
				continue
			}

			switch strings.ToLower(o.OutputFormat) {
			case "jpeg", "jpg":
				mime = "image/jpeg"
			case "webp":
				mime = "image/webp"
			case "png":
				mime = "image/png"
			default:
				// keep default
			}

			imgB64 = o.Result
			break
		}

		if imgB64 == "" {
			lastErr = fmt.Errorf("no image_generation_call in response: %s", string(body))
			continue
		}

		dataURL := fmt.Sprintf("data:%s;base64,%s", mime, imgB64)
		return p.service.downloadAndSaveImage(dataURL)
	}

	if lastErr != nil {
		return "", lastErr
	}
	return "", fmt.Errorf("failed to generate image: no model candidates")
}

func (p *OpenAIProvider) Generate(prompt string, contextData string, refImages []string) (string, error) {
	if len(refImages) > 0 {
		return p.generateWithChatCompletion(prompt, contextData, refImages)
	} else {
		return p.generateImage(prompt, contextData)
	}
}
