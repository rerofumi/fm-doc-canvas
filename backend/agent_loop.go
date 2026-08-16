package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
)

type toolResult struct {
	Status   string
	Content  string
	Proposal *ToolApplyProposal
}

type agentRunState struct {
	request   ChatRequest
	readRevs  map[string]int64
	readNodes map[string]NodeSnapshot
	approve   func(context.Context, *ToolApplyProposal) ToolApplicationResult
	search    WebSearchPort
	image     ImagePort
	assets    ImageAssetPort
	ids       IDGenerator
	clock     Clock
	emit      func(ChatEvent)
	llm       LLMPort
}

func toolDefinitions() []ToolDefinition {
	obj := func(properties string, required string) json.RawMessage {
		return json.RawMessage(fmt.Sprintf(`{"type":"object","properties":{%s},"required":[%s]}`, properties, required))
	}
	return []ToolDefinition{
		{Type: "function", Function: ToolFunctionDef{Name: "read_artifact", Description: "Read one Artifact node and record its revision.", Parameters: obj(`"node_id":{"type":"string"}`, `"node_id"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "apply_edit", Description: "Replace exactly one matching substring in a Text or Artifact node after reading it.", Parameters: obj(`"node_id":{"type":"string"},"search_text":{"type":"string"},"replacement":{"type":"string"},"edit_summary":{"type":"string"}`, `"node_id","search_text","replacement","edit_summary"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "write_artifact", Description: "Replace a read Artifact or propose a new Artifact only when explicitly requested.", Parameters: obj(`"node_id":{"type":"string"},"filename":{"type":"string"},"content":{"type":"string"},"edit_summary":{"type":"string"}`, `"content","edit_summary"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "list_artifacts", Description: "List Artifact nodes without returning their full content.", Parameters: obj(``, ``)}},
		{Type: "function", Function: ToolFunctionDef{Name: "search_artifact", Description: "Search Artifact contents for a non-empty query.", Parameters: obj(`"query":{"type":"string"},"node_ids":{"type":"array","items":{"type":"string"}},"max_results":{"type":"integer"}`, `"query"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "read_canvas_node", Description: "Read any Text, Artifact, or Image node from the request snapshot.", Parameters: obj(`"node_id":{"type":"string"}`, `"node_id"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "list_canvas_nodes", Description: "List Canvas node IDs and short identifiers without full content.", Parameters: obj(`"types":{"type":"array","items":{"type":"string"}}`, ``)}},
		{Type: "function", Function: ToolFunctionDef{Name: "propose_transform", Description: "Propose a non-destructive summarize, compare, or counterpoint Text node derived from nodes already read with read_canvas_node.", Parameters: obj(`"operation":{"type":"string","enum":["summarize","compare","counterpoint"]},"source_node_ids":{"type":"array","items":{"type":"string"}},"content":{"type":"string"},"summary":{"type":"string"},"reason":{"type":"string"},"suggested_relations":{"type":"array","items":{"type":"object"}}`, `"operation","source_node_ids","content","summary"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "propose_relation", Description: "Propose a typed Relation between two nodes already read with read_canvas_node. Does not mutate until the human accepts.", Parameters: obj(`"source_node_id":{"type":"string"},"target_node_id":{"type":"string"},"kind":{"type":"string","enum":["source","derived","supports","opposes","similar"]},"reason":{"type":"string"},"direction":{"type":"string","enum":["forward","reverse"]}`, `"source_node_id","target_node_id","kind"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "propose_relation_batch", Description: "Propose up to 8 typed Relations across multiple nodes already read with read_canvas_node. Does not mutate until the human accepts.", Parameters: obj(`"relations":{"type":"array","items":{"type":"object","properties":{"source_node_id":{"type":"string"},"target_node_id":{"type":"string"},"kind":{"type":"string","enum":["source","derived","supports","opposes","similar"]},"reason":{"type":"string"},"direction":{"type":"string","enum":["forward","reverse"]}},"required":["source_node_id","target_node_id","kind"]}},"reason":{"type":"string"}`, `"relations"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "propose_cluster_view", Description: "Propose a temporary Cluster View grouping nodes already read with read_canvas_node. Does not mutate until the human accepts; only a human converts a cluster to a SubCanvas.", Parameters: obj(`"label":{"type":"string"},"clusters":{"type":"array","items":{"type":"object","properties":{"label":{"type":"string"},"reason":{"type":"string"},"node_ids":{"type":"array","items":{"type":"string"}}},"required":["label","node_ids"]}},"ungrouped_node_ids":{"type":"array","items":{"type":"string"}}`, `"label","clusters"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "web_search", Description: "Search the web for a query and return a Context Packet of observed sources. Does not create nodes. Optional known_urls must be https.", Parameters: obj(`"query":{"type":"string"},"known_urls":{"type":"array","items":{"type":"string"}}`, `"query"`)}},
		{Type: "function", Function: ToolFunctionDef{Name: "generate_image", Description: "Generate an image from a prompt using the configured Image Provider. Returns an asset path and a proposal; it does not place a node until the human accepts. Optional source_node_ids are the allowlisted reference images/text already read.", Parameters: obj(`"prompt":{"type":"string"},"source_node_ids":{"type":"array","items":{"type":"string"}}`, `"prompt"`)}},
	}
}

func runAgent(ctx context.Context, llm LLMPort, req ChatRequest, emit func(ChatEvent), approve func(context.Context, *ToolApplyProposal) ToolApplicationResult, search WebSearchPort, image ImagePort, assets ImageAssetPort, ids IDGenerator, clock Clock) error {
	if llm == nil {
		return fmt.Errorf("agent LLM is unavailable")
	}
	state := &agentRunState{request: req, readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}, approve: approve, search: search, image: image, assets: assets, ids: ids, clock: clock, emit: emit, llm: llm}
	system := llm.AgentSystemPrompt()
	direct := req.Snapshot.directContext(req.DirectContextNodeIDs)
	user := fmt.Sprintf("Direct Canvas context:\n%s\n\nUser request:\n%s", direct, req.Prompt)
	if len(req.ViewHints) > 0 {
		user = formatViewHints(req.ViewHints) + "\n\n" + user
	}

	// Resolve vision images: allowlisted image nodes in snapshot with ImageIncluded=true
	visionImages := make([]NodeSnapshot, 0)
	allowSet := make(map[string]bool)
	if len(req.BodyAllowlistNodeIDs) > 0 {
		for _, id := range req.BodyAllowlistNodeIDs {
			allowSet[id] = true
		}
	} else {
		for _, id := range req.DirectContextNodeIDs {
			allowSet[id] = true
		}
	}
	for _, node := range req.Snapshot.Nodes {
		if node.Type == "image" && node.ImageIncluded && (len(allowSet) == 0 || allowSet[node.ID]) {
			visionImages = append(visionImages, node)
		}
	}

	var userContent interface{} = user
	if len(visionImages) > 0 {
		parts := make([]ContentPart, 0, 1+len(visionImages))
		parts = append(parts, ContentPart{Type: "text", Text: user})
		for _, img := range visionImages {
			if assets == nil {
				return fmt.Errorf("image-invalid-asset: image asset service is unavailable")
			}
			dataURL, err := assets.GetImageDataURL(img.ImageRef)
			if err != nil || !strings.HasPrefix(dataURL, "data:image/") || !strings.Contains(dataURL, ";base64,") {
				return fmt.Errorf("image-invalid-asset: %s", img.ImageRef)
			}
			parts = append(parts, ContentPart{
				Type:     "image_url",
				ImageURL: &ImageURL{URL: dataURL},
			})
		}
		userContent = parts
	}

	messages := []ChatMessage{{Role: "system", Content: system}, {Role: "user", Content: userContent}}
	tools := toolDefinitions()

	for round := 0; round < 10; round++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		response, err := llm.StreamAgentChat(ctx, messages, tools, func(chunk string) {
			emit(ChatEvent{RunID: req.RunID, SessionID: req.SessionID, Type: "chat:stream", Text: chunk})
		})
		if err != nil {
			return err
		}
		assistant := ChatMessage{Role: "assistant", Content: response.Content, ToolCalls: response.ToolCalls}
		messages = append(messages, assistant)
		if len(response.ToolCalls) == 0 {
			return nil
		}
		for index, call := range response.ToolCalls {
			if err := ctx.Err(); err != nil {
				return err
			}
			call = normalizeMergedToolCall(call)
			correlationID := fmt.Sprintf("%s:%d:%d:%s", req.RunID, round, index, call.ID)
			eventCall := call
			eventCall.ID = correlationID
			emit(ChatEvent{RunID: req.RunID, SessionID: req.SessionID, Type: "chat:tool_start", ToolEvent: &ToolEvent{ToolCallID: correlationID, Name: call.Function.Name, Status: "running"}})
			result := executeTool(ctx, state, eventCall)
			status := result.Status
			if status == "" {
				status = "done"
			}
			toolEvent := &ToolEvent{ToolCallID: correlationID, Name: call.Function.Name, Status: status}
			if result.Status == "error" || result.Status == "conflict" || result.Status == "cancelled" {
				toolEvent.Error = result.Content
			} else {
				toolEvent.Summary = result.Content
			}
			emit(ChatEvent{RunID: req.RunID, SessionID: req.SessionID, Type: "chat:tool_done", ToolEvent: toolEvent})
			// OpenAI-compatible providers identify a custom function result by both
			// the originating call id and function name. Gemini's compatibility
			// layer is strict about this correlation (and Gemini 3 also requires
			// the assistant tool-call metadata, including thought_signature, to be
			// replayed unchanged). Keep the provider id/name pair on the result;
			// the assistant message above already carries the original ToolCall.
			messages = append(messages, ChatMessage{Role: "tool", ToolCallID: call.ID, Name: call.Function.Name, Content: result.Content})
		}
	}
	return fmt.Errorf("maximum tool rounds (%d) reached", 10)
}

func executeTool(ctx context.Context, state *agentRunState, call ToolCall) toolResult {
	call = normalizeMergedToolCall(call)
	args := map[string]interface{}{}
	if err := json.Unmarshal([]byte(call.Function.Arguments), &args); err != nil {
		return toolResult{Status: "error", Content: "invalid tool arguments: " + err.Error()}
	}
	stringArg := func(name string) string { value, _ := args[name].(string); return value }
	nodeID := stringArg("node_id")

	lookup := func(id string) (NodeSnapshot, error) {
		node, ok := state.request.Snapshot.node(id)
		if !ok {
			return NodeSnapshot{}, fmt.Errorf("node %q was not found", id)
		}
		return node, nil
	}
	remember := func(node NodeSnapshot) {
		state.readRevs[node.ID] = node.Revision
		state.readNodes[node.ID] = node
	}
	jsonResult := func(value interface{}) toolResult {
		data, err := json.Marshal(value)
		if err != nil {
			return toolResult{Status: "error", Content: err.Error()}
		}
		return toolResult{Status: "done", Content: string(data)}
	}

	switch call.Function.Name {
	case "read_artifact":
		node, err := lookup(nodeID)
		if err != nil {
			return toolResult{Status: "error", Content: err.Error()}
		}
		if node.Type != "artifact" {
			return toolResult{Status: "error", Content: "node is not an artifact"}
		}
		remember(node)
		return jsonResult(map[string]interface{}{"nodeId": node.ID, "filename": node.Filename, "content": node.Markdown, "revision": node.Revision})

	case "read_canvas_node":
		node, err := lookup(nodeID)
		if err != nil {
			return toolResult{Status: "error", Content: err.Error()}
		}
		remember(node)
		if node.Type == "image" {
			return jsonResult(map[string]interface{}{"nodeId": node.ID, "type": node.Type, "imageRef": node.ImageRef, "prompt": node.Prompt, "imageIncluded": node.ImageIncluded})
		}
		return jsonResult(map[string]interface{}{"nodeId": node.ID, "type": node.Type, "markdown": node.Markdown, "revision": node.Revision})

	case "list_canvas_nodes":
		allowed := map[string]bool{}
		if values, ok := args["types"].([]interface{}); ok {
			for _, value := range values {
				if kind, ok := value.(string); ok {
					allowed[kind] = true
				}
			}
		}
		result := make([]map[string]string, 0, len(state.request.Snapshot.Nodes))
		for _, node := range state.request.Snapshot.Nodes {
			if len(allowed) > 0 && !allowed[node.Type] {
				continue
			}
			identifier := node.Filename
			if node.Type == "image" {
				identifier = node.Prompt
			}
			if node.Type == "text" {
				identifier = firstLine(node.Markdown)
			}
			result = append(result, map[string]string{"nodeId": node.ID, "type": node.Type, "identifier": truncate(identifier, 120)})
		}
		return jsonResult(result)

	case "propose_transform":
		op := stringArg("operation")
		if op != "summarize" && op != "compare" && op != "counterpoint" {
			return toolResult{Status: "error", Content: "unsupported transform operation"}
		}
		ids := []string{}
		if values, ok := args["source_node_ids"].([]interface{}); ok {
			for _, value := range values {
				if id, ok := value.(string); ok {
					ids = append(ids, id)
				}
			}
		}
		minimum := 1
		if op == "compare" {
			minimum = 2
		}
		if len(ids) < minimum {
			return toolResult{Status: "error", Content: "invalid-source-arity"}
		}
		previews := make([]TransformSourcePreview, 0, len(ids))
		for _, id := range ids {
			node, ok := state.readNodes[id]
			if !ok {
				return toolResult{Status: "error", Content: "read_canvas_node must succeed for every source"}
			}
			if node.Type != "text" && node.Type != "artifact" {
				return toolResult{Status: "error", Content: "source must be text-bearing"}
			}
			previews = append(previews, TransformSourcePreview{NodeID: id, Content: node.Markdown, Revision: state.readRevs[id]})
		}
		content := stringArg("content")
		if strings.TrimSpace(content) == "" {
			return toolResult{Status: "error", Content: "empty-transform-output"}
		}
		revisions := map[string]int64{}
		for _, id := range ids {
			revisions[id] = state.readRevs[id]
		}
		proposal := &ToolApplyProposal{
			ToolCallID:      call.ID,
			Operation:       "transform",
			Proposed:        content,
			LastEditSummary: stringArg("summary"),
			Transform: &TransformProposal{
				Operation:       op,
				SourceNodeIDs:   ids,
				SourceRevisions: revisions,
				Content:         content,
				Summary:         stringArg("summary"),
				Reason:          stringArg("reason"),
				Sources:         previews,
			},
		}
		return awaitApproval(ctx, state, proposal)

	case "propose_relation":
		sourceID := stringArg("source_node_id")
		targetID := stringArg("target_node_id")
		kind := stringArg("kind")
		if sourceID == "" || targetID == "" {
			return toolResult{Status: "error", Content: "source_node_id and target_node_id are required"}
		}
		if sourceID == targetID {
			return toolResult{Status: "error", Content: "self-relation"}
		}
		if kind != "source" && kind != "derived" && kind != "supports" && kind != "opposes" && kind != "similar" {
			return toolResult{Status: "error", Content: "invalid relation kind"}
		}
		source, okSource := state.readNodes[sourceID]
		target, okTarget := state.readNodes[targetID]
		if !okSource || !okTarget {
			return toolResult{Status: "error", Content: "read_canvas_node must succeed for both relation endpoints"}
		}
		_ = source
		_ = target
		direction := stringArg("direction")
		if direction == "" {
			direction = "forward"
		}
		if direction != "forward" && direction != "reverse" {
			return toolResult{Status: "error", Content: "invalid relation direction"}
		}
		fromID, toID := sourceID, targetID
		if direction == "reverse" {
			fromID, toID = targetID, sourceID
		}
		revisions := map[string]int64{
			sourceID: state.readRevs[sourceID],
			targetID: state.readRevs[targetID],
		}
		reason := stringArg("reason")
		summary := fmt.Sprintf("%s %s→%s", kind, fromID, toID)
		proposal := &ToolApplyProposal{
			ToolCallID:      call.ID,
			Operation:       "relation",
			Proposed:        summary,
			LastEditSummary: reason,
			Relation: &RelationProposal{
				SourceNodeID:    fromID,
				TargetNodeID:    toID,
				Kind:            kind,
				Reason:          reason,
				Direction:       direction,
				SourceRevisions: revisions,
			},
		}
		return awaitApproval(ctx, state, proposal)

	case "propose_relation_batch":
		items := []interface{}{}
		if values, ok := args["relations"].([]interface{}); ok {
			items = values
		}
		if len(items) == 0 {
			return toolResult{Status: "error", Content: "relations is required"}
		}
		if len(items) > MaxRelationBatch {
			return toolResult{Status: "error", Content: "relation-batch-cap-exceeded"}
		}
		relations := make([]RelationBatchItem, 0, len(items))
		revisions := map[string]int64{}
		seen := map[string]bool{}
		for _, raw := range items {
			obj, ok := raw.(map[string]interface{})
			if !ok {
				return toolResult{Status: "error", Content: "each relation must be an object"}
			}
			str := func(name string) string { value, _ := obj[name].(string); return value }
			item := RelationBatchItem{
				SourceNodeID: str("source_node_id"),
				TargetNodeID: str("target_node_id"),
				Kind:         str("kind"),
				Reason:       str("reason"),
				Direction:    normalizeDirection(str("direction")),
			}
			from, to := item.SourceNodeID, item.TargetNodeID
			if item.Direction == "reverse" {
				from, to = to, from
			}
			item.SourceNodeID, item.TargetNodeID = from, to
			if from == "" || to == "" {
				return toolResult{Status: "error", Content: "source_node_id and target_node_id are required"}
			}
			if from == to {
				return toolResult{Status: "error", Content: "self-relation"}
			}
			if !validRelationKind(item.Kind) {
				return toolResult{Status: "error", Content: "invalid relation kind"}
			}
			if _, ok := state.readNodes[from]; !ok {
				return toolResult{Status: "error", Content: "read_canvas_node must succeed for every relation endpoint"}
			}
			if _, ok := state.readNodes[to]; !ok {
				return toolResult{Status: "error", Content: "read_canvas_node must succeed for every relation endpoint"}
			}
			key := from + "|" + to + "|" + item.Kind
			if seen[key] {
				return toolResult{Status: "error", Content: "duplicate relation in batch"}
			}
			seen[key] = true
			revisions[from] = state.readRevs[from]
			revisions[to] = state.readRevs[to]
			relations = append(relations, item)
		}
		summary := fmt.Sprintf("%d relations proposed", len(relations))
		proposal := &ToolApplyProposal{
			ToolCallID:      call.ID,
			Operation:       "relation-batch",
			Proposed:        summary,
			LastEditSummary: stringArg("reason"),
			RelationBatch: &RelationBatchProposal{
				Relations:       relations,
				SourceRevisions: revisions,
			},
		}
		return awaitApproval(ctx, state, proposal)

	case "propose_cluster_view":
		label := stringArg("label")
		if strings.TrimSpace(label) == "" {
			return toolResult{Status: "error", Content: "label is required"}
		}
		rawClusters := []interface{}{}
		if values, ok := args["clusters"].([]interface{}); ok {
			rawClusters = values
		}
		if len(rawClusters) < MinClusterViewClusters {
			return toolResult{Status: "error", Content: "cluster-view-requires-2-clusters"}
		}
		if len(rawClusters) > MaxClusterViewClusters {
			return toolResult{Status: "error", Content: "cluster-view-cap-exceeded"}
		}
		clusters := make([]ClusterViewCluster, 0, len(rawClusters))
		seen := map[string]bool{}
		revisions := map[string]int64{}
		total := 0
		for _, raw := range rawClusters {
			obj, ok := raw.(map[string]interface{})
			if !ok {
				return toolResult{Status: "error", Content: "each cluster must be an object"}
			}
			clusterLabel, _ := obj["label"].(string)
			if strings.TrimSpace(clusterLabel) == "" {
				return toolResult{Status: "error", Content: "cluster-label-required"}
			}
			reason, _ := obj["reason"].(string)
			ids := []string{}
			if values, ok := obj["node_ids"].([]interface{}); ok {
				for _, value := range values {
					if id, ok := value.(string); ok {
						ids = append(ids, id)
					}
				}
			}
			if len(ids) == 0 {
				return toolResult{Status: "error", Content: "cluster-member-empty"}
			}
			for _, id := range ids {
				if _, ok := state.request.Snapshot.node(id); !ok {
					return toolResult{Status: "error", Content: "cluster-member-out-of-scope"}
				}
				if _, ok := state.readNodes[id]; !ok {
					return toolResult{Status: "error", Content: "read_canvas_node must succeed for every cluster member"}
				}
				if seen[id] {
					return toolResult{Status: "error", Content: "cluster-member-duplicate"}
				}
				seen[id] = true
				revisions[id] = state.readRevs[id]
				total++
			}
			clusters = append(clusters, ClusterViewCluster{Label: clusterLabel, Reason: reason, NodeIDs: ids})
		}
		if total > MaxClusterViewNodes {
			return toolResult{Status: "error", Content: "cluster-view-node-cap-exceeded"}
		}
		ungrouped := []string{}
		if values, ok := args["ungrouped_node_ids"].([]interface{}); ok {
			for _, value := range values {
				if id, ok := value.(string); ok {
					if _, ok := state.request.Snapshot.node(id); !ok {
						return toolResult{Status: "error", Content: "cluster-ungrouped-out-of-scope"}
					}
					if seen[id] {
						return toolResult{Status: "error", Content: "cluster-ungrouped-duplicate"}
					}
					ungrouped = append(ungrouped, id)
				}
			}
		}
		summary := fmt.Sprintf("%s (%d clusters)", label, len(clusters))
		proposal := &ToolApplyProposal{
			ToolCallID:      call.ID,
			Operation:       "generated-view",
			Proposed:        summary,
			LastEditSummary: label,
			GeneratedView: &ClusterViewProposal{
				ViewLabel:        label,
				Clusters:         clusters,
				UngroupedNodeIDs: ungrouped,
				SourceRevisions:  revisions,
			},
		}
		return awaitApproval(ctx, state, proposal)

	case "list_artifacts":
		result := make([]map[string]interface{}, 0)
		for _, node := range state.request.Snapshot.Nodes {
			if node.Type == "artifact" {
				result = append(result, map[string]interface{}{"nodeId": node.ID, "filename": node.Filename, "charCount": len([]rune(node.Markdown))})
			}
		}
		return jsonResult(result)

	case "search_artifact":
		query := stringArg("query")
		if strings.TrimSpace(query) == "" {
			return toolResult{Status: "error", Content: "query is required"}
		}
		allowed := map[string]bool{}
		if values, ok := args["node_ids"].([]interface{}); ok {
			for _, value := range values {
				if id, ok := value.(string); ok {
					allowed[id] = true
				}
			}
		}
		maxResults := 10
		if value, ok := args["max_results"].(float64); ok && value > 0 {
			maxResults = minInt(int(value), 50)
		}
		results := make([]map[string]interface{}, 0, maxResults)
		for _, node := range state.request.Snapshot.Nodes {
			if node.Type != "artifact" || (len(allowed) > 0 && !allowed[node.ID]) {
				continue
			}
			start := 0
			for len(results) < maxResults {
				index := strings.Index(node.Markdown[start:], query)
				if index < 0 {
					break
				}
				index += start
				results = append(results, map[string]interface{}{"nodeId": node.ID, "filename": node.Filename, "offset": index, "snippet": snippet(node.Markdown, index, len(query))})
				start = index + len(query)
				if start >= len(node.Markdown) {
					break
				}
			}
			if len(results) >= maxResults {
				break
			}
		}
		return jsonResult(results)

	case "apply_edit":
		node, ok := state.readNodes[nodeID]
		if !ok {
			return toolResult{Status: "error", Content: "read_canvas_node must succeed before apply_edit"}
		}
		if node.Type != "text" && node.Type != "artifact" {
			return toolResult{Status: "error", Content: "apply_edit supports Text and Artifact only"}
		}
		searchText := stringArg("search_text")
		replacement := stringArg("replacement")
		if searchText == "" {
			return toolResult{Status: "error", Content: "search_text is required"}
		}
		if strings.Count(node.Markdown, searchText) != 1 {
			return toolResult{Status: "error", Content: "search_text must match exactly one occurrence"}
		}
		proposal := &ToolApplyProposal{ToolCallID: call.ID, NodeID: nodeID, TargetNodeID: nodeID, BaseRevision: state.readRevs[nodeID], Operation: "edit", Proposed: strings.Replace(node.Markdown, searchText, replacement, 1), SearchText: searchText, Replacement: replacement, LastEditSummary: stringArg("edit_summary")}
		return awaitApproval(ctx, state, proposal)

	case "write_artifact":
		content := stringArg("content")
		if content == "" {
			return toolResult{Status: "error", Content: "content is required"}
		}
		if nodeID != "" {
			node, ok := state.readNodes[nodeID]
			if !ok || node.Type != "artifact" {
				return toolResult{Status: "error", Content: "read_artifact must succeed before replacing an Artifact"}
			}
			proposal := &ToolApplyProposal{ToolCallID: call.ID, NodeID: nodeID, TargetNodeID: nodeID, BaseRevision: state.readRevs[nodeID], Operation: "replace", Filename: node.Filename, Proposed: content, LastEditSummary: stringArg("edit_summary")}
			return awaitApproval(ctx, state, proposal)
		}
		if !explicitCreation(state.request.Prompt) {
			return toolResult{Status: "error", Content: "creating a new Artifact requires an explicit user request"}
		}
		filename := stringArg("filename")
		if filename == "" {
			filename = nextArtifactFilename(state.request.Snapshot)
		}
		proposal := &ToolApplyProposal{ToolCallID: call.ID, Operation: "create", Filename: filename, Proposed: content, LastEditSummary: stringArg("edit_summary")}
		return awaitApproval(ctx, state, proposal)

	case "generate_image":
		prompt := stringArg("prompt")
		if strings.TrimSpace(prompt) == "" {
			return toolResult{Status: "error", Content: "image-invalid-prompt"}
		}
		if state.image == nil {
			return toolResult{Status: "error", Content: "image generation is unavailable"}
		}
		// Resolve allowlisted source references. Only nodes already read via
		// read_canvas_node (or in the request snapshot allowlist) may be used as
		// reference images / context. Hidden bodies are never sent.
		sourceIDs := []string{}
		if values, ok := args["source_node_ids"].([]interface{}); ok {
			for _, value := range values {
				if id, ok := value.(string); ok {
					sourceIDs = append(sourceIDs, id)
				}
			}
		}
		refImages := []string{}
		contextSections := []string{}
		revisions := map[string]int64{}
		for _, id := range sourceIDs {
			node, ok := state.request.Snapshot.node(id)
			if !ok {
				return toolResult{Status: "error", Content: "image-source-out-of-scope"}
			}
			revisions[id] = node.Revision
			if node.Type == "image" {
				if state.assets == nil {
					return toolResult{Status: "error", Content: "image-invalid-asset"}
				}
				dataURL, err := state.assets.GetImageDataURL(node.ImageRef)
				if err != nil || !strings.HasPrefix(dataURL, "data:image/") || !strings.Contains(dataURL, ";base64,") {
					return toolResult{Status: "error", Content: "image-invalid-asset"}
				}
				refImages = append(refImages, dataURL)
			} else if node.Type == "text" || node.Type == "artifact" {
				contextSections = append(contextSections, fmt.Sprintf("Source %s (revision %d):\n%s", node.ID, node.Revision, node.Markdown))
			}
		}
		contextData := strings.Join(contextSections, "\n\n")
		var src string
		var err error
		if state.request.ImageProvider != "" {
			src, err = state.image.GenerateImageWithProvider(prompt, contextData, refImages, state.request.ImageProvider)
		} else {
			src, err = state.image.GenerateImage(prompt, contextData, refImages)
		}
		if err != nil {
			message := err.Error()
			for _, code := range []string{"image-unauthorized", "image-timeout", "image-invalid-asset"} {
				if strings.Contains(message, code) {
					return toolResult{Status: "error", Content: code}
				}
			}
			return toolResult{Status: "error", Content: "image-provider-error: " + message}
		}
		if err := ctx.Err(); err != nil {
			return toolResult{Status: "cancelled", Content: "image generation cancelled"}
		}
		proposal := &ToolApplyProposal{
			ToolCallID: call.ID,
			Operation:  "image-variant",
			Proposed:   src,
			ImageVariant: &ImageVariantProposal{
				ProposalID:        state.ids.Next("proposal"),
				ToolCallID:        call.ID,
				Src:               src,
				Prompt:            prompt,
				Provider:          state.request.ImageProvider,
				SourceNodeIDs:     sourceIDs,
				SourceRevisions:   revisions,
				WorkspaceID:       state.request.WorkspaceID,
				CanvasID:          state.request.CanvasID,
				RuntimeGeneration: state.request.RuntimeGeneration,
				ScopeEpoch:        state.request.ScopeEpoch,
				RunID:             state.request.RunID,
				RunEpoch:          state.request.RunEpoch,
			},
		}
		return awaitApproval(ctx, state, proposal)

	case "web_search":
		query := stringArg("query")
		known := []string{}
		if values, ok := args["known_urls"].([]interface{}); ok {
			for _, value := range values {
				if item, ok := value.(string); ok {
					known = append(known, item)
				}
			}
		}
		hints, summaries := searchHintsFromRequest(state.request)
		var llm LLMPort
		if state.llm != nil {
			llm = state.llm
		}
		packet, err := ExecuteWebSearch(ctx, state.search, WebSearchRequest{
			Query:             query,
			HintNodeIDs:       hints,
			HintSummaries:     summaries,
			KnownURLs:         known,
			WorkspaceID:       state.request.WorkspaceID,
			CanvasID:          state.request.CanvasID,
			RuntimeGeneration: state.request.RuntimeGeneration,
			ScopeEpoch:        state.request.ScopeEpoch,
			EntryRoute:        "dialogue-agent",
			RunID:             state.request.RunID,
			RunEpoch:          state.request.RunEpoch,
		}, fallbackIDs(state.ids), fallbackClock(state.clock), llm)
		if err != nil {
			return toolResult{Status: "error", Content: err.Error()}
		}
		if state.emit != nil {
			copy := packet
			state.emit(ChatEvent{RunID: state.request.RunID, SessionID: state.request.SessionID, Type: "chat:context_packet", Packet: &copy})
		}
		return jsonResult(map[string]interface{}{
			"packetId": packet.PacketID,
			"status":   packet.Status,
			"summary":  packetModelSummary(packet),
		})
	default:
		return toolResult{Status: "error", Content: "unknown tool: " + call.Function.Name}
	}
}

// Some OpenAI-compatible providers occasionally concatenate two tool names
// and their JSON arguments into one call (for example
// list_canvas_nodesweb_search with {}{"query":"..."}). Recover the final
// requested tool and final complete JSON object so a harmless preceding read
// does not prevent the user's web search. Unknown malformed calls still fail
// through the normal validation path.
func normalizeMergedToolCall(call ToolCall) ToolCall {
	known := []string{
		"read_artifact", "apply_edit", "write_artifact", "list_artifacts",
		"search_artifact", "read_canvas_node", "list_canvas_nodes",
		"propose_transform", "propose_relation", "propose_relation_batch",
		"propose_cluster_view", "web_search", "generate_image",
	}
	name := call.Function.Name
	for _, candidate := range known {
		if name == candidate || !strings.HasSuffix(name, candidate) {
			continue
		}
		decoder := json.NewDecoder(strings.NewReader(call.Function.Arguments))
		var last json.RawMessage
		for {
			var value json.RawMessage
			if err := decoder.Decode(&value); err == io.EOF {
				break
			} else if err != nil {
				return call
			}
			last = value
		}
		if len(last) > 0 {
			call.Function.Name = candidate
			call.Function.Arguments = string(last)
		}
		return call
	}
	return call
}

func awaitApproval(ctx context.Context, state *agentRunState, proposal *ToolApplyProposal) toolResult {
	// Carry the immutable request scope through the human acknowledgement
	// handshake. The frontend must echo it, otherwise a late decision cannot
	// be correlated safely with the run that produced the proposal.
	proposal.WorkspaceID = state.request.WorkspaceID
	proposal.CanvasID = state.request.CanvasID
	proposal.RuntimeGeneration = state.request.RuntimeGeneration
	proposal.ScopeEpoch = state.request.ScopeEpoch
	proposal.RunEpoch = state.request.RunEpoch
	result := state.approve(ctx, proposal)
	switch result.Status {
	case "applied":
		return toolResult{Status: "applied", Content: "Canvas mutation applied and acknowledged"}
	case "conflict":
		return toolResult{Status: "conflict", Content: "Canvas mutation rejected because the node revision changed"}
	case "cancelled":
		return toolResult{Status: "cancelled", Content: "Canvas mutation cancelled"}
	default:
		if result.Error == "" {
			result.Error = "Canvas mutation was not acknowledged"
		}
		return toolResult{Status: "error", Content: result.Error}
	}
}

func searchHintsFromRequest(req ChatRequest) ([]string, []string) {
	allow := map[string]bool{}
	for _, id := range req.DirectContextNodeIDs {
		allow[id] = true
	}
	for _, id := range req.BodyAllowlistNodeIDs {
		allow[id] = true
	}
	ids := make([]string, 0)
	summaries := make([]string, 0)
	for _, node := range req.Snapshot.Nodes {
		if !allow[node.ID] {
			continue
		}
		if node.Type != "text" && node.Type != "artifact" {
			continue
		}
		excerpt := firstLine(node.Markdown)
		if excerpt == "" {
			continue
		}
		if len([]rune(excerpt)) > 240 {
			excerpt = string([]rune(excerpt)[:240])
		}
		ids = append(ids, node.ID)
		summaries = append(summaries, excerpt)
	}
	return ids, summaries
}

func fallbackIDs(ids IDGenerator) IDGenerator {
	if ids != nil {
		return ids
	}
	return RandomIDGenerator{}
}

func fallbackClock(clock Clock) Clock {
	if clock != nil {
		return clock
	}
	return SystemClock{}
}

// formatViewHints renders the active provisional Cluster View as an observation
// for the agent. It is explicitly not a confirmed relation or semantic group.
func formatViewHints(hints []ViewContextHint) string {
	sections := make([]string, 0, len(hints))
	for _, hint := range hints {
		lines := []string{fmt.Sprintf("Active provisional cluster view %q (observation only, not confirmed relations):", hint.Label)}
		for _, cluster := range hint.Clusters {
			lines = append(lines, fmt.Sprintf("- cluster %q: %s", cluster.Label, strings.Join(cluster.MemberNodeIDs, ", ")))
		}
		sections = append(sections, strings.Join(lines, "\n"))
	}
	return strings.Join(sections, "\n")
}

func firstLine(text string) string {
	if index := strings.IndexAny(text, "\r\n"); index >= 0 {
		return text[:index]
	}
	return text
}
func truncate(text string, max int) string {
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return string(runes[:max]) + "…"
}
func snippet(text string, start, length int) string {
	left := maxInt(0, start-60)
	right := minInt(len(text), start+length+60)
	return truncate(text[left:right], 180)
}
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func explicitCreation(prompt string) bool {
	lower := strings.ToLower(prompt)
	englishObjects := []string{"artifact", "document", "chapter", "file"}
	englishActions := []string{"create", "make", "start", "write", "new"}
	for _, object := range englishObjects {
		if strings.Contains(lower, object) {
			for _, action := range englishActions {
				if strings.Contains(lower, action) {
					return true
				}
			}
		}
	}
	japaneseObjects := []string{"文書", "ドキュメント", "アーティファクト", "artifact", "章", "ファイル"}
	japaneseActions := []string{"新規", "作成", "新しく", "追加"}
	for _, object := range japaneseObjects {
		if strings.Contains(lower, object) {
			for _, action := range japaneseActions {
				if strings.Contains(lower, action) {
					return true
				}
			}
		}
	}
	return false
}
func nextArtifactFilename(snapshot CanvasSnapshot) string {
	used := map[string]bool{}
	for _, node := range snapshot.Nodes {
		if node.Type == "artifact" {
			used[node.Filename] = true
		}
	}
	for i := 1; ; i++ {
		name := "artifact.md"
		if i > 1 {
			name = "artifact-" + strconv.Itoa(i) + ".md"
		}
		if !used[name] {
			return name
		}
	}
}
