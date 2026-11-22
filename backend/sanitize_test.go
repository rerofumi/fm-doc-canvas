package backend

import (
	"errors"
	"strings"
	"testing"
)

func TestSanitizeText(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		secrets []string
		want    string
	}{
		{
			name:    "redacts exact apiKey",
			input:   "request failed with key sk-test-1234567890",
			secrets: []string{"sk-test-1234567890"},
			want:    "request failed with key [REDACTED]",
		},
		{
			name:    "redacts google query key",
			input:   "POST https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?key=AIzaSyDummySecret123&alt=json failed",
			secrets: nil,
			want:    "POST https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?key=[REDACTED]&alt=json failed",
		},
		{
			name:    "redacts bearer token",
			input:   "header Authorization: Bearer tok_abc.def-12345 rejected",
			secrets: nil,
			want:    "header Authorization: Bearer [REDACTED] rejected",
		},
		{
			name:    "ignores empty secrets and masks multiple patterns",
			input:   "Bearer xyz.123 ?key=secret_q key=another_q my-secret",
			secrets: []string{"", "   ", "my-secret"},
			want:    "Bearer [REDACTED] ?key=[REDACTED] key=[REDACTED] [REDACTED]",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := SanitizeText(tc.input, tc.secrets...)
			if got != tc.want {
				t.Fatalf("SanitizeText() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestSanitizeError(t *testing.T) {
	if got := SanitizeError(nil, "secret"); got != nil {
		t.Fatalf("SanitizeError(nil) = %v, want nil", got)
	}

	orig := errors.New("http 401: Bearer secret-token-999 with ?key=AIzaFoo&x=1 and myKey123")
	sanitized := SanitizeError(orig, "myKey123")
	if sanitized == nil {
		t.Fatal("SanitizeError() returned nil")
	}
	msg := sanitized.Error()
	for _, leaked := range []string{"secret-token-999", "AIzaFoo", "myKey123"} {
		if strings.Contains(msg, leaked) {
			t.Fatalf("sanitized error leaked %q in %q", leaked, msg)
		}
	}
	if !strings.Contains(msg, "Bearer [REDACTED]") || !strings.Contains(msg, "?key=[REDACTED]") || !strings.Contains(msg, "[REDACTED]") {
		t.Fatalf("sanitized error missing expected redaction markers: %q", msg)
	}
}
