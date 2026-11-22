package backend

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 1x1 transparent PNG bytes
var samplePNGBytes = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
	0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
	0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82,
}

func sampleDataURL(mime string) string {
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(samplePNGBytes)
}

func setupImageTestEnv(t *testing.T, cfg Config) (*ConfigService, *ImageGenService, string) {
	t.Helper()
	baseDir := t.TempDir()
	t.Setenv("FM_DOC_CANVAS_BASE_DIR", baseDir)
	cfg.ImageGen.DownloadPath = "Image/"
	cfgSvc := newTestConfigService(t, cfg)
	assetSvc := NewImageAssetService(cfgSvc, nil)
	imgSvc := NewImageGenService(cfgSvc, assetSvc, nil)
	return cfgSvc, imgSvc, baseDir
}

func TestProviders_OpenRouter(t *testing.T) {
	b64 := base64.StdEncoding.EncodeToString(samplePNGBytes)
	var capturedBody map[string]any
	mode := "images_array"

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		switch mode {
		case "images_array":
			_, _ = w.Write([]byte(`{"choices":[{"message":{"images":[{"image_url":{"url":"data:image/png;base64,` + b64 + `"}}]}}]}`))
		case "content_fallback":
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"here is image: data:image/png;base64,` + b64 + `"}}]}`))
		case "error":
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`error with key sk-or-secret`))
		}
	}))
	defer srv.Close()

	cfg := DefaultConfig()
	cfg.ImageGen.Provider = ProviderOpenRouter
	cfg.ImageGen.OpenRouter.BaseURL = srv.URL
	cfg.ImageGen.OpenRouter.APIKey = "sk-or-secret"

	_, imgSvc, baseDir := setupImageTestEnv(t, cfg)

	// No refs -> string content + images array extraction
	rel, err := imgSvc.GenerateImage("a cat", "ctx", nil)
	if err != nil {
		t.Fatalf("GenerateImage failed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(baseDir, "Image", filepath.FromSlash(rel))); err != nil {
		t.Fatalf("saved image missing: %v", err)
	}
	if mods := capturedBody["modalities"].([]any); len(mods) != 1 || mods[0] != "image" {
		t.Fatalf("unexpected modalities: %v", capturedBody["modalities"])
	}

	// With refs + content regex fallback
	mode = "content_fallback"
	rel2, err := imgSvc.GenerateImage("refine cat", "", []string{sampleDataURL("image/png")})
	if err != nil {
		t.Fatalf("GenerateImage with refs failed: %v", err)
	}
	if rel2 == rel {
		t.Fatalf("expected unique filenames, both %q", rel)
	}
	msgs := capturedBody["messages"].([]any)
	parts := msgs[0].(map[string]any)["content"].([]any)
	if len(parts) != 2 || parts[1].(map[string]any)["type"] != "image_url" {
		t.Fatalf("expected vision content parts, got %v", parts)
	}

	// Error masking
	mode = "error"
	_, err = imgSvc.GenerateImage("fail", "", nil)
	if err == nil || strings.Contains(err.Error(), "sk-or-secret") || !strings.Contains(err.Error(), "[REDACTED]") {
		t.Fatalf("expected masked error, got: %v", err)
	}
}

func TestProviders_OpenAI_ImagesAndResponses(t *testing.T) {
	b64 := base64.StdEncoding.EncodeToString(samplePNGBytes)

	t.Run("Images API without refs", func(t *testing.T) {
		var capturedPath string
		var capturedBody map[string]any

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedPath = r.URL.Path
			_ = json.NewDecoder(r.Body).Decode(&capturedBody)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[{"b64_json":"` + b64 + `"}]}`))
		}))
		defer srv.Close()

		cfg := DefaultConfig()
		cfg.ImageGen.Provider = ProviderOpenAI
		cfg.ImageGen.OpenAI.BaseURL = srv.URL
		cfg.ImageGen.OpenAI.Model = "gpt-image-1.5"
		cfg.ImageGen.OpenAI.APIKey = "sk-openai-123"

		_, imgSvc, _ := setupImageTestEnv(t, cfg)
		rel, err := imgSvc.GenerateImage("diagram", "", nil)
		if err != nil {
			t.Fatalf("GenerateImage failed: %v", err)
		}
		if !strings.HasSuffix(rel, ".png") {
			t.Fatalf("expected .png file, got %s", rel)
		}
		if capturedPath != "/images/generations" {
			t.Fatalf("path = %s, want /images/generations", capturedPath)
		}
		if capturedBody["response_format"] != "b64_json" {
			t.Fatalf("expected response_format=b64_json for non-official baseURL, got %v", capturedBody["response_format"])
		}
	})

	t.Run("Responses API max 5 refs and candidate fallback", func(t *testing.T) {
		var seenModels []string
		var refCount int

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/responses" {
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			model, _ := body["model"].(string)
			seenModels = append(seenModels, model)

			input := body["input"].([]any)[0].(map[string]any)
			content := input["content"].([]any)
			refCount = len(content) - 1

			if model == "gpt-5" {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":"unsupported model"}`))
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"output":[{"type":"image_generation_call","output_format":"webp","result":"` + b64 + `"}]}`))
		}))
		defer srv.Close()

		cfg := DefaultConfig()
		cfg.ImageGen.Provider = ProviderOpenAI
		cfg.ImageGen.OpenAI.BaseURL = srv.URL
		cfg.ImageGen.OpenAI.Model = "gpt-image-1.5"
		cfg.ImageGen.OpenAI.APIKey = "sk-openai-123"

		_, imgSvc, _ := setupImageTestEnv(t, cfg)
		refs := make([]string, 7)
		for i := range refs {
			refs[i] = sampleDataURL("image/png")
		}

		rel, err := imgSvc.GenerateImage("edit", "", refs)
		if err != nil {
			t.Fatalf("GenerateImage failed: %v", err)
		}
		if !strings.HasSuffix(rel, ".webp") {
			t.Fatalf("expected .webp from output_format, got %s", rel)
		}
		if refCount != 5 {
			t.Fatalf("expected max 5 reference images sent, got %d", refCount)
		}
		if len(seenModels) != 2 || seenModels[0] != "gpt-5" || seenModels[1] != "gpt-5-mini" {
			t.Fatalf("unexpected candidate sequence: %v", seenModels)
		}
	})

	t.Run("Responses API 401 fails immediately without fallback", func(t *testing.T) {
		attempts := 0
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			attempts++
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`unauthorized sk-openai-secret`))
		}))
		defer srv.Close()

		cfg := DefaultConfig()
		cfg.ImageGen.Provider = ProviderOpenAI
		cfg.ImageGen.OpenAI.BaseURL = srv.URL
		cfg.ImageGen.OpenAI.APIKey = "sk-openai-secret"

		_, imgSvc, _ := setupImageTestEnv(t, cfg)
		_, err := imgSvc.GenerateImage("edit", "", []string{sampleDataURL("image/png")})
		if err == nil {
			t.Fatal("expected 401 error")
		}
		if attempts != 1 {
			t.Fatalf("expected 1 attempt on 401, got %d", attempts)
		}
		if strings.Contains(err.Error(), "sk-openai-secret") {
			t.Fatalf("error leaked secret: %s", err.Error())
		}
	})
}

func TestProviders_Google_InlineDataAndQueryKeyMask(t *testing.T) {
	b64 := base64.StdEncoding.EncodeToString(samplePNGBytes)
	var capturedPath string
	var capturedBody map[string]any
	shouldFail := false

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.RequestURI()
		if shouldFail {
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`failed calling https://example.com?key=AIzaSecret123&alt=json`))
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&capturedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"` + b64 + `"}}]}}]}`))
	}))
	defer srv.Close()

	cfg := DefaultConfig()
	cfg.ImageGen.Provider = ProviderGoogle
	cfg.ImageGen.Google.APIKey = "AIzaSecret123"

	_, imgSvc, _ := setupImageTestEnv(t, cfg)
	imgSvc.SetBaseURLOverride(ProviderGoogle, srv.URL)

	rel, err := imgSvc.GenerateImage("mountain", "", []string{sampleDataURL("image/jpeg")})
	if err != nil {
		t.Fatalf("GenerateImage failed: %v", err)
	}
	if !strings.HasSuffix(rel, ".png") {
		t.Fatalf("expected .png, got %s", rel)
	}
	if !strings.Contains(capturedPath, ":generateContent?key=AIzaSecret123") {
		t.Fatalf("unexpected request URI: %s", capturedPath)
	}

	contents := capturedBody["contents"].([]any)
	parts := contents[0].(map[string]any)["parts"].([]any)
	if len(parts) != 2 {
		t.Fatalf("expected 2 parts, got %d", len(parts))
	}
	inline := parts[1].(map[string]any)["inline_data"].(map[string]any)
	if inline["mime_type"] != "image/jpeg" {
		t.Fatalf("unexpected inline_data mime_type: %v", inline["mime_type"])
	}

	shouldFail = true
	_, err = imgSvc.GenerateImage("mountain", "", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if strings.Contains(err.Error(), "AIzaSecret123") || !strings.Contains(err.Error(), "[REDACTED]") {
		t.Fatalf("query key was not masked: %s", err.Error())
	}
}

func TestProviders_XAI_GenerationsEditsAndURLFallback(t *testing.T) {
	b64 := base64.StdEncoding.EncodeToString(samplePNGBytes)
	var capturedPath string
	var capturedBody map[string]any

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/download/img.png" {
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(samplePNGBytes)
			return
		}
		capturedPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&capturedBody)
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/v1/images/generations" {
			_, _ = w.Write([]byte(`{"data":[{"b64_json":"` + b64 + `"}]}`))
			return
		}
		// Edits returns URL fallback
		_, _ = w.Write([]byte(`{"data":[{"url":"` + srv.URL + `/download/img.png"}]}`))
	}))
	defer srv.Close()

	cfg := DefaultConfig()
	cfg.ImageGen.Provider = ProviderXAI
	cfg.ImageGen.XAI.APIKey = "xai-secret-key"

	_, imgSvc, _ := setupImageTestEnv(t, cfg)
	imgSvc.SetBaseURLOverride(ProviderXAI, srv.URL)

	// No refs -> /v1/images/generations without image key
	rel, err := imgSvc.GenerateImage("robot", "", nil)
	if err != nil {
		t.Fatalf("xAI generations failed: %v", err)
	}
	if !strings.HasSuffix(rel, ".jpg") {
		t.Fatalf("expected .jpg for xAI b64_json, got %s", rel)
	}
	if capturedPath != "/v1/images/generations" {
		t.Fatalf("path = %s, want /v1/images/generations", capturedPath)
	}
	if _, hasImage := capturedBody["image"]; hasImage {
		t.Fatalf("unexpected image field in generations payload: %v", capturedBody)
	}

	// Multiple refs -> /v1/images/edits with first image only + URL download fallback
	rel2, err := imgSvc.GenerateImage("edit robot", "", []string{
		sampleDataURL("image/png"),
		sampleDataURL("image/jpeg"),
	})
	if err != nil {
		t.Fatalf("xAI edits failed: %v", err)
	}
	if !strings.HasSuffix(rel2, ".png") {
		t.Fatalf("expected .png from URL fallback, got %s", rel2)
	}
	if capturedPath != "/v1/images/edits" {
		t.Fatalf("path = %s, want /v1/images/edits", capturedPath)
	}
	imgField, ok := capturedBody["image"].(map[string]any)
	if !ok || !strings.HasPrefix(imgField["url"].(string), "data:image/png;base64,") {
		t.Fatalf("expected first ref image in edits payload, got %v", capturedBody["image"])
	}
}

func TestImageGenService_GenerateImageWithProvider_DoesNotMutateConfig(t *testing.T) {
	b64 := base64.StdEncoding.EncodeToString(samplePNGBytes)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"b64_json":"` + b64 + `"}]}`))
	}))
	defer srv.Close()

	cfg := DefaultConfig()
	cfg.ImageGen.Provider = ProviderOpenRouter
	cfg.ImageGen.OpenRouter.APIKey = "or-key"
	cfg.ImageGen.XAI.APIKey = "xai-key"

	cfgSvc, imgSvc, _ := setupImageTestEnv(t, cfg)
	imgSvc.SetBaseURLOverride(ProviderXAI, srv.URL)

	if _, err := imgSvc.GenerateImageWithProvider("test", "", nil, ProviderXAI); err != nil {
		t.Fatalf("GenerateImageWithProvider failed: %v", err)
	}

	reloaded, err := cfgSvc.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig failed: %v", err)
	}
	if reloaded.ImageGen.Provider != ProviderOpenRouter {
		t.Fatalf("config.json provider mutated to %q, want %q", reloaded.ImageGen.Provider, ProviderOpenRouter)
	}

	// Unknown provider and missing API key errors
	if _, err := imgSvc.GenerateImageWithProvider("test", "", nil, "unknown"); err == nil {
		t.Fatal("expected error for unknown provider")
	}
	if _, err := imgSvc.GenerateImageWithProvider("test", "", nil, ProviderGoogle); err == nil {
		t.Fatal("expected error for empty google apiKey")
	}
}
