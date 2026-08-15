package backend

import (
	"context"
	"strings"
	"testing"
)

// f5State builds an agentRunState whose snapshot has three readable nodes.
func f5State() *agentRunState {
	request := ChatRequest{
		RunID: "run-1", SessionID: "session-1", CanvasID: "canvas-1", Prompt: "fixture:relation-batch",
		WorkspaceID: "ws-1", RuntimeGeneration: "gen-1", ScopeEpoch: 1, RunEpoch: 1, ContextDigest: "digest",
		Snapshot: CanvasSnapshot{CanvasID: "canvas-1", Nodes: []NodeSnapshot{
			{ID: "text-1", Type: "text", Revision: 2, Markdown: "alpha"},
			{ID: "artifact-1", Type: "artifact", Revision: 3, Filename: "a.md", Markdown: "beta"},
			{ID: "text-2", Type: "text", Revision: 1, Markdown: "gamma"},
		}},
	}
	state := &agentRunState{
		request:   request,
		readRevs:  map[string]int64{},
		readNodes: map[string]NodeSnapshot{},
	}
	for _, node := range request.Snapshot.Nodes {
		state.readRevs[node.ID] = node.Revision
		state.readNodes[node.ID] = node
	}
	return state
}

func f5Approve(proposal **ToolApplyProposal, status string) func(context.Context, *ToolApplyProposal) ToolApplicationResult {
	return func(_ context.Context, value *ToolApplyProposal) ToolApplicationResult {
		*proposal = value
		return ToolApplicationResult{ToolCallID: value.ToolCallID, Status: status}
	}
}

// REQ-02/REQ-03: propose_relation_batch emits a single non-mutating proposal.
func TestProposeRelationBatchEmitsSingleProposal(t *testing.T) {
	state := f5State()
	var approved *ToolApplyProposal
	state.approve = f5Approve(&approved, "applied")
	call := ToolCall{ID: "batch-1"}
	call.Function.Name = "propose_relation_batch"
	call.Function.Arguments = `{"relations":[{"source_node_id":"text-1","target_node_id":"artifact-1","kind":"supports","reason":"evidence","direction":"forward"},{"source_node_id":"artifact-1","target_node_id":"text-2","kind":"similar","reason":"shared axis","direction":"forward"}]}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "applied" {
		t.Fatalf("expected applied, got %#v", result)
	}
	if approved == nil || approved.Operation != "relation-batch" || approved.RelationBatch == nil {
		t.Fatalf("expected relation-batch proposal, got %#v", approved)
	}
	if len(approved.RelationBatch.Relations) != 2 {
		t.Fatalf("expected 2 relations, got %v", approved.RelationBatch.Relations)
	}
	if approved.RelationBatch.SourceRevisions["text-1"] != 2 {
		t.Fatalf("unexpected revision %v", approved.RelationBatch.SourceRevisions)
	}
}

// REQ-02: self / missing endpoint / invalid kind / duplicate in a batch are all
// atomic validation errors (no proposal is emitted).
func TestProposeRelationBatchValidationErrors(t *testing.T) {
	cases := []struct {
		name string
		args string
		want string
	}{
		{"self-relation", `{"relations":[{"source_node_id":"text-1","target_node_id":"text-1","kind":"supports"}]}`, "self-relation"},
		{"missing-endpoint", `{"relations":[{"source_node_id":"text-1","target_node_id":"missing","kind":"supports"}]}`, "read_canvas_node must succeed"},
		{"invalid-kind", `{"relations":[{"source_node_id":"text-1","target_node_id":"artifact-1","kind":"bogus"}]}`, "invalid relation kind"},
		{"duplicate-batch", `{"relations":[{"source_node_id":"text-1","target_node_id":"artifact-1","kind":"supports"},{"source_node_id":"text-1","target_node_id":"artifact-1","kind":"supports"}]}`, "duplicate relation in batch"},
		{"empty", `{"relations":[]}`, "relations is required"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			state := f5State()
			approved := false
			state.approve = func(context.Context, *ToolApplyProposal) ToolApplicationResult {
				approved = true
				return ToolApplicationResult{Status: "applied"}
			}
			call := ToolCall{ID: "batch-" + tc.name}
			call.Function.Name = "propose_relation_batch"
			call.Function.Arguments = tc.args
			result := executeTool(context.Background(), state, call)
			if result.Status != "error" || !strings.Contains(result.Content, tc.want) {
				t.Fatalf("expected error containing %q, got %#v", tc.want, result)
			}
			if approved {
				t.Fatal("validation error must not emit a proposal")
			}
		})
	}
}

// REQ-02: relation batch cap (8) is enforced.
func TestProposeRelationBatchCapExceeded(t *testing.T) {
	state := f5State()
	items := make([]string, 0, MaxRelationBatch+1)
	for i := 0; i < MaxRelationBatch+1; i++ {
		items = append(items, `{"source_node_id":"text-1","target_node_id":"artifact-1","kind":"supports"}`)
	}
	call := ToolCall{ID: "batch-cap"}
	call.Function.Name = "propose_relation_batch"
	call.Function.Arguments = `{"relations":[` + strings.Join(items, ",") + `]}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "error" || result.Content != "relation-batch-cap-exceeded" {
		t.Fatalf("expected relation-batch-cap-exceeded, got %#v", result)
	}
}

// REQ-06: propose_cluster_view emits a proposal with clusters + revisions and no
// document mutation.
func TestProposeClusterViewEmitsProposal(t *testing.T) {
	state := f5State()
	var approved *ToolApplyProposal
	state.approve = f5Approve(&approved, "applied")
	call := ToolCall{ID: "view-1"}
	call.Function.Name = "propose_cluster_view"
	call.Function.Arguments = `{"label":"Two threads","clusters":[{"label":"A","reason":"r1","node_ids":["text-1","artifact-1"]},{"label":"B","reason":"r2","node_ids":["text-2"]}],"ungrouped_node_ids":[]}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "applied" {
		t.Fatalf("expected applied, got %#v", result)
	}
	if approved == nil || approved.Operation != "generated-view" || approved.GeneratedView == nil {
		t.Fatalf("expected generated-view proposal, got %#v", approved)
	}
	if approved.GeneratedView.ViewLabel != "Two threads" || len(approved.GeneratedView.Clusters) != 2 {
		t.Fatalf("unexpected view %#v", approved.GeneratedView)
	}
	if approved.GeneratedView.SourceRevisions["text-2"] != 1 {
		t.Fatalf("unexpected revisions %v", approved.GeneratedView.SourceRevisions)
	}
}

// REQ-06: cluster view validation (min clusters, duplicate member, out-of-scope,
// cap) fails atomically.
func TestProposeClusterViewValidationErrors(t *testing.T) {
	cases := []struct {
		name string
		args string
		want string
	}{
		{"one-cluster", `{"label":"x","clusters":[{"label":"A","node_ids":["text-1"]}]}`, "cluster-view-requires-2-clusters"},
		{"duplicate-member", `{"label":"x","clusters":[{"label":"A","node_ids":["text-1"]},{"label":"B","node_ids":["text-1"]}]}`, "cluster-member-duplicate"},
		{"out-of-scope", `{"label":"x","clusters":[{"label":"A","node_ids":["text-1"]},{"label":"B","node_ids":["missing"]}]}`, "cluster-member-out-of-scope"},
		{"empty-member", `{"label":"x","clusters":[{"label":"A","node_ids":["text-1"]},{"label":"B","node_ids":[]}]}`, "cluster-member-empty"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			state := f5State()
			approved := false
			state.approve = func(context.Context, *ToolApplyProposal) ToolApplicationResult {
				approved = true
				return ToolApplicationResult{Status: "applied"}
			}
			call := ToolCall{ID: "view-" + tc.name}
			call.Function.Name = "propose_cluster_view"
			call.Function.Arguments = tc.args
			result := executeTool(context.Background(), state, call)
			if result.Status != "error" || !strings.Contains(result.Content, tc.want) {
				t.Fatalf("expected error containing %q, got %#v", tc.want, result)
			}
			if approved {
				t.Fatal("validation error must not emit a proposal")
			}
		})
	}
}

// REQ-02/REQ-06: Direct suggestion structured JSON parse handles direction,
// dedupe and node allowlist.
func TestParseSuggestRelationsAndClusters(t *testing.T) {
	relations, err := ParseSuggestRelations(`{"relations":[{"sourceNodeId":"a","targetNodeId":"b","kind":"supports","reason":"r","direction":"reverse"}]}`, []string{"a", "b"})
	if err != nil {
		t.Fatalf("parse relations: %v", err)
	}
	if relations[0].SourceNodeID != "b" || relations[0].TargetNodeID != "a" {
		t.Fatalf("direction not resolved: %#v", relations[0])
	}
	if _, err := ParseSuggestRelations(`{"relations":[{"sourceNodeId":"a","targetNodeId":"b","kind":"supports"}]}`, []string{"a"}); err == nil {
		t.Fatal("expected out-of-scope rejection")
	}
	if _, err := ParseSuggestRelations(`not json`, []string{"a", "b"}); err == nil {
		t.Fatal("expected invalid JSON rejection")
	}

	label, clusters, ungrouped, err := ParseSuggestClusters(`{"label":"v","clusters":[{"label":"A","nodeIds":["a"]},{"label":"B","nodeIds":["b"]}],"ungroupedNodeIds":[]}`, []string{"a", "b"})
	if err != nil {
		t.Fatalf("parse clusters: %v", err)
	}
	if label != "v" || len(clusters) != 2 || len(ungrouped) != 0 {
		t.Fatalf("unexpected cluster parse %q %#v %#v", label, clusters, ungrouped)
	}
	if _, _, _, err := ParseSuggestClusters(`{"label":"v","clusters":[{"label":"A","nodeIds":["a"]}]}`, []string{"a", "b"}); err == nil {
		t.Fatal("expected one-cluster rejection")
	}
}

// REQ-02/REQ-06: Direct suggest request validation mirrors DirectTransform's
// structured allowlist checks and accepts Image nodes.
func TestDirectSuggestRequestValidation(t *testing.T) {
	req := DirectSuggestRelationsRequest{
		WorkspaceID: "ws-1", CanvasID: "canvas-1", RuntimeGeneration: "gen-1", ScopeEpoch: 1, ContextDigest: "digest",
		SourceNodeIDs: []string{"text-1", "image-1"},
		SourceRevisions: map[string]int64{"text-1": 2, "image-1": 1},
		SourceNodes: []NodeSnapshot{
			{ID: "text-1", Type: "text", Revision: 2, Markdown: "alpha"},
			{ID: "image-1", Type: "image", Revision: 1, ImageRef: "i.png", Prompt: "castle"},
		},
	}
	if err := req.Validate(); err != nil {
		t.Fatalf("valid suggest request rejected: %v", err)
	}
	req.SourceRevisions = map[string]int64{"text-1": 2, "image-1": 99}
	if err := req.Validate(); err == nil {
		t.Fatal("expected revision conflict rejection")
	}
	clusterReq := DirectSuggestClustersRequest{
		WorkspaceID: "ws-1", CanvasID: "canvas-1", RuntimeGeneration: "gen-1", ScopeEpoch: 1, ContextDigest: "digest",
		SourceNodeIDs: []string{"text-1", "image-1"},
		SourceRevisions: map[string]int64{"text-1": 2, "image-1": 1},
		SourceNodes: []NodeSnapshot{
			{ID: "text-1", Type: "text", Revision: 2, Markdown: "alpha"},
			{ID: "image-1", Type: "image", Revision: 1, ImageRef: "i.png", Prompt: "castle"},
		},
	}
	if err := clusterReq.Validate(); err != nil {
		t.Fatalf("valid cluster suggest request rejected: %v", err)
	}
}

// REQ-02/REQ-06: FixtureLLM returns deterministic valid Direct suggestion JSON.
func TestFixtureSuggestResponsesAreValidJSON(t *testing.T) {
	fixture := &FixtureLLM{}
	relations := fixture.RelationBatchResponse([]string{"a", "b"})
	if _, err := ParseSuggestRelations(relations, []string{"a", "b"}); err != nil {
		t.Fatalf("relation fixture is not valid: %v (%q)", err, relations)
	}
	clusters := fixture.ClusterViewResponse([]string{"a", "b", "c"})
	_, _, _, err := ParseSuggestClusters(clusters, []string{"a", "b", "c"})
	if err != nil {
		t.Fatalf("cluster fixture is not valid: %v (%q)", err, clusters)
	}
}

// REQ-13: a Direct suggestion fault is returned as an error, not a proposal.
func TestFixtureSuggestFault(t *testing.T) {
	fixture := &FixtureLLM{}
	fixture.SetSuggestFault("suggest-invalid-json")
	if _, err := fixture.SuggestRelationsText([]string{"a", "b"}); err == nil || err.Error() != "suggest-invalid-json" {
		t.Fatalf("expected suggest fault, got %v", err)
	}
}
