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

type GoogleProvider struct {
	config    *GoogleConfig
	baseCfg   *ImageGenConfig
	service   *ImageGenService
}

// Generate implements ImageGenProvider.Generate for GoogleProvider
func (p *GoogleProvider) Generate(prompt string, contextData string, refImages []string) (string, error) {
	// Combine prompt and context for better generation
	fullPrompt := prompt
	if contextData != "" {
		fullPrompt = fmt.Sprintf("Context information:\n%s\n\nBased on the above context, generate an image for: %s", contextData, prompt)
	}

	// Prepare the parts for the request payload
	parts := []map[string]interface{}{
		{"text": fullPrompt},
	}

	// Add reference images if provided
	for _, imgURL := range refImages {
		// Extract base64 data from data URL
		if strings.HasPrefix(imgURL, "data:image/") {
			// Extract MIME type and base64 data from data URL
			partsStr := strings.Split(imgURL, ",")
			if len(partsStr) == 2 {
				// Extract MIME type from data URL header
				header := strings.Split(partsStr[0], ";")[0]
				mimeType := strings.TrimPrefix(header, "data:")
				if mimeType == "" {
					mimeType = "image/jpeg" // Default MIME type
				}

				parts = append(parts, map[string]interface{}{
					"inline_data": map[string]interface{}{
						"mime_type": mimeType,
						"data":      partsStr[1], // Extract base64 data
					},
				})
			}
		}
	}

	// Prepare the request payload for Google Image Generation
	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": parts,
			},
		},
	}

	// Convert payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request payload: %w", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", p.config.Model, p.config.APIKey)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	client := &http.Client{Timeout: 180 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request to Google: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Google API returned error status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text       string `json:"text"`
					InlineData *struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(result.Candidates) == 0 {
		return "", fmt.Errorf("no candidates in response")
	}

	// Extract image data from response
	for _, part := range result.Candidates[0].Content.Parts {
		if part.InlineData != nil && part.InlineData.Data != "" {
			// Create data URL and save the image
			dataURL := fmt.Sprintf("data:%s;base64,%s", part.InlineData.MimeType, part.InlineData.Data)
			return p.service.downloadAndSaveImage(dataURL)
		}
	}

	return "", fmt.Errorf("no image data found in response")
}
