package backend

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	defaultOpenAIBaseURL = "https://api.openai.com/v1"
	defaultOpenAIModel   = "gpt-image-1.5"
)

type openAIProvider struct {
	baseURL    string
	model      string
	apiKey     string
	httpClient *http.Client
}

// NewOpenAIProvider creates an ImageGenProvider for OpenAI (Images API and Responses API).
func NewOpenAIProvider(baseURL, model, apiKey string, httpClient *http.Client) ImageGenProvider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultOpenAIBaseURL
	}
	if strings.TrimSpace(model) == "" {
		model = defaultOpenAIModel
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 180 * time.Second}
	}
	return &openAIProvider{
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		model:      strings.TrimSpace(model),
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: httpClient,
	}
}

func (p *openAIProvider) Name() string {
	return ProviderOpenAI
}

type openAIImagesRequest struct {
	Model          string `json:"model"`
	Prompt         string `json:"prompt"`
	N              int    `json:"n"`
	ResponseFormat string `json:"response_format,omitempty"`
}

type openAIImagesResponse struct {
	Data []struct {
		B64JSON string `json:"b64_json"`
		URL     string `json:"url"`
	} `json:"data"`
}

type openAIResponsesRequest struct {
	Model      string              `json:"model"`
	Input      []map[string]any    `json:"input"`
	Tools      []map[string]any    `json:"tools"`
	ToolChoice map[string]string   `json:"tool_choice"`
}

type openAIResponsesResponse struct {
	Output []struct {
		Type         string `json:"type"`
		OutputFormat string `json:"output_format"`
		Result       string `json:"result"`
	} `json:"output"`
}

func (p *openAIProvider) Generate(ctx context.Context, prompt string, refImages []string) (GeneratedImagePayload, error) {
	filtered := make([]string, 0, len(refImages))
	for _, ref := range refImages {
		if t := strings.TrimSpace(ref); t != "" {
			filtered = append(filtered, t)
		}
	}
	if len(filtered) == 0 {
		return p.generateImagesAPI(ctx, prompt)
	}
	return p.generateResponsesAPI(ctx, prompt, filtered)
}

func (p *openAIProvider) generateImagesAPI(ctx context.Context, prompt string) (GeneratedImagePayload, error) {
	reqPayload := openAIImagesRequest{
		Model:  p.model,
		Prompt: prompt,
		N:      1,
	}

	isOfficial := strings.Contains(strings.ToLower(p.baseURL), "api.openai.com")
	if !isOfficial || p.model == "dall-e-2" || p.model == "dall-e-3" {
		reqPayload.ResponseFormat = "b64_json"
	}

	endpoint := p.baseURL + "/images/generations"
	respBody, err := doJSONPost(ctx, p.httpClient, ProviderOpenAI, p.model, endpoint, p.apiKey, reqPayload, p.apiKey)
	if err != nil {
		return GeneratedImagePayload{}, err
	}

	var parsed openAIImagesResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return GeneratedImagePayload{}, SanitizeError(fmt.Errorf("%s (%s): invalid JSON response: %w", ProviderOpenAI, p.model, err), p.apiKey)
	}
	if len(parsed.Data) == 0 {
		return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained no image data", ProviderOpenAI, p.model)
	}

	if b64 := strings.TrimSpace(parsed.Data[0].B64JSON); b64 != "" {
		return GeneratedImagePayload{DataURL: "data:image/png;base64," + b64}, nil
	}
	if u := strings.TrimSpace(parsed.Data[0].URL); u != "" {
		return GeneratedImagePayload{ImageURL: u}, nil
	}

	return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained empty image data", ProviderOpenAI, p.model)
}

func (p *openAIProvider) generateResponsesAPI(ctx context.Context, prompt string, refImages []string) (GeneratedImagePayload, error) {
	if len(refImages) > 5 {
		refImages = refImages[:5]
	}

	contentParts := make([]map[string]any, 0, 1+len(refImages))
	contentParts = append(contentParts, map[string]any{
		"type": "input_text",
		"text": prompt,
	})
	for _, ref := range refImages {
		contentParts = append(contentParts, map[string]any{
			"type":      "input_image",
			"image_url": ref,
		})
	}

	toolSpec := map[string]any{
		"type": "image_generation",
	}
	var candidates []string
	if strings.HasPrefix(p.model, "gpt-image-") {
		toolSpec["model"] = p.model
		toolSpec["quality"] = "medium"
		toolSpec["size"] = "1536x1024"
		candidates = []string{"gpt-5", "gpt-5-mini", "gpt-4o-mini"}
	} else {
		candidates = uniqueStrings([]string{p.model, "gpt-5", "gpt-5-mini", "gpt-4o-mini"})
	}

	endpoint := p.baseURL + "/responses"
	var lastErr error

	for _, candidate := range candidates {
		reqPayload := openAIResponsesRequest{
			Model: candidate,
			Input: []map[string]any{
				{
					"role":    "user",
					"content": contentParts,
				},
			},
			Tools:      []map[string]any{toolSpec},
			ToolChoice: map[string]string{"type": "image_generation"},
		}

		respBody, err := doJSONPost(ctx, p.httpClient, ProviderOpenAI, candidate, endpoint, p.apiKey, reqPayload, p.apiKey)
		if err != nil {
			var statusErr *httpStatusError
			if errors.As(err, &statusErr) && (statusErr.StatusCode == http.StatusUnauthorized || statusErr.StatusCode == http.StatusForbidden) {
				return GeneratedImagePayload{}, err
			}
			lastErr = err
			continue
		}

		var parsed openAIResponsesResponse
		if err := json.Unmarshal(respBody, &parsed); err != nil {
			lastErr = SanitizeError(fmt.Errorf("%s (%s): invalid JSON response: %w", ProviderOpenAI, candidate, err), p.apiKey)
			continue
		}

		for _, item := range parsed.Output {
			if item.Type == "image_generation_call" && strings.TrimSpace(item.Result) != "" {
				format := strings.ToLower(strings.TrimSpace(item.OutputFormat))
				switch format {
				case "png", "jpeg", "webp":
				default:
					format = "png"
				}
				return GeneratedImagePayload{
					DataURL: fmt.Sprintf("data:image/%s;base64,%s", format, strings.TrimSpace(item.Result)),
				}, nil
			}
		}

		lastErr = fmt.Errorf("%s (%s): response contained no image_generation_call output", ProviderOpenAI, candidate)
	}

	if lastErr != nil {
		return GeneratedImagePayload{}, lastErr
	}
	return GeneratedImagePayload{}, fmt.Errorf("%s (%s): all candidate models failed", ProviderOpenAI, p.model)
}

func uniqueStrings(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}
