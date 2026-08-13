package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

type PacketStatus string

const (
	PacketComplete PacketStatus = "complete"
	PacketPartial  PacketStatus = "partial"
	PacketFailed   PacketStatus = "failed"
)

type ContextSource struct {
	SourceID    string `json:"sourceId"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Domain      string `json:"domain"`
	Snippet     string `json:"snippet"`
	RetrievedAt string `json:"retrievedAt"`
	ClusterID   string `json:"clusterId,omitempty"`
}

type ContextClaim struct {
	ClaimID        string   `json:"claimId"`
	Kind           string   `json:"kind"`
	Text           string   `json:"text"`
	SourceIDs      []string `json:"sourceIds"`
	RelatedNodeIDs []string `json:"relatedNodeIds,omitempty"`
}

type SuggestedPacketRelation struct {
	ClaimID      string `json:"claimId,omitempty"`
	SourceID     string `json:"sourceId,omitempty"`
	TargetNodeID string `json:"targetNodeId"`
	Kind         string `json:"kind"`
	Reason       string `json:"reason,omitempty"`
}

type ContextPacketError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ContextPacket struct {
	PacketID           string                    `json:"packetId"`
	Query              string                    `json:"query"`
	RetrievedAt        string                    `json:"retrievedAt"`
	Executor           string                    `json:"executor"`
	ContextProvider    string                    `json:"contextProvider"`
	Status             PacketStatus              `json:"status"`
	WorkspaceID        string                    `json:"workspaceId"`
	CanvasID           string                    `json:"canvasId"`
	RuntimeGeneration  string                    `json:"runtimeGeneration"`
	ScopeEpoch         int64                     `json:"scopeEpoch"`
	RunID              string                    `json:"runId,omitempty"`
	RunEpoch           int64                     `json:"runEpoch,omitempty"`
	Sources            []ContextSource           `json:"sources"`
	Claims             []ContextClaim            `json:"claims"`
	SuggestedRelations []SuggestedPacketRelation `json:"suggestedRelations"`
	Unresolved         []string                  `json:"unresolved"`
	Followups          []string                  `json:"followups"`
	Error              *ContextPacketError       `json:"error,omitempty"`
}

type WebSearchRequest struct {
	Query             string   `json:"query"`
	HintNodeIDs       []string `json:"hintNodeIds,omitempty"`
	HintSummaries     []string `json:"hintSummaries,omitempty"`
	KnownURLs         []string `json:"knownUrls,omitempty"`
	WorkspaceID       string   `json:"workspaceId"`
	CanvasID          string   `json:"canvasId"`
	RuntimeGeneration string   `json:"runtimeGeneration"`
	ScopeEpoch        int64    `json:"scopeEpoch"`
	EntryRoute        string   `json:"entryRoute"`
	MaxSources        int      `json:"maxSources,omitempty"`
	RunID             string   `json:"runId,omitempty"`
	RunEpoch          int64    `json:"runEpoch,omitempty"`
}

func providerLabel(id string) string {
	switch id {
	case "ollama":
		return "ollama-web"
	case "kagi":
		return "kagi-web"
	case "brave":
		return "brave-web"
	case "fake":
		return "fake-web"
	default:
		return id
	}
}

func failedPacket(req WebSearchRequest, ids IDGenerator, clock Clock, provider string, code, message string) ContextPacket {
	return ContextPacket{
		PacketID:           ids.Next("packet"),
		Query:              req.Query,
		RetrievedAt:        clock.NowISO(),
		Executor:           "direct-tool",
		ContextProvider:    providerLabel(provider),
		Status:             PacketFailed,
		WorkspaceID:        req.WorkspaceID,
		CanvasID:           req.CanvasID,
		RuntimeGeneration:  req.RuntimeGeneration,
		ScopeEpoch:         req.ScopeEpoch,
		RunID:              req.RunID,
		RunEpoch:           req.RunEpoch,
		Sources:            []ContextSource{},
		Claims:             []ContextClaim{},
		SuggestedRelations: []SuggestedPacketRelation{},
		Unresolved:         []string{},
		Followups:          []string{},
		Error:              &ContextPacketError{Code: code, Message: message},
	}
}

func normalizeHits(hits []WebSearchHit, known []NormalizedHTTPSURL, retrievedAt string, ids IDGenerator, maxSources int) []ContextSource {
	if maxSources <= 0 || maxSources > maxWebSearchSources {
		maxSources = maxWebSearchSources
	}
	seen := map[string]bool{}
	sources := make([]ContextSource, 0, maxSources)
	appendSource := func(title, rawURL, snippet string) {
		if len(sources) >= maxSources {
			return
		}
		normalized, err := NormalizeHTTPSURL(rawURL)
		if err != nil {
			return
		}
		if seen[normalized.URL] {
			return
		}
		seen[normalized.URL] = true
		if strings.TrimSpace(title) == "" {
			title = normalized.URL
		}
		sources = append(sources, ContextSource{
			SourceID:    ids.Next("source"),
			Title:       title,
			URL:         normalized.URL,
			Domain:      normalized.Domain,
			Snippet:     snippet,
			RetrievedAt: retrievedAt,
			ClusterID:   "cluster:" + normalized.Domain,
		})
	}
	for _, hit := range hits {
		appendSource(hit.Title, hit.URL, hit.Snippet)
	}
	for _, knownURL := range known {
		appendSource(knownURL.URL, knownURL.URL, "")
	}
	return sources
}

func fixtureClaimsAndRelations(sources []ContextSource, hintNodeIDs []string, ids IDGenerator) ([]ContextClaim, []SuggestedPacketRelation) {
	if len(sources) == 0 {
		return nil, nil
	}
	first := sources[0]
	cited := []string{first.SourceID}
	if len(sources) > 1 {
		cited = append(cited, sources[1].SourceID)
	}
	claims := []ContextClaim{
		{
			ClaimID:   ids.Next("claim"),
			Kind:      "consensus",
			Text:      "Multiple sources discuss " + first.Title + ".",
			SourceIDs: cited[:1],
		},
		{
			ClaimID:   ids.Next("claim"),
			Kind:      "disagreement",
			Text:      "At least one source reports a conflicting detail.",
			SourceIDs: cited,
		},
	}
	relations := []SuggestedPacketRelation{}
	if len(hintNodeIDs) > 0 {
		relations = append(relations, SuggestedPacketRelation{
			ClaimID:      claims[0].ClaimID,
			TargetNodeID: hintNodeIDs[0],
			Kind:         "supports",
			Reason:       "Search result may support the selected note.",
		})
	}
	return claims, relations
}

func synthesizeClaims(llm LLMPort, query string, sources []ContextSource, hints []string, ids IDGenerator) ([]ContextClaim, []SuggestedPacketRelation, error) {
	if llm == nil || len(sources) == 0 {
		return nil, nil, fmt.Errorf("synthesis unavailable")
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"query":   query,
		"hints":   hints,
		"sources": sources,
	})
	prompt := "Return JSON only with keys claims and suggestedRelations. " +
		"claims[].kind must be one of consensus, disagreement, minority, uncertainty, freshness. " +
		"Each claim must cite one or more sourceId values from the sources. " +
		"Do not invent URLs. Do not treat sources as proven facts.\n\n" +
		string(payload)
	raw, err := llm.GenerateText(prompt, string(payload))
	if err != nil {
		return nil, nil, err
	}
	raw = strings.TrimSpace(raw)
	if i := strings.Index(raw, "{"); i >= 0 {
		if j := strings.LastIndex(raw, "}"); j > i {
			raw = raw[i : j+1]
		}
	}
	var parsed struct {
		Claims []ContextClaim            `json:"claims"`
		Rels   []SuggestedPacketRelation `json:"suggestedRelations"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, nil, err
	}
	valid := map[string]bool{}
	for _, source := range sources {
		valid[source.SourceID] = true
	}
	claims := make([]ContextClaim, 0, len(parsed.Claims))
	usedClaimIDs := map[string]bool{}
	for _, claim := range parsed.Claims {
		kept := claim.SourceIDs[:0]
		for _, id := range claim.SourceIDs {
			if valid[id] {
				kept = append(kept, id)
			}
		}
		claim.SourceIDs = kept
		if len(claim.SourceIDs) == 0 || strings.TrimSpace(claim.Text) == "" {
			continue
		}
		// LLMs frequently omit the schema's logical ID. Never expose an empty or
		// duplicate ID: the frontend uses it as both the React key and selection
		// identity.
		if strings.TrimSpace(claim.ClaimID) == "" || usedClaimIDs[claim.ClaimID] {
			claim.ClaimID = ids.Next("claim")
		}
		usedClaimIDs[claim.ClaimID] = true
		claims = append(claims, claim)
	}
	return claims, parsed.Rels, nil
}

func ExecuteWebSearch(ctx context.Context, port WebSearchPort, req WebSearchRequest, ids IDGenerator, clock Clock, llm LLMPort) (ContextPacket, error) {
	provider := "unknown"
	if port != nil {
		provider = port.ID()
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return failedPacket(req, ids, clock, provider, ErrWebSearchInvalidQuery, "query is required"), nil
	}
	known, err := ValidateKnownURLs(req.KnownURLs)
	if err != nil {
		return failedPacket(req, ids, clock, provider, ErrWebSearchInvalidURL, err.Error()), nil
	}
	if port == nil {
		return failedPacket(req, ids, clock, provider, ErrWebSearchUnknownProvider, "no search strategy"), nil
	}
	searchCtx, cancel := context.WithTimeout(ctx, defaultWebSearchTimeout)
	defer cancel()
	hits, err := port.Search(searchCtx, query, clampSearchMax(req.MaxSources))
	if err != nil {
		code := ErrWebSearchProviderError
		if ws, ok := err.(*WebSearchError); ok {
			code = ws.Code
		} else if searchCtx.Err() != nil {
			code = ErrWebSearchTimeout
		}
		return failedPacket(req, ids, clock, provider, code, err.Error()), nil
	}
	retrievedAt := clock.NowISO()
	sources := normalizeHits(hits, known, retrievedAt, ids, clampSearchMax(req.MaxSources))
	packet := ContextPacket{
		PacketID:           ids.Next("packet"),
		Query:              query,
		RetrievedAt:        retrievedAt,
		Executor:           "direct-tool",
		ContextProvider:    providerLabel(provider),
		Status:             PacketComplete,
		WorkspaceID:        req.WorkspaceID,
		CanvasID:           req.CanvasID,
		RuntimeGeneration:  req.RuntimeGeneration,
		ScopeEpoch:         req.ScopeEpoch,
		RunID:              req.RunID,
		RunEpoch:           req.RunEpoch,
		Sources:            sources,
		Claims:             []ContextClaim{},
		SuggestedRelations: []SuggestedPacketRelation{},
		Unresolved:         []string{},
		Followups:          []string{},
	}
	if len(sources) == 0 {
		packet.Status = PacketFailed
		packet.Error = &ContextPacketError{Code: ErrWebSearchEmpty, Message: "no usable sources"}
		return packet, nil
	}
	if provider == "fake" {
		packet.Claims, packet.SuggestedRelations = fixtureClaimsAndRelations(sources, req.HintNodeIDs, ids)
		return packet, nil
	}
	claims, rels, synthErr := synthesizeClaims(llm, query, sources, req.HintSummaries, ids)
	if synthErr != nil {
		packet.Status = PacketPartial
		packet.Unresolved = append(packet.Unresolved, "synthesis-failed")
		return packet, nil
	}
	packet.Claims = claims
	packet.SuggestedRelations = rels
	if len(claims) == 0 {
		packet.Status = PacketPartial
	}
	return packet, nil
}

func packetModelSummary(packet ContextPacket) string {
	titles := make([]string, 0, len(packet.Sources))
	for _, source := range packet.Sources {
		titles = append(titles, source.Title+" <"+source.URL+">")
	}
	claims := make([]string, 0, len(packet.Claims))
	for _, claim := range packet.Claims {
		claims = append(claims, claim.Kind+": "+claim.Text)
	}
	body, _ := json.Marshal(map[string]interface{}{
		"packetId": packet.PacketID,
		"query":    packet.Query,
		"status":   packet.Status,
		"sources":  titles,
		"claims":   claims,
	})
	return string(body)
}
