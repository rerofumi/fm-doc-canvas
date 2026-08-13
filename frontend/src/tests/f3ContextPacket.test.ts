import { resolveContext } from "../domain/contextResolver";
import {
  hintExcerpt,
  incomingPacketRejection,
  normalizeContextPacket,
  normalizeHttpsUrl,
  normalizeSources,
  resolveWebSearchQuery,
} from "../domain/contextPacket";
import { applyCommand } from "../domain/workspaceCommands";
import { createEmptyWorkspace, DomainServices } from "../domain/workspace";

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

assert(!("error" in normalizeHttpsUrl("https://Example.com/path/")), "https url should normalize");
const url = normalizeHttpsUrl("https://Example.com/path/");
assert(!("error" in url) && url.url === "https://example.com/path" && url.domain === "example.com", "host lowercased and trailing slash stripped");
assert("error" in normalizeHttpsUrl("http://example.com"), "http rejected");
assert("error" in normalizeHttpsUrl("https://user:pass@example.com"), "userinfo rejected");
assert("error" in normalizeHttpsUrl("file:///tmp/x"), "file rejected");

const collapsed = normalizeSources(
  [
    { sourceId: "s1", title: "A", url: "https://example.com/alpha", snippet: "one", retrievedAt: "t" },
    { sourceId: "s2", title: "A2", url: "https://example.com/alpha/", snippet: "dup", retrievedAt: "t" },
    { sourceId: "s3", title: "B", url: "https://news.example.com/beta", snippet: "two", retrievedAt: "t" },
    { sourceId: "s4", title: "C", url: "https://example.com/gamma", snippet: "three", retrievedAt: "t" },
  ],
  8,
);
assert(collapsed.sources.length === 3, "duplicate URL collapsed");
assert(collapsed.sources[0].clusterId === collapsed.sources[2].clusterId, "same domain clustered");
assert(collapsed.sources[0].clusterId !== collapsed.sources[1].clusterId, "different domains stay independent");

const packet = normalizeContextPacket({
  packetId: "p1",
  query: "q",
  retrievedAt: "t",
  executor: "direct-tool",
  contextProvider: "fake-web",
  status: "complete",
  workspaceId: "ws",
  canvasId: "c",
  runtimeGeneration: "g",
  scopeEpoch: 0,
  sources: collapsed.sources,
  claims: [
    { claimId: "c1", kind: "consensus", text: "Shared finding", sourceIds: [collapsed.sources[0].sourceId] },
    { claimId: "c2", kind: "consensus", text: "No source", sourceIds: [] },
  ],
  suggestedRelations: [],
  unresolved: [],
  followups: [],
});
assert(packet.claims.length === 1, "claim without source rejected");
assert(packet.claims[0].sourceIds.length === 1, "claim cites a source");

const unsourced = normalizeContextPacket({
  ...packet,
  claims: [{ claimId: "bad", kind: "consensus", text: "fact", sourceIds: ["missing"] }],
});
assert(unsourced.status === "partial" && unsourced.claims.length === 0, "unsourced claims cannot become facts");

assert(hintExcerpt("Summary hint", "hidden body that must not leak") === "Summary hint", "summary preferred");
assert(hintExcerpt("", "First line\nHidden rest").startsWith("First line"), "excerpt is first line only");
assert(resolveWebSearchQuery("short query", ["Summary"]) === "short query", "short explicit query preserved");
assert(resolveWebSearchQuery("", ["Summary"]) === "Summary", "selected summary resolves an empty direct-action query");
assert(resolveWebSearchQuery("x".repeat(500), ["Summary"]) === "Summary", "long body query falls back to summary");
assert(resolveWebSearchQuery("x".repeat(500), []).length === 400, "long query without summary is bounded");

const s = services();
let state = createEmptyWorkspace(s);
state = applyCommand(state, { type: "createText", role: "text", input: { content: "Visible", summary: "Hint A" } }, s).state;
const a = Object.keys(state.document.nodes)[0];
state = applyCommand(state, { type: "createText", role: "text", input: { content: "Other", summary: "Hint B" } }, s).state;
const b = Object.keys(state.document.nodes).find((id) => id !== a)!;
state = applyCommand(state, { type: "setSelection", state: { selectedNodeIds: [a], activeNodeId: a, revision: 1 } }, s).state;
state = applyCommand(state, {
  type: "setExternalContextRefs",
  delegatedSessions: [],
  projectedContexts: [
    {
      kind: "projected-context",
      packetId: "pending",
      items: [{ itemId: "i", summary: "should not be active", sourceRefs: ["https://hidden.example"], inference: true }],
      provenance: { origin: "web" },
      status: "candidate",
    },
  ],
}, s).state;
const envelope = resolveContext({
  document: state.document,
  runtime: state.runtime,
  mode: "direct",
  operation: "web-search",
});
assert(envelope.bodyAllowlistNodeIds.includes(a), "selected hint allowed");
assert(!envelope.bodyAllowlistNodeIds.includes(b), "unselected node not sent");
assert(
  !JSON.stringify(envelope.payloadItems).includes("https://hidden.example"),
  "unaccepted packet URL is not sent as payload",
);
assert(
  envelope.bodyAllowlistNodeIds.every((id) => id === a),
  "unaccepted packet does not enter body allowlist",
);
assert(envelope.activeContextNodeIds.every((id) => id === a), "web-search does not expand unrelated bodies");

const latePacket = {
  packetId: "pkt-late",
  query: "q",
  retrievedAt: "t",
  executor: "direct-tool" as const,
  contextProvider: "fake-web" as const,
  status: "complete" as const,
  workspaceId: state.document.workspaceId,
  canvasId: state.runtime.currentCanvasId,
  runtimeGeneration: state.runtime.runtimeGeneration,
  scopeEpoch: state.runtime.scopeEpoch,
  runId: "run-1",
  runEpoch: 1,
  sources: [],
  claims: [],
  suggestedRelations: [],
  unresolved: [],
  followups: [],
};
assert(
  incomingPacketRejection(latePacket, latePacket, "dialogue-agent", {
    runId: "run-1",
    epoch: 1,
    status: "cancelled",
  }) === "promote-stale",
  "cancelled run rejects late dialogue packet",
);
assert(
  incomingPacketRejection(latePacket, latePacket, "dialogue-agent", {
    runId: "run-1",
    epoch: 2,
    status: "active",
  }) === "promote-stale",
  "runEpoch mismatch rejects packet",
);
assert(
  incomingPacketRejection({ ...latePacket, runId: undefined }, latePacket, "dialogue-agent", {
    runId: "run-1",
    epoch: 1,
    status: "active",
  }) === "promote-stale",
  "dialogue packet without runId is stale",
);
assert(
  incomingPacketRejection({ ...latePacket, runEpoch: undefined }, latePacket, "dialogue-agent", {
    runId: "run-1",
    epoch: 1,
    status: "active",
  }) === "promote-stale",
  "dialogue packet without runEpoch is stale",
);
assert(
  incomingPacketRejection(latePacket, latePacket, "direct-action") === null,
  "direct action does not require a run",
);
