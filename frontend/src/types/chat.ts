export type ChatRole = "user" | "assistant";
export type ChatMessageStatus = "streaming" | "complete" | "cancelled" | "error";

export type ToolCardStatus =
  | "running"
  | "proposed"
  | "applied"
  | "rejected"
  | "conflict"
  | "cancelled"
  | "stale"
  | "error"
  | "done";

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
  operation: "create" | "replace" | "edit" | "transform" | "relation";
  filename?: string;
  proposed: string;
  searchText?: string;
  replacement?: string;
  lastEditSummary?: string;
  workspaceId?: string;
  canvasId?: string;
  runtimeGeneration?: string;
  scopeEpoch?: number;
  runEpoch?: number;
  transform?: {
    operation: "summarize" | "compare" | "counterpoint";
    sourceNodeIds: string[];
    sourceRevisions: Record<string, number>;
    content: string;
    summary: string;
    reason?: string;
    suggestedRelations?: Array<{
      sourceNodeId: string;
      targetNodeId?: string;
      kind: "source" | "derived" | "supports" | "opposes" | "similar";
      reason?: string;
      direction?: "forward" | "reverse";
    }>;
    sources?: Array<{ nodeId: string; content: string; revision: number }>;
    provenance?: { origin?: string; provider?: string; model?: string; createdAt?: string };
  };
  relation?: {
    sourceNodeId: string;
    targetNodeId: string;
    kind: "source" | "derived" | "supports" | "opposes" | "similar";
    reason?: string;
    direction?: "forward" | "reverse";
  };
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
  bodyAllowlistNodeIds?: string[];
  workspaceId?: string;
  runtimeGeneration?: string;
  scopeEpoch?: number;
  runEpoch?: number;
  contextDigest?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
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

export interface DirectTransformReceipt {
  operation: "summarize" | "compare" | "counterpoint";
  sourceNodeIds: string[];
  createdNodeId?: string;
  createdRelationIds?: string[];
  summary: string;
  diff?: {
    sources: Array<{ nodeId: string; content: string; revision: number } | string>;
    output: string;
  };
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
