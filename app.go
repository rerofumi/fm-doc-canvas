package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"fm-doc-canvas/backend"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx                context.Context
	mode               backend.RuntimeMode
	configService      *backend.ConfigService
	fileService        *backend.FileService
	llmService         *backend.LLMService
	imageGenService    *backend.ImageGenService
	imageAssetService  *backend.ImageAssetService
	chatSessionService *backend.ChatSessionService // legacy; not used on active path
	chatService        *backend.ChatService
	events             backend.EventPort
	clock              backend.Clock
	ids                backend.IDGenerator
	faultPlan          *backend.E2EFaultPlan
}

// NewProductionApp builds the production composition root.
func NewProductionApp() *App {
	configService, err := backend.NewConfigService()
	if err != nil {
		fmt.Printf("Error initializing ConfigService: %v\n", err)
	}

	fileService := backend.NewFileService(configService)
	llmService := backend.NewLLMService(configService)
	imageGenService := backend.NewImageGenService(configService)
	imageAssetService := backend.NewImageAssetService(configService)

	return &App{
		mode:              backend.RuntimeModeProduction,
		configService:     configService,
		fileService:       fileService,
		llmService:        llmService,
		imageGenService:   imageGenService,
		imageAssetService: imageAssetService,
		chatService:       backend.NewChatService(llmService),
		events:            &backend.CapturingEventPort{},
		clock:             backend.SystemClock{},
		ids:               backend.RandomIDGenerator{},
	}
}

// NewApp keeps the historical constructor name used by main.go.
// FM_E2E=1 with FM_E2E_TEMP_ROOT selects the isolated E2E composition root.
func NewApp() *App {
	if strings.TrimSpace(os.Getenv("FM_E2E")) == "1" {
		app, err := NewE2EAppFromEnv()
		if err != nil {
			panic(fmt.Sprintf("E2E composition root failed: %v", err))
		}
		return app
	}
	return NewProductionApp()
}

// NewE2EAppFromEnv builds a fail-closed E2E app using an explicit temp root.
func NewE2EAppFromEnv() (*App, error) {
	root := strings.TrimSpace(os.Getenv("FM_E2E_TEMP_ROOT"))
	if root == "" {
		return nil, fmt.Errorf("FM_E2E=1 requires FM_E2E_TEMP_ROOT")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	fs, err := backend.NewTempFileSystem(abs)
	if err != nil {
		return nil, err
	}
	cfg := backend.NewMemoryConfigStore(abs, nil)
	// Ensure image path stays inside temp root.
	c := cfg.GetConfig()
	c.ImageGen.DownloadPath = filepath.Join(abs, "Image")
	_ = cfg.Save(&c)

	opts := backend.AppOptions{
		Config: cfg,
		Dialog: backend.FixedDialog{
			SavePath: filepath.Join(abs, "save", "workspace.json"),
			OpenPath: filepath.Join(abs, "fixtures", "workspace.json"),
		},
		Files:  fs,
		Assets: backend.TempAssetStore{Root: abs, FS: fs},
		LLM:    backend.FixtureLLM{Text: "fixture-llm-response"},
		Image:  backend.FixtureImage{Path: "generated/fixture.png"},
		Events: &backend.CapturingEventPort{},
		Clock:  backend.NewFakeClock(time.Date(2026, 8, 11, 0, 0, 0, 0, time.UTC)),
		IDs:    backend.NewSeededIDGenerator("e2e"),
		Mode:   backend.RuntimeModeE2E,
	}
	if v := strings.TrimSpace(os.Getenv("FM_E2E_FAULT")); v != "" {
		opts.FaultPlan = &backend.E2EFaultPlan{FailOnceAt: v}
	}
	return NewAppWithOptions(opts)
}

// NewAppWithOptions validates ports and wires an injectable composition root.
// It does not read or write real config/chat paths during construction.
func NewAppWithOptions(opts backend.AppOptions) (*App, error) {
	if err := opts.Validate(); err != nil {
		return nil, err
	}
	if opts.Mode == backend.RuntimeModeProduction {
		// Keep production path on concrete services; ignore injected fixtures.
		return NewProductionApp(), nil
	}

	// E2E: do not construct ConfigService/ChatSessionService (no %AppData%).
	// FileService still needs a *ConfigService for Resolve paths in current code;
	// use an in-memory-backed adapter constructed without UserConfigDir side effects.
cfgService := backend.NewConfigServiceFromStore(opts.Config)
	fileService := backend.NewFileService(cfgService)
	if d, ok := opts.Dialog.(backend.FixedDialog); ok {
		exportPath := d.SavePath
		if exportPath != "" {
			exportPath = filepath.Join(filepath.Dir(exportPath), "export.md")
		}
		fileService.SetFixedDialogPaths(d.SavePath, d.OpenPath, exportPath)
	}
	// LLM/Image services are not used by WP-0 smoke; chat remains available but fixture-backed later.
	app := &App{
		mode:              opts.Mode,
		configService:     cfgService,
		fileService:       fileService,
		llmService:        nil,
		imageGenService:   nil,
		imageAssetService: nil,
		chatService:       backend.NewChatService(nil),
		events:            opts.Events,
		clock:             opts.Clock,
		ids:               opts.IDs,
		faultPlan:         opts.FaultPlan,
	}
	return app, nil
}

// LoadChatSessions is retained for binding compatibility but is a no-op on the active path.
func (a *App) LoadChatSessions(canvasID string) ([]backend.ChatSession, error) {
	return []backend.ChatSession{}, nil
}

// SaveChatSessions is retained for binding compatibility but does not persist Dialogue.
func (a *App) SaveChatSessions(canvasID string, sessions []backend.ChatSession) error {
	return nil
}

// GetRuntimeEnvironment exposes mode/seed information for Frontend bootstrap.
func (a *App) GetRuntimeEnvironment() map[string]interface{} {
	out := map[string]interface{}{
		"mode": string(a.mode),
	}
	if a.mode == backend.RuntimeModeE2E {
		out["seed"] = "e2e"
		if a.clock != nil {
			out["epochMs"] = a.clock.NowUnixMilli()
		}
		if a.faultPlan != nil {
			out["faultPlan"] = map[string]string{"failOnceAt": a.faultPlan.FailOnceAt}
		}
	}
	return out
}

// SendChat starts an asynchronous agent run. Progress is emitted as Wails
// events named chat:stream, chat:tool_* and chat:done/cancelled/error.
func (a *App) SendChat(req backend.ChatRequest) error {
	if a.chatService == nil {
		return fmt.Errorf("chat service is unavailable")
	}
	return a.chatService.Send(req)
}

// CancelChat cancels only the requested run and is safe to call repeatedly.
func (a *App) CancelChat(runID string) error {
	if a.chatService == nil {
		return fmt.Errorf("chat service is unavailable")
	}
	return a.chatService.Cancel(runID)
}

// ResolveToolApplication acknowledges a mutation proposal from the Frontend.
func (a *App) ResolveToolApplication(result backend.ToolApplicationResult) error {
	if a.chatService == nil {
		return fmt.Errorf("chat service is unavailable")
	}
	return a.chatService.Resolve(result)
}

// GenerateChatReply returns an LLM response for the ChatDrawer.
func (a *App) GenerateChatReply(prompt string, contextData string) (string, error) {
	if a.llmService == nil {
		return "fixture-llm-response", nil
	}
	return a.llmService.GenerateChatReply(prompt, contextData)
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.fileService != nil {
		a.fileService.SetContext(ctx)
	}
	if a.chatService != nil {
		a.chatService.SetEmitter(func(event backend.ChatEvent) {
			runtime.EventsEmit(ctx, event.Type, event)
		})
	}
}

// GetConfig returns the application configuration
func (a *App) GetConfig() (backend.Config, error) {
	if a.configService == nil {
		return backend.Config{}, fmt.Errorf("config service is unavailable")
	}
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
	if a.llmService == nil {
		return "fixture-llm-response", nil
	}
	return a.llmService.GenerateText(prompt, contextData)
}

// GenerateSummary calls the LLM service to summarize text
func (a *App) GenerateSummary(text string) (string, error) {
	if a.llmService == nil {
		return "fixture summary", nil
	}
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

// GenerateImageWithProvider generates an image with a request-level provider override
func (a *App) GenerateImageWithProvider(prompt string, contextData string, refImages []string, provider string) (string, error) {
	return a.imageGenService.GenerateImageWithProvider(prompt, contextData, refImages, provider)
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

// ExportMarkdownWithFilename opens a Markdown save dialog with a suggested filename.
func (a *App) ExportMarkdownWithFilename(content string, defaultFilename string) (string, error) {
	return a.fileService.ExportMarkdownWithFilename(content, defaultFilename)
}

// ExportImage opens a dialog and copies the image to the selected path
func (a *App) ExportImage(src string) (string, error) {
	return a.fileService.ExportImage(src)
}

// GetImageFileURL converts a relative image path to an absolute file URL
func (a *App) GetImageFileURL(src string) (string, error) {
	return a.fileService.GetImageFileURL(src)
}
