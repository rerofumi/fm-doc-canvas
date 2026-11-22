package backend

import (
	"errors"
	"regexp"
	"sort"
	"strings"
)

var (
	queryKeyPattern = regexp.MustCompile(`([?&\s]|^)key=[^&\s"']+`)
	bearerPattern   = regexp.MustCompile(`Bearer\s+[A-Za-z0-9._\-]+`)
)

// SanitizeText redacts known secrets, query API keys, and Bearer tokens from s.
func SanitizeText(s string, secrets ...string) string {
	if s == "" {
		return ""
	}

	out := s

	// Replace longest secrets first to avoid partial masking leaks.
	filtered := make([]string, 0, len(secrets))
	for _, sec := range secrets {
		if strings.TrimSpace(sec) != "" {
			filtered = append(filtered, sec)
		}
	}
	sort.Slice(filtered, func(i, j int) bool {
		return len(filtered[i]) > len(filtered[j])
	})
	for _, sec := range filtered {
		out = strings.ReplaceAll(out, sec, "[REDACTED]")
	}

	out = queryKeyPattern.ReplaceAllString(out, "${1}key=[REDACTED]")
	out = bearerPattern.ReplaceAllString(out, "Bearer [REDACTED]")

	return out
}

// SanitizeError returns a new error with sensitive values redacted from err.Error().
func SanitizeError(err error, secrets ...string) error {
	if err == nil {
		return nil
	}
	return errors.New(SanitizeText(err.Error(), secrets...))
}
