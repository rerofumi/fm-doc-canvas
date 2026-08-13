package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	ErrWebSearchUnauthorized    = "web-search-unauthorized"
	ErrWebSearchUnknownProvider = "web-search-unknown-provider"
	ErrWebSearchTimeout         = "web-search-timeout"
	ErrWebSearchProviderError   = "web-search-provider-error"
	ErrWebSearchEmpty           = "web-search-empty"
	ErrWebSearchInvalidQuery    = "web-search-invalid-query"
	ErrWebSearchInvalidURL      = "web-search-invalid-url"

	defaultWebSearchTimeout = 15 * time.Second
	maxWebSearchSources     = 8
)

type WebSearchError struct {
	Code    string
	Message string
}

func (e *WebSearchError) Error() string {
	if e.Message == "" {
		return e.Code
	}
	return e.Code + ": " + e.Message
}

func IsWebSearchError(err error, code string) bool {
	ws, ok := err.(*WebSearchError)
	return ok && ws.Code == code
}

type NormalizedHTTPSURL struct {
	URL    string
	Domain string
}

func NormalizeHTTPSURL(raw string) (NormalizedHTTPSURL, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return NormalizedHTTPSURL{}, &WebSearchError{Code: ErrWebSearchInvalidURL, Message: "empty url"}
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return NormalizedHTTPSURL{}, &WebSearchError{Code: ErrWebSearchInvalidURL, Message: "only https URLs without userinfo are allowed"}
	}
	parsed.Fragment = ""
	host := strings.ToLower(parsed.Hostname())
	if host == "" {
		return NormalizedHTTPSURL{}, &WebSearchError{Code: ErrWebSearchInvalidURL, Message: "empty host"}
	}
	if parsed.Port() == "443" {
		parsed.Host = host
	} else if parsed.Port() != "" {
		parsed.Host = host + ":" + parsed.Port()
	} else {
		parsed.Host = host
	}
	if path := parsed.Path; len(path) > 1 && strings.HasSuffix(path, "/") {
		parsed.Path = strings.TrimRight(path, "/")
	}
	return NormalizedHTTPSURL{URL: parsed.String(), Domain: host}, nil
}

func ValidateKnownURLs(raws []string) ([]NormalizedHTTPSURL, error) {
	out := make([]NormalizedHTTPSURL, 0, len(raws))
	for _, raw := range raws {
		normalized, err := NormalizeHTTPSURL(raw)
		if err != nil {
			return nil, err
		}
		out = append(out, normalized)
	}
	return out, nil
}

type httpDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

func defaultSearchHTTPClient() *http.Client {
	return &http.Client{Timeout: defaultWebSearchTimeout}
}

type ollamaWebSearch struct {
	client httpDoer
	apiKey string
}

func (a ollamaWebSearch) ID() string { return "ollama" }

func (a ollamaWebSearch) Search(ctx context.Context, query string, maxResults int) ([]WebSearchHit, error) {
	if strings.TrimSpace(a.apiKey) == "" {
		return nil, &WebSearchError{Code: ErrWebSearchUnauthorized, Message: "ollama api key is missing"}
	}
	body, _ := json.Marshal(map[string]interface{}{"query": query, "max_results": clampSearchMax(maxResults)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://ollama.com/api/web_search", strings.NewReader(string(body)))
	if err != nil {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := doSearchHTTP(a.client, req)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Results []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Content string `json:"content"`
		} `json:"results"`
	}
	if err := json.Unmarshal(resp, &parsed); err != nil {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: "invalid ollama response"}
	}
	hits := make([]WebSearchHit, 0, len(parsed.Results))
	for _, item := range parsed.Results {
		hits = append(hits, WebSearchHit{Title: item.Title, URL: item.URL, Snippet: item.Content})
	}
	return hits, nil
}

type kagiWebSearch struct {
	client httpDoer
	apiKey string
}

func (a kagiWebSearch) ID() string { return "kagi" }

func (a kagiWebSearch) Search(ctx context.Context, query string, maxResults int) ([]WebSearchHit, error) {
	if strings.TrimSpace(a.apiKey) == "" {
		return nil, &WebSearchError{Code: ErrWebSearchUnauthorized, Message: "kagi api key is missing"}
	}
	// Authenticated 200 (2026-08-13): POST JSON + Bearer on /api/v1/search.
	// help.kagi.com GET + Bot example 404s even with a live key.
	body, _ := json.Marshal(map[string]interface{}{
		"query":    query,
		"workflow": "search",
		"limit":    clampSearchMax(maxResults),
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://kagi.com/api/v1/search", strings.NewReader(string(body)))
	if err != nil {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := doSearchHTTP(a.client, req)
	if err != nil {
		return nil, err
	}
	return parseKagiSearchHits(resp)
}

type kagiSearchItem struct {
	Type    int    `json:"t"`
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

func parseKagiSearchHits(raw []byte) ([]WebSearchHit, error) {
	var objectEnvelope struct {
		Data struct {
			Search []kagiSearchItem `json:"search"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &objectEnvelope); err == nil && len(objectEnvelope.Data.Search) > 0 {
		return kagiItemsToHits(objectEnvelope.Data.Search), nil
	}
	var arrayEnvelope struct {
		Data []kagiSearchItem `json:"data"`
	}
	if err := json.Unmarshal(raw, &arrayEnvelope); err != nil {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: "invalid kagi response"}
	}
	items := make([]kagiSearchItem, 0, len(arrayEnvelope.Data))
	for _, item := range arrayEnvelope.Data {
		// Official GET envelope uses t=0 for search results. Skip related-search rows.
		if item.Type != 0 {
			continue
		}
		items = append(items, item)
	}
	return kagiItemsToHits(items), nil
}

func kagiItemsToHits(items []kagiSearchItem) []WebSearchHit {
	hits := make([]WebSearchHit, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(item.URL) == "" {
			continue
		}
		hits = append(hits, WebSearchHit{Title: item.Title, URL: item.URL, Snippet: item.Snippet})
	}
	return hits
}

type braveWebSearch struct {
	client httpDoer
	apiKey string
}

func (a braveWebSearch) ID() string { return "brave" }

func (a braveWebSearch) Search(ctx context.Context, query string, maxResults int) ([]WebSearchHit, error) {
	if strings.TrimSpace(a.apiKey) == "" {
		return nil, &WebSearchError{Code: ErrWebSearchUnauthorized, Message: "brave api key is missing"}
	}
	endpoint := fmt.Sprintf("https://api.search.brave.com/res/v1/web/search?q=%s&count=%d", url.QueryEscape(query), clampSearchMax(maxResults))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: err.Error()}
	}
	req.Header.Set("X-Subscription-Token", a.apiKey)
	req.Header.Set("Accept", "application/json")
	resp, err := doSearchHTTP(a.client, req)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Web struct {
			Results []struct {
				Title       string   `json:"title"`
				URL         string   `json:"url"`
				Description string   `json:"description"`
				Extra       []string `json:"extra_snippets"`
			} `json:"results"`
		} `json:"web"`
	}
	if err := json.Unmarshal(resp, &parsed); err != nil {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: "invalid brave response"}
	}
	hits := make([]WebSearchHit, 0, len(parsed.Web.Results))
	for _, item := range parsed.Web.Results {
		snippet := item.Description
		if len(item.Extra) > 0 {
			snippet = strings.TrimSpace(snippet + " " + strings.Join(item.Extra, " "))
		}
		hits = append(hits, WebSearchHit{Title: item.Title, URL: item.URL, Snippet: snippet})
	}
	return hits, nil
}

func doSearchHTTP(client httpDoer, req *http.Request) ([]byte, error) {
	if client == nil {
		client = defaultSearchHTTPClient()
	}
	resp, err := client.Do(req)
	if err != nil {
		if req.Context().Err() != nil {
			return nil, &WebSearchError{Code: ErrWebSearchTimeout, Message: "search timed out"}
		}
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: err.Error()}
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, &WebSearchError{Code: ErrWebSearchUnauthorized, Message: strings.TrimSpace(string(body))}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &WebSearchError{Code: ErrWebSearchProviderError, Message: fmt.Sprintf("http %d", resp.StatusCode)}
	}
	return body, nil
}

func clampSearchMax(maxResults int) int {
	if maxResults <= 0 {
		return maxWebSearchSources
	}
	if maxResults > maxWebSearchSources {
		return maxWebSearchSources
	}
	return maxResults
}

// ConfigWebSearch selects the configured strategy once and never failovers.
type ConfigWebSearch struct {
	Store  ConfigStore
	Client httpDoer
}

func (s ConfigWebSearch) ID() string {
	cfg := s.Store.GetConfig()
	if strings.TrimSpace(cfg.WebSearch.Provider) == "" {
		return "ollama"
	}
	return cfg.WebSearch.Provider
}

func (s ConfigWebSearch) Search(ctx context.Context, query string, maxResults int) ([]WebSearchHit, error) {
	adapter, err := s.activeAdapter()
	if err != nil {
		return nil, err
	}
	return adapter.Search(ctx, query, maxResults)
}

func (s ConfigWebSearch) activeAdapter() (WebSearchPort, error) {
	id := s.ID()
	cfg := s.Store.GetConfig()
	client := s.Client
	if client == nil {
		client = defaultSearchHTTPClient()
	}
	switch id {
	case "ollama":
		return ollamaWebSearch{client: client, apiKey: webSearchKey(cfg.WebSearch.Ollama)}, nil
	case "kagi":
		return kagiWebSearch{client: client, apiKey: webSearchKey(cfg.WebSearch.Kagi)}, nil
	case "brave":
		return braveWebSearch{client: client, apiKey: webSearchKey(cfg.WebSearch.Brave)}, nil
	case "fake":
		return NewFixtureWebSearch(), nil
	default:
		return nil, &WebSearchError{Code: ErrWebSearchUnknownProvider, Message: id}
	}
}

func webSearchKey(keys *WebSearchProviderKeys) string {
	if keys == nil {
		return ""
	}
	return strings.TrimSpace(keys.APIKey)
}

func AdapterForProvider(id, apiKey string, client httpDoer) (WebSearchPort, error) {
	if client == nil {
		client = defaultSearchHTTPClient()
	}
	switch id {
	case "ollama":
		return ollamaWebSearch{client: client, apiKey: apiKey}, nil
	case "kagi":
		return kagiWebSearch{client: client, apiKey: apiKey}, nil
	case "brave":
		return braveWebSearch{client: client, apiKey: apiKey}, nil
	case "fake":
		return NewFixtureWebSearch(), nil
	default:
		return nil, &WebSearchError{Code: ErrWebSearchUnknownProvider, Message: id}
	}
}
