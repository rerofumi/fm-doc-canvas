package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultGoogleBaseURL = "https://generativelanguage.googleapis.com"
	defaultGoogleModel   = "gemini-2.5-flash-image"
)

type googleProvider struct {
	baseURL    string
	model      string
	apiKey     string
	httpClient *http.Client
}

// NewGoogleProvider creates an ImageGenProvider for Google Gemini generateContent.
func NewGoogleProvider(baseURL, model, apiKey string, httpClient *http.Client) ImageGenProvider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultGoogleBaseURL
	}
	if strings.TrimSpace(model) == "" {
		model = defaultGoogleModel
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 180 * time.Second}
	}
	return &googleProvider{
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		model:      strings.TrimSpace(model),
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: httpClient,
	}
}

func (p *googleProvider) Name() string {
	return ProviderGoogle
}

type googleGenerateRequest struct {
	Contents []googleContent `json:"contents"`
}

type googleContent struct {
	Parts []googlePart `json:"parts"`
}

type googlePart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *googleInlineData `json:"inline_data,omitempty"`
}

type googleInlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}

type googleGenerateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				InlineData *struct {
					MimeType string `json:"mimeType"`
					Data     string `json:"data"`
				} `json:"inlineData"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (p *googleProvider) Generate(ctx context.Context, prompt string, refImages []string) (GeneratedImagePayload, error) {
	parts := make([]googlePart, 0, 1+len(refImages))
	parts = append(parts, googlePart{Text: prompt})

	for _, ref := range refImages {
		trimmed := strings.TrimSpace(ref)
		if trimmed == "" {
			continue
		}
		mimeType, b64Data, err := splitDataURL(trimmed)
		if err != nil {
			return GeneratedImagePayload{}, fmt.Errorf("%s (%s): invalid reference image data URL: %w", ProviderGoogle, p.model, err)
		}
		parts = append(parts, googlePart{
			InlineData: &googleInlineData{
				MimeType: mimeType,
				Data:     b64Data,
			},
		})
	}

	reqPayload := googleGenerateRequest{
		Contents: []googleContent{
			{Parts: parts},
		},
	}

	endpoint := fmt.Sprintf(
		"%s/v1beta/models/%s:generateContent?key=%s",
		p.baseURL,
		url.PathEscape(p.model),
		url.QueryEscape(p.apiKey),
	)

	respBody, err := doJSONPost(ctx, p.httpClient, ProviderGoogle, p.model, endpoint, "", reqPayload, p.apiKey)
	if err != nil {
		return GeneratedImagePayload{}, SanitizeError(err, p.apiKey)
	}

	var parsed googleGenerateResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return GeneratedImagePayload{}, SanitizeError(fmt.Errorf("%s (%s): invalid JSON response: %w", ProviderGoogle, p.model, err), p.apiKey)
	}

	if len(parsed.Candidates) == 0 {
		return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained no candidates", ProviderGoogle, p.model)
	}

	for _, part := range parsed.Candidates[0].Content.Parts {
		if part.InlineData != nil && strings.TrimSpace(part.InlineData.Data) != "" {
			mimeType := strings.TrimSpace(part.InlineData.MimeType)
			if mimeType == "" {
				mimeType = "image/png"
			}
			return GeneratedImagePayload{
				DataURL: fmt.Sprintf("data:%s;base64,%s", mimeType, strings.TrimSpace(part.InlineData.Data)),
			}, nil
		}
	}

	return GeneratedImagePayload{}, fmt.Errorf("%s (%s): response contained no inlineData image", ProviderGoogle, p.model)
}

func splitDataURL(dataURL string) (string, string, error) {
	if !strings.HasPrefix(dataURL, "data:") {
		return "", "", fmt.Errorf("missing data: prefix")
	}
	commaIdx := strings.IndexByte(dataURL, ',')
	if commaIdx < 0 {
		return "", "", fmt.Errorf("missing comma separator")
	}
	header := dataURL[len("data:"):commaIdx]
	body := strings.TrimSpace(dataURL[commaIdx+1:])
	if !strings.Contains(header, ";base64") || body == "" {
		return "", "", fmt.Errorf("expected non-empty base64 data URL")
	}
	mimeType := strings.TrimSpace(strings.SplitN(header, ";", 2)[0])
	if mimeType == "" {
		mimeType = "image/png"
	}
	return mimeType, body, nil
}
