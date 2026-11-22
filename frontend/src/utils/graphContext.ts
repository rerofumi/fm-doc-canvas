import type {
  CanvasEdge,
  CanvasNode,
  ImageNodeData,
  TextNodeData,
} from "../types/canvas";

export interface TextContextItem {
  nodeId: string;
  text: string;
}

export interface ImageContextItem {
  nodeId: string;
  src: string;
}

export interface CanvasContextResult {
  textItems: TextContextItem[];
  imageSrcs: ImageContextItem[];
  warnings: string[];
}

export interface OrderedContextNodesResult {
  orderedNodes: CanvasNode[];
  warnings: string[];
}

export const BRANCH_MERGE_WARNING =
  "上流の分岐を検出したため、手前までをコンテキストとして使用します";
export const UPSTREAM_CYCLE_WARNING =
  "循環を検出したため上流追跡を停止しました";
export const SELECTION_CYCLE_WARNING =
  "選択ノード間に循環を検出したため、一部を配置順で補完しました";

/**
 * Checks whether adding a directed edge `sourceId -> targetId` would create a cycle.
 */
export function wouldCreateCycle(
  edges: ReadonlyArray<Pick<CanvasEdge, "source" | "target">>,
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) {
    return true;
  }

  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    let next = adj.get(edge.source);
    if (!next) {
      next = [];
      adj.set(edge.source, next);
    }
    next.push(edge.target);
  }

  const visited = new Set<string>();
  const queue: string[] = [targetId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  return false;
}

function compareNodesDeterministic(
  a: CanvasNode,
  b: CanvasNode,
  selectionOrder: ReadonlyMap<string, number>,
): number {
  const dx = a.position.x - b.position.x;
  if (dx !== 0) {
    return dx;
  }
  const dy = a.position.y - b.position.y;
  if (dy !== 0) {
    return dy;
  }
  return (selectionOrder.get(a.id) ?? 0) - (selectionOrder.get(b.id) ?? 0);
}

function addWarning(warnings: string[], message: string): void {
  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}

/**
 * Resolves ordered context nodes for 0, 1 (upstream traversal), or >=2 (Kahn topological sort)
 * selected nodes. Shared by context collection and Marp export.
 */
export function resolveContextNodeOrder(
  nodes: ReadonlyArray<CanvasNode>,
  edges: ReadonlyArray<CanvasEdge>,
  selectedNodeIds: ReadonlyArray<string>,
): OrderedContextNodesResult {
  if (selectedNodeIds.length === 0) {
    return { orderedNodes: [], warnings: [] };
  }

  const nodeMap = new Map<string, CanvasNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const uniqueSelectedIds: string[] = [];
  const selectionOrder = new Map<string, number>();
  for (const id of selectedNodeIds) {
    if (nodeMap.has(id) && !selectionOrder.has(id)) {
      selectionOrder.set(id, uniqueSelectedIds.length);
      uniqueSelectedIds.push(id);
    }
  }

  if (uniqueSelectedIds.length === 0) {
    return { orderedNodes: [], warnings: [] };
  }

  const warnings: string[] = [];

  if (uniqueSelectedIds.length === 1) {
    const startId = uniqueSelectedIds[0];
    const startNode = nodeMap.get(startId)!;
    const chainReversed: CanvasNode[] = [startNode];
    const visited = new Set<string>([startId]);

    let currentId = startId;
    while (true) {
      const incoming = edges.filter(
        (edge) => edge.target === currentId && nodeMap.has(edge.source),
      );
      if (incoming.length === 0) {
        break;
      }
      if (incoming.length >= 2) {
        addWarning(warnings, BRANCH_MERGE_WARNING);
        break;
      }

      const parentId = incoming[0].source;
      if (visited.has(parentId)) {
        addWarning(warnings, UPSTREAM_CYCLE_WARNING);
        break;
      }

      const parentNode = nodeMap.get(parentId)!;
      visited.add(parentId);
      chainReversed.push(parentNode);
      currentId = parentId;
    }

    return {
      orderedNodes: chainReversed.reverse(),
      warnings,
    };
  }

  // 2 or more selected nodes: Kahn's topological sort on the induced subgraph.
  const selectedSet = new Set(uniqueSelectedIds);
  const adj = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const id of uniqueSelectedIds) {
    adj.set(id, new Set<string>());
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (!selectedSet.has(edge.source) || !selectedSet.has(edge.target)) {
      continue;
    }
    if (edge.source === edge.target) {
      addWarning(warnings, SELECTION_CYCLE_WARNING);
      continue;
    }
    const targets = adj.get(edge.source)!;
    if (!targets.has(edge.target)) {
      targets.add(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  const ready: CanvasNode[] = [];
  for (const id of uniqueSelectedIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      ready.push(nodeMap.get(id)!);
    }
  }
  ready.sort((a, b) => compareNodesDeterministic(a, b, selectionOrder));

  const orderedNodes: CanvasNode[] = [];
  const processed = new Set<string>();

  while (ready.length > 0) {
    const current = ready.shift()!;
    orderedNodes.push(current);
    processed.add(current.id);

    const targets = adj.get(current.id);
    if (targets) {
      for (const targetId of targets) {
        const nextDeg = (inDegree.get(targetId) ?? 0) - 1;
        inDegree.set(targetId, nextDeg);
        if (nextDeg === 0) {
          ready.push(nodeMap.get(targetId)!);
        }
      }
      ready.sort((a, b) => compareNodesDeterministic(a, b, selectionOrder));
    }
  }

  if (orderedNodes.length < uniqueSelectedIds.length) {
    addWarning(warnings, SELECTION_CYCLE_WARNING);
    const remaining = uniqueSelectedIds
      .filter((id) => !processed.has(id))
      .map((id) => nodeMap.get(id)!)
      .sort((a, b) => compareNodesDeterministic(a, b, selectionOrder));
    orderedNodes.push(...remaining);
  }

  return { orderedNodes, warnings };
}

/**
 * Collects upstream/selected text and image context items in deterministic order.
 */
export function collectCanvasContext(
  nodes: ReadonlyArray<CanvasNode>,
  edges: ReadonlyArray<CanvasEdge>,
  selectedNodeIds: ReadonlyArray<string>,
): CanvasContextResult {
  const { orderedNodes, warnings } = resolveContextNodeOrder(
    nodes,
    edges,
    selectedNodeIds,
  );

  const textItems: TextContextItem[] = [];
  const imageSrcs: ImageContextItem[] = [];

  for (const node of orderedNodes) {
    if (node.type === "customNode") {
      const data = node.data as TextNodeData;
      const text = data.content || data.summary || "";
      textItems.push({ nodeId: node.id, text });
    } else if (node.type === "imageNode") {
      const data = node.data as ImageNodeData;
      imageSrcs.push({ nodeId: node.id, src: data.src ?? "" });
    }
  }

  return { textItems, imageSrcs, warnings };
}
