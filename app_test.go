package main

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"fm-doc-canvas/backend"
)

// e2eOptions builds a minimal valid E2E composition input for tests.
func e2eOptions(t *testing.T) backend.AppOptions {
	t.Helper()
	root := t.TempDir()
	fs, err := backend.NewTempFileSystem(root)
	if err != nil {
		t.Fatal(err)
	}
	cfg := backend.NewMemoryConfigStore(root, nil)
	c := cfg.GetConfig()
	c.ImageGen.DownloadPath = filepath.Join(root, "Image")
	if err := cfg.Save(&c); err != nil {
		t.Fatal(err)
	}
	return backend.AppOptions{
		Config: cfg,
		Dialog: backend.FixedDialog{
			SavePath: filepath.Join(root, "save", "workspace.json"),
			OpenPath: filepath.Join(root, "fixtures", "workspace.json"),
		},
		Files:     fs,
		Assets:    backend.TempAssetStore{Root: root, FS: fs},
		LLM:       &backend.FixtureLLM{Text: "fixture"},
		Image:     &backend.FixtureImage{Path: "generated/fixture.png"},
		WebSearch: backend.NewFixtureWebSearch(),
		Events:    &backend.CapturingEventPort{},
		Clock:     backend.NewFakeClock(time.Date(2026, 8, 11, 0, 0, 0, 0, time.UTC)),
		IDs:       backend.NewSeededIDGenerator("e2e"),
		Mode:      backend.RuntimeModeE2E,
	}
}

// TestE2EWiringKeepsImagePortsNonNil verifies the WP-0 fix: the E2E composition
// root must wire a non-nil ImagePort and ImageAssetPort so GenerateImage /
// GetImageDataURL do not nil-panic and the browser binding is usable.
func TestE2EWiringKeepsImagePortsNonNil(t *testing.T) {
	app, err := NewAppWithOptions(e2eOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	if app.imageGenService == nil {
		t.Fatal("imageGenService must be non-nil in E2E mode")
	}
	if app.imageAssetService == nil {
		t.Fatal("imageAssetService must be non-nil in E2E mode")
	}

	// GenerateImage must route to the FixtureImage without network.
	src, err := app.GenerateImage("a rocket", "context", nil)
	if err != nil {
		t.Fatalf("GenerateImage failed: %v", err)
	}
	if src != "generated/fixture.png" {
		t.Fatalf("unexpected fixture src %q", src)
	}
	if app.imageFixture == nil {
		t.Fatal("imageFixture must be captured for observations")
	}
	prompt, _, _, _, count := app.imageFixture.Observations()
	if prompt != "a rocket" || count != 0 {
		t.Fatalf("unexpected fixture observation prompt=%q refCount=%d", prompt, count)
	}
}

// TestE2EWiringImageAssetDataURL verifies GetImageDataURL routes to the asset
// service (TempAssetStore) instead of nil-panicking in E2E mode.
func TestE2EWiringImageAssetDataURL(t *testing.T) {
	app, err := NewAppWithOptions(e2eOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	// TempAssetStore returns deterministic valid image bytes so the real
	// multimodal request path is exercised without reading user files.
	dataURL, err := app.GetImageDataURL("generated/fixture.png")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(dataURL, "data:image/png;base64,") {
		t.Fatalf("unexpected fixture data URL %q", dataURL)
	}
}

// TestE2EObservationsGuard verifies the observation control is E2E-only.
func TestE2EObservationsGuard(t *testing.T) {
	app, err := NewAppWithOptions(e2eOptions(t))
	if err != nil {
		t.Fatal(err)
	}
	app.mode = backend.RuntimeModeProduction
	if _, err := app.GetImageFixtureObservations(); err == nil {
		t.Fatal("expected observations guard to fail in production mode")
	}
}
