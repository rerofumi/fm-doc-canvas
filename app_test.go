package main

import (
	"context"
	"fm-doc-canvas/backend"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAppStartupAndHealthCheck(t *testing.T) {
	app := NewApp()
	if app == nil {
		t.Fatal("NewApp returned nil")
	}

	ctx := context.Background()
	app.startup(ctx)
	if app.ctx != ctx {
		t.Fatal("startup did not store context")
	}

	if got := app.HealthCheck(); got != "ok" {
		t.Fatalf("HealthCheck() = %q, want %q", got, "ok")
	}
}

func TestAppFacadeWiring(t *testing.T) {
	baseDir := t.TempDir()
	t.Setenv("FM_DOC_CANVAS_BASE_DIR", baseDir)

	cfgPath := filepath.Join(t.TempDir(), "config.json")
	app := newAppWithConfigPath(cfgPath)
	app.startup(context.Background())

	cfg, err := app.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig failed: %v", err)
	}
	if cfg.ImageGen.Provider != backend.ProviderOpenRouter {
		t.Fatalf("default provider = %q, want %q", cfg.ImageGen.Provider, backend.ProviderOpenRouter)
	}

	cfg.LLM.Model = "custom-model"
	if err := app.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig failed: %v", err)
	}

	reloaded, err := app.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig after save failed: %v", err)
	}
	if reloaded.LLM.Model != "custom-model" {
		t.Fatalf("reloaded model = %q, want custom-model", reloaded.LLM.Model)
	}

	// Verify ImportFile + GetImageDataURL + GetImageFileURL delegation
	srcImg := filepath.Join(t.TempDir(), "sample.png")
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
	if err := os.WriteFile(srcImg, pngBytes, 0o644); err != nil {
		t.Fatalf("write sample.png: %v", err)
	}
	imported, err := app.ImportFile(srcImg)
	if err != nil {
		t.Fatalf("ImportFile failed: %v", err)
	}
	if imported.Kind != "image" || !strings.HasPrefix(imported.Src, "Import/") {
		t.Fatalf("unexpected import result: %+v", imported)
	}

	dataURL, err := app.GetImageDataURL(imported.Src)
	if err != nil || !strings.HasPrefix(dataURL, "data:image/png;base64,") {
		t.Fatalf("GetImageDataURL failed: %q, err=%v", dataURL, err)
	}

	fileURL, err := app.GetImageFileURL(imported.Src)
	if err != nil || !strings.HasPrefix(fileURL, "file:///") {
		t.Fatalf("GetImageFileURL failed: %q, err=%v", fileURL, err)
	}
}
