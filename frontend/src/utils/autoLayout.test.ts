import { describe, expect, it } from "vitest";
import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { applyAutoLayout } from "./autoLayout";

function overlaps(a: CanvasNode, b: CanvasNode): boolean {
  const aw = a.measured?.width ?? a.width ?? (a.type === "imageNode" ? 260 : 280);
  const ah = a.measured?.height ?? a.height ?? (a.type === "imageNode" ? 220 : 160);
  const bw = b.measured?.width ?? b.width ?? (b.type === "imageNode" ? 260 : 280);
  const bh = b.measured?.height ?? b.height ?? (b.type === "imageNode" ? 220 : 160);

  return (
    a.position.x < b.position.x + bw &&
    a.position.x + aw > b.position.x &&
    a.position.y < b.position.y + bh &&
    a.position.y + ah > b.position.y
  );
}

describe("applyAutoLayout", () => {
  it("safely returns empty array for 0 nodes", () => {
    expect(applyAutoLayout([], [])).toEqual([]);
  });

  it("lays out connected and disconnected nodes in LR direction without overlap", () => {
    const nodes: CanvasNode[] = [
      {
        id: "n1",
        type: "customNode",
        position: { x: 500, y: 500 },
        data: { content: "A", summary: "" },
      },
      {
        id: "n2",
        type: "imageNode",
        position: { x: 500, y: 500 },
        data: { src: "a.png" },
      },
      {
        id: "n3",
        type: "customNode",
        position: { x: 500, y: 500 },
        data: { content: "C", summary: "" },
        measured: { width: 320, height: 180 },
      },
    ];
    const edges: CanvasEdge[] = [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n1", target: "n3" },
    ];

    const layouted = applyAutoLayout(nodes, edges);
    expect(layouted).toHaveLength(3);
    expect(layouted.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);

    const byId = new Map(layouted.map((n) => [n.id, n]));
    const n1 = byId.get("n1")!;
    const n2 = byId.get("n2")!;
    const n3 = byId.get("n3")!;

    // LR direction: upstream n1 is to the left of n2 and n3
    expect(n1.position.x).toBeLessThan(n2.position.x);
    expect(n1.position.x).toBeLessThan(n3.position.x);

    // No overlapping bounding boxes
    expect(overlaps(n1, n2)).toBe(false);
    expect(overlaps(n1, n3)).toBe(false);
    expect(overlaps(n2, n3)).toBe(false);

    // Original input array is not mutated
    expect(nodes[0].position).toEqual({ x: 500, y: 500 });
  });
});
