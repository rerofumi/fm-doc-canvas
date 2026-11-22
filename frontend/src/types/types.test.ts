import { describe, expect, it } from "vitest";
import type { CanvasFileV1_1, CanvasNode } from "./canvas";
import type { AppConfig, ImageGenProviderId } from "./config";

describe("shared types smoke test", () => {
  it("constructs CanvasFileV1_1 and AppConfig structures", () => {
    const provider: ImageGenProviderId = "openrouter";
    const config: AppConfig = {
      llm: {
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        apiKey: "",
        systemPrompt: "",
      },
      generation: {
        summaryMaxChars: 100,
      },
      imageGen: {
        provider,
        downloadPath: "Image/",
        openrouter: {
          baseURL: "https://openrouter.ai/api/v1",
          model: "sourceful/riverflow-v2-fast",
          apiKey: "",
        },
        openai: {
          baseURL: "https://api.openai.com/v1",
          model: "gpt-image-1.5",
          apiKey: "",
        },
        google: {
          model: "gemini-2.5-flash-image",
          apiKey: "",
        },
        xai: {
          model: "grok-imagine-image",
          apiKey: "",
        },
      },
    };

    const node: CanvasNode = {
      id: "node-1",
      type: "customNode",
      position: { x: 0, y: 0 },
      data: {
        content: "hello",
        summary: "",
      },
    };

    const canvasFile: CanvasFileV1_1 = {
      version: "1.1",
      nodes: [node],
      edges: [],
    };

    expect(config.imageGen.provider).toBe("openrouter");
    expect(canvasFile.version).toBe("1.1");
    expect(canvasFile.nodes).toHaveLength(1);
  });
});
