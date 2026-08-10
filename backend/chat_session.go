package backend

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// ChatSessionMessage is a persisted chat message. Optional correlation fields are
// retained so a later streaming agent can associate messages with a run.
type ChatSessionMessage struct {
	ID             string `json:"id"`
	Role           string `json:"role"`
	Content        string `json:"content"`
	CreatedAt      int64  `json:"createdAt"`
	RunID          string `json:"runId,omitempty"`
	TargetNodeID   string `json:"targetNodeId,omitempty"`
	TargetRevision int64  `json:"targetRevision,omitempty"`
}

// ChatSession is a persisted conversation belonging to a Canvas.
type ChatSession struct {
	ID        string               `json:"id"`
	Title     string               `json:"title"`
	CreatedAt int64                `json:"createdAt"`
	UpdatedAt int64                `json:"updatedAt"`
	Messages  []ChatSessionMessage `json:"messages"`
}

type chatCanvasSessions struct {
	Sessions []ChatSession `json:"sessions"`
}

type chatSessionFile struct {
	Version  int                           `json:"version"`
	Canvases map[string]chatCanvasSessions `json:"canvases"`
}

// ChatSessionService owns chat-sessions.json and keeps sessions separated by
// the stable Canvas ID rather than the canvas file path.
type ChatSessionService struct {
	path string
	mu   sync.Mutex
}

func NewChatSessionService() (*ChatSessionService, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("could not get user config directory: %w", err)
	}
	appDir := filepath.Join(configDir, "fm-doc-canvas")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return nil, fmt.Errorf("could not create app config directory: %w", err)
	}
	return newChatSessionService(filepath.Join(appDir, "chat-sessions.json")), nil
}

func newChatSessionService(path string) *ChatSessionService {
	return &ChatSessionService{path: path}
}

func (s *ChatSessionService) Load(canvasID string) ([]ChatSession, error) {
	if canvasID == "" {
		return nil, fmt.Errorf("canvas ID is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	file, err := s.read()
	if err != nil {
		return nil, err
	}
	sessions := file.Canvases[canvasID].Sessions
	if sessions == nil {
		return []ChatSession{}, nil
	}
	result := make([]ChatSession, len(sessions))
	copy(result, sessions)
	return result, nil
}

func (s *ChatSessionService) Save(canvasID string, sessions []ChatSession) error {
	if canvasID == "" {
		return fmt.Errorf("canvas ID is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	file, err := s.read()
	if err != nil {
		return err
	}
	file.Canvases[canvasID] = chatCanvasSessions{Sessions: normalizeChatSessions(sessions)}
	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return fmt.Errorf("could not marshal chat sessions: %w", err)
	}
	if err := os.WriteFile(s.path, data, 0644); err != nil {
		return fmt.Errorf("could not write chat sessions: %w", err)
	}
	return nil
}

func (s *ChatSessionService) read() (*chatSessionFile, error) {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return &chatSessionFile{Version: 1, Canvases: make(map[string]chatCanvasSessions)}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("could not read chat sessions: %w", err)
	}
	var raw struct {
		Version  int                        `json:"version"`
		Canvases map[string]json.RawMessage `json:"canvases"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("chat sessions JSON is malformed: %w", err)
	}
	file := &chatSessionFile{
		Version:  raw.Version,
		Canvases: make(map[string]chatCanvasSessions),
	}
	for canvasID, payload := range raw.Canvases {
		var canvas chatCanvasSessions
		if err := json.Unmarshal(payload, &canvas); err != nil {
			// Migrate the temporary Sprint B format where the Canvas value was
			// the sessions array directly instead of {"sessions": [...]}.
			var legacy []ChatSession
			if legacyErr := json.Unmarshal(payload, &legacy); legacyErr != nil {
				return nil, fmt.Errorf("chat sessions JSON is malformed for canvas %q: %w", canvasID, err)
			}
			canvas.Sessions = legacy
		}
		canvas.Sessions = normalizeChatSessions(canvas.Sessions)
		file.Canvases[canvasID] = canvas
	}
	if file.Version == 0 {
		file.Version = 1
	}
	return file, nil
}

func normalizeChatSessions(sessions []ChatSession) []ChatSession {
	if sessions == nil {
		return []ChatSession{}
	}
	result := make([]ChatSession, len(sessions))
	copy(result, sessions)
	for index := range result {
		if result[index].Messages == nil {
			result[index].Messages = []ChatSessionMessage{}
		}
	}
	return result
}
