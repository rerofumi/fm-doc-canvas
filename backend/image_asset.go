package backend

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type ImageAssetService struct {
	configService *ConfigService
}

// NewImageAssetService creates a new instance of ImageAssetService
func NewImageAssetService(configService *ConfigService) *ImageAssetService {
	return &ImageAssetService{
		configService: configService,
	}
}

// downloadAndSaveImage downloads and saves an image from a data URL
func (s *ImageGenService) downloadAndSaveImage(dataURL string) (string, error) {
	// Extract base64 data from data URL
	if !strings.HasPrefix(dataURL, "data:image/") {
		return "", fmt.Errorf("invalid data URL format")
	}

	parts := strings.Split(dataURL, ",")
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid data URL format")
	}

	// Extract MIME type
	header := strings.Split(parts[0], ";")[0]
	mimeType := strings.TrimPrefix(header, "data:")

	// Decode base64 data
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 data: %w", err)
	}

	// Generate unique filename
	downloadDir, err := s.resolveDownloadPath()
	if err != nil {
		return "", fmt.Errorf("failed to resolve download path: %w", err)
	}

	ext := "png"
	if mimeType == "image/jpeg" {
		ext = "jpg"
	} else if mimeType == "image/gif" {
		ext = "gif"
	} else if mimeType == "image/webp" {
		ext = "webp"
	}

	filename := fmt.Sprintf("image_%s.%s", time.Now().Format("20060102_150405"), ext)
	fullPath := filepath.Join(downloadDir, filename)

	// Save image to file
	if err := os.WriteFile(fullPath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to save image: %w", err)
	}

	// Return relative path from download directory with forward slashes
	relPath, err := filepath.Rel(downloadDir, fullPath)
	if err != nil {
		return filename, nil
	}

	// Convert backslashes to forward slashes for web compatibility
	relPath = strings.ReplaceAll(relPath, "\\", "/")

	return relPath, nil
}

// GetImageDataURL gets the data URL for an image file
func (s *ImageAssetService) GetImageDataURL(src string) (string, error) {
	// Resolve path using ConfigService (handles both DownloadPath relative and legacy executable relative)
	filePath, err := s.configService.ResolveImagePath(src)
	if err != nil {
		return "", err
	}

	// Read image file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read image file: %w", err)
	}

	// Determine MIME type based on file extension
	ext := strings.ToLower(filepath.Ext(filePath))
	mimeType := "image/png"

	switch ext {
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".gif":
		mimeType = "image/gif"
	case ".webp":
		mimeType = "image/webp"
	}

	// Encode data to base64
	b64Data := base64.StdEncoding.EncodeToString(data)

	// Create data URL
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, b64Data)

	return dataURL, nil
}
