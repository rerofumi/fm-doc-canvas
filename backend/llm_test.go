package backend

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func newTestConfigService(t *testing.T, cfg Config) *ConfigService {
	t.Helper()
	svc, err := NewConfigService(filepath.Join(t.TempDir(), "config.json"))
	if err != nil {
		t.Fatalf("NewConfigService failed: %v", err)
	}
	if err := svc.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig failed: %v", err)
	}
	return svc
}

func TestLLMService_GenerateText_DefaultAndCustomSystemPrompt(t *testing.T) {
	var capturedAuth string
	var capturedBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		capturedAuth = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"generated markdown"}}]}`))
	}))
	defer srv.Close()

	// Case 1: default systemPrompt, empty apiKey (no Authorization header)
	cfg := DefaultConfig()
	cfg.LLM.BaseURL = srv.URL + "/"
	cfg.LLM.Model = "local-llama"
	cfg.LLM.APIKey = ""
	cfg.LLM.SystemPrompt = ""

	svc := newTestConfigService(t, cfg)
	llm := NewLLMService(svc, srv.Client())

	out, err := llm.GenerateText("Write docs", "Upstream context")
	if err != nil {
		t.Fatalf("GenerateText failed: %v", err)
	}
	if out != "generated markdown" {
		t.Fatalf("got %q, want %q", out, "generated markdown")
	}
	if capturedAuth != "" {
		t.Fatalf("expected empty Authorization header when apiKey is empty, got %q", capturedAuth)
	}

	msgs := capturedBody["messages"].([]any)
	sysMsg := msgs[0].(map[string]any)
	userMsg := msgs[1].(map[string]any)
	if sysMsg["content"] != defaultLLMSystemPrompt {
		t.Fatalf("default systemPrompt = %v, want %q", sysMsg["content"], defaultLLMSystemPrompt)
	}
	wantUser := "Context:\nUpstream context\n\nUser Prompt:\nWrite docs"
	if userMsg["content"] != wantUser {
		t.Fatalf("user content = %v, want %q", userMsg["content"], wantUser)
	}

	// Case 2: custom systemPrompt and non-empty apiKey
	cfg.LLM.SystemPrompt = "Custom system instruction"
	cfg.LLM.APIKey = "sk-llm-secret-123"
	if err := svc.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig failed: %v", err)
	}

	_, err = llm.GenerateText("Hello", "")
	if err != nil {
		t.Fatalf("GenerateText failed: %v", err)
	}
	if capturedAuth != "Bearer sk-llm-secret-123" {
		t.Fatalf("Authorization = %q, want Bearer token", capturedAuth)
	}
	msgs = capturedBody["messages"].([]any)
	if msgs[0].(map[string]any)["content"] != "Custom system instruction" {
		t.Fatalf("custom systemPrompt mismatch: %v", msgs[0])
	}
	if msgs[1].(map[string]any)["content"] != "Hello" {
		t.Fatalf("user content without context = %v, want Hello", msgs[1])
	}
}

func TestLLMService_GenerateTextWithImages_VisionArray(t *testing.T) {
	var capturedBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"vision result"}}]}`))
	}))
	defer srv.Close()

	cfg := DefaultConfig()
	cfg.LLM.BaseURL = srv.URL
	cfg.LLM.Model = "gpt-4o-mini"
	cfg.LLM.APIKey = "sk-vision-key"

	llm := NewLLMService(newTestConfigService(t, cfg), srv.Client())
	out, err := llm.GenerateTextWithImages("Describe image", "", []string{
		"data:image/png;base64,AAA",
		"data:image/jpeg;base64,BBB",
	})
	if err != nil {
		t.Fatalf("GenerateTextWithImages failed: %v", err)
	}
	if out != "vision result" {
		t.Fatalf("got %q, want %q", out, "vision result")
	}

	msgs := capturedBody["messages"].([]any)
	userMsg := msgs[1].(map[string]any)
	parts, ok := userMsg["content"].([]any)
	if !ok {
		t.Fatalf("expected array content for vision, got %T", userMsg["content"])
	}
	if len(parts) != 3 {
		t.Fatalf("expected 3 content parts, got %d", len(parts))
	}
	if parts[0].(map[string]any)["type"] != "text" {
		t.Fatalf("first part should be text, got %v", parts[0])
	}
	img1 := parts[1].(map[string]any)
	if img1["type"] != "image_url" || img1["image_url"].(map[string]any)["url"] != "data:image/png;base64,AAA" {
		t.Fatalf("unexpected image_url part 1: %v", img1)
	}
	img2 := parts[2].(map[string]any)
	if img2["type"] != "image_url" || img2["image_url"].(map[string]any)["url"] != "data:image/jpeg;base64,BBB" {
		t.Fatalf("unexpected image_url part 2: %v", img2)
	}

	// Empty image slice falls back to string content.
	_, err = llm.GenerateTextWithImages("Text only", "", nil)
	if err != nil {
		t.Fatalf("GenerateTextWithImages(nil) failed: %v", err)
	}
	msgs = capturedBody["messages"].([]any)
	if _, isStr := msgs[1].(map[string]any)["content"].(string); !isStr {
		t.Fatalf("expected string content when no images provided, got %T", msgs[1].(map[string]any)["content"])
	}
}

func TestLLMService_ErrorsNormalizedAndMasked(t *testing.T) {
	const secret = "sk-secret-llm-999"

	t.Run("HTTP 500 masks secret", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("upstream failure with key " + secret + " and Bearer tok_abc123"))
		}))
		defer srv.Close()

		cfg := DefaultConfig()
		cfg.LLM.BaseURL = srv.URL
		cfg.LLM.Model = "gpt-4o-mini"
		cfg.LLM.APIKey = secret

		llm := NewLLMService(newTestConfigService(t, cfg), srv.Client())
		_, err := llm.GenerateText("hi", "")
		if err == nil {
			t.Fatal("expected error on HTTP 500")
		}
		msg := err.Error()
		if strings.Contains(msg, secret) || strings.Contains(msg, "tok_abc123") {
			t.Fatalf("error leaked secret: %s", msg)
		}
		if !strings.Contains(msg, "llm") || !strings.Contains(msg, "500") || !strings.Contains(msg, "[REDACTED]") {
			t.Fatalf("error not normalized properly: %s", msg)
		}
	})

	t.Run("empty choices or content returns error", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"   "}}]}`))
		}))
		defer srv.Close()

		cfg := DefaultConfig()
		cfg.LLM.BaseURL = srv.URL
		cfg.LLM.Model = "gpt-4o-mini"

		llm := NewLLMService(newTestConfigService(t, cfg), srv.Client())
		if _, err := llm.GenerateText("hi", ""); err == nil {
			t.Fatal("expected error for empty response content")
		}
	})
}

func TestLLMService_GenerateSummary_SuccessAndFailure(t *testing.T) {
	var capturedBody map[string]any
	shouldFail := false

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if shouldFail {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte("bad gateway"))
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"short summary"}}]}`))
	}))
	defer srv.Close()

	cfg := DefaultConfig()
	cfg.LLM.BaseURL = srv.URL
	cfg.LLM.Model = "gpt-4o-mini"
	cfg.LLM.SystemPrompt = "Base system"
	cfg.Generation.SummaryMaxChars = 80

	llm := NewLLMService(newTestConfigService(t, cfg), srv.Client())

	sum, err := llm.GenerateSummary("Long document body")
	if err != nil {
		t.Fatalf("GenerateSummary failed: %v", err)
	}
	if sum != "short summary" {
		t.Fatalf("got %q, want %q", sum, "short summary")
	}

	msgs := capturedBody["messages"].([]any)
	sysContent := msgs[0].(map[string]any)["content"].(string)
	if !strings.HasPrefix(sysContent, "Base system\n") || !strings.Contains(sysContent, "80 characters or less") {
		t.Fatalf("unexpected summary system prompt: %q", sysContent)
	}
	if msgs[1].(map[string]any)["content"] != "Long document body" {
		t.Fatalf("unexpected summary user content: %v", msgs[1])
	}

	shouldFail = true
	if _, err := llm.GenerateSummary("Long document body"); err == nil {
		t.Fatal("expected error when summary endpoint fails")
	}
}
