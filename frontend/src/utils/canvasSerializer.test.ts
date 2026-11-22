import { MarkerType } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { deserializeCanvas, serializeCanvas } from "./canvasSerializer";

describe("canvasSerializer", () => {
  it("round-trips v1.1 nodes, edges, metadata, and safe llm fields", () => {
    const nodes: CanvasNode[] = [
      {
        id: "t1",
        type: "customNode",
        position: { x: 100, y: 200 },
        data: {
          content: "Hello",
          summary: "Sum",
          originalPrompt: "Write hello",
        },
        width: 280,
        height: 160,
        selected: true,
      },
      {
        id: "i1",
        type: "imageNode",
        position: { x: 450, y: 200 },
        data: {
          src: "image_1.png",
          prompt: "Draw cat",
          provider: "openai",
          model: "gpt-image-1.5",
        },
      },
    ];
    const edges: CanvasEdge[] = [
      {
        id: "e1",
        source: "t1",
        target: "i1",
        sourceHandle: "right",
        targetHandle: "left",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        selected: true,
      },
    ];

    const json = serializeCanvas(nodes, edges, {
      lastOpened: "2026-11-23T00:00:00.000Z",
      llm: {
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
    });

    const parsed = deserializeCanvas(json);
    expect(parsed.metadata).toEqual({ lastOpened: "2026-11-23T00:00:00.000Z" });
    expect(parsed.llm).toEqual({
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });
    expect(parsed.nodes).toEqual([
      {
        id: "t1",
        type: "customNode",
        position: { x: 100, y: 200 },
        data: {
          content: "Hello",
          summary: "Sum",
          originalPrompt: "Write hello",
        },
        width: 280,
        height: 160,
      },
      {
        id: "i1",
        type: "imageNode",
        position: { x: 450, y: 200 },
        data: {
          src: "image_1.png",
          prompt: "Draw cat",
          provider: "openai",
          model: "gpt-image-1.5",
        },
      },
    ]);
    expect(parsed.edges).toEqual([
      {
        id: "e1",
        source: "t1",
        target: "i1",
        sourceHandle: "right",
        targetHandle: "left",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);
  });

  it("normalizes v1.0 fixture with missing version, handles, optional fields, bad position, and orphan edges", () => {
    const v10Fixture = JSON.stringify({
      nodes: [
        {
          id: "n1",
          type: "customNode",
          position: { x: "bad", y: null },
          data: {},
        },
        {
          id: "n2",
          type: "imageNode",
          position: { x: 300, y: 50 },
          data: {},
        },
      ],
      edges: [
        {
          id: "e1",
          source: "n1",
          target: "n2",
          sourceHandle: null,
        },
        {
          id: "orphan",
          source: "n1",
          target: "missing-node",
        },
      ],
    });

    const result = deserializeCanvas(v10Fixture);
    expect(result.nodes).toEqual([
      {
        id: "n1",
        type: "customNode",
        position: { x: 0, y: 0 },
        data: { content: "", summary: "" },
      },
      {
        id: "n2",
        type: "imageNode",
        position: { x: 300, y: 50 },
        data: { src: "" },
      },
    ]);
    expect(result.edges).toEqual([
      {
        id: "e1",
        source: "n1",
        target: "n2",
        sourceHandle: "right",
        targetHandle: "left",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);
  });

  it("throws errors on invalid JSON, unsupported version, or missing arrays", () => {
    expect(() => deserializeCanvas("{not-json")).toThrow();
    expect(() => deserializeCanvas("[]")).toThrow();
    expect(() =>
      deserializeCanvas(JSON.stringify({ version: "2.0", nodes: [], edges: [] })),
    ).toThrow();
    expect(() =>
      deserializeCanvas(JSON.stringify({ version: "1.1", nodes: [] })),
    ).toThrow();
  });

  it("excludes API keys and secret fields from serialized JSON output", () => {
    const unsafeOptions = {
      llm: {
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        apiKey: "sk-secret-key-12345",
        systemPrompt: "secret system prompt",
      },
      imageGen: {
        openrouter: { apiKey: "or-secret-999" },
      },
    } as unknown as Parameters<typeof serializeCanvas>[2];

    const json = serializeCanvas([], [], unsafeOptions);
    expect(json).not.toContain("sk-secret-key-12345");
    expect(json).not.toContain("or-secret-999");
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("systemPrompt");
    expect(json).not.toContain("imageGen");

    const loaded = deserializeCanvas(
      JSON.stringify({
        version: "1.1",
        llm: {
          baseURL: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          apiKey: "sk-should-not-pass",
        },
        nodes: [],
        edges: [],
      }),
    );
    expect(loaded.llm).toEqual({
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });
  });
});
