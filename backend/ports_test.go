package backend

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestAppOptionsValidateE2ERequiresRoot(t *testing.T) {
	opts := AppOptions{
		Config: NewMemoryConfigStore(t.TempDir(), nil),
		Dialog: FixedDialog{},
		Files:  OSFileSystem{},
		Assets: noopAssets{},
		LLM:       FixtureLLM{},
		Image:     FixtureImage{},
		WebSearch: NewFixtureWebSearch(),
		Events:    &CapturingEventPort{},
		Clock:     SystemClock{},
		IDs:       NewSeededIDGenerator("t"),
		Mode:      RuntimeModeE2E,
	}
	if err := opts.Validate(); err == nil {
		t.Fatal("expected e2e without temp root to fail")
	}
}

func TestTempFileSystemRejectsEscape(t *testing.T) {
	root := t.TempDir()
	fs, err := NewTempFileSystem(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := fs.WriteFile(filepath.Join(root, "ok.txt"), []byte("x")); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(root, "..", "escape.txt")
	if err := fs.WriteFile(outside, []byte("nope")); err == nil {
		t.Fatal("expected escape write to fail")
	}
}

func TestSeededIDsAndFakeClock(t *testing.T) {
	ids := NewSeededIDGenerator("e2e")
	if ids.Next("node") != "e2e-node-1" || ids.Next("node") != "e2e-node-2" {
		t.Fatal("unexpected seeded ids")
	}
	clk := NewFakeClock(time.Date(2026, 8, 11, 0, 0, 0, 0, time.UTC))
	if clk.NowISO() != "2026-08-11T00:00:00Z" {
		t.Fatalf("clock iso %s", clk.NowISO())
	}
}

func TestProductionFaultPlanRejected(t *testing.T) {
	root := t.TempDir()
	fs, _ := NewTempFileSystem(root)
	opts := AppOptions{
		Config:    NewMemoryConfigStore(root, nil),
		Dialog:    FixedDialog{},
		Files:     fs,
		Assets:    noopAssets{},
		LLM:       FixtureLLM{},
		Image:     FixtureImage{},
		WebSearch: NewFixtureWebSearch(),
		Events:    &CapturingEventPort{},
		Clock:     SystemClock{},
		IDs:       RandomIDGenerator{},
		FaultPlan: &E2EFaultPlan{FailOnceAt: "undo-before-commit"},
		Mode:      RuntimeModeProduction,
	}
	if err := opts.Validate(); err == nil {
		t.Fatal("production fault plan must fail")
	}
	_ = os.RemoveAll(filepath.Join(root, "unused"))
}

type noopAssets struct{}

func (noopAssets) ResolveImagePath(string) (string, error) { return "", nil }
func (noopAssets) GetImageDataURL(string) (string, error)  { return "", nil }
func (noopAssets) GetImageFileURL(string) (string, error)  { return "", nil }
func (noopAssets) ImportImage(string) (string, error)      { return "", nil }
func (noopAssets) ExportImage(string, string) error        { return nil }
