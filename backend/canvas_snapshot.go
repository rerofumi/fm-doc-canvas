package backend

import (
	"fmt"
	"strings"
)

// NodeSnapshot is the request-local, non-persistent representation of a Canvas node.
type NodeSnapshot struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Revision int64  `json:"revision"`
	Filename string `json:"filename,omitempty"`
	Markdown string `json:"markdown,omitempty"`
	ImageRef string `json:"imageRef,omitempty"`
	Prompt   string `json:"prompt,omitempty"`
}

type EdgeSnapshot struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type CanvasSnapshot struct {
	CanvasID string         `json:"canvasId"`
	Nodes    []NodeSnapshot `json:"nodes"`
	Edges    []EdgeSnapshot `json:"edges"`
}

type ChatRequest struct {
	RunID                string          `json:"runId"`
	SessionID            string          `json:"sessionId"`
	CanvasID             string          `json:"canvasId"`
	Prompt               string          `json:"prompt"`
	TargetNodeID         string          `json:"targetNodeId,omitempty"`
	DirectContextNodeIDs []string        `json:"directContextNodeIds"`
	ContextWarning       *ContextWarning `json:"contextWarning,omitempty"`
	Snapshot             CanvasSnapshot  `json:"snapshot"`
}

type ContextWarning struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

func (r ChatRequest) validate() error {
	if strings.TrimSpace(r.RunID) == "" || strings.TrimSpace(r.SessionID) == "" {
		return fmt.Errorf("runId and sessionId are required")
	}
	if strings.TrimSpace(r.CanvasID) == "" || strings.TrimSpace(r.Snapshot.CanvasID) == "" {
		return fmt.Errorf("canvasId is required")
	}
	if r.CanvasID != r.Snapshot.CanvasID {
		return fmt.Errorf("request canvasId does not match snapshot")
	}
	if strings.TrimSpace(r.Prompt) == "" {
		return fmt.Errorf("prompt is required")
	}

	nodes := make(map[string]NodeSnapshot, len(r.Snapshot.Nodes))
	for _, node := range r.Snapshot.Nodes {
		if strings.TrimSpace(node.ID) == "" {
			return fmt.Errorf("snapshot contains a node without id")
		}
		if node.Type != "text" && node.Type != "artifact" && node.Type != "image" {
			return fmt.Errorf("snapshot node %q has unsupported type %q", node.ID, node.Type)
		}
		if _, exists := nodes[node.ID]; exists {
			return fmt.Errorf("snapshot contains duplicate node %q", node.ID)
		}
		nodes[node.ID] = node
	}
	for _, edge := range r.Snapshot.Edges {
		if _, ok := nodes[edge.Source]; !ok {
			return fmt.Errorf("edge source %q is not in snapshot", edge.Source)
		}
		if _, ok := nodes[edge.Target]; !ok {
			return fmt.Errorf("edge target %q is not in snapshot", edge.Target)
		}
	}
	seenDirect := make(map[string]struct{}, len(r.DirectContextNodeIDs))
	for _, id := range r.DirectContextNodeIDs {
		if _, ok := nodes[id]; !ok {
			return fmt.Errorf("direct context node %q is not in snapshot", id)
		}
		if _, exists := seenDirect[id]; exists {
			return fmt.Errorf("direct context contains duplicate node %q", id)
		}
		seenDirect[id] = struct{}{}
	}
	if r.TargetNodeID != "" {
		if _, ok := nodes[r.TargetNodeID]; !ok {
			return fmt.Errorf("target node %q is not in snapshot", r.TargetNodeID)
		}
		if len(r.DirectContextNodeIDs) == 0 || r.DirectContextNodeIDs[len(r.DirectContextNodeIDs)-1] != r.TargetNodeID {
			return fmt.Errorf("target node must be the last direct context node")
		}
	}
	if r.ContextWarning != nil && r.ContextWarning.Kind != "branch" && r.ContextWarning.Kind != "loop" {
		return fmt.Errorf("unsupported context warning kind %q", r.ContextWarning.Kind)
	}
	return nil
}

func (s CanvasSnapshot) node(id string) (NodeSnapshot, bool) {
	for _, node := range s.Nodes {
		if node.ID == id {
			return node, true
		}
	}
	return NodeSnapshot{}, false
}

func (s CanvasSnapshot) directContext(ids []string) string {
	sections := make([]string, 0, len(ids))
	for _, id := range ids {
		node, ok := s.node(id)
		if !ok {
			continue
		}
		var body string
		switch node.Type {
		case "image":
			body = fmt.Sprintf("imageRef=%s\nprompt=%s", node.ImageRef, node.Prompt)
		default:
			body = node.Markdown
		}
		sections = append(sections, fmt.Sprintf("Node %s (%s, revision %d):\n%s", node.ID, node.Type, node.Revision, body))
	}
	return strings.Join(sections, "\n\n")
}
