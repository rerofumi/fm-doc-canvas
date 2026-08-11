package backend

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type chatRun struct {
	cancel context.CancelFunc
	ctx    context.Context
}

type pendingToolApplication struct {
	runID     string
	sessionID string
	proposal  *ToolApplyProposal
	result    chan ToolApplicationResult
}

// ChatService owns run cancellation and the Frontend acknowledgment handshake.
type ChatService struct {
	llm                *LLMService
	mu                 sync.Mutex
	runs               map[string]*chatRun
	sessions           map[string]string
	pending            map[string]*pendingToolApplication
	emit               func(ChatEvent)
	applicationTimeout time.Duration
}

func NewChatService(llm *LLMService) *ChatService {
	// applicationTimeout=0 means wait indefinitely for human decision (F-1).
	// Technical cancel still happens via Cancel/context.
	return &ChatService{llm: llm, runs: map[string]*chatRun{}, sessions: map[string]string{}, pending: map[string]*pendingToolApplication{}, emit: func(ChatEvent) {}, applicationTimeout: 0}
}

func (s *ChatService) SetEmitter(emit func(ChatEvent)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if emit == nil {
		s.emit = func(ChatEvent) {}
	} else {
		s.emit = emit
	}
}

func (s *ChatService) Send(req ChatRequest) error {
	if err := req.validate(); err != nil {
		return err
	}
	s.mu.Lock()
	if _, exists := s.runs[req.RunID]; exists {
		s.mu.Unlock()
		return fmt.Errorf("run %q is already active", req.RunID)
	}
	if previous, exists := s.sessions[req.SessionID]; exists {
		s.mu.Unlock()
		return fmt.Errorf("session %q already has active run %q", req.SessionID, previous)
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.runs[req.RunID] = &chatRun{cancel: cancel, ctx: ctx}
	s.sessions[req.SessionID] = req.RunID
	s.mu.Unlock()
	go s.execute(req, ctx)
	return nil
}

func (s *ChatService) execute(req ChatRequest, ctx context.Context) {
	err := runAgent(ctx, s.llm, req, s.emitEvent, func(waitCtx context.Context, proposal *ToolApplyProposal) ToolApplicationResult {
		return s.waitForApplication(waitCtx, req, proposal)
	})
	s.mu.Lock()
	delete(s.runs, req.RunID)
	if s.sessions[req.SessionID] == req.RunID {
		delete(s.sessions, req.SessionID)
	}
	s.mu.Unlock()
	terminal := "done"
	if err != nil {
		if ctx.Err() != nil {
			terminal = "cancelled"
		} else {
			terminal = "error"
		}
	}
	event := ChatEvent{RunID: req.RunID, SessionID: req.SessionID, Type: "chat:" + terminal}
	if err != nil && terminal == "error" {
		event.Error = err.Error()
	}
	s.emitEvent(event)
}

func (s *ChatService) emitEvent(event ChatEvent) {
	s.mu.Lock()
	emit := s.emit
	s.mu.Unlock()
	emit(event)
}

func (s *ChatService) waitForApplication(ctx context.Context, req ChatRequest, proposal *ToolApplyProposal) ToolApplicationResult {
	pending := &pendingToolApplication{runID: req.RunID, sessionID: req.SessionID, proposal: proposal, result: make(chan ToolApplicationResult, 1)}
	s.mu.Lock()
	if _, exists := s.pending[proposal.ToolCallID]; exists {
		s.mu.Unlock()
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "error", Error: "tool application correlation already exists"}
	}
	s.pending[proposal.ToolCallID] = pending
	s.mu.Unlock()
s.emitEvent(ChatEvent{RunID: req.RunID, SessionID: req.SessionID, Type: "chat:tool_apply", Apply: proposal})
	defer func() { s.mu.Lock(); delete(s.pending, proposal.ToolCallID); s.mu.Unlock() }()
	if s.applicationTimeout <= 0 {
		select {
		case result := <-pending.result:
			return result
		case <-ctx.Done():
			return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "cancelled"}
		}
	}
	timer := time.NewTimer(s.applicationTimeout)
	defer timer.Stop()
	select {
	case result := <-pending.result:
		return result
	case <-ctx.Done():
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "cancelled"}
	case <-timer.C:
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "error", Error: "Canvas mutation acknowledgment timed out"}
	}
}

func (s *ChatService) Cancel(runID string) error {
	s.mu.Lock()
	run, ok := s.runs[runID]
	if !ok {
		s.mu.Unlock()
		return nil
	}
	run.cancel()
	for toolCallID, pending := range s.pending {
		if pending.runID == runID {
			pending.result <- ToolApplicationResult{ToolCallID: toolCallID, Status: "cancelled"}
			delete(s.pending, toolCallID)
		}
	}
	s.mu.Unlock()
	return nil
}

func (s *ChatService) Resolve(result ToolApplicationResult) error {
	if result.ToolCallID == "" {
		return fmt.Errorf("toolCallId is required")
	}
	s.mu.Lock()
	pending, ok := s.pending[result.ToolCallID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("tool application %q is not pending", result.ToolCallID)
	}
	if result.Status != "applied" && result.Status != "conflict" && result.Status != "cancelled" && result.Status != "error" {
		s.mu.Unlock()
		return fmt.Errorf("invalid tool application status %q", result.Status)
	}
	if pending.proposal.WorkspaceID != "" &&
		(result.WorkspaceID != pending.proposal.WorkspaceID ||
			result.CanvasID != pending.proposal.CanvasID ||
			result.RuntimeGeneration != pending.proposal.RuntimeGeneration ||
			result.ScopeEpoch != pending.proposal.ScopeEpoch ||
			result.RunEpoch != pending.proposal.RunEpoch) {
		return fmt.Errorf("tool application %q scope correlation mismatch", result.ToolCallID)
	}
	delete(s.pending, result.ToolCallID)
	pending.result <- result
	s.mu.Unlock()
	return nil
}
