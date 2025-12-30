package main

import (
	"context"
	"fmt"

	"fm-doc-canvas/backend"
)

// App struct
type App struct {
	ctx           context.Context
	configService *backend.ConfigService
	fileService   *backend.FileService
	llmService    *backend.LLMService
}

// NewApp creates a new App application struct
func NewApp() *App {
	configService, err := backend.NewConfigService()
	if err != nil {
		// Log error but continue with defaults if possible
		fmt.Printf("Error initializing ConfigService: %v\n", err)
	}

	fileService := backend.NewFileService()
	llmService := backend.NewLLMService(configService)

	return &App{
		configService: configService,
		fileService:   fileService,
		llmService:    llmService,
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
