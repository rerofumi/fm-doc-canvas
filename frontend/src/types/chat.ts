export type ChatRole = "user" | "assistant";
export type ChatMessageStatus = "streaming" | "complete" | "cancelled" | "error";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  runId?: string;
  targetNodeId?: string;
  targetRevision?: number;
  status?: ChatMessageStatus;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export type ActiveChatRuns = Record<
  string,
  { runId: string; assistantMessageId: string }
>;

export interface ChatTarget {
  nodeId: string;
  type: "artifact" | "text" | "image";
  label: string;
  context: string;
  revision?: number;
}
