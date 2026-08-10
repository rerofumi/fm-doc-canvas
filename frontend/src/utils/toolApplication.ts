import { AppNode, ArtifactNodeData, TextNodeData } from "../types";
import { ChatToolProposal } from "../types/chat";
import { createArtifactData, getContentStats } from "./artifact";

export type ToolApplicationStatus = "applied" | "conflict" | "error";

export interface ToolApplicationOutcome {
  nodes: AppNode[];
  status: ToolApplicationStatus;
  error?: string;
  createdNodeId?: string;
}

export function applyToolProposalToNodes(
  nodes: AppNode[],
  proposal: ChatToolProposal,
  createId: () => string,
  now: () => number,
): ToolApplicationOutcome {
  if (proposal.operation === "create") {
    let filename = proposal.filename?.trim() || "artifact.md";
    const used = new Set(nodes.filter((node) => node.type === "artifactNode").map((node) => (node.data as ArtifactNodeData).filename));
    if (used.has(filename)) {
      const dot = filename.lastIndexOf(".");
      const stem = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : ".md";
      let index = 2;
      while (used.has(`${stem}-${index}${ext}`)) index += 1;
      filename = `${stem}-${index}${ext}`;
    }
    const id = createId();
    const artifact = createArtifactData();
    const node: AppNode = {
      id,
      type: "artifactNode",
      position: { x: 120 + nodes.length * 20, y: 120 + nodes.length * 20 },
      data: { ...artifact, filename, content: proposal.proposed, ...getContentStats(proposal.proposed), revision: 0, lastEditSummary: proposal.lastEditSummary, lastEditedAt: now() },
      width: 300,
      height: 220,
    };
    return { nodes: [...nodes, node], status: "applied", createdNodeId: id };
  }

  const nodeID = proposal.targetNodeId || proposal.nodeId;
  const node = nodes.find((item) => item.id === nodeID);
  if (!node || (node.type !== "customNode" && node.type !== "artifactNode")) {
    return { nodes, status: "error", error: "編集対象のノードが見つかりません。" };
  }
  const data = node.data as TextNodeData | ArtifactNodeData;
  const revision = data.revision ?? 0;
  if (proposal.baseRevision !== revision) return { nodes, status: "conflict" };
  const stats = getContentStats(proposal.proposed);
  const nextNodes = nodes.map((item) => {
    if (item.id !== node.id) return item;
    if (node.type === "customNode") {
      return { ...item, data: { ...item.data, content: proposal.proposed, ...stats, revision: revision + 1 } } as AppNode;
    }
    return { ...item, data: { ...item.data, content: proposal.proposed, ...stats, revision: revision + 1, lastEditSummary: proposal.lastEditSummary, lastEditedAt: now() } } as AppNode;
  });
  return { nodes: nextNodes, status: "applied" };
}
