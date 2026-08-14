import { applyCommand, createHistory } from "../domain/workspaceCommands";
import {
  createEmptyWorkspace,
  DomainServices,
  WorkspaceState,
} from "../domain/workspace";
import { loadWorkspaceJSON, workspaceToPrettyJSON } from "../domain/workspacePersistence";

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

function makeState(s: DomainServices): { state: WorkspaceState; textId: string; imageId: string } {
  let state = createEmptyWorkspace(s);
  let history = createHistory();
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "Alpha", summary: "A" } }, s, history);
  assert(r.ok, r.error || "create text");
  state = r.state;
  history = r.history!;
  const textId = r.createdNodeId!;
  r = applyCommand(state, { type: "createImageRef", input: { src: "generated/base.png", alt: "base", prompt: "base" } }, s, history);
  assert(r.ok, r.error || "create image");
  state = r.state;
  history = r.history!;
  const imageId = r.createdNodeId!;
  return { state, textId, imageId };
}

function variantInput(state: WorkspaceState, src: string, sourceNodeIds: string[], prompt = "a rocket") {
  return {
    src,
    prompt,
    provider: "fixture",
    model: "fixture-model",
    sourceNodeIds,
    sourceRevisions: Object.fromEntries(sourceNodeIds.map((id) => [id, state.document.nodes[id].revision])),
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
  };
}

// REQ-05: applyImageVariant creates an Image Node + derived Relations atomically.
export function f4VariantCreatesNodeAndRelations() {
  const s = services();
  const { state, textId } = makeState(s);
  const history = createHistory();
  const r = applyCommand(state, { type: "applyImageVariant", input: variantInput(state, "generated/variant.png", [textId]) }, s, history);
  assert(r.ok, r.error || "apply variant");
  const next = r.state;
  const node = next.document.nodes[r.createdNodeId!];
  assert(node && node.kind === "image", "variant node must be image");
  assert(node.src === "generated/variant.png", "variant src");
  assert(node.provenance?.origin === "image", "provenance origin=image");
  assert(node.provenance?.operation === "generate-image", "provenance operation");
  assert(node.provenance?.prompt === "a rocket", "provenance prompt");
  assert(node.provenance?.sourceNodeIds?.includes(textId), "provenance sourceNodeIds");
  const derived = Object.values(next.document.relations).filter((rel) => rel.kind === "derived");
  assert(derived.length === 1, "one derived relation");
  assert(derived[0].sourceNodeId === textId && derived[0].targetNodeId === node.id, "derived source->variant");
  // Source unchanged.
  const source = next.document.nodes[textId];
  assert(source && "content" in source && source.content === "Alpha", "source text unchanged");
  console.log("ok - applyImageVariant creates image node + derived relation");
}

// REQ-05: one undo removes the variant node and its relations.
export function f4VariantUndo() {
  const s = services();
  const { state, textId } = makeState(s);
  const history = createHistory();
  const r = applyCommand(state, { type: "applyImageVariant", input: variantInput(state, "generated/variant.png", [textId]) }, s, history);
  assert(r.ok, r.error || "apply variant");
  const after = r.state;
  const nodeCount = Object.keys(after.document.nodes).length;
  const relCount = Object.keys(after.document.relations).length;
  const undo = applyCommand(after, { type: "undo" }, s, r.history!);
  assert(undo.ok, undo.error || "undo variant");
  const undone = undo.state;
  assert(Object.keys(undone.document.nodes).length === nodeCount - 1, "undo removes variant node");
  assert(Object.keys(undone.document.relations).length === relCount - 1, "undo removes derived relation");
  const source = undone.document.nodes[textId];
  assert(source && "content" in source && source.content === "Alpha", "source preserved after undo");
  console.log("ok - one undo removes variant node + relation");
}

// REQ-06: provenance roundtrips through Save/Load (V1.3 optional field).
export function f4VariantProvenanceRoundtrip() {
  const s = services();
  const { state, textId } = makeState(s);
  const history = createHistory();
  const r = applyCommand(state, { type: "applyImageVariant", input: variantInput(state, "generated/variant.png", [textId]) }, s, history);
  assert(r.ok, r.error || "apply variant");
  const after = r.state;
  const json = workspaceToPrettyJSON(after, s.clock.nowISO());
  const loaded = loadWorkspaceJSON(json, s);
  if (!loaded.ok) throw new Error(loaded.error || "load");
  const node = Object.values(loaded.load.document.nodes).find((n) => n.kind === "image" && n.src === "generated/variant.png");
  assert(node, "variant node present after load");
  assert(node.provenance?.origin === "image", "origin=image survives roundtrip");
  assert(node.provenance?.prompt === "a rocket", "prompt survives roundtrip");
  assert(node.provenance?.sourceNodeIds?.includes(textId), "sourceNodeIds survive roundtrip");
  console.log("ok - image provenance roundtrips through save/load");
}

// REQ-11: stale variant (wrong runtime generation) is a no-op.
export function f4VariantStaleNoop() {
  const s = services();
  const { state, textId } = makeState(s);
  const history = createHistory();
  const input = variantInput(state, "generated/variant.png", [textId]);
  const stale = { ...input, runtimeGeneration: "stale-generation" };
  const r = applyCommand(state, { type: "applyImageVariant", input: stale }, s, history);
  assert(!r.ok, "stale variant must fail");
  assert(r.error === "image-variant-stale", `expected image-variant-stale, got ${r.error}`);
  assert(Object.keys(r.state.document.nodes).length === Object.keys(state.document.nodes).length, "no node added on stale");
  console.log("ok - stale variant is a no-op");
}

// REQ-11: source revision conflict is a no-op.
export function f4VariantRevisionConflict() {
  const s = services();
  const { state, textId } = makeState(s);
  const history = createHistory();
  const input = variantInput(state, "generated/variant.png", [textId]);
  const conflict = { ...input, sourceRevisions: { [textId]: 999 } };
  const r = applyCommand(state, { type: "applyImageVariant", input: conflict }, s, history);
  assert(!r.ok, "revision conflict must fail");
  assert(r.error === "image-variant-stale", `expected image-variant-stale, got ${r.error}`);
  console.log("ok - source revision conflict is a no-op");
}

// REQ-05: empty prompt / empty src fail atomically.
export function f4VariantInvalidInputs() {
  const s = services();
  const { state, textId } = makeState(s);
  const history = createHistory();
  const noSrc = applyCommand(state, { type: "applyImageVariant", input: { ...variantInput(state, "", [textId]) } }, s, history);
  assert(!noSrc.ok && noSrc.error === "image-invalid-asset", "empty src fails");
  const noPrompt = applyCommand(state, { type: "applyImageVariant", input: { ...variantInput(state, "generated/v.png", [textId], "  ") } }, s, history);
  assert(!noPrompt.ok && noPrompt.error === "image-invalid-prompt", "empty prompt fails");
  console.log("ok - invalid variant inputs fail atomically");
}

// NFR-02: fault injection leaves document unchanged.
export function f4VariantFaultNoop() {
  const s = services();
  const { state, textId } = makeState(s);
  s.faultPlan = { failOnceAt: "apply-image-variant-before-commit" };
  s.faultState = { consumed: {} };
  const history = createHistory();
  const r = applyCommand(state, { type: "applyImageVariant", input: variantInput(state, "generated/variant.png", [textId]) }, s, history);
  assert(!r.ok, "fault must fail");
  assert(Object.keys(r.state.document.nodes).length === Object.keys(state.document.nodes).length, "no node on fault");
  assert(Object.keys(r.state.document.relations).length === Object.keys(state.document.relations).length, "no relation on fault");
  console.log("ok - fault injection leaves document unchanged");
}

export function runF4ImageVariantTests() {
  f4VariantCreatesNodeAndRelations();
  f4VariantUndo();
  f4VariantProvenanceRoundtrip();
  f4VariantStaleNoop();
  f4VariantRevisionConflict();
  f4VariantInvalidInputs();
  f4VariantFaultNoop();
  console.log("F4 image variant tests passed");
}
