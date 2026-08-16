package backend

import (
	"fmt"
	"strings"
	"testing"
)

func orchestrationFixture() NextActionRequest {
	return NextActionRequest{RequestID: "req-1", WorkspaceID: "ws", CanvasID: "canvas", RuntimeGeneration: "gen", ScopeEpoch: 1, ContextDigest: "digest", FocusText: "compare options", SelectedNodeIDs: []string{"a", "b"}, NodeHints: []OrchestrationNodeHint{{ID: "a", Type: "text", Revision: 2, Label: "A", Excerpt: "first"}, {ID: "b", Type: "artifact", Revision: 3, Label: "B", Excerpt: "second"}}, SourceRevisions: map[string]int64{"a": 2, "b": 3}}
}

func TestParseNextActionsAssignsFixedMapping(t *testing.T) {
	r := orchestrationFixture()
	got, err := ParseNextActions(`{"actions":[{"kind":"compare","targetNodeIds":["a","b"],"title":"Compare","reason":"Need axes","expectedResult":"Derived text"}]}`, r, EligibleNextActionKinds(r))
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Actions) != 1 || got.Actions[0].Role != "comparer" || got.Actions[0].ActionLevel != "AL-2" || got.Actions[0].Route != "direct-transform" {
		t.Fatalf("unexpected mapping: %+v", got.Actions)
	}
}

func TestParseNextActionsRejectsWholeSetOnPartialInvalid(t *testing.T) {
	r := orchestrationFixture()
	_, err := ParseNextActions(`{"actions":[{"kind":"compare","targetNodeIds":["a","b"],"title":"ok","reason":"r","expectedResult":"e"},{"kind":"unknown","targetNodeIds":[],"title":"bad","reason":"r","expectedResult":"e"}]}`, r, EligibleNextActionKinds(r))
	if err == nil {
		t.Fatal("expected invalid action to reject whole proposal")
	}
}

func TestFixtureNextActionsOneShotAndNoContextClarify(t *testing.T) {
	f := &FixtureLLM{}
	r := orchestrationFixture()
	_, err := f.NextActionsResponse(EligibleNextActionKinds(r), r.SelectedNodeIDs)
	if err != nil {
		t.Fatal(err)
	}
	calls, _, _ := f.Observations()
	if calls != 1 {
		t.Fatalf("calls=%d", calls)
	}
	noContext := r
	noContext.FocusText = ""
	noContext.SelectedNodeIDs = nil
	got, err := ParseNextActions(`{"actions":[{"kind":"clarify","targetNodeIds":[],"title":"Question","reason":"Need focus","expectedResult":"A focus","question":"What matters?"}]}`, noContext, []NextActionKind{ActionClarify})
	if err != nil || len(got.Actions) != 1 {
		t.Fatalf("clarify failed: %+v %v", got, err)
	}
}

func TestNextActionRequestRejectsRevisionAndNodeCaps(t *testing.T) {
	r := orchestrationFixture()
	r.SourceRevisions["a"] = 9
	if err := r.Validate(); err == nil {
		t.Fatal("expected revision conflict")
	}
	for i := 0; i <= MaxOrchestrationNodes; i++ {
		r.NodeHints = append(r.NodeHints, OrchestrationNodeHint{ID: string(rune('x' + i)), Type: "text", Revision: 0})
	}
	if err := r.Validate(); err == nil {
		t.Fatal("expected node cap")
	}
}

func TestParseNextActionsRejectsWrongTargetTypeAndBlankSearchQuery(t *testing.T) {
	r := orchestrationFixture()
	r.NodeHints = append(r.NodeHints, OrchestrationNodeHint{ID: "image", Type: "image", Revision: 1, Label: "Image"})
	r.SourceRevisions["image"] = 1
	_, err := ParseNextActions(`{"actions":[{"kind":"compare","targetNodeIds":["a","image"],"title":"bad","reason":"r","expectedResult":"e"}]}`, r, EligibleNextActionKinds(r))
	if err == nil {
		t.Fatal("expected compare image target to reject")
	}
	_, err = ParseNextActions(`{"actions":[{"kind":"web_search","targetNodeIds":[],"query":"  ","title":"search","reason":"r","expectedResult":"e"}]}`, r, EligibleNextActionKinds(r))
	if err == nil {
		t.Fatal("expected blank search query to reject")
	}
}

func TestBuildNextActionPromptIncludesBoundedRelationAndViewHints(t *testing.T) {
	r := orchestrationFixture()
	r.RelationHints = []OrchestrationRelationHint{{RelationID: "rel-1", SourceNodeID: "a", TargetNodeID: "b", Kind: "supports", Reason: "accepted"}}
	r.ViewHints = []OrchestrationViewHint{{ViewID: "view-1", Kind: "cluster", Label: "Options"}}
	prompt := BuildNextActionPrompt(r, EligibleNextActionKinds(r))
	if !strings.Contains(prompt, "rel-1") || !strings.Contains(prompt, "view-1") {
		t.Fatalf("prompt omitted bounded hints: %s", prompt)
	}
	for _, phrase := range []string{
		"Read-only planner",
		"do not execute actions",
		"1-3 actions",
		"available kinds only",
		"selected IDs only",
		"no duplicate kinds",
		"one concrete clarify question",
		"Do not return generic menus",
		"provider/model recommendations",
		"Return JSON only",
	} {
		if !strings.Contains(prompt, phrase) {
			t.Fatalf("prompt omitted contract phrase %q: %s", phrase, prompt)
		}
	}
}

func TestParseNextActionsValidationMatrix(t *testing.T) {
	r := orchestrationFixture()
	cases := map[string]string{
		"unknown-kind":     `{"actions":[{"kind":"unknown","targetNodeIds":[],"title":"x","reason":"r","expectedResult":"e"}]}`,
		"duplicate-kind":   `{"actions":[{"kind":"counterpoint","targetNodeIds":["a"],"title":"x","reason":"r","expectedResult":"e"},{"kind":"counterpoint","targetNodeIds":["b"],"title":"y","reason":"r","expectedResult":"e"}]}`,
		"zero-actions":     `{"actions":[]}`,
		"four-actions":     `{"actions":[{"kind":"clarify","title":"x","reason":"r","expectedResult":"e","question":"q"},{"kind":"counterpoint","targetNodeIds":["a"],"title":"x","reason":"r","expectedResult":"e"},{"kind":"web_search","targetNodeIds":[],"query":"q","title":"x","reason":"r","expectedResult":"e"},{"kind":"compare","targetNodeIds":["a","b"],"title":"x","reason":"r","expectedResult":"e"}]}`,
		"empty-text":       `{"actions":[{"kind":"compare","targetNodeIds":["a","b"],"title":"","reason":"r","expectedResult":"e"}]}`,
		"too-long":         fmt.Sprintf(`{"actions":[{"kind":"compare","targetNodeIds":["a","b"],"title":"%s","reason":"r","expectedResult":"e"}]}`, strings.Repeat("x", 161)),
		"wrong-target":     `{"actions":[{"kind":"compare","targetNodeIds":["missing","b"],"title":"x","reason":"r","expectedResult":"e"}]}`,
		"wrong-arity":      `{"actions":[{"kind":"compare","targetNodeIds":["a"],"title":"x","reason":"r","expectedResult":"e"}]}`,
		"target-duplicate": `{"actions":[{"kind":"counterpoint","targetNodeIds":["a","a"],"title":"x","reason":"r","expectedResult":"e"}]}`,
		"blank-query":      `{"actions":[{"kind":"web_search","targetNodeIds":[],"query":" ","title":"x","reason":"r","expectedResult":"e"}]}`,
		"empty-question":   `{"actions":[{"kind":"clarify","targetNodeIds":[],"title":"x","reason":"r","expectedResult":"e","question":" "}]}`,
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseNextActions(raw, r, EligibleNextActionKinds(r)); err == nil {
				t.Fatalf("expected validation failure for %s", name)
			}
		})
	}
}

func TestParseNextActionsRejectsKindSpecificShapeAndUnknownFields(t *testing.T) {
	r := orchestrationFixture()
	cases := map[string]string{
		"unknown-field":     `{"actions":[{"kind":"compare","targetNodeIds":["a","b"],"title":"x","reason":"r","expectedResult":"e","executor":"provider"}]}`,
		"trailing-json":     `{"actions":[{"kind":"compare","targetNodeIds":["a","b"],"title":"x","reason":"r","expectedResult":"e"}]} {}`,
		"clarify-query":     `{"actions":[{"kind":"clarify","targetNodeIds":[],"title":"x","reason":"r","expectedResult":"e","question":"q","query":"unexpected"}]}`,
		"search-question":   `{"actions":[{"kind":"web_search","targetNodeIds":[],"title":"x","reason":"r","expectedResult":"e","query":"q","question":"unexpected"}]}`,
		"targeted-question": `{"actions":[{"kind":"counterpoint","targetNodeIds":["a"],"title":"x","reason":"r","expectedResult":"e","question":"unexpected"}]}`,
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseNextActions(raw, r, EligibleNextActionKinds(r)); err == nil {
				t.Fatalf("expected strict shape rejection for %s", name)
			}
		})
	}
}
