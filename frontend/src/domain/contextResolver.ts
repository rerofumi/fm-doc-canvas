import { canvasPath, validateDocument } from "./invariants";
import type { GeneratedViewRecord, ViewContextHint } from "./generatedView";
import {
  type CanvasId,
  type ContextSelectionState,
  type FocusState,
  type NodeId,
  type RelationId,
  type SelectionState,
  type WorkspaceDocument,
  type WorkspaceRuntime,
  type WorkspaceTargetRef,
  isFolder,
  isTextBearing,
  nodesOnCanvas,
} from "./workspace";

export type ResolveMode = "dialogue" | "direct";
export type ResolveOperation =
  | "read"
  | "summarize"
  | "generate-text"
  | "generate-image"
  | "mutate-text"
  | "relate"
  | "group"
  | "move"
  | "web-search";

// VISION_CAP is the maximum number of explicitly selected images that a single
// Dialogue run may send as pixel (`image-binary`) to the LLM. The 4th+ selected
// image degrades to metadata-only with a `vision-cap` warning.
export const VISION_CAP = 3;

export interface ResolveContextInput {
  document: Readonly<WorkspaceDocument>;
  runtime: Readonly<
    Pick<
      WorkspaceRuntime,
      | "currentCanvasId"
      | "runtimeGeneration"
      | "commandSequence"
      | "scopeEpoch"
      | "selection"
      | "contextSelection"
      | "focus"
    >
  >;
  mode: ResolveMode;
  operation: ResolveOperation;
  generatedView?: GeneratedViewRecord | null;
}

export type ContextPayloadDescriptor =
  | { kind: "text"; nodeId: NodeId; destination: "llm" | "image-provider" }
  | {
      kind: "image-metadata";
      nodeId: NodeId;
      destination: "llm" | "image-provider";
    }
  | {
      kind: "image-binary";
      nodeId: NodeId;
      destination: "llm" | "image-provider";
    }
  | { kind: "canvas-metadata"; canvasId: CanvasId; destination: "llm" }
  | {
      kind: "remote-relation-metadata";
      relationId: RelationId;
      destination: "llm";
    };

export interface SpatialContextHint {
  nodeId: NodeId;
  canvasId: CanvasId;
  position: { x: number; y: number };
  selected: boolean;
}

export interface RelationContextHint {
  relationId: RelationId;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  kind: string;
  reason?: string;
  provenance?: WorkspaceDocument["nodes"][string]["provenance"];
}

export interface ContextWarning {
  kind: string;
  message: string;
  nodeId?: NodeId;
  relationId?: RelationId;
}

export interface ContextEnvelope {
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  commandSequenceAtResolve: number;
  focus?: FocusState;
  activeContextNodeIds: string[];
  activeCanvasTargets: Array<{
    canvasId: CanvasId;
    expansion: "metadata-only" | "direct-members";
  }>;
  candidateContextNodeIds: string[];
  delegatedSessionRefs: ContextSelectionState["delegatedSessions"];
  projectedContextRefs: ContextSelectionState["projectedContexts"];
  mutationTarget?: WorkspaceTargetRef;
  relationTargetNodeIds: string[];
  bodyAllowlistNodeIds: string[];
  payloadItems: ContextPayloadDescriptor[];
  relationHints: RelationContextHint[];
  spatialHints: SpatialContextHint[];
  viewHints: ViewContextHint[];
  excludedNodeIds: string[];
  warnings: ContextWarning[];
  contextDigest: string;
}

function stableHash(input: string): string {
  // FNV-1a 32-bit then hex; good enough for digest correlation in-app.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function pushUnique(list: string[], id: string): void {
  if (!list.includes(id)) list.push(id);
}

export function resolveContext(input: ResolveContextInput): ContextEnvelope {
  const { document, runtime, mode, operation } = input;
  const warnings: ContextWarning[] = [];
  const invariantError = validateDocument(document as WorkspaceDocument);
  if (invariantError) {
    warnings.push({ kind: "invariant", message: invariantError });
  }

  const currentCanvasId = runtime.currentCanvasId;
  const excluded = new Set(runtime.contextSelection.excludedNodeIds);
  const activeContextNodeIds: string[] = [];
  const activeCanvasTargets: ContextEnvelope["activeCanvasTargets"] = [];
  const candidateContextNodeIds: string[] = [];

  const selection = runtime.selection as SelectionState;
  const effectiveTargets: WorkspaceTargetRef[] = [];
  if (selection.selectedNodeIds.length > 0) {
    effectiveTargets.push({
      kind: "nodes",
      nodeIds: [...selection.selectedNodeIds],
    });
  }
  for (const t of runtime.contextSelection.addedContextTargets) {
    effectiveTargets.push(t);
  }

  const expandNode = (nodeId: NodeId) => {
    const node = document.nodes[nodeId];
    if (!node) {
      warnings.push({
        kind: "missing-node",
        message: `missing node ${nodeId}`,
        nodeId,
      });
      return;
    }
    if (node.parentCanvasId !== currentCanvasId) {
      warnings.push({
        kind: "off-canvas",
        message: `node ${nodeId} not on current canvas`,
        nodeId,
      });
      return;
    }
    if (excluded.has(nodeId)) return;
    if (isFolder(node)) {
      activeCanvasTargets.push({
        canvasId: node.childCanvasId,
        expansion: "metadata-only",
      });
      return;
    }
    pushUnique(activeContextNodeIds, nodeId);
  };

  for (const target of effectiveTargets) {
    if (target.kind === "nodes") {
      for (const id of target.nodeIds) expandNode(id);
    } else if (target.kind === "canvas") {
      if (target.expansion === "direct-members") {
        if (target.canvasId !== currentCanvasId) {
          warnings.push({
            kind: "canvas-target",
            message: "direct-members canvas target must be current canvas",
          });
          continue;
        }
        activeCanvasTargets.push({
          canvasId: target.canvasId,
          expansion: "direct-members",
        });
        for (const node of nodesOnCanvas(
          document as WorkspaceDocument,
          target.canvasId,
        )) {
          if (isFolder(node) || excluded.has(node.id)) continue;
          pushUnique(activeContextNodeIds, node.id);
        }
      } else {
        activeCanvasTargets.push({
          canvasId: target.canvasId,
          expansion: "metadata-only",
        });
      }
    }
  }

  // Upstream context relations BFS within current canvas.
  // web-search only uses explicit selection as query hints; do not pull hidden related bodies.
  const queue = operation === "web-search" ? [] : [...activeContextNodeIds];
  const visited = new Set(activeContextNodeIds);
  const relations = Object.values(document.relations).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  while (queue.length) {
    const id = queue.shift()!;
    const incoming = relations
      .filter(
        (r) =>
          r.kind === "context" &&
          r.targetNodeId === id &&
          r.status === "accepted",
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const rel of incoming) {
      const src = document.nodes[rel.sourceNodeId];
      if (!src) continue;
      if (src.parentCanvasId !== currentCanvasId) continue;
      if (excluded.has(src.id)) continue;
      if (visited.has(src.id)) {
        warnings.push({
          kind: "loop",
          message: `context relation loop at ${src.id}`,
          relationId: rel.id,
        });
        continue;
      }
      visited.add(src.id);
      pushUnique(activeContextNodeIds, src.id);
      queue.push(src.id);
    }
  }

  // Candidates
  for (const id of runtime.contextSelection.candidateSeedNodeIds) {
    const n = document.nodes[id];
    if (
      n &&
      n.parentCanvasId === currentCanvasId &&
      !excluded.has(id) &&
      !activeContextNodeIds.includes(id)
    ) {
      pushUnique(candidateContextNodeIds, id);
    }
  }
  if (runtime.focus?.target?.kind === "nodes") {
    for (const id of runtime.focus.target.nodeIds) {
      const n = document.nodes[id];
      if (
        n &&
        n.parentCanvasId === currentCanvasId &&
        !excluded.has(id) &&
        !activeContextNodeIds.includes(id)
      ) {
        pushUnique(candidateContextNodeIds, id);
      }
    }
  }
  if (selection.activeNodeId) {
    const id = selection.activeNodeId;
    if (!activeContextNodeIds.includes(id) && !excluded.has(id)) {
      const n = document.nodes[id];
      if (n && n.parentCanvasId === currentCanvasId)
        pushUnique(candidateContextNodeIds, id);
    }
  }

  // Mutation target
  let mutationTarget = runtime.contextSelection.explicitMutationTarget;
  if (!mutationTarget && mode === "dialogue" && selection.activeNodeId) {
    const n = document.nodes[selection.activeNodeId];
    if (n && n.parentCanvasId === currentCanvasId && !excluded.has(n.id)) {
      mutationTarget = { kind: "nodes", nodeIds: [n.id] };
    }
  }
  if (mutationTarget?.kind === "nodes") {
    const kept = mutationTarget.nodeIds.filter((id) => !excluded.has(id));
    if (kept.length === 0) {
      warnings.push({
        kind: "mutation-excluded",
        message: "mutation target excluded",
      });
      mutationTarget = undefined;
    } else if (kept.length !== mutationTarget.nodeIds.length) {
      mutationTarget = { kind: "nodes", nodeIds: kept };
    }
  }

  const relationTargetNodeIds =
    runtime.contextSelection.explicitRelationTargetNodeIds.filter(
      (id) => document.nodes[id] && !excluded.has(id),
    );

  const bodyAllowlistNodeIds =
    operation === "web-search"
      ? activeContextNodeIds.filter((id) => {
          const node = document.nodes[id];
          return !!node && isTextBearing(node);
        })
      : [...activeContextNodeIds];
  if (
    mutationTarget?.kind === "nodes" &&
    (operation === "mutate-text" || operation === "read")
  ) {
    for (const id of mutationTarget.nodeIds)
      pushUnique(bodyAllowlistNodeIds, id);
  }

  const payloadItems: ContextPayloadDescriptor[] = [];
  const relationHints: RelationContextHint[] = relations
    .filter((rel) => rel.status === "accepted")
    .filter(
      (rel) =>
        activeContextNodeIds.includes(rel.sourceNodeId) ||
        activeContextNodeIds.includes(rel.targetNodeId),
    )
    .map((rel) => ({
      relationId: rel.id,
      sourceNodeId: rel.sourceNodeId,
      targetNodeId: rel.targetNodeId,
      kind: rel.kind,
      reason: rel.reason,
      provenance: document.nodes[rel.targetNodeId]?.provenance,
    }));
  const spatialHints: SpatialContextHint[] = activeContextNodeIds
    .map((nodeId) => document.nodes[nodeId])
    .filter(
      (node): node is NonNullable<typeof node> =>
        Boolean(node) && node.parentCanvasId === currentCanvasId,
    )
    .map((node) => ({
      nodeId: node.id,
      canvasId: currentCanvasId,
      position: { ...node.position },
      selected: selection.selectedNodeIds.includes(node.id),
    }));
  const destination: "llm" | "image-provider" =
    operation === "generate-image" ? "image-provider" : "llm";

  // Vision allowlist: in Dialogue mode, explicitly selected (and not excluded)
  // images are sent as pixel (`image-binary`) to the LLM, up to VISION_CAP.
  // The 4th+ selected image degrades to metadata-only with a `vision-cap`
  // warning. Images pulled in via context relations (not explicitly selected)
  // stay metadata-only, matching F1 REQ-09.
  const selectedImageIds = bodyAllowlistNodeIds.filter((id) => {
    const node = document.nodes[id];
    return (
      !!node && node.kind === "image" && selection.selectedNodeIds.includes(id)
    );
  });
  let visionBinaryCount = 0;
  const visionBinaryIds = new Set<string>();
  for (const id of selectedImageIds) {
    if (visionBinaryCount < VISION_CAP) {
      visionBinaryIds.add(id);
      visionBinaryCount++;
    } else {
      warnings.push({
        kind: "vision-cap",
        message: `vision cap reached; image ${id} sent as metadata only`,
        nodeId: id,
      });
    }
  }

  for (const id of bodyAllowlistNodeIds) {
    const node = document.nodes[id];
    if (!node) continue;
    if (isTextBearing(node)) {
      payloadItems.push({ kind: "text", nodeId: id, destination: "llm" });
    } else if (node.kind === "image") {
      if (mode === "dialogue") {
        if (visionBinaryIds.has(id)) {
          payloadItems.push({
            kind: "image-binary",
            nodeId: id,
            destination: "llm",
          });
        } else {
          payloadItems.push({
            kind: "image-metadata",
            nodeId: id,
            destination: "llm",
          });
        }
      } else if (operation === "generate-text") {
        payloadItems.push({
          kind: "image-binary",
          nodeId: id,
          destination: "llm",
        });
      } else if (operation === "generate-image") {
        payloadItems.push({
          kind: "image-binary",
          nodeId: id,
          destination: "image-provider",
        });
      } else if (
        (operation === "relate" || operation === "group") &&
        visionBinaryIds.has(id)
      ) {
        payloadItems.push({
          kind: "image-binary",
          nodeId: id,
          destination: "llm",
        });
      } else {
        payloadItems.push({ kind: "image-metadata", nodeId: id, destination });
      }
    }
  }

  for (const t of activeCanvasTargets) {
    payloadItems.push({
      kind: "canvas-metadata",
      canvasId: t.canvasId,
      destination: "llm",
    });
  }

  for (const relationId of runtime.contextSelection.includedRemoteRelationIds) {
    const rel = document.relations[relationId];
    if (!rel) continue;
    payloadItems.push({
      kind: "remote-relation-metadata",
      relationId,
      destination: "llm",
    });
  }

  // viewHints: only the active Generated View on the current canvas, and only
  // clusters whose members intersect the request's active context nodes.
  const viewHints: ViewContextHint[] = [];
  const view = input.generatedView ?? null;
  if (view && view.canvasId === currentCanvasId) {
    const activeSet = new Set(activeContextNodeIds);
    const relevant = view.clusters
      .filter((cluster) => cluster.nodeIds.some((id) => activeSet.has(id)))
      .map((cluster) => ({
        clusterId: cluster.id,
        label: cluster.label,
        memberNodeIds: cluster.nodeIds.filter((id) => activeSet.has(id)),
      }));
    if (relevant.length > 0) {
      viewHints.push({
        viewId: view.id,
        kind: "cluster",
        label: view.label,
        clusters: relevant,
      });
    }
  }

  const digestSource = JSON.stringify({
    activeContextNodeIds,
    activeCanvasTargets,
    mutationTarget,
    relationTargetNodeIds,
    bodyAllowlistNodeIds,
    payloadItems,
    relationHints,
    spatialHints,
    viewHints,
    excluded: [...excluded].sort(),
  });

  return {
    workspaceId: document.workspaceId,
    canvasId: currentCanvasId,
    runtimeGeneration: runtime.runtimeGeneration,
    scopeEpoch: runtime.scopeEpoch,
    commandSequenceAtResolve: runtime.commandSequence,
    focus: runtime.focus ?? undefined,
    activeContextNodeIds,
    activeCanvasTargets,
    candidateContextNodeIds,
    delegatedSessionRefs: runtime.contextSelection.delegatedSessions,
    projectedContextRefs: runtime.contextSelection.projectedContexts,
    mutationTarget,
    relationTargetNodeIds,
    bodyAllowlistNodeIds,
    payloadItems,
    relationHints,
    spatialHints,
    viewHints,
    excludedNodeIds: [...excluded],
    warnings,
    contextDigest: stableHash(digestSource),
  };
}

export function projectBoundary(
  document: WorkspaceDocument,
  currentCanvasId: CanvasId,
  endpointCanvasId: CanvasId,
):
  | { kind: "local-node" }
  | { kind: "down-folder"; folderNodeId: NodeId }
  | { kind: "up-boundary"; remoteCanvasId: CanvasId }
  | { kind: "hidden" } {
  if (endpointCanvasId === currentCanvasId) return { kind: "local-node" };
  const pathCurrent = canvasPath(document, currentCanvasId);
  const pathEnd = canvasPath(document, endpointCanvasId);
  // descendant?
  if (pathEnd.includes(currentCanvasId)) {
    const idx = pathEnd.indexOf(currentCanvasId);
    const firstChild = pathEnd[idx + 1];
    const folderNodeId = document.canvases[firstChild]?.folderNodeId;
    if (folderNodeId) return { kind: "down-folder", folderNodeId };
  }
  // ancestor / sibling / other branch
  if (pathCurrent.includes(endpointCanvasId) || pathCurrent[0] === pathEnd[0]) {
    return { kind: "up-boundary", remoteCanvasId: endpointCanvasId };
  }
  return { kind: "up-boundary", remoteCanvasId: endpointCanvasId };
}
