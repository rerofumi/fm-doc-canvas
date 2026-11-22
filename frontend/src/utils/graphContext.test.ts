import { describe, expect, it } from "vitest";
import type { CanvasEdge, CanvasNode } from "../types/canvas";
import {
  BRANCH_MERGE_WARNING,
  SELECTION_CYCLE_WARNING,
  UPSTREAM_CYCLE_WARNING,
  collectCanvasContext,
  wouldCreateCycle,
} from "./graphContext";

function makeTextNode(
  id: string,
  content: string,
  x = 0,
  y = 0,
  summary = "",
): CanvasNode {
  return {
    id,
    type: "customNode",
    position: { x, y },
    data: { content, summary },
  };
}

function makeImageNode(id: string, src: string, x = 0, y = 0): CanvasNode {
  return {
    id,
    type: "imageNode",
    position: { x, y },
    data: { src },
  };
}

function makeEdge(id: string, source: string, target: string): CanvasEdge {
  return {
    id,
    source,
    target,
    sourceHandle: "right",
    targetHandle: "left",
  };
}

describe("wouldCreateCycle", () => {
  it("detects self-loop (A -> A)", () => {
    expect(wouldCreateCycle([], "A", "A")).toBe(true);
  });

  it("detects direct loop (A -> B -> A)", () => {
    const edges = [makeEdge("e1", "A", "B")];
    expect(wouldCreateCycle(edges, "B", "A")).toBe(true);
  });

  it("detects indirect loop (A -> B -> C -> A)", () => {
    const edges = [makeEdge("e1", "A", "B"), makeEdge("e2", "B", "C")];
    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
  });

  it("allows valid DAG connections including diamond shapes", () => {
    const edges = [
      makeEdge("e1", "A", "B"),
      makeEdge("e2", "A", "C"),
      makeEdge("e3", "B", "D"),
    ];
    expect(wouldCreateCycle(edges, "C", "D")).toBe(false);
    expect(wouldCreateCycle(edges, "A", "D")).toBe(false);
  });

  it("handles pre-existing cycles without infinite recursion", () => {
    const edges = [makeEdge("e1", "A", "B"), makeEdge("e2", "B", "A")];
    expect(wouldCreateCycle(edges, "C", "D")).toBe(false);
  });
});

describe("collectCanvasContext", () => {
  it("returns empty context when 0 nodes are selected", () => {
    const nodes = [makeTextNode("A", "hello")];
    expect(collectCanvasContext(nodes, [], [])).toEqual({
      textItems: [],
      imageSrcs: [],
      warnings: [],
    });
  });

  it("traverses single selection upstream from origin to selected node and separates text/image", () => {
    const nodes = [
      makeTextNode("A", "root text", 0, 0),
      makeImageNode("B", "img_1.png", 300, 0),
      makeTextNode("C", "", 600, 0, "summary fallback"),
    ];
    const edges = [makeEdge("e1", "A", "B"), makeEdge("e2", "B", "C")];

    const result = collectCanvasContext(nodes, edges, ["C"]);
    expect(result).toEqual({
      textItems: [
        { nodeId: "A", text: "root text" },
        { nodeId: "C", text: "summary fallback" },
      ],
      imageSrcs: [{ nodeId: "B", src: "img_1.png" }],
      warnings: [],
    });
  });

  it("stops upstream traversal at branch merge and emits warning", () => {
    const nodes = [
      makeTextNode("A", "branch 1"),
      makeTextNode("B", "branch 2"),
      makeTextNode("C", "merged"),
      makeTextNode("D", "selected"),
    ];
    const edges = [
      makeEdge("e1", "A", "C"),
      makeEdge("e2", "B", "C"),
      makeEdge("e3", "C", "D"),
    ];

    const result = collectCanvasContext(nodes, edges, ["D"]);
    expect(result.textItems).toEqual([
      { nodeId: "C", text: "merged" },
      { nodeId: "D", text: "selected" },
    ]);
    expect(result.warnings).toEqual([BRANCH_MERGE_WARNING]);
  });

  it("stops upstream traversal on pre-existing cycle and emits warning", () => {
    const nodes = [makeTextNode("A", "node A"), makeTextNode("B", "node B")];
    const edges = [makeEdge("e1", "A", "B"), makeEdge("e2", "B", "A")];

    const result = collectCanvasContext(nodes, edges, ["B"]);
    expect(result.textItems).toEqual([
      { nodeId: "A", text: "node A" },
      { nodeId: "B", text: "node B" },
    ]);
    expect(result.warnings).toEqual([UPSTREAM_CYCLE_WARNING]);
  });

  it("topologically orders multiple selected nodes and separates text/image", () => {
    const nodes = [
      makeTextNode("C", "third", 600, 0),
      makeImageNode("B", "middle.png", 300, 0),
      makeTextNode("A", "first", 0, 0),
      makeTextNode("D", "disconnected", 100, 200),
    ];
    const edges = [makeEdge("e1", "A", "B"), makeEdge("e2", "B", "C")];

    const result = collectCanvasContext(nodes, edges, ["C", "D", "B", "A"]);
    expect(result.textItems.map((item) => item.nodeId)).toEqual(["A", "D", "C"]);
    expect(result.imageSrcs).toEqual([{ nodeId: "B", src: "middle.png" }]);
    expect(result.warnings).toEqual([]);
  });

  it("emits warning and completes remaining nodes when multiple selection contains a cycle", () => {
    const nodes = [
      makeTextNode("A", "a", 0, 0),
      makeTextNode("B", "b", 200, 0),
    ];
    const edges = [makeEdge("e1", "A", "B"), makeEdge("e2", "B", "A")];

    const result = collectCanvasContext(nodes, edges, ["A", "B"]);
    expect(result.textItems.map((item) => item.nodeId)).toEqual(["A", "B"]);
    expect(result.warnings).toEqual([SELECTION_CYCLE_WARNING]);
  });
});
