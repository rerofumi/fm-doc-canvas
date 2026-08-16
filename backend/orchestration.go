package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const MaxOrchestrationNodes = 40

type OrchestrationTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type OrchestrationNodeHint struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Revision int64  `json:"revision"`
	Label    string `json:"label"`
	Summary  string `json:"summary,omitempty"`
	Excerpt  string `json:"excerpt,omitempty"`
}
type OrchestrationRelationHint struct {
	RelationID   string                   `json:"relationId"`
	SourceNodeID string                   `json:"sourceNodeId"`
	TargetNodeID string                   `json:"targetNodeId"`
	Kind         string                   `json:"kind"`
	Reason       string                   `json:"reason,omitempty"`
	Provenance   *OrchestrationProvenance `json:"provenance,omitempty"`
}
type OrchestrationProvenance struct {
	Origin   string `json:"origin"`
	Query    string `json:"query,omitempty"`
	URL      string `json:"url,omitempty"`
	Domain   string `json:"domain,omitempty"`
	Provider string `json:"provider,omitempty"`
	Model    string `json:"model,omitempty"`
}
type OrchestrationViewHint struct {
	ViewID string `json:"viewId"`
	Kind   string `json:"kind"`
	Label  string `json:"label"`
}

type NextActionRequest struct {
	RequestID         string                      `json:"requestId"`
	WorkspaceID       string                      `json:"workspaceId"`
	CanvasID          string                      `json:"canvasId"`
	RuntimeGeneration string                      `json:"runtimeGeneration"`
	ScopeEpoch        int64                       `json:"scopeEpoch"`
	ContextDigest     string                      `json:"contextDigest"`
	FocusText         string                      `json:"focusText,omitempty"`
	DialogueHistory   []OrchestrationTurn         `json:"dialogueHistory,omitempty"`
	SelectedNodeIDs   []string                    `json:"selectedNodeIds"`
	NodeHints         []OrchestrationNodeHint     `json:"nodeHints"`
	RelationHints     []OrchestrationRelationHint `json:"relationHints,omitempty"`
	ViewHints         []OrchestrationViewHint     `json:"viewHints,omitempty"`
	SourceRevisions   map[string]int64            `json:"sourceRevisions"`
}
type NextActionKind string

const (
	ActionClarify          NextActionKind = "clarify"
	ActionCompare          NextActionKind = "compare"
	ActionCounterpoint     NextActionKind = "counterpoint"
	ActionWebSearch        NextActionKind = "web_search"
	ActionSuggestRelations NextActionKind = "suggest_relations"
	ActionSuggestClusters  NextActionKind = "suggest_clusters"
)

type NextActionMapping struct {
	Role           string
	ActionLevel    string
	Route          string
	DocumentEffect string
	Control        string
}

var nextActionMappings = map[NextActionKind]NextActionMapping{
	ActionClarify: {"questioner", "AL-0", "dialogue", "変更なし。質問をDialogueへ置く", "回答または拒否"}, ActionCompare: {"comparer", "AL-2", "direct-transform", "可逆な派生Text。single undo", "取消/undo"}, ActionCounterpoint: {"critic", "AL-2", "direct-transform", "可逆な派生Text。single undo", "取消/undo"}, ActionWebSearch: {"researcher", "AL-2", "direct-web-search", "Context Packet候補。文書変更なし", "dismiss / Promote"}, ActionSuggestRelations: {"organizer", "AL-1", "direct-relation-suggestion", "Proposalのみ。文書変更なし", "Modify / Accept / Reject"}, ActionSuggestClusters: {"organizer", "AL-1", "direct-cluster-suggestion", "Proposalのみ。文書変更なし", "Modify / Accept / Reject / Close"},
}

type NextActionItem struct {
	ID             string         `json:"id"`
	Kind           NextActionKind `json:"kind"`
	Role           string         `json:"role"`
	ActionLevel    string         `json:"actionLevel"`
	Route          string         `json:"route"`
	TargetNodeIDs  []string       `json:"targetNodeIds"`
	Title          string         `json:"title"`
	Reason         string         `json:"reason"`
	ExpectedResult string         `json:"expectedResult"`
	DocumentEffect string         `json:"documentEffect"`
	Control        string         `json:"control"`
	Query          string         `json:"query,omitempty"`
	Question       string         `json:"question,omitempty"`
}
type NextActionProposalSet struct {
	RequestID         string           `json:"requestId"`
	WorkspaceID       string           `json:"workspaceId"`
	CanvasID          string           `json:"canvasId"`
	RuntimeGeneration string           `json:"runtimeGeneration"`
	ScopeEpoch        int64            `json:"scopeEpoch"`
	ContextDigest     string           `json:"contextDigest"`
	SourceRevisions   map[string]int64 `json:"sourceRevisions"`
	Actions           []NextActionItem `json:"actions"`
}

func (r NextActionRequest) Validate() error {
	for name, v := range map[string]string{"requestId": r.RequestID, "workspaceId": r.WorkspaceID, "canvasId": r.CanvasID, "runtimeGeneration": r.RuntimeGeneration, "contextDigest": r.ContextDigest} {
		if strings.TrimSpace(v) == "" {
			return fmt.Errorf("orchestration %s is required", name)
		}
	}
	if len(r.NodeHints) > MaxOrchestrationNodes {
		return fmt.Errorf("orchestration-node-cap-exceeded")
	}
	seen := map[string]bool{}
	byID := map[string]OrchestrationNodeHint{}
	for _, n := range r.NodeHints {
		if strings.TrimSpace(n.ID) == "" || byID[n.ID].ID != "" {
			return fmt.Errorf("invalid node hint")
		}
		if n.Type != "text" && n.Type != "artifact" && n.Type != "image" {
			return fmt.Errorf("unsupported node hint type")
		}
		byID[n.ID] = n
	}
	for _, id := range r.SelectedNodeIDs {
		if seen[id] || byID[id].ID == "" {
			return fmt.Errorf("selected node outside hints: %s", id)
		}
		seen[id] = true
	}
	if len(r.SourceRevisions) != len(r.NodeHints) {
		return fmt.Errorf("source revisions do not match hints")
	}
	for id, n := range byID {
		if r.SourceRevisions[id] != n.Revision {
			return fmt.Errorf("source revision conflict for %s", id)
		}
	}
	return nil
}
func EligibleNextActionKinds(r NextActionRequest) []NextActionKind {
	out := []NextActionKind{ActionClarify}
	text := 0
	nonFolder := 0
	for _, id := range r.SelectedNodeIDs {
		n := findHint(r.NodeHints, id)
		if n.Type == "text" || n.Type == "artifact" {
			text++
		}
		if n.Type != "folder" {
			nonFolder++
		}
	}
	if text >= 2 {
		out = append(out, ActionCompare)
	}
	if text >= 1 {
		out = append(out, ActionCounterpoint)
	}
	// A canvas-wide orchestration request may have bounded text hints while
	// selection and focus are intentionally empty. It can seed a query, but it
	// must never turn those hints into implicit execution targets.
	hasTextHint := false
	for _, n := range r.NodeHints {
		if n.Type == "text" || n.Type == "artifact" {
			hasTextHint = true
			break
		}
	}
	if strings.TrimSpace(r.FocusText) != "" || len(r.DialogueHistory) > 0 || len(r.SelectedNodeIDs) > 0 || hasTextHint {
		out = append(out, ActionWebSearch)
	}
	if nonFolder >= 2 {
		out = append(out, ActionSuggestRelations, ActionSuggestClusters)
	}
	return out
}
func findHint(h []OrchestrationNodeHint, id string) OrchestrationNodeHint {
	for _, n := range h {
		if n.ID == id {
			return n
		}
	}
	return OrchestrationNodeHint{}
}
func BuildNextActionPrompt(r NextActionRequest, eligible []NextActionKind) string {
	b, _ := json.Marshal(struct {
		Focus     string                      `json:"focusText,omitempty"`
		History   []OrchestrationTurn         `json:"dialogueHistory,omitempty"`
		Selected  []string                    `json:"selectedNodeIds"`
		Nodes     []OrchestrationNodeHint     `json:"nodeHints"`
		Relations []OrchestrationRelationHint `json:"relationHints,omitempty"`
		Views     []OrchestrationViewHint     `json:"viewHints,omitempty"`
		Eligible  []NextActionKind            `json:"availableKinds"`
	}{r.FocusText, r.DialogueHistory, r.SelectedNodeIDs, r.NodeHints, r.RelationHints, r.ViewHints, eligible})
	contract := "Read-only planner: do not execute actions, mutate Workspace, or add Dialogue messages. Return JSON only with 1-3 actions. Use available kinds only, selected IDs only for targeted actions, and no duplicate kinds. Kind requirements: clarify requires targetNodeIds=[] and one concrete question; compare requires 2 or more selected text/artifact IDs; counterpoint requires at least 1 selected text/artifact ID; web_search requires targetNodeIds=[] and a non-empty query derived from focus, dialogue, or bounded text hints; suggest_relations and suggest_clusters each require at least 2 selected non-folder IDs. When selectedNodeIds is empty, only clarify or targetless web_search may be returned; never invent execution targets from nodeHints. If information is insufficient, return one concrete clarify question. Do not return generic menus or provider/model recommendations."
	return contract + " JSON schema: {\"actions\":[{\"kind\":\"...\",\"targetNodeIds\":[],\"title\":\"...\",\"reason\":\"...\",\"expectedResult\":\"...\",\"query\":\"\",\"question\":\"\"}]}.\n" + string(b)
}
func ParseNextActions(raw string, r NextActionRequest, eligible []NextActionKind) (NextActionProposalSet, error) {
	var draft struct {
		Actions []struct {
			Kind     NextActionKind `json:"kind"`
			Target   []string       `json:"targetNodeIds"`
			Title    string         `json:"title"`
			Reason   string         `json:"reason"`
			Expected string         `json:"expectedResult"`
			Query    string         `json:"query"`
			Question string         `json:"question"`
		} `json:"actions"`
	}
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&draft); err != nil {
		return NextActionProposalSet{}, fmt.Errorf("next-actions-invalid-json")
	}
	var trailing interface{}
	if err := decoder.Decode(&trailing); err != io.EOF {
		return NextActionProposalSet{}, fmt.Errorf("next-actions-invalid-json")
	}
	if len(draft.Actions) < 1 || len(draft.Actions) > 3 {
		return NextActionProposalSet{}, fmt.Errorf("next-actions-count-invalid")
	}
	allowed := map[NextActionKind]bool{}
	for _, k := range eligible {
		allowed[k] = true
	}
	seenKinds := map[NextActionKind]bool{}
	selected := map[string]bool{}
	hints := map[string]OrchestrationNodeHint{}
	for _, hint := range r.NodeHints {
		hints[hint.ID] = hint
	}
	for _, id := range r.SelectedNodeIDs {
		selected[id] = true
	}
	out := make([]NextActionItem, 0, len(draft.Actions))
	for i, a := range draft.Actions {
		m, ok := nextActionMappings[a.Kind]
		if !ok || !allowed[a.Kind] || seenKinds[a.Kind] {
			return NextActionProposalSet{}, fmt.Errorf("next-actions-kind-invalid")
		}
		seenKinds[a.Kind] = true
		if strings.TrimSpace(a.Title) == "" || strings.TrimSpace(a.Reason) == "" || strings.TrimSpace(a.Expected) == "" {
			return NextActionProposalSet{}, fmt.Errorf("next-actions-text-invalid")
		}
		if len([]rune(a.Title)) > 160 || len([]rune(a.Reason)) > 600 || len([]rune(a.Expected)) > 600 || len([]rune(a.Query)) > 500 || len([]rune(a.Question)) > 500 {
			return NextActionProposalSet{}, fmt.Errorf("next-actions-text-too-long")
		}
		if a.Kind == ActionClarify {
			if len(a.Target) != 0 {
				return NextActionProposalSet{}, fmt.Errorf("clarify-target-invalid")
			}
			if strings.TrimSpace(a.Question) == "" {
				return NextActionProposalSet{}, fmt.Errorf("clarify-question-required")
			}
			if strings.TrimSpace(a.Query) != "" {
				return NextActionProposalSet{}, fmt.Errorf("clarify-query-invalid")
			}
		} else if a.Kind == ActionWebSearch {
			if len(a.Target) != 0 {
				return NextActionProposalSet{}, fmt.Errorf("web-search-target-invalid")
			}
			if strings.TrimSpace(a.Query) == "" {
				return NextActionProposalSet{}, fmt.Errorf("search-query-required")
			}
			if strings.TrimSpace(a.Question) != "" {
				return NextActionProposalSet{}, fmt.Errorf("web-search-question-invalid")
			}
		} else {
			if strings.TrimSpace(a.Query) != "" || strings.TrimSpace(a.Question) != "" {
				return NextActionProposalSet{}, fmt.Errorf("targeted-action-shape-invalid")
			}
			min := 1
			if a.Kind == ActionCompare || a.Kind == ActionSuggestRelations || a.Kind == ActionSuggestClusters {
				min = 2
			}
			if len(a.Target) < min {
				return NextActionProposalSet{}, fmt.Errorf("next-actions-arity-invalid")
			}
			seenTargets := map[string]bool{}
			for _, id := range a.Target {
				if seenTargets[id] {
					return NextActionProposalSet{}, fmt.Errorf("next-actions-target-duplicate")
				}
				seenTargets[id] = true
				if !selected[id] {
					return NextActionProposalSet{}, fmt.Errorf("next-actions-target-invalid")
				}
				hint := hints[id]
				if !actionTargetTypeAllowed(a.Kind, hint.Type) {
					return NextActionProposalSet{}, fmt.Errorf("next-actions-target-type-invalid")
				}
			}
		}
		targets := append([]string{}, a.Target...)
		out = append(out, NextActionItem{ID: fmt.Sprintf("action-%d", i+1), Kind: a.Kind, Role: m.Role, ActionLevel: m.ActionLevel, Route: m.Route, TargetNodeIDs: targets, Title: strings.TrimSpace(a.Title), Reason: strings.TrimSpace(a.Reason), ExpectedResult: strings.TrimSpace(a.Expected), DocumentEffect: m.DocumentEffect, Control: m.Control, Query: strings.TrimSpace(a.Query), Question: strings.TrimSpace(a.Question)})
	}
	revisions := make(map[string]int64, len(r.SourceRevisions))
	for id, rev := range r.SourceRevisions {
		revisions[id] = rev
	}
	return NextActionProposalSet{RequestID: r.RequestID, WorkspaceID: r.WorkspaceID, CanvasID: r.CanvasID, RuntimeGeneration: r.RuntimeGeneration, ScopeEpoch: r.ScopeEpoch, ContextDigest: r.ContextDigest, SourceRevisions: revisions, Actions: out}, nil
}

func actionTargetTypeAllowed(kind NextActionKind, nodeType string) bool {
	switch kind {
	case ActionCompare, ActionCounterpoint:
		return nodeType == "text" || nodeType == "artifact"
	case ActionSuggestRelations, ActionSuggestClusters:
		return nodeType == "text" || nodeType == "artifact" || nodeType == "image"
	default:
		return false
	}
}
