import { AppNode, AppEdge } from "../types";

export interface TraversalResult {
  nodes: AppNode[];
  warning?: { kind: "branch" | "loop" };
}

/** Traverses backwards; warning is semantic and translated at the UI boundary. */
export function traverseContextBackwards(
  targetNodeId: string,
  allNodes: AppNode[],
  allEdges: AppEdge[],
): TraversalResult {
  const visitedNodeIds = new Set<string>();
  const resultNodes: AppNode[] = [];
  let currentNodeId: string | null = targetNodeId;
  let warning: { kind: "branch" | "loop" } | undefined;

  const targetNode = allNodes.find((node) => node.id === targetNodeId);
  if (!targetNode) return { nodes: [] };
  resultNodes.push(targetNode);

  while (currentNodeId !== null) {
    if (visitedNodeIds.has(currentNodeId)) {
      warning = { kind: "loop" };
      break;
    }
    visitedNodeIds.add(currentNodeId);
    const incomingEdges = allEdges.filter((edge) => edge.target === currentNodeId);
    if (incomingEdges.length > 1) {
      warning = { kind: "branch" };
      break;
    }
    if (incomingEdges.length === 0) break;

    const sourceNodeId = incomingEdges[0].source;
    if (visitedNodeIds.has(sourceNodeId)) {
      warning = { kind: "loop" };
      break;
    }
    currentNodeId = sourceNodeId;
    const sourceNode = allNodes.find((node) => node.id === sourceNodeId);
    if (sourceNode) resultNodes.unshift(sourceNode);
  }
  return { nodes: resultNodes, warning };
}
