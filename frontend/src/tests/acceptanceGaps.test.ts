import { resolveContext, projectBoundary } from "../domain/contextResolver";
import {
  createProposalFromLegacyTool,
  decideAndApplyProposal,
} from "../domain/proposal";
import { projectCurrentCanvas } from "../domain/projectToFlow";
import {
  boundedDialogueHistory,
  buildRunScopeToken,
  compareScope,
} from "../domain/runScope";
import {
  applyCommand,
  createHistory,
  createRelation,
} from "../domain/workspaceCommands";
import {
  createEmptyWorkspace,
  DomainServices,
  isTextBearing,
} from "../domain/workspace";

function services(): DomainServices {
  const counts: Record<string, number> = {};
  return {
    ids: {
      next(kind: string) {
        counts[kind] = (counts[kind] ?? 0) + 1;
        return `${kind}-${counts[kind]}`;
      },
    },
    clock: {
      now: () => 1_700_000_000_000,
      nowISO: () => "2026-08-11T00:00:00.000Z",
    },
    faultState: { consumed: {} },
  };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`fail - ${name}`);
    throw e;
  }
}

run("cross-canvas relation projects to down-folder and up-boundary", () => {
  const s = services();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s);
  state = r.state;
  const a = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B" } }, s);
  state = r.state;
  const b = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "C" } }, s);
  state = r.state;
  const c = r.createdNodeId!;
  // group A,B
  r = applyCommand(state, { type: "createSubCanvas", nodeIds: [a, b], label: "G" }, s);
  state = r.state;
  const childId = r.createdCanvasId!;
  const folderId = r.createdNodeId!;
  // relation child->root member (cross)
  const rel = createRelation(s, a, c);
  r = applyCommand(state, { type: "addRelation", relation: rel }, s);
  state = r.state;

  // from root: down-folder aggregate expected
  let projected = projectCurrentCanvas(state);
  assert(
    projected.boundaryAggregates.some((x) => x.kind === "down-folder" && x.anchorId === folderId),
    "root should show down-folder badge",
  );

  // navigate into child: up-boundary expected for relation to root
  r = applyCommand(state, { type: "navigateCanvas", canvasId: childId }, s);
  state = r.state;
  projected = projectCurrentCanvas(state);
  assert(
    projected.boundaryAggregates.some((x) => x.kind === "up-boundary"),
    "child should show up-boundary portal",
  );
  const bound = projectBoundary(state.document, childId, state.document.rootCanvasId);
  assert(bound.kind === "up-boundary", "endpoint on root is up-boundary from child");
});

run("bounded dialogue history excludes cancelled/error/streaming", () => {
  const hist = boundedDialogueHistory(
    [
      { role: "user", content: "u1", status: "complete" },
      { role: "assistant", content: "a1", status: "cancelled" },
      { role: "assistant", content: "partial", status: "streaming" },
      { role: "assistant", content: "err", status: "error" },
      { role: "assistant", content: "a2", status: "complete" },
      { role: "user", content: "u2" },
    ],
    12,
  );
  assert(hist.length === 3, `expected 3 got ${hist.length}`);
  assert(hist[0].content === "u1", "first");
  assert(hist[1].content === "a2", "second");
  assert(hist[2].content === "u2", "third");
});

run("proposal reject/stale/conflict/accept", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "base" } }, s, history);
  state = r.state;
  history = r.history!;
  const nodeId = r.createdNodeId!;
  r = applyCommand(state, { type: "startAsyncRun", kind: "dialogue", runId: "run-1" }, s, history);
  state = r.state;
  const epoch = state.runtime.asyncRuns["run-1"].epoch;

  const proposal = createProposalFromLegacyTool({
    toolCallId: "p1",
    runId: "run-1",
    runEpoch: epoch,
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
    operation: "replace",
    targetNodeId: nodeId,
    baseRevision: 0,
    proposed: "edited",
  });

  const rejected = decideAndApplyProposal(
    state,
    proposal,
    { proposalId: "p1", decisionId: "d1", decision: "reject" },
    s,
    history,
    { runId: "run-1", epoch, status: "active" },
  );
  assert(rejected.status === "rejected", "reject");
  assert(isTextBearing(rejected.state.document.nodes[nodeId]) && rejected.state.document.nodes[nodeId].content === "base", "no mutation on reject");

  const modified = decideAndApplyProposal(
    state,
    proposal,
    { proposalId: "p1", decisionId: "d-modify", decision: "modify", modifiedContent: "modified" },
    s,
    history,
    { runId: "run-1", epoch, status: "active" },
  );
  assert(modified.status === "applied", modified.error || modified.status);
  assert(isTextBearing(modified.state.document.nodes[nodeId]) && modified.state.document.nodes[nodeId].content === "modified", "modified content");

  // stale after navigation scope bump
  r = applyCommand(state, { type: "setSelection", state: { selectedNodeIds: [nodeId], activeNodeId: nodeId, revision: 1 } }, s, history);
  state = r.state;
  history = r.history || history;
  const stale = decideAndApplyProposal(
    state,
    proposal,
    { proposalId: "p1", decisionId: "d2", decision: "accept" },
    s,
    history,
    { runId: "run-1", epoch, status: "active" },
  );
  assert(stale.status === "stale", `expected stale got ${stale.status}`);

  // fresh proposal accept
  const env = resolveContext({
    document: state.document,
    runtime: state.runtime,
    mode: "dialogue",
    operation: "mutate-text",
  });
  r = applyCommand(state, { type: "startAsyncRun", kind: "dialogue", runId: "run-2" }, s, history);
  state = r.state;
  const epoch2 = state.runtime.asyncRuns["run-2"].epoch;
  const node = state.document.nodes[nodeId];
  assert(isTextBearing(node), "text");
  const fresh = createProposalFromLegacyTool({
    toolCallId: "p2",
    runId: "run-2",
    runEpoch: epoch2,
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
    operation: "replace",
    targetNodeId: nodeId,
    baseRevision: node.revision,
    proposed: "edited-ok",
  });
  const applied = decideAndApplyProposal(
    state,
    fresh,
    { proposalId: "p2", decisionId: "d3", decision: "accept" },
    s,
    history,
    { runId: "run-2", epoch: epoch2, status: "active" },
  );
  assert(applied.status === "applied", applied.error || applied.status);
  assert(isTextBearing(applied.state.document.nodes[nodeId]) && applied.state.document.nodes[nodeId].content === "edited-ok", "content");

  // conflict on old revision
  const conflict = decideAndApplyProposal(
    applied.state,
    fresh,
    { proposalId: "p2", decisionId: "d4", decision: "accept" },
    s,
    applied.history,
    { runId: "run-2", epoch: epoch2, status: "active" },
  );
  assert(conflict.status === "conflict" || conflict.status === "stale", conflict.status);

  // scope compare
  const token = buildRunScopeToken(state, env, "run-2", epoch2, "sess");
  // after edits revisions may mismatch intentionally
  const cmp = compareScope(applied.state, token);
  assert(!cmp.ok, "token should mismatch after edit");
});

run("undo fault keeps content and reports error path", () => {
  const s = services();
  s.faultPlan = { failOnceAt: "undo-before-commit" };
  s.faultState = { consumed: {} };
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "x" } }, s, history);
  state = r.state;
  history = r.history!;
  const beforeSeq = state.runtime.commandSequence;
  const beforeNodes = Object.keys(state.document.nodes).length;
  r = applyCommand(state, { type: "undo" }, s, history);
  assert(!r.ok, "undo should fail once");
  assert(r.error?.includes("undo-before-commit"), r.error || "missing fault");
  assert(Object.keys(r.state.document.nodes).length === beforeNodes, "nodes unchanged");
  assert(r.state.runtime.commandSequence === beforeSeq, "sequence unchanged");
});

console.log("acceptanceGaps tests passed");
