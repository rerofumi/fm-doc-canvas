package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func testChatRequest(prompt string) ChatRequest {
	return ChatRequest{
		RunID: "run-1", SessionID: "session-1", CanvasID: "canvas-1", Prompt: prompt,
		TargetNodeID: "artifact-1", DirectContextNodeIDs: []string{"text-1", "artifact-1"},
		Snapshot: CanvasSnapshot{CanvasID: "canvas-1", Nodes: []NodeSnapshot{
			{ID: "text-1", Type: "text", Revision: 2, Markdown: "upstream"},
			{ID: "artifact-1", Type: "artifact", Revision: 3, Filename: "chapter.md", Markdown: "before\nneedle\nafter"},
			{ID: "image-1", Type: "image", ImageRef: "image.png", Prompt: "a castle"},
		}, Edges: []EdgeSnapshot{{Source: "text-1", Target: "artifact-1"}}},
	}
}

func TestChatRequestValidationRejectsInvalidDirectContext(t *testing.T) {
	request := testChatRequest("test")
	request.DirectContextNodeIDs = []string{"missing"}
	if err := request.validate(); err == nil {
		t.Fatal("expected invalid direct context error")
	}
}

func TestToolContractsReadAndApplyExactlyOneMatch(t *testing.T) {
	request := testChatRequest("replace the word")
	state := &agentRunState{request: request, readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}}
	read := ToolCall{ID: "read-1"}
	read.Function.Name = "read_artifact"
	read.Function.Arguments = `{"node_id":"artifact-1"}`
	if result := executeTool(context.Background(), state, read); result.Status != "done" {
		t.Fatalf("read_artifact failed: %#v", result)
	}

	var approved *ToolApplyProposal
	state.approve = func(_ context.Context, proposal *ToolApplyProposal) ToolApplicationResult {
		approved = proposal
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "applied"}
	}
	edit := ToolCall{ID: "edit-1"}
	edit.Function.Name = "apply_edit"
	edit.Function.Arguments = `{"node_id":"artifact-1","search_text":"needle","replacement":"updated","edit_summary":"test"}`
	if result := executeTool(context.Background(), state, edit); result.Status != "applied" {
		t.Fatalf("apply_edit failed: %#v", result)
	}
	if approved == nil || approved.BaseRevision != 3 || approved.Proposed != "before\nupdated\nafter" {
		t.Fatalf("unexpected mutation proposal: %#v", approved)
	}

	edit.Function.Arguments = `{"node_id":"artifact-1","search_text":"before","replacement":"x","edit_summary":"test"}`
	request.Snapshot.Nodes[1].Markdown = "before before"
	state.request = request
	state.readNodes = map[string]NodeSnapshot{}
	if result := executeTool(context.Background(), state, read); result.Status != "done" {
		t.Fatalf("second read_artifact failed: %#v", result)
	}
	if result := executeTool(context.Background(), state, edit); result.Status != "error" {
		t.Fatalf("expected ambiguous edit error: %#v", result)
	}
}

func TestEightToolDefinitionsAndReadTools(t *testing.T) {
	definitions := toolDefinitions()
	if len(definitions) != 10 {
		t.Fatalf("tool count = %d, want 10", len(definitions))
	}
	wantNames := []string{"read_artifact", "apply_edit", "write_artifact", "list_artifacts", "search_artifact", "read_canvas_node", "list_canvas_nodes", "propose_transform", "propose_relation", "web_search"}
	for index, want := range wantNames {
		if definitions[index].Function.Name != want {
			t.Fatalf("tool %d = %q, want %q", index, definitions[index].Function.Name, want)
		}
	}

	state := &agentRunState{request: testChatRequest("inspect"), readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}}
	tests := []struct{ name, arguments, contains string }{
		{"list_artifacts", `{}`, `"filename":"chapter.md"`},
		{"search_artifact", `{"query":"needle"}`, `"offset":7`},
		{"list_canvas_nodes", `{}`, `"nodeId":"image-1"`},
		{"read_canvas_node", `{"node_id":"text-1"}`, `"markdown":"upstream"`},
		{"read_canvas_node", `{"node_id":"artifact-1"}`, `"revision":3`},
		{"read_canvas_node", `{"node_id":"image-1"}`, `"imageIncluded":false`},
	}
	for index, tt := range tests {
		t.Run(fmt.Sprintf("%s-%d", tt.name, index), func(t *testing.T) {
			call := ToolCall{ID: fmt.Sprintf("call-%d", index)}
			call.Function.Name = tt.name
			call.Function.Arguments = tt.arguments
			result := executeTool(context.Background(), state, call)
			if result.Status != "done" || !strings.Contains(result.Content, tt.contains) {
				t.Fatalf("unexpected result: %#v", result)
			}
		})
	}
	missing := ToolCall{ID: "missing"}
	missing.Function.Name = "read_canvas_node"
	missing.Function.Arguments = `{"node_id":"missing"}`
	if result := executeTool(context.Background(), state, missing); result.Status != "error" {
		t.Fatalf("missing node should fail: %#v", result)
	}
}

func TestMergedListAndWebSearchToolCallUsesFinalJSONObject(t *testing.T) {
	call := ToolCall{ID: "merged-1"}
	call.Function.Name = "list_canvas_nodesweb_search"
	call.Function.Arguments = `{}{"query":"current topic"}`
	normalized := normalizeMergedToolCall(call)
	if normalized.Function.Name != "web_search" || normalized.Function.Arguments != `{"query":"current topic"}` {
		t.Fatalf("unexpected normalized call: %#v", normalized.Function)
	}
	state := &agentRunState{
		request: testChatRequest("search the web"), readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{},
		search: NewFixtureWebSearch(), ids: NewSeededIDGenerator("t"), clock: NewFakeClock(time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC)),
	}
	result := executeTool(context.Background(), state, call)
	if result.Status != "done" || !strings.Contains(result.Content, `"status":"complete"`) {
		t.Fatalf("merged web search failed: %#v", result)
	}
}

func TestProposeTransformRequiresReadAndCarriesRevisionSnapshot(t *testing.T) {
	request := testChatRequest("compare selected nodes")
	state := &agentRunState{request: request, readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}}
	for _, id := range []string{"text-1", "artifact-1"} {
		call := ToolCall{ID: "read-" + id}
		call.Function.Name = "read_canvas_node"
		call.Function.Arguments = fmt.Sprintf(`{"node_id":%q}`, id)
		if result := executeTool(context.Background(), state, call); result.Status != "done" {
			t.Fatalf("read %s failed: %#v", id, result)
		}
	}
	var proposal *ToolApplyProposal
	state.approve = func(_ context.Context, value *ToolApplyProposal) ToolApplicationResult {
		proposal = value
		return ToolApplicationResult{ToolCallID: value.ToolCallID, Status: "applied"}
	}
	call := ToolCall{ID: "transform-1"}
	call.Function.Name = "propose_transform"
	call.Function.Arguments = `{"operation":"compare","source_node_ids":["text-1","artifact-1"],"content":"comparison","summary":"Comparison","reason":"shared axis"}`
	if result := executeTool(context.Background(), state, call); result.Status != "applied" {
		t.Fatalf("propose_transform failed: %#v", result)
	}
	if proposal == nil || proposal.Operation != "transform" || proposal.Transform == nil || proposal.Transform.SourceRevisions["text-1"] != 2 || proposal.Transform.SourceRevisions["artifact-1"] != 3 {
		t.Fatalf("unexpected transform proposal: %#v", proposal)
	}
}

func TestDirectTransformRequestValidationUsesStructuredSourceSnapshot(t *testing.T) {
	nodes := testChatRequest("test").Snapshot.Nodes[:2]
	request := DirectTransformRequest{
		Operation:       "compare",
		SourceNodeIDs:   []string{"text-1", "artifact-1"},
		SourceRevisions: map[string]int64{"text-1": 2, "artifact-1": 3},
		SourceNodes:     nodes,
		WorkspaceID:     "workspace-1", CanvasID: "canvas-1", RuntimeGeneration: "generation-1", ContextDigest: "digest",
	}
	if err := request.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: request.SourceNodes}); err != nil {
		t.Fatalf("valid direct request rejected: %v", err)
	}
	arity := request
	arity.SourceNodeIDs = []string{"text-1"}
	arity.SourceNodes = nodes[:1]
	arity.SourceRevisions = map[string]int64{"text-1": 2}
	if err := arity.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: arity.SourceNodes}); err == nil {
		t.Fatal("expected compare arity error")
	}

	// Extra body outside allowlist must fail before provider call.
	extra := request
	extra.SourceNodes = append(append([]NodeSnapshot{}, nodes...), NodeSnapshot{ID: "text-extra", Type: "text", Revision: 1, Markdown: "smuggled"})
	if err := extra.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: extra.SourceNodes}); err == nil {
		t.Fatal("expected extra sourceNodes rejection")
	}

	// Missing body for a declared source ID.
	missing := request
	missing.SourceNodes = nodes[:1]
	if err := missing.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: missing.SourceNodes}); err == nil {
		t.Fatal("expected missing sourceNodes rejection")
	}

	// Duplicate source ID.
	dup := request
	dup.SourceNodeIDs = []string{"text-1", "text-1"}
	dup.SourceNodes = []NodeSnapshot{nodes[0], nodes[0]}
	dup.SourceRevisions = map[string]int64{"text-1": 2}
	if err := dup.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: dup.SourceNodes}); err == nil {
		t.Fatal("expected duplicate source rejection")
	}

	// Extra revision key.
	extraRev := request
	extraRev.SourceRevisions = map[string]int64{"text-1": 2, "artifact-1": 3, "ghost": 1}
	if err := extraRev.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: extraRev.SourceNodes}); err == nil {
		t.Fatal("expected extra sourceRevisions rejection")
	}

	// Missing revision key.
	missingRev := request
	missingRev.SourceRevisions = map[string]int64{"text-1": 2}
	if err := missingRev.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: missingRev.SourceNodes}); err == nil {
		t.Fatal("expected missing sourceRevisions rejection")
	}

	// Body revision mismatch with sourceRevisions.
	revMismatch := request
	revMismatch.SourceNodes = []NodeSnapshot{
		{ID: "text-1", Type: "text", Revision: 99, Markdown: nodes[0].Markdown},
		nodes[1],
	}
	if err := revMismatch.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: revMismatch.SourceNodes}); err == nil {
		t.Fatal("expected body/revision mismatch rejection")
	}

	allowlisted, err := request.AllowlistedSourceNodes()
	if err != nil {
		t.Fatalf("allowlist order failed: %v", err)
	}
	if len(allowlisted) != 2 || allowlisted[0].ID != "text-1" || allowlisted[1].ID != "artifact-1" {
		t.Fatalf("allowlisted order wrong: %#v", allowlisted)
	}
	// Provider body must not include unvalidated extras even if SourceNodes is disordered.
	disordered := request
	disordered.SourceNodes = []NodeSnapshot{nodes[1], nodes[0]}
	if err := disordered.Validate(CanvasSnapshot{CanvasID: "canvas-1", Nodes: disordered.SourceNodes}); err != nil {
		t.Fatalf("disordered but valid set rejected: %v", err)
	}
	ordered, err := disordered.AllowlistedSourceNodes()
	if err != nil || ordered[0].ID != "text-1" || ordered[1].ID != "artifact-1" {
		t.Fatalf("allowlist should follow sourceNodeIds order: %#v err=%v", ordered, err)
	}
}

func TestProposeRelationRequiresReadAndDoesNotAutoApply(t *testing.T) {
	request := testChatRequest("relate selected nodes")
	state := &agentRunState{request: request, readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}}
	for _, id := range []string{"text-1", "artifact-1"} {
		call := ToolCall{ID: "read-" + id}
		call.Function.Name = "read_canvas_node"
		call.Function.Arguments = fmt.Sprintf(`{"node_id":%q}`, id)
		if result := executeTool(context.Background(), state, call); result.Status != "done" {
			t.Fatalf("read %s failed: %#v", id, result)
		}
	}
	var proposal *ToolApplyProposal
	state.approve = func(_ context.Context, value *ToolApplyProposal) ToolApplicationResult {
		proposal = value
		return ToolApplicationResult{ToolCallID: value.ToolCallID, Status: "cancelled"}
	}
	call := ToolCall{ID: "relation-1"}
	call.Function.Name = "propose_relation"
	call.Function.Arguments = `{"source_node_id":"text-1","target_node_id":"artifact-1","kind":"supports","reason":"evidence","direction":"forward"}`
	if result := executeTool(context.Background(), state, call); result.Status != "cancelled" {
		t.Fatalf("propose_relation should await human decision: %#v", result)
	}
	if proposal == nil || proposal.Operation != "relation" || proposal.Relation == nil || proposal.Relation.Kind != "supports" {
		t.Fatalf("unexpected relation proposal: %#v", proposal)
	}
	if proposal.Relation.SourceNodeID != "text-1" || proposal.Relation.TargetNodeID != "artifact-1" {
		t.Fatalf("unexpected endpoints: %#v", proposal.Relation)
	}
}

func TestApplyEditCoversTextZeroMultipleUnicodeAndWrongType(t *testing.T) {
	request := testChatRequest("edit text")
	request.Snapshot.Nodes[0].Markdown = "日本語 target text"
	state := &agentRunState{request: request, readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}}
	state.approve = func(_ context.Context, proposal *ToolApplyProposal) ToolApplicationResult {
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "applied"}
	}
	readText := ToolCall{ID: "read-text"}
	readText.Function.Name = "read_canvas_node"
	readText.Function.Arguments = `{"node_id":"text-1"}`
	if result := executeTool(context.Background(), state, readText); result.Status != "done" {
		t.Fatal(result.Content)
	}

	edit := ToolCall{ID: "edit-text"}
	edit.Function.Name = "apply_edit"
	edit.Function.Arguments = `{"node_id":"text-1","search_text":"日本語","replacement":"更新済み","edit_summary":"unicode"}`
	if result := executeTool(context.Background(), state, edit); result.Status != "applied" {
		t.Fatalf("unicode Text edit failed: %#v", result)
	}
	edit.Function.Arguments = `{"node_id":"text-1","search_text":"missing","replacement":"x","edit_summary":"zero"}`
	if result := executeTool(context.Background(), state, edit); result.Status != "error" {
		t.Fatalf("zero match should fail: %#v", result)
	}

	state.readNodes["text-1"] = NodeSnapshot{ID: "text-1", Type: "text", Markdown: "same same", Revision: 2}
	edit.Function.Arguments = `{"node_id":"text-1","search_text":"same","replacement":"x","edit_summary":"multiple"}`
	if result := executeTool(context.Background(), state, edit); result.Status != "error" {
		t.Fatalf("multiple matches should fail: %#v", result)
	}

	state.readNodes["image-1"] = request.Snapshot.Nodes[2]
	edit.Function.Arguments = `{"node_id":"image-1","search_text":"castle","replacement":"city","edit_summary":"wrong type"}`
	if result := executeTool(context.Background(), state, edit); result.Status != "error" {
		t.Fatalf("image edit should fail: %#v", result)
	}
}

func TestFailedReadArtifactDoesNotAuthorizeEdit(t *testing.T) {
	state := &agentRunState{request: testChatRequest("edit"), readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}, approve: func(_ context.Context, proposal *ToolApplyProposal) ToolApplicationResult {
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "applied"}
	}}
	read := ToolCall{ID: "bad-read"}
	read.Function.Name = "read_artifact"
	read.Function.Arguments = `{"node_id":"text-1"}`
	if result := executeTool(context.Background(), state, read); result.Status != "error" {
		t.Fatalf("read_artifact on Text should fail: %#v", result)
	}
	edit := ToolCall{ID: "edit"}
	edit.Function.Name = "apply_edit"
	edit.Function.Arguments = `{"node_id":"text-1","search_text":"upstream","replacement":"changed","edit_summary":"invalid"}`
	if result := executeTool(context.Background(), state, edit); result.Status != "error" {
		t.Fatalf("failed read authorized edit: %#v", result)
	}
}

func TestWriteArtifactRequiresReadOrExplicitNewDocument(t *testing.T) {
	request := testChatRequest("update the current artifact")
	state := &agentRunState{request: request, readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}, approve: func(_ context.Context, proposal *ToolApplyProposal) ToolApplicationResult {
		return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: "applied"}
	}}
	write := ToolCall{ID: "write"}
	write.Function.Name = "write_artifact"
	write.Function.Arguments = `{"node_id":"artifact-1","content":"replacement","edit_summary":"replace"}`
	if result := executeTool(context.Background(), state, write); result.Status != "error" {
		t.Fatalf("write without read should fail: %#v", result)
	}
	read := ToolCall{ID: "read"}
	read.Function.Name = "read_artifact"
	read.Function.Arguments = `{"node_id":"artifact-1"}`
	_ = executeTool(context.Background(), state, read)
	if result := executeTool(context.Background(), state, write); result.Status != "applied" {
		t.Fatalf("write after read failed: %#v", result)
	}

	write.Function.Arguments = `{"content":"new","edit_summary":"create"}`
	if result := executeTool(context.Background(), state, write); result.Status != "error" {
		t.Fatalf("ambiguous creation should fail: %#v", result)
	}
	state.request.Prompt = "新規文書を作成してください"
	if result := executeTool(context.Background(), state, write); result.Status != "applied" {
		t.Fatalf("explicit creation failed: %#v", result)
	}
	state.request.Prompt = "この段落に説明を追加してください"
	if explicitCreation(state.request.Prompt) {
		t.Fatal("ordinary text addition was treated as new document creation")
	}
}

func TestSystemPromptContainsRequiredInstructions(t *testing.T) {
	for _, required := range []string{"assistant operating an FM Doc Canvas", "Before changing", "structured tool call", "natural language"} {
		if !strings.Contains(agentSystemPrompt, required) {
			t.Fatalf("system prompt missing %q", required)
		}
	}
}

func TestAgentStopsAfterTenToolRounds(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"","tool_calls":[{"id":"call-1","type":"function","function":{"name":"list_artifacts","arguments":"{}"}}]}}]}`))
	}))
	defer server.Close()
	llm := NewLLMService(&ConfigService{config: &Config{LLM: LLMConfig{BaseURL: server.URL, Model: "test"}}})
	err := runAgent(context.Background(), llm, testChatRequest("inspect"), func(ChatEvent) {}, func(context.Context, *ToolApplyProposal) ToolApplicationResult { return ToolApplicationResult{} }, nil, nil, nil)
	if err == nil || requests.Load() != 10 {
		t.Fatalf("expected ten tool rounds and an error, requests=%d err=%v", requests.Load(), err)
	}
}

func TestChatServiceCancelEmitsOneTerminalEvent(t *testing.T) {
	started := make(chan struct{})
	llm := NewLLMService(&ConfigService{config: &Config{LLM: LLMConfig{BaseURL: "http://agent.test", Model: "test"}}})
	llm.client.Transport = roundTripFunc(func(request *http.Request) (*http.Response, error) {
		close(started)
		<-request.Context().Done()
		return nil, request.Context().Err()
	})
	service := NewChatService(llm)
	events := make(chan ChatEvent, 8)
	service.SetEmitter(func(event ChatEvent) { events <- event })
	request := testChatRequest("cancel")
	if err := service.Send(request); err != nil {
		t.Fatal(err)
	}
	<-started
	if err := service.Cancel(request.RunID); err != nil {
		t.Fatal(err)
	}
	deadline := time.After(2 * time.Second)
	terminal := 0
	for {
		select {
		case event := <-events:
			if event.Type == "chat:done" || event.Type == "chat:cancelled" || event.Type == "chat:error" {
				terminal++
				if event.Type != "chat:cancelled" {
					t.Fatalf("unexpected terminal event: %#v", event)
				}
				if terminal != 1 {
					t.Fatalf("terminal emitted more than once")
				}
				select {
				case duplicate := <-events:
					if duplicate.Type == "chat:done" || duplicate.Type == "chat:cancelled" || duplicate.Type == "chat:error" {
						t.Fatalf("duplicate terminal event: %#v", duplicate)
					}
				case <-time.After(50 * time.Millisecond):
				}
				return
			}
		case <-deadline:
			t.Fatal("timed out waiting for cancellation event")
		}
	}
}

func TestStreamChatEmitsUTF8DeltasAndAssemblesToolCall(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if !request.Stream {
			t.Fatal("stream flag was not set")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"こんにちは"}}]}`)
		_, _ = fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"世界"}}]}`)
		_, _ = fmt.Fprintln(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"provider-call","type":"function","function":{"name":"apply_","arguments":"{\"node_id\":"}}]}}]}`)
		_, _ = fmt.Fprintln(w, `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"edit","arguments":"\"artifact-1\"}"}}]}}]}`)
		_, _ = fmt.Fprintln(w, "data: [DONE]")
	}))
	defer server.Close()
	llm := NewLLMService(&ConfigService{config: &Config{LLM: LLMConfig{BaseURL: server.URL, Model: "test"}}})
	chunks := []string{}
	result, err := llm.streamChat(context.Background(), []ChatMessage{{Role: "user", Content: "test"}}, toolDefinitions(), func(chunk string) { chunks = append(chunks, chunk) })
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(chunks, "") != "こんにちは世界" || result.Content != "こんにちは世界" {
		t.Fatalf("UTF-8 stream corrupted: chunks=%#v result=%q", chunks, result.Content)
	}
	if len(result.ToolCalls) != 1 || result.ToolCalls[0].Function.Name != "apply_edit" || result.ToolCalls[0].Function.Arguments != `{"node_id":"artifact-1"}` {
		t.Fatalf("tool call was not assembled: %#v", result.ToolCalls)
	}
}

func TestAgentPreservesGeminiThoughtSignatureAcrossToolRound(t *testing.T) {
	const signature = "encrypted-gemini-thought-signature"
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		switch calls.Add(1) {
		case 1:
			_, _ = fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"default_api:list_canvas_nodes\",\"type\":\"function\",\"extra_content\":{\"google\":{\"thought_signature\":%q}},\"function\":{\"name\":\"list_canvas_nodes\",\"arguments\":\"{}\"}}]}}]}\n\n", signature)
		case 2:
			if len(request.Messages) < 4 {
				t.Errorf("tool conversation was not preserved: %#v", request.Messages)
			} else {
				assistant := request.Messages[len(request.Messages)-2]
				if assistant.Role != "assistant" || len(assistant.ToolCalls) != 1 {
					t.Errorf("assistant tool call missing: %#v", assistant)
				} else {
					var extra struct {
						Google struct {
							ThoughtSignature string `json:"thought_signature"`
						} `json:"google"`
					}
					if err := json.Unmarshal(assistant.ToolCalls[0].ExtraContent, &extra); err != nil {
						t.Errorf("decode extra_content: %v", err)
					} else if extra.Google.ThoughtSignature != signature {
						t.Errorf("thought signature = %q, want %q", extra.Google.ThoughtSignature, signature)
					}
				}
			}
			_, _ = fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"完了しました"}}]}`)
		default:
			t.Errorf("unexpected provider request %d", calls.Load())
		}
		_, _ = fmt.Fprintln(w, "data: [DONE]")
	}))
	defer server.Close()

	llm := NewLLMService(&ConfigService{config: &Config{LLM: LLMConfig{BaseURL: server.URL, Model: "gemini-test"}}})
	var streamed strings.Builder
	err := runAgent(context.Background(), llm, testChatRequest("Canvas nodesを確認してください"), func(event ChatEvent) {
		if event.Type == "chat:stream" {
			streamed.WriteString(event.Text)
		}
	}, func(context.Context, *ToolApplyProposal) ToolApplicationResult {
		t.Fatal("read-only tool unexpectedly requested approval")
		return ToolApplicationResult{}
	}, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 || streamed.String() != "完了しました" {
		t.Fatalf("unexpected roundtrip: calls=%d text=%q", calls.Load(), streamed.String())
	}
}

func TestCancelOnlyReleasesPendingApplicationsForTargetRun(t *testing.T) {
	service := NewChatService(nil)
	service.applicationTimeout = time.Second
	ctx1, cancel1 := context.WithCancel(context.Background())
	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	service.runs["run-1"] = &chatRun{ctx: ctx1, cancel: cancel1}
	service.runs["run-2"] = &chatRun{ctx: ctx2, cancel: cancel2}
	result1 := make(chan ToolApplicationResult, 1)
	result2 := make(chan ToolApplicationResult, 1)
	go func() {
		result1 <- service.waitForApplication(ctx1, ChatRequest{RunID: "run-1", SessionID: "session-1"}, &ToolApplyProposal{ToolCallID: "run-1:call"})
	}()
	go func() {
		result2 <- service.waitForApplication(ctx2, ChatRequest{RunID: "run-2", SessionID: "session-2"}, &ToolApplyProposal{ToolCallID: "run-2:call"})
	}()
	waitForPendingCount(t, service, 2)
	if err := service.Cancel("run-1"); err != nil {
		t.Fatal(err)
	}
	if result := <-result1; result.Status != "cancelled" {
		t.Fatalf("run-1 result = %#v", result)
	}
	select {
	case result := <-result2:
		t.Fatalf("run-2 was also cancelled: %#v", result)
	case <-time.After(30 * time.Millisecond):
	}
	if err := service.Resolve(ToolApplicationResult{ToolCallID: "run-2:call", Status: "applied"}); err != nil {
		t.Fatal(err)
	}
	if result := <-result2; result.Status != "applied" {
		t.Fatalf("run-2 result = %#v", result)
	}
}

func TestToolApplicationTimeoutAndAcknowledgmentStatuses(t *testing.T) {
	service := NewChatService(nil)
	service.applicationTimeout = 15 * time.Millisecond
	result := service.waitForApplication(context.Background(), ChatRequest{RunID: "run", SessionID: "session"}, &ToolApplyProposal{ToolCallID: "timeout"})
	if result.Status != "error" || !strings.Contains(result.Error, "timed out") {
		t.Fatalf("unexpected timeout result: %#v", result)
	}

	for _, status := range []string{"applied", "conflict", "cancelled", "error"} {
		state := &agentRunState{approve: func(_ context.Context, proposal *ToolApplyProposal) ToolApplicationResult {
			return ToolApplicationResult{ToolCallID: proposal.ToolCallID, Status: status, Error: "frontend error"}
		}}
		toolResult := awaitApproval(context.Background(), state, &ToolApplyProposal{ToolCallID: status})
		if toolResult.Status != status {
			t.Fatalf("ack %q produced %#v", status, toolResult)
		}
	}
}

func TestOllamaAgentRoundTrip(t *testing.T) {
	model := os.Getenv("FM_TEST_OLLAMA_MODEL")
	if model == "" {
		t.Skip("set FM_TEST_OLLAMA_MODEL to run the local Ollama acceptance test")
	}
	baseURL := os.Getenv("FM_TEST_OLLAMA_BASE_URL")
	if baseURL == "" {
		baseURL = "http://127.0.0.1:11434/v1"
	}
	llm := NewLLMService(&ConfigService{config: &Config{LLM: LLMConfig{BaseURL: baseURL, Model: model}}})
	llm.client.Timeout = 5 * time.Minute
	service := NewChatService(llm)
	events := make(chan ChatEvent, 64)
	service.SetEmitter(func(event ChatEvent) {
		events <- event
		if event.Type == "chat:tool_apply" && event.Apply != nil {
			if event.Apply.TargetNodeID != "artifact-1" || event.Apply.Proposed != "before\nupdated\nafter" {
				t.Errorf("unexpected Ollama proposal: %#v", event.Apply)
				_ = service.Resolve(ToolApplicationResult{ToolCallID: event.Apply.ToolCallID, Status: "error", Error: "unexpected proposal"})
				return
			}
			_ = service.Resolve(ToolApplicationResult{ToolCallID: event.Apply.ToolCallID, Status: "applied"})
		}
	})
	request := testChatRequest("You must use read_artifact on artifact-1, then use apply_edit to replace the exact text 'needle' with 'updated'. After the tool confirms success, answer in natural language without JSON.")
	if err := service.Send(request); err != nil {
		t.Fatal(err)
	}
	deadline := time.After(4 * time.Minute)
	readSeen := false
	applySeen := false
	naturalText := strings.Builder{}
	for {
		select {
		case event := <-events:
			if event.Type == "chat:tool_start" && event.ToolEvent != nil && event.ToolEvent.Name == "read_artifact" {
				readSeen = true
			}
			if event.Type == "chat:tool_apply" {
				applySeen = true
			}
			if event.Type == "chat:stream" {
				naturalText.WriteString(event.Text)
			}
			switch event.Type {
			case "chat:done":
				if !readSeen || !applySeen || strings.TrimSpace(naturalText.String()) == "" {
					t.Fatalf("incomplete Ollama roundtrip: read=%v apply=%v text=%q", readSeen, applySeen, naturalText.String())
				}
				if strings.HasPrefix(strings.TrimSpace(naturalText.String()), "{") {
					t.Fatalf("Ollama returned JSON instead of natural language: %q", naturalText.String())
				}
				return
			case "chat:error", "chat:cancelled":
				t.Fatalf("Ollama run failed: %#v", event)
			}
		case <-deadline:
			_ = service.Cancel(request.RunID)
			t.Fatal("timed out waiting for Ollama roundtrip")
		}
	}
}

func waitForPendingCount(t *testing.T, service *ChatService, want int) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		service.mu.Lock()
		count := len(service.pending)
		service.mu.Unlock()
		if count == want {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("pending application count did not reach %d", want)
}

func TestChatServiceEmitsStreamToolEventsAndWaitsForAcknowledgment(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}
		if len(request.Messages) == 0 || request.Messages[0].Role != "system" {
			t.Errorf("agent system message missing: %#v", request.Messages)
		}
		w.Header().Set("Content-Type", "application/json")
		switch calls.Add(1) {
		case 1:
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"","tool_calls":[{"id":"read-1","type":"function","function":{"name":"read_artifact","arguments":"{\"node_id\":\"artifact-1\"}"}}]}}]}`))
		case 2:
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"","tool_calls":[{"id":"edit-1","type":"function","function":{"name":"apply_edit","arguments":"{\"node_id\":\"artifact-1\",\"search_text\":\"needle\",\"replacement\":\"updated\",\"edit_summary\":\"test\"}"}}]}}]}`))
		default:
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"編集しました"}}]}`))
		}
	}))
	defer server.Close()
	llm := NewLLMService(&ConfigService{config: &Config{LLM: LLMConfig{BaseURL: server.URL, Model: "test"}}})
	service := NewChatService(llm)
	events := make(chan ChatEvent, 16)
	service.SetEmitter(func(event ChatEvent) {
		if event.RunID != "run-1" || event.SessionID != "session-1" {
			t.Errorf("event correlation missing: %#v", event)
		}
		events <- event
		if event.Type == "chat:tool_apply" && event.Apply != nil {
			if event.Apply.TargetNodeID != "artifact-1" || event.Apply.BaseRevision != 3 {
				t.Errorf("edit correlation missing: %#v", event.Apply)
			}
			if err := service.Resolve(ToolApplicationResult{ToolCallID: event.Apply.ToolCallID, Status: "applied"}); err != nil {
				t.Errorf("resolve apply: %v", err)
			}
		}
	})
	request := testChatRequest("replace the word")
	if err := service.Send(request); err != nil {
		t.Fatal(err)
	}
	deadline := time.After(3 * time.Second)
	terminalCount := 0
	streamSeen := false
	toolStart := 0
	toolDone := 0
	applySeen := false
	for {
		select {
		case event := <-events:
			switch event.Type {
			case "chat:stream":
				streamSeen = true
			case "chat:tool_start":
				toolStart++
			case "chat:tool_done":
				toolDone++
			case "chat:tool_apply":
				applySeen = true
			case "chat:done":
				terminalCount++
			case "chat:error", "chat:cancelled":
				t.Fatalf("unexpected terminal event: %#v", event)
			}
			if terminalCount == 1 {
				if !streamSeen || toolStart != 2 || toolDone != 2 || !applySeen || calls.Load() != 3 {
					t.Fatalf("incomplete event sequence: stream=%v starts=%d done=%d apply=%v calls=%d", streamSeen, toolStart, toolDone, applySeen, calls.Load())
				}
				return
			}
		case <-deadline:
			t.Fatal("timed out waiting for agent completion")
		}
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return fn(request) }
