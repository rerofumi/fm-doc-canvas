package backend

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripMap struct {
	fn func(*http.Request) (*http.Response, error)
}

func (r roundTripMap) RoundTrip(req *http.Request) (*http.Response, error) { return r.fn(req) }

func testHTTPClient(fn func(*http.Request) (*http.Response, error)) *http.Client {
	return &http.Client{Transport: roundTripMap{fn: fn}, Timeout: 2 * time.Second}
}

func jsonResp(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}
}

func TestNormalizeHTTPSURL(t *testing.T) {
	ok, err := NormalizeHTTPSURL("https://Example.com/alpha/")
	if err != nil {
		t.Fatal(err)
	}
	if ok.URL != "https://example.com/alpha" || ok.Domain != "example.com" {
		t.Fatalf("got %#v", ok)
	}
	if _, err := NormalizeHTTPSURL("http://example.com"); err == nil {
		t.Fatal("http must be rejected")
	}
	if _, err := NormalizeHTTPSURL("https://user:pass@example.com"); err == nil {
		t.Fatal("userinfo must be rejected")
	}
	if _, err := NormalizeHTTPSURL(""); err == nil {
		t.Fatal("empty must be rejected")
	}
}

func TestConfigWebSearchUsesOnlySelectedStrategy(t *testing.T) {
	called := ""
	store := NewMemoryConfigStore(t.TempDir(), &Config{WebSearch: WebSearchConfig{
		Provider: "kagi",
		Ollama:   &WebSearchProviderKeys{APIKey: "ollama-secret"},
		Kagi:     &WebSearchProviderKeys{APIKey: "kagi-secret"},
		Brave:    &WebSearchProviderKeys{APIKey: "brave-secret"},
	}})
	search := ConfigWebSearch{
		Store: store,
		Client: testHTTPClient(func(req *http.Request) (*http.Response, error) {
			called = req.URL.Host
			if req.Method != http.MethodPost {
				t.Fatalf("kagi method=%s want POST", req.Method)
			}
			if req.URL.Path != "/api/v1/search" {
				t.Fatalf("kagi path=%s", req.URL.Path)
			}
			if got := req.Header.Get("Authorization"); !strings.HasPrefix(got, "Bearer ") {
				t.Fatalf("kagi auth=%q", got)
			}
			return jsonResp(200, `{"data":{"search":[{"title":"K","url":"https://example.com/k","snippet":"s"}]}}`), nil
		}),
	}
	if search.ID() != "kagi" {
		t.Fatalf("id=%s", search.ID())
	}
	hits, err := search.Search(context.Background(), "q", 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 || hits[0].Title != "K" {
		t.Fatalf("hits=%#v", hits)
	}
	if called != "kagi.com" {
		t.Fatalf("called %s", called)
	}
	// switching provider must keep unused keys
	cfg := store.GetConfig()
	if cfg.WebSearch.Ollama.APIKey != "ollama-secret" || cfg.WebSearch.Brave.APIKey != "brave-secret" {
		t.Fatal("unused keys must be retained")
	}
}

func TestConfigWebSearchUnauthorizedDoesNotCallHTTP(t *testing.T) {
	called := false
	store := NewMemoryConfigStore(t.TempDir(), &Config{WebSearch: WebSearchConfig{Provider: "ollama"}})
	search := ConfigWebSearch{
		Store: store,
		Client: testHTTPClient(func(*http.Request) (*http.Response, error) {
			called = true
			return jsonResp(200, `{}`), nil
		}),
	}
	_, err := search.Search(context.Background(), "q", 1)
	if !IsWebSearchError(err, ErrWebSearchUnauthorized) {
		t.Fatalf("err=%v", err)
	}
	if called {
		t.Fatal("missing key must not call provider")
	}
}

func TestConfigWebSearchUnknownProvider(t *testing.T) {
	store := NewMemoryConfigStore(t.TempDir(), &Config{WebSearch: WebSearchConfig{Provider: "tavily"}})
	search := ConfigWebSearch{Store: store}
	_, err := search.Search(context.Background(), "q", 1)
	if !IsWebSearchError(err, ErrWebSearchUnknownProvider) {
		t.Fatalf("err=%v", err)
	}
}

func TestOllamaAdapterMapsResults(t *testing.T) {
	adapter, err := AdapterForProvider("ollama", "key", testHTTPClient(func(req *http.Request) (*http.Response, error) {
		if req.URL.Path != "/api/web_search" {
			t.Fatalf("path %s", req.URL.Path)
		}
		return jsonResp(200, `{"results":[{"title":"T","url":"https://example.com/t","content":"c"}]}`), nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	hits, err := adapter.Search(context.Background(), "q", 2)
	if err != nil || len(hits) != 1 || hits[0].Snippet != "c" {
		t.Fatalf("hits=%#v err=%v", hits, err)
	}
}

func TestFixtureSearchDoesNotUseNetwork(t *testing.T) {
	hits, err := NewFixtureWebSearch().Search(context.Background(), "hello", 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) < 3 {
		t.Fatalf("expected fixture hits, got %d", len(hits))
	}
}

func TestKagiAdapterParsesArrayEnvelope(t *testing.T) {
	adapter, err := AdapterForProvider("kagi", "key", testHTTPClient(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodPost || !strings.HasPrefix(req.Header.Get("Authorization"), "Bearer ") {
			t.Fatalf("method=%s auth=%q", req.Method, req.Header.Get("Authorization"))
		}
		return jsonResp(200, `{"data":[{"t":0,"title":"A","url":"https://example.com/a","snippet":"sa"},{"t":1,"list":["related"]}]}`), nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	hits, err := adapter.Search(context.Background(), "q", 3)
	if err != nil || len(hits) != 1 || hits[0].Title != "A" {
		t.Fatalf("hits=%#v err=%v", hits, err)
	}
}

func TestMissingWebSearchDefaultsToOllama(t *testing.T) {
	cfg := Config{}
	applyConfigDefaults(&cfg)
	if cfg.WebSearch.Provider != "ollama" || cfg.WebSearch.Ollama == nil {
		t.Fatalf("defaults=%#v", cfg.WebSearch)
	}
}
