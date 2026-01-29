package backend

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// LLMConfig holds credentials and settings for LLM access
type LLMConfig struct {
	BaseURL string `json:"baseURL"`
	Model   string `json:"model"`
	APIKey       string `json:"apiKey"` // Sensitive information, kept in local config only
	SystemPrompt string `json:"systemPrompt"`
}

// GenerationConfig holds settings for content generation
type GenerationConfig struct {
	SummaryMaxChars int `json:"summaryMaxChars"`
}

// OpenRouterConfig holds settings for OpenRouter
type OpenRouterConfig struct {
	BaseURL string `json:"baseURL"`
	Model   string `json:"model"`
	APIKey  string `json:"apiKey"` // Sensitive information
}

func (c *OpenRouterConfig) GetProvider() string {
	return "openrouter"
}

// OpenAIConfig holds settings for OpenAI
type OpenAIConfig struct {
	BaseURL string `json:"baseURL"`
	Model   string `json:"model"`
	APIKey  string `json:"apiKey"` // Sensitive information
}

func (c *OpenAIConfig) GetProvider() string {
	return "openai"
}

// GoogleConfig holds settings for Google
type GoogleConfig struct {
	Model  string `json:"model"`
	APIKey string `json:"apiKey"` // Sensitive information
}

func (c *GoogleConfig) GetProvider() string {
	return "google"
}

// XAIConfig holds settings for xAI
type XAIConfig struct {
	APIKey string `json:"apiKey"` // Sensitive information
	Model  string `json:"model"`  // Default: "grok-imagine-image"
}

func (c *XAIConfig) GetProvider() string {
	return "xai"
}

// ProviderConfig is an interface for provider-specific configurations
type ProviderConfig interface {
	// GetProvider returns the provider name
	GetProvider() string
}

// ImageGenConfig holds credentials and settings for image generation
type ImageGenConfig struct {
	Provider      string          `json:"provider"`
	DownloadPath  string          `json:"downloadPath"` // Default: "Image/" (resolved relative to executable)
	OpenRouter    *OpenRouterConfig   `json:"openrouter,omitempty"`
	OpenAI        *OpenAIConfig        `json:"openai,omitempty"`
	Google        *GoogleConfig        `json:"google,omitempty"`
	XAI           *XAIConfig           `json:"xai,omitempty"` // New: xAI support

	// For backward compatibility
	BaseURL string `json:"baseURL,omitempty"`
	Model   string `json:"model,omitempty"`
	APIKey  string `json:"apiKey,omitempty"`
}

// GetProviderConfig returns the provider-specific configuration
func (c *ImageGenConfig) GetProviderConfig() (ProviderConfig, error) {
	switch c.Provider {
	case "openrouter":
		if c.OpenRouter == nil {
			return nil, fmt.Errorf("openrouter config is not set")
		}
		return c.OpenRouter, nil
	case "openai":
		if c.OpenAI == nil {
			return nil, fmt.Errorf("openai config is not set")
		}
		return c.OpenAI, nil
	case "google":
		if c.Google == nil {
			return nil, fmt.Errorf("google config is not set")
		}
		return c.Google, nil
	case "xai":
		if c.XAI == nil {
			return nil, fmt.Errorf("xai config is not set")
		}
		return c.XAI, nil
	default:
		return nil, fmt.Errorf("unknown provider: %s", c.Provider)
	}
}

// UnmarshalJSON implements custom unmarshaling for backward compatibility
func (c *ImageGenConfig) UnmarshalJSON(data []byte) error {
	// First, try to unmarshal into a temporary struct for backward compatibility
	type Alias ImageGenConfig
	temp := &struct {
		*Alias
	}{
		Alias: (*Alias)(c),
	}

	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	// If the old fields are set, migrate them to the new structure
	if c.BaseURL != "" || c.Model != "" || c.APIKey != "" {
		switch c.Provider {
		case "openrouter":
			c.OpenRouter = &OpenRouterConfig{
				BaseURL: c.BaseURL,
				Model:   c.Model,
				APIKey:  c.APIKey,
			}
		case "openai":
			c.OpenAI = &OpenAIConfig{
				BaseURL: c.BaseURL,
				Model:   c.Model,
				APIKey:  c.APIKey,
			}
		case "google":
			c.Google = &GoogleConfig{
				Model:  c.Model,
				APIKey: c.APIKey,
			}
		case "xai":
			c.XAI = &XAIConfig{
				Model:  c.Model,
				APIKey: c.APIKey,
			}
		}
		// Clear the old fields
		c.BaseURL = ""
		c.Model = ""
		c.APIKey = ""
	}

	return nil
}

// Config represents the application's local settings
type Config struct {
	LLM        LLMConfig        `json:"llm"`
	Generation GenerationConfig `json:"generation"`
	ImageGen   ImageGenConfig   `json:"imageGen"`
}

// ConfigService handles loading and saving application configuration
type ConfigService struct {
	config     *Config
	configPath string
	mu         sync.RWMutex
}

// NewConfigService creates a new instance of ConfigService
func NewConfigService() (*ConfigService, error) {
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("could not get user config directory: %w", err)
	}

	appConfigDir := filepath.Join(userConfigDir, "fm-doc-canvas")
	if err := os.MkdirAll(appConfigDir, 0755); err != nil {
		return nil, fmt.Errorf("could not create app config directory: %w", err)
	}

	configPath := filepath.Join(appConfigDir, "config.json")
	service := &ConfigService{
		configPath: configPath,
		config:     defaultConfig(),
	}

	// Load existing config if it exists
	if _, err := os.Stat(configPath); err == nil {
		if err := service.Load(); err != nil {
			// If loading fails, we continue with default config
			fmt.Printf("Warning: failed to load config: %v\n", err)
		}
	} else {
		// Save default config if it doesn't exist
		if err := service.Save(service.config); err != nil {
			fmt.Printf("Warning: failed to save default config: %v\n", err)
		}
	}

	return service, nil
}

// GetConfig returns a copy of the current configuration
func (s *ConfigService) GetConfig() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return *s.config
}

// Save updates and persists the configuration
func (s *ConfigService) Save(cfg *Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(s.configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	s.config = cfg
	return nil
}

// Load reads the configuration from disk
func (s *ConfigService) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	s.config = &cfg
	return nil
}

// ResolveDownloadPath returns the absolute path for the configured download directory
func (s *ConfigService) ResolveDownloadPath() (string, error) {
	s.mu.RLock()
	downloadPath := s.config.ImageGen.DownloadPath
	s.mu.RUnlock()

	if filepath.IsAbs(downloadPath) {
		return downloadPath, nil
	}

	execPath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}
	execDir := filepath.Dir(execPath)
	return filepath.Join(execDir, downloadPath), nil
}

// ResolveImagePath resolves a relative image path against the download directory.
// It supports backward compatibility for paths that were previously stored relative to the executable.
func (s *ConfigService) ResolveImagePath(src string) (string, error) {
	if filepath.IsAbs(src) {
		return "", fmt.Errorf("absolute paths are not allowed")
	}

	downloadPath, err := s.ResolveDownloadPath()
	if err != nil {
		return "", err
	}

	// 1. Try standard resolution (relative to DownloadPath)
	// This covers "Import/filename.png" -> "Image/Import/filename.png"
	path := filepath.Join(downloadPath, src)
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}

	// 2. Backward compatibility: Try resolution relative to executable directory
	// This covers "Image/generated.png" -> "Image/generated.png" when src contains "Image/"
	execPath, err := os.Executable()
	if err == nil {
		execDir := filepath.Dir(execPath)
		compatPath := filepath.Join(execDir, src)
		if _, err := os.Stat(compatPath); err == nil {
			return compatPath, nil
		}
	}

	// Fallback to the standard path if file doesn't exist in either location
	return path, nil
}

func defaultConfig() *Config {
	return &Config{
		LLM: LLMConfig{
			BaseURL: "https://api.openai.com/v1",
			Model:   "gpt-4o-mini",
			APIKey:  "",
		},
		Generation: GenerationConfig{
			SummaryMaxChars: 100,
		},
		ImageGen: ImageGenConfig{
			Provider:     "openrouter",
			DownloadPath: "Image/",
			OpenRouter: &OpenRouterConfig{
				BaseURL: "https://openrouter.ai/api/v1",
				Model:   "sourceful/riverflow-v2-standard-preview",
				APIKey:  "",
			},
			OpenAI: &OpenAIConfig{
				BaseURL: "https://api.openai.com/v1",
				Model:   "gpt-image-1.5",
				APIKey:  "",
			},
			Google: &GoogleConfig{
				Model:  "gemini-2.5-flash-image",
				APIKey: "",
			},
			XAI: &XAIConfig{
				Model:  "grok-imagine-image",
				APIKey: "",
			},
		},
	}
}
