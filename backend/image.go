package backend

import (

	"fmt"
	"os"
	"path/filepath"
)

type ImageGenService struct {
	configService *ConfigService
}

type ImageGenProvider interface {
	Generate(prompt string, contextData string, refImages []string) (string, error)
}

func NewImageGenService(configService *ConfigService) *ImageGenService {
	return &ImageGenService{
		configService: configService,
	}
}

func (s *ImageGenService) getProvider() (ImageGenProvider, error) {
	cfg := s.configService.GetConfig()
	providerCfg, err := cfg.ImageGen.GetProviderConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get provider config: %w", err)
	}

	switch provider := providerCfg.(type) {
	case *OpenRouterConfig:
		return &OpenRouterProvider{
			config:    provider,
			baseCfg:   &cfg.ImageGen,
			service:   s,
		}, nil
	case *OpenAIConfig:
		return &OpenAIProvider{
			config:    provider,
			baseCfg:   &cfg.ImageGen,
			service:   s,
		}, nil
	case *GoogleConfig:
		return &GoogleProvider{
			config:  provider,
			baseCfg: &cfg.ImageGen,
			service: s,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported provider: %T", providerCfg)
	}
}

// GenerateImage generates an image using the configured provider
func (s *ImageGenService) GenerateImage(prompt string, contextData string, refImages []string) (string, error) {
	provider, err := s.getProvider()
	if err != nil {
		return "", fmt.Errorf("failed to get image generation provider: %w", err)
	}

	return provider.Generate(prompt, contextData, refImages)
}

func (s *ImageGenService) resolveDownloadPath() (string, error) {
	cfg := s.configService.GetConfig()
	downloadPath := cfg.ImageGen.DownloadPath

	// If it's already an absolute path, return as is
	if filepath.IsAbs(downloadPath) {
		return downloadPath, nil
	}

	// Otherwise, resolve relative to the executable's directory
	execPath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}

	execDir := filepath.Dir(execPath)
	absPath := filepath.Join(execDir, downloadPath)

	// Create download directory if it doesn't exist
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		if err := os.MkdirAll(absPath, 0755); err != nil {
			return "", fmt.Errorf("failed to create download directory: %w", err)
		}
	}

	return absPath, nil
}
