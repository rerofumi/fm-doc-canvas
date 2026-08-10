import { create } from "zustand";
import { ActiveChatRuns, ChatMessage, ChatSession, ChatTarget } from "../types/chat";

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface ChatState {
  isOpen: boolean;
  drawerWidth: number;
  target: ChatTarget | null;
  canvasId: string | null;
  isLoaded: boolean;
  loadError: string | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeRuns: ActiveChatRuns;
  setOpen: (isOpen: boolean) => void;
  setDrawerWidth: (width: number) => void;
  setTarget: (target: ChatTarget | null) => void;
  beginLoad: (canvasId: string) => void;
  hydrate: (canvasId: string, sessions: ChatSession[]) => void;
  failLoad: (canvasId: string, message: string) => void;
  createSession: () => ChatSession;
  setActiveSession: (sessionId: string) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  replaceMessage: (sessionId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  beginRun: (sessionId: string, runId: string, assistantMessageId: string) => void;
  finishRun: (sessionId: string, runId: string) => void;
  cancelRun: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  drawerWidth: 420,
  target: null,
  canvasId: null,
  isLoaded: false,
  loadError: null,
  sessions: [],
  activeSessionId: null,
  activeRuns: {},
  setOpen: (isOpen) => set({ isOpen }),
  setDrawerWidth: (drawerWidth) => set({ drawerWidth }),
  setTarget: (target) => set({ target }),
  beginLoad: (canvasId) => set({
    canvasId,
    isLoaded: false,
    loadError: null,
    sessions: [],
    activeSessionId: null,
    activeRuns: {},
  }),
  hydrate: (canvasId, sessions) => set((state) => {
    if (state.canvasId !== canvasId) return state;
    return {
      sessions,
      activeSessionId: sessions[0]?.id ?? null,
      isLoaded: true,
      loadError: null,
      activeRuns: {},
    };
  }),
  failLoad: (canvasId, message) => set((state) =>
    state.canvasId === canvasId
      ? { isLoaded: false, loadError: message, sessions: [], activeSessionId: null, activeRuns: {} }
      : state,
  ),
  createSession: () => {
    const now = Date.now();
    const target = get().target;
    const session: ChatSession = {
      id: newId(),
      title: target ? `${target.label} について` : "新しい会話",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    set((state) => ({ sessions: [...state.sessions, session], activeSessionId: session.id }));
    return session;
  },
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  appendMessage: (sessionId, message) => set((state) => ({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, messages: [...session.messages, message], updatedAt: Date.now() }
      : session),
  })),
  replaceMessage: (sessionId, messageId, patch) => set((state) => ({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, messages: session.messages.map((message) => message.id === messageId ? { ...message, ...patch } : message), updatedAt: Date.now() }
      : session),
  })),
  beginRun: (sessionId, runId, assistantMessageId) => set((state) => ({
    activeRuns: { ...state.activeRuns, [sessionId]: { runId, assistantMessageId } },
  })),
  finishRun: (sessionId, runId) => set((state) => {
    if (state.activeRuns[sessionId]?.runId !== runId) return state;
    const activeRuns = { ...state.activeRuns };
    delete activeRuns[sessionId];
    return { activeRuns };
  }),
  cancelRun: (sessionId) => set((state) => {
    if (!state.activeRuns[sessionId]) return state;
    const activeRuns = { ...state.activeRuns };
    delete activeRuns[sessionId];
    return { activeRuns };
  }),
}));
