package backend

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestExecuteWebSearchFakeBuildsPacketWithoutMutationContract(t *testing.T) {
	ids := NewSeededIDGenerator("t")
	clock := NewFakeClock(time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC))
	packet, err := ExecuteWebSearch(context.Background(), NewFixtureWebSearch(), WebSearchRequest{
		Query:             "alpha topic",
		HintNodeIDs:       []string{"node-1"},
		HintSummaries:     []string{"Selected note"},
		WorkspaceID:       "ws",
		CanvasID:          "canvas",
		RuntimeGeneration: "gen",
		ScopeEpoch:        1,
		EntryRoute:        "direct-action",
	}, ids, clock, nil)
	if err != nil {
		t.Fatal(err)
	}
	if packet.Status != PacketComplete {
		t.Fatalf("status=%s err=%#v", packet.Status, packet.Error)
	}
	if packet.ContextProvider != "fake-web" {
		t.Fatalf("provider=%s", packet.ContextProvider)
	}
	if len(packet.Sources) != 3 {
		t.Fatalf("sources=%d want 3 after URL collapse", len(packet.Sources))
	}
	if packet.Sources[0].URL == packet.Sources[1].URL {
		t.Fatal("duplicate URL survived")
	}
	clusters := map[string]int{}
	for _, source := range packet.Sources {
		clusters[source.ClusterID]++
	}
	if clusters["cluster:example.com"] < 2 {
		t.Fatalf("same-domain cluster missing: %#v", clusters)
	}
	if len(packet.Claims) != 2 || len(packet.Claims[0].SourceIDs) == 0 {
		t.Fatalf("claims=%#v", packet.Claims)
	}
	if len(packet.SuggestedRelations) != 1 || packet.SuggestedRelations[0].TargetNodeID != "node-1" {
		t.Fatalf("relations=%#v", packet.SuggestedRelations)
	}
}

func TestExecuteWebSearchKnownURLIsMetadataOnly(t *testing.T) {
	ids := NewSeededIDGenerator("t")
	clock := NewFakeClock(time.Date(2026, 8, 13, 0, 0, 0, 0, time.UTC))
	packet, err := ExecuteWebSearch(context.Background(), &FixtureWebSearch{Hits: []WebSearchHit{}}, WebSearchRequest{
		Query:       "known",
		KnownURLs:   []string{"https://known.example/page"},
		WorkspaceID: "ws", CanvasID: "c", RuntimeGeneration: "g", ScopeEpoch: 0,
	}, ids, clock, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(packet.Sources) != 1 || packet.Sources[0].URL != "https://known.example/page" {
		t.Fatalf("sources=%#v", packet.Sources)
	}
	if packet.Sources[0].Snippet != "" || packet.Sources[0].Title != "https://known.example/page" {
		t.Fatalf("known URL should be metadata only: %#v", packet.Sources[0])
	}
}

func TestExecuteWebSearchRejectsInvalidKnownURL(t *testing.T) {
	packet, err := ExecuteWebSearch(context.Background(), NewFixtureWebSearch(), WebSearchRequest{
		Query: "q", KnownURLs: []string{"http://insecure.example"},
		WorkspaceID: "ws", CanvasID: "c", RuntimeGeneration: "g",
	}, NewSeededIDGenerator("t"), SystemClock{}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if packet.Status != PacketFailed || packet.Error == nil || packet.Error.Code != ErrWebSearchInvalidURL {
		t.Fatalf("packet=%#v", packet)
	}
}

func TestExecuteWebSearchErrorsDoNotInventSources(t *testing.T) {
	packet, err := ExecuteWebSearch(context.Background(), &FixtureWebSearch{FaultCode: ErrWebSearchTimeout}, WebSearchRequest{
		Query: "q", WorkspaceID: "ws", CanvasID: "c", RuntimeGeneration: "g",
	}, NewSeededIDGenerator("t"), SystemClock{}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if packet.Status != PacketFailed || len(packet.Sources) != 0 || len(packet.Claims) != 0 {
		t.Fatalf("failed packet must be empty: %#v", packet)
	}
	if packet.Error.Code != ErrWebSearchTimeout {
		t.Fatalf("code=%s", packet.Error.Code)
	}
}

func TestPacketSummaryOmitsSecrets(t *testing.T) {
	summary := packetModelSummary(ContextPacket{
		PacketID: "p1",
		Query:    "q",
		Status:   PacketComplete,
		Sources:  []ContextSource{{Title: "T", URL: "https://example.com"}},
		Claims:   []ContextClaim{{Kind: "consensus", Text: "c"}},
	})
	if strings.Contains(summary, "apiKey") || strings.Contains(summary, "Bearer") {
		t.Fatalf("summary leaked secret: %s", summary)
	}
}

func TestSynthesizeClaimsAssignsUniqueIDsWhenModelOmitsThem(t *testing.T) {
	sources := []ContextSource{{SourceID: "source-1", Title: "A", URL: "https://example.com/a"}}
	llm := &FixtureLLM{Text: `{"claims":[{"kind":"consensus","text":"first","sourceIds":["source-1"]},{"kind":"uncertainty","text":"second","sourceIds":["source-1"]}],"suggestedRelations":[]}`}
	claims, _, err := synthesizeClaims(llm, "q", sources, nil, NewSeededIDGenerator("t"))
	if err != nil {
		t.Fatal(err)
	}
	if len(claims) != 2 || claims[0].ClaimID == "" || claims[1].ClaimID == "" || claims[0].ClaimID == claims[1].ClaimID {
		t.Fatalf("claim IDs must be unique: %#v", claims)
	}
}

func TestRandomIDGeneratorDoesNotCollideAcrossBurst(t *testing.T) {
	ids := RandomIDGenerator{}
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		id := ids.Next("source")
		if seen[id] {
			t.Fatalf("duplicate id %q", id)
		}
		seen[id] = true
	}
}
