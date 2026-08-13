import { applyCommand, createHistory } from "../domain/workspaceCommands";
import { resolveContext } from "../domain/contextResolver";
import { loadWorkspaceJSON, workspaceToPrettyJSON } from "../domain/workspacePersistence";
import { createEmptyWorkspace, DomainServices, isTextBearing } from "../domain/workspace";
import { ContextPacket } from "../domain/contextPacket";

const services = (): DomainServices => {
  const counts: Record<string, number> = {};
  return {
    ids: { next: (kind) => `${kind}-${(counts[kind] = (counts[kind] ?? 0) + 1)}` },
    clock: { now: () => 1700000000000, nowISO: () => "2026-08-13T00:00:00.000Z" },
  };
};
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const packet: ContextPacket = {
  packetId: "pkt-1",
  query: "alpha topic",
  retrievedAt: "2026-08-13T00:00:00Z",
  executor: "direct-tool",
  contextProvider: "fake-web",
  status: "complete",
  workspaceId: "",
  canvasId: "",
  runtimeGeneration: "",
  scopeEpoch: 0,
  sources: [
    {
      sourceId: "src-1",
      title: "Alpha Paper",
      url: "https://example.com/alpha",
      domain: "example.com",
      snippet: "Alpha finding",
      retrievedAt: "2026-08-13T00:00:00Z",
    },
  ],
  claims: [
    { claimId: "cl-1", kind: "consensus", text: "Alpha is discussed.", sourceIds: ["src-1"] },
  ],
  suggestedRelations: [],
  unresolved: [],
  followups: [],
};

const s = services();
let state = createEmptyWorkspace(s);
let history = createHistory();
let result = applyCommand(state, { type: "createText", role: "text", input: { content: "Desk note", summary: "Desk" } }, s, history);
assert(result.ok, result.error || "create desk");
state = result.state;
history = result.history!;
const deskId = result.createdNodeId!;
const baseCount = Object.keys(state.document.nodes).length;

const promoteInput = {
  packetId: "pkt-1",
  workspaceId: state.document.workspaceId,
  canvasId: state.runtime.currentCanvasId,
  runtimeGeneration: state.runtime.runtimeGeneration,
  scopeEpoch: state.runtime.scopeEpoch,
  selectedClaimIds: ["cl-1"],
  selectedSourceIds: ["src-1"],
  acceptedRelations: [
    { claimId: "cl-1", targetNodeId: deskId, kind: "supports" as const, reason: "supports desk" },
  ],
  packet: {
    ...packet,
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
  },
};

result = applyCommand(state, { type: "promoteContextItems", input: promoteInput }, s, history);
assert(result.ok, result.error || "promote");
assert(Object.keys(result.state.document.nodes).length === baseCount + 2, "two text nodes created");
assert((result.createdRelationIds || []).length === 1, "accepted relation created");
const promoted = Object.values(result.state.document.nodes).filter((node) => node.id !== deskId);
assert(
  promoted.every((node) => isTextBearing(node) && node.role === "text" && node.provenance?.origin === "web"),
  "promoted nodes are text with web provenance",
);
assert(
  promoted.some((node) => isTextBearing(node) && node.provenance?.url === "https://example.com/alpha"),
  "source provenance url retained",
);
assert(result.state.document.nodes[deskId] && isTextBearing(result.state.document.nodes[deskId]) && result.state.document.nodes[deskId].content === "Desk note", "original node unchanged");

const undone = applyCommand(result.state, { type: "undo" }, s, result.history);
assert(undone.ok && Object.keys(undone.state.document.nodes).length === baseCount, "one undo restores document");

const stale = applyCommand(state, {
  type: "promoteContextItems",
  input: { ...promoteInput, runtimeGeneration: "old-gen" },
}, s, history);
assert(!stale.ok && stale.error === "promote-stale", "stale promote is no-op");
assert(Object.keys(stale.state.document.nodes).length === baseCount, "stale does not mutate");

const mismatchedId = applyCommand(state, {
  type: "promoteContextItems",
  input: { ...promoteInput, packetId: "other-packet" },
}, s, history);
assert(!mismatchedId.ok && mismatchedId.error === "promote-stale", "packetId must match packet body");

const overCap = applyCommand(state, {
  type: "promoteContextItems",
  input: {
    ...promoteInput,
    selectedClaimIds: ["cl-1"],
    selectedSourceIds: ["src-1", "src-1", "src-x", "src-y", "src-z", "src-w"],
    packet: {
      ...promoteInput.packet,
      sources: [
        ...promoteInput.packet.sources,
        { sourceId: "src-x", title: "x", url: "https://example.com/x", domain: "example.com", snippet: "", retrievedAt: "t" },
        { sourceId: "src-y", title: "y", url: "https://example.com/y", domain: "example.com", snippet: "", retrievedAt: "t" },
        { sourceId: "src-z", title: "z", url: "https://example.com/z", domain: "example.com", snippet: "", retrievedAt: "t" },
        { sourceId: "src-w", title: "w", url: "https://example.com/w", domain: "example.com", snippet: "", retrievedAt: "t" },
      ],
    },
  },
}, s, history);
assert(!overCap.ok && overCap.error === "promote-cap-exceeded", "cap enforced");

const missingTarget = applyCommand(state, {
  type: "promoteContextItems",
  input: {
    ...promoteInput,
    acceptedRelations: [{ claimId: "cl-1", targetNodeId: "missing", kind: "supports" }],
  },
}, s, history);
assert(!missingTarget.ok, "missing relation endpoint rejected");

const faultServices: DomainServices = {
  ...s,
  faultPlan: { failOnceAt: "promote-before-commit" },
  faultState: { consumed: {} },
};
const faulted = applyCommand(state, { type: "promoteContextItems", input: promoteInput }, faultServices, history);
assert(!faulted.ok && Object.keys(faulted.state.document.nodes).length === baseCount, "fault injects no partial update");

const persisted = workspaceToPrettyJSON(result.state, "2026-08-13T00:00:00.000Z");
assert(!persisted.includes("pkt-1"), "packet id not saved");
assert(!persisted.includes("\"kind\": \"projected-context\""), "packet object not saved");
const loaded = loadWorkspaceJSON(persisted, s);
assert(loaded.ok, loaded.ok ? "" : loaded.error);
const loadedWeb = Object.values(loaded.load.document.nodes).filter((node) => node.provenance?.origin === "web");
assert(loadedWeb.some((node) => node.provenance?.url === "https://example.com/alpha"), "web provenance roundtrips");

const afterPromote = result.state;
const nextEnvelope = resolveContext({
  document: afterPromote.document,
  runtime: afterPromote.runtime,
  mode: "dialogue",
  operation: "read",
});
assert(
  nextEnvelope.activeContextNodeIds.every((id) => afterPromote.document.nodes[id]),
  "only accepted document nodes enter next context",
);
