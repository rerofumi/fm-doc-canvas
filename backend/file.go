package backend

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ImportFileResult represents the result of importing a file
type ImportFileResult struct {
	Type    string `json:"type"`    // "text" or "image"
	Content string `json:"content"` // For text: file content. For image: relative path.
}

// FileService handles native file dialogs and file system I/O for canvas data
type FileService struct {
	ctx           context.Context
	configService *ConfigService
}

// NewFileService creates a new instance of FileService
func NewFileService(configService *ConfigService) *FileService {
	return &FileService{
		configService: configService,
	}
}

// SetContext updates the context used for Wails runtime calls
func (s *FileService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// ImportFile handles importing a file (text or image) from a file path
func (s *FileService) ImportFile(filePath string) (ImportFileResult, error) {
	// Determine file type based on extension
	ext := strings.ToLower(filepath.Ext(filePath))

	var result ImportFileResult

	switch ext {
	case ".txt", ".md":
		// Read text file content
		content, err := os.ReadFile(filePath)
		if err != nil {
			return result, fmt.Errorf("failed to read text file: %w", err)
		}
		result.Type = "text"
		result.Content = string(content)
	
	case ".png", ".jpg", ".jpeg", ".webp":
		// Resolve the download path
		cfg := s.configService.GetConfig()
		downloadPath := cfg.ImageGen.DownloadPath

		// If downloadPath is relative, resolve it to absolute based on executable directory
		if !filepath.IsAbs(downloadPath) {
			execPath, err := os.Executable()
			if err != nil {
				return result, fmt.Errorf("failed to get executable path: %w", err)
			}
			execDir := filepath.Dir(execPath)
			downloadPath = filepath.Join(execDir, downloadPath)
		}

		importPath := filepath.Join(downloadPath, "Import")

		// Ensure the import directory exists
		if err := os.MkdirAll(importPath, 0755); err != nil {
			return result, fmt.Errorf("failed to create import directory: %w", err)
		}

		// Generate a unique filename to avoid collisions
		filename := filepath.Base(filePath)
		ext := filepath.Ext(filename)
		nameWithoutExt := strings.TrimSuffix(filename, ext)
		targetFilename := fmt.Sprintf("%s_%d%s", nameWithoutExt, os.Getpid(), ext)
		targetPath := filepath.Join(importPath, targetFilename)

		// Copy the file
		input, err := os.ReadFile(filePath)
		if err != nil {
			return result, fmt.Errorf("failed to read source image: %w", err)
		}

		if err := os.WriteFile(targetPath, input, 0644); err != nil {
			return result, fmt.Errorf("failed to write imported image: %w", err)
		}

		result.Type = "image"
		// Return the relative path from the downloadPath
		result.Content = filepath.Join("Import", targetFilename)
	
	default:
		return result, fmt.Errorf("unsupported file type: %s", ext)
	}

	return result, nil
}

// SaveCanvasToFile opens a save dialog and writes the JSON data to the selected path
func (s *FileService) SaveCanvasToFile(jsonData string) (string, error) {
	if s.ctx == nil {
			return "", fmt.Errorf("context not initialized")
		}


	options := runtime.SaveDialogOptions{
		Title:           "Save Canvas",
		DefaultFilename: "canvas.json",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files (*.json)",
				Pattern:     "*.json",
			},
		},
	}

	filePath, err := runtime.SaveFileDialog(s.ctx, options)
	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}

	if filePath == "" {
		return "", nil // User cancelled
	}

	err = os.WriteFile(filePath, []byte(jsonData), 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return filePath, nil
}

// LoadCanvasFromFile opens an open dialog and reads the content of the selected file
func (s *FileService) LoadCanvasFromFile() (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("context not initialized")
	}

	options := runtime.OpenDialogOptions{
		Title: "Open Canvas",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files (*.json)",
				Pattern:     "*.json",
			},
		},
	}

	filePath, err := runtime.OpenFileDialog(s.ctx, options)
	if err != nil {
		return "", fmt.Errorf("failed to open file dialog: %w", err)
	}

	if filePath == "" {
		return "", nil // User cancelled
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	return string(data), nil
}
