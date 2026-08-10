export type ChatRole = "user" | "assistant";
export type ChatMessageStatus = "streaming" | "complete" | "cancelled" | "error";

export type ToolCardStatus = "running" | "applied" | "conflict" | "cancelled" | "error" | "done";

export interface ChatToolEvent {
  toolCallId: string;
  name: string;
  status: ToolCardStatus;
  summary?: string;
  error?: string;
  proposal?: ChatToolProposal;
}

export interface ChatToolProposal {
  toolCallId: string;
  nodeId?: string;
  targetNodeId?: string;
  baseRevision?: number;
  operation: "create" | "replace" | "edit";
  filename?: string;
  proposed: string;
  searchText?: string;
  replacement?: string;
  lastEditSummary?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  runId?: string;
  targetNodeId?: string;
  targetRevision?: number;
  status?: ChatMessageStatus;
  toolEvents?: ChatToolEvent[];
}

export interface ChatNodeSnapshot {
  id: string;
  type: "text" | "artifact" | "image";
  revision: number;
  filename?: string;
  markdown?: string;
  imageRef?: string;
  prompt?: string;
}

export interface ChatEdgeSnapshot { source: string; target: string; }

export interface ChatRequest {
  runId: string;
  sessionId: string;
  canvasId: string;
  prompt: string;
  targetNodeId?: string;
  directContextNodeIds: string[];
  contextWarning?: { kind: "branch" | "loop"; message: string };
  snapshot: { canvasId: string; nodes: ChatNodeSnapshot[]; edges: ChatEdgeSnapshot[] };
}

export interface ChatEvent {
  runId: string;
  sessionId: string;
  type: string;
  text?: string;
  toolEvent?: ChatToolEvent;
  apply?: ChatToolProposal;
  error?: string;
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
