import { create } from "zustand";
import { ActiveChatRuns, ChatMessage, ChatSession, ChatTarget, ChatToolEvent, ImageProvider } from "../types/chat";
import type { UiMessageDescriptor } from "../i18n/messages";

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type AssistantMode = "chat" | "direct";
export type DirectMode = "text" | "image";
export interface AssistantScopeSnapshot {
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  selectionRevision: number;
}
export type AssistantOperation =
  | { kind: "chat"; runId: string; sessionId: string }
  | { kind: "direct-text" | "direct-image" | "web-search" | "next-actions"; operationId: string; scope: AssistantScopeSnapshot }
  | null;

const NEW_SESSION_TITLE = "新しい会話";

export interface ChatState {
  isOpen: boolean;
  drawerWidth: number;
  target: ChatTarget | null;
  canvasId: string | null;
  loadGeneration: string | null;
  isLoaded: boolean;
  loadError: UiMessageDescriptor | null;
  saveError: UiMessageDescriptor | null;
  contextWarning: UiMessageDescriptor | null;
  sessions: ChatSession[];
  defaultSessionTitles: Record<string, string>;
  activeSessionId: string | null;
  activeRuns: ActiveChatRuns;
  mode: AssistantMode;
  directMode: DirectMode;
  draftsByCanvasId: Record<string, string>;
  imageProvider: ImageProvider;
  activeOperation: AssistantOperation;
  setOpen: (isOpen: boolean) => void;
  setDrawerWidth: (width: number) => void;
  setTarget: (target: ChatTarget | null) => void;
  setMode: (mode: AssistantMode) => void;
  setDirectMode: (mode: DirectMode) => void;
  setDraft: (canvasId: string, value: string) => void;
  appendDraft: (canvasId: string, value: string) => void;
  clearDraft: (canvasId: string) => void;
  setImageProvider: (provider: ImageProvider) => void;
  beginOperation: (operation: Exclude<AssistantOperation, null>) => boolean;
  finishOperation: (operationId: string) => void;
  cancelOperation: (operationId: string) => void;
  setContextWarning: (message: UiMessageDescriptor | null) => void;
  beginLoad: (canvasId: string, generation?: string) => void;
  hydrate: (canvasId: string, sessions: ChatSession[], generation?: string) => void;
  failLoad: (canvasId: string, message: UiMessageDescriptor, generation?: string) => void;
  setSaveError: (message: UiMessageDescriptor | null) => void;
  createSession: () => ChatSession;
  setActiveSession: (sessionId: string) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  replaceMessage: (sessionId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  appendStream: (sessionId: string, runId: string, text: string) => void;
  upsertToolEvent: (sessionId: string, runId: string, event: ChatToolEvent) => void;
  beginRun: (sessionId: string, runId: string, assistantMessageId: string) => void;
  finishRun: (sessionId: string, runId: string) => void;
  cancelRun: (sessionId: string) => void;
  resetWorkspace: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  drawerWidth: 420,
  target: null,
  canvasId: null,
  loadGeneration: null,
  isLoaded: false,
  loadError: null,
  saveError: null,
  contextWarning: null,
  sessions: [],
  defaultSessionTitles: {},
  activeSessionId: null,
  activeRuns: {},
  mode: "chat",
  directMode: "text",
  draftsByCanvasId: {},
  imageProvider: "openrouter",
  activeOperation: null,
  setOpen: (isOpen) => set({ isOpen }),
  setDrawerWidth: (drawerWidth) => set({ drawerWidth }),
  setTarget: (target) => set({ target, contextWarning: null }),
  setMode: (mode) => set((state) => state.activeOperation ? state : { mode }),
  setDirectMode: (directMode) => set((state) => state.activeOperation ? state : { directMode }),
  setDraft: (canvasId, value) => set((state) => ({
    draftsByCanvasId: { ...state.draftsByCanvasId, [canvasId]: value },
  })),
  appendDraft: (canvasId, value) => set((state) => {
    const prompt = value.trim();
    if (!prompt) return state;
    const current = state.draftsByCanvasId[canvasId] ?? "";
    return { draftsByCanvasId: { ...state.draftsByCanvasId, [canvasId]: current.trim() ? `${current}\n\n${prompt}` : prompt } };
  }),
  clearDraft: (canvasId) => set((state) => ({
    draftsByCanvasId: { ...state.draftsByCanvasId, [canvasId]: "" },
  })),
  setImageProvider: (imageProvider) => set((state) => state.activeOperation ? state : { imageProvider }),
  beginOperation: (activeOperation) => {
    if (get().activeOperation) return false;
    set({ activeOperation });
    return true;
  },
  finishOperation: (operationId) => set((state) => {
    const current = state.activeOperation;
    if (!current || ("runId" in current ? current.runId : current.operationId) !== operationId) return state;
    return { activeOperation: null };
  }),
  cancelOperation: (operationId) => set((state) => {
    const current = state.activeOperation;
    if (!current || ("runId" in current ? current.runId : current.operationId) !== operationId) return state;
    return { activeOperation: null };
  }),
  resetWorkspace: () => set((state) => ({
    target: null,
    canvasId: null,
    sessions: [],
    defaultSessionTitles: {},
    activeSessionId: null,
    activeRuns: {},
    draftsByCanvasId: {},
    contextWarning: null,
    loadError: null,
    saveError: null,
    activeOperation: null,
    isOpen: state.isOpen,
  })),
  setContextWarning: (contextWarning) => set({ contextWarning }),
  setSaveError: (saveError) => set({ saveError }),
  beginLoad: (canvasId, generation = "") => set({
    canvasId,
    loadGeneration: generation,
    isLoaded: false,
    loadError: null,
    saveError: null,
    contextWarning: null,
    sessions: [],
    defaultSessionTitles: {},
    activeSessionId: null,
    activeRuns: {},
    activeOperation: null,
  }),
  hydrate: (canvasId, sessions, generation = "") => set((state) => {
    if (state.canvasId !== canvasId || (state.loadGeneration ?? "") !== generation) return state;
    // The backend migrates marker-less legacy data. Keep a defensive
    // frontend fallback for fixtures/older bindings: only the exact generic
    // title is safe to infer; target-derived suffixes are user-owned.
    const migratedSessions = sessions.map((session) => ({
      ...session,
      isDefaultTitle: typeof session.isDefaultTitle === "boolean"
        ? session.isDefaultTitle
        : session.title === NEW_SESSION_TITLE,
    }));
    const defaultSessionTitles = Object.fromEntries(migratedSessions
      .filter((session) => session.isDefaultTitle)
      .map((session) => [session.id, session.title]));
    return {
      sessions: migratedSessions,
      defaultSessionTitles,
      activeSessionId: migratedSessions[0]?.id ?? null,
      isLoaded: true,
      loadError: null,
      saveError: null,
      activeRuns: {},
      activeOperation: null,
    };
  }),
  failLoad: (canvasId, message, generation = "") => set((state) =>
    state.canvasId === canvasId && (state.loadGeneration ?? "") === generation
      ? { isLoaded: false, loadError: message, sessions: [], defaultSessionTitles: {}, activeSessionId: null, activeRuns: {}, activeOperation: null }
      : state,
  ),
  createSession: () => {
    const now = Date.now();
    const target = get().target;
    const session: ChatSession = {
      id: newId(),
      title: target ? `${target.label} について` : "新しい会話",
      isDefaultTitle: true,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    set((state) => ({ sessions: [...state.sessions, session], defaultSessionTitles: { ...state.defaultSessionTitles, [session.id]: session.title }, activeSessionId: session.id }));
    return session;
  },
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  appendMessage: (sessionId, message) => set((state) => ({
    sessions: state.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      let title = session.title;
      let isDefaultTitle = session.isDefaultTitle;
      if (message.role === "user" && !session.messages.some((item) => item.role === "user") &&
          session.isDefaultTitle) {
        const normalized = message.content.trim().replace(/\s+/g, " ");
        if (normalized) {
          title = Array.from(normalized).slice(0, 24).join("");
          isDefaultTitle = false;
        }
      }
      return { ...session, title, isDefaultTitle, messages: [...session.messages, message], updatedAt: Date.now() };
    }),
  })),
  replaceMessage: (sessionId, messageId, patch) => set((state) => ({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, messages: session.messages.map((message) => message.id === messageId ? { ...message, ...patch } : message), updatedAt: Date.now() }
      : session),
  })),
  appendStream: (sessionId, runId, text) => set((state) => ({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, messages: session.messages.map((message) => {
          if (message.runId !== runId || message.role !== "assistant") return message;
          const terminal = message.status === "complete" || message.status === "cancelled" || message.status === "error";
          return { ...message, content: message.content + text, status: terminal ? message.status : "streaming" };
        }), updatedAt: Date.now() }
      : session),
  })),
  upsertToolEvent: (sessionId, runId, event) => set((state) => ({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, messages: session.messages.map((message) => {
          if (message.runId !== runId || message.role !== "assistant") return message;
          const toolEvents = message.toolEvents ?? [];
          const existing = toolEvents.findIndex((item) => item.toolCallId === event.toolCallId);
          const nextEvents = existing >= 0 ? toolEvents.map((item, index) => {
            if (index !== existing) return item;
            const merged = { ...item, ...event };
            // Wails events can be delivered out of order. A late tool_start
            // must never regress a proposal or terminal result to running.
            if (event.status === "running" && item.status !== "running") {
              merged.status = item.status;
            }
            return merged;
          }) : [...toolEvents, event];
          return { ...message, toolEvents: nextEvents };
        }), updatedAt: Date.now() }
      : session),
  })),
  beginRun: (sessionId, runId, assistantMessageId) => set((state) => ({
    activeRuns: { ...state.activeRuns, [sessionId]: { runId, assistantMessageId } },
  })),
  finishRun: (sessionId, runId) => set((state) => {
    if (state.activeRuns[sessionId]?.runId !== runId) return state;
    const activeRuns = { ...state.activeRuns };
    delete activeRuns[sessionId];
    const activeOperation = state.activeOperation && "runId" in state.activeOperation && state.activeOperation.runId === runId ? null : state.activeOperation;
    return { activeRuns, activeOperation };
  }),
  cancelRun: (sessionId) => set((state) => {
    if (!state.activeRuns[sessionId]) return state;
    const activeRuns = { ...state.activeRuns };
    delete activeRuns[sessionId];
    const active = state.activeRuns[sessionId];
    const activeOperation = active && state.activeOperation && "runId" in state.activeOperation && state.activeOperation.runId === active.runId ? null : state.activeOperation;
    return { activeRuns, activeOperation };
  }),
}));
