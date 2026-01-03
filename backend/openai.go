package backend

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"

	"image/draw"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"time"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
)

type OpenAIProvider struct {
	config  *OpenAIConfig
	baseCfg *ImageGenConfig
	service *ImageGenService
}

// addImageToMultipart adds an image to a multipart writer
func (p *OpenAIProvider) addImageToMultipart(writer *multipart.Writer, fieldName, imageURL string) error {
	// Extract base64 data from data URL if needed
	if strings.HasPrefix(imageURL, "data:image/") {
		parts := strings.Split(imageURL, ",")
		if len(parts) != 2 {
			return fmt.Errorf("invalid data URL format")
		}

		// Extract MIME type
		header := strings.Split(parts[0], ";")[0]
		mimeType := strings.TrimPrefix(header, "data:")

		// Decode base64 data
		data := parts[1]
		decoded, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			return fmt.Errorf("failed to decode base64 image data: %w", err)
		}
		// Ensure PNG with alpha (RGBA) as required by OpenAI edits API
		img, _, err := image.Decode(bytes.NewReader(decoded))
		if err != nil {
			return fmt.Errorf("failed to decode image bytes: %w", err)
		}
		rgba := image.NewRGBA(img.Bounds())
		draw.Draw(rgba, rgba.Bounds(), img, image.Point{}, draw.Src)

		// OpenAI requires RGBA, LA, or L format. If the image is fully opaque, Go's png encoder
		// defaults to RGB (Color Type 2), which causes the API error.
		// We force PNG encoder to use RGBA (Color Type 6) by ensuring at least one pixel is not fully opaque.
		bounds := rgba.Bounds()
		if bounds.Dx() > 0 && bounds.Dy() > 0 {
			x, y := bounds.Min.X, bounds.Min.Y
			c := rgba.RGBAAt(x, y)
			if c.A == 255 {
				c.A = 254
				rgba.SetRGBA(x, y, c)
			}
		}

		var pngBuf bytes.Buffer
		if err := png.Encode(&pngBuf, rgba); err != nil {
			return fmt.Errorf("failed to encode RGBA PNG: %w", err)
		}

		filename := "image.png"
		mimeType = "image/png"
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, filename))
		h.Set("Content-Type", mimeType)

		part, err := writer.CreatePart(h)
		if err != nil {
			return fmt.Errorf("failed to create form file: %w", err)
		}

		if _, err := part.Write(pngBuf.Bytes()); err != nil {
			return fmt.Errorf("failed to write image data: %w", err)
		}
		return nil
	}

	// For regular URLs, we would need to download the image first
	// For simplicity, we'll assume all reference images are data URLs
	return fmt.Errorf("only data URL images are supported for image edits")
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

func (p *OpenAIProvider) editImage(prompt string, contextData string, refImages []string) (string, error) {
	// Combine prompt and context for better generation
	fullPrompt := prompt
	if contextData != "" {
		fullPrompt = fmt.Sprintf("Context information:\n%s\n\nBased on the above context, generate an image for: %s", contextData, prompt)
	}

	// Prepare enhanced prompt with detailed instructions for all reference images
	enhancedPrompt := fullPrompt
	if len(refImages) > 1 {
		references := ""
		for i, _ := range refImages[1:] {
			if i == 0 {
				references = fmt.Sprintf("Please incorporate elements from reference image %d (style, colors, composition, etc.) into the base image.", i+2)
			} else {
				references += fmt.Sprintf(" Also consider reference image %d's characteristics.", i+2)
			}
		}
		enhancedPrompt = fmt.Sprintf("%s\n\n%s", fullPrompt, references)
	}

	// Prepare multipart form data
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add prompt
	if err := writer.WriteField("prompt", enhancedPrompt); err != nil {
		return "", fmt.Errorf("failed to write prompt field: %w", err)
	}

	// Add n parameter
	if err := writer.WriteField("n", "1"); err != nil {
		return "", fmt.Errorf("failed to write n field: %w", err)
	}

	// Add response_format for OpenAI Image API
	// Add response_format for OpenAI Image API
	if err := writer.WriteField("response_format", "b64_json"); err != nil {
		return "", fmt.Errorf("failed to write response_format field: %w", err)
	}

	// Add all reference images
	for i, img := range refImages {
		fieldName := "image"
		if i > 0 {
			fieldName = fmt.Sprintf("image%d", i+1)
		}
		if err := p.addImageToMultipart(writer, fieldName, img); err != nil {
			return "", fmt.Errorf("failed to add image %d: %w", i+1, err)
		}
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close multipart writer: %w", err)
	}

	contentType := writer.FormDataContentType()

	// Create HTTP request
	url := fmt.Sprintf("%s/images/edits", strings.TrimSuffix(p.config.BaseURL, "/"))
	req, err := http.NewRequest("POST", url, &buf)
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)
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

func (p *OpenAIProvider) Generate(prompt string, contextData string, refImages []string) (string, error) {
	if len(refImages) > 0 {
		return p.editImage(prompt, contextData, refImages)
	} else {
		return p.generateImage(prompt, contextData)
	}
}
