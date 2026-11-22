package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	defaultXAIBaseURL = "https://api.x.ai"
	defaultXAIModel   = "grok-imagine-image"
)

type xaiProvider struct {
	baseURL    string
	model      string
	apiKey     string
	httpClient *http.Client
}

// NewXAIProvider creates an ImageGenProvider for xAI Images Generations & Edits.
func NewXAIProvider(baseURL, model, apiKey string, httpClient *http.Client) ImageGenProvider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultXAIBaseURL
	}
	if strings.TrimSpace(model) == "" {
		model = defaultXAIModel
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 180 * time.Second}
	}
	return &xaiProvider{
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		model:      strings.TrimSpace(model),
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: httpClient,
	}
}

func (p *xaiProvider) Name() string {
	return ProviderXAI
}

type xaiImageRef struct {
	URL string `json:"url"`
}

type xaiImageRequest struct {
	Model          string       `json:"model"`
	Prompt         string       `json:"prompt"`
	ResponseFormat string       `json:"response_format"`
	N              int          `json:"n"`
	Image          *xaiImageRef `json:"image,omitempty"`
}

type xaiImageResponse struct {
	Data []struct {
		B64JSON string `json:"b64_json"`
		URL     string `json:"url"`
	} `json:"data"`
}

func (p *xaiProvider) Generate(ctx context.Context, prompt string, refImages []string) (GeneratedImagePayload, error) {
	var firstRef string
	for _, ref := range refImages {
		if t := strings.TrimSpace(ref); t != "" {
			firstRef = t
			break
		}
	}

	reqPayload := xaiImageRequest{
		Model:          p.model,
		Prompt:         prompt,
		ResponseFormat: "b64_json",
		N:              1,
	}

	endpoint := p.baseURL + "/v1/images/generations"
	if firstRef != "" {
		endpoint = p.baseURL + "/v1/images/edits"
		reqPayload.Image = &xaiImageRef{URL: firstRef}
	}

	respBody, err := doJSONPost(ctx, p.httpClient, ProviderXAI, p.model, endpoint, p.apiKey, reqPayload, p.apiKey)
	if err != nil {
		return GeneratedImagePayload{}, err
	}

	var parsed xaiImageResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return GeneratedImagePayload{}, SanitizeError(fmt.Errorf("%s (%s): invalid JSON response: %w", ProviderXAI, p.model, err), p.apiKey)
	}
	if len(parsed.Data) == 0 {
		return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained no image data", ProviderXAI, p.model)
	}

	if b64 := strings.TrimSpace(parsed.Data[0].B64JSON); b64 != "" {
		return GeneratedImagePayload{DataURL: "data:image/jpeg;base64," + b64}, nil
	}
	if u := strings.TrimSpace(parsed.Data[0].URL); u != "" {
		return GeneratedImagePayload{ImageURL: u}, nil
	}

	return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained empty image data", ProviderXAI, p.model)
}
