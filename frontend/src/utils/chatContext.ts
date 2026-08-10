import { AppNode, ArtifactNodeData, ImageNodeData, TextNodeData } from "../types";
import { ChatMessage, ChatRequest, ChatTarget } from "../types/chat";
import { traverseContextBackwards } from "./graphUtils";

const firstLine = (text: string) => text.split(/\r?\n/, 1)[0].trim();

export function describeChatTarget(node: AppNode | undefined): ChatTarget | null {
  if (!node) return null;
  if (node.type === "artifactNode") {
    const data = node.data as ArtifactNodeData;
    return { nodeId: node.id, type: "artifact", label: data.filename || "chapter.md", context: data.content, revision: data.revision };
  }
  if (node.type === "customNode") {
    const data = node.data as TextNodeData;
    return { nodeId: node.id, type: "text", label: firstLine(data.content) || "Text node", context: data.content, revision: data.revision ?? 0 };
  }
  if (node.type === "imageNode") {
    const data = node.data as ImageNodeData;
    const prompt = data.prompt || data.alt || "";
    return { nodeId: node.id, type: "image", label: firstLine(prompt) || "Image node", context: prompt };
  }
  return null;
}

export function buildChatRequestContext(
  target: ChatTarget | null,
  messages: ChatMessage[],
): string {
  const sections: string[] = [];
  if (target) {
    sections.push([
      "Selected Canvas node:",
      `Type: ${target.type}`,
      `Label: ${target.label}`,
      "Content:",
      target.context || "(empty)",
    ].join("\n"));
  }

  const history = messages
    .filter((message) => message.content.trim() && message.status !== "streaming")
    .slice(-12)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`);
  if (history.length > 0) {
    sections.push(`Recent conversation:\n${history.join("\n\n")}`);
  }
  return sections.join("\n\n");
}

export function buildChatRequest(
  canvasId: string,
  runId: string,
  sessionId: string,
  prompt: string,
  target: ChatTarget | null,
  nodes: AppNode[],
  edges: { source: string; target: string }[],
): ChatRequest {
  const traversal = target ? traverseContextBackwards(target.nodeId, nodes, edges as any) : { nodes: [] };
  const directNodes = traversal.nodes.filter((node, index, all) => all.findIndex((candidate) => candidate.id === node.id) === index);
  return {
    runId,
    sessionId,
    canvasId,
    prompt,
    targetNodeId: target?.nodeId,
    directContextNodeIds: directNodes.map((node) => node.id),
    contextWarning: traversal.warning,
    snapshot: {
      canvasId,
      nodes: nodes.map((node) => {
        if (node.type === "artifactNode") {
          const data = node.data as ArtifactNodeData;
          return { id: node.id, type: "artifact", revision: data.revision, filename: data.filename, markdown: data.content };
        }
        if (node.type === "customNode") {
          const data = node.data as TextNodeData;
          return { id: node.id, type: "text", revision: data.revision ?? 0, markdown: data.content };
        }
        const data = node.data as ImageNodeData;
        return { id: node.id, type: "image", revision: 0, imageRef: data.src, prompt: data.prompt || data.alt || "" };
      }),
      edges: edges.map((edge) => ({ source: edge.source, target: edge.target })),
    },
  };
}
