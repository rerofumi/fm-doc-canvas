package backend

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ImportFileResult describes the result of importing a dropped file.
type ImportFileResult struct {
	Kind    string `json:"kind"`              // "text" | "image"
	Content string `json:"content,omitempty"` // populated when Kind == "text"
	Src     string `json:"src,omitempty"`     // relative path under downloadPath ("Import/...")
	Name    string `json:"name"`              // original base filename
}

// DialogProvider abstracts OS file dialogs for testability.
type DialogProvider interface {
	SaveFileDialog(ctx context.Context, opts wailsRuntime.SaveDialogOptions) (string, error)
	OpenFileDialog(ctx context.Context, opts wailsRuntime.OpenDialogOptions) (string, error)
}

type wailsDialogProvider struct{}

func (wailsDialogProvider) SaveFileDialog(ctx context.Context, opts wailsRuntime.SaveDialogOptions) (string, error) {
	if ctx == nil {
		return "", errors.New("wails runtime context is not initialized")
	}
	return wailsRuntime.SaveFileDialog(ctx, opts)
}

func (wailsDialogProvider) OpenFileDialog(ctx context.Context, opts wailsRuntime.OpenDialogOptions) (string, error) {
	if ctx == nil {
		return "", errors.New("wails runtime context is not initialized")
	}
	return wailsRuntime.OpenFileDialog(ctx, opts)
}

// FileService handles canvas JSON save/load, file import, and Markdown/image export.
type FileService struct {
	ctx          context.Context
	assetService *ImageAssetService
	dialogs      DialogProvider
}

// NewFileService creates a FileService with the given ImageAssetService and optional DialogProvider.
func NewFileService(assetService *ImageAssetService, dialogs DialogProvider) *FileService {
	if dialogs == nil {
		dialogs = wailsDialogProvider{}
	}
	return &FileService{
		assetService: assetService,
		dialogs:      dialogs,
	}
}

// SetContext stores the Wails runtime context on application startup.
func (s *FileService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// SaveCanvasToFile opens a save dialog and writes jsonData to the selected path.
// Returns ("", nil) when the user cancels the dialog.
func (s *FileService) SaveCanvasToFile(jsonData string) (string, error) {
	path, err := s.dialogs.SaveFileDialog(s.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "キャンバスを保存",
		DefaultFilename: "canvas.json",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Canvas JSON (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}
	if strings.TrimSpace(path) == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(jsonData), 0o644); err != nil {
		return "", fmt.Errorf("failed to write canvas file: %w", err)
	}
	return path, nil
}

// LoadCanvasFromFile opens an open dialog and reads the selected JSON file.
// Returns ("", nil) when the user cancels the dialog.
func (s *FileService) LoadCanvasFromFile() (string, error) {
	path, err := s.dialogs.OpenFileDialog(s.ctx, wailsRuntime.OpenDialogOptions{
		Title: "キャンバスを開く",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Canvas JSON (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to open file dialog: %w", err)
	}
	if strings.TrimSpace(path) == "" {
		return "", nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read canvas file: %w", err)
	}
	return string(data), nil
}

// ImportFile validates filePath and imports .txt/.md as text or .png/.jpg/.jpeg/.webp into downloadPath/Import/.
func (s *FileService) ImportFile(filePath string) (ImportFileResult, error) {
	trimmed := strings.TrimSpace(filePath)
	if trimmed == "" {
		return ImportFileResult{}, errors.New("file path is empty")
	}

	info, err := os.Stat(trimmed)
	if err != nil {
		return ImportFileResult{}, fmt.Errorf("failed to access file: %w", err)
	}

	baseName := filepath.Base(trimmed)
	if info.IsDir() {
		return ImportFileResult{}, fmt.Errorf("未対応のファイル形式です: %s", baseName)
	}

	ext := strings.ToLower(filepath.Ext(baseName))
	switch ext {
	case ".txt", ".md":
		data, err := os.ReadFile(trimmed)
		if err != nil {
			return ImportFileResult{}, fmt.Errorf("failed to read text file: %w", err)
		}
		return ImportFileResult{
			Kind:    "text",
			Content: string(data),
			Name:    baseName,
		}, nil

	case ".png", ".jpg", ".jpeg", ".webp":
		data, err := os.ReadFile(trimmed)
		if err != nil {
			return ImportFileResult{}, fmt.Errorf("failed to read image file: %w", err)
		}

		root, err := s.assetService.DownloadRoot()
		if err != nil {
			return ImportFileResult{}, err
		}
		importDir := filepath.Join(root, "Import")
		if err := os.MkdirAll(importDir, 0o755); err != nil {
			return ImportFileResult{}, fmt.Errorf("failed to create Import directory: %w", err)
		}

		safeBase := sanitizeBaseFilename(strings.TrimSuffix(baseName, filepath.Ext(baseName)))
		filename, destPath, err := generateUniqueFilename(importDir, safeBase, ext)
		if err != nil {
			return ImportFileResult{}, err
		}
		if err := os.WriteFile(destPath, data, 0o644); err != nil {
			return ImportFileResult{}, fmt.Errorf("failed to copy imported image: %w", err)
		}

		return ImportFileResult{
			Kind: "image",
			Src:  "Import/" + filename,
			Name: baseName,
		}, nil

	default:
		return ImportFileResult{}, fmt.Errorf("未対応のファイル形式です: %s", baseName)
	}
}

// ExportMarkdown opens a save dialog and writes Markdown content to the selected file.
// Returns ("", nil) when the user cancels the dialog.
func (s *FileService) ExportMarkdown(content string) (string, error) {
	path, err := s.dialogs.SaveFileDialog(s.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "Markdown をエクスポート",
		DefaultFilename: "document.md",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Markdown (*.md)", Pattern: "*.md"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}
	if strings.TrimSpace(path) == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", fmt.Errorf("failed to export markdown: %w", err)
	}
	return path, nil
}

// ExportImage validates src via ImageAssetService.ResolveImagePath and copies the image
// to a user-selected destination. Returns ("", nil) when the user cancels the dialog.
func (s *FileService) ExportImage(src string) (string, error) {
	absPath, err := s.assetService.ResolveImagePath(src)
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return "", fmt.Errorf("failed to read source image %q: %w", src, err)
	}

	ext := strings.ToLower(filepath.Ext(absPath))
	pattern := "*" + ext
	if ext == "" {
		pattern = "*.*"
	}

	destPath, err := s.dialogs.SaveFileDialog(s.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "画像をエクスポート",
		DefaultFilename: filepath.Base(absPath),
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: fmt.Sprintf("Image (%s)", pattern), Pattern: pattern},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}
	if strings.TrimSpace(destPath) == "" {
		return "", nil
	}
	if err := os.WriteFile(destPath, data, 0o644); err != nil {
		return "", fmt.Errorf("failed to export image: %w", err)
	}
	return destPath, nil
}

var unsafeFilenameChars = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f\s.]+`)

func sanitizeBaseFilename(name string) string {
	cleaned := unsafeFilenameChars.ReplaceAllString(strings.TrimSpace(name), "_")
	cleaned = strings.Trim(cleaned, "_")
	if cleaned == "" {
		return "imported"
	}
	return cleaned
}
