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
	llmPort            backend.LLMPort
	imageGenService    backend.ImagePort
	imageAssetService  backend.ImageAssetPort
	chatSessionService *backend.ChatSessionService
	chatService        *backend.ChatService
	events             backend.EventPort
	clock              backend.Clock
	ids                backend.IDGenerator
	faultPlan          *backend.E2EFaultPlan
	webSearch          backend.WebSearchPort
	searchFixture      *backend.FixtureWebSearch
	imageFixture       *backend.FixtureImage
	llmFixture         *backend.FixtureLLM
	lastOpenedURL      string
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
	ids := backend.RandomIDGenerator{}
	clock := backend.SystemClock{}
	search := backend.ConfigWebSearch{Store: configService}
	chatService := backend.NewChatService(llmService)
	chatService.SetWebSearch(search, ids, clock)
	chatService.SetImage(imageGenService)
	chatService.SetImageAsset(imageAssetService)
	chatSessions, err := backend.NewChatSessionService()
	if err != nil {
		fmt.Printf("Error initializing ChatSessionService: %v\n", err)
	}

	return &App{
		mode:               backend.RuntimeModeProduction,
		configService:      configService,
		fileService:        fileService,
		llmService:         llmService,
		llmPort:            llmService,
		imageGenService:    imageGenService,
		imageAssetService:  imageAssetService,
		chatService:        chatService,
		chatSessionService: chatSessions,
		events:             &backend.CapturingEventPort{},
		clock:              clock,
		ids:                ids,
		webSearch:          search,
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
		Files:     fs,
		Assets:    backend.TempAssetStore{Root: abs, FS: fs},
		LLM:       &backend.FixtureLLM{Text: "fixture-llm-response"},
		Image:     &backend.FixtureImage{Path: "generated/fixture.png"},
		WebSearch: backend.NewFixtureWebSearch(),
		Events:    &backend.CapturingEventPort{},
		Clock:     backend.NewFakeClock(time.Date(2026, 8, 11, 0, 0, 0, 0, time.UTC)),
		IDs:       backend.NewSeededIDGenerator("e2e"),
		Mode:      backend.RuntimeModeE2E,
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

	// E2E: keep all config/chat state inside the explicit temp root.
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
	search := opts.WebSearch
	fixture, _ := search.(*backend.FixtureWebSearch)
	if search == nil {
		fixture = backend.NewFixtureWebSearch()
		search = fixture
	}
	if opts.FaultPlan != nil && strings.HasPrefix(opts.FaultPlan.FailOnceAt, "web-search-") {
		if fixture == nil {
			fixture = backend.NewFixtureWebSearch()
			search = fixture
		}
		fixture.SetFault(opts.FaultPlan.FailOnceAt)
	}
	chatService := backend.NewChatService(opts.LLM)
	chatService.SetWebSearch(search, opts.IDs, opts.Clock)
	if opts.Image != nil {
		chatService.SetImage(opts.Image)
	}
	if opts.Assets != nil {
		chatService.SetImageAsset(opts.Assets)
	}

	// Wire image services from the injected ports so the E2E composition root
	// is non-nil. opts.Image is FixtureImage (no network); opts.Assets is the
	// TempAssetStore confined to the temp root.
	var imageFixture *backend.FixtureImage
	if f, ok := opts.Image.(*backend.FixtureImage); ok {
		imageFixture = f
	}
	llmFixture, _ := opts.LLM.(*backend.FixtureLLM)
	var imagePort backend.ImagePort
	if opts.Image != nil {
		imagePort = opts.Image
	}
	app := &App{
		mode:               opts.Mode,
		configService:      cfgService,
		fileService:        fileService,
		llmService:         nil,
		llmPort:            opts.LLM,
		imageGenService:    imagePort,
		imageAssetService:  opts.Assets,
		chatService:        chatService,
		chatSessionService: backend.NewChatSessionServiceAt(filepath.Join(opts.Files.Root(), "chat-sessions.json")),
		events:             opts.Events,
		clock:              opts.Clock,
		ids:                opts.IDs,
		faultPlan:          opts.FaultPlan,
		webSearch:          search,
		searchFixture:      fixture,
		imageFixture:       imageFixture,
		llmFixture:         llmFixture,
	}
	return app, nil
}

// LoadChatSessions loads the existing per-Canvas session store.
func (a *App) LoadChatSessions(canvasID string) ([]backend.ChatSession, error) {
	if a.chatSessionService == nil {
		return []backend.ChatSession{}, nil
	}
	return a.chatSessionService.Load(canvasID)
}

// SaveChatSessions persists the per-Canvas session store.
func (a *App) SaveChatSessions(canvasID string, sessions []backend.ChatSession) error {
	if a.chatSessionService == nil {
		return fmt.Errorf("chat session service is unavailable")
	}
	return a.chatSessionService.Save(canvasID, sessions)
}

// ReadE2EChatSessionsRaw exposes the isolated temp-root persistence file so
// Playwright can assert the actual JSON marker written by the backend. It is
// intentionally unavailable outside the E2E composition root.
func (a *App) ReadE2EChatSessionsRaw() (string, error) {
	if a.mode != backend.RuntimeModeE2E {
		return "", fmt.Errorf("raw chat session inspection is only available in E2E mode")
	}
	if a.chatSessionService == nil {
		return "", fmt.Errorf("chat session service is unavailable")
	}
	return a.chatSessionService.ReadRawJSON()
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
		if a.lastOpenedURL != "" {
			out["lastOpenedURL"] = a.lastOpenedURL
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
	if a.llmPort == nil {
		return "", fmt.Errorf("LLM service is unavailable")
	}
	return a.llmPort.GenerateChatReply(prompt, contextData)
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
	if a.llmPort == nil {
		return "", fmt.Errorf("LLM service is unavailable")
	}
	return a.llmPort.GenerateText(prompt, contextData)
}

// SuggestNextActions returns a read-only, one-shot structured proposal set.
// It never enters the Agent loop and never mutates Workspace or Dialogue.
func (a *App) SuggestNextActions(req backend.NextActionRequest) (backend.NextActionProposalSet, error) {
	if err := req.Validate(); err != nil {
		return backend.NextActionProposalSet{}, err
	}
	eligible := backend.EligibleNextActionKinds(req)
	// With no usable intent or eligible child action, clarify is deterministic and
	// deliberately avoids a provider call.
	if strings.TrimSpace(req.FocusText) == "" && len(req.DialogueHistory) == 0 && len(req.SelectedNodeIDs) == 0 && len(req.NodeHints) == 0 {
		raw := `{"actions":[{"kind":"clarify","title":"作業の焦点を一つ決める","reason":"次の一手を選ぶための材料が不足しています。","expectedResult":"具体的な質問を一つ決めます。","question":"今回の作業で最も重視したいことは何ですか？","targetNodeIds":[]}]}`
		return backend.ParseNextActions(raw, req, []backend.NextActionKind{backend.ActionClarify})
	}
	prompt := backend.BuildNextActionPrompt(req, eligible)
	var raw string
	var err error
	if fixture, ok := a.llmPort.(*backend.FixtureLLM); ok {
		raw, err = fixture.NextActionsResponse(eligible, req.SelectedNodeIDs)
	} else if orchestrationLLM, ok := a.llmPort.(interface{ GenerateOrchestrationProposal(string) (string, error) }); ok {
		raw, err = orchestrationLLM.GenerateOrchestrationProposal(prompt)
	} else if a.mode == backend.RuntimeModeProduction {
		// Production must use the dedicated adapter so a configured general
		// system prompt can never enter the orchestration route.
		err = fmt.Errorf("orchestration provider does not implement the dedicated proposal adapter")
	} else if a.llmPort != nil {
		// E2E-only compatibility fallback for injected ports that predate the
		// dedicated orchestration surface. The fallback is never used by the
		// production composition root.
		raw, err = a.llmPort.GenerateText(prompt, "")
	} else {
		err = fmt.Errorf("LLM service is unavailable")
	}
	if err != nil {
		return backend.NextActionProposalSet{}, fmt.Errorf("orchestration-provider-error: %w", err)
	}
	proposal, err := backend.ParseNextActions(raw, req, eligible)
	if err != nil {
		return backend.NextActionProposalSet{}, fmt.Errorf("orchestration-validation-error: %w", err)
	}
	return proposal, nil
}

// DirectTransform performs exactly one structured transform request for an
// explicit canvas action. It never enters the dialogue/agent loop or creates a
// proposal acknowledgement, and returns only a validated draft for the
// frontend's atomic apply command.
func (a *App) DirectTransform(req backend.DirectTransformRequest) (backend.TransformProposal, error) {
	// Validate against the allowlisted request body only. Extra or missing
	// sourceNodes / sourceRevisions fail before any provider call.
	snapshot := backend.CanvasSnapshot{CanvasID: req.CanvasID, Nodes: req.SourceNodes}
	if err := req.Validate(snapshot); err != nil {
		return backend.TransformProposal{}, err
	}
	allowlisted, err := req.AllowlistedSourceNodes()
	if err != nil {
		return backend.TransformProposal{}, err
	}
	sections := make([]string, 0, len(allowlisted))
	previews := make([]backend.TransformSourcePreview, 0, len(allowlisted))
	for _, source := range allowlisted {
		sections = append(sections, fmt.Sprintf("Source %s (revision %d):\n%s", source.ID, source.Revision, source.Markdown))
		previews = append(previews, backend.TransformSourcePreview{
			NodeID:   source.ID,
			Content:  source.Markdown,
			Revision: source.Revision,
		})
	}
	body := strings.Join(sections, "\n\n")
	content, err := a.GenerateText(
		strings.ToUpper(req.Operation)+" the selected Canvas nodes. Return only the resulting Markdown.\n\n"+body,
		body,
	)
	if err != nil {
		return backend.TransformProposal{}, err
	}
	revisions := make(map[string]int64, len(req.SourceRevisions))
	for id, revision := range req.SourceRevisions {
		revisions[id] = revision
	}
	return backend.TransformProposal{
		Operation:         req.Operation,
		SourceNodeIDs:     append([]string(nil), req.SourceNodeIDs...),
		SourceRevisions:   revisions,
		Content:           content,
		Summary:           req.Operation + " result",
		Sources:           previews,
		WorkspaceID:       req.WorkspaceID,
		CanvasID:          req.CanvasID,
		RuntimeGeneration: req.RuntimeGeneration,
		ScopeEpoch:        req.ScopeEpoch,
	}, nil
}

// SuggestRelations performs one structured one-shot Relation batch suggestion.
// It never enters the agent loop or creates a proposal acknowledgement; the
// returned RelationBatchProposal is displayed for explicit human accept.
func (a *App) SuggestRelations(req backend.DirectSuggestRelationsRequest) (backend.RelationBatchProposal, error) {
	if err := req.Validate(); err != nil {
		return backend.RelationBatchProposal{}, err
	}
	body, previews, err := backend.BuildSuggestSourceBody(req.SourceNodeIDs, req.SourceNodes)
	if err != nil {
		return backend.RelationBatchProposal{}, err
	}
	vision, err := backend.ResolveSuggestVisionImages(req.SourceNodeIDs, req.SourceNodes, a.imageAssetService)
	if err != nil {
		return backend.RelationBatchProposal{}, err
	}
	prompt := "Propose up to 8 typed Relations between the provided Canvas nodes. Return JSON only with exactly this shape: {\"relations\":[{\"sourceNodeId\":\"...\",\"targetNodeId\":\"...\",\"kind\":\"supports\",\"reason\":\"...\",\"direction\":\"forward\"}]}. kind must be one of source, derived, supports, opposes, similar. Only reference the provided node IDs.\n\n" + body
	raw, err := a.suggestRaw(prompt, body, vision, req.SourceNodeIDs, "relation-batch")
	if err != nil {
		return backend.RelationBatchProposal{}, err
	}
	relations, err := backend.ParseSuggestRelations(raw, req.SourceNodeIDs)
	if err != nil {
		return backend.RelationBatchProposal{}, err
	}
	return backend.RelationBatchProposal{
		Relations:         relations,
		SourceRevisions:   copyRevisions(req.SourceRevisions),
		Sources:           previews,
		WorkspaceID:       req.WorkspaceID,
		CanvasID:          req.CanvasID,
		RuntimeGeneration: req.RuntimeGeneration,
		ScopeEpoch:        req.ScopeEpoch,
	}, nil
}

// SuggestClusters performs one structured one-shot Cluster View suggestion.
// It never enters the agent loop or creates a proposal acknowledgement.
func (a *App) SuggestClusters(req backend.DirectSuggestClustersRequest) (backend.ClusterViewProposal, error) {
	if err := req.Validate(); err != nil {
		return backend.ClusterViewProposal{}, err
	}
	body, _, err := backend.BuildSuggestSourceBody(req.SourceNodeIDs, req.SourceNodes)
	if err != nil {
		return backend.ClusterViewProposal{}, err
	}
	vision, err := backend.ResolveSuggestVisionImages(req.SourceNodeIDs, req.SourceNodes, a.imageAssetService)
	if err != nil {
		return backend.ClusterViewProposal{}, err
	}
	prompt := "Group the provided Canvas nodes into 2 to 8 named clusters that share an argument or viewpoint. Return JSON only with exactly this shape: {\"label\":\"...\",\"clusters\":[{\"label\":\"...\",\"reason\":\"...\",\"nodeIds\":[\"...\"]}],\"ungroupedNodeIds\":[\"...\"]}. Assign each node to at most one cluster. Only reference the provided node IDs.\n\n" + body
	raw, err := a.suggestRaw(prompt, body, vision, req.SourceNodeIDs, "cluster-view")
	if err != nil {
		return backend.ClusterViewProposal{}, err
	}
	viewLabel, clusters, ungrouped, err := backend.ParseSuggestClusters(raw, req.SourceNodeIDs)
	if err != nil {
		return backend.ClusterViewProposal{}, err
	}
	return backend.ClusterViewProposal{
		ViewLabel:         viewLabel,
		Clusters:          clusters,
		UngroupedNodeIDs:  ungrouped,
		SourceRevisions:   copyRevisions(req.SourceRevisions),
		WorkspaceID:       req.WorkspaceID,
		CanvasID:          req.CanvasID,
		RuntimeGeneration: req.RuntimeGeneration,
		ScopeEpoch:        req.ScopeEpoch,
	}, nil
}

// suggestRaw dispatches a Direct suggestion through the FixtureLLM (E2E, with
// delay/fault support) or the real LLM port (text or multimodal).
func (a *App) suggestRaw(prompt, body string, vision []string, sourceNodeIDs []string, kind string) (string, error) {
	if fixture, ok := a.llmPort.(*backend.FixtureLLM); ok {
		if kind == "relation-batch" {
			return fixture.SuggestRelationsText(sourceNodeIDs)
		}
		return fixture.SuggestClustersText(sourceNodeIDs)
	}
	if a.llmPort == nil {
		return "", fmt.Errorf("LLM service is unavailable")
	}
	if len(vision) > 0 {
		return a.llmPort.GenerateTextWithImages(prompt, body, vision)
	}
	return a.llmPort.GenerateText(prompt, body)
}

func copyRevisions(in map[string]int64) map[string]int64 {
	out := make(map[string]int64, len(in))
	for id, rev := range in {
		out[id] = rev
	}
	return out
}

func (a *App) requireSuggestFixture() (*backend.FixtureLLM, error) {
	if a.mode != backend.RuntimeModeE2E {
		return nil, fmt.Errorf("e2e suggest controls are unavailable outside e2e mode")
	}
	fixture, ok := a.llmPort.(*backend.FixtureLLM)
	if !ok || fixture == nil {
		return nil, fmt.Errorf("e2e LLM fixture is unavailable")
	}
	return fixture, nil
}

// SetE2ENextActionsFixture configures the one-shot planner fixture in E2E only.
func (a *App) SetE2ENextActionsFixture(raw string) error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.SetNextActionsJSON(raw)
	return nil
}
func (a *App) ArmDelayedNextActions() error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.ArmNextActionsDelay()
	return nil
}
func (a *App) ReleaseDelayedNextActions() error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.ReleaseNextActionsDelay()
	return nil
}
func (a *App) ArmNextActionsFault(code string) error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.SetNextActionsFault(code)
	return nil
}

func (a *App) GetE2ENextActionsCallCount() (int, error) {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return 0, err
	}
	return fixture.NextActionsCallCount(), nil
}

// ArmDelayedSuggest holds the next Direct suggestion until ReleaseDelayedSuggest.
func (a *App) ArmDelayedSuggest() error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.ArmSuggestDelay()
	return nil
}

// ReleaseDelayedSuggest releases a held Direct suggestion.
func (a *App) ReleaseDelayedSuggest() error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.ReleaseSuggestDelay()
	return nil
}

// ArmE2ESuggestFault sets a one-shot Direct suggestion error code.
func (a *App) ArmE2ESuggestFault(code string) error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.SetSuggestFault(strings.TrimSpace(code))
	return nil
}

// SearchWeb runs the selected WebSearchPort once and returns a Context Packet.
// It does not mutate the Workspace document.
func (a *App) SearchWeb(req backend.WebSearchRequest) (backend.ContextPacket, error) {
	if a.webSearch == nil || a.ids == nil || a.clock == nil {
		return backend.ContextPacket{}, fmt.Errorf("web search is unavailable")
	}
	return backend.ExecuteWebSearch(context.Background(), a.webSearch, req, a.ids, a.clock, a.llmPort)
}

// OpenExternalURL opens a validated https URL in the OS browser. E2E records the URL only.
func (a *App) OpenExternalURL(raw string) error {
	normalized, err := backend.NormalizeHTTPSURL(raw)
	if err != nil {
		return err
	}
	a.lastOpenedURL = normalized.URL
	if a.mode == backend.RuntimeModeE2E {
		return nil
	}
	if a.ctx == nil {
		return fmt.Errorf("runtime context is unavailable")
	}
	runtime.BrowserOpenURL(a.ctx, normalized.URL)
	return nil
}

func (a *App) requireSearchFixture() (*backend.FixtureWebSearch, error) {
	if a.mode != backend.RuntimeModeE2E {
		return nil, fmt.Errorf("e2e search controls are unavailable outside e2e mode")
	}
	if a.searchFixture == nil {
		return nil, fmt.Errorf("e2e search fixture is unavailable")
	}
	return a.searchFixture, nil
}

// GetImageFixtureObservations returns the last image generation request recorded
// by the FixtureImage in E2E mode. Core E2E uses this to assert the allowlisted
// prompt / context / reference-image payload without a real provider.
func (a *App) GetImageFixtureObservations() (map[string]interface{}, error) {
	if a.mode != backend.RuntimeModeE2E {
		return nil, fmt.Errorf("e2e image observations are unavailable outside e2e mode")
	}
	if a.imageFixture == nil {
		return nil, fmt.Errorf("e2e image fixture is unavailable")
	}
	prompt, contextData, provider, refs, refCount := a.imageFixture.Observations()
	return map[string]interface{}{
		"prompt":    prompt,
		"context":   contextData,
		"provider":  provider,
		"refs":      refs,
		"refCount":  refCount,
		"callCount": a.imageFixture.Calls(),
	}, nil
}

func (a *App) GetLLMFixtureObservations() (map[string]interface{}, error) {
	if a.mode != backend.RuntimeModeE2E || a.llmFixture == nil {
		return nil, fmt.Errorf("e2e LLM observations are unavailable")
	}
	calls, userText, imageURLs := a.llmFixture.Observations()
	return map[string]interface{}{
		"callCount":     calls,
		"userText":      userText,
		"imageURLs":     imageURLs,
		"imageCount":    len(imageURLs),
		"agentRequests": a.llmFixture.AgentRequestObservations(),
	}, nil
}

func (a *App) requireImageFixture() (*backend.FixtureImage, error) {
	if a.mode != backend.RuntimeModeE2E || a.imageFixture == nil {
		return nil, fmt.Errorf("e2e image fixture is unavailable")
	}
	return a.imageFixture, nil
}

func (a *App) ArmE2EImageFault(code string) error {
	fixture, err := a.requireImageFixture()
	if err != nil {
		return err
	}
	fixture.SetFault(code)
	return nil
}

func (a *App) ArmDelayedImageGeneration() error {
	fixture, err := a.requireImageFixture()
	if err != nil {
		return err
	}
	fixture.ArmDelay()
	return nil
}

func (a *App) ReleaseDelayedImageGeneration() error {
	fixture, err := a.requireImageFixture()
	if err != nil {
		return err
	}
	fixture.ReleaseDelay()
	return nil
}

// ArmDelayedTextGeneration holds the next E2E Direct Text generation until
// ReleaseDelayedTextGeneration, allowing navigation freshness tests.
func (a *App) ArmDelayedTextGeneration() error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.ArmTextDelay()
	return nil
}

func (a *App) ReleaseDelayedTextGeneration() error {
	fixture, err := a.requireSuggestFixture()
	if err != nil {
		return err
	}
	fixture.ReleaseTextDelay()
	return nil
}

// ArmE2ESearchFault sets a one-shot fake search error for Core E2E.
func (a *App) ArmE2ESearchFault(code string) error {
	fixture, err := a.requireSearchFixture()
	if err != nil {
		return err
	}
	fixture.SetFault(strings.TrimSpace(code))
	return nil
}

// ArmDelayedSearchWeb holds the next fake search until ReleaseDelayedSearchWeb.
func (a *App) ArmDelayedSearchWeb() error {
	fixture, err := a.requireSearchFixture()
	if err != nil {
		return err
	}
	fixture.ArmDelay()
	return nil
}

// ReleaseDelayedSearchWeb releases a held fake search.
func (a *App) ReleaseDelayedSearchWeb() error {
	fixture, err := a.requireSearchFixture()
	if err != nil {
		return err
	}
	fixture.ReleaseDelay()
	return nil
}

// GenerateSummary calls the LLM service to summarize text
func (a *App) GenerateSummary(text string) (string, error) {
	if a.llmPort == nil {
		return "", fmt.Errorf("LLM service is unavailable")
	}
	return a.llmPort.GenerateSummary(text)
}

// Greet returns a greeting for the given name (Legacy / Test)
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GenerateImage generates an image based on a prompt and reference images
func (a *App) GenerateImage(prompt string, contextData string, refImages []string) (string, error) {
	if a.imageGenService == nil {
		return "", fmt.Errorf("image generation is unavailable")
	}
	return a.imageGenService.GenerateImage(prompt, contextData, refImages)
}

// GenerateImageWithProvider generates an image with a request-level provider override
func (a *App) GenerateImageWithProvider(prompt string, contextData string, refImages []string, provider string) (string, error) {
	if a.imageGenService == nil {
		return "", fmt.Errorf("image generation is unavailable")
	}
	return a.imageGenService.GenerateImageWithProvider(prompt, contextData, refImages, provider)
}

// GetImageDataURL converts a relative image path to a Data URL for display
func (a *App) GetImageDataURL(src string) (string, error) {
	if a.imageAssetService == nil {
		return "", fmt.Errorf("image asset service is unavailable")
	}
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
	if a.llmPort == nil {
		return "", fmt.Errorf("LLM service is unavailable")
	}
	return a.llmPort.GenerateTextWithImages(prompt, contextData, imageDataURLs)
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
