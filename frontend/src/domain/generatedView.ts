import {
  type CanvasId,
  type DomainServices,
  type NodeId,
  type Provenance,
  type WorkspaceNode,
  type WorkspaceState,
  isFolder,
} from "./workspace";

export const MAX_BATCH_RELATIONS = 8;
export const MAX_CLUSTERS = 8;
export const MAX_CLUSTER_NODES = 40;
export const MIN_CLUSTERS = 2;

export type RelationBatchKind =
  | "source"
  | "derived"
  | "supports"
  | "opposes"
  | "similar";

export const RELATION_BATCH_KINDS: ReadonlySet<string> = new Set([
  "source",
  "derived",
  "supports",
  "opposes",
  "similar",
]);

export interface RelationBatchItem {
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  kind: RelationBatchKind;
  reason?: string;
  direction?: "forward" | "reverse";
}

export interface RelationBatchDraft {
  relations: RelationBatchItem[];
  sourceRevisions: Record<NodeId, number>;
  imageInputModes?: Record<NodeId, "vision" | "metadata-only">;
  provenance?: Provenance;
}

export interface ClusterViewClusterDraft {
  id: string;
  label: string;
  reason?: string;
  nodeIds: NodeId[];
}

export interface ClusterViewDraft {
  label: string;
  clusters: ClusterViewClusterDraft[];
  ungroupedNodeIds: NodeId[];
  sourceRevisions: Record<NodeId, number>;
  imageInputModes?: Record<NodeId, "vision" | "metadata-only">;
  provenance?: Provenance;
}

export interface GeneratedViewRecord extends ClusterViewDraft {
  id: string;
  kind: "cluster";
  workspaceId: string;
  canvasId: CanvasId;
  runtimeGeneration: string;
  scopeEpoch: number;
  source: "dialogue" | "direct";
  createdAt: string;
}

export interface ViewContextHint {
  viewId: string;
  kind: "cluster";
  label: string;
  clusters: Array<{
    clusterId: string;
    label: string;
    memberNodeIds: NodeId[];
  }>;
}

/** Validate a Relation batch draft against the current workspace state. */
export function validateRelationBatch(
  relations: RelationBatchItem[],
  state: WorkspaceState,
): string | null {
  const current = state.runtime.currentCanvasId;
  if (relations.length === 0) return "relation-batch-empty";
  if (relations.length > MAX_BATCH_RELATIONS)
    return "relation-batch-cap-exceeded";
  const seen = new Set<string>();
  for (const item of relations) {
    if (item.sourceNodeId === item.targetNodeId) return "self-relation";
    const src = state.document.nodes[item.sourceNodeId];
    const tgt = state.document.nodes[item.targetNodeId];
    if (!src || !tgt) return "relation-endpoint-missing";
    if (!RELATION_BATCH_KINDS.has(item.kind)) return "invalid relation kind";
    if (src.parentCanvasId !== current || tgt.parentCanvasId !== current) {
      return "relation-endpoint-out-of-scope";
    }
    const key = `${item.sourceNodeId}|${item.targetNodeId}|${item.kind}`;
    if (seen.has(key)) return "duplicate relation in batch";
    seen.add(key);
    for (const existing of Object.values(state.document.relations)) {
      if (
        existing.sourceNodeId === item.sourceNodeId &&
        existing.targetNodeId === item.targetNodeId &&
        existing.kind === item.kind
      ) {
        return "duplicate-accepted-relation";
      }
    }
  }
  return null;
}

export type NormalizeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function normalizeRelationBatchDraft(
  draft: RelationBatchDraft,
  state: WorkspaceState,
): NormalizeResult<RelationBatchItem[]> {
  const error = validateRelationBatch(draft.relations, state);
  if (error) return { ok: false, error };
  return { ok: true, value: draft.relations };
}

/** Normalize a Cluster View draft: assign runtime cluster IDs and validate. */
export function normalizeClusterViewDraft(
  draft: {
    label: string;
    clusters: Array<{ label: string; reason?: string; nodeIds: NodeId[] }>;
    ungroupedNodeIds?: NodeId[];
    sourceRevisions?: Record<NodeId, number>;
    imageInputModes?: Record<NodeId, "vision" | "metadata-only">;
    provenance?: Provenance;
  },
  state: WorkspaceState,
  services: DomainServices,
): NormalizeResult<ClusterViewDraft> {
  const current = state.runtime.currentCanvasId;
  if (draft.clusters.length < MIN_CLUSTERS) {
    return { ok: false, error: "cluster-view-requires-2-clusters" };
  }
  if (draft.clusters.length > MAX_CLUSTERS) {
    return { ok: false, error: "cluster-view-cap-exceeded" };
  }
  const seen = new Set<NodeId>();
  let total = 0;
  const clusters: ClusterViewClusterDraft[] = [];
  for (const c of draft.clusters) {
    const label = (c.label ?? "").trim();
    if (!label) return { ok: false, error: "cluster-label-required" };
    if (c.nodeIds.length === 0)
      return { ok: false, error: "cluster-member-empty" };
    const ids: NodeId[] = [];
    for (const id of c.nodeIds) {
      const node = state.document.nodes[id];
      if (!node || node.parentCanvasId !== current) {
        return { ok: false, error: "cluster-member-out-of-scope" };
      }
      if (isFolder(node)) return { ok: false, error: "cluster-folder-member" };
      if (seen.has(id)) return { ok: false, error: "cluster-member-duplicate" };
      seen.add(id);
      ids.push(id);
      total++;
    }
    clusters.push({
      id: services.ids.next("cluster"),
      label,
      reason: c.reason,
      nodeIds: ids,
    });
  }
  if (total > MAX_CLUSTER_NODES) {
    return { ok: false, error: "cluster-view-node-cap-exceeded" };
  }
  const ungrouped = (draft.ungroupedNodeIds ?? []).filter((id) => {
    const node = state.document.nodes[id];
    return (
      !!node &&
      node.parentCanvasId === current &&
      !isFolder(node) &&
      !seen.has(id)
    );
  });
  return {
    ok: true,
    value: {
      label: (draft.label ?? "").trim() || "Cluster View",
      clusters,
      ungroupedNodeIds: ungrouped,
      sourceRevisions: draft.sourceRevisions ?? {},
      imageInputModes: draft.imageInputModes,
      provenance: draft.provenance,
    },
  };
}

/** Re-check a Direct suggestion's correlation + source revisions against latest state. */
export type DirectSuggestionStaleStatus = "stale" | "cancelled" | "conflict";

export function revalidateDirectSuggestion(
  request: {
    workspaceId: string;
    canvasId: CanvasId;
    runtimeGeneration: string;
    scopeEpoch: number;
    sourceRevisions: Record<NodeId, number>;
  },
  latest: WorkspaceState,
): { status: DirectSuggestionStaleStatus; error: string } | null {
  if (
    latest.document.workspaceId !== request.workspaceId ||
    latest.runtime.runtimeGeneration !== request.runtimeGeneration
  ) {
    return {
      status: "cancelled",
      error: "suggestion-cancelled: workspace changed (New/Discard/Load)",
    };
  }
  if (
    latest.runtime.currentCanvasId !== request.canvasId ||
    latest.runtime.scopeEpoch !== request.scopeEpoch
  ) {
    return {
      status: "stale",
      error: "suggestion-stale: canvas or scope changed",
    };
  }
  for (const [id, rev] of Object.entries(request.sourceRevisions)) {
    const node = latest.document.nodes[id];
    if (!node || node.parentCanvasId !== request.canvasId) {
      return {
        status: "stale",
        error: `suggestion-stale: source ${id} out of scope`,
      };
    }
    if (node.revision !== rev) {
      return { status: "conflict", error: `source-revision-conflict: ${id}` };
    }
  }
  return null;
}

/** Re-check a proposal's source revisions before accept (Dialogue + Direct). */
export function revalidateViewSourceRevisions(
  sourceRevisions: Record<NodeId, number>,
  state: WorkspaceState,
): string | null {
  for (const [id, rev] of Object.entries(sourceRevisions)) {
    const node = state.document.nodes[id];
    if (!node || node.parentCanvasId !== state.runtime.currentCanvasId) {
      return `stale: node ${id} out of scope`;
    }
    if (node.revision !== rev) return `conflict: node ${id} revision changed`;
  }
  return null;
}

function cloneView(view: GeneratedViewRecord): GeneratedViewRecord {
  return {
    ...view,
    clusters: view.clusters.map((c) => ({ ...c, nodeIds: [...c.nodeIds] })),
    ungroupedNodeIds: [...view.ungroupedNodeIds],
    sourceRevisions: { ...view.sourceRevisions },
    imageInputModes: view.imageInputModes
      ? { ...view.imageInputModes }
      : undefined,
  };
}

/** Remove empty clusters (after member moves). The store closes a 0-cluster view. */
export function pruneEmptyClusters(
  view: GeneratedViewRecord,
): GeneratedViewRecord {
  const clusters = view.clusters.filter((c) => c.nodeIds.length > 0);
  if (clusters.length === view.clusters.length) return view;
  return { ...view, clusters };
}

export function renameCluster(
  view: GeneratedViewRecord,
  clusterId: string,
  label: string,
): GeneratedViewRecord {
  const next = cloneView(view);
  next.clusters = next.clusters.map((c) =>
    c.id === clusterId ? { ...c, label } : c,
  );
  return next;
}

export function moveClusterMember(
  view: GeneratedViewRecord,
  nodeId: NodeId,
  fromClusterId: string,
  toClusterId: string,
): GeneratedViewRecord {
  const next = cloneView(view);
  next.clusters = next.clusters.map((c) => {
    if (c.id === fromClusterId)
      return { ...c, nodeIds: c.nodeIds.filter((id) => id !== nodeId) };
    if (c.id === toClusterId)
      return c.nodeIds.includes(nodeId)
        ? c
        : { ...c, nodeIds: [...c.nodeIds, nodeId] };
    return c;
  });
  return pruneEmptyClusters(next);
}

export function removeClusterMember(
  view: GeneratedViewRecord,
  clusterId: string,
  nodeId: NodeId,
): GeneratedViewRecord {
  const next = cloneView(view);
  next.clusters = next.clusters.map((c) =>
    c.id === clusterId
      ? { ...c, nodeIds: c.nodeIds.filter((id) => id !== nodeId) }
      : c,
  );
  if (!next.ungroupedNodeIds.includes(nodeId))
    next.ungroupedNodeIds = [...next.ungroupedNodeIds, nodeId];
  return pruneEmptyClusters(next);
}

export function removeCluster(
  view: GeneratedViewRecord,
  clusterId: string,
): GeneratedViewRecord {
  const next = cloneView(view);
  const removed = next.clusters.find((c) => c.id === clusterId);
  if (removed) {
    next.ungroupedNodeIds = [
      ...new Set([...next.ungroupedNodeIds, ...removed.nodeIds]),
    ];
  }
  next.clusters = next.clusters.filter((c) => c.id !== clusterId);
  return next;
}

export interface HullBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of a cluster's members in canvas coordinates plus padding. */
export function computeClusterHull(
  nodeIds: NodeId[],
  nodes: Record<NodeId, WorkspaceNode>,
  padding = 24,
): HullBox | null {
  const members = nodeIds
    .map((id) => nodes[id])
    .filter((node): node is WorkspaceNode => Boolean(node));
  if (members.length === 0) return null;
  const minX = Math.min(...members.map((n) => n.position.x));
  const minY = Math.min(...members.map((n) => n.position.y));
  const maxX = Math.max(...members.map((n) => n.position.x + (n.width ?? 250)));
  const maxY = Math.max(
    ...members.map((n) => n.position.y + (n.height ?? 150)),
  );
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  };
}
