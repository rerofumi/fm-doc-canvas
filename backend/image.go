package backend

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// ImageGenService handles image generation via external APIs
type ImageGenService struct {
	configService *ConfigService
}

// NewImageGenService creates a new instance of ImageGenService
func NewImageGenService(configService *ConfigService) *ImageGenService {
	return &ImageGenService{
		configService: configService,
	}
}

// GenerateImage generates an image using the configured provider (e.g., OpenRouter)
// It takes a prompt, context data from other nodes, and optional reference images, 
// saves the result, and returns the relative path
func (s *ImageGenService) GenerateImage(prompt string, contextData string, refImages []string) (string, error) {
	cfg := s.configService.GetConfig()

	// Combine prompt and context for better generation
	fullPrompt := prompt
	if contextData != "" {
		fullPrompt = fmt.Sprintf("Context information:\n%s\n\nBased on the above context, generate an image for: %s", contextData, prompt)
	}
	
	// Prepare the request payload
	payload := map[string]interface{}{
		"model": cfg.ImageGen.Model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": fullPrompt,
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
	url := fmt.Sprintf("%s/chat/completions", cfg.ImageGen.BaseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.ImageGen.APIKey))
	
	// Send request
	client := &http.Client{Timeout: 60 * time.Second}
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
		return s.downloadAndSaveImage(imageURL)
	}
	
	// If no images, check content for image data (some models might return it differently)
	if content, hasContent := message["content"].(string); hasContent {
		// This is a simplified check. In reality, you might need to parse markdown or HTML
		// to extract image data.
		if strings.Contains(content, "data:image/") {
			// Extract base64 data URL from content
			// This is a very basic extraction and might need improvement
			re := regexp.MustCompile(`data:image/[^;]+;base64,[a-zA-Z0-9+/=]+`)
			matches := re.FindStringSubmatch(content)
			if len(matches) > 0 {
				return s.downloadAndSaveImage(matches[0])
			}
		}
	}
	
	return "", fmt.Errorf("no image found in response")
}

// resolveDownloadPath resolves the download path to an absolute path based on the executable's directory
func (s *ImageGenService) resolveDownloadPath() (string, error) {
	cfg := s.configService.GetConfig()
	downloadPath := cfg.ImageGen.DownloadPath
	
	// If it's already an absolute path, return as is
	if filepath.IsAbs(downloadPath) {
		return downloadPath, nil
	}
	
	// Otherwise, resolve relative to the executable's directory
	execPath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}
	
	execDir := filepath.Dir(execPath)
	absPath := filepath.Join(execDir, downloadPath)
	return absPath, nil
}

// ImageAssetService handles operations related to local image assets
type ImageAssetService struct {
	configService *ConfigService
}

// downloadAndSaveImage downloads an image from a URL (or data URL) and saves it to the configured download path
func (s *ImageGenService) downloadAndSaveImage(imageURL string) (string, error) {
	// Resolve the download path
	downloadPath, err := s.resolveDownloadPath()
	if err != nil {
		return "", fmt.Errorf("failed to resolve download path: %w", err)
	}

	// Ensure the download directory exists
	if err := os.MkdirAll(downloadPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create download directory: %w", err)
	}

	var data []byte

	// Handle data URL
	if strings.HasPrefix(imageURL, "data:image/") {
		// Extract base64 data
		parts := strings.SplitN(imageURL, ",", 2)
		if len(parts) != 2 {
			return "", fmt.Errorf("invalid data URL format")
		}
		data, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 image data: %w", err)
		}
	} else {
		// Handle regular URL
		resp, err := http.Get(imageURL)
		if err != nil {
			return "", fmt.Errorf("failed to download image: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("failed to download image, status: %d", resp.StatusCode)
		}

		data, err = io.ReadAll(resp.Body)
		if err != nil {
			return "", fmt.Errorf("failed to read image data: %w", err)
		}
	}

	// Generate a unique filename to avoid collisions
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("generated_%s_%d.png", timestamp, os.Getpid()) // Include PID for uniqueness
	filePath := filepath.Join(downloadPath, filename)

	// Write file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to save image file: %w", err)
	}

	// Return the relative path from the download directory
	relPath, err := filepath.Rel(downloadPath, filePath)
	if err != nil {
		return "", fmt.Errorf("failed to get relative path: %w", err)
	}

	return relPath, nil
}


// NewImageAssetService creates a new instance of ImageAssetService
func NewImageAssetService(configService *ConfigService) *ImageAssetService {
	return &ImageAssetService{
		configService: configService,
	}
}

// GetImageDataURL converts a relative image path to a Data URL for display in the frontend
func (s *ImageAssetService) GetImageDataURL(src string) (string, error) {
	// 1. Validate src (no absolute paths, no path traversal)
	if filepath.IsAbs(src) {
		return "", fmt.Errorf("absolute paths are not allowed")
	}
	
	if strings.Contains(src, "..") {
		return "", fmt.Errorf("path traversal is not allowed")
	}
	
	// 2. Resolve path
	cfg := s.configService.GetConfig()
	downloadPath := cfg.ImageGen.DownloadPath
	
	// If downloadPath is relative, resolve it to absolute based on executable directory
	if !filepath.IsAbs(downloadPath) {
		execPath, err := os.Executable()
		if err != nil {
			return "", fmt.Errorf("failed to get executable path: %w", err)
		}
		execDir := filepath.Dir(execPath)
		downloadPath = filepath.Join(execDir, downloadPath)
	}
	
	// Clean the src to prevent path traversal
	cleanSrc := filepath.Clean(src)
	fullPath := filepath.Join(downloadPath, cleanSrc)
	
	// 3. Additional security check: Ensure the resolved path is still within downloadPath
	relPath, err := filepath.Rel(downloadPath, fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to get relative path: %w", err)
	}
	
	if strings.Contains(relPath, "..") || relPath == "." {
		return "", fmt.Errorf("resolved path is outside the allowed directory")
	}
	
	// 4. Read image file
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to read image file: %w", err)
	}
	
	// 5. Determine MIME type
	mimeType := http.DetectContentType(data)
	
	// 6. Convert to Data URL
	encoded := base64.StdEncoding.EncodeToString(data)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, encoded)
	
	return dataURL, nil
}
