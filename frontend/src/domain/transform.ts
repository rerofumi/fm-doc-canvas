import {
  CanvasId,
  NodeId,
  Provenance,
  RelationKind,
  TextBearingNode,
  TransformApplyInput,
  WorkspaceState,
  isTextBearing,
} from "./workspace";

export type TransformOperation = TransformApplyInput["operation"];

export interface TransformRequest {
  operation: TransformOperation;
  sourceNodeIds: NodeId[];
  sourceRevisions: Record<NodeId, number>;
  workspaceId: string;
  canvasId: CanvasId;
  runtimeGeneration: string;
  scopeEpoch: number;
  contextDigest: string;
  sources: Array<{ nodeId: NodeId; content: string; summary: string; revision: number }>;
  instruction?: string;
}

export interface TransformDraft {
  operation: TransformOperation;
  sourceNodeIds: NodeId[];
  sourceRevisions: Record<NodeId, number>;
  content: string;
  summary: string;
  reason?: string;
  suggestedRelations: Array<{
    sourceNodeId: NodeId;
    targetNodeId?: NodeId;
    kind: Exclude<RelationKind, "context">;
    reason?: string;
  }>;
  provenance: Provenance;
}

const ARITY: Record<TransformOperation, { min: number; label: string }> = {
  summarize: { min: 1, label: "summarize" },
  compare: { min: 2, label: "compare" },
  counterpoint: { min: 1, label: "counterpoint" },
};

export function validateTransformSelection(
  state: WorkspaceState,
  operation: TransformOperation,
  sourceNodeIds: NodeId[] = state.runtime.selection.selectedNodeIds,
): string | null {
  const ids = [...new Set(sourceNodeIds)];
  const rule = ARITY[operation];
  if (ids.length < rule.min) return `${rule.label} requires at least ${rule.min} text node${rule.min === 1 ? "" : "s"}`;
  for (const id of ids) {
    const node = state.document.nodes[id];
    if (!node || !isTextBearing(node)) return "source must be a Text or Artifact node";
    if (node.parentCanvasId !== state.runtime.currentCanvasId) return "source-out-of-scope";
    if (state.runtime.contextSelection.excludedNodeIds.includes(id)) return "source is excluded from context";
  }
  return null;
}

export function buildTransformRequest(
  state: WorkspaceState,
  operation: TransformOperation,
  contextDigest: string,
  sourceNodeIds = state.runtime.selection.selectedNodeIds,
  instruction?: string,
): TransformRequest {
  const error = validateTransformSelection(state, operation, sourceNodeIds);
  if (error) throw new Error(error);
  const ids = [...new Set(sourceNodeIds)];
  const sources = ids.map((nodeId) => {
    const node = state.document.nodes[nodeId] as TextBearingNode;
    return { nodeId, content: node.content, summary: node.summary, revision: node.revision };
  });
  return {
    operation,
    sourceNodeIds: ids,
    sourceRevisions: Object.fromEntries(sources.map((source) => [source.nodeId, source.revision])),
    workspaceId: state.document.workspaceId,
    canvasId: state.runtime.currentCanvasId,
    runtimeGeneration: state.runtime.runtimeGeneration,
    scopeEpoch: state.runtime.scopeEpoch,
    contextDigest,
    sources,
    instruction,
  };
}

export function normalizeTransformDraft(
  request: TransformRequest,
  draft: Partial<TransformDraft>,
): TransformApplyInput {
  if (draft.operation !== request.operation) throw new Error("unsupported-operation");
  if (draft.sourceNodeIds?.join("\u0000") !== request.sourceNodeIds.join("\u0000")) throw new Error("source mismatch");
  if (!draft.content?.trim()) throw new Error("empty-transform-output");
  const relations = (draft.suggestedRelations ?? []).filter((relation) =>
    request.sourceNodeIds.includes(relation.sourceNodeId),
  );
  return {
    operation: request.operation,
    sourceNodeIds: request.sourceNodeIds,
    sourceRevisions: request.sourceRevisions,
    content: draft.content,
    summary: draft.summary?.trim() || `${request.operation} result`,
    reason: draft.reason,
    suggestedRelations: relations,
    provenance: {
      origin: "llm",
      sourceNodeIds: request.sourceNodeIds,
      sourceRevisions: request.sourceRevisions,
      operation: request.operation,
      provider: draft.provenance?.provider,
      model: draft.provenance?.model,
      createdAt: draft.provenance?.createdAt,
    },
  };
}

export type DirectStaleStatus = "stale" | "cancelled" | "conflict";

/** Re-check Direct Action correlation against the latest workspace after provider await. */
export function revalidateDirectTransform(
  request: Pick<
    TransformRequest,
    "workspaceId" | "canvasId" | "runtimeGeneration" | "scopeEpoch" | "sourceNodeIds" | "sourceRevisions"
  >,
  latest: WorkspaceState,
): { status: DirectStaleStatus; error: string } | null {
  if (
    latest.document.workspaceId !== request.workspaceId ||
    latest.runtime.runtimeGeneration !== request.runtimeGeneration
  ) {
    return { status: "cancelled", error: "direct-transform-cancelled: workspace changed (New/Discard/Load)" };
  }
  if (
    latest.runtime.currentCanvasId !== request.canvasId ||
    latest.runtime.scopeEpoch !== request.scopeEpoch
  ) {
    return { status: "stale", error: "direct-transform-stale: canvas or scope changed" };
  }
  for (const id of request.sourceNodeIds) {
    const node = latest.document.nodes[id];
    if (!node || !isTextBearing(node)) {
      return { status: "stale", error: `direct-transform-stale: source ${id} missing` };
    }
    if (node.parentCanvasId !== request.canvasId) {
      return { status: "stale", error: `direct-transform-stale: source ${id} out of scope` };
    }
    if (node.revision !== request.sourceRevisions[id]) {
      return { status: "conflict", error: `source-revision-conflict: ${id}` };
    }
  }
  return null;
}
