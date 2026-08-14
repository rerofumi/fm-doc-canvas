package backend

import (
	"context"
	"strings"
	"testing"
	"time"
)

// f4ImageState builds an agentRunState with a FixtureImage and a request that
// has a text node and an image node in the snapshot.
func f4ImageState() *agentRunState {
	request := ChatRequest{
		RunID: "run-1", SessionID: "session-1", CanvasID: "canvas-1", Prompt: "generate an image",
		WorkspaceID: "ws-1", RuntimeGeneration: "gen-1", ScopeEpoch: 1, RunEpoch: 1, ContextDigest: "digest",
		Snapshot: CanvasSnapshot{CanvasID: "canvas-1", Nodes: []NodeSnapshot{
			{ID: "text-1", Type: "text", Revision: 2, Markdown: "upstream"},
			{ID: "image-1", Type: "image", ImageRef: "image.png", Prompt: "a castle"},
		}},
	}
	state := &agentRunState{
		request:   request,
		readRevs:  map[string]int64{},
		readNodes: map[string]NodeSnapshot{},
		image:     &FixtureImage{Path: "generated/fixture.png"},
		ids:       NewSeededIDGenerator("t"),
		clock:     NewFakeClock(time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC)),
	}
	return state
}

// REQ-02: generate_image calls the ImagePort once and returns a proposal, not a
// document mutation. The tool result is a proposal awaiting approval.
func TestGenerateImageToolIsProposalNotMutation(t *testing.T) {
	state := f4ImageState()
	var approved *ToolApplyProposal
	state.approve = func(_ context.Context, proposal *ToolApplyProposal) ToolApplicationResult {
		approved = proposal
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "applied"}
	}
	call := ToolCall{ID: "img-1"}
	call.Function.Name = "generate_image"
	call.Function.Arguments = `{"prompt":"a rocket","source_node_ids":["text-1","image-1"]}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "applied" {
		t.Fatalf("expected applied, got %#v", result)
	}
	if approved == nil {
		t.Fatal("expected proposal")
	}
	if approved.Operation != "image-variant" {
		t.Fatalf("expected image-variant operation, got %q", approved.Operation)
	}
	if approved.ImageVariant == nil {
		t.Fatal("expected imageVariant payload")
	}
	if approved.ImageVariant.Src != "generated/fixture.png" {
		t.Fatalf("unexpected src %q", approved.ImageVariant.Src)
	}
	if approved.ImageVariant.Prompt != "a rocket" {
		t.Fatalf("unexpected prompt %q", approved.ImageVariant.Prompt)
	}
	// Source references must be allowlisted and carry revisions.
	if len(approved.ImageVariant.SourceNodeIDs) != 2 {
		t.Fatalf("expected 2 sources, got %v", approved.ImageVariant.SourceNodeIDs)
	}
	if approved.ImageVariant.SourceRevisions["text-1"] != 2 {
		t.Fatalf("unexpected text revision %v", approved.ImageVariant.SourceRevisions)
	}
	// The tool must not mutate the document (there is no document in the state).
	if len(state.readNodes) != 0 {
		t.Fatalf("generate_image must not read/mutate nodes, got %v", state.readNodes)
	}
}

// REQ-02: generate_image with an empty prompt fails with image-invalid-prompt.
func TestGenerateImageToolEmptyPromptFails(t *testing.T) {
	state := f4ImageState()
	call := ToolCall{ID: "img-1"}
	call.Function.Name = "generate_image"
	call.Function.Arguments = `{"prompt":"  "}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "error" || result.Content != "image-invalid-prompt" {
		t.Fatalf("expected image-invalid-prompt, got %#v", result)
	}
}

// REQ-12: generate_image with a source outside the snapshot fails atomically.
func TestGenerateImageToolSourceOutOfScope(t *testing.T) {
	state := f4ImageState()
	call := ToolCall{ID: "img-1"}
	call.Function.Name = "generate_image"
	call.Function.Arguments = `{"prompt":"a rocket","source_node_ids":["missing-1"]}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "error" || result.Content != "image-source-out-of-scope" {
		t.Fatalf("expected image-source-out-of-scope, got %#v", result)
	}
}

// REQ-02: generate_image with no ImagePort fails closed.
func TestGenerateImageToolNoImagePort(t *testing.T) {
	state := f4ImageState()
	state.image = nil
	call := ToolCall{ID: "img-1"}
	call.Function.Name = "generate_image"
	call.Function.Arguments = `{"prompt":"a rocket"}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "error" || result.Content != "image generation is unavailable" {
		t.Fatalf("expected unavailable error, got %#v", result)
	}
}

// REQ-08: read_canvas_node for an image returns imageIncluded=false by default
// (metadata only) unless the image is in the vision allowlist.
func TestReadCanvasNodeImageMetadataOnly(t *testing.T) {
	state := f4ImageState()
	call := ToolCall{ID: "read-1"}
	call.Function.Name = "read_canvas_node"
	call.Function.Arguments = `{"node_id":"image-1"}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "done" {
		t.Fatalf("read_canvas_node failed: %#v", result)
	}
	if !strings.Contains(result.Content, `"imageIncluded":false`) {
		t.Fatalf("expected imageIncluded=false, got %s", result.Content)
	}
}
