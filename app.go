package main

import (
	"context"
	"fmt"

	"fm-doc-canvas/backend"
)

// App struct
type App struct {
	ctx               context.Context
	configService     *backend.ConfigService
	fileService       *backend.FileService
	llmService        *backend.LLMService
	imageGenService   *backend.ImageGenService
	imageAssetService *backend.ImageAssetService
}

// NewApp creates a new App application struct
func NewApp() *App {
	configService, err := backend.NewConfigService()
	if err != nil {
		// Log error but continue with defaults if possible
		fmt.Printf("Error initializing ConfigService: %v\n", err)
	}

	fileService := backend.NewFileService(configService)
	llmService := backend.NewLLMService(configService)
	imageGenService := backend.NewImageGenService(configService)
	imageAssetService := backend.NewImageAssetService(configService)

	return &App{
		configService:     configService,
		fileService:       fileService,
		llmService:        llmService,
		imageGenService:   imageGenService,
		imageAssetService: imageAssetService,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.fileService.SetContext(ctx)
}

// GetConfig returns the application configuration
func (a *App) GetConfig() (backend.Config, error) {
	return a.configService.GetConfig(), nil
}

// SaveConfig updates the application configuration
func (a *App) SaveConfig(cfg backend.Config) error {
	return a.configService.Save(&cfg)
}

// SaveCanvasToFile opens a dialog and saves the canvas JSON
func (a *App) SaveCanvasToFile(jsonData string) (string, error) {
	return a.fileService.SaveCanvasToFile(jsonData)
}

// LoadCanvasFromFile opens a dialog and reads a canvas JSON
func (a *App) LoadCanvasFromFile() (string, error) {
	return a.fileService.LoadCanvasFromFile()
}

// GenerateText calls the LLM service to generate content based on prompt and context
func (a *App) GenerateText(prompt string, contextData string) (string, error) {
	return a.llmService.GenerateText(prompt, contextData)
}

// GenerateSummary calls the LLM service to summarize text
func (a *App) GenerateSummary(text string) (string, error) {
	return a.llmService.GenerateSummary(text)
}

// Greet returns a greeting for the given name (Legacy / Test)
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GenerateImage generates an image based on a prompt and reference images
func (a *App) GenerateImage(prompt string, contextData string, refImages []string) (string, error) {
	return a.imageGenService.GenerateImage(prompt, contextData, refImages)
}

// GetImageDataURL converts a relative image path to a Data URL for display
func (a *App) GetImageDataURL(src string) (string, error) {
	return a.imageAssetService.GetImageDataURL(src)
}


// ImportFile handles importing a file (text or image) from a file path

func (a *App) ImportFile(filePath string) (backend.ImportFileResult, error) {

	// 1. Determine file type, 2. Process content, 3. Return result

	// Note: Currently calling fileService placeholder, needs full implementation in backend

	return a.fileService.ImportFile(filePath)

}

// GenerateTextWithImages calls the LLM service to generate content based on prompt, context and images
func (a *App) GenerateTextWithImages(prompt string, contextData string, imageDataURLs []string) (string, error) {
	return a.llmService.GenerateTextWithImages(prompt, contextData, imageDataURLs)
}


// ExportMarkdown opens a dialog and saves the markdown content
func (a *App) ExportMarkdown(content string) (string, error) {
	return a.fileService.ExportMarkdown(content)
}

// ExportImage opens a dialog and copies the image to the selected path
func (a *App) ExportImage(src string) (string, error) {
	return a.fileService.ExportImage(src)
}

// GetImageFileURL converts a relative image path to an absolute file URL
func (a *App) GetImageFileURL(src string) (string, error) {
	return a.fileService.GetImageFileURL(src)
}
