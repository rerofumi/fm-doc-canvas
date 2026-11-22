package backend

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type stubDialogProvider struct {
	savePath string
	saveErr  error
	openPath string
	openErr  error
}

func (s *stubDialogProvider) SaveFileDialog(_ context.Context, _ wailsRuntime.SaveDialogOptions) (string, error) {
	return s.savePath, s.saveErr
}

func (s *stubDialogProvider) OpenFileDialog(_ context.Context, _ wailsRuntime.OpenDialogOptions) (string, error) {
	return s.openPath, s.openErr
}

func newTestFileService(t *testing.T, dialogs DialogProvider) (*FileService, *ImageAssetService, string) {
	t.Helper()
	assetSvc, baseDir := newTestImageAssetService(t)
	return NewFileService(assetSvc, dialogs), assetSvc, baseDir
}

func TestFileService_ImportFile_TextAndMarkdown(t *testing.T) {
	fileSvc, _, _ := newTestFileService(t, &stubDialogProvider{})
	srcDir := t.TempDir()

	txtPath := filepath.Join(srcDir, "notes.txt")
	if err := os.WriteFile(txtPath, []byte("plain text body"), 0o644); err != nil {
		t.Fatalf("WriteFile error = %v", err)
	}
	resTxt, err := fileSvc.ImportFile(txtPath)
	if err != nil {
		t.Fatalf("ImportFile(.txt) error = %v", err)
	}
	if resTxt.Kind != "text" || resTxt.Content != "plain text body" || resTxt.Name != "notes.txt" {
		t.Fatalf("unexpected .txt import result: %+v", resTxt)
	}

	mdPath := filepath.Join(srcDir, "README.MD")
	if err := os.WriteFile(mdPath, []byte("# Heading\nbody"), 0o644); err != nil {
		t.Fatalf("WriteFile error = %v", err)
	}
	resMd, err := fileSvc.ImportFile(mdPath)
	if err != nil {
		t.Fatalf("ImportFile(.MD) error = %v", err)
	}
	if resMd.Kind != "text" || resMd.Content != "# Heading\nbody" || resMd.Name != "README.MD" {
		t.Fatalf("unexpected .MD import result: %+v", resMd)
	}
}

func TestFileService_ImportFile_ImagesAndCollisionAvoidance(t *testing.T) {
	fileSvc, _, baseDir := newTestFileService(t, &stubDialogProvider{})
	srcDir := t.TempDir()

	for _, ext := range []string{".png", ".jpg", ".jpeg", ".webp"} {
		p := filepath.Join(srcDir, "sample"+ext)
		payload := []byte("image-bytes-" + ext)
		if err := os.WriteFile(p, payload, 0o644); err != nil {
			t.Fatalf("WriteFile error = %v", err)
		}
		res, err := fileSvc.ImportFile(p)
		if err != nil {
			t.Fatalf("ImportFile(%s) error = %v", ext, err)
		}
		if res.Kind != "image" || !strings.HasPrefix(res.Src, "Import/") || !strings.HasSuffix(res.Src, ext) {
			t.Fatalf("unexpected image import result for %s: %+v", ext, res)
		}
		copiedPath := filepath.Join(baseDir, "Image", filepath.FromSlash(res.Src))
		got, err := os.ReadFile(copiedPath)
		if err != nil {
			t.Fatalf("ReadFile(%q) error = %v", copiedPath, err)
		}
		if !bytes.Equal(got, payload) {
			t.Fatalf("copied bytes mismatch for %s", ext)
		}
	}

	// Importing the same filename twice must not overwrite the first copy.
	dupSrc := filepath.Join(srcDir, "photo.png")
	if err := os.WriteFile(dupSrc, []byte("first"), 0o644); err != nil {
		t.Fatalf("WriteFile error = %v", err)
	}
	r1, err := fileSvc.ImportFile(dupSrc)
	if err != nil {
		t.Fatalf("ImportFile 1 error = %v", err)
	}
	if err := os.WriteFile(dupSrc, []byte("second"), 0o644); err != nil {
		t.Fatalf("WriteFile error = %v", err)
	}
	r2, err := fileSvc.ImportFile(dupSrc)
	if err != nil {
		t.Fatalf("ImportFile 2 error = %v", err)
	}
	if r1.Src == r2.Src {
		t.Fatalf("expected non-colliding Import paths, got %q twice", r1.Src)
	}
	b1, _ := os.ReadFile(filepath.Join(baseDir, "Image", filepath.FromSlash(r1.Src)))
	b2, _ := os.ReadFile(filepath.Join(baseDir, "Image", filepath.FromSlash(r2.Src)))
	if string(b1) != "first" || string(b2) != "second" {
		t.Fatalf("duplicate import overwrote content: b1=%q b2=%q", string(b1), string(b2))
	}
}

func TestFileService_ImportFile_RejectsUnsupportedExtensionsAndDirectories(t *testing.T) {
	fileSvc, _, _ := newTestFileService(t, &stubDialogProvider{})
	srcDir := t.TempDir()

	pdfPath := filepath.Join(srcDir, "report.pdf")
	if err := os.WriteFile(pdfPath, []byte("%PDF-1.4"), 0o644); err != nil {
		t.Fatalf("WriteFile error = %v", err)
	}
	if _, err := fileSvc.ImportFile(pdfPath); err == nil || !strings.Contains(err.Error(), "未対応のファイル形式です") {
		t.Fatalf("expected unsupported extension error for .pdf, got %v", err)
	}

	subDir := filepath.Join(srcDir, "folder")
	if err := os.MkdirAll(subDir, 0o755); err != nil {
		t.Fatalf("MkdirAll error = %v", err)
	}
	if _, err := fileSvc.ImportFile(subDir); err == nil || !strings.Contains(err.Error(), "未対応のファイル形式です") {
		t.Fatalf("expected unsupported error for directory, got %v", err)
	}
}

func TestFileService_ExportImage_CopiesBytesAndRejectsTraversal(t *testing.T) {
	destDir := t.TempDir()
	destFile := filepath.Join(destDir, "exported.png")

	dialogs := &stubDialogProvider{savePath: destFile}
	fileSvc, _, baseDir := newTestFileService(t, dialogs)

	imgDir := filepath.Join(baseDir, "Image")
	if err := os.MkdirAll(imgDir, 0o755); err != nil {
		t.Fatalf("MkdirAll error = %v", err)
	}
	expected := []byte("\x89PNG\r\n\x1a\nexact-export-bytes")
	if err := os.WriteFile(filepath.Join(imgDir, "sample.png"), expected, 0o644); err != nil {
		t.Fatalf("WriteFile error = %v", err)
	}

	outPath, err := fileSvc.ExportImage("sample.png")
	if err != nil {
		t.Fatalf("ExportImage() error = %v", err)
	}
	if outPath != destFile {
		t.Fatalf("ExportImage() path = %q, want %q", outPath, destFile)
	}
	got, err := os.ReadFile(destFile)
	if err != nil {
		t.Fatalf("ReadFile(%q) error = %v", destFile, err)
	}
	if !bytes.Equal(got, expected) {
		t.Fatalf("exported image bytes mismatch")
	}

	// Path traversal must be rejected.
	for _, bad := range []string{"../secret.png", "/etc/passwd", `C:\Windows\win.ini`} {
		if _, err := fileSvc.ExportImage(bad); err == nil {
			t.Fatalf("ExportImage(%q) expected traversal error, got nil", bad)
		}
	}
}

func TestFileService_DialogCancelContract(t *testing.T) {
	dialogs := &stubDialogProvider{savePath: "", openPath: ""}
	fileSvc, _, baseDir := newTestFileService(t, dialogs)

	imgDir := filepath.Join(baseDir, "Image")
	_ = os.MkdirAll(imgDir, 0o755)
	_ = os.WriteFile(filepath.Join(imgDir, "ok.png"), []byte("png"), 0o644)

	if p, err := fileSvc.SaveCanvasToFile("{}"); err != nil || p != "" {
		t.Fatalf("SaveCanvasToFile cancel = (%q, %v), want (\"\", nil)", p, err)
	}
	if s, err := fileSvc.LoadCanvasFromFile(); err != nil || s != "" {
		t.Fatalf("LoadCanvasFromFile cancel = (%q, %v), want (\"\", nil)", s, err)
	}
	if p, err := fileSvc.ExportMarkdown("# hi"); err != nil || p != "" {
		t.Fatalf("ExportMarkdown cancel = (%q, %v), want (\"\", nil)", p, err)
	}
	if p, err := fileSvc.ExportImage("ok.png"); err != nil || p != "" {
		t.Fatalf("ExportImage cancel = (%q, %v), want (\"\", nil)", p, err)
	}
}
