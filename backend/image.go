package backend

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ImageGenProvider abstracts an external image generation backend.
type ImageGenProvider interface {
	Name() string
	Generate(ctx context.Context, prompt string, refImages []string) (GeneratedImagePayload, error)
}

// ImageGenService dispatches image generation requests to configured providers
// and persists generated images via ImageAssetService.
type ImageGenService struct {
	cfgService        *ConfigService
	assetService      *ImageAssetService
	httpClient        *http.Client
	baseURLOverrides  map[string]string
}

// NewImageGenService creates an ImageGenService with default 180s HTTP timeout when httpClient is nil.
func NewImageGenService(cfgService *ConfigService, assetService *ImageAssetService, httpClient *http.Client) *ImageGenService {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 180 * time.Second}
	}
	return &ImageGenService{
		cfgService:       cfgService,
		assetService:     assetService,
		httpClient:       httpClient,
		baseURLOverrides: make(map[string]string),
	}
}

// SetBaseURLOverride overrides the baseURL used for a provider (primarily for testing).
func (s *ImageGenService) SetBaseURLOverride(provider, baseURL string) {
	if s.baseURLOverrides == nil {
		s.baseURLOverrides = make(map[string]string)
	}
	key := strings.ToLower(strings.TrimSpace(provider))
	if strings.TrimSpace(baseURL) == "" {
		delete(s.baseURLOverrides, key)
		return
	}
	s.baseURLOverrides[key] = strings.TrimRight(strings.TrimSpace(baseURL), "/")
}

// GenerateImage generates an image using cfg.ImageGen.Provider and saves it locally.
func (s *ImageGenService) GenerateImage(prompt, contextData string, refImages []string) (string, error) {
	cfg, err := s.cfgService.GetConfig()
	if err != nil {
		return "", err
	}
	return s.generateWithConfig(context.Background(), cfg, prompt, contextData, refImages, cfg.ImageGen.Provider)
}

// GenerateImageWithProvider generates an image using the specified provider without modifying config.json.
// If provider is empty, cfg.ImageGen.Provider is used.
func (s *ImageGenService) GenerateImageWithProvider(prompt, contextData string, refImages []string, provider string) (string, error) {
	cfg, err := s.cfgService.GetConfig()
	if err != nil {
		return "", err
	}
	target := strings.TrimSpace(provider)
	if target == "" {
		target = cfg.ImageGen.Provider
	}
	return s.generateWithConfig(context.Background(), cfg, prompt, contextData, refImages, target)
}

func (s *ImageGenService) generateWithConfig(ctx context.Context, cfg Config, prompt, contextData string, refImages []string, providerName string) (string, error) {
	target := strings.ToLower(strings.TrimSpace(providerName))
	if target == "" {
		target = ProviderOpenRouter
	}

	fullPrompt := prompt
	if strings.TrimSpace(contextData) != "" {
		fullPrompt = "Context:\n" + contextData + "\n\nPrompt:\n" + prompt
	}

	var (
		adapter ImageGenProvider
		apiKey  string
	)

	switch target {
	case ProviderOpenRouter:
		apiKey = strings.TrimSpace(cfg.ImageGen.OpenRouter.APIKey)
		if apiKey == "" {
			return "", fmt.Errorf("%s の API Key が設定されていません", target)
		}
		baseURL := cfg.ImageGen.OpenRouter.BaseURL
		if ov := s.baseURLOverrides[ProviderOpenRouter]; ov != "" {
			baseURL = ov
		}
		adapter = NewOpenRouterProvider(baseURL, cfg.ImageGen.OpenRouter.Model, apiKey, s.httpClient)

	case ProviderOpenAI:
		apiKey = strings.TrimSpace(cfg.ImageGen.OpenAI.APIKey)
		if apiKey == "" {
			return "", fmt.Errorf("%s の API Key が設定されていません", target)
		}
		baseURL := cfg.ImageGen.OpenAI.BaseURL
		if ov := s.baseURLOverrides[ProviderOpenAI]; ov != "" {
			baseURL = ov
		}
		adapter = NewOpenAIProvider(baseURL, cfg.ImageGen.OpenAI.Model, apiKey, s.httpClient)

	case ProviderGoogle:
		apiKey = strings.TrimSpace(cfg.ImageGen.Google.APIKey)
		if apiKey == "" {
			return "", fmt.Errorf("%s の API Key が設定されていません", target)
		}
		baseURL := defaultGoogleBaseURL
		if ov := s.baseURLOverrides[ProviderGoogle]; ov != "" {
			baseURL = ov
		}
		adapter = NewGoogleProvider(baseURL, cfg.ImageGen.Google.Model, apiKey, s.httpClient)

	case ProviderXAI:
		apiKey = strings.TrimSpace(cfg.ImageGen.XAI.APIKey)
		if apiKey == "" {
			return "", fmt.Errorf("%s の API Key が設定されていません", target)
		}
		baseURL := defaultXAIBaseURL
		if ov := s.baseURLOverrides[ProviderXAI]; ov != "" {
			baseURL = ov
		}
		adapter = NewXAIProvider(baseURL, cfg.ImageGen.XAI.Model, apiKey, s.httpClient)

	default:
		return "", fmt.Errorf("未知の画像生成プロバイダーです: %s", providerName)
	}

	payload, err := adapter.Generate(ctx, fullPrompt, refImages)
	if err != nil {
		return "", SanitizeError(err, apiKey)
	}

	relPath, err := s.assetService.SaveGeneratedImage(payload)
	if err != nil {
		return "", SanitizeError(fmt.Errorf("%s: failed to save generated image: %w", target, err), apiKey)
	}

	return relPath, nil
}

type httpStatusError struct {
	Provider   string
	Model      string
	StatusCode int
	Body       string
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("%s (%s) HTTP %d: %s", e.Provider, e.Model, e.StatusCode, e.Body)
}

func doJSONPost(ctx context.Context, client *http.Client, provider, model, endpoint, bearerKey string, payload any, secrets ...string) ([]byte, error) {
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, SanitizeError(fmt.Errorf("%s (%s): failed to marshal request: %w", provider, model, err), secrets...)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, SanitizeError(fmt.Errorf("%s (%s): failed to create request: %w", provider, model, err), secrets...)
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(bearerKey) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(bearerKey))
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, SanitizeError(fmt.Errorf("%s (%s): request failed: %w", provider, model, err), secrets...)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, SanitizeError(fmt.Errorf("%s (%s): failed to read response: %w", provider, model, err), secrets...)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		sanitizedBody := SanitizeText(truncateErrorBody(respBody, 500), secrets...)
		return nil, &httpStatusError{
			Provider:   provider,
			Model:      model,
			StatusCode: resp.StatusCode,
			Body:       sanitizedBody,
		}
	}

	return respBody, nil
}
