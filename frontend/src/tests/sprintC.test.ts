import { AppNode } from "../types";
import { buildChatRequest, describeChatTarget } from "../utils/chatContext";
import { traverseContextBackwards } from "../utils/graphUtils";
import { applyToolProposalToNodes } from "../utils/toolApplication";
import { useChatStore } from "../store/useChatStore";
import { useAppStore } from "../store/useAppStore";
import { isLatestCanvasSave } from "../utils/chatSessionSaveQueue";
import { createOrderedEventQueue } from "../utils/orderedEventQueue";
import { queueDiagnosticMessage, selectActiveChatRunForCancellation } from "../utils/chatRunLifecycle";
import { fromBackendChatSessions, toBackendChatSessions } from "../utils/chatSession";
import { backend } from "../../wailsjs/go/models";
import * as GeneratedBackend from "../../wailsjs/go/main/App";
import { configureAppRuntime } from "../store/useAppStore";
import { createProductionClock, createProductionIds } from "../runtime/runtimeEnvironment";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const textNode = (id: string, content: string, revision = 0): AppNode => ({
  id,
  type: "customNode",
  position: { x: 0, y: 0 },
  data: { content, summary: content, revision, charCount: content.length, wordCount: content.trim() ? content.trim().split(/\s+/u).length : 0 },
});
const artifactNode = (id: string, content: string, revision = 0, filename = "chapter.md"): AppNode => ({
  id,
  type: "artifactNode",
  position: { x: 0, y: 0 },
  data: { filename, language: "markdown", content, summary: filename, revision, charCount: content.length, wordCount: content.trim() ? content.trim().split(/\s+/u).length : 0 },
});
const imageNode = (id: string): AppNode => ({
  id,
  type: "imageNode",
  position: { x: 0, y: 0 },
  data: { src: "image.png", prompt: "blue castle" },
});

{
  type Event = { runId: string; sequence?: number; type: "stream" | "done" | "cancelled" };
  const delivered: string[] = [];
  let clock = 0;
  const diagnostics: string[] = [];
  const queue = createOrderedEventQueue<Event>({
    getRunId: (event) => event.runId,
    onEvent: (event) => delivered.push(`${event.runId}:${event.sequence ?? 0}:${event.type}`),
    isTerminal: (event) => event.type === "done" || event.type === "cancelled",
    maxRuns: 4,
    maxPendingEvents: 2,
    maxSequenceGap: 8,
    maxGapAgeMs: 100,
    now: () => clock,
    onDiagnostic: ({ runId, reason }) => diagnostics.push(`${runId}:${reason}`),
  });

  // Runs are isolated, and a terminal event buffered ahead of the first
  // event is drained in order. Queue deletion is based on the drained event,
  // not the outer event that happened to close the gap.
  queue.enqueue({ runId: "a", sequence: 1, type: "stream" });
  queue.enqueue({ runId: "b", sequence: 1, type: "stream" });
  assert(queue.enqueue({ runId: "a", sequence: 3, type: "done" }).status === "queued", "out-of-order terminal was not buffered");
  assert(queue.enqueue({ runId: "a", sequence: 2, type: "stream" }).status === "processed", "gap was not drained");
  assert(delivered.filter((item) => item.startsWith("a:")).join(",") === "a:1:stream,a:2:stream,a:3:done", "out-of-order events were not delivered in sequence");
  assert(queue.activeRunCount() === 1, "terminal drain left an active queue");
  assert(queue.enqueue({ runId: "a", sequence: 3, type: "done" }).status === "duplicate", "duplicate terminal reopened a queue");
  assert(queue.enqueue({ runId: "a", sequence: 4, type: "stream" }).status === "duplicate", "late event after terminal was delivered");

  // Duplicate sequence numbers, legacy sequence 0, and run separation are
  // deterministic and do not grow pending state.
  assert(queue.enqueue({ runId: "b", sequence: 1, type: "stream" }).status === "duplicate", "duplicate sequence was delivered");
  assert(queue.enqueue({ runId: "legacy", type: "stream" }).status === "processed", "legacy sequence 0 was not processed");
  assert(delivered.at(-1) === "legacy:0:stream", "legacy event delivery changed");

  // A permanent gap expires without changing the active run authority.
  clock = 10;
  assert(queue.enqueue({ runId: "gap", sequence: 2, type: "stream" }).status === "queued", "gap event was not queued");
  clock = 111;
  assert(queue.expire() === 1 && queue.activeRunCount() === 1, "permanent gap was not bounded-cleaned");
  assert(diagnostics.includes("gap:gap-expired"), "gap expiry diagnostic is missing");

  // Pending overflow quarantines only the bad run; a normal run remains
  // deliverable and is never misapplied after another run overflows.
  assert(queue.enqueue({ runId: "overflow", sequence: 2, type: "stream" }).status === "queued", "overflow fixture did not queue");
  assert(queue.enqueue({ runId: "overflow", sequence: 3, type: "stream" }).status === "queued", "overflow fixture did not fill bound");
  assert(queue.enqueue({ runId: "overflow", sequence: 4, type: "stream" }).status === "dropped", "pending overflow was not fail-closed");
  assert(queue.pendingCount("overflow") === 0, "overflow queue was not cleaned");

  clock = 200;
  assert(queue.enqueue({ runId: "normal", sequence: 1, type: "stream" }).status === "processed", "normal run was blocked by stale queue state");
  assert(queue.enqueue({ runId: "filler-a", sequence: 2, type: "stream" }).status === "queued", "run bound fixture A did not queue");
  assert(queue.enqueue({ runId: "filler-b", sequence: 2, type: "stream" }).status === "queued", "run bound fixture B did not queue");
  assert(queue.enqueue({ runId: "run-overflow", sequence: 2, type: "stream" }).status === "dropped", "active run overflow was not fail-closed");
  assert(queue.pendingCount("filler-a") === 1 && queue.pendingCount("filler-b") === 1, "run overflow damaged normal queues");
  queue.clear("b");
  queue.clear("normal");
  queue.clear("filler-a");
  queue.clear("filler-b");

  // Cancel is terminal in the same way as done: late stale events are
  // rejected and cannot reactivate the local queue.
  assert(queue.enqueue({ runId: "cancel", sequence: 2, type: "cancelled" }).status === "queued", "cancel terminal was not queued");
  assert(queue.enqueue({ runId: "cancel", sequence: 1, type: "stream" }).status === "processed", "cancel run did not drain");
  const beforeLate = delivered.length;
  assert(queue.enqueue({ runId: "cancel", sequence: 3, type: "stream" }).status === "duplicate", "late cancelled event was not rejected");
  assert(delivered.length === beforeLate, "late cancelled event reached the processor");

  // A bounded queue diagnostic releases only its matching local run. Once
  // released, active-run correlation makes a repeated diagnostic a no-op;
  // the ordered queue tombstone prevents another diagnostic for that run.
  const activeRuns = {
    "session-a": { runId: "active-a", assistantMessageId: "assistant-a" },
    "session-b": { runId: "active-b", assistantMessageId: "assistant-b" },
  };
  const firstClaim = selectActiveChatRunForCancellation(activeRuns, "active-a");
  assert(firstClaim?.sessionId === "session-a", "diagnostic selected the wrong session");
  assert(firstClaim?.assistantMessageId === "assistant-a", "diagnostic selected the wrong message");
  const releasedRuns = { "session-b": activeRuns["session-b"] };
  assert(selectActiveChatRunForCancellation(releasedRuns, "active-a") === null, "duplicate diagnostic was not idempotent");
  const otherRun = selectActiveChatRunForCancellation(activeRuns, "active-b");
  assert(otherRun?.sessionId === "session-b", "diagnostic cancelled an unrelated run");
  assert(selectActiveChatRunForCancellation(activeRuns, "missing") === null, "late terminal created a local run");
  assert(queueDiagnosticMessage("gap-expired").status === "error", "queue diagnostic did not terminalize as error");

  // Terminal tombstones are bounded independently of the number of runs that
  // produce diagnostics. Once the bound is exceeded, the oldest tombstone is
  // eligible for eviction while the newest duplicate remains suppressed.
  const boundedTombstones = createOrderedEventQueue<Event>({
    getRunId: (event) => event.runId,
    onEvent: () => {},
    isTerminal: (event) => event.type === "done" || event.type === "cancelled",
    maxRuns: 2,
  });
  for (let index = 0; index < 5; index += 1) {
    assert(boundedTombstones.enqueue({ runId: `terminal-${index}`, sequence: 1, type: "done" }).status === "processed", "terminal tombstone fixture did not close");
  }
  assert(boundedTombstones.enqueue({ runId: "terminal-4", sequence: 1, type: "done" }).status === "duplicate", "newest terminal tombstone was evicted");
  assert(boundedTombstones.enqueue({ runId: "terminal-0", sequence: 1, type: "stream" }).status === "processed", "old terminal tombstones were not bounded-evicted");
}

{
  // Store integration: applying the same lifecycle used by ChatDrawer must
  // release the local run and matching operation, cancel the domain async
  // run, and leave the terminal message visible. A late terminal sees no
  // active correlation and therefore has nothing to mutate.
  const chat = useChatStore.getState();
  chat.beginLoad("diagnostic-canvas", "diagnostic-generation");
  const session = chat.createSession();
  chat.appendMessage(session.id, {
    id: "diagnostic-assistant",
    role: "assistant",
    content: "partial",
    createdAt: 0,
    runId: "diagnostic-run",
    status: "streaming",
  });
  chat.beginOperation({ kind: "chat", runId: "diagnostic-run", sessionId: session.id });
  chat.beginRun(session.id, "diagnostic-run", "diagnostic-assistant");
  let cancelCalls = 0;
  configureAppRuntime({
    mode: "production",
    ids: createProductionIds(),
    clock: createProductionClock(),
    backend: { ...GeneratedBackend, CancelChat: async () => { cancelCalls += 1; } } as any,
    faultState: { consumed: {} },
  });
  const app = useAppStore.getState();
  app.dispatch({ type: "startAsyncRun", kind: "dialogue", runId: "diagnostic-run" });
  const claim = selectActiveChatRunForCancellation(useChatStore.getState().activeRuns, "diagnostic-run");
  assert(claim !== null, "active diagnostic run was not correlated in store");
  chat.replaceMessage(session.id, claim!.assistantMessageId, queueDiagnosticMessage("pending-overflow"));
  chat.cancelRun(session.id);
  app.dispatch({ type: "cancelAsyncRun", runId: "diagnostic-run" });
  app.dispatch({ type: "cancelAsyncRun", runId: "diagnostic-run" });
  const afterCancel = useChatStore.getState();
  assert(!afterCancel.activeRuns[session.id], "diagnostic did not release local activeRuns");
  assert(afterCancel.activeOperation === null, "diagnostic did not release matching activeOperation");
  assert(afterCancel.sessions.find((item) => item.id === session.id)?.messages[0]?.status === "error", "diagnostic did not terminalize the assistant message");
  assert(useAppStore.getState().workspace.runtime.asyncRuns["diagnostic-run"]?.status === "cancelled", "diagnostic did not cancel the domain async run");
  assert(cancelCalls === 1, "backend CancelChat was not exactly-once for a repeated domain cancel");
}

{
  // Keep the transport boundary explicit: true, false, and omitted legacy
  // markers must survive conversion without target-derived title inference.
  const converted = fromBackendChatSessions([
    new backend.ChatSession({ id: "true", title: "対象 について", isDefaultTitle: true, createdAt: 0, updatedAt: 0, messages: [] }),
    new backend.ChatSession({ id: "false", title: "手動タイトル", isDefaultTitle: false, createdAt: 0, updatedAt: 0, messages: [] }),
    new backend.ChatSession({ id: "legacy", title: "新しい会話", createdAt: 0, updatedAt: 0, messages: [] }),
  ]);
  assert(converted[0].isDefaultTitle === true, "fromBackend lost marker=true");
  assert(converted[1].isDefaultTitle === false, "fromBackend lost marker=false");
  assert(converted[2].isDefaultTitle === undefined, "fromBackend invented a legacy marker");
  const roundTrip = toBackendChatSessions(converted);
  assert(roundTrip[0].isDefaultTitle === true, "toBackend changed marker=true");
  assert(roundTrip[1].isDefaultTitle === false, "toBackend changed marker=false");
  assert(roundTrip[2].isDefaultTitle === true, "toBackend did not apply legacy generic-title fallback");
  const legacySuffix = toBackendChatSessions([{
    id: "legacy-suffix",
    title: "調査 について",
    createdAt: 0,
    updatedAt: 0,
    messages: [],
  }]);
  assert(legacySuffix[0].isDefaultTitle === false, "toBackend inferred a suffix title as default");
}

{
  const chat = useChatStore.getState();
  chat.setDraft("canvas-a", "draft A");
  chat.setDraft("canvas-b", "draft B");
  assert(useChatStore.getState().draftsByCanvasId["canvas-a"] === "draft A", "canvas draft A is not isolated");
  assert(useChatStore.getState().draftsByCanvasId["canvas-b"] === "draft B", "canvas draft B is not isolated");
  const session = chat.createSession();
  chat.appendMessage(session.id, { id: "title-user", role: "user", content: "  Unicode\n title with more than twenty-four characters  ", createdAt: Date.now() });
  const titled = useChatStore.getState().sessions.find((item) => item.id === session.id);
  assert(titled?.title === "Unicode title with more ", "session title is not normalized to 24 Unicode characters");
  assert(titled?.isDefaultTitle === false, "auto-named session did not persist marker=false in runtime");
  chat.appendMessage(session.id, { id: "title-user-2", role: "user", content: "second message must not rename", createdAt: Date.now() });
  assert(useChatStore.getState().sessions.find((item) => item.id === session.id)?.title === "Unicode title with more ", "second user message renamed the session");
  const scope = { workspaceId: "w", canvasId: "c", runtimeGeneration: "g", scopeEpoch: 1, selectionRevision: 1 };
  assert(useChatStore.getState().beginOperation({ kind: "direct-text", operationId: "op-1", scope }), "first assistant operation did not start");
  assert(!useChatStore.getState().beginOperation({ kind: "next-actions", operationId: "op-2", scope }), "second assistant operation started while pending");
  useChatStore.getState().setMode("direct");
  assert(useChatStore.getState().mode === "chat", "mode changed while operation pending");
  useChatStore.getState().finishOperation("op-1");
  useChatStore.getState().setMode("direct");
  assert(useChatStore.getState().mode === "direct", "mode did not change after operation terminal");

  // Hydration trusts the persisted marker. A suffix-shaped user title is not
  // inferred as default, while a marker-backed target-derived title remains
  // eligible even if target restoration is not available.
  chat.setTarget({ nodeId: "target-a", type: "text", label: "対象A", context: "" });
  chat.beginLoad("title-canvas", "title-generation");
  chat.hydrate("title-canvas", [
    { id: "new", title: "新しい会話", isDefaultTitle: true, createdAt: 0, updatedAt: 0, messages: [] },
    { id: "canonical", title: "対象A について", isDefaultTitle: true, createdAt: 0, updatedAt: 0, messages: [] },
    { id: "custom", title: "調査 について", isDefaultTitle: false, createdAt: 0, updatedAt: 0, messages: [] },
  ], "title-generation");
  const hydrated = useChatStore.getState();
  assert(hydrated.defaultSessionTitles.new === "新しい会話", "exact new-session default was not restored");
  assert(hydrated.defaultSessionTitles.canonical === "対象A について", "marker-backed target default was not restored");
  assert(!hydrated.defaultSessionTitles.custom, "suffix-only custom title was inferred as default");

  chat.beginLoad("legacy-title-canvas", "legacy-generation");
  chat.hydrate("legacy-title-canvas", [
    { id: "legacy-new", title: "新しい会話", createdAt: 0, updatedAt: 0, messages: [] },
    { id: "legacy-custom", title: "調査 について", createdAt: 0, updatedAt: 0, messages: [] },
  ], "legacy-generation");
  const migrated = useChatStore.getState();
  assert(migrated.sessions.find((session) => session.id === "legacy-new")?.isDefaultTitle === true, "marker-less generic title did not migrate to default");
  assert(migrated.sessions.find((session) => session.id === "legacy-custom")?.isDefaultTitle === false, "marker-less suffix title was not protected");

  // A queued old generation must be coalesced before it can write after a
  // newer generation for the same backend Canvas key.
  assert(!isLatestCanvasSave(4, 5), "old Canvas save version was not rejected");
  assert(isLatestCanvasSave(5, 5), "latest Canvas save version was not accepted");
}

{
  const request = buildChatRequest("canvas", "run-provider", "session-provider", "generate image", null, [imageNode("image")], [], undefined, [], 0, "xai");
  assert(request.imageProvider === "xai", "Chat payload did not retain shared image provider");
}

{
  const nodes = [textNode("upstream", "context"), artifactNode("target", "body")];
  const edges = [{ id: "edge", source: "upstream", target: "target" }];
  const traversal = traverseContextBackwards("target", nodes, edges);
  assert(traversal.nodes.map((node) => node.id).join(",") === "upstream,target", "direct context order is incorrect");
  const request = buildChatRequest("canvas", "run", "session", "prompt", describeChatTarget(nodes[1]), nodes, edges);
  assert(request.directContextNodeIds.join(",") === "upstream,target", "request does not preserve traversal order");
  assert(request.snapshot.nodes[1].markdown === "body", "target Markdown is missing from snapshot");
}

{
  const nodes = [textNode("a", "a"), textNode("b", "b"), artifactNode("target", "body")];
  const edges = [{ id: "a-target", source: "a", target: "target" }, { id: "b-target", source: "b", target: "target" }];
  const request = buildChatRequest("canvas", "run", "session", "prompt", describeChatTarget(nodes[2]), nodes, edges);
  assert(request.contextWarning?.kind === "branch", "branch warning is not retained");
}

{
  const nodes = [textNode("a", "a"), artifactNode("b", "b")];
  const edges = [{ id: "a-b", source: "a", target: "b" }, { id: "b-a", source: "b", target: "a" }];
  const request = buildChatRequest("canvas", "run", "session", "prompt", describeChatTarget(nodes[1]), nodes, edges);
  assert(request.contextWarning?.kind === "loop", "loop warning is not retained");
  assert(new Set(request.directContextNodeIds).size === request.directContextNodeIds.length, "loop context contains duplicate IDs");
}

{
  const nodes = [textNode("text", "old text", 4), artifactNode("artifact", "old artifact", 2), imageNode("image")];
  const textResult = applyToolProposalToNodes(nodes, { toolCallId: "call", nodeId: "text", targetNodeId: "text", baseRevision: 4, operation: "edit", proposed: "new words here" }, () => "created", () => 10);
  const textData = textResult.nodes[0].data as Record<string, unknown>;
  assert(textResult.status === "applied" && textData.revision === 5, "Text revision was not incremented");
  assert(textData.charCount === 14 && textData.wordCount === 3, "Text counts were not recalculated");
  const conflict = applyToolProposalToNodes(textResult.nodes, { toolCallId: "call-2", nodeId: "text", baseRevision: 4, operation: "edit", proposed: "stale" }, () => "created", () => 11);
  assert(conflict.status === "conflict" && conflict.nodes === textResult.nodes, "stale edit was not rejected");

  const artifactResult = applyToolProposalToNodes(nodes, { toolCallId: "call-3", nodeId: "artifact", baseRevision: 2, operation: "replace", proposed: "updated artifact", lastEditSummary: "updated" }, () => "created", () => 12);
  const artifactData = artifactResult.nodes[1].data as Record<string, unknown>;
  assert(artifactResult.status === "applied" && artifactData.revision === 3 && artifactData.lastEditSummary === "updated", "Artifact mutation metadata is incorrect");

  const created = applyToolProposalToNodes(nodes, { toolCallId: "call-4", operation: "create", filename: "chapter.md", proposed: "new artifact" }, () => "created", () => 13);
  assert(created.status === "applied" && created.createdNodeId === "created", "Artifact was not created");
  assert((created.nodes[3].data as Record<string, unknown>).filename === "chapter-2.md", "Artifact filename collision was not resolved");
}

{
  const nodes = [textNode("hidden", "secret body")];
  const request = buildChatRequest("canvas", "run", "session", "prompt", null, nodes, []);
  assert(request.directContextNodeIds.length === 0, "targetless request included direct context");
}

{
  // REQ-09 store-level regression: legacy exclusion state must not suppress
  // the payload after a node is selected again, in either assistant mode.
  const app = useAppStore.getState();
  app.newWorkspace();
  app.dispatch({ type: "createText", role: "text", input: { content: "context text" } });
  const textId = Object.values(useAppStore.getState().workspace.document.nodes).find((node) => node.kind === "text")?.id;
  app.dispatch({ type: "createImageRef", input: { src: "legacy-image.png", alt: "legacy image" } });
  const imageId = Object.values(useAppStore.getState().workspace.document.nodes).find((node) => node.kind === "image")?.id;
  assert(textId && imageId, "store fixture nodes were not created");
  const textNodeId = textId!;
  const imageNodeId = imageId!;

  app.dispatch({ type: "setSelection", state: { selectedNodeIds: [textNodeId, imageNodeId], activeNodeId: imageNodeId, revision: 1 } });
  let snapshot = useAppStore.getState();
  let chatPayload = snapshot.resolveSharedContext("dialogue", "read").payloadItems;
  let directPayload = snapshot.resolveSharedContext("direct", "generate-image").payloadItems;
  assert(chatPayload.filter((item) => item.kind === "text").length === 1, "Chat text payload count is incorrect");
  assert(chatPayload.filter((item) => item.kind.startsWith("image")).length === 1, "Chat image payload count is incorrect");
  assert(directPayload.filter((item) => item.kind === "text").length === 1, "Direct text payload count is incorrect");
  assert(directPayload.filter((item) => item.kind.startsWith("image")).length === 1, "Direct image payload count is incorrect");

  app.dispatch({ type: "setContextExcluded", nodeId: imageNodeId, excluded: true });
  app.dispatch({ type: "setSelection", state: { selectedNodeIds: [], revision: 2 } });
  app.dispatch({ type: "setSelection", state: { selectedNodeIds: [imageNodeId], activeNodeId: imageNodeId, revision: 3 } });
  snapshot = useAppStore.getState();
  chatPayload = snapshot.resolveSharedContext("dialogue", "read").payloadItems;
  directPayload = snapshot.resolveSharedContext("direct", "generate-image").payloadItems;
  assert(chatPayload.some((item) => "nodeId" in item && item.nodeId === imageNodeId), "Chat did not restore re-selected image");
  assert(directPayload.some((item) => "nodeId" in item && item.nodeId === imageNodeId), "Direct did not restore re-selected image");
  assert(snapshot.resolveSharedContext("dialogue", "read").excludedNodeIds.length === 0, "legacy exclusion leaked into store envelope");
}

console.log("Sprint C frontend logic tests passed");
