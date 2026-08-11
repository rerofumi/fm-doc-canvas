package backend

import (
	"context"
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
	// AgentLoop entry is kept on *LLMService for now; fixture adapters implement a subset.
}

// ImagePort generates images without embedding credentials in request DTOs.
type ImagePort interface {
	GenerateImage(prompt, contextData string, refImages []string) (string, error)
	GenerateImageWithProvider(prompt, contextData string, refImages []string, provider string) (string, error)
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
	if o.Config == nil || o.Dialog == nil || o.Files == nil || o.Assets == nil || o.LLM == nil || o.Image == nil || o.Events == nil || o.Clock == nil || o.IDs == nil {
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

func (SystemClock) Now() time.Time         { return time.Now() }
func (SystemClock) NowISO() string         { return time.Now().UTC().Format(time.RFC3339) }
func (SystemClock) NowUnixMilli() int64    { return time.Now().UnixMilli() }

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

func (OSFileSystem) ReadFile(path string) ([]byte, error)  { return os.ReadFile(path) }
func (OSFileSystem) WriteFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0o644)
}
func (OSFileSystem) MkdirAll(path string) error { return os.MkdirAll(path, 0o755) }
func (OSFileSystem) Stat(path string) (os.FileInfo, error) { return os.Stat(path) }
func (OSFileSystem) Root() string                 { return "" }
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

// FixtureLLM returns deterministic text without network access.
type FixtureLLM struct {
	Text string
}

func (f FixtureLLM) reply() string {
	if f.Text != "" {
		return f.Text
	}
	return "fixture-llm-response"
}
func (f FixtureLLM) GenerateText(string, string) (string, error) { return f.reply(), nil }
func (f FixtureLLM) GenerateTextWithImages(string, string, []string) (string, error) {
	return f.reply(), nil
}
func (f FixtureLLM) GenerateSummary(string) (string, error)       { return "fixture summary", nil }
func (f FixtureLLM) GenerateChatReply(string, string) (string, error) { return f.reply(), nil }

// FixtureImage returns a deterministic relative asset path without network.
type FixtureImage struct {
	Path string
}

func (f FixtureImage) GenerateImage(string, string, []string) (string, error) {
	if f.Path != "" {
		return f.Path, nil
	}
	return "generated/fixture.png", nil
}
func (f FixtureImage) GenerateImageWithProvider(prompt, contextData string, refImages []string, _ string) (string, error) {
	return f.GenerateImage(prompt, contextData, refImages)
}

// Ensure unused imports stay intentional for future adapter helpers.
var (
	_ io.Reader = (*strings.Reader)(nil)
)
