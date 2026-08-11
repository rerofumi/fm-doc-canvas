import {
  CanvasId,
  WorkspaceDocument,
  WorkspaceNode,
  isFolder,
} from "./workspace";

export function validateDocument(document: WorkspaceDocument): string | null {
  const { workspaceId, rootCanvasId, canvases, nodes, relations } = document;
  if (!workspaceId) return "workspaceId is required";
  if (!rootCanvasId) return "rootCanvasId is required";
  if (!canvases[rootCanvasId]) return "root canvas missing";

  const root = canvases[rootCanvasId];
  if (root.parentCanvasId || root.folderNodeId) {
    return "root canvas must not have parent or folder node";
  }

  for (const canvas of Object.values(canvases)) {
    if (!canvas.id || canvas.id !== Object.keys(canvases).find((k) => canvases[k] === canvas && k === canvas.id) && !canvases[canvas.id]) {
      // id key consistency checked below
    }
    if (canvases[canvas.id] !== canvas) return `canvas key mismatch for ${canvas.id}`;
    if (canvas.id === rootCanvasId) continue;
    if (!canvas.parentCanvasId) return `canvas ${canvas.id} missing parentCanvasId`;
    if (!canvases[canvas.parentCanvasId]) {
      return `canvas ${canvas.id} parent missing`;
    }
    if (!canvas.folderNodeId) return `canvas ${canvas.id} missing folderNodeId`;
    const folder = nodes[canvas.folderNodeId];
    if (!folder || !isFolder(folder)) {
      return `canvas ${canvas.id} folder node missing`;
    }
    if (folder.childCanvasId !== canvas.id) {
      return `folder ${folder.id} childCanvasId mismatch`;
    }
    if (folder.label !== canvas.name) {
      return `folder ${folder.id} label mismatch with canvas name`;
    }
    if (folder.parentCanvasId !== canvas.parentCanvasId) {
      return `folder ${folder.id} parentCanvasId mismatch`;
    }
  }

  // Detect canvas parent cycles and ensure path to root.
  for (const canvas of Object.values(canvases)) {
    const seen = new Set<CanvasId>();
    let cur: CanvasId | undefined = canvas.id;
    while (cur) {
      if (seen.has(cur)) return `canvas parent cycle at ${cur}`;
      seen.add(cur);
      if (cur === rootCanvasId) break;
      cur = canvases[cur]?.parentCanvasId;
      if (!cur && canvas.id !== rootCanvasId) {
        return `canvas ${canvas.id} does not reach root`;
      }
    }
  }

  for (const node of Object.values(nodes)) {
    if (!node.id) return "node id required";
    if (nodes[node.id] !== node) return `node key mismatch for ${node.id}`;
    if (!canvases[node.parentCanvasId]) {
      return `node ${node.id} parent canvas missing`;
    }
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      return `node ${node.id} has non-finite position`;
    }
    if (typeof node.revision !== "number" || node.revision < 0) {
      return `node ${node.id} has invalid revision`;
    }
    if (isFolder(node)) {
      const child = canvases[node.childCanvasId];
      if (!child) return `folder ${node.id} child canvas missing`;
      if (child.folderNodeId !== node.id) {
        return `folder ${node.id} not linked from child canvas`;
      }
    }
  }

  for (const rel of Object.values(relations)) {
    if (!rel.id) return "relation id required";
    if (relations[rel.id] !== rel) return `relation key mismatch for ${rel.id}`;
    if (!nodes[rel.sourceNodeId] || !nodes[rel.targetNodeId]) {
      return `relation ${rel.id} missing endpoint`;
    }
    if (rel.sourceNodeId === rel.targetNodeId) return `relation ${rel.id} self relation`;
    if (!["context", "source", "derived", "supports", "opposes", "similar"].includes(rel.kind)) {
      return `relation ${rel.id} invalid kind`;
    }
    if (rel.status !== "accepted") return `relation ${rel.id} invalid status`;
  }

  return null;
}

export function isDescendantCanvas(
  document: WorkspaceDocument,
  ancestorId: CanvasId,
  maybeDescendantId: CanvasId,
): boolean {
  let cur: CanvasId | undefined = maybeDescendantId;
  const seen = new Set<CanvasId>();
  while (cur) {
    if (cur === ancestorId) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    cur = document.canvases[cur]?.parentCanvasId;
  }
  return false;
}

export function canvasPath(
  document: WorkspaceDocument,
  canvasId: CanvasId,
): CanvasId[] {
  const path: CanvasId[] = [];
  let cur: CanvasId | undefined = canvasId;
  const seen = new Set<CanvasId>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    path.unshift(cur);
    cur = document.canvases[cur]?.parentCanvasId;
  }
  return path;
}

export function lowestCommonAncestor(
  document: WorkspaceDocument,
  a: CanvasId,
  b: CanvasId,
): CanvasId | null {
  const pathA = canvasPath(document, a);
  const pathB = canvasPath(document, b);
  let i = 0;
  while (i < pathA.length && i < pathB.length && pathA[i] === pathB[i]) i += 1;
  return i === 0 ? null : pathA[i - 1];
}

export function nodeCanvasId(
  document: WorkspaceDocument,
  nodeId: string,
): CanvasId | null {
  return document.nodes[nodeId]?.parentCanvasId ?? null;
}

export function collectSubtreeFolderNodeIds(
  document: WorkspaceDocument,
  folderNodeId: string,
): string[] {
  const folder = document.nodes[folderNodeId];
  if (!folder || !isFolder(folder)) return [];
  const result = [folderNodeId];
  const queue = [folder.childCanvasId];
  while (queue.length) {
    const canvasId = queue.shift()!;
    for (const node of Object.values(document.nodes) as WorkspaceNode[]) {
      if (node.parentCanvasId !== canvasId) continue;
      if (isFolder(node)) {
        result.push(node.id);
        queue.push(node.childCanvasId);
      }
    }
  }
  return result;
}
