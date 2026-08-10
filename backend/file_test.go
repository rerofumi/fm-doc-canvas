package backend

import "testing"

func TestNormalizeMarkdownFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "markdown filename", input: "chapter.md", expected: "chapter.md"},
		{name: "adds extension", input: "chapter", expected: "chapter.md"},
		{name: "removes path", input: "../chapters/chapter.md", expected: "chapter.md"},
		{name: "empty filename", input: "", expected: "export.md"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeMarkdownFilename(tt.input); got != tt.expected {
				t.Fatalf("normalizeMarkdownFilename(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
