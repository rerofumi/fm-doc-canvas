import { applyCommand, createHistory } from "../domain/workspaceCommands";
import {
  createEmptyWorkspace,
  type DomainServices,
  type WorkspaceState,
  isTextBearing,
} from "../domain/workspace";
import {
  createGeneratedViewProposal,
  decideAndApplyProposal,
} from "../domain/proposal";
import { resolveContext } from "../domain/contextResolver";
import {
  type ClusterViewDraft,
  type GeneratedViewRecord,
  computeClusterHull,
  moveClusterMember,
  normalizeClusterViewDraft,
  pruneEmptyClusters,
  removeCluster,
  removeClusterMember,
  renameCluster,
  revalidateViewSourceRevisions,
} from "../domain/generatedView";

function services(): DomainServices {
  const counts: Record<string, number> = {};
  return {
    ids: {
      next: (kind) => `${kind}-${(counts[kind] = (counts[kind] ?? 0) + 1)}`,
    },
    clock: {
      now: () => 1700000000000,
      nowISO: () => "2026-08-15T00:00:00.000Z",
    },
  };
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function makeThreeNodes(s: DomainServices): {
  state: WorkspaceState;
  a: string;
  b: string;
  c: string;
} {
  let state = createEmptyWorkspace(s);
  let history = createHistory();
  const ids: string[] = [];
  for (const content of ["Alpha", "Beta", "Gamma"]) {
    const r = applyCommand(
      state,
      {
        type: "createText",
        role: "text",
        input: { content, summary: content },
      },
      s,
      history,
    );
    assert(r.ok, r.error || "create text");
    state = r.state;
    history = r.history!;
    ids.push(r.createdNodeId!);
  }
  return { state, a: ids[0], b: ids[1], c: ids[2] };
}

function makeView(
  s: DomainServices,
  state: WorkspaceState,
  a: string,
  b: string,
  c: string,
): { view: ClusterViewDraft; record: GeneratedViewRecord } {
  const normalized = normalizeClusterViewDraft(
    {
      label: "Two threads",
      clusters: [
        { label: "A", reason: "r1", nodeIds: [a, b] },
        { label: "B", reason: "r2", nodeIds: [c] },
      ],
      ungroupedNodeIds: [],
      sourceRevisions: { [a]: 0, [b]: 0, [c]: 0 },
    },
    state,
    s,
  );
  assert(normalized.ok, normalized.ok ? "" : normalized.error);
  const proposal = createGeneratedViewProposal({
    proposalId: "view-1",
    runId: "run-1",
    runEpoch: 1,
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
    view: normalized.value,
    source: "direct",
  });
  const result = decideAndApplyProposal(
    state,
    proposal,
    { proposalId: "view-1", decisionId: "d-1", decision: "accept" },
    s,
    createHistory(),
    { runId: "run-1", epoch: 1, status: "active" },
  );
  assert(
    result.status === "applied" && result.generatedView,
    result.error || "view accept",
  );
  return { view: normalized.value, record: result.generatedView };
}

// REQ-06: cluster view draft validation rejects invalid shapes.
export function f5ViewNormalization() {
  const s = services();
  const { state, a, b } = makeThreeNodes(s);
  const cases: Array<{
    draft: Parameters<typeof normalizeClusterViewDraft>[0];
    error: string;
  }> = [
    {
      draft: { label: "x", clusters: [{ label: "A", nodeIds: [a] }] },
      error: "cluster-view-requires-2-clusters",
    },
    {
      draft: {
        label: "x",
        clusters: [
          { label: "A", nodeIds: [a] },
          { label: "B", nodeIds: [a] },
        ],
      },
      error: "cluster-member-duplicate",
    },
    {
      draft: {
        label: "x",
        clusters: [
          { label: "A", nodeIds: [a] },
          { label: "B", nodeIds: ["missing"] },
        ],
      },
      error: "cluster-member-out-of-scope",
    },
    {
      draft: {
        label: "x",
        clusters: [
          { label: "A", nodeIds: [a] },
          { label: "B", nodeIds: [b] },
          { label: "C", nodeIds: [] },
        ],
      },
      error: "cluster-member-empty",
    },
  ];
  for (const tc of cases) {
    const result = normalizeClusterViewDraft(tc.draft, state, s);
    assert(
      !result.ok && result.error === tc.error,
      `expected ${tc.error}, got ${result.ok ? "ok" : result.error}`,
    );
  }
  console.log("ok - cluster view normalization validates drafts");
}

// REQ-07: view-local edits are shallow copies that never mutate the document.
export function f5ViewLocalEdits() {
  const s = services();
  const { state, a, b, c } = makeThreeNodes(s);
  const { record } = makeView(s, state, a, b, c);
  const clusterA = record.clusters.find((cl) => cl.label === "A")!;
  const clusterB = record.clusters.find((cl) => cl.label === "B")!;

  const renamed = renameCluster(record, clusterA.id, "Renamed");
  assert(
    renamed.clusters.find((cl) => cl.id === clusterA.id)?.label === "Renamed",
    "rename cluster",
  );
  assert(
    record.clusters.find((cl) => cl.id === clusterA.id)?.label === "A",
    "original view unchanged",
  );

  const moved = moveClusterMember(record, b, clusterA.id, clusterB.id);
  assert(
    moved.clusters.find((cl) => cl.id === clusterA.id)?.nodeIds.length === 1,
    "member moved out",
  );
  assert(
    moved.clusters.find((cl) => cl.id === clusterB.id)?.nodeIds.includes(b),
    "member moved in",
  );

  const removed = removeClusterMember(record, clusterA.id, a);
  assert(
    removed.ungroupedNodeIds.includes(a),
    "removed member becomes ungrouped",
  );
  assert(
    pruneEmptyClusters(removed).clusters.length === 2,
    "no empty cluster yet",
  );

  const withoutB = removeCluster(record, clusterB.id);
  assert(
    withoutB.clusters.length === 1 && withoutB.ungroupedNodeIds.includes(c),
    "removed cluster members become ungrouped",
  );

  assert(
    Object.keys(state.document.relations).length === 0,
    "view edits never touch document",
  );
  console.log("ok - view-local edits are non-destructive shallow copies");
}

// REQ-11: source revision mismatch makes a view accept stale / conflict.
export function f5ViewRevisionStale() {
  const s = services();
  const { state, a, b, c } = makeThreeNodes(s);
  const conflict = revalidateViewSourceRevisions(
    { [a]: 99, [b]: 0, [c]: 0 },
    state,
  );
  assert(
    conflict && conflict.includes("conflict"),
    conflict || "expected conflict",
  );
  console.log("ok - view source revision mismatch is a conflict");
}

// REQ-08: hull bounding box covers members plus padding.
export function f5ViewHull() {
  const s = services();
  const { state, a, b } = makeThreeNodes(s);
  const hull = computeClusterHull([a, b], state.document.nodes);
  assert(hull && hull.width > 0 && hull.height > 0, "hull computed");
  console.log("ok - cluster hull computed");
}

// REQ-12: resolveContext emits viewHints for clusters intersecting active context.
export function f5ViewHints() {
  const s = services();
  const { state, a, b, c } = makeThreeNodes(s);
  const { record } = makeView(s, state, a, b, c);
  const selected = applyCommand(
    state,
    {
      type: "setSelection",
      state: { selectedNodeIds: [a], activeNodeId: a, revision: 1 },
    },
    s,
  ).state;
  const envelope = resolveContext({
    document: selected.document,
    runtime: selected.runtime,
    mode: "dialogue",
    operation: "read",
    generatedView: record,
  });
  assert(envelope.viewHints.length === 1, "one view hint emitted");
  assert(envelope.viewHints[0].label === "Two threads", "view label in hint");
  assert(
    envelope.viewHints[0].clusters.some((cl) => cl.memberNodeIds.includes(a)),
    "cluster A member in hint",
  );
  // A view on a different canvas emits no hint.
  const offCanvas = { ...record, canvasId: "other-canvas" };
  const empty = resolveContext({
    document: selected.document,
    runtime: selected.runtime,
    mode: "dialogue",
    operation: "read",
    generatedView: offCanvas,
  });
  assert(empty.viewHints.length === 0, "off-canvas view emits no hint");
  console.log("ok - viewHints are observation-only and scoped");
}

// REQ-10: cluster -> SubCanvas uses the existing command (document side), and
// removing the converted cluster from the view is a pure view-local operation.
export function f5ViewConvertDocumentSide() {
  const s = services();
  const { state, a, b, c } = makeThreeNodes(s);
  const { record } = makeView(s, state, a, b, c);
  const clusterA = record.clusters.find((cl) => cl.label === "A")!;
  const after = removeCluster(record, clusterA.id);
  assert(after.clusters.length === 1, "converted cluster removed from view");
  const sub = applyCommand(
    state,
    { type: "createSubCanvas", nodeIds: clusterA.nodeIds, label: "A" },
    s,
    createHistory(),
  );
  assert(sub.ok, sub.error || "createSubCanvas");
  const folder = Object.values(sub.state.document.nodes).find(
    (n) => n.kind === "folder",
  );
  assert(folder && folder.kind === "folder", "folder created");
  const child = Object.values(sub.state.document.canvases).find(
    (cv) => cv.id !== sub.state.document.rootCanvasId,
  );
  assert(
    child && sub.state.document.nodes[a].parentCanvasId === child.id,
    "members moved to child canvas",
  );
  assert(
    isTextBearing(sub.state.document.nodes[a]),
    "moved member still text-bearing",
  );
  console.log("ok - cluster converts to SubCanvas via existing command");
}

export function runF5GeneratedViewTests() {
  f5ViewNormalization();
  f5ViewLocalEdits();
  f5ViewRevisionStale();
  f5ViewHull();
  f5ViewHints();
  f5ViewConvertDocumentSide();
  console.log("F5 generated view tests passed");
}
