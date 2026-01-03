package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type OpenRouterProvider struct {
	config    *OpenRouterConfig
	baseCfg   *ImageGenConfig
	service   *ImageGenService
}

// Generate implements ImageGenProvider.Generate for OpenRouterProvider
func (p *OpenRouterProvider) Generate(prompt string, contextData string, refImages []string) (string, error) {
	// Combine prompt and context for better generation
	fullPrompt := prompt
	if contextData != "" {
		fullPrompt = fmt.Sprintf("Context information:\n%s\n\nBased on the above context, generate an image for: %s", contextData, prompt)
	}

	// Prepare the message content
	var messageContent interface{} = fullPrompt
	if len(refImages) > 0 {
		contentParts := make([]ContentPart, 0, 1+len(refImages))
		contentParts = append(contentParts, ContentPart{
			Type: "text",
			Text: fullPrompt,
		})
		for _, imgURL := range refImages {
			contentParts = append(contentParts, ContentPart{
				Type: "image_url",
				ImageURL: &ImageURL{
					URL: imgURL,
				},
			})
		}
		messageContent = contentParts
	}

	// Prepare the request payload
	payload := map[string]interface{}{
		"model": p.config.Model,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": messageContent,
			},
		},
		"modalities": []string{"image", "text"},
	}

	// Convert payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request payload: %w", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("%s/chat/completions", strings.TrimSuffix(p.config.BaseURL, "/"))
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
		return "", fmt.Errorf("failed to send request to OpenRouter: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenRouter API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Extract image URL from response
	choices, ok := result["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	firstChoice, ok := choices[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid choice format")
	}

	message, ok := firstChoice["message"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid message format")
	}

	// Check if images are in the response
	if images, hasImages := message["images"].([]interface{}); hasImages && len(images) > 0 {
		firstImage, ok := images[0].(map[string]interface{})
		if !ok {
			return "", fmt.Errorf("invalid image format")
		}

		imageURL, ok := firstImage["image_url"].(map[string]interface{})["url"].(string)
		if !ok {
			return "", fmt.Errorf("invalid image URL format")
		}

		// Download and save the image
		return p.service.downloadAndSaveImage(imageURL)
	}

	// If no images, check content for image data (some models might return it differently)
	if content, hasContent := message["content"].(string); hasContent {
		if strings.Contains(content, "data:image/") {
			re := regexp.MustCompile(`data:image/[^;]+;base64,[a-zA-Z0-9+/=]+`)
			matches := re.FindStringSubmatch(content)
			if len(matches) > 0 {
				return p.service.downloadAndSaveImage(matches[0])
			}
		}
	}

	return "", fmt.Errorf("no image found in response")
}
