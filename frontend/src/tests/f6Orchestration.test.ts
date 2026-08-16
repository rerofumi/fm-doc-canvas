import { boundedDialogueHistory } from "../domain/runScope";
import { buildNextActionRequest, eligibleNextActionKinds, isNextActionError, normalizeNextActionError, normalizeNextActionProposal, revalidateNextActionScope, validateEditedAction, type NextActionItem } from "../domain/orchestration";

const assert: (ok: unknown, message: string) => asserts ok = (ok, message) => { if (!ok) throw new Error(message); };
const rejects = (fn: () => unknown, message: string) => { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); };
const node = (id: string, content: string) => ({ id, parentCanvasId: "root", position: { x: 0, y: 0 }, order: 0, revision: 1, kind: "text" as const, role: "text" as const, content, summary: content, language: "text" as const, charCount: content.length, wordCount: 1 });
const workspace: any = { document: { workspaceId: "ws", rootCanvasId: "root", canvases: { root: { id: "root", name: "Root" } }, nodes: { a: node("a", "A body"), b: node("b", "B body") }, relations: {} }, runtime: { currentCanvasId: "root", runtimeGeneration: "gen", scopeEpoch: 1, commandSequence: 0, selection: { selectedNodeIds: ["a", "b"], activeNodeId: "a", revision: 1 }, contextSelection: { addedContextTargets: [], explicitRelationTargetNodeIds: [], includedRemoteRelationIds: [], candidateSeedNodeIds: [], excludedNodeIds: [], delegatedSessions: [], projectedContexts: [], revision: 0 }, focus: { id: "focus", canvasId: "root", text: "compare", source: "explicit" } } };
const envelope: any = { workspaceId: "ws", canvasId: "root", runtimeGeneration: "gen", scopeEpoch: 1, contextDigest: "digest", focus: workspace.runtime.focus, bodyAllowlistNodeIds: ["a", "b"], relationHints: [], viewHints: [] };

const request = buildNextActionRequest(workspace, envelope, [{ role: "user", content: "compare" } as any], "req-1");
assert(request.selectedNodeIds.join(",") === "a,b", "selection mapping");
assert(request.nodeHints.every((hint) => !("content" in hint)), "bounded hints must not include body field");
assert(JSON.stringify(eligibleNextActionKinds(request)) === JSON.stringify(["clarify", "compare", "counterpoint", "web_search", "suggest_relations", "suggest_clusters"]), "eligibility mapping");
const noContext = { ...request, focusText: "", dialogueHistory: [], selectedNodeIds: [], nodeHints: [], sourceRevisions: {} };
assert(JSON.stringify(eligibleNextActionKinds(noContext)) === JSON.stringify(["clarify"]), "no-context eligibility must be clarify only");
const canvasOnly = { ...request, focusText: "", dialogueHistory: [], selectedNodeIds: [] };
assert(eligibleNextActionKinds(canvasOnly).includes("web_search"), "bounded canvas text should seed targetless web advice");
assert(normalizeNextActionError("orchestration-provider-error: 400") === "orchestration-provider-error: 400", "plain Wails rejection must retain its typed message");
assert(normalizeNextActionError({ code: "next-actions-invalid-json" }) === "next-actions-invalid-json", "structured Wails rejection code must be retained");
assert(isNextActionError("orchestration-validation-error: next-actions-kind-invalid"), "orchestration errors must not use global workspace recovery");
const historyMessages = [
  ...Array.from({ length: 14 }, (_, index) => ({ role: "user" as const, content: `complete-${index}`, status: "complete" as const })),
  { role: "assistant" as const, content: "streaming", status: "streaming" as const },
  { role: "assistant" as const, content: "error", status: "error" as const },
  { role: "user" as const, content: "cancelled", status: "cancelled" as const },
  { role: "assistant" as const, content: "   ", status: "complete" as const },
];
const history = boundedDialogueHistory(historyMessages, 12);
assert(history.length === 12, "dialogue history must be capped at 12");
assert(history.every((entry) => entry.content.startsWith("complete-")), "incomplete or empty dialogue entries must be excluded");
assert(history[0]?.content === "complete-2", "dialogue history must retain the latest complete entries");
const item: NextActionItem = { id: "a1", kind: "compare", role: "comparer", actionLevel: "AL-2", route: "direct-transform", targetNodeIds: ["a", "b"], title: "Compare", reason: "r", expectedResult: "e", documentEffect: "undo", control: "reject" };
assert(validateEditedAction(item, ["a"], "") === false, "compare arity");
assert(validateEditedAction(item, ["a", "b"], "") === true, "compare valid");
assert(validateEditedAction(item, ["a", "a"], "") === false, "duplicate target edit");
const web: NextActionItem = { ...item, kind: "web_search", targetNodeIds: [], query: "initial" };
assert(validateEditedAction(web, [], "") === false, "empty edited query");
assert(validateEditedAction(web, [], "edited query") === true, "edited query valid");
const validProposal = { requestId: request.requestId, workspaceId: request.workspaceId, canvasId: request.canvasId, runtimeGeneration: request.runtimeGeneration, scopeEpoch: request.scopeEpoch, contextDigest: request.contextDigest, sourceRevisions: request.sourceRevisions, actions: [{ id: "action-1", kind: "compare", role: "comparer", actionLevel: "AL-2", route: "direct-transform", targetNodeIds: ["a", "b"], title: "Compare", reason: "reason", expectedResult: "result", documentEffect: "可逆な派生Text。single undo", control: "取消/undo" }] };
assert(normalizeNextActionProposal(validProposal, request).actions.length === 1, "proposal normalization");
rejects(() => normalizeNextActionProposal({ ...validProposal, contextDigest: "changed" }, request), "correlation mismatch should reject");
rejects(() => normalizeNextActionProposal({ ...validProposal, sourceRevisions: { ...request.sourceRevisions, a: 99 } }, request), "source revision mismatch should reject");
rejects(() => normalizeNextActionProposal({ ...validProposal, actions: [{ ...validProposal.actions[0], targetNodeIds: ["a", "a"] }] }, request), "duplicate target should reject");
rejects(() => normalizeNextActionProposal({ ...validProposal, actions: [{ ...validProposal.actions[0], targetNodeIds: ["a", "b"], role: "wrong" }] }, request), "mapping drift should reject");
const webProposal = { ...validProposal, actions: [{ id: "action-web", kind: "web_search", role: "researcher", actionLevel: "AL-2", route: "direct-web-search", targetNodeIds: [], title: "Search", reason: "reason", expectedResult: "result", documentEffect: "Context Packet候補。文書変更なし", control: "dismiss / Promote", query: "  " }] };
rejects(() => normalizeNextActionProposal(webProposal, request), "blank query should reject");
const validNodeIds = Array.from({ length: 41 }, (_, index) => `valid-${index}`);
for (const id of validNodeIds) workspace.document.nodes[id] = node(id, id);
const exactly40 = buildNextActionRequest(workspace, { ...envelope, bodyAllowlistNodeIds: validNodeIds.slice(0, 40) }, [], "cap-40");
assert(exactly40.nodeHints.length === 40, "40 eligible planner nodes should be accepted");
const tooMany = { ...envelope, bodyAllowlistNodeIds: validNodeIds };
rejects(() => buildNextActionRequest(workspace, tooMany, [], "cap-41"), "41 eligible nodes should reject without truncation");
workspace.document.nodes.folder = { id: "folder", parentCanvasId: "root", position: { x: 0, y: 0 }, order: 0, revision: 1, kind: "folder", childCanvasId: "child", label: "Folder" };
const withFolder = buildNextActionRequest(workspace, { ...envelope, bodyAllowlistNodeIds: ["folder", "a", "b"] }, [], "folder");
assert(!withFolder.nodeHints.some((hint) => hint.id === "folder"), "folder must not enter planner hints");
assert(revalidateNextActionScope(request, workspace), "scope valid");
workspace.runtime.scopeEpoch = 2;
assert(!revalidateNextActionScope(request, workspace), "scope stale");
workspace.runtime.scopeEpoch = 1;
workspace.document.nodes.a.revision = 2;
assert(!revalidateNextActionScope(request, workspace), "revision stale late result");
console.log("F6 orchestration domain tests passed: mapping drift, eligibility, bounded payload, edit validation, stale/cancel correlation contract");
