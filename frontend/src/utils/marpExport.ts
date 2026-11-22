import type {
  CanvasEdge,
  CanvasNode,
  ImageNodeData,
  TextNodeData,
} from "../types/canvas";
import {
  resolveContextNodeOrder,
  type OrderedContextNodesResult,
} from "./graphContext";

const MARP_FRONTMATTER = ["---", "marp: true", "paginate: true", "---"].join(
  "\n",
);

/**
 * Collects nodes for Marp slide export using [D-016] ordering rules
 * (single selection: upstream traversal; multiple selection: topological sort).
 */
export function collectMarpSlideNodes(
  nodes: ReadonlyArray<CanvasNode>,
  edges: ReadonlyArray<CanvasEdge>,
  selectedNodeIds: ReadonlyArray<string>,
): OrderedContextNodesResult {
  return resolveContextNodeOrder(nodes, edges, selectedNodeIds);
}

/**
 * Converts ordered canvas nodes and resolved file URLs into Marp Markdown.
 */
export function buildMarpMarkdown(
  nodes: ReadonlyArray<CanvasNode>,
  imageUrlMap: Readonly<Record<string, string>>,
): string {
  if (nodes.length === 0) {
    return MARP_FRONTMATTER;
  }

  const slides = nodes.map((node) => {
    if (node.type === "customNode") {
      const data = node.data as TextNodeData;
      return data.content || data.summary || "";
    }

    const data = node.data as ImageNodeData;
    const src = data.src ?? "";
    const fileUrl = src ? imageUrlMap[src] : undefined;
    if (fileUrl) {
      return `![bg contain](${fileUrl})`;
    }
    return `<!-- image missing: ${src} -->`;
  });

  return `${MARP_FRONTMATTER}\n\n${slides.join("\n\n---\n\n")}`;
}
