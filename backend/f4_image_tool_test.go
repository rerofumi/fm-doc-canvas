package backend

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type f4AssetStore struct {
	dataURL string
	err     error
}

func (s f4AssetStore) GetImageDataURL(string) (string, error) {
	return s.dataURL, s.err
}

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
		assets:    f4AssetStore{dataURL: "data:image/png;base64,aGVsbG8="},
		ids:       NewSeededIDGenerator("t"),
		clock:     NewFakeClock(time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC)),
	}
	return state
}

// REQ-02: generate_image calls the ImagePort once and returns a proposal, not a
// document mutation. The tool result is a proposal awaiting approval.
func TestGenerateImageToolIsProposalNotMutation(t *testing.T) {
	state := f4ImageState()
	state.request.ImageProvider = "openai"
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
	if approved.ImageVariant.Provider != "openai" {
		t.Fatalf("unexpected provider %q", approved.ImageVariant.Provider)
	}
	_, _, provider, refs, refCount := state.image.(*FixtureImage).Observations()
	if provider != "openai" || refCount != 1 || len(refs) != 1 || !strings.HasPrefix(refs[0], "data:image/png;base64,") {
		t.Fatalf("provider received unresolved reference: provider=%q refs=%#v count=%d", provider, refs, refCount)
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

// REQ-01/REQ-12: a local asset path must never be forwarded as provider
// image_url. Resolution failures stop before the provider call.
func TestGenerateImageToolRejectsUnresolvedReferenceImage(t *testing.T) {
	state := f4ImageState()
	state.assets = f4AssetStore{dataURL: "generated/image.png"}
	call := ToolCall{ID: "img-1"}
	call.Function.Name = "generate_image"
	call.Function.Arguments = `{"prompt":"a rocket","source_node_ids":["image-1"]}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "error" || result.Content != "image-invalid-asset" {
		t.Fatalf("expected image-invalid-asset, got %#v", result)
	}
	if state.image.(*FixtureImage).Calls() != 0 {
		t.Fatal("provider must not be called with an unresolved local path")
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

// REQ-11: provider authentication and timeout errors keep their stable error
// code so the frontend can report them without accepting a proposal.
func TestGenerateImageToolPreservesProviderErrorCodes(t *testing.T) {
	for _, code := range []string{"image-unauthorized", "image-timeout"} {
		t.Run(code, func(t *testing.T) {
			state := f4ImageState()
			state.image.(*FixtureImage).SetFault(code)
			call := ToolCall{ID: "img-1"}
			call.Function.Name = "generate_image"
			call.Function.Arguments = `{"prompt":"a rocket"}`
			result := executeTool(context.Background(), state, call)
			if result.Status != "error" || result.Content != code || result.Proposal != nil {
				t.Fatalf("expected atomic %s error, got %#v", code, result)
			}
		})
	}
}

// REQ-10: cancelling while the provider is in flight must not surface a late
// proposal after the provider eventually returns.
func TestGenerateImageToolCancellationDropsLateResult(t *testing.T) {
	state := f4ImageState()
	fixture := state.image.(*FixtureImage)
	fixture.ArmDelay()
	approved := false
	state.approve = func(context.Context, *ToolApplyProposal) ToolApplicationResult {
		approved = true
		return ToolApplicationResult{Status: "applied"}
	}
	call := ToolCall{ID: "img-1"}
	call.Function.Name = "generate_image"
	call.Function.Arguments = `{"prompt":"a rocket"}`
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan toolResult, 1)
	go func() { done <- executeTool(ctx, state, call) }()

	for fixture.Calls() == 0 {
		time.Sleep(time.Millisecond)
	}
	cancel()
	fixture.ReleaseDelay()
	result := <-done
	if result.Status != "cancelled" || approved || result.Proposal != nil {
		t.Fatalf("expected cancelled late result with no proposal, got %#v approved=%v", result, approved)
	}
}

// REQ-08: the real agent request resolves allowlisted image assets into valid
// image data URLs before invoking the multimodal LLM port.
func TestRunAgentSendsAllowlistedVisionPixels(t *testing.T) {
	state := f4ImageState()
	for i := range state.request.Snapshot.Nodes {
		if state.request.Snapshot.Nodes[i].ID == "image-1" {
			state.request.Snapshot.Nodes[i].ImageIncluded = true
		}
	}
	state.request.DirectContextNodeIDs = []string{"image-1"}
	state.request.BodyAllowlistNodeIDs = []string{"image-1"}
	llm := &FixtureLLM{}
	asset := f4AssetStore{dataURL: "data:image/png;base64,aGVsbG8="}

	err := runAgent(context.Background(), llm, state.request, func(ChatEvent) {}, nil, nil, nil, asset, state.ids, state.clock)
	if err != nil {
		t.Fatalf("runAgent failed: %v", err)
	}
	_, userText, images := llm.Observations()
	if !strings.Contains(userText, state.request.Prompt) {
		t.Fatalf("prompt was not sent to LLM: %q", userText)
	}
	if len(images) != 1 || images[0] != asset.dataURL {
		t.Fatalf("expected one resolved vision image, got %#v", images)
	}
}

// REQ-08/REQ-11: missing or malformed assets fail closed before any LLM call.
func TestRunAgentRejectsInvalidVisionAsset(t *testing.T) {
	for _, tc := range []struct {
		name  string
		asset f4AssetStore
	}{
		{name: "resolver error", asset: f4AssetStore{err: errors.New("missing")}},
		{name: "malformed URL", asset: f4AssetStore{dataURL: "generated/image.png"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			state := f4ImageState()
			for i := range state.request.Snapshot.Nodes {
				if state.request.Snapshot.Nodes[i].ID == "image-1" {
					state.request.Snapshot.Nodes[i].ImageIncluded = true
				}
			}
			state.request.DirectContextNodeIDs = []string{"image-1"}
			llm := &FixtureLLM{}
			err := runAgent(context.Background(), llm, state.request, func(ChatEvent) {}, nil, nil, nil, tc.asset, state.ids, state.clock)
			if err == nil || !strings.Contains(err.Error(), "image-invalid-asset") {
				t.Fatalf("expected image-invalid-asset, got %v", err)
			}
			calls, _, _ := llm.Observations()
			if calls != 0 {
				t.Fatalf("LLM must not be called for an invalid asset, got %d calls", calls)
			}
		})
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

// REQ-08: read_canvas_node for an image returns imageIncluded=true when allowlisted.
func TestReadCanvasNodeImageIncludedTrueWhenAllowlisted(t *testing.T) {
	state := f4ImageState()
	for i := range state.request.Snapshot.Nodes {
		if state.request.Snapshot.Nodes[i].ID == "image-1" {
			state.request.Snapshot.Nodes[i].ImageIncluded = true
		}
	}
	call := ToolCall{ID: "read-1"}
	call.Function.Name = "read_canvas_node"
	call.Function.Arguments = `{"node_id":"image-1"}`
	result := executeTool(context.Background(), state, call)
	if result.Status != "done" {
		t.Fatalf("read_canvas_node failed: %#v", result)
	}
	if !strings.Contains(result.Content, `"imageIncluded":true`) {
		t.Fatalf("expected imageIncluded=true, got %s", result.Content)
	}
}
