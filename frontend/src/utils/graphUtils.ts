import { AppNode, AppEdge } from "../types";

export interface TraversalResult {
  nodes: AppNode[];
  warning?: {
    kind: "branch" | "loop";
    message: string;
  };
}

/**
 * Traverses the graph backwards from a target node to collect context nodes.
 * 
 * @param targetNodeId - The ID of the target node to start traversal from
 * @param allNodes - Array of all nodes in the graph
 * @param allEdges - Array of all edges in the graph
 * @returns TraversalResult containing the ordered list of nodes and any warnings
 */
export function traverseContextBackwards(
  targetNodeId: string,
  allNodes: AppNode[],
  allEdges: AppEdge[]
): TraversalResult {
  const visitedNodeIds = new Set<string>();
  const resultNodes: AppNode[] = [];
  let currentNodeId: string | null = targetNodeId;
  let warning: { kind: "branch" | "loop"; message: string } | undefined;

  // Add the target node to the result
  const targetNode = allNodes.find(node => node.id === targetNodeId);
  if (targetNode) {
    resultNodes.push(targetNode);
  } else {
    // If target node doesn't exist, return empty result
    return { nodes: [] };
  }

  // Traverse backwards through the graph
  while (currentNodeId !== null) {
    // Check for loops
    if (visitedNodeIds.has(currentNodeId)) {
      warning = {
        kind: "loop",
        message: "リンク構造にエラーがあります"
      };
      break;
    }
    
    visitedNodeIds.add(currentNodeId);
    
    // Find incoming edges to the current node
    const incomingEdges = allEdges.filter(edge => edge.target === currentNodeId);
    
    // Check for branching (multiple incoming edges)
    if (incomingEdges.length > 1) {
      warning = {
        kind: "branch",
        message: "リンク構造にエラーがあります"
      };
      break;
    }
    
    // If no incoming edges, we've reached the end of the traversal
    if (incomingEdges.length === 0) {
      break;
    }
    
    // Move to the source node of the incoming edge
    const sourceNodeId = incomingEdges[0].source;
    currentNodeId = sourceNodeId;
    
    // Add the source node to the beginning of the result (since we're traversing backwards)
    const sourceNode = allNodes.find(node => node.id === sourceNodeId);
    if (sourceNode) {
      resultNodes.unshift(sourceNode);
    }
  }
  
  return {
    nodes: resultNodes,
    warning
  };
}
