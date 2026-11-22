import dagre from "dagre";
import type { CanvasEdge, CanvasNode } from "../types/canvas";

const DEFAULT_TEXT_WIDTH = 280;
const DEFAULT_TEXT_HEIGHT = 160;
const DEFAULT_IMAGE_WIDTH = 260;
const DEFAULT_IMAGE_HEIGHT = 220;

function getNodeDimensions(node: CanvasNode): { width: number; height: number } {
  const fallbackWidth =
    node.type === "imageNode" ? DEFAULT_IMAGE_WIDTH : DEFAULT_TEXT_WIDTH;
  const fallbackHeight =
    node.type === "imageNode" ? DEFAULT_IMAGE_HEIGHT : DEFAULT_TEXT_HEIGHT;

  return {
    width: node.measured?.width ?? node.width ?? fallbackWidth,
    height: node.measured?.height ?? node.height ?? fallbackHeight,
  };
}

/**
 * Applies Dagre LR (left-to-right) auto-layout to all nodes while preserving edges.
 * Returns an empty array when given zero nodes.
 */
export function applyAutoLayout(
  nodes: ReadonlyArray<CanvasNode>,
  edges: ReadonlyArray<CanvasEdge>,
): CanvasNode[] {
  if (nodes.length === 0) {
    return [];
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100 });

  const nodeIds = new Set<string>();
  const dimensions = new Map<string, { width: number; height: number }>();

  for (const node of nodes) {
    nodeIds.add(node.id);
    const dims = getNodeDimensions(node);
    dimensions.set(node.id, dims);
    g.setNode(node.id, dims);
  }

  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const layoutNode = g.node(node.id);
    const dims = dimensions.get(node.id)!;
    return {
      ...node,
      position: {
        x: layoutNode.x - dims.width / 2,
        y: layoutNode.y - dims.height / 2,
      },
    };
  });
}
