import { useCallback, useEffect, useMemo, useState } from "react";
import { CancelChat, ResolveToolApplication, SendChat } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import ChatHeader from "../chat/ChatHeader";
import ChatInput from "../chat/ChatInput";
import MessageList from "../chat/MessageList";
import { ChatEvent, ChatMessage, ChatRequest, ChatSession } from "../../types/chat";
import { useChatStore } from "../../store/useChatStore";
import { useAppStore } from "../../store/useAppStore";
import { buildChatRequest } from "../../utils/chatContext";

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ChatDrawer = () => {
  const store = useChatStore();
  const setDrawerWidth = useChatStore((state) => state.setDrawerWidth);
  const [resizing, setResizing] = useState(false);
  const activeSession = useMemo(() => store.sessions.find((session) => session.id === store.activeSessionId) ?? null, [store.sessions, store.activeSessionId]);
  const activeRun = activeSession ? store.activeRuns[activeSession.id] : undefined;

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
    const unsubscribers = eventNames.map((name) => EventsOn(name, (payload: ChatEvent) => {
      const event = payload;
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
    }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

const send = async (content: string) => {
    const session: ChatSession = activeSession ?? store.createSession();
    const runId = newId();
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
    const sessionMessages = useChatStore.getState().sessions.find((s) => s.id === session.id)?.messages ?? [];
    const request: ChatRequest = buildChatRequest(
      app.workspace.runtime.currentCanvasId,
      runId,
      session.id,
      content,
      store.target,
      app.nodes,
      app.edges,
      app.workspace,
      sessionMessages.filter((m) => m.id !== assistantId),
      runEpoch,
    );
    store.setContextWarning(request.contextWarning?.message ?? null);
    try {
      await SendChat(request as any);
    } catch (error) {
      store.replaceMessage(session.id, assistantId, { content: error instanceof Error ? error.message : "送信できませんでした。", status: "error" });
      store.finishRun(session.id, runId);
      useAppStore.getState().dispatch({ type: "cancelAsyncRun", runId });
    }
  };

  const stop = () => {
    if (!activeRun || !activeSession) return;
    // Local cancel first (F-1 freshness authority), then best-effort backend cancel.
    useAppStore.getState().dispatch({ type: "cancelAsyncRun", runId: activeRun.runId });
    store.replaceMessage(activeSession.id, activeRun.assistantMessageId, { content: "キャンセルしました。", status: "cancelled" });
    store.cancelRun(activeSession.id);
    void CancelChat(activeRun.runId);
  };

  return <aside className={`fixed right-0 top-0 z-50 flex h-full flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${store.isOpen ? "translate-x-0" : "translate-x-full"}`} style={{ width: store.drawerWidth, transitionProperty: resizing ? "none" : "transform" }}>
    <div onMouseDown={(event) => { event.preventDefault(); setResizing(true); }} className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/30" />
    <ChatHeader target={store.target} sessions={store.sessions} activeSessionId={store.activeSessionId} disabled={!store.isLoaded} onChangeSession={store.setActiveSession} onNew={store.createSession} onClose={() => store.setOpen(false)} />
    {store.loadError && <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">会話履歴を読み込めませんでした: {store.loadError}</div>}
    {store.contextWarning && <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">{store.contextWarning}</div>}
    <MessageList messages={activeSession?.messages ?? []} sessionId={activeSession?.id} />
    <ChatInput disabled={!store.isLoaded} sending={Boolean(activeRun)} onSend={send} onStop={stop} />
  </aside>;
};

export default ChatDrawer;

