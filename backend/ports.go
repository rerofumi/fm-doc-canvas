package backend

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// RuntimeMode distinguishes production from isolated E2E composition.
type RuntimeMode string

const (
	RuntimeModeProduction RuntimeMode = "production"
	RuntimeModeE2E        RuntimeMode = "e2e"
)

// ConfigStore persists application configuration without constructor side effects.
type ConfigStore interface {
	GetConfig() Config
	Save(cfg *Config) error
	Load() error
	ResolveDownloadPath() (string, error)
	ResolveImagePath(src string) (string, error)
}

// DialogPort abstracts native open/save dialogs.
type DialogPort interface {
	SaveFile(ctx context.Context, title, defaultFilename string, filters []FileFilter) (string, error)
	OpenFile(ctx context.Context, title string, filters []FileFilter) (string, error)
}

// FileFilter describes a native dialog file filter.
type FileFilter struct {
	DisplayName string
	Pattern     string
}

// FileSystemPort is a root-aware filesystem used by save/load/import/export.
type FileSystemPort interface {
	ReadFile(path string) ([]byte, error)
	WriteFile(path string, data []byte) error
	CopyFile(src, dst string) error
	MkdirAll(path string) error
	Stat(path string) (os.FileInfo, error)
	// Root returns the canonical temp/user data root when constrained, else "".
	Root() string
}

// AssetStore resolves and materializes image assets under a configured root.
type AssetStore interface {
	ResolveImagePath(src string) (string, error)
	GetImageDataURL(src string) (string, error)
	GetImageFileURL(src string) (string, error)
	ImportImage(srcPath string) (relativePath string, err error)
	ExportImage(src, destPath string) error
}

// LLMPort is the text generation surface used by ChatService and Direct Action.
type LLMPort interface {
	GenerateText(prompt, contextData string) (string, error)
	GenerateTextWithImages(prompt, contextData string, imageDataURLs []string) (string, error)
	GenerateSummary(text string) (string, error)
	GenerateChatReply(prompt, contextData string) (string, error)
	AgentSystemPrompt() string
	StreamAgentChat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, onText func(string)) (AgentChatResult, error)
}

// ImagePort generates images without embedding credentials in request DTOs.
type ImagePort interface {
	GenerateImage(prompt, contextData string, refImages []string) (string, error)
	GenerateImageWithProvider(prompt, contextData string, refImages []string, provider string) (string, error)
}

// ImageAssetPort resolves a stored image asset to a data URL for display.
// ImageGenService (concrete) and TempAssetStore both satisfy it, so the App can
// keep an asset service non-nil in E2E without reading a real API key.
type ImageAssetPort interface {
	GetImageDataURL(src string) (string, error)
}

// WebSearchHit is the provider-normalized observation returned by a search strategy.
type WebSearchHit struct {
	Title   string
	URL     string
	Snippet string
}

// WebSearchPort is a single Context Provider strategy. Callers never failover.
type WebSearchPort interface {
	ID() string
	Search(ctx context.Context, query string, maxResults int) ([]WebSearchHit, error)
}

// EventPort emits chat/proposal events to the Frontend.
type EventPort interface {
	Emit(event ChatEvent)
}

// Clock provides injectable wall-clock time.
type Clock interface {
	Now() time.Time
	NowISO() string
	NowUnixMilli() int64
}

// IDGenerator produces deterministic IDs in E2E and unique IDs in production.
type IDGenerator interface {
	Next(kind string) string
}

// E2EFaultPlan injects one-shot failures for CE2E-05. Production must keep this nil.
type E2EFaultPlan struct {
	FailOnceAt string `json:"failOnceAt,omitempty"`
}

// AppOptions is the composition-root input for NewApp.
type AppOptions struct {
	Config    ConfigStore
	Dialog    DialogPort
	Files     FileSystemPort
	Assets    AssetStore
	LLM       LLMPort
	Image     ImagePort
	WebSearch WebSearchPort
	Events    EventPort
	Clock     Clock
	IDs       IDGenerator
	FaultPlan *E2EFaultPlan
	Mode      RuntimeMode
}

// Validate checks port wiring and mode invariants without touching the filesystem.
func (o AppOptions) Validate() error {
	if o.Mode != RuntimeModeProduction && o.Mode != RuntimeModeE2E {
		return fmt.Errorf("invalid runtime mode %q", o.Mode)
	}
	if o.Config == nil || o.Dialog == nil || o.Files == nil || o.Assets == nil || o.LLM == nil || o.Image == nil || o.WebSearch == nil || o.Events == nil || o.Clock == nil || o.IDs == nil {
		return fmt.Errorf("all AppOptions ports must be non-nil")
	}
	if o.Mode == RuntimeModeProduction && o.FaultPlan != nil {
		return fmt.Errorf("FaultPlan must be nil in production mode")
	}
	if o.Mode == RuntimeModeE2E {
		root := strings.TrimSpace(o.Files.Root())
		if root == "" {
			return fmt.Errorf("e2e mode requires an explicit temp filesystem root")
		}
		abs, err := filepath.Abs(root)
		if err != nil {
			return fmt.Errorf("e2e temp root: %w", err)
		}
		userCfg, err := os.UserConfigDir()
		if err == nil {
			realUser := filepath.Join(userCfg, "fm-doc-canvas")
			if sameOrChildPath(abs, realUser) || sameOrChildPath(realUser, abs) {
				return fmt.Errorf("e2e temp root must not overlap real user config path")
			}
		}
	}
	return nil
}

func sameOrChildPath(parent, child string) bool {
	rel, err := filepath.Rel(filepath.Clean(parent), filepath.Clean(child))
	if err != nil {
		return false
	}
	return rel == "." || (!strings.HasPrefix(rel, "..") && rel != "..")
}

// SystemClock is the production wall clock.
type SystemClock struct{}

func (SystemClock) Now() time.Time      { return time.Now() }
func (SystemClock) NowISO() string      { return time.Now().UTC().Format(time.RFC3339) }
func (SystemClock) NowUnixMilli() int64 { return time.Now().UnixMilli() }

// FakeClock is a fixed/seedable clock for E2E.
type FakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func NewFakeClock(t time.Time) *FakeClock { return &FakeClock{now: t.UTC()} }

func (c *FakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}
func (c *FakeClock) NowISO() string      { return c.Now().Format(time.RFC3339) }
func (c *FakeClock) NowUnixMilli() int64 { return c.Now().UnixMilli() }
func (c *FakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

// SeededIDGenerator returns deterministic IDs: kind-N.
type SeededIDGenerator struct {
	mu     sync.Mutex
	counts map[string]int
	prefix string
}

func NewSeededIDGenerator(prefix string) *SeededIDGenerator {
	return &SeededIDGenerator{counts: map[string]int{}, prefix: prefix}
}

func (g *SeededIDGenerator) Next(kind string) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.counts[kind]++
	if g.prefix == "" {
		return fmt.Sprintf("%s-%d", kind, g.counts[kind])
	}
	return fmt.Sprintf("%s-%s-%d", g.prefix, kind, g.counts[kind])
}

// RandomIDGenerator wraps crypto/random style unique IDs for production.
type RandomIDGenerator struct{}

func (RandomIDGenerator) Next(kind string) string {
	// Windows' wall-clock resolution can return the same UnixNano value for
	// several consecutive calls. Packet items use these IDs as checkbox keys,
	// so a collision makes multiple rows behave like one selection.
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err == nil {
		return kind + "-" + hex.EncodeToString(bytes)
	}
	return fmt.Sprintf("%s-%d-%d", kind, time.Now().UnixNano(), os.Getpid())
}

// MemoryConfigStore keeps config in memory and never touches %AppData%.
type MemoryConfigStore struct {
	mu     sync.RWMutex
	config Config
	root   string
}

func NewMemoryConfigStore(root string, cfg *Config) *MemoryConfigStore {
	c := defaultConfig()
	if cfg != nil {
		*c = *cfg
		applyConfigDefaults(c)
	}
	if c.ImageGen.DownloadPath == "" || !filepath.IsAbs(c.ImageGen.DownloadPath) {
		c.ImageGen.DownloadPath = filepath.Join(root, "Image")
	}
	return &MemoryConfigStore{config: *c, root: root}
}

func (s *MemoryConfigStore) GetConfig() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *MemoryConfigStore) Save(cfg *Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	applyConfigDefaults(cfg)
	s.config = *cfg
	return nil
}

func (s *MemoryConfigStore) Load() error { return nil }

func (s *MemoryConfigStore) ResolveDownloadPath() (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if filepath.IsAbs(s.config.ImageGen.DownloadPath) {
		return s.config.ImageGen.DownloadPath, nil
	}
	return filepath.Join(s.root, s.config.ImageGen.DownloadPath), nil
}

func (s *MemoryConfigStore) ResolveImagePath(src string) (string, error) {
	if filepath.IsAbs(src) || strings.Contains(src, "..") {
		return "", fmt.Errorf("invalid image path")
	}
	root, err := s.ResolveDownloadPath()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, filepath.FromSlash(src)), nil
}

// OSFileSystem is an unconstrained production filesystem.
type OSFileSystem struct{}

func (OSFileSystem) ReadFile(path string) ([]byte, error) { return os.ReadFile(path) }
func (OSFileSystem) WriteFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0o644)
}
func (OSFileSystem) MkdirAll(path string) error            { return os.MkdirAll(path, 0o755) }
func (OSFileSystem) Stat(path string) (os.FileInfo, error) { return os.Stat(path) }
func (OSFileSystem) Root() string                          { return "" }
func (OSFileSystem) CopyFile(src, dst string) error {
	in, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, in, 0o644)
}

// TempFileSystem confines all access under a canonical root.
type TempFileSystem struct {
	root string
}

func NewTempFileSystem(root string) (*TempFileSystem, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, err
	}
	return &TempFileSystem{root: abs}, nil
}

func (fs *TempFileSystem) Root() string { return fs.root }

func (fs *TempFileSystem) guard(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(fs.root, abs)
	if err != nil || strings.HasPrefix(rel, "..") || rel == ".." {
		return "", fmt.Errorf("path %q escapes e2e root", path)
	}
	return abs, nil
}

func (fs *TempFileSystem) ReadFile(path string) ([]byte, error) {
	abs, err := fs.guard(path)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(abs)
}

func (fs *TempFileSystem) WriteFile(path string, data []byte) error {
	abs, err := fs.guard(path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, data, 0o644)
}

func (fs *TempFileSystem) MkdirAll(path string) error {
	abs, err := fs.guard(path)
	if err != nil {
		return err
	}
	return os.MkdirAll(abs, 0o755)
}

func (fs *TempFileSystem) Stat(path string) (os.FileInfo, error) {
	abs, err := fs.guard(path)
	if err != nil {
		return nil, err
	}
	return os.Stat(abs)
}

func (fs *TempFileSystem) CopyFile(src, dst string) error {
	in, err := fs.ReadFile(src)
	if err != nil {
		return err
	}
	return fs.WriteFile(dst, in)
}

// CapturingEventPort records events for tests and optionally forwards them.
type CapturingEventPort struct {
	mu      sync.Mutex
	Events  []ChatEvent
	Forward func(ChatEvent)
}

func (p *CapturingEventPort) Emit(event ChatEvent) {
	p.mu.Lock()
	p.Events = append(p.Events, event)
	fwd := p.Forward
	p.mu.Unlock()
	if fwd != nil {
		fwd(event)
	}
}

func (p *CapturingEventPort) Snapshot() []ChatEvent {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]ChatEvent, len(p.Events))
	copy(out, p.Events)
	return out
}

// FixedDialog returns preconfigured paths for E2E file adapters.
type FixedDialog struct {
	SavePath string
	OpenPath string
}

func (d FixedDialog) SaveFile(context.Context, string, string, []FileFilter) (string, error) {
	return d.SavePath, nil
}
func (d FixedDialog) OpenFile(context.Context, string, []FileFilter) (string, error) {
	return d.OpenPath, nil
}

// NoopDialog rejects dialog usage until a Wails context adapter is attached.
type NoopDialog struct{}

func (NoopDialog) SaveFile(context.Context, string, string, []FileFilter) (string, error) {
	return "", fmt.Errorf("dialog not available")
}
func (NoopDialog) OpenFile(context.Context, string, []FileFilter) (string, error) {
	return "", fmt.Errorf("dialog not available")
}

// FixtureAgentRequest captures the provider-facing message shape used by the
// fake agent provider. It intentionally records only correlation fields and
// tool result content needed by the fake-only regression tests.
type FixtureAgentRequest struct {
	Roles                  []string `json:"roles"`
	Contents               []string `json:"contents"`
	AssistantToolCallIDs   []string `json:"assistantToolCallIds,omitempty"`
	AssistantToolCallNames []string `json:"assistantToolCallNames,omitempty"`
	ToolResultIDs          []string `json:"toolResultIds,omitempty"`
	ToolResultNames        []string `json:"toolResultNames,omitempty"`
	ToolResultContents     []string `json:"toolResultContents,omitempty"`
	ThoughtSignatures      []string `json:"thoughtSignatures,omitempty"`
}

// FixtureLLM returns deterministic text without network access.
type FixtureLLM struct {
	Text string

	// RelationBatchJSON / ClusterViewJSON override the canned Direct suggestion
	// responses when set (Core E2E assertions use the deterministic defaults).
	RelationBatchJSON string
	ClusterViewJSON   string
	NextActionsJSON   string

	mu            sync.Mutex
	CallCount     int
	LastUserText  string
	LastImageURLs []string
	AgentRequests []FixtureAgentRequest

	suggestFault    string
	suggestHold     chan struct{}
	nextActionFault string
	nextActionHold  chan struct{}
	textHold        chan struct{}
}

func (f *FixtureLLM) SetNextActionsJSON(raw string) {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.NextActionsJSON = raw
}
func (f *FixtureLLM) SetNextActionsFault(code string) {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.nextActionFault = strings.TrimSpace(code)
}
func (f *FixtureLLM) ArmNextActionsDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.nextActionHold == nil {
		f.nextActionHold = make(chan struct{})
	}
}
func (f *FixtureLLM) ReleaseNextActionsDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	h := f.nextActionHold
	f.nextActionHold = nil
	f.mu.Unlock()
	if h != nil {
		close(h)
	}
}
func (f *FixtureLLM) NextActionsResponse(eligible []NextActionKind, selected []string) (string, error) {
	f.mu.Lock()
	raw := f.NextActionsJSON
	fault := f.nextActionFault
	f.nextActionFault = ""
	h := f.nextActionHold
	f.nextActionHold = nil
	f.CallCount++
	f.mu.Unlock()
	if h != nil {
		<-h
	}
	if fault != "" {
		return "", fmt.Errorf("%s", fault)
	}
	if raw != "" {
		return raw, nil
	}
	target := append([]string(nil), selected...)
	actions := []map[string]interface{}{}
	for _, k := range eligible {
		if k == ActionClarify {
			actions = append(actions, map[string]interface{}{"kind": "clarify", "targetNodeIds": []string{}, "title": "確認したい点を一つ決める", "reason": "情報がまだ足りません。", "expectedResult": "次の判断に必要な一問", "question": "この作業で最も重視する判断軸は何ですか？"})
			break
		}
		if k == ActionCompare && len(target) >= 2 {
			actions = append(actions, map[string]interface{}{"kind": "compare", "targetNodeIds": target[:2], "title": "二案を比較する", "reason": "選択中の案の判断軸を整理できます。", "expectedResult": "共通点と相違点を持つ派生Text"})
			break
		}
	}
	b, _ := json.Marshal(map[string]interface{}{"actions": actions})
	return string(b), nil
}

func (f *FixtureLLM) NextActionsCallCount() int {
	if f == nil {
		return 0
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.CallCount
}

// SetSuggestFault arms a one-shot Direct suggestion fault for Core E2E error paths.
func (f *FixtureLLM) SetSuggestFault(code string) {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.suggestFault = strings.TrimSpace(code)
}

// ArmSuggestDelay holds the next Direct suggestion until ReleaseSuggestDelay.
func (f *FixtureLLM) ArmSuggestDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.suggestHold == nil {
		f.suggestHold = make(chan struct{})
	}
}

// ReleaseSuggestDelay releases a held Direct suggestion.
func (f *FixtureLLM) ReleaseSuggestDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	hold := f.suggestHold
	f.suggestHold = nil
	f.mu.Unlock()
	if hold != nil {
		close(hold)
	}
}

func (f *FixtureLLM) suggestText(kind string, sourceNodeIDs []string) (string, error) {
	f.mu.Lock()
	hold := f.suggestHold
	fault := f.suggestFault
	f.suggestFault = ""
	f.mu.Unlock()
	if hold != nil {
		<-hold
	}
	if fault != "" {
		return "", fmt.Errorf("%s", fault)
	}
	if kind == "relation-batch" {
		return f.RelationBatchResponse(sourceNodeIDs), nil
	}
	return f.ClusterViewResponse(sourceNodeIDs), nil
}

// SuggestRelationsText returns the Direct Relation batch response, honoring any
// armed delay / fault.
func (f *FixtureLLM) SuggestRelationsText(sourceNodeIDs []string) (string, error) {
	return f.suggestText("relation-batch", sourceNodeIDs)
}

// SuggestClustersText returns the Direct Cluster View response, honoring any
// armed delay / fault.
func (f *FixtureLLM) SuggestClustersText(sourceNodeIDs []string) (string, error) {
	return f.suggestText("cluster-view", sourceNodeIDs)
}

// ArmTextDelay holds the next Direct Text generation until ReleaseTextDelay.
// It is used only by the E2E fixture to exercise freshness guards.
func (f *FixtureLLM) ArmTextDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.textHold == nil {
		f.textHold = make(chan struct{})
	}
}

func (f *FixtureLLM) ReleaseTextDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	hold := f.textHold
	f.textHold = nil
	f.mu.Unlock()
	if hold != nil {
		close(hold)
	}
}

func (f *FixtureLLM) delayedReply() string {
	if f == nil {
		return "fixture-llm-response"
	}
	f.mu.Lock()
	hold := f.textHold
	f.textHold = nil
	f.mu.Unlock()
	if hold != nil {
		<-hold
	}
	return f.reply()
}

func (f *FixtureLLM) reply() string {
	if f == nil {
		return "fixture-llm-response"
	}
	if f.Text != "" {
		return f.Text
	}
	return "fixture-llm-response"
}
func (f *FixtureLLM) GenerateText(string, string) (string, error) { return f.delayedReply(), nil }
func (f *FixtureLLM) GenerateTextWithImages(string, string, []string) (string, error) {
	return f.delayedReply(), nil
}

// RelationBatchResponse returns a deterministic valid Relation batch JSON for
// Core E2E Direct suggestion. A configured override wins over the default.
func (f *FixtureLLM) RelationBatchResponse(sourceNodeIDs []string) string {
	if f != nil && f.RelationBatchJSON != "" {
		return f.RelationBatchJSON
	}
	if len(sourceNodeIDs) < 2 {
		return `{"relations":[]}`
	}
	a, b := sourceNodeIDs[0], sourceNodeIDs[1]
	return fmt.Sprintf(`{"relations":[{"sourceNodeId":%q,"targetNodeId":%q,"kind":"supports","reason":"fixture relation","direction":"forward"}]}`, a, b)
}

// ClusterViewResponse returns a deterministic valid Cluster View JSON for Core
// E2E Direct suggestion.
func (f *FixtureLLM) ClusterViewResponse(sourceNodeIDs []string) string {
	if f != nil && f.ClusterViewJSON != "" {
		return f.ClusterViewJSON
	}
	if len(sourceNodeIDs) < 2 {
		return `{"label":"Fixture View","clusters":[],"ungroupedNodeIds":[]}`
	}
	a, b := sourceNodeIDs[0], sourceNodeIDs[1]
	clusterA := fmt.Sprintf(`{"label":"Cluster A","reason":"fixture cluster","nodeIds":[%q]}`, a)
	clusterB := fmt.Sprintf(`{"label":"Cluster B","reason":"fixture cluster","nodeIds":[%q]}`, b)
	if len(sourceNodeIDs) > 2 {
		rest := sourceNodeIDs[2:]
		ids := make([]string, 0, len(rest))
		for _, id := range rest {
			ids = append(ids, fmt.Sprintf("%q", id))
		}
		clusterB = fmt.Sprintf(`{"label":"Cluster B","reason":"fixture cluster","nodeIds":[%s]}`, strings.Join(ids, ","))
	}
	return fmt.Sprintf(`{"label":"Fixture View","clusters":[%s,%s],"ungroupedNodeIds":[]}`, clusterA, clusterB)
}
func (f *FixtureLLM) GenerateSummary(string) (string, error)           { return "fixture summary", nil }
func (f *FixtureLLM) GenerateChatReply(string, string) (string, error) { return f.reply(), nil }
func (f *FixtureLLM) AgentSystemPrompt() string                        { return effectiveAgentSystemPrompt("") }

func fixtureAgentRequest(messages []ChatMessage) FixtureAgentRequest {
	observation := FixtureAgentRequest{Roles: make([]string, 0, len(messages)), Contents: make([]string, 0, len(messages))}
	for _, message := range messages {
		observation.Roles = append(observation.Roles, message.Role)
		if content, ok := message.Content.(string); ok {
			observation.Contents = append(observation.Contents, content)
		} else {
			observation.Contents = append(observation.Contents, fmt.Sprint(message.Content))
		}
		for _, call := range message.ToolCalls {
			observation.AssistantToolCallIDs = append(observation.AssistantToolCallIDs, call.ID)
			observation.AssistantToolCallNames = append(observation.AssistantToolCallNames, call.Function.Name)
			var extra struct {
				Google struct {
					ThoughtSignature string `json:"thought_signature"`
				} `json:"google"`
			}
			if len(call.ExtraContent) > 0 && json.Unmarshal(call.ExtraContent, &extra) == nil && extra.Google.ThoughtSignature != "" {
				observation.ThoughtSignatures = append(observation.ThoughtSignatures, extra.Google.ThoughtSignature)
			}
		}
		if message.Role == "tool" {
			observation.ToolResultIDs = append(observation.ToolResultIDs, message.ToolCallID)
			observation.ToolResultNames = append(observation.ToolResultNames, message.Name)
			if content, ok := message.Content.(string); ok {
				observation.ToolResultContents = append(observation.ToolResultContents, content)
			} else {
				observation.ToolResultContents = append(observation.ToolResultContents, fmt.Sprint(message.Content))
			}
		}
	}
	return observation
}

// AgentRequestObservations returns provider-facing fake request summaries.
func (f *FixtureLLM) AgentRequestObservations() []FixtureAgentRequest {
	if f == nil {
		return nil
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]FixtureAgentRequest(nil), f.AgentRequests...)
}

func fixtureUserContent(messages []ChatMessage) (string, []string) {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role != "user" {
			continue
		}
		switch content := messages[i].Content.(type) {
		case string:
			return content, nil
		case []ContentPart:
			var text strings.Builder
			images := make([]string, 0)
			for _, part := range content {
				if part.Type == "text" {
					text.WriteString(part.Text)
				}
				if part.Type == "image_url" && part.ImageURL != nil {
					images = append(images, part.ImageURL.URL)
				}
			}
			return text.String(), images
		}
	}
	return "", nil
}

func fixtureSourceNodeID(text string) string {
	ids := fixtureNodeIDs(text)
	if len(ids) == 0 {
		return ""
	}
	return ids[0]
}

// fixtureNodeIDs extracts every "Node <id> (" marker from a Direct Canvas
// context block so the dialogue fixture can propose relations / clusters over
// the same allowlisted IDs the frontend actually sent.
func fixtureNodeIDs(text string) []string {
	ids := []string{}
	seen := map[string]bool{}
	rest := text
	const marker = "Node "
	for {
		index := strings.Index(rest, marker)
		if index < 0 {
			break
		}
		rest = rest[index+len(marker):]
		fields := strings.Fields(rest)
		if len(fields) == 0 {
			break
		}
		id := strings.Trim(fields[0], "()[]{}:,.")
		if id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

func (f *FixtureLLM) StreamAgentChat(ctx context.Context, messages []ChatMessage, _ []ToolDefinition, onText func(string)) (AgentChatResult, error) {
	if f == nil {
		return AgentChatResult{}, fmt.Errorf("fixture LLM is unavailable")
	}
	if err := ctx.Err(); err != nil {
		return AgentChatResult{}, err
	}
	userText, imageURLs := fixtureUserContent(messages)
	f.mu.Lock()
	f.CallCount++
	f.LastUserText = userText
	f.LastImageURLs = append([]string(nil), imageURLs...)
	f.AgentRequests = append(f.AgentRequests, fixtureAgentRequest(messages))
	f.mu.Unlock()

	lower := strings.ToLower(userText)
	currentPrompt := userText
	if marker := strings.LastIndex(userText, "User request:\n"); marker >= 0 {
		currentPrompt = userText[marker+len("User request:\n"):]
	}
	if strings.Contains(lower, "fixture:history-first") {
		content := "I recorded FIRST-TURN-UNIQUE from this turn."
		if onText != nil {
			onText(content)
		}
		return AgentChatResult{Content: content}, nil
	}
	if strings.Contains(lower, "fixture:history-second") {
		foundPriorTurn := false
		for _, message := range messages {
			if message.Role != "user" && message.Role != "assistant" {
				continue
			}
			if content, ok := message.Content.(string); ok && strings.Contains(content, "FIRST-TURN-UNIQUE") {
				foundPriorTurn = true
				break
			}
		}
		content := "I could not find the first-turn detail."
		if foundPriorTurn {
			content = "I remember FIRST-TURN-UNIQUE from the earlier turn."
		}
		if onText != nil {
			onText(content)
		}
		return AgentChatResult{Content: content}, nil
	}
	if strings.Contains(lower, "fixture:read_canvas_node") {
		if len(messages) > 0 && messages[len(messages)-1].Role == "tool" {
			content := "fixture read_canvas_node continuation completed"
			if onText != nil {
				onText(content)
			}
			return AgentChatResult{Content: content}, nil
		}
		ids := fixtureNodeIDs(userText)
		nodeID := "text-1"
		if len(ids) > 0 {
			nodeID = ids[0]
		}
		encoded, _ := json.Marshal(map[string]string{"node_id": nodeID})
		call := ToolCall{ID: "fixture-read-canvas-node", Type: "function", ExtraContent: json.RawMessage(`{"google":{"thought_signature":"fixture-thought-signature"}}`)}
		call.Function.Name = "read_canvas_node"
		call.Function.Arguments = string(encoded)
		return AgentChatResult{ToolCalls: []ToolCall{call}}, nil
	}
	if strings.Contains(lower, "fixture:relation-batch") || strings.Contains(lower, "fixture:cluster-view") {
		ids := fixtureNodeIDs(userText)
		if len(ids) < 2 {
			ids = []string{"text-1", "artifact-1", "image-1"}
		}
		if len(messages) > 0 && messages[len(messages)-1].Role == "tool" {
			if strings.Contains(lower, "fixture:relation-batch") {
				relations := []map[string]interface{}{{
					"source_node_id": ids[0],
					"target_node_id": ids[1],
					"kind":           "supports",
					"reason":         "fixture relation batch",
					"direction":      "forward",
				}}
				encoded, _ := json.Marshal(map[string]interface{}{"relations": relations, "reason": "fixture batch"})
				call := ToolCall{ID: "fixture-relation-batch", Type: "function"}
				call.Function.Name = "propose_relation_batch"
				call.Function.Arguments = string(encoded)
				return AgentChatResult{ToolCalls: []ToolCall{call}}, nil
			}
			clusters := []map[string]interface{}{
				{"label": "Cluster A", "reason": "fixture cluster", "node_ids": []string{ids[0]}},
				{"label": "Cluster B", "reason": "fixture cluster", "node_ids": ids[1:]},
			}
			encoded, _ := json.Marshal(map[string]interface{}{"label": "Fixture View", "clusters": clusters, "ungrouped_node_ids": []string{}})
			call := ToolCall{ID: "fixture-cluster-view", Type: "function"}
			call.Function.Name = "propose_cluster_view"
			call.Function.Arguments = string(encoded)
			return AgentChatResult{ToolCalls: []ToolCall{call}}, nil
		}
		readCalls := make([]ToolCall, 0, len(ids))
		for _, id := range ids {
			encoded, _ := json.Marshal(map[string]string{"node_id": id})
			call := ToolCall{ID: "fixture-read-" + id, Type: "function"}
			call.Function.Name = "read_canvas_node"
			call.Function.Arguments = string(encoded)
			readCalls = append(readCalls, call)
		}
		return AgentChatResult{ToolCalls: readCalls}, nil
	}

	if len(messages) > 0 && messages[len(messages)-1].Role == "tool" {
		content := "fixture image proposal completed"
		if onText != nil {
			onText(content)
		}
		return AgentChatResult{Content: content}, nil
	}

	if strings.Contains(lower, "fixture:generate_image") || strings.Contains(lower, "fixture:generate image") {
		arguments := map[string]interface{}{"prompt": "a rocket"}
		if sourceID := fixtureSourceNodeID(userText); sourceID != "" {
			arguments["source_node_ids"] = []string{sourceID}
		}
		encoded, _ := json.Marshal(arguments)
		call := ToolCall{ID: "fixture-generate-image", Type: "function"}
		call.Function.Name = "generate_image"
		call.Function.Arguments = string(encoded)
		return AgentChatResult{ToolCalls: []ToolCall{call}}, nil
	}
	if strings.Contains(lower, "fixture:create_text_node") || strings.Contains(lower, "fixture:text-node") || explicitTextNodeCreation(currentPrompt) {
		if len(messages) > 0 && messages[len(messages)-1].Role == "tool" {
			content := "fixture Text Node proposal applied"
			if onText != nil {
				onText(content)
			}
			return AgentChatResult{Content: content}, nil
		}
		history := make([]string, 0)
		for _, message := range messages {
			if message.Role != "user" && message.Role != "assistant" {
				continue
			}
			if content, ok := message.Content.(string); ok && strings.TrimSpace(content) != "" {
				history = append(history, content)
			}
		}
		proposalContent := "Conversation summary"
		if len(history) > 1 {
			proposalContent = "Conversation summary:\n" + history[0]
		}
		encoded, _ := json.Marshal(map[string]string{"content": proposalContent, "summary": "Fixture conversation summary"})
		call := ToolCall{ID: "fixture-create-text-node", Type: "function"}
		call.Function.Name = "create_text_node"
		call.Function.Arguments = string(encoded)
		return AgentChatResult{ToolCalls: []ToolCall{call}}, nil
	}
	if strings.Contains(lower, "fixture:create_artifact") || strings.Contains(lower, "fixture:artifact") || explicitCreation(currentPrompt) {
		if len(messages) > 0 && messages[len(messages)-1].Role == "tool" {
			content := "fixture Artifact proposal applied"
			if onText != nil {
				onText(content)
			}
			return AgentChatResult{Content: content}, nil
		}
		history := make([]string, 0)
		for _, message := range messages {
			if message.Role != "user" && message.Role != "assistant" {
				continue
			}
			if content, ok := message.Content.(string); ok && strings.TrimSpace(content) != "" {
				history = append(history, content)
			}
		}
		proposalContent := "Conversation document"
		if len(history) > 1 {
			proposalContent = "Conversation document:\n" + history[0]
		}
		encoded, _ := json.Marshal(map[string]string{"content": proposalContent, "edit_summary": "Fixture conversation document"})
		call := ToolCall{ID: "fixture-create-artifact", Type: "function"}
		call.Function.Name = "write_artifact"
		call.Function.Arguments = string(encoded)
		return AgentChatResult{ToolCalls: []ToolCall{call}}, nil
	}
	content := "fixture vision: the generated result differs from the stated intent"
	if onText != nil {
		onText(content)
	}
	return AgentChatResult{Content: content}, nil
}

func (f *FixtureLLM) Observations() (calls int, userText string, imageURLs []string) {
	if f == nil {
		return 0, "", nil
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.CallCount, f.LastUserText, append([]string(nil), f.LastImageURLs...)
}

// FixtureImage returns a deterministic relative asset path without network.
// It records the last request so Core E2E can assert the prompt / context /
// reference-image allowlist that was actually passed to the ImagePort.
type FixtureImage struct {
	Path string

	mu           sync.Mutex
	CallCount    int
	LastPrompt   string
	LastContext  string
	LastProvider string
	LastRefs     []string
	RefCount     int
	FaultCode    string
	hold         chan struct{}
}

func (f *FixtureImage) record(prompt, contextData string, refImages []string, provider string) {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.CallCount++
	f.LastPrompt = prompt
	f.LastContext = contextData
	f.LastRefs = append([]string(nil), refImages...)
	f.LastProvider = provider
	f.RefCount = len(refImages)
}

func (f *FixtureImage) SetFault(code string) {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.FaultCode = strings.TrimSpace(code)
}

func (f *FixtureImage) ArmDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.hold == nil {
		f.hold = make(chan struct{})
	}
}

func (f *FixtureImage) ReleaseDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	hold := f.hold
	f.hold = nil
	f.mu.Unlock()
	if hold != nil {
		close(hold)
	}
}

func (f *FixtureImage) generate(prompt, contextData string, refImages []string, provider string) (string, error) {
	if f == nil {
		return "", fmt.Errorf("image generation is unavailable")
	}
	f.mu.Lock()
	f.CallCount++
	f.LastPrompt = prompt
	f.LastContext = contextData
	f.LastRefs = append([]string(nil), refImages...)
	f.LastProvider = provider
	f.RefCount = len(refImages)
	fault := f.FaultCode
	f.FaultCode = ""
	hold := f.hold
	f.mu.Unlock()
	if hold != nil {
		<-hold
	}
	if fault != "" {
		return "", fmt.Errorf("%s", fault)
	}
	return f.path(), nil
}

// Observations returns a snapshot of the last recorded request. Safe for
// concurrent read after a generation.
func (f *FixtureImage) Observations() (prompt, context, provider string, refs []string, count int) {
	if f == nil {
		return "", "", "", nil, 0
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.LastPrompt, f.LastContext, f.LastProvider, append([]string(nil), f.LastRefs...), f.RefCount
}

func (f *FixtureImage) path() string {
	if f == nil || f.Path == "" {
		return "generated/fixture.png"
	}
	return f.Path
}

func (f *FixtureImage) GenerateImage(prompt, contextData string, refImages []string) (string, error) {
	return f.generate(prompt, contextData, refImages, "")
}

func (f *FixtureImage) Calls() int {
	if f == nil {
		return 0
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.CallCount
}
func (f *FixtureImage) GenerateImageWithProvider(prompt, contextData string, refImages []string, provider string) (string, error) {
	return f.generate(prompt, contextData, refImages, provider)
}

// FixtureWebSearch returns deterministic search hits without network access.
type FixtureWebSearch struct {
	mu        sync.Mutex
	Hits      []WebSearchHit
	FaultCode string
	hold      chan struct{}
}

func NewFixtureWebSearch() *FixtureWebSearch { return &FixtureWebSearch{} }

func (f *FixtureWebSearch) ID() string { return "fake" }

func (f *FixtureWebSearch) SetFault(code string) {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.FaultCode = code
}

func (f *FixtureWebSearch) ArmDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.hold = make(chan struct{})
}

func (f *FixtureWebSearch) ReleaseDelay() {
	if f == nil {
		return
	}
	f.mu.Lock()
	hold := f.hold
	f.hold = nil
	f.mu.Unlock()
	if hold != nil {
		close(hold)
	}
}

func FixtureWebSearchHits() []WebSearchHit {
	return []WebSearchHit{
		{Title: "Alpha Paper", URL: "https://example.com/alpha", Snippet: "Alpha reports a shared finding."},
		{Title: "Alpha Mirror", URL: "https://example.com/alpha/", Snippet: "Duplicate of the Alpha Paper URL."},
		{Title: "Beta Note", URL: "https://news.example.com/beta", Snippet: "Beta disagrees about timing."},
		{Title: "Gamma Blog", URL: "https://example.com/gamma", Snippet: "Same domain as Alpha, independent page."},
	}
}

func (f *FixtureWebSearch) Search(ctx context.Context, query string, maxResults int) ([]WebSearchHit, error) {
	if f == nil {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: "nil fixture"}
	}
	f.mu.Lock()
	hold := f.hold
	fault := f.FaultCode
	hits := f.Hits
	f.mu.Unlock()
	if hold != nil {
		select {
		case <-ctx.Done():
			return nil, &WebSearchError{Code: ErrWebSearchTimeout, Message: "search timed out"}
		case <-hold:
		}
	}
	if fault == ErrWebSearchEmpty {
		return []WebSearchHit{}, nil
	}
	if fault != "" {
		return nil, &WebSearchError{Code: fault, Message: "fixture search fault"}
	}
	if strings.TrimSpace(query) == "" {
		return nil, &WebSearchError{Code: ErrWebSearchInvalidQuery, Message: "query is required"}
	}
	if hits == nil {
		hits = FixtureWebSearchHits()
	}
	if maxResults > 0 && len(hits) > maxResults {
		hits = hits[:maxResults]
	}
	out := make([]WebSearchHit, len(hits))
	copy(out, hits)
	return out, nil
}

// Ensure unused imports stay intentional for future adapter helpers.
var (
	_ io.Reader = (*strings.Reader)(nil)
)
