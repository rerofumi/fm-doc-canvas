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

// ExportImage opens a save dialog and copies the image from internal storage to the selected path
func (s *FileService) ExportImage(src string) (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("context not initialized")
	}

	// 1. Resolve source path with security checks
	if strings.Contains(src, "..") {
		return "", fmt.Errorf("path traversal is not allowed")
	}

	sourcePath, err := s.configService.ResolveImagePath(src)
	if err != nil {
		return "", err
	}

	downloadPath, err := s.configService.ResolveDownloadPath()
	if err != nil {
		return "", err
	}

	// Verify the resolved path is still within downloadPath
	relPath, err := filepath.Rel(downloadPath, sourcePath)
	if err != nil {
		return "", fmt.Errorf("failed to get relative path: %w", err)
	}
	if strings.HasPrefix(relPath, "..") || relPath == ".." {
		return "", fmt.Errorf("resolved path is outside the allowed directory")
	}

	// Check if source file exists
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return "", fmt.Errorf("source image not found: %s", sourcePath)
	}

	// 2. Open save dialog
	ext := filepath.Ext(src)
	options := runtime.SaveDialogOptions{
		Title:           "Export Image",
		DefaultFilename: filepath.Base(src),
		Filters: []runtime.FileFilter{
			{
				DisplayName: fmt.Sprintf("Image Files (*%s)", ext),
				Pattern:     fmt.Sprintf("*%s", ext),
			},
		},
	}

	destPath, err := runtime.SaveFileDialog(s.ctx, options)
	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}

	if destPath == "" {
		return "", nil // User cancelled
	}

	// 3. Copy the file
	input, err := os.ReadFile(sourcePath)
	if err != nil {
		return "", fmt.Errorf("failed to read source image: %w", err)
	}

	err = os.WriteFile(destPath, input, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write exported image: %w", err)
	}

	return destPath, nil
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
		downloadPath, err := s.configService.ResolveDownloadPath()
		if err != nil {
			return result, err
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
		// Return the relative path from the downloadPath (use forward slashes for web compatibility)
		result.Content = "Import/" + targetFilename
	
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

// ExportMarkdown opens a save dialog and writes the markdown content to the selected path
func (s *FileService) ExportMarkdown(content string) (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("context not initialized")
	}

	options := runtime.SaveDialogOptions{
		Title:           "Export Markdown",
		DefaultFilename: "export.md",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Markdown Files (*.md)",
				Pattern:     "*.md",
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

	err = os.WriteFile(filePath, []byte(content), 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return filePath, nil
}

// GetImageFileURL converts a relative image path to an absolute file URL
func (s *FileService) GetImageFileURL(src string) (string, error) {
	// Construct the absolute path to the image
	absolutePath, err := s.configService.ResolveImagePath(src)
	if err != nil {
		return "", err
	}

	// Check if the file exists
	if _, err := os.Stat(absolutePath); os.IsNotExist(err) {
		return "", fmt.Errorf("image file does not exist: %s", absolutePath)
	}

	// Convert to file URL
	// On Windows, we need to convert backslashes to forward slashes and add file:///
	// On Unix-like systems, we just need to add file://
	fileURL := "file:///" + filepath.ToSlash(absolutePath)
	return fileURL, nil
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
