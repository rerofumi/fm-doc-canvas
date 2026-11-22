package backend

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultLLMSystemPrompt = "You are a helpful assistant that generates documentation in Markdown format. Be concise and professional."

// LLMService handles OpenAI-compatible Chat Completions (text, vision, and summary).
type LLMService struct {
	cfgService *ConfigService
	httpClient *http.Client
}

// NewLLMService creates an LLMService with the given ConfigService and optional *http.Client.
func NewLLMService(cfgService *ConfigService, httpClient *http.Client) *LLMService {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 120 * time.Second}
	}
	return &LLMService{
		cfgService: cfgService,
		httpClient: httpClient,
	}
}

type chatCompletionRequest struct {
	Model    string                  `json:"model"`
	Messages []chatCompletionMessage `json:"messages"`
}

type chatCompletionMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// GenerateText sends a text-only prompt (with optional contextData) to the configured LLM.
func (s *LLMService) GenerateText(prompt, contextData string) (string, error) {
	return s.GenerateTextWithImages(prompt, contextData, nil)
}

// GenerateTextWithImages sends a multimodal prompt with optional image Data URLs to the configured LLM.
func (s *LLMService) GenerateTextWithImages(prompt, contextData string, imageDataURLs []string) (string, error) {
	cfg, err := s.cfgService.GetConfig()
	if err != nil {
		return "", err
	}

	systemPrompt := strings.TrimSpace(cfg.LLM.SystemPrompt)
	if systemPrompt == "" {
		systemPrompt = defaultLLMSystemPrompt
	}

	userText := prompt
	if strings.TrimSpace(contextData) != "" {
		userText = "Context:\n" + contextData + "\n\nUser Prompt:\n" + prompt
	}

	var userContent any = userText
	if len(imageDataURLs) > 0 {
		parts := make([]map[string]any, 0, 1+len(imageDataURLs))
		parts = append(parts, map[string]any{
			"type": "text",
			"text": userText,
		})
		for _, imgURL := range imageDataURLs {
			trimmedURL := strings.TrimSpace(imgURL)
			if trimmedURL == "" {
				continue
			}
			parts = append(parts, map[string]any{
				"type": "image_url",
				"image_url": map[string]string{
					"url": trimmedURL,
				},
			})
		}
		if len(parts) > 1 {
			userContent = parts
		}
	}

	return s.callChatCompletions(context.Background(), cfg.LLM, systemPrompt, userContent)
}

// GenerateSummary summarizes text using cfg.Generation.SummaryMaxChars.
func (s *LLMService) GenerateSummary(text string) (string, error) {
	cfg, err := s.cfgService.GetConfig()
	if err != nil {
		return "", err
	}

	maxChars := cfg.Generation.SummaryMaxChars
	if maxChars <= 0 {
		maxChars = 100
	}

	summaryInstruction := fmt.Sprintf(
		"Summarize the following text in approximately %d characters or less. Focus on the core message.",
		maxChars,
	)

	systemPrompt := summaryInstruction
	if existing := strings.TrimSpace(cfg.LLM.SystemPrompt); existing != "" {
		systemPrompt = existing + "\n" + summaryInstruction
	}

	return s.callChatCompletions(context.Background(), cfg.LLM, systemPrompt, text)
}

func (s *LLMService) callChatCompletions(ctx context.Context, llmCfg LLMConfig, systemPrompt string, userContent any) (string, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(llmCfg.BaseURL), "/")
	model := strings.TrimSpace(llmCfg.Model)
	apiKey := strings.TrimSpace(llmCfg.APIKey)

	if baseURL == "" {
		return "", errors.New("llm: baseURL が設定されていません")
	}
	if model == "" {
		return "", errors.New("llm: model が設定されていません")
	}

	reqPayload := chatCompletionRequest{
		Model: model,
		Messages: []chatCompletionMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		},
	}

	bodyBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return "", SanitizeError(fmt.Errorf("llm (%s): failed to marshal request: %w", model, err), apiKey)
	}

	endpoint := baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", SanitizeError(fmt.Errorf("llm (%s): failed to create request: %w", model, err), apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", SanitizeError(fmt.Errorf("llm (%s): request failed: %w", model, err), apiKey)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", SanitizeError(fmt.Errorf("llm (%s): failed to read response: %w", model, err), apiKey)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", SanitizeError(
			fmt.Errorf("llm (%s) HTTP %d: %s", model, resp.StatusCode, truncateErrorBody(respBody, 500)),
			apiKey,
		)
	}

	var parsed chatCompletionResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", SanitizeError(fmt.Errorf("llm (%s): invalid JSON response: %w", model, err), apiKey)
	}
	if len(parsed.Choices) == 0 {
		return "", SanitizeError(fmt.Errorf("llm (%s): response contained no choices", model), apiKey)
	}

	content := parsed.Choices[0].Message.Content
	if strings.TrimSpace(content) == "" {
		return "", SanitizeError(fmt.Errorf("llm (%s): response content is empty", model), apiKey)
	}

	return content, nil
}

func truncateErrorBody(body []byte, maxRunes int) string {
	s := strings.TrimSpace(string(body))
	if s == "" {
		return "(empty body)"
	}
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return string(runes[:maxRunes]) + "..."
}
