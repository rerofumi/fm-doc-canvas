package backend

import (
	"fmt"
	"strings"
)

// NodeSnapshot is the request-local, non-persistent representation of a Canvas node.
type NodeSnapshot struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	Revision      int64  `json:"revision"`
	Filename      string `json:"filename,omitempty"`
	Markdown      string `json:"markdown,omitempty"`
	ImageRef      string `json:"imageRef,omitempty"`
	Prompt        string `json:"prompt,omitempty"`
	ImageIncluded bool   `json:"imageIncluded,omitempty"`
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

// ChatHistoryMessage is the allowlisted provider-facing transcript entry.
// Only user and assistant messages are accepted; tool/system roles never cross
// the ChatRequest boundary.
type ChatHistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ViewContextHintCluster is the serializable observation for one provisional
// cluster. It is named so Wails can generate a valid TypeScript binding.
type ViewContextHintCluster struct {
	ClusterID     string   `json:"clusterId"`
	Label         string   `json:"label"`
	MemberNodeIDs []string `json:"memberNodeIds"`
}

type ViewContextHint struct {
	ViewID   string                   `json:"viewId"`
	Kind     string                   `json:"kind"`
	Label    string                   `json:"label"`
	Clusters []ViewContextHintCluster `json:"clusters"`
}

type ChatRequest struct {
	RunID                string               `json:"runId"`
	SessionID            string               `json:"sessionId"`
	CanvasID             string               `json:"canvasId"`
	Prompt               string               `json:"prompt"`
	TargetNodeID         string               `json:"targetNodeId,omitempty"`
	DirectContextNodeIDs []string             `json:"directContextNodeIds"`
	BodyAllowlistNodeIDs []string             `json:"bodyAllowlistNodeIds,omitempty"`
	WorkspaceID          string               `json:"workspaceId,omitempty"`
	RuntimeGeneration    string               `json:"runtimeGeneration,omitempty"`
	ScopeEpoch           int64                `json:"scopeEpoch,omitempty"`
	RunEpoch             int64                `json:"runEpoch,omitempty"`
	ContextDigest        string               `json:"contextDigest,omitempty"`
	ImageProvider        string               `json:"imageProvider,omitempty"`
	History              []ChatHistoryMessage `json:"history,omitempty"`
	ContextWarning       *ContextWarning      `json:"contextWarning,omitempty"`
	ViewHints            []ViewContextHint    `json:"viewHints,omitempty"`
	Snapshot             CanvasSnapshot       `json:"snapshot"`
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
	if r.ImageProvider != "" && r.ImageProvider != "openrouter" && r.ImageProvider != "openai" && r.ImageProvider != "google" && r.ImageProvider != "xai" {
		return fmt.Errorf("unsupported image provider %q", r.ImageProvider)
	}
	if _, err := r.normalizedHistory(); err != nil {
		return err
	}
	// F-1 scope fields are optional for legacy callers, but once a caller sends
	// any scope marker the complete correlation envelope must be present.
	hasScope := strings.TrimSpace(r.WorkspaceID) != "" ||
		strings.TrimSpace(r.RuntimeGeneration) != "" ||
		r.ScopeEpoch != 0 || r.RunEpoch != 0 || strings.TrimSpace(r.ContextDigest) != ""
	if hasScope {
		if strings.TrimSpace(r.WorkspaceID) == "" || strings.TrimSpace(r.RuntimeGeneration) == "" {
			return fmt.Errorf("workspaceId and runtimeGeneration are required with scope fields")
		}
		if r.RunEpoch <= 0 {
			return fmt.Errorf("runEpoch must be positive with scope fields")
		}
		if strings.TrimSpace(r.ContextDigest) == "" {
			return fmt.Errorf("contextDigest is required with scope fields")
		}
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
	// Optional F-1 scope fields: when body allowlist is provided it must be a subset of snapshot.
	seenAllow := make(map[string]struct{}, len(r.BodyAllowlistNodeIDs))
	for _, id := range r.BodyAllowlistNodeIDs {
		if _, ok := nodes[id]; !ok {
			return fmt.Errorf("body allowlist node %q is not in snapshot", id)
		}
		if _, exists := seenAllow[id]; exists {
			return fmt.Errorf("body allowlist contains duplicate node %q", id)
		}
		seenAllow[id] = struct{}{}
	}
	// Direct context must not exceed allowlist when allowlist is present.
	if len(r.BodyAllowlistNodeIDs) > 0 {
		for _, id := range r.DirectContextNodeIDs {
			if _, ok := seenAllow[id]; !ok {
				return fmt.Errorf("direct context node %q is outside body allowlist", id)
			}
		}
	}
	return nil
}

// normalizedHistory validates the untrusted history supplied by the frontend.
// Keeping this boundary defensive prevents direct Wails callers from injecting
// system/tool roles or an unbounded transcript into provider calls. Content is
// intentionally copied verbatim: history is a transcript, so normalization
// must not rewrite a prior user or assistant message.
func (r ChatRequest) normalizedHistory() ([]ChatHistoryMessage, error) {
	if len(r.History) > 12 {
		return nil, fmt.Errorf("history exceeds maximum of 12 messages")
	}
	history := make([]ChatHistoryMessage, 0, len(r.History))
	for index, message := range r.History {
		if message.Role != "user" && message.Role != "assistant" {
			return nil, fmt.Errorf("history[%d] has unsupported role %q", index, message.Role)
		}
		if strings.TrimSpace(message.Content) == "" {
			return nil, fmt.Errorf("history[%d] content is required", index)
		}
		history = append(history, ChatHistoryMessage{Role: message.Role, Content: message.Content})
	}
	return history, nil
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
