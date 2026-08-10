import { useCallback, useEffect, useMemo, useState } from "react";
import { GenerateChatReply } from "../../../wailsjs/go/main/App";
import ChatHeader from "../chat/ChatHeader";
import ChatInput from "../chat/ChatInput";
import MessageList from "../chat/MessageList";
import { ChatMessage, ChatSession } from "../../types/chat";
import { useChatStore } from "../../store/useChatStore";
import { buildChatRequestContext } from "../../utils/chatContext";

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
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "default";
    };
  }, [resizing, resize, stopResizing]);
  useEffect(() => {
    const clampWidth = () => setDrawerWidth(Math.max(320, Math.min(useChatStore.getState().drawerWidth, window.innerWidth * 0.8)));
    clampWidth();
    window.addEventListener("resize", clampWidth);
    return () => window.removeEventListener("resize", clampWidth);
  }, [setDrawerWidth]);

  const send = async (content: string) => {
    const session: ChatSession = activeSession ?? store.createSession();
    const runId = newId();
    const now = Date.now();
    const assistantId = newId();
    const user: ChatMessage = { id: newId(), role: "user", content, createdAt: now, runId, targetNodeId: store.target?.nodeId, targetRevision: store.target?.revision };
    store.appendMessage(session.id, user);
    store.appendMessage(session.id, { id: assistantId, role: "assistant", content: "", createdAt: now, runId, status: "streaming" });
    store.beginRun(session.id, runId, assistantId);
    try {
      const context = buildChatRequestContext(store.target, session.messages);
      const response = await GenerateChatReply(content, context);
      if (useChatStore.getState().activeRuns[session.id]?.runId === runId) {
        store.replaceMessage(session.id, assistantId, { content: response, status: "complete" });
      }
    } catch (error) {
      if (useChatStore.getState().activeRuns[session.id]?.runId === runId) {
        store.replaceMessage(session.id, assistantId, { content: error instanceof Error ? error.message : "応答を取得できませんでした。", status: "error" });
      }
    } finally {
      store.finishRun(session.id, runId);
    }
  };
  const stop = () => {
    if (!activeRun || !activeSession) return;
    const running = activeSession.messages.find((message) => message.id === activeRun.assistantMessageId && message.status === "streaming");
    if (running) store.replaceMessage(activeSession.id, running.id, { content: "キャンセルしました。", status: "cancelled" });
    store.cancelRun(activeSession.id);
  };

  return <aside className={`fixed right-0 top-0 z-50 flex h-full flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${store.isOpen ? "translate-x-0" : "translate-x-full"}`} style={{ width: store.drawerWidth, transitionProperty: resizing ? "none" : "transform" }}>
    <div onMouseDown={(event) => { event.preventDefault(); setResizing(true); }} className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/30" />
    <ChatHeader target={store.target} sessions={store.sessions} activeSessionId={store.activeSessionId} disabled={!store.isLoaded} onChangeSession={store.setActiveSession} onNew={store.createSession} onClose={() => store.setOpen(false)} />
    {store.loadError && <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">会話履歴を読み込めませんでした: {store.loadError}</div>}
    <MessageList messages={activeSession?.messages ?? []} />
    <ChatInput disabled={!store.isLoaded} sending={Boolean(activeRun)} onSend={send} onStop={stop} />
  </aside>;
};

export default ChatDrawer;
