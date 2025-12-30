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
	APIKey  string `json:"apiKey"` // Sensitive information, kept in local config only
}

// GenerationConfig holds settings for content generation
type GenerationConfig struct {
	SummaryMaxChars int `json:"summaryMaxChars"`
}

// Config represents the application's local settings
type Config struct {
	LLM        LLMConfig        `json:"llm"`
	Generation GenerationConfig `json:"generation"`
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
	}
}
