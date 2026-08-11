import { MarkerType } from "@xyflow/react";
import { projectBoundary } from "./contextResolver";
import {
  CanvasRecord,
  WorkspaceDocument,
  WorkspaceNode,
  WorkspaceRuntime,
  WorkspaceState,
  isFolder,
  isTextBearing,
  nodesOnCanvas,
} from "./workspace";
import { AppEdge, AppNode, ArtifactNodeData, ImageNodeData, TextNodeData } from "../types";

export interface BoundaryAggregate {
  key: string;
  kind: "down-folder" | "up-boundary";
  anchorId: string;
  relationKind: string;
  direction: "incoming" | "outgoing";
  remoteCanvasId: string;
  relationIds: string[];
  count: number;
}

export function domainNodeToFlow(node: WorkspaceNode, selected: boolean): AppNode {
  if (isTextBearing(node)) {
    if (node.role === "artifact") {
      const data: ArtifactNodeData = {
        filename: node.filename || "untitled.md",
        language: node.language,
        content: node.content,
        summary: node.summary,
        revision: node.revision,
        charCount: node.charCount,
        wordCount: node.wordCount,
        lastEditSummary: node.lastEditSummary,
        lastEditedAt: node.lastEditedAt,
        originalPrompt: node.originalPrompt,
        domainKind: "text",
        domainRole: "artifact",
      };
      return {
        id: node.id,
        type: "artifactNode",
        position: node.position,
        width: node.width,
        height: node.height,
        selected,
        data,
      };
    }
    const data: TextNodeData = {
      content: node.content,
      summary: node.summary,
      originalPrompt: node.originalPrompt,
      revision: node.revision,
      charCount: node.charCount,
      wordCount: node.wordCount,
      filename: node.filename,
      domainKind: "text",
      domainRole: "text",
    };
    return {
      id: node.id,
      type: "customNode",
      position: node.position,
      width: node.width,
      height: node.height,
      selected,
      data,
    };
  }
  if (isFolder(node)) {
    return {
      id: node.id,
      type: "folderNode",
      position: node.position,
      width: node.width ?? 220,
      height: node.height ?? 120,
      selected,
      data: {
        label: node.label,
        childCanvasId: node.childCanvasId,
        domainKind: "folder",
      },
    } as AppNode;
  }
  const data: ImageNodeData = {
    src: node.src,
    alt: node.alt,
    prompt: node.prompt,
    provider: node.provider,
    model: node.model,
    domainKind: "image",
  };
  return {
    id: node.id,
    type: "imageNode",
    position: node.position,
    width: node.width,
    height: node.height,
    selected,
    data,
  };
}

export function projectCurrentCanvas(state: WorkspaceState): {
  nodes: AppNode[];
  edges: AppEdge[];
  boundaryAggregates: BoundaryAggregate[];
} {
  const { document, runtime } = state;
  const current = runtime.currentCanvasId;
  const selected = new Set(runtime.selection.selectedNodeIds);
  const localNodes = nodesOnCanvas(document, current);
  const nodes = localNodes.map((n) => domainNodeToFlow(n, selected.has(n.id)));

  const edges: AppEdge[] = [];
  const boundaryMap = new Map<string, BoundaryAggregate>();

  for (const rel of Object.values(document.relations)) {
    const src = document.nodes[rel.sourceNodeId];
    const tgt = document.nodes[rel.targetNodeId];
    if (!src || !tgt) continue;
    const srcLocal = src.parentCanvasId === current;
    const tgtLocal = tgt.parentCanvasId === current;
    if (srcLocal && tgtLocal) {
      edges.push({
        id: rel.id,
        source: rel.sourceNodeId,
        target: rel.targetNodeId,
        sourceHandle: rel.presentation?.sourceHandle || "right-source",
        targetHandle: rel.presentation?.targetHandle || "left-target",
        type: "default",
        markerEnd: { type: MarkerType.ArrowClosed },
      });
      continue;
    }
    // cross-canvas
    if (!srcLocal && !tgtLocal) {
      const a = projectBoundary(document, current, src.parentCanvasId);
      const b = projectBoundary(document, current, tgt.parentCanvasId);
      if (a.kind === b.kind && JSON.stringify(a) === JSON.stringify(b)) {
        continue; // collapsed internal
      }
    }
    const add = (
      localNodeId: string,
      remoteCanvasId: string,
      direction: "incoming" | "outgoing",
    ) => {
      const bound = projectBoundary(document, current, remoteCanvasId);
      if (bound.kind === "local-node" || bound.kind === "hidden") return;
      const anchorId =
        bound.kind === "down-folder" ? bound.folderNodeId : "up-boundary";
      const key = `${bound.kind}|${anchorId}|${rel.kind}|${direction}|${remoteCanvasId}`;
      const existing = boundaryMap.get(key);
      if (existing) {
        if (!existing.relationIds.includes(rel.id)) {
          existing.relationIds.push(rel.id);
          existing.count += 1;
        }
      } else {
        boundaryMap.set(key, {
          key,
          kind: bound.kind,
          anchorId,
          relationKind: rel.kind,
          direction,
          remoteCanvasId,
          relationIds: [rel.id],
          count: 1,
        });
      }
      void localNodeId;
    };
    if (srcLocal && !tgtLocal) add(src.id, tgt.parentCanvasId, "outgoing");
    if (tgtLocal && !srcLocal) add(tgt.id, src.parentCanvasId, "incoming");
  }

  return {
    nodes,
    edges,
    boundaryAggregates: [...boundaryMap.values()].sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
  };
}

export function breadcrumbPath(
  document: WorkspaceDocument,
  runtime: WorkspaceRuntime,
): Array<{ canvasId: string; name: string }> {
  const path: Array<{ canvasId: string; name: string }> = [];
let cur: string | undefined = runtime.currentCanvasId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const canvas: CanvasRecord | undefined = document.canvases[cur as string];
    if (!canvas) break;
    path.unshift({ canvasId: canvas.id, name: canvas.name });
    cur = canvas.parentCanvasId;
  }
  return path;
}
