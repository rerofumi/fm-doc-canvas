import { applyCommand, createHistory } from "../domain/workspaceCommands";
import {
  createEmptyWorkspace,
  type DomainServices,
  type WorkspaceState,
} from "../domain/workspace";
import {
  createRelationBatchProposal,
  decideAndApplyProposal,
} from "../domain/proposal";
import {
  type RelationBatchItem,
  normalizeRelationBatchDraft,
  revalidateDirectSuggestion,
  revalidateViewSourceRevisions,
  validateRelationBatch,
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

function makeThreeTextNodes(s: DomainServices): {
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

function relationBatchItem(
  a: string,
  b: string,
  kind: RelationBatchItem["kind"] = "supports",
): RelationBatchItem {
  return {
    sourceNodeId: a,
    targetNodeId: b,
    kind,
    reason: "candidate",
    direction: "forward",
  };
}

// REQ-04/05: addRelations applies atomically and one undo removes all.
export function f5BatchAtomicApplyAndUndo() {
  const s = services();
  const { state, a, b, c } = makeThreeTextNodes(s);
  const history = createHistory();
  const relations: RelationBatchItem[] = [
    relationBatchItem(a, b, "supports"),
    relationBatchItem(b, c, "similar"),
  ];
  const error = validateRelationBatch(relations, state);
  assert(error === null, error || "batch should be valid");
  const proposal = createRelationBatchProposal({
    proposalId: "batch-1",
    runId: "run-1",
    runEpoch: 1,
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
    relations,
    sourceRevisions: { [a]: 0, [b]: 0, [c]: 0 },
  });
  const result = decideAndApplyProposal(
    state,
    proposal,
    { proposalId: "batch-1", decisionId: "d-1", decision: "accept" },
    s,
    history,
    { runId: "run-1", epoch: 1, status: "active" },
  );
  assert(result.status === "applied", result.error || "batch accept");
  assert(
    Object.keys(result.state.document.relations).length === 2,
    "two relations added",
  );
  const undo = applyCommand(result.state, { type: "undo" }, s, result.history);
  assert(
    undo.ok && Object.keys(undo.state.document.relations).length === 0,
    "one undo removes all batch relations",
  );
  console.log("ok - relation batch applies atomically with one undo");
}

// REQ-05: batch invariant failures (self / missing / invalid kind / duplicate /
// cross-scope) reject the whole batch with no document change.
export function f5BatchInvariantNoop() {
  const s = services();
  const { state, a, b } = makeThreeTextNodes(s);
  const cases: Array<{ relations: RelationBatchItem[]; error: string }> = [
    { relations: [], error: "relation-batch-empty" },
    { relations: [relationBatchItem(a, a)], error: "self-relation" },
    {
      relations: [relationBatchItem(a, "missing")],
      error: "relation-endpoint-missing",
    },
    {
      relations: [
        {
          ...relationBatchItem(a, b),
          kind: "bogus" as RelationBatchItem["kind"],
        },
      ],
      error: "invalid relation kind",
    },
    {
      relations: [relationBatchItem(a, b), relationBatchItem(a, b)],
      error: "duplicate relation in batch",
    },
  ];
  for (const tc of cases) {
    const error = validateRelationBatch(tc.relations, state);
    assert(error === tc.error, `expected ${tc.error}, got ${error}`);
  }
  // cross-scope: after moving a/b into a SubCanvas, they are off the current
  // (root) canvas and a relation targeting them is out of scope.
  const sub = applyCommand(
    state,
    { type: "createSubCanvas", nodeIds: [a, b], label: "child" },
    s,
    createHistory(),
  );
  assert(sub.ok, sub.error || "createSubCanvas for cross-scope fixture");
  const crossScope = validateRelationBatch(
    [relationBatchItem(a, b)],
    sub.state,
  );
  assert(
    crossScope === "relation-endpoint-out-of-scope",
    `expected cross-scope, got ${crossScope}`,
  );
  console.log("ok - relation batch invariants reject invalid batches");
}

// REQ-11: source revision mismatch marks the batch accept as conflict.
export function f5BatchRevisionConflict() {
  const s = services();
  const { state, a, b } = makeThreeTextNodes(s);
  const revisions = { [a]: 99, [b]: 0 };
  const conflict = revalidateViewSourceRevisions(revisions, state);
  assert(
    conflict && conflict.includes("conflict"),
    conflict || "expected conflict",
  );
  console.log("ok - relation batch source revision mismatch is a conflict");
}

// REQ-11: Direct suggestion stale guard distinguishes stale / cancelled / conflict.
export function f5DirectSuggestionStaleGuard() {
  const s = services();
  const { state, a, b } = makeThreeTextNodes(s);
  const request = {
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
    sourceRevisions: { [a]: 0, [b]: 0 },
  };
  assert(
    revalidateDirectSuggestion(request, state) === null,
    "fresh suggestion passes",
  );
  const edited = applyCommand(
    state,
    {
      type: "editTextContent",
      nodeId: a,
      content: "Alpha edited",
      baseRevision: 0,
    },
    s,
    createHistory(),
  );
  const conflict = revalidateDirectSuggestion(request, edited.state);
  assert(
    conflict?.status === "conflict",
    "source edit during await → conflict",
  );
  const afterNew = applyCommand(
    state,
    { type: "newWorkspace" },
    s,
    createHistory(),
  ).state;
  assert(
    revalidateDirectSuggestion(request, afterNew)?.status === "cancelled",
    "New Workspace → cancelled",
  );
  console.log("ok - direct suggestion stale guard works");
}

// REQ-02/05: normalizeRelationBatchDraft returns the validated relations.
export function f5NormalizeRelationBatch() {
  const s = services();
  const { state, a, b } = makeThreeTextNodes(s);
  const normalized = normalizeRelationBatchDraft(
    {
      relations: [relationBatchItem(a, b)],
      sourceRevisions: { [a]: 0, [b]: 0 },
    },
    state,
  );
  assert(normalized.ok, normalized.ok ? "" : normalized.error);
  assert(normalized.value.length === 1, "one relation normalized");
  console.log("ok - relation batch normalization works");
}

export function runF5RelationBatchTests() {
  f5BatchAtomicApplyAndUndo();
  f5BatchInvariantNoop();
  f5BatchRevisionConflict();
  f5DirectSuggestionStaleGuard();
  f5NormalizeRelationBatch();
  console.log("F5 relation batch tests passed");
}
