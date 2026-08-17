import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenerateTextWithImages, LoadChatSessions, ResolveToolApplication, SaveChatSessions, SendChat } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import ChatHeader from "../chat/ChatHeader";
import ChatInput from "../chat/ChatInput";
import AssistantActionRow from "../chat/AssistantActionRow";
import DirectModeSelector from "../chat/DirectModeSelector";
import ContextPreview from "../context/ContextPreview";
import NextActionPanel from "../collaboration/NextActionPanel";
import MessageList from "../chat/MessageList";
import { ChatEvent, ChatMessage, ChatRequest, ChatSession } from "../../types/chat";
import { AssistantScopeSnapshot, useChatStore } from "../../store/useChatStore";
import { useAppStore } from "../../store/useAppStore";
import { buildChatRequest } from "../../utils/chatContext";
import { fromBackendChatSessions, toBackendChatSessions } from "../../utils/chatSession";
import { createCanvasSaveQueue } from "../../utils/chatSessionSaveQueue";
import { createOrderedEventQueue } from "../../utils/orderedEventQueue";
import { queueDiagnosticMessage, selectActiveChatRunForCancellation } from "../../utils/chatRunLifecycle";

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ChatDrawer = () => {
  const store = useChatStore();
  const setDrawerWidth = useChatStore((state) => state.setDrawerWidth);
  const [resizing, setResizing] = useState(false);
  const configuredImageProvider = useAppStore((state) => state.config.imageGen.provider);
  const currentCanvasId = useAppStore((state) => state.workspace.runtime.currentCanvasId);
  const runtimeGeneration = useAppStore((state) => state.workspace.runtime.runtimeGeneration);
  const orchestrationStatus = useAppStore((state) => state.orchestrationStatus);
  const lastDirectReceipt = useAppStore((state) => state.lastDirectReceipt);
  const providerBeforeConfig = useRef(store.imageProvider);
  // The backend stores sessions under Canvas ID. Keep one monotonic queue per
  // that real key; generation is carried as freshness metadata and must never
  // split the queue into independent writers.
  const saveQueue = useRef(createCanvasSaveQueue<ReturnType<typeof toBackendChatSessions>>(
    (canvasId, payload) => SaveChatSessions(canvasId, payload),
  ));
  const nextOperationId = useRef<string | null>(null);
  const activeSession = useMemo(() => store.sessions.find((session) => session.id === store.activeSessionId) ?? null, [store.sessions, store.activeSessionId]);
  const activeRun = activeSession ? store.activeRuns[activeSession.id] : undefined;
  const operationPending = Boolean(store.activeOperation);
  const captureScope = (): AssistantScopeSnapshot => {
    const app = useAppStore.getState();
    return {
      workspaceId: app.workspace.document.workspaceId,
      canvasId: app.workspace.runtime.currentCanvasId,
      runtimeGeneration: app.workspace.runtime.runtimeGeneration,
      scopeEpoch: app.workspace.runtime.scopeEpoch,
      selectionRevision: app.workspace.runtime.selection.revision,
    };
  };
  const isCurrentScope = (scope: AssistantScopeSnapshot) => {
    const latest = useAppStore.getState().workspace;
    return latest.document.workspaceId === scope.workspaceId &&
      latest.runtime.currentCanvasId === scope.canvasId &&
      latest.runtime.runtimeGeneration === scope.runtimeGeneration &&
      latest.runtime.scopeEpoch === scope.scopeEpoch &&
      latest.runtime.selection.revision === scope.selectionRevision;
  };

  const contextForDirect = async (
    scope: AssistantScopeSnapshot,
    operation: "generate-text" | "generate-image",
  ) => {
    const app = useAppStore.getState();
    const envelope = app.resolveSharedContext("direct", operation);
    const allowlisted = new Set(envelope.bodyAllowlistNodeIds);
    const nodes = app.nodes.filter((node) => allowlisted.has(node.id));
    const contextText = nodes.filter((node) => node.type === "customNode" || node.type === "artifactNode")
      .map((node) => (node.data as { content?: string }).content)
      .filter((content): content is string => Boolean(content)).join("\n\n---\n\n");
    const imageDataURLs: string[] = [];
    for (const node of nodes.filter((item) => item.type === "imageNode")) {
      try { imageDataURLs.push(await app.getImageDataURL((node.data as { src: string }).src)); }
      catch (error) { console.warn("Failed to resolve image context", error); }
    }
    return { app, envelope, nodes, contextText, imageDataURLs, scope };
  };

  useEffect(() => {
    let cancelled = false;
    store.beginLoad(currentCanvasId, runtimeGeneration);
    void LoadChatSessions(currentCanvasId)
      .then((sessions) => {
        if (!cancelled) store.hydrate(currentCanvasId, fromBackendChatSessions(sessions), runtimeGeneration);
      })
      .catch((error) => {
        if (!cancelled) store.failLoad(currentCanvasId, error instanceof Error ? error.message : "chat-session-load-failed", runtimeGeneration);
      });
    return () => { cancelled = true; };
  }, [currentCanvasId, runtimeGeneration]);

  useEffect(() => {
    if (!store.isLoaded || store.canvasId !== currentCanvasId) return;
    const generation = runtimeGeneration;
    const payload = toBackendChatSessions(store.sessions);
    const queued = saveQueue.current.enqueue(currentCanvasId, generation, payload);
    void queued.then(() => {
      const current = useChatStore.getState();
      if (current.canvasId === currentCanvasId && current.loadGeneration === generation) current.setSaveError(null);
    }).catch((error) => {
      const current = useChatStore.getState();
      if (current.canvasId === currentCanvasId && current.loadGeneration === generation) {
        const message = error instanceof Error ? error.message : "chat-session-save-failed";
        current.setSaveError(message);
        console.warn("Failed to save chat sessions", error);
      }
    });
  }, [currentCanvasId, runtimeGeneration, store.canvasId, store.isLoaded, store.loadGeneration, store.sessions]);

  useEffect(() => {
    // Synchronize the configured default only until the user selects a
    // provider in the drawer. Subsequent config updates must not overwrite
    // the Assistant runtime authority.
    if (!store.activeOperation && ["openrouter", "openai", "google", "xai"].includes(configuredImageProvider) && store.imageProvider === providerBeforeConfig.current) {
      store.setImageProvider(configuredImageProvider as typeof store.imageProvider);
      providerBeforeConfig.current = configuredImageProvider as typeof store.imageProvider;
    }
  }, [configuredImageProvider, store.activeOperation, store.imageProvider, store.setImageProvider]);

  const resize = useCallback((event: MouseEvent) => {
    const width = Math.max(320, Math.min(window.innerWidth * 0.8, window.innerWidth - event.clientX));
    setDrawerWidth(width);
  }, [setDrawerWidth]);
  const stopResizing = useCallback(() => setResizing(false), []);
  useEffect(() => {
    if (!resizing) return;
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", stopResizing); document.body.style.cursor = "default"; };
  }, [resizing, resize, stopResizing]);
  useEffect(() => {
    const clampWidth = () => setDrawerWidth(Math.max(320, Math.min(useChatStore.getState().drawerWidth, window.innerWidth * 0.8)));
    clampWidth();
    window.addEventListener("resize", clampWidth);
    return () => window.removeEventListener("resize", clampWidth);
  }, [setDrawerWidth]);

  useEffect(() => {
    const eventNames = ["chat:stream", "chat:tool_start", "chat:tool_apply", "chat:tool_done", "chat:context_packet", "chat:done", "chat:cancelled", "chat:error"];
    const processEvent = (event: ChatEvent) => {
      if (!event?.runId || !event.sessionId) {
        console.warn("Ignored chat event without correlation", event);
        return;
      }
      const chat = useChatStore.getState();
      const session = chat.sessions.find((item) => item.id === event.sessionId);
      if (!session) {
        console.warn("Ignored chat event for unknown session", event);
        return;
      }
      // A late stream/tool event is allowed to correlate only with the
      // currently active local run and its still-active domain run.  In
      // particular, mutation/cancel/Undo can restore the document while the
      // backend still delivers events for the old run; those events must not
      // alter chat content, tool cards, timeline, or the document.
      if (
        event.type === "chat:stream" ||
        event.type === "chat:tool_start" ||
        event.type === "chat:tool_done"
      ) {
        const active = chat.activeRuns[event.sessionId];
        const domainRun = useAppStore.getState().workspace.runtime.asyncRuns[event.runId];
        if (
          active?.runId !== event.runId ||
          domainRun?.kind !== "dialogue" ||
          domainRun.status !== "active"
        ) {
          console.warn("Ignored stale/cancelled chat event", event);
          return;
        }
      }
      if (event.type === "chat:stream" && event.text) chat.appendStream(event.sessionId, event.runId, event.text);
      if (event.type === "chat:tool_start" && event.toolEvent) chat.upsertToolEvent(event.sessionId, event.runId, event.toolEvent);
      if (event.type === "chat:tool_done" && event.toolEvent) chat.upsertToolEvent(event.sessionId, event.runId, event.toolEvent);
      if (event.type === "chat:context_packet" && event.packet) {
        const appState = useAppStore.getState();
        const domainRun = appState.workspace.runtime.asyncRuns[event.runId];
        const active = useChatStore.getState().activeRuns[event.sessionId];
        if (active?.runId !== event.runId || !domainRun || domainRun.status !== "active") {
          chat.upsertToolEvent(event.sessionId, event.runId, {
            toolCallId: event.packet.packetId,
            name: "web_search",
            status: "stale",
            summary: "stale/cancelled run",
            packet: event.packet,
          });
          return;
        }
        chat.upsertToolEvent(event.sessionId, event.runId, {
          toolCallId: event.packet.packetId,
          name: "web_search",
          status: event.packet.status === "failed" ? "error" : "done",
          summary: event.packet.query,
          packet: event.packet,
          error: event.packet.error?.message,
        });
        useAppStore.getState().applyIncomingPacket(
          { ...event.packet, runId: event.packet.runId || event.runId },
          "dialogue-agent",
        );
      }
if (event.type === "chat:tool_apply" && event.apply) {
        const active = useChatStore.getState().activeRuns[event.sessionId];
        const appState = useAppStore.getState();
        const domainRun = appState.workspace.runtime.asyncRuns[event.runId];
        if (active?.runId !== event.runId || !domainRun || domainRun.status !== "active") {
          chat.upsertToolEvent(event.sessionId, event.runId, {
            toolCallId: event.apply.toolCallId,
            name: "mutation",
            status: "stale",
            proposal: event.apply,
            summary: "stale/cancelled run",
          });
          void ResolveToolApplication({
            toolCallId: event.apply.toolCallId,
            status: "cancelled",
            workspaceId: event.apply.workspaceId,
            canvasId: event.apply.canvasId,
            runtimeGeneration: event.apply.runtimeGeneration,
            scopeEpoch: event.apply.scopeEpoch,
            runEpoch: event.apply.runEpoch,
          }).catch((error) => console.warn("Failed to cancel stale tool application", error));
          return;
        }
        // Keep proposal visible for human decision (accept/reject) instead of auto-applying.
        chat.upsertToolEvent(event.sessionId, event.runId, {
          toolCallId: event.apply.toolCallId,
          name: "mutation",
          status: "proposed",
          proposal: event.apply,
          summary: "accept / reject required",
        });
      }
      if (event.type === "chat:done") {
        const active = useChatStore.getState().activeRuns[event.sessionId];
        if (active?.runId === event.runId) chat.replaceMessage(event.sessionId, active.assistantMessageId, { status: "complete" });
        chat.finishRun(event.sessionId, event.runId);
        useAppStore.getState().dispatch({ type: "completeAsyncRun", runId: event.runId });
      }
      if (event.type === "chat:cancelled") {
        const active = useChatStore.getState().activeRuns[event.sessionId];
        if (active?.runId === event.runId) chat.replaceMessage(event.sessionId, active.assistantMessageId, { content: "キャンセルしました。", status: "cancelled" });
        chat.finishRun(event.sessionId, event.runId);
        useAppStore.getState().dispatch({ type: "cancelAsyncRun", runId: event.runId });
      }
      if (event.type === "chat:error") {
        const active = useChatStore.getState().activeRuns[event.sessionId];
        if (active?.runId === event.runId) chat.replaceMessage(event.sessionId, active.assistantMessageId, { content: event.error || "応答を取得できませんでした。", status: "error" });
        chat.finishRun(event.sessionId, event.runId);
        useAppStore.getState().dispatch({ type: "cancelAsyncRun", runId: event.runId });
      }
    };
    const eventQueue = createOrderedEventQueue<ChatEvent>({
      getRunId: (event) => event.runId,
      onEvent: processEvent,
      isTerminal: (event) => event.type === "chat:done" || event.type === "chat:cancelled" || event.type === "chat:error",
      onDiagnostic: (diagnostic) => {
        const currentChat = useChatStore.getState();
        const selection = selectActiveChatRunForCancellation(currentChat.activeRuns, diagnostic.runId);
        if (!selection) {
          console.warn("Dropped bounded chat event queue", diagnostic);
          return;
        }
        const message = queueDiagnosticMessage(diagnostic.reason);
        // Release local state first. A re-entrant terminal event therefore
        // observes no active run and cannot mutate the message twice.
        currentChat.replaceMessage(selection.sessionId, selection.assistantMessageId, message);
        currentChat.cancelRun(selection.sessionId);
        // Domain freshness is a separate authority from the local queue.
        useAppStore.getState().dispatch({ type: "cancelAsyncRun", runId: selection.runId });
        console.warn("Dropped bounded chat event queue", diagnostic);
      },
    });
    const unsubscribers = eventNames.map((name) => EventsOn(name, (payload: ChatEvent) => {
      eventQueue.enqueue(payload, payload.sequence);
    }));
    // A permanently missing sequence must not retain a run forever. Queue
    // cleanup is local only; async-run freshness/cancellation authority stays
    // in the app store and is never mutated by this guard.
    const expiryTimer = window.setInterval(() => eventQueue.expire(), 1_000);
    return () => {
      window.clearInterval(expiryTimer);
      eventQueue.clear();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const send = async (content = store.draftsByCanvasId[currentCanvasId] ?? "") => {
    if (!content.trim() || operationPending) return;
    useAppStore.getState().dismissNextActions();
    const session: ChatSession = activeSession ?? store.createSession();
    const runId = newId();
    if (!store.beginOperation({ kind: "chat", runId, sessionId: session.id })) return;
    // Snapshot only the messages that were complete before this turn. The
    // current user prompt must be sent as ChatRequest.prompt exactly once.
    const previousMessages = useChatStore.getState().sessions.find((s) => s.id === session.id)?.messages ?? [];
    const now = Date.now();
    const assistantId = newId();
    const user: ChatMessage = { id: newId(), role: "user", content, createdAt: now, runId, targetNodeId: store.target?.nodeId, targetRevision: store.target?.revision };
    store.appendMessage(session.id, user);
    store.appendMessage(session.id, { id: assistantId, role: "assistant", content: "", createdAt: now, runId, status: "streaming" });
    store.beginRun(session.id, runId, assistantId);
    const app = useAppStore.getState();
    // Register domain async run epoch for stale/cancel correlation.
    app.dispatch({ type: "startAsyncRun", kind: "dialogue", runId });
    const runEpoch = useAppStore.getState().workspace.runtime.asyncRuns[runId]?.epoch ?? 0;
    const request: ChatRequest = buildChatRequest(
      app.workspace.runtime.currentCanvasId,
      runId,
      session.id,
      content,
      store.target,
      app.nodes,
      app.edges,
      app.workspace,
      previousMessages,
      runEpoch,
       store.imageProvider,
    );
    store.setContextWarning(request.contextWarning?.message ?? null);
    try {
      await SendChat(request as any);
      store.clearDraft(currentCanvasId);
    } catch (error) {
      store.replaceMessage(session.id, assistantId, { content: error instanceof Error ? error.message : "送信できませんでした。", status: "error" });
      store.finishRun(session.id, runId);
      useAppStore.getState().dispatch({ type: "cancelAsyncRun", runId });
      store.cancelOperation(runId);
    }
  };

  const sendDirect = async () => {
    const prompt = (store.draftsByCanvasId[currentCanvasId] ?? "").trim();
    if (!prompt || operationPending) return;
    const scope = captureScope();
    const operationId = newId();
    // Snapshot mode/provider at operation start. UI controls are disabled
    // while pending, but the payload and receipt must remain deterministic
    // even if another runtime caller changes the store meanwhile.
    const directMode = store.directMode;
    const operation = directMode === "image" ? "generate-image" : "generate-text";
    const imageProvider = store.imageProvider;
    const kind: "direct-image" | "direct-text" = directMode === "image" ? "direct-image" : "direct-text";
    if (!store.beginOperation({ kind, operationId, scope })) return;
    const app = useAppStore.getState();
    app.dispatch({ type: "startAsyncRun", kind: "direct", runId: operationId });
    const selectedNodes = app.nodes.filter((node) => node.selected);
    const sourceNodeIds = selectedNodes.map((node) => node.id);
    const sourceRevisions = Object.fromEntries(selectedNodes.map((node) => [node.id, (node.data as { revision?: number }).revision ?? 0]));
    const lastNode = selectedNodes.at(-1);
    const position = lastNode ? { x: lastNode.position.x + 350, y: lastNode.position.y } : { x: 400, y: 300 };
    try {
      const context = await contextForDirect(scope, operation);
      if (!isCurrentScope(scope)) {
        useAppStore.setState({ lastDirectReceipt: { operation: "direct-stale", sourceNodeIds, summary: "対象 Canvas が変更されたため結果を破棄しました。" } });
        return;
      }
      let success = false;
      if (directMode === "text") {
        const generatedText = context.imageDataURLs.length > 0
          ? await GenerateTextWithImages(prompt, context.contextText, context.imageDataURLs)
          : await app.generateText(prompt, context.contextText);
        const summary = await app.generateSummary(generatedText);
        if (!isCurrentScope(scope)) {
          useAppStore.setState({ lastDirectReceipt: { operation: "direct-stale", sourceNodeIds, summary: "対象 Canvas が変更されたため結果を破棄しました。" } });
          return;
        }
        const created = app.createDirectText({
          content: generatedText,
          summary,
          originalPrompt: prompt,
          position,
          scope,
        });
        if (!created.ok || !created.nodeId) {
          useAppStore.setState({ lastDirectReceipt: { operation: "direct-stale", sourceNodeIds, summary: "対象 Canvas が変更されたため結果を破棄しました。" } });
          return;
        }
        useAppStore.setState({ lastDirectReceipt: {
          operation: "generate-text",
          sourceNodeIds,
          createdNodeId: created.nodeId,
          summary: "Direct Text を生成しました。",
        } });
        success = true;
      } else {
        const imageSrc = await app.generateImage(prompt, context.contextText, context.imageDataURLs, imageProvider);
        if (isCurrentScope(scope)) {
          success = app.applyDirectImageVariant({
            src: imageSrc,
            alt: prompt,
            prompt,
            provider: imageProvider,
            model: app.config.imageGen[imageProvider]?.model || app.config.imageGen.model || "",
            sourceNodeIds,
            sourceRevisions,
            position,
            scope,
          });
        } else {
          useAppStore.setState({ lastDirectReceipt: { operation: "direct-stale", sourceNodeIds, summary: "対象 Canvas が変更されたため結果を破棄しました。" } });
        }
      }
      if (success) store.clearDraft(currentCanvasId);
    } catch (error) {
      useAppStore.setState({ lastError: error instanceof Error ? error.message : "Direct operation failed" });
    } finally {
      const latest = useAppStore.getState().workspace.runtime.asyncRuns[operationId];
      if (latest?.status === "active") app.dispatch({ type: "completeAsyncRun", runId: operationId });
      store.finishOperation(operationId);
    }
  };

  const runNextActions = async () => {
    if (operationPending) return;
    const scope = captureScope();
    const operationId = newId();
    if (!store.beginOperation({ kind: "next-actions", operationId, scope })) return;
    nextOperationId.current = operationId;
    try {
      await useAppStore.getState().requestNextActions(store.mode === "chat" ? (activeSession?.messages ?? []) : []);
    } finally {
      if (nextOperationId.current === operationId) nextOperationId.current = null;
      store.finishOperation(operationId);
    }
  };

  const cancelNextActions = () => {
    const operationId = nextOperationId.current;
    nextOperationId.current = null;
    if (operationId) store.cancelOperation(operationId);
  };

  const dispatchNextAction = async (actionId: string, edits?: { targetNodeIds?: string[]; query?: string }) => {
    if (operationPending) return;
    const scope = captureScope();
    const operationId = newId();
    if (!store.beginOperation({ kind: "next-actions", operationId, scope })) return;
    try {
      await useAppStore.getState().dispatchNextAction(actionId, edits);
    } finally {
      store.finishOperation(operationId);
    }
  };

  const runSearch = async () => {
    const query = (store.draftsByCanvasId[currentCanvasId] ?? "").trim();
    if (!query || operationPending) return;
    const scope = captureScope();
    const operationId = newId();
    if (!store.beginOperation({ kind: "web-search", operationId, scope })) return;
    try {
      if (store.mode === "chat") {
        const session = activeSession ?? store.createSession();
        store.appendMessage(session.id, { id: newId(), role: "user", content: query, createdAt: Date.now() });
      }
      const accepted = await useAppStore.getState().runWebSearch(query, { entryRoute: store.mode === "chat" ? "dialogue-agent" : "direct-action" });
      if (accepted) store.clearDraft(currentCanvasId);
    } finally {
      store.finishOperation(operationId);
    }
  };

  const stop = () => {
    if (!activeRun || !activeSession) return;
    // Local cancel first (F-1 freshness authority), then best-effort backend cancel.
    useAppStore.getState().dispatch({ type: "cancelAsyncRun", runId: activeRun.runId });
    store.replaceMessage(activeSession.id, activeRun.assistantMessageId, { content: "キャンセルしました。", status: "cancelled" });
    store.cancelRun(activeSession.id);
  };

  const draft = store.draftsByCanvasId[currentCanvasId] ?? "";
  const directPending = store.mode === "direct" && operationPending;
  const contextOperation = store.mode === "chat"
    ? "read"
    : store.activeOperation?.kind === "direct-image"
      ? "generate-image"
      : store.activeOperation?.kind === "direct-text"
        ? "generate-text"
        : store.directMode === "image"
          ? "generate-image"
          : "generate-text";
  return <aside className={`fixed right-0 top-0 z-50 flex h-full flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${store.isOpen ? "translate-x-0" : "translate-x-full"}`} style={{ width: store.drawerWidth, transitionProperty: resizing ? "none" : "transform" }}>
    <div onMouseDown={(event) => { event.preventDefault(); setResizing(true); }} className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/30" />
    <ChatHeader target={store.target} sessions={store.sessions} activeSessionId={store.activeSessionId} mode={store.mode} imageProvider={store.imageProvider} disabled={!store.isLoaded || operationPending} onChangeMode={store.setMode} onChangeSession={store.setActiveSession} onChangeImageProvider={store.setImageProvider} onNew={store.createSession} onClose={() => store.setOpen(false)} />
    {store.loadError && <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">会話履歴を読み込めませんでした: {store.loadError}</div>}
    {store.saveError && <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">会話履歴を保存できませんでした。現在の下書き・履歴は保持されています: {store.saveError}</div>}
    {store.contextWarning && <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">{store.contextWarning}</div>}
    {store.mode === "chat" ? <MessageList messages={activeSession?.messages ?? []} sessionId={activeSession?.id} /> : <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="direct-result-surface">
      {directPending && <div role="status" aria-live="polite" className="mb-3 rounded bg-blue-50 p-3 text-sm text-blue-800">処理中… Direct の結果を生成しています。</div>}
      {lastDirectReceipt && <div className="rounded border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900"><div className="font-semibold">{lastDirectReceipt.operation}</div><div>{lastDirectReceipt.summary}</div>{lastDirectReceipt.createdNodeId && <div data-testid="direct-created-node-id">Created node: {lastDirectReceipt.createdNodeId}</div>}</div>}
      {!directPending && !lastDirectReceipt && <div className="text-sm text-gray-500">Direct 結果はここに表示されます。</div>}
    </div>}
    <NextActionPanel
      messages={activeSession?.messages ?? []}
      showTrigger={false}
      triggerDisabled={operationPending}
      onRetry={() => void runNextActions()}
      onDispatch={(actionId, edits) => void dispatchNextAction(actionId, edits)}
      onCancel={cancelNextActions}
      disabled={operationPending && orchestrationStatus !== "pending"}
    />
    {store.mode === "direct" && <div className="border-t border-gray-100 bg-white px-3 pt-2">
      <DirectModeSelector value={store.directMode} disabled={!store.isLoaded || operationPending} onChange={store.setDirectMode} />
    </div>}
    <div className="border-t border-gray-100 bg-white px-3 pt-2">
      <ContextPreview mode={store.mode === "chat" ? "dialogue" : "direct"} operation={contextOperation} />
    </div>
    <ChatInput value={draft} onChange={(value) => store.setDraft(currentCanvasId, value)} disabled={!store.isLoaded || operationPending} sending={store.mode === "chat" && Boolean(activeRun)} onSend={() => { if (store.mode === "chat") void send(); else void sendDirect(); }} onStop={stop} showSubmit={false} />
    <AssistantActionRow mode={store.mode} disabled={!store.isLoaded || operationPending} canStop={store.isLoaded} hasPrompt={Boolean(draft.trim())} pending={operationPending} chatRunning={Boolean(activeRun)} onNext={() => void runNextActions()} onSearch={() => void runSearch()} onSubmit={() => { if (store.mode === "chat") void send(); else void sendDirect(); }} onStop={stop} />
  </aside>;
};

export default ChatDrawer;

