package main

import (
	"context"
	"fm-doc-canvas/backend"
)

// App is the Wails application facade delegating to backend services.
type App struct {
	ctx          context.Context
	initErr      error
	cfgService   *backend.ConfigService
	assetService *backend.ImageAssetService
	fileService  *backend.FileService
	llmService   *backend.LLMService
	imageService *backend.ImageGenService
}

// NewApp creates a new App instance backed by the default user config directory.
func NewApp() *App {
	return newAppWithConfigPath("")
}

func newAppWithConfigPath(configPath string) *App {
	cfgSvc, err := backend.NewConfigService(configPath)
	if err != nil {
		return &App{initErr: err}
	}
	assetSvc := backend.NewImageAssetService(cfgSvc, nil)
	fileSvc := backend.NewFileService(assetSvc, nil)
	llmSvc := backend.NewLLMService(cfgSvc, nil)
	imgSvc := backend.NewImageGenService(cfgSvc, assetSvc, nil)

	return &App{
		cfgService:   cfgSvc,
		assetService: assetSvc,
		fileService:  fileSvc,
		llmService:   llmSvc,
		imageService: imgSvc,
	}
}

// startup is called when the Wails application starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.fileService != nil {
		a.fileService.SetContext(ctx)
	}
}

// HealthCheck returns a readiness status string for smoke verification.
func (a *App) HealthCheck() string {
	return "ok"
}

// GetConfig returns the persisted application configuration.
func (a *App) GetConfig() (backend.Config, error) {
	if a.initErr != nil {
		return backend.DefaultConfig(), a.initErr
	}
	return a.cfgService.GetConfig()
}

// SaveConfig normalizes defaults and atomically persists cfg.
func (a *App) SaveConfig(cfg backend.Config) error {
	if a.initErr != nil {
		return a.initErr
	}
	return a.cfgService.SaveConfig(cfg)
}

// GenerateText sends a text-only prompt to the configured LLM.
func (a *App) GenerateText(prompt, contextData string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.llmService.GenerateText(prompt, contextData)
}

// GenerateTextWithImages sends a multimodal Vision prompt to the configured LLM.
func (a *App) GenerateTextWithImages(prompt, contextData string, imageDataURLs []string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.llmService.GenerateTextWithImages(prompt, contextData, imageDataURLs)
}

// GenerateSummary generates a concise summary of text.
func (a *App) GenerateSummary(text string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.llmService.GenerateSummary(text)
}

// GenerateImage generates an image using the configured default provider.
func (a *App) GenerateImage(prompt, contextData string, refImages []string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.imageService.GenerateImage(prompt, contextData, refImages)
}

// GenerateImageWithProvider generates an image using provider without mutating config.json.
func (a *App) GenerateImageWithProvider(prompt, contextData string, refImages []string, provider string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.imageService.GenerateImageWithProvider(prompt, contextData, refImages, provider)
}

// GetImageDataURL validates src and returns a base64 Data URL.
func (a *App) GetImageDataURL(src string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.assetService.GetImageDataURL(src)
}

// GetImageFileURL validates src and returns an absolute file:/// URL.
func (a *App) GetImageFileURL(src string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.assetService.GetImageFileURL(src)
}

// SaveCanvasToFile opens a save dialog and writes jsonData.
func (a *App) SaveCanvasToFile(jsonData string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.fileService.SaveCanvasToFile(jsonData)
}

// LoadCanvasFromFile opens an open dialog and reads a canvas JSON file.
func (a *App) LoadCanvasFromFile() (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.fileService.LoadCanvasFromFile()
}

// ImportFile imports a dropped .txt/.md or image file.
func (a *App) ImportFile(filePath string) (backend.ImportFileResult, error) {
	if a.initErr != nil {
		return backend.ImportFileResult{}, a.initErr
	}
	return a.fileService.ImportFile(filePath)
}

// ExportMarkdown opens a save dialog and writes Markdown content.
func (a *App) ExportMarkdown(content string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.fileService.ExportMarkdown(content)
}

// ExportImage validates src and exports the image via a save dialog.
func (a *App) ExportImage(src string) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	return a.fileService.ExportImage(src)
}
