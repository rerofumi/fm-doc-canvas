import { beforeEach, describe, expect, it, vi } from "vitest";
import { wailsBridge } from "../services/wailsBridge";
import { useCanvasStore } from "./useCanvasStore";
import { useToastStore } from "./useToastStore";

vi.mock("../services/wailsBridge", () => ({
  hasWailsRuntime: () => true,
  wailsBridge: {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
    generateText: vi.fn(),
    generateTextWithImages: vi.fn(),
    generateSummary: vi.fn(),
    generateImage: vi.fn(),
    generateImageWithProvider: vi.fn(),
    getImageDataURL: vi.fn(),
    getImageFileURL: vi.fn(),
    saveCanvasToFile: vi.fn(),
    loadCanvasFromFile: vi.fn(),
    importFile: vi.fn(),
    exportMarkdown: vi.fn(),
    exportImage: vi.fn(),
  },
}));

describe("useCanvasStore", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      canvasEpoch: 0,
      isGenerating: false,
      summarizingNodeIds: {},
      activeInspectorNodeId: null,
      inspectorDraft: null,
      isInspectorDirty: false,
      isInspectorSummaryDirty: false,
      lightboxNodeId: null,
      isSettingsOpen: false,
      isClearConfirmOpen: false,
      promptInput: "",
      commandMode: "text",
      selectedImageProvider: "openrouter",
      zoom: 1,
    });
    useToastStore.getState().clearToasts();
    vi.clearAllMocks();
  });

  it("prevents cycle edges onConnect and emits warning toast", () => {
    const store = useCanvasStore.getState();
    const a = store.addTextNode({ content: "A" });
    const b = store.addTextNode({ content: "B" });

    expect(
      useCanvasStore.getState().onConnect({
        source: a,
        target: b,
        sourceHandle: "right",
        targetHandle: "left",
      }),
    ).toBe(true);

    expect(
      useCanvasStore.getState().onConnect({
        source: b,
        target: a,
        sourceHandle: "right",
        targetHandle: "left",
      }),
    ).toBe(false);

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === "warning" && t.message.includes("循環"))).toBe(true);
    expect(useCanvasStore.getState().edges).toHaveLength(1);
  });

  it("appends prompt input non-destructively", () => {
    const store = useCanvasStore.getState();
    store.appendPromptInput("First prompt");
    expect(useCanvasStore.getState().promptInput).toBe("First prompt");

    useCanvasStore.getState().appendPromptInput("Second prompt");
    expect(useCanvasStore.getState().promptInput).toBe("First prompt\n\nSecond prompt");
  });

  it("auto-commits inspector draft on switch and discards on node deletion", () => {
    const store = useCanvasStore.getState();
    const n1 = store.addTextNode({ content: "initial 1", summary: "" });
    const n2 = store.addTextNode({ content: "initial 2", summary: "" });

    useCanvasStore.getState().openInspector(n1);
    useCanvasStore.getState().updateInspectorDraft({ content: "updated 1" });

    useCanvasStore.getState().openInspector(n2);
    const updatedN1 = useCanvasStore.getState().nodes.find((n) => n.id === n1);
    expect((updatedN1?.data as { content: string }).content).toBe("updated 1");
    expect(useCanvasStore.getState().activeInspectorNodeId).toBe(n2);

    useCanvasStore.getState().updateInspectorDraft({ content: "unsaved 2" });
    useCanvasStore.getState().deleteNodes([n2]);
    expect(useCanvasStore.getState().activeInspectorNodeId).toBeNull();
    expect(useCanvasStore.getState().inspectorDraft).toBeNull();
  });

  it("increments canvasEpoch and resets state on clearCanvas", () => {
    const store = useCanvasStore.getState();
    const n1 = store.addTextNode({ content: "hello" });
    store.openInspector(n1);
    expect(useCanvasStore.getState().canvasEpoch).toBe(0);

    useCanvasStore.getState().clearCanvas();
    const after = useCanvasStore.getState();
    expect(after.canvasEpoch).toBe(1);
    expect(after.nodes).toHaveLength(0);
    expect(after.edges).toHaveLength(0);
    expect(after.activeInspectorNodeId).toBeNull();
  });

  it("keeps generated text node content and originalPrompt when auto-summary fails", async () => {
    vi.mocked(wailsBridge.generateText).mockResolvedValue("Generated body");
    vi.mocked(wailsBridge.generateSummary).mockRejectedValue(new Error("summary error"));

    useCanvasStore.getState().setPromptInput("Write a doc");
    await useCanvasStore.getState().submitCommand();
    await new Promise((r) => setTimeout(r, 0));

    const state = useCanvasStore.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].data).toMatchObject({
      content: "Generated body",
      summary: "",
      originalPrompt: "Write a doc",
    });
    expect(
      useToastStore
        .getState()
        .toasts.some((t) => t.type === "warning" && t.message.includes("本文は維持")),
    ).toBe(true);
  });

  it("adds only one image node using selectedImageProvider in image mode", async () => {
    vi.mocked(wailsBridge.generateImageWithProvider).mockResolvedValue("image_001.png");

    useCanvasStore.getState().setCommandMode("image");
    useCanvasStore.getState().setSelectedImageProvider("xai");
    useCanvasStore.getState().setPromptInput("A mountain");
    await useCanvasStore.getState().submitCommand();

    expect(wailsBridge.generateImageWithProvider).toHaveBeenCalledWith(
      "A mountain",
      "",
      [],
      "xai",
    );
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].type).toBe("imageNode");
    expect(state.nodes[0].data).toMatchObject({
      src: "image_001.png",
      prompt: "A mountain",
      provider: "xai",
    });
  });

  it("discards stale async generation response when canvasEpoch changes mid-flight", async () => {
    let resolveText!: (value: string) => void;
    vi.mocked(wailsBridge.generateText).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveText = resolve;
        }),
    );

    useCanvasStore.getState().setPromptInput("Slow prompt");
    const pending = useCanvasStore.getState().submitCommand();
    expect(useCanvasStore.getState().isGenerating).toBe(true);

    useCanvasStore.getState().clearCanvas();
    resolveText("Stale result");
    await pending;

    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.isGenerating).toBe(false);
    expect(state.canvasEpoch).toBe(1);
  });

  it("commits inspector draft on saveCanvas and treats empty dialog result as cancel", async () => {
    const n1 = useCanvasStore.getState().addTextNode({ content: "before", summary: "" });
    useCanvasStore.getState().openInspector(n1);
    useCanvasStore.getState().updateInspectorDraft({ content: "after" });

    vi.mocked(wailsBridge.saveCanvasToFile).mockResolvedValue("");
    await useCanvasStore.getState().saveCanvas();

    const updated = useCanvasStore.getState().nodes.find((n) => n.id === n1);
    expect((updated?.data as { content: string }).content).toBe("after");
    expect(wailsBridge.saveCanvasToFile).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("preserves existing canvas when openCanvas receives invalid JSON", async () => {
    useCanvasStore.getState().addTextNode({ content: "keep me" });
    vi.mocked(wailsBridge.loadCanvasFromFile).mockResolvedValue("{ invalid json");

    await useCanvasStore.getState().openCanvas();

    expect(useCanvasStore.getState().nodes).toHaveLength(1);
    expect(
      useToastStore.getState().toasts.some((t) => t.type === "error"),
    ).toBe(true);
  });

  it("imports valid dropped files and reports error only for unsupported ones", async () => {
    vi.mocked(wailsBridge.importFile)
      .mockResolvedValueOnce({ kind: "text", content: "# Hello", name: "note.md" })
      .mockRejectedValueOnce(new Error("未対応のファイル形式です: doc.pdf"))
      .mockResolvedValueOnce({ kind: "image", src: "Import/pic.png", name: "pic.png" });

    await useCanvasStore
      .getState()
      .importFilesAtPosition(["note.md", "doc.pdf", "pic.png"], { x: 100, y: 100 });

    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[0].type).toBe("customNode");
    expect(state.nodes[1].type).toBe("imageNode");
    expect(
      useToastStore
        .getState()
        .toasts.some((t) => t.type === "error" && t.message.includes("doc.pdf")),
    ).toBe(true);
  });
});
