package backend

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestImageAssetService(t *testing.T) (*ImageAssetService, string) {
	t.Helper()
	baseDir := t.TempDir()
	t.Setenv("FM_DOC_CANVAS_BASE_DIR", baseDir)

	cfgPath := filepath.Join(baseDir, "config.json")
	cfgSvc, err := NewConfigService(cfgPath)
	if err != nil {
		t.Fatalf("NewConfigService() error = %v", err)
	}
	return NewImageAssetService(cfgSvc, nil), baseDir
}

func TestImageAssetService_ResolveImagePath_RejectsTraversal(t *testing.T) {
	svc, _ := newTestImageAssetService(t)

	invalidPaths := []string{
		"",
		"   ",
		"../secret.png",
		"/etc/passwd",
		`\etc\passwd`,
		`C:\Windows\win.ini`,
		"Import/../../x.png",
		`Import\..\..\x.png`,
		".",
	}

	for _, p := range invalidPaths {
		t.Run("reject_"+p, func(t *testing.T) {
			if _, err := svc.ResolveImagePath(p); err == nil {
				t.Fatalf("ResolveImagePath(%q) expected error, got nil", p)
			}
			if _, err := svc.GetImageDataURL(p); err == nil {
				t.Fatalf("GetImageDataURL(%q) expected error, got nil", p)
			}
			if _, err := svc.GetImageFileURL(p); err == nil {
				t.Fatalf("GetImageFileURL(%q) expected error, got nil", p)
			}
		})
	}
}

func TestImageAssetService_SaveGeneratedImage_DataURLAndCollisionAvoidance(t *testing.T) {
	svc, baseDir := newTestImageAssetService(t)

	// Minimal 1x1 PNG bytes
	pngBytes := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	}
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)

	rel1, err := svc.SaveGeneratedImage(GeneratedImagePayload{DataURL: dataURL})
	if err != nil {
		t.Fatalf("SaveGeneratedImage() 1 error = %v", err)
	}
	rel2, err := svc.SaveGeneratedImage(GeneratedImagePayload{DataURL: dataURL})
	if err != nil {
		t.Fatalf("SaveGeneratedImage() 2 error = %v", err)
	}

	if rel1 == rel2 {
		t.Fatalf("expected unique filenames for back-to-back saves, got %q twice", rel1)
	}
	if !strings.HasPrefix(rel1, "image_") || !strings.HasSuffix(rel1, ".png") {
		t.Fatalf("unexpected filename format: %q", rel1)
	}

	savedPath := filepath.Join(baseDir, "Image", filepath.FromSlash(rel1))
	gotBytes, err := os.ReadFile(savedPath)
	if err != nil {
		t.Fatalf("ReadFile(%q) error = %v", savedPath, err)
	}
	if string(gotBytes) != string(pngBytes) {
		t.Fatalf("saved bytes mismatch")
	}

	gotDataURL, err := svc.GetImageDataURL(rel1)
	if err != nil {
		t.Fatalf("GetImageDataURL() error = %v", err)
	}
	if gotDataURL != dataURL {
		t.Fatalf("GetImageDataURL() = %q, want %q", gotDataURL, dataURL)
	}

	gotFileURL, err := svc.GetImageFileURL(rel1)
	if err != nil {
		t.Fatalf("GetImageFileURL() error = %v", err)
	}
	if !strings.HasPrefix(gotFileURL, "file:///") || !strings.HasSuffix(gotFileURL, rel1) {
		t.Fatalf("GetImageFileURL() = %q, expected file:///.../%s", gotFileURL, rel1)
	}
}

func TestImageAssetService_SaveGeneratedImage_HTTPURL(t *testing.T) {
	pngBytes := []byte("\x89PNG\r\n\x1a\nfake-png-payload")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ok.png":
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(pngBytes)
		case "/not-image":
			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte("hello"))
		case "/err":
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()

	svc, _ := newTestImageAssetService(t)

	rel, err := svc.SaveGeneratedImage(GeneratedImagePayload{ImageURL: srv.URL + "/ok.png"})
	if err != nil {
		t.Fatalf("SaveGeneratedImage(HTTP) error = %v", err)
	}
	if !strings.HasSuffix(rel, ".png") {
		t.Fatalf("expected .png extension, got %q", rel)
	}

	if _, err := svc.SaveGeneratedImage(GeneratedImagePayload{ImageURL: srv.URL + "/not-image"}); err == nil {
		t.Fatal("expected error for non-image Content-Type, got nil")
	}
	if _, err := svc.SaveGeneratedImage(GeneratedImagePayload{ImageURL: srv.URL + "/err"}); err == nil {
		t.Fatal("expected error for HTTP 500, got nil")
	}
	if _, err := svc.SaveGeneratedImage(GeneratedImagePayload{ImageURL: "file:///etc/passwd"}); err == nil {
		t.Fatal("expected error for file:// scheme, got nil")
	}
}

func TestImageAssetService_MissingAssetReturnsError(t *testing.T) {
	svc, _ := newTestImageAssetService(t)

	if _, err := svc.GetImageDataURL("does_not_exist.png"); err == nil {
		t.Fatal("GetImageDataURL() expected error for missing file, got nil")
	}
	if _, err := svc.GetImageFileURL("does_not_exist.png"); err == nil {
		t.Fatal("GetImageFileURL() expected error for missing file, got nil")
	}
}
