package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	ProviderOpenRouter = "openrouter"
	ProviderOpenAI     = "openai"
	ProviderGoogle     = "google"
	ProviderXAI        = "xai"
)

// Config represents the persisted application configuration (config.json).
type Config struct {
	LLM        LLMConfig        `json:"llm"`
	Generation GenerationConfig `json:"generation"`
	ImageGen   ImageGenConfig   `json:"imageGen"`
}

// LLMConfig holds OpenAI-compatible LLM settings.
type LLMConfig struct {
	BaseURL      string `json:"baseURL"`
	Model        string `json:"model"`
	APIKey       string `json:"apiKey"`
	SystemPrompt string `json:"systemPrompt"`
}

// GenerationConfig holds text generation behavior settings.
type GenerationConfig struct {
	SummaryMaxChars int `json:"summaryMaxChars"`
}

// OpenRouterImageConfig holds OpenRouter image generation settings.
type OpenRouterImageConfig struct {
	BaseURL string `json:"baseURL"`
	Model   string `json:"model"`
	APIKey  string `json:"apiKey"`
}

// OpenAIImageConfig holds OpenAI image generation settings.
type OpenAIImageConfig struct {
	BaseURL string `json:"baseURL"`
	Model   string `json:"model"`
	APIKey  string `json:"apiKey"`
}

// GoogleImageConfig holds Google Gemini image generation settings.
type GoogleImageConfig struct {
	Model  string `json:"model"`
	APIKey string `json:"apiKey"`
}

// XAIImageConfig holds xAI image generation settings.
type XAIImageConfig struct {
	Model  string `json:"model"`
	APIKey string `json:"apiKey"`
}

// ImageGenConfig holds multi-provider image generation settings.
type ImageGenConfig struct {
	Provider     string                `json:"provider"`
	DownloadPath string                `json:"downloadPath"`
	OpenRouter   OpenRouterImageConfig `json:"openrouter"`
	OpenAI       OpenAIImageConfig     `json:"openai"`
	Google       GoogleImageConfig     `json:"google"`
	XAI          XAIImageConfig        `json:"xai"`
}

// UnmarshalJSON migrates legacy flat imageGen.{baseURL,model,apiKey} fields into the
// target provider struct while giving precedence to non-empty per-provider fields.
func (c *ImageGenConfig) UnmarshalJSON(data []byte) error {
	type imageGenAlias struct {
		Provider     string                `json:"provider"`
		DownloadPath string                `json:"downloadPath"`
		OpenRouter   OpenRouterImageConfig `json:"openrouter"`
		OpenAI       OpenAIImageConfig     `json:"openai"`
		Google       GoogleImageConfig     `json:"google"`
		XAI          XAIImageConfig        `json:"xai"`
		LegacyBase   string                `json:"baseURL"`
		LegacyModel  string                `json:"model"`
		LegacyAPIKey string                `json:"apiKey"`
	}

	var raw imageGenAlias
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	c.Provider = raw.Provider
	c.DownloadPath = raw.DownloadPath
	c.OpenRouter = raw.OpenRouter
	c.OpenAI = raw.OpenAI
	c.Google = raw.Google
	c.XAI = raw.XAI

	target := strings.TrimSpace(c.Provider)
	if target == "" {
		target = ProviderOpenRouter
	}

	switch target {
	case ProviderOpenRouter:
		if strings.TrimSpace(c.OpenRouter.BaseURL) == "" && strings.TrimSpace(raw.LegacyBase) != "" {
			c.OpenRouter.BaseURL = raw.LegacyBase
		}
		if strings.TrimSpace(c.OpenRouter.Model) == "" && strings.TrimSpace(raw.LegacyModel) != "" {
			c.OpenRouter.Model = raw.LegacyModel
		}
		if strings.TrimSpace(c.OpenRouter.APIKey) == "" && strings.TrimSpace(raw.LegacyAPIKey) != "" {
			c.OpenRouter.APIKey = raw.LegacyAPIKey
		}
	case ProviderOpenAI:
		if strings.TrimSpace(c.OpenAI.BaseURL) == "" && strings.TrimSpace(raw.LegacyBase) != "" {
			c.OpenAI.BaseURL = raw.LegacyBase
		}
		if strings.TrimSpace(c.OpenAI.Model) == "" && strings.TrimSpace(raw.LegacyModel) != "" {
			c.OpenAI.Model = raw.LegacyModel
		}
		if strings.TrimSpace(c.OpenAI.APIKey) == "" && strings.TrimSpace(raw.LegacyAPIKey) != "" {
			c.OpenAI.APIKey = raw.LegacyAPIKey
		}
	case ProviderGoogle:
		if strings.TrimSpace(c.Google.Model) == "" && strings.TrimSpace(raw.LegacyModel) != "" {
			c.Google.Model = raw.LegacyModel
		}
		if strings.TrimSpace(c.Google.APIKey) == "" && strings.TrimSpace(raw.LegacyAPIKey) != "" {
			c.Google.APIKey = raw.LegacyAPIKey
		}
	case ProviderXAI:
		if strings.TrimSpace(c.XAI.Model) == "" && strings.TrimSpace(raw.LegacyModel) != "" {
			c.XAI.Model = raw.LegacyModel
		}
		if strings.TrimSpace(c.XAI.APIKey) == "" && strings.TrimSpace(raw.LegacyAPIKey) != "" {
			c.XAI.APIKey = raw.LegacyAPIKey
		}
	}

	return nil
}

// DefaultConfig returns a Config populated with default values.
func DefaultConfig() Config {
	return Config{
		LLM: LLMConfig{
			BaseURL:      "https://api.openai.com/v1",
			Model:        "gpt-4o-mini",
			APIKey:       "",
			SystemPrompt: "",
		},
		Generation: GenerationConfig{
			SummaryMaxChars: 100,
		},
		ImageGen: ImageGenConfig{
			Provider:     ProviderOpenRouter,
			DownloadPath: "Image/",
			OpenRouter: OpenRouterImageConfig{
				BaseURL: "https://openrouter.ai/api/v1",
				Model:   "sourceful/riverflow-v2-fast",
				APIKey:  "",
			},
			OpenAI: OpenAIImageConfig{
				BaseURL: "https://api.openai.com/v1",
				Model:   "gpt-image-1.5",
				APIKey:  "",
			},
			Google: GoogleImageConfig{
				Model:  "gemini-2.5-flash-image",
				APIKey: "",
			},
			XAI: XAIImageConfig{
				Model:  "grok-imagine-image",
				APIKey: "",
			},
		},
	}
}

func applyDefaults(cfg Config) Config {
	def := DefaultConfig()

	if strings.TrimSpace(cfg.LLM.BaseURL) == "" {
		cfg.LLM.BaseURL = def.LLM.BaseURL
	}
	if strings.TrimSpace(cfg.LLM.Model) == "" {
		cfg.LLM.Model = def.LLM.Model
	}
	if cfg.Generation.SummaryMaxChars <= 0 {
		cfg.Generation.SummaryMaxChars = def.Generation.SummaryMaxChars
	}
	if strings.TrimSpace(cfg.ImageGen.Provider) == "" {
		cfg.ImageGen.Provider = def.ImageGen.Provider
	}
	if strings.TrimSpace(cfg.ImageGen.DownloadPath) == "" {
		cfg.ImageGen.DownloadPath = def.ImageGen.DownloadPath
	}
	if strings.TrimSpace(cfg.ImageGen.OpenRouter.BaseURL) == "" {
		cfg.ImageGen.OpenRouter.BaseURL = def.ImageGen.OpenRouter.BaseURL
	}
	if strings.TrimSpace(cfg.ImageGen.OpenRouter.Model) == "" {
		cfg.ImageGen.OpenRouter.Model = def.ImageGen.OpenRouter.Model
	}
	if strings.TrimSpace(cfg.ImageGen.OpenAI.BaseURL) == "" {
		cfg.ImageGen.OpenAI.BaseURL = def.ImageGen.OpenAI.BaseURL
	}
	if strings.TrimSpace(cfg.ImageGen.OpenAI.Model) == "" {
		cfg.ImageGen.OpenAI.Model = def.ImageGen.OpenAI.Model
	}
	if strings.TrimSpace(cfg.ImageGen.Google.Model) == "" {
		cfg.ImageGen.Google.Model = def.ImageGen.Google.Model
	}
	if strings.TrimSpace(cfg.ImageGen.XAI.Model) == "" {
		cfg.ImageGen.XAI.Model = def.ImageGen.XAI.Model
	}

	return cfg
}

// ConfigService manages reading and atomic writing of config.json.
type ConfigService struct {
	configPath string
}

// NewConfigService creates a ConfigService backed by configPath.
// If configPath is empty, the OS user config directory is used.
func NewConfigService(configPath string) (*ConfigService, error) {
	if strings.TrimSpace(configPath) == "" {
		baseDir, err := os.UserConfigDir()
		if err != nil {
			return nil, fmt.Errorf("failed to resolve user config dir: %w", err)
		}
		configPath = filepath.Join(baseDir, "fm-doc-canvas", "config.json")
	}
	return &ConfigService{configPath: configPath}, nil
}

// Path returns the configured file path.
func (s *ConfigService) Path() string {
	return s.configPath
}

// GetConfig reads config.json and applies defaults without modifying the file.
// When config.json does not exist, it returns DefaultConfig() and nil.
// When config.json is malformed, it returns an error without overwriting the file.
func (s *ConfigService) GetConfig() (Config, error) {
	data, err := os.ReadFile(s.configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return DefaultConfig(), nil
		}
		return DefaultConfig(), fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return DefaultConfig(), fmt.Errorf("failed to parse config.json: %w", err)
	}

	return applyDefaults(cfg), nil
}

// SaveConfig normalizes defaults and atomically writes cfg to config.json.
func (s *ConfigService) SaveConfig(cfg Config) error {
	normalized := applyDefaults(cfg)

	dir := filepath.Dir(s.configPath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	payload, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize config: %w", err)
	}
	payload = append(payload, '\n')

	tmpFile, err := os.CreateTemp(dir, "config-*.tmp")
	if err != nil {
		return fmt.Errorf("failed to create temp config file: %w", err)
	}
	tmpPath := tmpFile.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(tmpPath)
		}
	}()

	if err := tmpFile.Chmod(0o600); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("failed to set config permissions: %w", err)
	}
	if _, err := tmpFile.Write(payload); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("failed to write temp config file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("failed to close temp config file: %w", err)
	}

	if err := os.Rename(tmpPath, s.configPath); err != nil {
		return fmt.Errorf("failed to replace config file: %w", err)
	}
	cleanup = false
	return nil
}
