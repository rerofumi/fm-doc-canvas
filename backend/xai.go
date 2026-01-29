package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type XAIProvider struct {
	config  *XAIConfig
	baseCfg *ImageGenConfig
	service *ImageGenService
}

// Generate implements ImageGenProvider.Generate for XAIProvider
func (p *XAIProvider) Generate(prompt string, contextData string, refImages []string) (string, error) {
	// Combine prompt and context for better generation
	fullPrompt := prompt
	if contextData != "" {
		fullPrompt = fmt.Sprintf("Context information:\n%s\n\nBased on the above context, generate an image for: %s", contextData, prompt)
	}

	// Prepare the request payload for xAI Image Generation
	payload := map[string]interface{}{
		"model":           p.config.Model,
		"prompt":          fullPrompt,
		"response_format": "b64_json", // Use base64 for saving (note: parameter name is response_format, not image_format)
		"n":               1,
	}

	// Add reference image if provided (xAI supports only 1 reference image)
	if len(refImages) > 0 {
		// xAI API accepts data URL format (e.g., "data:image/jpeg;base64,...")
		payload["image"] = map[string]interface{}{
			"url": refImages[0],
		}
	}
	// If no reference image, do not include "image" parameter at all

	// Convert payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request payload: %w", err)
	}

	// Create HTTP request
	// Use different endpoint for image editing vs generation
	url := "https://api.x.ai/v1/images/generations"
	if len(refImages) > 0 {
		// Use edits endpoint when reference image is provided
		url = "https://api.x.ai/v1/images/edits"
	}
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
		return "", fmt.Errorf("failed to send request to xAI: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("xAI API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	// xAI uses OpenAI-compatible response format with data array
	var result struct {
		Data []struct {
			B64JSON string `json:"b64_json"`
			URL     string `json:"url"`
		} `json:"data"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if result.Error != nil {
		return "", fmt.Errorf("xAI API error: %s", result.Error.Message)
	}

	if len(result.Data) == 0 {
		return "", fmt.Errorf("no image data in response")
	}

	// Extract image data (prefer b64_json, fallback to url)
	var dataURL string
	if result.Data[0].B64JSON != "" {
		// xAI returns JPG format for generated images
		dataURL = fmt.Sprintf("data:image/jpeg;base64,%s", result.Data[0].B64JSON)
	} else if result.Data[0].URL != "" {
		// If URL is returned instead, download it
		return p.service.downloadAndSaveImage(result.Data[0].URL)
	} else {
		return "", fmt.Errorf("no image data in response")
	}

	return p.service.downloadAndSaveImage(dataURL)
}
