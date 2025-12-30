package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// LLMService handles communication with OpenAI compatible APIs
type LLMService struct {
	configService *ConfigService
	client        *http.Client
}

// NewLLMService creates a new instance of LLMService
func NewLLMService(configService *ConfigService) *LLMService {
	return &LLMService{
		configService: configService,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// ChatMessage represents a single message in a chat completion request
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionRequest represents the request body for OpenAI compatible chat APIs
type ChatCompletionRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
}

// ChatCompletionResponse represents the response body from OpenAI compatible chat APIs
type ChatCompletionResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GenerateText sends a prompt and context to the LLM and returns the generated content
func (s *LLMService) GenerateText(prompt string, contextData string) (string, error) {
	cfg := s.configService.GetConfig()

	systemPrompt := "You are a helpful assistant that generates documentation in Markdown format. Be concise and professional."
	userMessage := fmt.Sprintf("Context:\n%s\n\nUser Prompt:\n%s", contextData, prompt)

	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userMessage},
	}

	return s.callChatAPI(cfg, messages)
}

// GenerateSummary takes a text and returns a concise summary
func (s *LLMService) GenerateSummary(text string) (string, error) {
	cfg := s.configService.GetConfig()

	maxChars := cfg.Generation.SummaryMaxChars
	if maxChars <= 0 {
		maxChars = 100
	}

	systemPrompt := fmt.Sprintf("Summarize the following text in approximately %d characters or less. Focus on the core message.", maxChars)
	
	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: text},
	}

	return s.callChatAPI(cfg, messages)
}

func (s *LLMService) callChatAPI(cfg Config, messages []ChatMessage) (string, error) {
	reqBody := ChatCompletionRequest{
		Model:    cfg.LLM.Model,
		Messages: messages,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/chat/completions", cfg.LLM.BaseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	
	// Only set Authorization header if APIKey is provided (required for local providers like Ollama)
	if cfg.LLM.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.LLM.APIKey))
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API returned error status %d: %s", resp.StatusCode, string(body))
	}

	var chatResp ChatCompletionResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no response generated from LLM")
	}

	return chatResp.Choices[0].Message.Content, nil
}
