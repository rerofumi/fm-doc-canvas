import { AppNode, ArtifactNodeData, ImageNodeData, TextNodeData } from "../types";
import { ChatMessage, ChatTarget } from "../types/chat";

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
