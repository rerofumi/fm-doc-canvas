import { AppNode } from "../types";
import { buildChatRequest, describeChatTarget } from "../utils/chatContext";
import { traverseContextBackwards } from "../utils/graphUtils";
import { applyToolProposalToNodes } from "../utils/toolApplication";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const textNode = (id: string, content: string, revision = 0): AppNode => ({
  id,
  type: "customNode",
  position: { x: 0, y: 0 },
  data: { content, summary: content, revision, charCount: content.length, wordCount: content.trim() ? content.trim().split(/\s+/u).length : 0 },
});
const artifactNode = (id: string, content: string, revision = 0, filename = "chapter.md"): AppNode => ({
  id,
  type: "artifactNode",
  position: { x: 0, y: 0 },
  data: { filename, language: "markdown", content, summary: filename, revision, charCount: content.length, wordCount: content.trim() ? content.trim().split(/\s+/u).length : 0 },
});
const imageNode = (id: string): AppNode => ({
  id,
  type: "imageNode",
  position: { x: 0, y: 0 },
  data: { src: "image.png", prompt: "blue castle" },
});

{
  const nodes = [textNode("upstream", "context"), artifactNode("target", "body")];
  const edges = [{ id: "edge", source: "upstream", target: "target" }];
  const traversal = traverseContextBackwards("target", nodes, edges);
  assert(traversal.nodes.map((node) => node.id).join(",") === "upstream,target", "direct context order is incorrect");
  const request = buildChatRequest("canvas", "run", "session", "prompt", describeChatTarget(nodes[1]), nodes, edges);
  assert(request.directContextNodeIds.join(",") === "upstream,target", "request does not preserve traversal order");
  assert(request.snapshot.nodes[1].markdown === "body", "target Markdown is missing from snapshot");
}

{
  const nodes = [textNode("a", "a"), textNode("b", "b"), artifactNode("target", "body")];
  const edges = [{ id: "a-target", source: "a", target: "target" }, { id: "b-target", source: "b", target: "target" }];
  const request = buildChatRequest("canvas", "run", "session", "prompt", describeChatTarget(nodes[2]), nodes, edges);
  assert(request.contextWarning?.kind === "branch", "branch warning is not retained");
}

{
  const nodes = [textNode("a", "a"), artifactNode("b", "b")];
  const edges = [{ id: "a-b", source: "a", target: "b" }, { id: "b-a", source: "b", target: "a" }];
  const request = buildChatRequest("canvas", "run", "session", "prompt", describeChatTarget(nodes[1]), nodes, edges);
  assert(request.contextWarning?.kind === "loop", "loop warning is not retained");
  assert(new Set(request.directContextNodeIds).size === request.directContextNodeIds.length, "loop context contains duplicate IDs");
}

{
  const nodes = [textNode("text", "old text", 4), artifactNode("artifact", "old artifact", 2), imageNode("image")];
  const textResult = applyToolProposalToNodes(nodes, { toolCallId: "call", nodeId: "text", targetNodeId: "text", baseRevision: 4, operation: "edit", proposed: "new words here" }, () => "created", () => 10);
  const textData = textResult.nodes[0].data as Record<string, unknown>;
  assert(textResult.status === "applied" && textData.revision === 5, "Text revision was not incremented");
  assert(textData.charCount === 14 && textData.wordCount === 3, "Text counts were not recalculated");
  const conflict = applyToolProposalToNodes(textResult.nodes, { toolCallId: "call-2", nodeId: "text", baseRevision: 4, operation: "edit", proposed: "stale" }, () => "created", () => 11);
  assert(conflict.status === "conflict" && conflict.nodes === textResult.nodes, "stale edit was not rejected");

  const artifactResult = applyToolProposalToNodes(nodes, { toolCallId: "call-3", nodeId: "artifact", baseRevision: 2, operation: "replace", proposed: "updated artifact", lastEditSummary: "updated" }, () => "created", () => 12);
  const artifactData = artifactResult.nodes[1].data as Record<string, unknown>;
  assert(artifactResult.status === "applied" && artifactData.revision === 3 && artifactData.lastEditSummary === "updated", "Artifact mutation metadata is incorrect");

  const created = applyToolProposalToNodes(nodes, { toolCallId: "call-4", operation: "create", filename: "chapter.md", proposed: "new artifact" }, () => "created", () => 13);
  assert(created.status === "applied" && created.createdNodeId === "created", "Artifact was not created");
  assert((created.nodes[3].data as Record<string, unknown>).filename === "chapter-2.md", "Artifact filename collision was not resolved");
}

{
  const nodes = [textNode("hidden", "secret body")];
  const request = buildChatRequest("canvas", "run", "session", "prompt", null, nodes, []);
  assert(request.directContextNodeIds.length === 0, "targetless request included direct context");
}

console.log("Sprint C frontend logic tests passed");
