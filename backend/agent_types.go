package backend

import "encoding/json"

type ToolDefinition struct {
	Type     string          `json:"type"`
	Function ToolFunctionDef `json:"function"`
}

type ToolFunctionDef struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type ToolCall struct {
	ID           string          `json:"id"`
	Type         string          `json:"type"`
	ExtraContent json.RawMessage `json:"extra_content,omitempty"`
	Function     struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type ToolEvent struct {
	ToolCallID string `json:"toolCallId"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	Summary    string `json:"summary,omitempty"`
	Error      string `json:"error,omitempty"`
}

type ToolApplyProposal struct {
	ToolCallID      string `json:"toolCallId"`
	NodeID          string `json:"nodeId,omitempty"`
	TargetNodeID    string `json:"targetNodeId,omitempty"`
	BaseRevision    int64  `json:"baseRevision,omitempty"`
	Operation       string `json:"operation"`
	Filename        string `json:"filename,omitempty"`
	Proposed        string `json:"proposed"`
	SearchText      string `json:"searchText,omitempty"`
	Replacement     string `json:"replacement,omitempty"`
	LastEditSummary string `json:"lastEditSummary,omitempty"`
}

type ToolApplicationResult struct {
	ToolCallID string `json:"toolCallId"`
	Status     string `json:"status"` // applied | conflict | cancelled | error
	Error      string `json:"error,omitempty"`
}

type ChatEvent struct {
	RunID     string             `json:"runId"`
	SessionID string             `json:"sessionId"`
	Type      string             `json:"type"`
	Text      string             `json:"text,omitempty"`
	ToolEvent *ToolEvent         `json:"toolEvent,omitempty"`
	Apply     *ToolApplyProposal `json:"apply,omitempty"`
	Error     string             `json:"error,omitempty"`
}
