package backend

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
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
			Timeout: 120 * time.Second,
		},
	}
}

// ChatMessage represents a single message in a chat completion request
type ChatMessage struct {
	Role       string      `json:"role"`
	Content    interface{} `json:"content"` // Can be string or []ContentPart
	Name       string      `json:"name,omitempty"`
	ToolCallID string      `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall  `json:"tool_calls,omitempty"`
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
	Model    string           `json:"model"`
	Messages []ChatMessage    `json:"messages"`
	Tools    []ToolDefinition `json:"tools,omitempty"`
	Stream   bool             `json:"stream,omitempty"`
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

	systemPrompt := cfg.LLM.SystemPrompt
	if systemPrompt == "" {
		systemPrompt = "You are a helpful assistant that generates documentation in Markdown format. Be concise and professional."
	}
	userMessage := fmt.Sprintf("Context:\n%s\n\nUser Prompt:\n%s", contextData, prompt)

	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userMessage},
	}

	return s.callChatAPI(cfg, messages)
}

// GenerateOrchestrationProposal uses a fixed, narrowly scoped system prompt.
// Next Action planning must not inherit a user's general-purpose system prompt
// (which may ask for prose, tools, or mutations) because the contract is a
// one-shot read-only JSON proposal.
func (s *LLMService) GenerateOrchestrationProposal(prompt string) (string, error) {
	if s == nil || s.configService == nil {
		return "", fmt.Errorf("orchestration provider is unavailable")
	}
	cfg := s.configService.GetConfig()
	systemPrompt := "You are the Next Action planner. Return only the requested JSON object. You are read-only: do not call tools, mutate documents, or write dialogue. Follow every kind, target, arity, and required-field constraint in the user prompt."
	return s.callChatAPI(cfg, []ChatMessage{{Role: "system", Content: systemPrompt}, {Role: "user", Content: prompt}})
}

type AgentChatResult struct {
	Content   string
	ToolCalls []ToolCall
}

func (s *LLMService) AgentSystemPrompt() string {
	if s == nil || s.configService == nil {
		return effectiveAgentSystemPrompt("")
	}
	return effectiveAgentSystemPrompt(s.configService.GetConfig().LLM.SystemPrompt)
}

func (s *LLMService) StreamAgentChat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, onText func(string)) (AgentChatResult, error) {
	return s.streamChat(ctx, messages, tools, onText)
}

// GenerateChatReply answers a conversational request using the selected Canvas
// context and recent session history supplied by the Frontend.
func (s *LLMService) GenerateChatReply(prompt string, contextData string) (string, error) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return "", fmt.Errorf("prompt is required")
	}
	cfg := s.configService.GetConfig()

	systemPrompt := cfg.LLM.SystemPrompt
	if systemPrompt == "" {
		systemPrompt = "You are a helpful assistant working with the user's document canvas. Answer the current question directly and naturally. Use the supplied Canvas node and recent conversation when relevant. Do not claim to have edited the Canvas unless a tool confirms the edit."
	}
	userMessage := prompt
	if strings.TrimSpace(contextData) != "" {
		userMessage = fmt.Sprintf("Context:\n%s\n\nCurrent user message:\n%s", contextData, prompt)
	}

	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userMessage},
	}
	return s.callChatAPI(cfg, messages)
}

// completeChat is the tool-calling entry point used by the agent loop. It is
// deliberately OpenAI-compatible so Ollama and other local compatible servers
// can be used without a provider-specific dependency.
func (s *LLMService) completeChat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition) (AgentChatResult, error) {
	cfg := s.configService.GetConfig()
	request := ChatCompletionRequest{Model: cfg.LLM.Model, Messages: messages, Tools: tools}
	jsonData, err := json.Marshal(request)
	if err != nil {
		return AgentChatResult{}, fmt.Errorf("failed to marshal agent request: %w", err)
	}
	url := fmt.Sprintf("%s/chat/completions", strings.TrimSuffix(cfg.LLM.BaseURL, "/"))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonData))
	if err != nil {
		return AgentChatResult{}, fmt.Errorf("failed to create agent request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.LLM.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.LLM.APIKey))
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return AgentChatResult{}, fmt.Errorf("agent API request failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return AgentChatResult{}, fmt.Errorf("failed to read agent response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return AgentChatResult{}, fmt.Errorf("agent API returned error status %d: %s", resp.StatusCode, string(body))
	}
	var result ChatCompletionResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return AgentChatResult{}, fmt.Errorf("failed to unmarshal agent response: %w", err)
	}
	if result.Error != nil {
		return AgentChatResult{}, fmt.Errorf("agent provider error: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		return AgentChatResult{}, fmt.Errorf("agent provider returned no choices")
	}
	message := result.Choices[0].Message
	content, _ := message.Content.(string)
	return AgentChatResult{Content: content, ToolCalls: message.ToolCalls}, nil
}

// streamChat consumes the OpenAI-compatible SSE stream and reports text deltas
// as soon as the provider sends them. A non-stream JSON response is accepted as
// a compatibility fallback for providers that ignore stream=true.
func (s *LLMService) streamChat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, onText func(string)) (AgentChatResult, error) {
	cfg := s.configService.GetConfig()
	request := ChatCompletionRequest{Model: cfg.LLM.Model, Messages: messages, Tools: tools, Stream: true}
	jsonData, err := json.Marshal(request)
	if err != nil {
		return AgentChatResult{}, fmt.Errorf("failed to marshal agent stream request: %w", err)
	}
	url := fmt.Sprintf("%s/chat/completions", strings.TrimSuffix(cfg.LLM.BaseURL, "/"))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonData))
	if err != nil {
		return AgentChatResult{}, fmt.Errorf("failed to create agent stream request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if cfg.LLM.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.LLM.APIKey))
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return AgentChatResult{}, fmt.Errorf("agent stream API request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return AgentChatResult{}, fmt.Errorf("agent API returned error status %d: %s", resp.StatusCode, string(body))
	}
	if !strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/event-stream") {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return AgentChatResult{}, fmt.Errorf("failed to read agent response: %w", err)
		}
		var result ChatCompletionResponse
		if err := json.Unmarshal(body, &result); err != nil {
			return AgentChatResult{}, fmt.Errorf("failed to unmarshal agent response: %w", err)
		}
		if result.Error != nil {
			return AgentChatResult{}, fmt.Errorf("agent provider error: %s", result.Error.Message)
		}
		if len(result.Choices) == 0 {
			return AgentChatResult{}, fmt.Errorf("agent provider returned no choices")
		}
		message := result.Choices[0].Message
		content, _ := message.Content.(string)
		if content != "" && onText != nil {
			onText(content)
		}
		return AgentChatResult{Content: content, ToolCalls: message.ToolCalls}, nil
	}

	type streamToolCall struct {
		Index        int             `json:"index"`
		ID           string          `json:"id"`
		Type         string          `json:"type"`
		ExtraContent json.RawMessage `json:"extra_content,omitempty"`
		Function     struct {
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
		} `json:"function"`
	}
	type streamChunk struct {
		Choices []struct {
			Delta struct {
				Content   string           `json:"content"`
				ToolCalls []streamToolCall `json:"tool_calls"`
			} `json:"delta"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	var content strings.Builder
	toolCalls := make([]ToolCall, 0)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 2*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "[DONE]" {
			break
		}
		var chunk streamChunk
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			return AgentChatResult{}, fmt.Errorf("failed to decode agent stream chunk: %w", err)
		}
		if chunk.Error != nil {
			return AgentChatResult{}, fmt.Errorf("agent provider error: %s", chunk.Error.Message)
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		delta := chunk.Choices[0].Delta
		if delta.Content != "" {
			content.WriteString(delta.Content)
			if onText != nil {
				onText(delta.Content)
			}
		}
		for _, streamed := range delta.ToolCalls {
			for len(toolCalls) <= streamed.Index {
				toolCalls = append(toolCalls, ToolCall{})
			}
			toolCall := &toolCalls[streamed.Index]
			if streamed.ID != "" {
				toolCall.ID = streamed.ID
			}
			if streamed.Type != "" {
				toolCall.Type = streamed.Type
			}
			if len(streamed.ExtraContent) > 0 && string(streamed.ExtraContent) != "null" {
				toolCall.ExtraContent = append(toolCall.ExtraContent[:0], streamed.ExtraContent...)
			}
			if streamed.Function.Name != "" {
				toolCall.Function.Name += streamed.Function.Name
			}
			toolCall.Function.Arguments += streamed.Function.Arguments
		}
	}
	if err := scanner.Err(); err != nil {
		return AgentChatResult{}, fmt.Errorf("failed to read agent stream: %w", err)
	}
	return AgentChatResult{Content: content.String(), ToolCalls: toolCalls}, nil
}

// GenerateTextWithImages sends a prompt, context and images to the LLM and returns the generated content
func (s *LLMService) GenerateTextWithImages(prompt string, contextData string, imageDataURLs []string) (string, error) {
	cfg := s.configService.GetConfig()

	systemPrompt := cfg.LLM.SystemPrompt
	if systemPrompt == "" {
		systemPrompt = "You are a helpful assistant that generates documentation in Markdown format. Be concise and professional."
	}
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

	systemPrompt := fmt.Sprintf("Summarize the following text in approximately %d characters or less. Focus on the core message. Return only the summary text. Do not include a character count, labels, quotation marks, or meta commentary.", maxChars)

	messages := []ChatMessage{}
	if cfg.LLM.SystemPrompt != "" {
		messages = append(messages, ChatMessage{Role: "system", Content: cfg.LLM.SystemPrompt})
	}
	messages = append(messages, ChatMessage{Role: "system", Content: systemPrompt})
	messages = append(messages, ChatMessage{Role: "user", Content: text})

	summary, err := s.callChatAPI(cfg, messages)
	if err != nil {
		return "", err
	}
	return sanitizeSummary(summary), nil
}

var summaryCountSuffixPattern = regexp.MustCompile(`(?i)\s*[（(]\s*(?:約|およそ|approximately|approx\.?|about|~)?\s*\d+\s*(?:文字|字|chars?|characters?)(?:程度|以内|くらい|or less)?\s*[）)]\s*[。．.!！]?\s*$`)

func sanitizeSummary(summary string) string {
	original := strings.TrimSpace(summary)
	cleaned := strings.TrimSpace(summaryCountSuffixPattern.ReplaceAllString(original, ""))
	if cleaned == "" {
		return original
	}
	return cleaned
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

	url := fmt.Sprintf("%s/chat/completions", strings.TrimSuffix(cfg.LLM.BaseURL, "/"))
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
