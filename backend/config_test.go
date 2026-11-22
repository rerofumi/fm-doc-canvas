package backend

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConfigService_MissingFileReturnsDefaultsWithoutCreatingFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "nested", "config.json")

	svc, err := NewConfigService(cfgPath)
	if err != nil {
		t.Fatalf("NewConfigService() error = %v", err)
	}

	cfg, err := svc.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig() error = %v", err)
	}
	if cfg.ImageGen.Provider != ProviderOpenRouter {
		t.Fatalf("Provider = %q, want %q", cfg.ImageGen.Provider, ProviderOpenRouter)
	}
	if cfg.Generation.SummaryMaxChars != 100 {
		t.Fatalf("SummaryMaxChars = %d, want 100", cfg.Generation.SummaryMaxChars)
	}
	if _, err := os.Stat(cfgPath); !os.IsNotExist(err) {
		t.Fatalf("expected config file not to be created, stat err = %v", err)
	}
}

func TestConfigService_SaveAndSwitchProviderPreservesAllFourProviders(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	svc, err := NewConfigService(cfgPath)
	if err != nil {
		t.Fatalf("NewConfigService() error = %v", err)
	}

	cfg := DefaultConfig()
	cfg.LLM.APIKey = "llm-secret"
	cfg.ImageGen.OpenRouter.APIKey = "or-secret"
	cfg.ImageGen.OpenAI.APIKey = "oa-secret"
	cfg.ImageGen.Google.APIKey = "gg-secret"
	cfg.ImageGen.XAI.APIKey = "xai-secret"
	cfg.ImageGen.Provider = ProviderOpenRouter

	if err := svc.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig() initial error = %v", err)
	}

	// Switch default provider and save again
	cfg.ImageGen.Provider = ProviderXAI
	if err := svc.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig() switch error = %v", err)
	}

	reloaded, err := svc.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig() error = %v", err)
	}

	if reloaded.ImageGen.Provider != ProviderXAI {
		t.Fatalf("Provider = %q, want %q", reloaded.ImageGen.Provider, ProviderXAI)
	}
	if reloaded.LLM.APIKey != "llm-secret" ||
		reloaded.ImageGen.OpenRouter.APIKey != "or-secret" ||
		reloaded.ImageGen.OpenAI.APIKey != "oa-secret" ||
		reloaded.ImageGen.Google.APIKey != "gg-secret" ||
		reloaded.ImageGen.XAI.APIKey != "xai-secret" {
		t.Fatalf("provider keys were not preserved: %+v", reloaded.ImageGen)
	}
}

func TestConfigService_LegacyFlatMigration(t *testing.T) {
	t.Run("migrates flat fields into target provider when per-provider fields are empty", func(t *testing.T) {
		dir := t.TempDir()
		cfgPath := filepath.Join(dir, "config.json")

		legacyJSON := `{
  "imageGen": {
    "provider": "openai",
    "baseURL": "https://legacy.openai.example/v1",
    "model": "dall-e-3",
    "apiKey": "legacy-oa-key"
  }
}`
		if err := os.WriteFile(cfgPath, []byte(legacyJSON), 0o600); err != nil {
			t.Fatalf("WriteFile error = %v", err)
		}

		svc, _ := NewConfigService(cfgPath)
		cfg, err := svc.GetConfig()
		if err != nil {
			t.Fatalf("GetConfig() error = %v", err)
		}
		if cfg.ImageGen.OpenAI.BaseURL != "https://legacy.openai.example/v1" ||
			cfg.ImageGen.OpenAI.Model != "dall-e-3" ||
			cfg.ImageGen.OpenAI.APIKey != "legacy-oa-key" {
			t.Fatalf("legacy migration failed: %+v", cfg.ImageGen.OpenAI)
		}

		// Re-saving must emit canonical format without legacy flat fields.
		if err := svc.SaveConfig(cfg); err != nil {
			t.Fatalf("SaveConfig() error = %v", err)
		}
		rawBytes, err := os.ReadFile(cfgPath)
		if err != nil {
			t.Fatalf("ReadFile error = %v", err)
		}
		var rawMap map[string]any
		if err := json.Unmarshal(rawBytes, &rawMap); err != nil {
			t.Fatalf("Unmarshal raw error = %v", err)
		}
		ig := rawMap["imageGen"].(map[string]any)
		for _, legacyKey := range []string{"baseURL", "model", "apiKey"} {
			if _, exists := ig[legacyKey]; exists {
				t.Fatalf("legacy flat field %q should not be written after save", legacyKey)
			}
		}
	})

	t.Run("prefers non-empty per-provider fields over legacy flat fields", func(t *testing.T) {
		dir := t.TempDir()
		cfgPath := filepath.Join(dir, "config.json")

		mixedJSON := `{
  "imageGen": {
    "provider": "openrouter",
    "baseURL": "https://legacy.or.example/v1",
    "model": "legacy-model",
    "apiKey": "legacy-key",
    "openrouter": {
      "baseURL": "https://custom.or.example/v1",
      "model": "",
      "apiKey": "new-or-key"
    }
  }
}`
		if err := os.WriteFile(cfgPath, []byte(mixedJSON), 0o600); err != nil {
			t.Fatalf("WriteFile error = %v", err)
		}

		svc, _ := NewConfigService(cfgPath)
		cfg, err := svc.GetConfig()
		if err != nil {
			t.Fatalf("GetConfig() error = %v", err)
		}
		if cfg.ImageGen.OpenRouter.BaseURL != "https://custom.or.example/v1" {
			t.Fatalf("BaseURL = %q, want non-empty per-provider value", cfg.ImageGen.OpenRouter.BaseURL)
		}
		if cfg.ImageGen.OpenRouter.APIKey != "new-or-key" {
			t.Fatalf("APIKey = %q, want non-empty per-provider value", cfg.ImageGen.OpenRouter.APIKey)
		}
		if cfg.ImageGen.OpenRouter.Model != "legacy-model" {
			t.Fatalf("Model = %q, want legacy fallback for empty field", cfg.ImageGen.OpenRouter.Model)
		}
	})
}

func TestConfigService_CorruptJSONDoesNotOverwriteFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	corrupt := `{"llm": {broken json`
	if err := os.WriteFile(cfgPath, []byte(corrupt), 0o600); err != nil {
		t.Fatalf("WriteFile error = %v", err)
	}

	svc, _ := NewConfigService(cfgPath)
	_, err := svc.GetConfig()
	if err == nil {
		t.Fatal("GetConfig() expected error for corrupt JSON, got nil")
	}
	if !strings.Contains(err.Error(), "parse") {
		t.Fatalf("unexpected error message: %v", err)
	}

	after, err := os.ReadFile(cfgPath)
	if err != nil {
		t.Fatalf("ReadFile error = %v", err)
	}
	if string(after) != corrupt {
		t.Fatalf("corrupt config.json was modified: got %q, want %q", string(after), corrupt)
	}
}
