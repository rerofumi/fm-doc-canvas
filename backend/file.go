package backend

import (
	"context"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileService handles native file dialogs and file system I/O for canvas data
type FileService struct {
	ctx context.Context
}

// NewFileService creates a new instance of FileService
func NewFileService() *FileService {
	return &FileService{}
}

// SetContext updates the context used for Wails runtime calls
func (s *FileService) SetContext(ctx context.Context) {
	s.ctx = ctx
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
