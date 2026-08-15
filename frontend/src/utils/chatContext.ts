import { resolveContext } from "../domain/contextResolver";
import { boundedDialogueHistory } from "../domain/runScope";
import type { WorkspaceState } from "../domain/workspace";
import type {
  AppNode,
  ArtifactNodeData,
  ImageNodeData,
  TextNodeData,
} from "../types";
import type {
  ChatMessage,
  ChatRequest,
  ChatTarget,
  ImageProvider,
} from "../types/chat";
import { traverseContextBackwards } from "./graphUtils";
import { useAppStore } from "../store/useAppStore";

const firstLine = (text: string) => text.split(/\r?\n/, 1)[0].trim();

export function describeChatTarget(
  node: AppNode | undefined,
): ChatTarget | null {
  if (!node) return null;
  if (node.type === "artifactNode") {
    const data = node.data as ArtifactNodeData;
    return {
      nodeId: node.id,
      type: "artifact",
      label: data.filename || "chapter.md",
      context: data.content,
      revision: data.revision,
    };
  }
  if (node.type === "customNode") {
    const data = node.data as TextNodeData;
    return {
      nodeId: node.id,
      type: "text",
      label: firstLine(data.content) || "Text node",
      context: data.content,
      revision: data.revision ?? 0,
    };
  }
  if (node.type === "imageNode") {
    const data = node.data as ImageNodeData;
    const prompt = data.prompt || data.alt || "";
    return {
      nodeId: node.id,
      type: "image",
      label: firstLine(prompt) || "Image node",
      context: prompt,
    };
  }
  return null;
}

export function buildChatRequestContext(
  target: ChatTarget | null,
  messages: ChatMessage[],
): string {
  const sections: string[] = [];
  if (target) {
    sections.push(
      [
        "Selected Canvas node:",
        `Type: ${target.type}`,
        `Label: ${target.label}`,
        "Content:",
        target.context || "(empty)",
      ].join("\n"),
    );
  }

  const history = boundedDialogueHistory(messages, 12).map(
    (message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`,
  );
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
  workspace?: WorkspaceState,
  messages: ChatMessage[] = [],
  runEpoch = 0,
  imageProvider?: ImageProvider,
): ChatRequest {
  const envelope = workspace
    ? resolveContext({
        document: workspace.document,
        runtime: workspace.runtime,
        mode: "dialogue",
        operation: "read",
        generatedView: useAppStore.getState().activeGeneratedView,
      })
    : null;

  const traversal = target
    ? traverseContextBackwards(target.nodeId, nodes, edges as any)
    : { nodes: [] as AppNode[], warning: undefined as any };
  let directNodes = traversal.nodes.filter(
    (node, index, all) =>
      all.findIndex((candidate) => candidate.id === node.id) === index,
  );

  // Prefer shared resolver allowlist when workspace domain state is available.
  const allow = new Set(envelope?.bodyAllowlistNodeIds ?? []);
  if (envelope) {
    directNodes = directNodes.filter((n) => allow.has(n.id));
    // Ensure active context nodes from resolver are represented in snapshot body set.
    for (const id of envelope.bodyAllowlistNodeIds) {
      if (!directNodes.some((n) => n.id === id)) {
        const n = nodes.find((node) => node.id === id);
        if (n) directNodes.push(n);
      }
    }
  }

  const visionBinaryIds = new Set(
    envelope?.payloadItems
      .filter(
        (
          p,
        ): p is {
          kind: "image-binary";
          nodeId: string;
          destination: "llm" | "image-provider";
        } => p.kind === "image-binary" && p.destination === "llm",
      )
      .map((p) => p.nodeId) ?? [],
  );

  const snapshotNodes = (
    envelope
      ? nodes.filter((n) => allow.has(n.id) || n.id === target?.nodeId)
      : nodes
  ).map((node) => {
    if (node.type === "artifactNode") {
      const data = node.data as ArtifactNodeData;
      return {
        id: node.id,
        type: "artifact" as const,
        revision: data.revision,
        filename: data.filename,
        markdown: data.content,
      };
    }
    if (node.type === "customNode") {
      const data = node.data as TextNodeData;
      return {
        id: node.id,
        type: "text" as const,
        revision: data.revision ?? 0,
        markdown: data.content,
      };
    }
    const data = node.data as ImageNodeData;
    const isVision = visionBinaryIds.has(node.id);
    return {
      id: node.id,
      type: "image" as const,
      revision: 0,
      imageRef: data.src,
      prompt: data.prompt || data.alt || "",
      imageIncluded: isVision,
    };
  });

  return {
    runId,
    sessionId,
    canvasId: workspace?.runtime.currentCanvasId ?? canvasId,
    prompt,
    targetNodeId: target?.nodeId,
    directContextNodeIds: directNodes.map((node) => node.id),
    bodyAllowlistNodeIds: envelope?.bodyAllowlistNodeIds,
    workspaceId: workspace?.document.workspaceId,
    runtimeGeneration: workspace?.runtime.runtimeGeneration,
    scopeEpoch: workspace?.runtime.scopeEpoch,
    runEpoch,
    contextDigest: envelope?.contextDigest,
    imageProvider,
    history: boundedDialogueHistory(messages, 12),
    contextWarning: traversal.warning,
    viewHints: envelope?.viewHints,
    snapshot: {
      canvasId: workspace?.runtime.currentCanvasId ?? canvasId,
      nodes: snapshotNodes,
      edges: edges
        .filter(
          (edge) =>
            !envelope || (allow.has(edge.source) && allow.has(edge.target)),
        )
        .map((edge) => ({ source: edge.source, target: edge.target })),
    },
  };
}
