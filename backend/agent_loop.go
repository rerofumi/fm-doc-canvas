package backend

import (
	"context"
	"encoding/json"
	"fmt"
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
	}
}

func runAgent(ctx context.Context, llm *LLMService, req ChatRequest, emit func(ChatEvent), approve func(context.Context, *ToolApplyProposal) ToolApplicationResult) error {
	state := &agentRunState{request: req, readRevs: map[string]int64{}, readNodes: map[string]NodeSnapshot{}, approve: approve}
	cfg := llm.configService.GetConfig()
	system := effectiveAgentSystemPrompt(cfg.LLM.SystemPrompt)
	direct := req.Snapshot.directContext(req.DirectContextNodeIDs)
	user := fmt.Sprintf("Direct Canvas context:\n%s\n\nUser request:\n%s", direct, req.Prompt)
	messages := []ChatMessage{{Role: "system", Content: system}, {Role: "user", Content: user}}
	tools := toolDefinitions()

	for round := 0; round < 10; round++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		response, err := llm.streamChat(ctx, messages, tools, func(chunk string) {
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
			messages = append(messages, ChatMessage{Role: "tool", ToolCallID: call.ID, Content: result.Content})
		}
	}
	return fmt.Errorf("maximum tool rounds (%d) reached", 10)
}

func executeTool(ctx context.Context, state *agentRunState, call ToolCall) toolResult {
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
			return jsonResult(map[string]interface{}{"nodeId": node.ID, "type": node.Type, "imageRef": node.ImageRef, "prompt": node.Prompt, "imageIncluded": false})
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
	default:
		return toolResult{Status: "error", Content: "unknown tool: " + call.Function.Name}
	}
}

func awaitApproval(ctx context.Context, state *agentRunState, proposal *ToolApplyProposal) toolResult {
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
