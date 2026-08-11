import { ContextEnvelope } from "./contextResolver";
import { WorkspaceState } from "./workspace";

export interface RunScopeToken {
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  runId: string;
  runEpoch: number;
  sessionId?: string;
  contextDigest: string;
  targetRevisions: Record<string, number>;
}

export function buildRunScopeToken(
  state: WorkspaceState,
  envelope: ContextEnvelope,
  runId: string,
  runEpoch: number,
  sessionId?: string,
): RunScopeToken {
  const targetRevisions: Record<string, number> = {};
  for (const id of envelope.bodyAllowlistNodeIds) {
    const node = state.document.nodes[id];
    if (node) targetRevisions[id] = node.revision;
  }
  return {
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
    runId,
    runEpoch,
    sessionId,
    contextDigest: envelope.contextDigest,
    targetRevisions,
  };
}

export function compareScope(
  state: WorkspaceState,
  token: RunScopeToken,
): { ok: true } | { ok: false; reason: string } {
  if (state.document.workspaceId !== token.workspaceId) {
    return { ok: false, reason: "workspace mismatch" };
  }
  if (state.runtime.runtimeGeneration !== token.runtimeGeneration) {
    return { ok: false, reason: "generation mismatch" };
  }
  if (state.runtime.scopeEpoch !== token.scopeEpoch) {
    return { ok: false, reason: "scope epoch mismatch" };
  }
  if (state.runtime.currentCanvasId !== token.canvasId) {
    return { ok: false, reason: "canvas mismatch" };
  }
  const run = state.runtime.asyncRuns[token.runId];
  if (!run || run.epoch !== token.runEpoch || run.status !== "active") {
    return { ok: false, reason: "run not active" };
  }
  for (const [nodeId, rev] of Object.entries(token.targetRevisions)) {
    const node = state.document.nodes[nodeId];
    if (!node || node.revision !== rev) {
      return { ok: false, reason: `target revision mismatch:${nodeId}` };
    }
  }
  return { ok: true };
}

export function boundedDialogueHistory(
  messages: Array<{
    role: string;
    content: string;
    status?: string;
  }>,
  limit = 12,
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        m.content.trim() &&
        m.status !== "streaming" &&
        m.status !== "error" &&
        m.status !== "cancelled",
    )
    .slice(-limit)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}
