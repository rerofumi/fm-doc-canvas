import "./domainFoundation.test";
import "./f3ContextPacket.test";
import "./f3Promote.test";
import { applyCommand, createHistory } from "../domain/workspaceCommands";
import {
  buildTransformRequest,
  normalizeTransformDraft,
  revalidateDirectTransform,
  validateTransformSelection,
} from "../domain/transform";
import { resolveContext } from "../domain/contextResolver";
import {
  createEmptyWorkspace,
  DomainServices,
  isTextBearing,
} from "../domain/workspace";
import { loadWorkspaceJSON, workspaceToPrettyJSON } from "../domain/workspacePersistence";
import {
  createRelationProposal,
  createTransformProposal,
  decideAndApplyProposal,
} from "../domain/proposal";

const services = (): DomainServices => {
  const counts: Record<string, number> = {};
  return {
    ids: { next: (kind) => `${kind}-${(counts[kind] = (counts[kind] ?? 0) + 1)}` },
    clock: { now: () => 1700000000000, nowISO: () => "2026-08-12T00:00:00.000Z" },
  };
};
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const s = services();
let state = createEmptyWorkspace(s);
let history = createHistory();
let result = applyCommand(state, { type: "createText", role: "text", input: { content: "Alpha", summary: "A" } }, s, history);
assert(result.ok, result.error || "create source");
state = result.state;
history = result.history!;
const sourceA = result.createdNodeId!;
result = applyCommand(state, { type: "createText", role: "text", input: { content: "Beta", summary: "B" } }, s, history);
assert(result.ok, result.error || "create source");
state = result.state;
history = result.history!;
const sourceB = result.createdNodeId!;
state = applyCommand(state, { type: "setSelection", state: { selectedNodeIds: [sourceA, sourceB], activeNodeId: sourceA, revision: 1 } }, s).state;

assert(validateTransformSelection(state, "compare") === null, "compare selection should be valid");
const request = buildTransformRequest(state, "compare", "digest");
const transform = normalizeTransformDraft(request, {
  operation: "compare",
  sourceNodeIds: request.sourceNodeIds,
  sourceRevisions: request.sourceRevisions,
  content: "| Axis | Result |\n|---|---|\n| focus | both |",
  summary: "Comparison",
  reason: "shared axis",
  suggestedRelations: [],
  provenance: { origin: "llm", provider: "fixture", model: "fixture" },
});
result = applyCommand(state, { type: "applyTransform", input: transform }, s, history);
assert(result.ok, result.error || "apply transform");
const derivedId = result.createdNodeId!;
assert(Object.keys(result.state.document.relations).length === 2, "one derived relation per source");
assert(
  isTextBearing(result.state.document.nodes[derivedId]) &&
    result.state.document.nodes[derivedId].provenance?.sourceNodeIds?.length === 2,
  "provenance retained",
);
const applied = result.state;
const undone = applyCommand(applied, { type: "undo" }, s, result.history);
assert(undone.ok && !undone.state.document.nodes[derivedId], "one undo removes derived transaction");

const envelope = resolveContext({ document: applied.document, runtime: applied.runtime, mode: "dialogue", operation: "read" });
assert(envelope.relationHints.length === 2, "accepted relations reach next context");
assert(envelope.spatialHints.some((hint) => hint.nodeId === derivedId), "spatial hint includes current canvas node");
const loaded = loadWorkspaceJSON(workspaceToPrettyJSON(applied, "2026-08-12T00:00:00.000Z"), s);
assert(
  loaded.ok && Object.values(loaded.load.document.relations).every((relation) => relation.reason === "shared axis"),
  "relation reason roundtrips",
);

// --- Direct Action stale / cancelled / conflict guards (latest state) ---
const freshRequest = buildTransformRequest(state, "compare", "digest");
assert(revalidateDirectTransform(freshRequest, state) === null, "fresh request should pass revalidation");

const sourceANode = state.document.nodes[sourceA];
assert(isTextBearing(sourceANode), "sourceA is text-bearing");
const edited = applyCommand(
  state,
  {
    type: "editTextContent",
    nodeId: sourceA,
    content: "Alpha edited",
    baseRevision: sourceANode.revision,
  },
  s,
  history,
);
assert(edited.ok, edited.error || "edit source");
const conflictGuard = revalidateDirectTransform(freshRequest, edited.state);
assert(conflictGuard?.status === "conflict", "source edit during await → conflict");
assert(
  Object.keys(edited.state.document.nodes).length === Object.keys(state.document.nodes).length,
  "edit alone does not invent nodes",
);

const navigated = applyCommand(
  state,
  {
    type: "createSubCanvas",
    nodeIds: [sourceA, sourceB],
    label: "Child",
  },
  s,
  history,
);
assert(navigated.ok, navigated.error || "create subcanvas");
const childId = Object.values(navigated.state.document.canvases).find(
  (canvas) => canvas.id !== navigated.state.document.rootCanvasId,
)?.id;
assert(childId, "child canvas");
const afterNav = applyCommand(navigated.state, { type: "navigateCanvas", canvasId: childId! }, s, navigated.history).state;
const staleGuard = revalidateDirectTransform(freshRequest, afterNav);
assert(staleGuard?.status === "stale", "canvas navigation during await → stale");

const afterNew = applyCommand(state, { type: "newWorkspace" }, s, history).state;
const cancelledGuard = revalidateDirectTransform(freshRequest, afterNew);
assert(cancelledGuard?.status === "cancelled", "New Workspace during await → cancelled");

const afterDiscard = applyCommand(state, { type: "discardWorkspace" }, s, history).state;
assert(revalidateDirectTransform(freshRequest, afterDiscard)?.status === "cancelled", "Discard → cancelled");

// --- Suggested relation out-of-scope is rejected atomically ---
const outOfScope = normalizeTransformDraft(request, {
  operation: "compare",
  sourceNodeIds: request.sourceNodeIds,
  sourceRevisions: request.sourceRevisions,
  content: "compare body",
  summary: "Comparison",
  reason: "shared axis",
  suggestedRelations: [
    {
      sourceNodeId: sourceA,
      targetNodeId: "missing-remote",
      kind: "supports",
      reason: "out of scope",
    },
  ],
  provenance: { origin: "llm" },
});
const beforeFaultNodes = Object.keys(state.document.nodes).length;
const beforeFaultRelations = Object.keys(state.document.relations).length;
const beforeFaultHistory = history.past.length;
const beforeFaultSelection = { ...state.runtime.selection };
const oos = applyCommand(state, { type: "applyTransform", input: outOfScope }, s, history);
assert(!oos.ok, "out-of-scope suggested relation must fail");
assert(oos.error?.includes("relation-endpoint-out-of-scope") || oos.error?.includes("endpoint"), oos.error || "scope error");
assert(Object.keys(oos.state.document.nodes).length === beforeFaultNodes, "nodes no-op on atomic failure");
assert(Object.keys(oos.state.document.relations).length === beforeFaultRelations, "relations no-op on atomic failure");
assert((oos.history?.past.length ?? history.past.length) === beforeFaultHistory, "history no-op on atomic failure");
assert(
  oos.state.runtime.selection.selectedNodeIds.join(",") === beforeFaultSelection.selectedNodeIds.join(","),
  "selection no-op on atomic failure",
);

// --- Transform fault injection keeps document / history / revision / selection ---
const faultServices: DomainServices = {
  ...services(),
  faultPlan: { failOnceAt: "apply-transform-before-commit" },
  faultState: { consumed: {} },
};
const beforeSeq = state.runtime.commandSequence;
const beforeRevNode = state.document.nodes[sourceA];
assert(isTextBearing(beforeRevNode), "sourceA text for fault check");
const beforeRevA = beforeRevNode.revision;
const faulted = applyCommand(state, { type: "applyTransform", input: transform }, faultServices, history);
assert(!faulted.ok && faulted.error?.includes("apply-transform-before-commit"), faulted.error || "fault expected");
assert(Object.keys(faulted.state.document.nodes).length === beforeFaultNodes, "fault: nodes unchanged");
assert(Object.keys(faulted.state.document.relations).length === beforeFaultRelations, "fault: relations unchanged");
assert(faulted.state.runtime.commandSequence === beforeSeq, "fault: commandSequence unchanged");
assert(faulted.state.document.nodes[sourceA].revision === beforeRevA, "fault: source revision unchanged");
assert(
  faulted.state.runtime.selection.selectedNodeIds.join(",") === state.runtime.selection.selectedNodeIds.join(","),
  "fault: selection unchanged",
);

// --- Relation proposal reject leaves document untouched ---
const relProposal = createRelationProposal({
  proposalId: "rel-1",
  runId: "run-rel",
  runEpoch: 1,
  workspaceId: state.document.workspaceId,
  canvasId: state.runtime.currentCanvasId,
  runtimeGeneration: state.runtime.runtimeGeneration,
  scopeEpoch: state.runtime.scopeEpoch,
  relation: { sourceNodeId: sourceA, targetNodeId: sourceB, kind: "supports", reason: "candidate only" },
});
const rejected = decideAndApplyProposal(
  state,
  relProposal,
  { proposalId: "rel-1", decisionId: "d-reject", decision: "reject" },
  s,
  history,
  { runId: "run-rel", epoch: 1, status: "active" },
);
assert(rejected.status === "rejected", "relation proposal reject");
assert(Object.keys(rejected.state.document.relations).length === 0, "unaccepted relation not in document");

// --- Transform proposal modify applies modified content ---
const transformProposal = createTransformProposal({
  proposalId: "tf-1",
  runId: "run-tf",
  runEpoch: 1,
  workspaceId: state.document.workspaceId,
  canvasId: state.runtime.currentCanvasId,
  runtimeGeneration: state.runtime.runtimeGeneration,
  scopeEpoch: state.runtime.scopeEpoch,
  transform,
});
const modified = decideAndApplyProposal(
  state,
  transformProposal,
  {
    proposalId: "tf-1",
    decisionId: "d-mod",
    decision: "modify",
    modifiedContent: "modified comparison output",
    modifiedReason: "human revised",
  },
  s,
  history,
  { runId: "run-tf", epoch: 1, status: "active" },
);
assert(modified.status === "applied", modified.error || "modify apply");
const modifiedNode = modified.state.document.nodes[modified.proposal.createdNodeId!];
assert(isTextBearing(modifiedNode) && modifiedNode.content === "modified comparison output", "modified content applied");

console.log("F2 transform domain tests passed");
