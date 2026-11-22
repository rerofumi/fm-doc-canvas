import { describe, expect, it } from "vitest";
import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { buildMarpMarkdown, collectMarpSlideNodes } from "./marpExport";

describe("buildMarpMarkdown", () => {
  it("outputs frontmatter only when nodes are empty", () => {
    expect(buildMarpMarkdown([], {})).toBe(
      "---\nmarp: true\npaginate: true\n---",
    );
  });

  it("builds Marp slides with frontmatter, --- separator, mixed text/image, and missing URL fallback", () => {
    const nodes: CanvasNode[] = [
      {
        id: "t1",
        type: "customNode",
        position: { x: 0, y: 0 },
        data: { content: "# Slide 1\n\nBody text", summary: "Summary 1" },
      },
      {
        id: "i1",
        type: "imageNode",
        position: { x: 300, y: 0 },
        data: { src: "image_1.png" },
      },
      {
        id: "t2",
        type: "customNode",
        position: { x: 600, y: 0 },
        data: { content: "", summary: "Summary fallback" },
      },
      {
        id: "i2",
        type: "imageNode",
        position: { x: 900, y: 0 },
        data: { src: "missing.png" },
      },
    ];

    const md = buildMarpMarkdown(nodes, {
      "image_1.png": "file:///C:/repo/Image/image_1.png",
    });

    expect(md).toBe(
      [
        "---",
        "marp: true",
        "paginate: true",
        "---",
        "",
        "# Slide 1\n\nBody text",
        "",
        "---",
        "",
        "![bg contain](file:///C:/repo/Image/image_1.png)",
        "",
        "---",
        "",
        "Summary fallback",
        "",
        "---",
        "",
        "<!-- image missing: missing.png -->",
      ].join("\n"),
    );
  });

  it("shares [D-016] ordering for single and multiple selections", () => {
    const nodes: CanvasNode[] = [
      {
        id: "a",
        type: "customNode",
        position: { x: 0, y: 0 },
        data: { content: "A", summary: "" },
      },
      {
        id: "b",
        type: "imageNode",
        position: { x: 300, y: 0 },
        data: { src: "b.png" },
      },
    ];
    const edges: CanvasEdge[] = [{ id: "e1", source: "a", target: "b" }];

    const single = collectMarpSlideNodes(nodes, edges, ["b"]);
    expect(single.orderedNodes.map((n) => n.id)).toEqual(["a", "b"]);

    const multi = collectMarpSlideNodes(nodes, edges, ["b", "a"]);
    expect(multi.orderedNodes.map((n) => n.id)).toEqual(["a", "b"]);
  });
});
