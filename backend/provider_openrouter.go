package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const (
	defaultOpenRouterBaseURL = "https://openrouter.ai/api/v1"
	defaultOpenRouterModel   = "sourceful/riverflow-v2-fast"
)

var openRouterDataURLRegex = regexp.MustCompile(`data:image/[^;]+;base64,[A-Za-z0-9+/=]+`)

type openRouterProvider struct {
	baseURL    string
	model      string
	apiKey     string
	httpClient *http.Client
}

// NewOpenRouterProvider creates an ImageGenProvider for OpenRouter.
func NewOpenRouterProvider(baseURL, model, apiKey string, httpClient *http.Client) ImageGenProvider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultOpenRouterBaseURL
	}
	if strings.TrimSpace(model) == "" {
		model = defaultOpenRouterModel
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 180 * time.Second}
	}
	return &openRouterProvider{
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		model:      strings.TrimSpace(model),
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: httpClient,
	}
}

func (p *openRouterProvider) Name() string {
	return ProviderOpenRouter
}

type openRouterRequest struct {
	Model      string                  `json:"model"`
	Messages   []chatCompletionMessage `json:"messages"`
	Modalities []string                `json:"modalities"`
}

type openRouterResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
			Images  []struct {
				ImageURL struct {
					URL string `json:"url"`
				} `json:"image_url"`
			} `json:"images"`
		} `json:"message"`
	} `json:"choices"`
}

func (p *openRouterProvider) Generate(ctx context.Context, prompt string, refImages []string) (GeneratedImagePayload, error) {
	var content any = prompt
	if len(refImages) > 0 {
		parts := make([]map[string]any, 0, 1+len(refImages))
		parts = append(parts, map[string]any{
			"type": "text",
			"text": prompt,
		})
		for _, ref := range refImages {
			trimmed := strings.TrimSpace(ref)
			if trimmed == "" {
				continue
			}
			parts = append(parts, map[string]any{
				"type": "image_url",
				"image_url": map[string]string{
					"url": trimmed,
				},
			})
		}
		if len(parts) > 1 {
			content = parts
		}
	}

	reqPayload := openRouterRequest{
		Model: p.model,
		Messages: []chatCompletionMessage{
			{Role: "user", Content: content},
		},
		Modalities: []string{"image"},
	}

	endpoint := p.baseURL + "/chat/completions"
	respBody, err := doJSONPost(ctx, p.httpClient, ProviderOpenRouter, p.model, endpoint, p.apiKey, reqPayload, p.apiKey)
	if err != nil {
		return GeneratedImagePayload{}, err
	}

	var parsed openRouterResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return GeneratedImagePayload{}, SanitizeError(fmt.Errorf("%s (%s): invalid JSON response: %w", ProviderOpenRouter, p.model, err), p.apiKey)
	}

	if len(parsed.Choices) == 0 {
		return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained no choices", ProviderOpenRouter, p.model)
	}

	msg := parsed.Choices[0].Message
	if len(msg.Images) > 0 {
		imgURL := strings.TrimSpace(msg.Images[0].ImageURL.URL)
		if imgURL != "" {
			if strings.HasPrefix(imgURL, "data:") {
				return GeneratedImagePayload{DataURL: imgURL}, nil
			}
			return GeneratedImagePayload{ImageURL: imgURL}, nil
		}
	}

	if match := openRouterDataURLRegex.FindString(msg.Content); match != "" {
		return GeneratedImagePayload{DataURL: match}, nil
	}

	return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained no image data", ProviderOpenRouter, p.model)
}
