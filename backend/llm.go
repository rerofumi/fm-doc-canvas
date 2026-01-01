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
	Role    string      `json:"role"`
	Content interface{} `json:"content"` // Can be string or []ContentPart
}

// ContentPart represents a part of a message content (for multi-modal)
type ContentPart struct {
	Type     string    `json:"type"` // "text" or "image_url"
	Text     string    `json:"text,omitempty"`
	ImageURL *ImageURL `json:"image_url,omitempty"`
}

// ImageURL represents an image URL in a content part
type ImageURL struct {
	URL string `json:"url"` // "data:image/png;base64,..." etc.
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

// GenerateTextWithImages sends a prompt, context and images to the LLM and returns the generated content
func (s *LLMService) GenerateTextWithImages(prompt string, contextData string, imageDataURLs []string) (string, error) {
	cfg := s.configService.GetConfig()

	systemPrompt := "You are a helpful assistant that generates documentation in Markdown format. Be concise and professional."
	userMessageText := fmt.Sprintf("Context:\n%s\n\nUser Prompt:\n%s", contextData, prompt)

	// Create content parts for the user message
	contentParts := make([]ContentPart, 0, 1+len(imageDataURLs))
	
	// Add text content
	contentParts = append(contentParts, ContentPart{
		Type: "text",
		Text: userMessageText,
	})
	
	// Add image content parts
	for _, dataURL := range imageDataURLs {
		contentParts = append(contentParts, ContentPart{
			Type: "image_url",
			ImageURL: &ImageURL{
				URL: dataURL,
			},
		})
	}

	// Create messages with content parts
	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: contentParts},
	}

	return s.callChatAPIWithContentParts(cfg, messages)
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
	// Convert messages to use string content for compatibility
	stringMessages := make([]ChatMessage, len(messages))
	for i, msg := range messages {
		stringMessages[i] = ChatMessage{
			Role:    msg.Role,
			Content: fmt.Sprintf("%v", msg.Content),
		}
	}
	
	return s.callChatAPIWithContentParts(cfg, stringMessages)
}

func (s *LLMService) callChatAPIWithContentParts(cfg Config, messages []ChatMessage) (string, error) {
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

	// The content might be a string or a []ContentPart, but for our use case,
	// the response should always be a string.
	// We'll do a type assertion to be safe.
	content, ok := chatResp.Choices[0].Message.Content.(string)
	if !ok {
		// If it's not a string, convert it to a string representation
		content = fmt.Sprintf("%v", chatResp.Choices[0].Message.Content)
	}

	return content, nil
}
