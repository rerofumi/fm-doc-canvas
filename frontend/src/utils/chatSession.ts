import { backend } from "../../wailsjs/go/models";
import { ActiveChatRuns, ChatMessage, ChatSession } from "../types/chat";

const roleOf = (role: string): ChatMessage["role"] =>
  role === "assistant" ? "assistant" : "user";

// Wails generates class-based transport types. Convert at this boundary so the
// UI store can retain its narrower role/status types without leaking them into
// generated code.
export function fromBackendChatSessions(
  sessions: backend.ChatSession[] | null | undefined,
): ChatSession[] {
  return (sessions ?? []).map((session) => ({
    id: session.id,
    title: session.title,
    isDefaultTitle: session.isDefaultTitle,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: (session.messages ?? []).map((message) => ({
      id: message.id,
      role: roleOf(message.role),
      content: message.content,
      createdAt: message.createdAt,
      runId: message.runId,
      targetNodeId: message.targetNodeId,
      targetRevision: message.targetRevision,
      status: "complete",
    })),
  }));
}

export function toBackendChatSessions(sessions: ChatSession[]): backend.ChatSession[] {
  return sessions.map((session) => new backend.ChatSession({
    id: session.id,
    title: session.title,
    isDefaultTitle: session.isDefaultTitle ?? session.title === "新しい会話",
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      runId: message.runId,
      targetNodeId: message.targetNodeId,
      targetRevision: message.targetRevision,
    })),
  }));
}

export function settleInterruptedChatSessions(
  sessions: ChatSession[],
  activeRuns: ActiveChatRuns,
): ChatSession[] {
  if (Object.keys(activeRuns).length === 0) return sessions;
  return sessions.map((session) => {
    const activeRun = activeRuns[session.id];
    if (!activeRun) return session;
    return {
      ...session,
      updatedAt: Date.now(),
      messages: session.messages.map((message) =>
        message.id === activeRun.assistantMessageId && message.status === "streaming"
          ? { ...message, content: "Canvas切替によりキャンセルしました。", status: "cancelled" }
          : message,
      ),
    };
  });
}
