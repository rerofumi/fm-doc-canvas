package backend

import (
	"bytes"
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
	ID             string               `json:"id"`
	Title          string               `json:"title"`
	IsDefaultTitle bool                 `json:"isDefaultTitle"`
	CreatedAt      int64                `json:"createdAt"`
	UpdatedAt      int64                `json:"updatedAt"`
	Messages       []ChatSessionMessage `json:"messages"`
}

const newChatSessionTitle = "新しい会話"

// UnmarshalJSON keeps the public model simple while allowing migration to
// distinguish an omitted legacy marker from an explicit false marker.
func (s *ChatSession) UnmarshalJSON(data []byte) error {
	type sessionAlias ChatSession
	var decoded sessionAlias
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&decoded); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	*s = ChatSession(decoded)
	if _, present := fields["isDefaultTitle"]; !present && s.Title == newChatSessionTitle {
		s.IsDefaultTitle = true
	}
	return nil
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
	return NewChatSessionServiceAt(filepath.Join(appDir, "chat-sessions.json")), nil
}

// NewChatSessionServiceAt creates a session store at an explicit path. It is
// used by isolated runtimes (such as E2E) to keep persistence inside their
// temporary workspace while retaining the same binding/service path.
func NewChatSessionServiceAt(path string) *ChatSessionService {
	return newChatSessionService(path)
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
	// Write and replace as one filesystem operation. A renderer crash or a
	// concurrent load must never leave a truncated chat-sessions.json behind.
	tmp, err := os.CreateTemp(filepath.Dir(s.path), filepath.Base(s.path)+".tmp-*")
	if err != nil {
		return fmt.Errorf("could not create chat sessions temp file: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := tmp.Chmod(0644); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("could not set chat sessions temp permissions: %w", err)
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("could not write chat sessions temp file: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("could not sync chat sessions temp file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("could not close chat sessions temp file: %w", err)
	}
	if err := os.Rename(tmpPath, s.path); err != nil {
		return fmt.Errorf("could not replace chat sessions: %w", err)
	}
	return nil
}

// ReadRawJSON returns the backing file for E2E evidence. Callers must keep this
// limited to the isolated E2E composition root; production UI code loads typed
// sessions through Load instead.
func (s *ChatSessionService) ReadRawJSON() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.path)
	if err != nil {
		return "", fmt.Errorf("could not read chat sessions: %w", err)
	}
	return string(data), nil
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
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&raw); err != nil {
		return nil, fmt.Errorf("chat sessions JSON is malformed: %w", err)
	}
	if raw.Version > 1 {
		return nil, fmt.Errorf("chat sessions version %d is newer than supported version 1", raw.Version)
	}
	file := &chatSessionFile{
		Version:  raw.Version,
		Canvases: make(map[string]chatCanvasSessions),
	}
	if raw.Canvases == nil {
		raw.Canvases = map[string]json.RawMessage{}
	}
	for canvasID, payload := range raw.Canvases {
		var canvas chatCanvasSessions
		canvasDecoder := json.NewDecoder(bytes.NewReader(payload))
		canvasDecoder.DisallowUnknownFields()
		if err := canvasDecoder.Decode(&canvas); err != nil {
			// Migrate the temporary Sprint B format where the Canvas value was
			// the sessions array directly instead of {"sessions": [...]}.
			var legacy []ChatSession
			legacyDecoder := json.NewDecoder(bytes.NewReader(payload))
			legacyDecoder.DisallowUnknownFields()
			if legacyErr := legacyDecoder.Decode(&legacy); legacyErr != nil {
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
