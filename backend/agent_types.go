package backend

import (
	"encoding/json"
	"fmt"
)

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
	ToolCallID        string             `json:"toolCallId"`
	NodeID            string             `json:"nodeId,omitempty"`
	TargetNodeID      string             `json:"targetNodeId,omitempty"`
	BaseRevision      int64              `json:"baseRevision,omitempty"`
	Operation         string             `json:"operation"`
	Filename          string             `json:"filename,omitempty"`
	Proposed          string             `json:"proposed"`
	SearchText        string             `json:"searchText,omitempty"`
	Replacement       string             `json:"replacement,omitempty"`
	LastEditSummary   string             `json:"lastEditSummary,omitempty"`
	WorkspaceID       string             `json:"workspaceId,omitempty"`
	CanvasID          string             `json:"canvasId,omitempty"`
	RuntimeGeneration string             `json:"runtimeGeneration,omitempty"`
	ScopeEpoch        int64              `json:"scopeEpoch,omitempty"`
	RunEpoch          int64              `json:"runEpoch,omitempty"`
	Transform         *TransformProposal `json:"transform,omitempty"`
	Relation          *RelationProposal  `json:"relation,omitempty"`
}

type TransformRelationProposal struct {
	SourceNodeID string `json:"sourceNodeId"`
	TargetNodeID string `json:"targetNodeId,omitempty"`
	Kind         string `json:"kind"`
	Reason       string `json:"reason,omitempty"`
	Direction    string `json:"direction,omitempty"`
}

type RelationProposal struct {
	SourceNodeID    string           `json:"sourceNodeId"`
	TargetNodeID    string           `json:"targetNodeId"`
	Kind            string           `json:"kind"`
	Reason          string           `json:"reason,omitempty"`
	Direction       string           `json:"direction,omitempty"`
	SourceRevisions map[string]int64 `json:"sourceRevisions,omitempty"`
}

type TransformSourcePreview struct {
	NodeID   string `json:"nodeId"`
	Content  string `json:"content"`
	Revision int64  `json:"revision"`
}

type TransformProposal struct {
	Operation          string                      `json:"operation"`
	SourceNodeIDs      []string                    `json:"sourceNodeIds"`
	SourceRevisions    map[string]int64            `json:"sourceRevisions"`
	Content            string                      `json:"content"`
	Summary            string                      `json:"summary"`
	Reason             string                      `json:"reason,omitempty"`
	SuggestedRelations []TransformRelationProposal `json:"suggestedRelations,omitempty"`
	Sources            []TransformSourcePreview    `json:"sources,omitempty"`
	// Request correlation echoed for frontend revalidation of late Direct results.
	WorkspaceID       string `json:"workspaceId,omitempty"`
	CanvasID          string `json:"canvasId,omitempty"`
	RuntimeGeneration string `json:"runtimeGeneration,omitempty"`
	ScopeEpoch        int64  `json:"scopeEpoch,omitempty"`
}

type DirectTransformRequest struct {
	Operation         string           `json:"operation"`
	SourceNodeIDs     []string         `json:"sourceNodeIds"`
	SourceRevisions   map[string]int64 `json:"sourceRevisions"`
	WorkspaceID       string           `json:"workspaceId"`
	CanvasID          string           `json:"canvasId"`
	RuntimeGeneration string           `json:"runtimeGeneration"`
	ScopeEpoch        int64            `json:"scopeEpoch"`
	ContextDigest     string           `json:"contextDigest"`
	SourceNodes       []NodeSnapshot   `json:"sourceNodes"`
}

// AllowlistedSourceNodes returns source bodies ordered by SourceNodeIDs after Validate.
// Callers must Validate first so ID sets and revisions already match.
func (r DirectTransformRequest) AllowlistedSourceNodes() ([]NodeSnapshot, error) {
	byID := make(map[string]NodeSnapshot, len(r.SourceNodes))
	for _, node := range r.SourceNodes {
		byID[node.ID] = node
	}
	ordered := make([]NodeSnapshot, 0, len(r.SourceNodeIDs))
	for _, id := range r.SourceNodeIDs {
		node, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("source node body missing for %q", id)
		}
		ordered = append(ordered, node)
	}
	return ordered, nil
}

func (r DirectTransformRequest) Validate(snapshot CanvasSnapshot) error {
	if r.WorkspaceID == "" || r.CanvasID == "" || r.RuntimeGeneration == "" || r.ContextDigest == "" {
		return fmt.Errorf("direct transform scope correlation is incomplete")
	}
	if r.Operation != "summarize" && r.Operation != "compare" && r.Operation != "counterpoint" {
		return fmt.Errorf("unsupported operation %q", r.Operation)
	}
	minimum := 1
	if r.Operation == "compare" {
		minimum = 2
	}
	if len(r.SourceNodeIDs) < minimum {
		return fmt.Errorf("invalid source arity")
	}

	seenIDs := map[string]bool{}
	for _, id := range r.SourceNodeIDs {
		if seenIDs[id] {
			return fmt.Errorf("duplicate source node %q", id)
		}
		seenIDs[id] = true
	}

	// sourceNodes ID set must exactly match sourceNodeIds (no extras, no missing, no dups).
	bodyByID := map[string]NodeSnapshot{}
	for _, node := range r.SourceNodes {
		if node.ID == "" {
			return fmt.Errorf("source node body missing id")
		}
		if _, exists := bodyByID[node.ID]; exists {
			return fmt.Errorf("duplicate source node body %q", node.ID)
		}
		if !seenIDs[node.ID] {
			return fmt.Errorf("extra source node body %q", node.ID)
		}
		if node.Type != "text" && node.Type != "artifact" {
			return fmt.Errorf("source %q is not text-bearing", node.ID)
		}
		bodyByID[node.ID] = node
	}
	if len(bodyByID) != len(r.SourceNodeIDs) {
		return fmt.Errorf("sourceNodes set does not match sourceNodeIds")
	}
	for _, id := range r.SourceNodeIDs {
		if _, ok := bodyByID[id]; !ok {
			return fmt.Errorf("source node body missing for %q", id)
		}
	}

	// sourceRevisions key set must exactly match source IDs.
	if len(r.SourceRevisions) != len(r.SourceNodeIDs) {
		return fmt.Errorf("sourceRevisions set does not match sourceNodeIds")
	}
	for id := range r.SourceRevisions {
		if !seenIDs[id] {
			return fmt.Errorf("extra source revision %q", id)
		}
	}

	for _, id := range r.SourceNodeIDs {
		// Prefer allowlisted request body; snapshot must also contain the same node.
		body := bodyByID[id]
		snap, ok := snapshot.node(id)
		if !ok || (snap.Type != "text" && snap.Type != "artifact") {
			return fmt.Errorf("source %q is not text-bearing", id)
		}
		revision, ok := r.SourceRevisions[id]
		if !ok {
			return fmt.Errorf("source revision missing for %q", id)
		}
		if revision != body.Revision {
			return fmt.Errorf("source revision conflict for %q", id)
		}
		if revision != snap.Revision {
			return fmt.Errorf("source revision conflict for %q", id)
		}
	}
	return nil
}

type ToolApplicationResult struct {
	ToolCallID        string `json:"toolCallId"`
	Status            string `json:"status"` // applied | conflict | cancelled | error
	Error             string `json:"error,omitempty"`
	WorkspaceID       string `json:"workspaceId,omitempty"`
	CanvasID          string `json:"canvasId,omitempty"`
	RuntimeGeneration string `json:"runtimeGeneration,omitempty"`
	ScopeEpoch        int64  `json:"scopeEpoch,omitempty"`
	RunEpoch          int64  `json:"runEpoch,omitempty"`
}

type ChatEvent struct {
	RunID     string             `json:"runId"`
	SessionID string             `json:"sessionId"`
	Type      string             `json:"type"`
	Text      string             `json:"text,omitempty"`
	ToolEvent *ToolEvent         `json:"toolEvent,omitempty"`
	Apply     *ToolApplyProposal `json:"apply,omitempty"`
	Packet    *ContextPacket     `json:"packet,omitempty"`
	Error     string             `json:"error,omitempty"`
}
