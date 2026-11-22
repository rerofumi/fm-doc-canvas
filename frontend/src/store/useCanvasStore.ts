import {
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { hasWailsRuntime, wailsBridge } from "../services/wailsBridge";
import type {
  CanvasEdge,
  CanvasNode,
  CanvasPosition,
  ImageNodeData,
  TextNodeData,
} from "../types/canvas";
import type { ImageGenProviderId } from "../types/config";
import { applyAutoLayout } from "../utils/autoLayout";
import { deserializeCanvas, serializeCanvas } from "../utils/canvasSerializer";
import { collectCanvasContext, wouldCreateCycle } from "../utils/graphContext";
import { useConfigStore } from "./useConfigStore";
import { useToastStore } from "./useToastStore";

export interface InspectorDraft {
  content: string;
  summary: string;
}

export interface AddTextNodeOptions {
  content?: string;
  summary?: string;
  originalPrompt?: string;
  position?: CanvasPosition;
  selected?: boolean;
}

export interface AddImageNodeOptions {
  src: string;
  alt?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  position?: CanvasPosition;
  selected?: boolean;
}

interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: string[];
  canvasEpoch: number;
  isGenerating: boolean;
  summarizingNodeIds: Record<string, boolean>;
  activeInspectorNodeId: string | null;
  inspectorDraft: InspectorDraft | null;
  isInspectorDirty: boolean;
  isInspectorSummaryDirty: boolean;
  lightboxNodeId: string | null;
  isSettingsOpen: boolean;
  isClearConfirmOpen: boolean;
  promptInput: string;
  commandMode: "text" | "image";
  selectedImageProvider: ImageGenProviderId;
  zoom: number;

  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => boolean;

  addTextNode: (options?: AddTextNodeOptions) => string;
  addImageNode: (options: AddImageNodeOptions) => string;
  addEdgeBetween: (source: string, target: string) => boolean;
  updateNodeData: (
    nodeId: string,
    patch: Partial<TextNodeData> | Partial<ImageNodeData>,
  ) => void;
  deleteNodes: (nodeIds: string[]) => void;
  deleteEdges: (edgeIds: string[]) => void;
  clearCanvas: () => void;
  loadCanvasData: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  applyLayout: () => boolean;

  setPromptInput: (value: string) => void;
  appendPromptInput: (text: string) => void;
  setCommandMode: (mode: "text" | "image") => void;
  setSelectedImageProvider: (provider: ImageGenProviderId) => void;
  setIsGenerating: (value: boolean) => void;
  setSummarizingNode: (nodeId: string, active: boolean) => void;

  openInspector: (nodeId: string) => void;
  closeInspector: (commit?: boolean) => void;
  updateInspectorDraft: (patch: Partial<InspectorDraft>) => void;
  commitInspectorDraft: () => void;
  discardInspectorDraft: () => void;

  openLightbox: (nodeId: string) => void;
  closeLightbox: () => void;
  setSettingsOpen: (open: boolean) => void;
  setClearConfirmOpen: (open: boolean) => void;
  setZoom: (zoom: number) => void;

  submitCommand: (fallbackPosition?: CanvasPosition) => Promise<void>;
  regenerateSummary: (
    nodeId: string,
    sourceContent?: string,
    expectedEpoch?: number,
  ) => Promise<void>;
  saveCanvas: () => Promise<void>;
  openCanvas: () => Promise<void>;
  importFilesAtPosition: (
    paths: string[],
    basePosition: CanvasPosition,
  ) => Promise<void>;
}

let idSeq = 0;

function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}`;
}

function resolveDefaultPosition(nodes: ReadonlyArray<CanvasNode>): CanvasPosition {
  const offset = (nodes.length % 8) * 32;
  return { x: 120 + offset, y: 120 + offset };
}

function resolveNextNodePosition(
  nodes: ReadonlyArray<CanvasNode>,
  anchorNodeId: string | null,
  fallbackPosition?: CanvasPosition,
): CanvasPosition {
  const anchor = anchorNodeId
    ? nodes.find((n) => n.id === anchorNodeId)
    : undefined;

  let candidate: CanvasPosition;
  if (anchor) {
    const anchorWidth = anchor.measured?.width ?? anchor.width ?? 280;
    candidate = {
      x: anchor.position.x + anchorWidth + 80,
      y: anchor.position.y,
    };
  } else if (fallbackPosition) {
    candidate = { ...fallbackPosition };
  } else {
    return resolveDefaultPosition(nodes);
  }

  for (let i = 0; i < 20; i += 1) {
    const overlaps = nodes.some(
      (n) =>
        Math.abs(n.position.x - candidate.x) < 40 &&
        Math.abs(n.position.y - candidate.y) < 40,
    );
    if (!overlaps) {
      return candidate;
    }
    candidate = { x: candidate.x, y: candidate.y + 40 };
  }
  return candidate;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
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

  onNodesChange: (changes) => {
    const prevState = get();
    const nextNodes = applyNodeChanges(changes, prevState.nodes);
    const nextNodeIds = new Set(nextNodes.map((n) => n.id));
    const nextSelectedIds = nextNodes
      .filter((n) => n.selected)
      .map((n) => n.id);

    let nextInspectorId = prevState.activeInspectorNodeId;
    let nextDraft = prevState.inspectorDraft;
    let nextDirty = prevState.isInspectorDirty;
    let nextSummaryDirty = prevState.isInspectorSummaryDirty;

    if (nextInspectorId && !nextNodeIds.has(nextInspectorId)) {
      nextInspectorId = null;
      nextDraft = null;
      nextDirty = false;
      nextSummaryDirty = false;
    }

    let nextLightboxId = prevState.lightboxNodeId;
    if (nextLightboxId && !nextNodeIds.has(nextLightboxId)) {
      nextLightboxId = null;
    }

    set({
      nodes: nextNodes,
      selectedNodeIds: nextSelectedIds,
      activeInspectorNodeId: nextInspectorId,
      inspectorDraft: nextDraft,
      isInspectorDirty: nextDirty,
      isInspectorSummaryDirty: nextSummaryDirty,
      lightboxNodeId: nextLightboxId,
    });
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges as Edge[]) as CanvasEdge[],
    }));
  },

  onConnect: (connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target) {
      return false;
    }

    const { edges } = get();
    const duplicate = edges.some(
      (e) => e.source === source && e.target === target,
    );
    if (duplicate) {
      return false;
    }

    if (wouldCreateCycle(edges, source, target)) {
      useToastStore
        .getState()
        .warning("循環（ループ）する接続は作成できません");
      return false;
    }

    const newEdge: CanvasEdge = {
      id: nextId("edge"),
      source,
      target,
      sourceHandle: sourceHandle ?? "right",
      targetHandle: targetHandle ?? "left",
      type: "default",
      markerEnd: { type: MarkerType.ArrowClosed },
    };

    set((state) => ({
      edges: [...state.edges, newEdge],
    }));
    return true;
  },

  addTextNode: (options = {}) => {
    const id = nextId("node");
    const nodes = get().nodes;
    const position = options.position ?? resolveDefaultPosition(nodes);
    const data: TextNodeData = {
      content: options.content ?? "",
      summary: options.summary ?? "",
    };
    if (options.originalPrompt !== undefined) {
      data.originalPrompt = options.originalPrompt;
    }

    const node: CanvasNode = {
      id,
      type: "customNode",
      position,
      data,
      selected: options.selected ?? false,
    };

    set((state) => {
      const updatedNodes = options.selected
        ? state.nodes.map((n) => ({ ...n, selected: false }))
        : state.nodes;
      const nextNodes = [...updatedNodes, node];
      return {
        nodes: nextNodes,
        selectedNodeIds: options.selected
          ? [id]
          : state.selectedNodeIds,
      };
    });

    return id;
  },

  addImageNode: (options) => {
    const id = nextId("node");
    const nodes = get().nodes;
    const position = options.position ?? resolveDefaultPosition(nodes);
    const data: ImageNodeData = {
      src: options.src,
    };
    if (options.alt !== undefined) data.alt = options.alt;
    if (options.prompt !== undefined) data.prompt = options.prompt;
    if (options.provider !== undefined) data.provider = options.provider;
    if (options.model !== undefined) data.model = options.model;

    const node: CanvasNode = {
      id,
      type: "imageNode",
      position,
      data,
      width: 280,
      height: 240,
      selected: options.selected ?? false,
    };

    set((state) => {
      const updatedNodes = options.selected
        ? state.nodes.map((n) => ({ ...n, selected: false }))
        : state.nodes;
      const nextNodes = [...updatedNodes, node];
      return {
        nodes: nextNodes,
        selectedNodeIds: options.selected
          ? [id]
          : state.selectedNodeIds,
      };
    });

    return id;
  },

  addEdgeBetween: (source, target) => {
    return get().onConnect({
      source,
      target,
      sourceHandle: "right",
      targetHandle: "left",
    });
  },

  updateNodeData: (nodeId, patch) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...patch } }
          : node,
      ),
    }));
  },

  deleteNodes: (nodeIds) => {
    if (nodeIds.length === 0) return;
    const removeSet = new Set(nodeIds);
    const state = get();

    const shouldCloseInspector =
      state.activeInspectorNodeId !== null &&
      removeSet.has(state.activeInspectorNodeId);
    const shouldCloseLightbox =
      state.lightboxNodeId !== null && removeSet.has(state.lightboxNodeId);

    const nextNodes = state.nodes.filter((n) => !removeSet.has(n.id));
    const nextEdges = state.edges.filter(
      (e) => !removeSet.has(e.source) && !removeSet.has(e.target),
    );
    const nextSelected = state.selectedNodeIds.filter(
      (id) => !removeSet.has(id),
    );

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeIds: nextSelected,
      ...(shouldCloseInspector
        ? {
            activeInspectorNodeId: null,
            inspectorDraft: null,
            isInspectorDirty: false,
            isInspectorSummaryDirty: false,
          }
        : {}),
      ...(shouldCloseLightbox ? { lightboxNodeId: null } : {}),
    });
  },

  deleteEdges: (edgeIds) => {
    if (edgeIds.length === 0) return;
    const removeSet = new Set(edgeIds);
    set((state) => ({
      edges: state.edges.filter((e) => !removeSet.has(e.id)),
    }));
  },

  clearCanvas: () => {
    set((state) => ({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
      activeInspectorNodeId: null,
      inspectorDraft: null,
      isInspectorDirty: false,
      isInspectorSummaryDirty: false,
      lightboxNodeId: null,
      isClearConfirmOpen: false,
      summarizingNodeIds: {},
      canvasEpoch: state.canvasEpoch + 1,
    }));
  },

  loadCanvasData: (nodes, edges) => {
    set((state) => ({
      nodes,
      edges,
      selectedNodeIds: [],
      activeInspectorNodeId: null,
      inspectorDraft: null,
      isInspectorDirty: false,
      isInspectorSummaryDirty: false,
      lightboxNodeId: null,
      summarizingNodeIds: {},
      canvasEpoch: state.canvasEpoch + 1,
    }));
  },

  applyLayout: () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) {
      return false;
    }
    const laidOut = applyAutoLayout(nodes, edges);
    set({ nodes: laidOut });
    return true;
  },

  setPromptInput: (value) => {
    set({ promptInput: value });
  },

  appendPromptInput: (text) => {
    const trimmedTarget = text.trim();
    if (!trimmedTarget) return;
    set((state) => {
      if (state.promptInput.trim() === "") {
        return { promptInput: text };
      }
      return { promptInput: `${state.promptInput}\n\n${text}` };
    });
  },

  setCommandMode: (mode) => {
    set({ commandMode: mode });
  },

  setSelectedImageProvider: (provider) => {
    set({ selectedImageProvider: provider });
  },

  setIsGenerating: (value) => {
    set({ isGenerating: value });
  },

  setSummarizingNode: (nodeId, active) => {
    set((state) => {
      const next = { ...state.summarizingNodeIds };
      if (active) {
        next[nodeId] = true;
      } else {
        delete next[nodeId];
      }
      return { summarizingNodeIds: next };
    });
  },

  openInspector: (nodeId) => {
    const state = get();
    if (state.activeInspectorNodeId === nodeId) {
      return;
    }
    if (state.activeInspectorNodeId !== null) {
      state.commitInspectorDraft();
    }

    const target = get().nodes.find((n) => n.id === nodeId);
    if (!target || target.type !== "customNode") {
      return;
    }
    const data = target.data as TextNodeData;
    set({
      activeInspectorNodeId: nodeId,
      inspectorDraft: {
        content: data.content ?? "",
        summary: data.summary ?? "",
      },
      isInspectorDirty: false,
      isInspectorSummaryDirty: false,
    });
  },

  closeInspector: (commit = true) => {
    if (commit) {
      get().commitInspectorDraft();
    }
    set({
      activeInspectorNodeId: null,
      inspectorDraft: null,
      isInspectorDirty: false,
      isInspectorSummaryDirty: false,
    });
  },

  updateInspectorDraft: (patch) => {
    set((state) => {
      if (!state.inspectorDraft) {
        return {};
      }
      return {
        inspectorDraft: { ...state.inspectorDraft, ...patch },
        isInspectorDirty: true,
        isInspectorSummaryDirty:
          "summary" in patch ? true : state.isInspectorSummaryDirty,
      };
    });
  },

  commitInspectorDraft: () => {
    const { activeInspectorNodeId, inspectorDraft } = get();
    if (!activeInspectorNodeId || !inspectorDraft) {
      return;
    }
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== activeInspectorNodeId || node.type !== "customNode") {
          return node;
        }
        return {
          ...node,
          data: {
            ...node.data,
            content: inspectorDraft.content,
            summary: inspectorDraft.summary,
          },
        };
      }),
      isInspectorDirty: false,
      isInspectorSummaryDirty: false,
    }));
  },

  discardInspectorDraft: () => {
    set({
      activeInspectorNodeId: null,
      inspectorDraft: null,
      isInspectorDirty: false,
      isInspectorSummaryDirty: false,
    });
  },

  openLightbox: (nodeId) => {
    const state = get();
    if (state.activeInspectorNodeId !== null) {
      state.commitInspectorDraft();
      set({
        activeInspectorNodeId: null,
        inspectorDraft: null,
        isInspectorDirty: false,
        isInspectorSummaryDirty: false,
      });
    }
    const target = get().nodes.find((n) => n.id === nodeId);
    if (!target || target.type !== "imageNode") {
      return;
    }
    set({ lightboxNodeId: nodeId });
  },

  closeLightbox: () => {
    set({ lightboxNodeId: null });
  },

  setSettingsOpen: (open) => {
    set({ isSettingsOpen: open });
  },

  setClearConfirmOpen: (open) => {
    set({ isClearConfirmOpen: open });
  },

  setZoom: (zoom) => {
    set({ zoom });
  },

  submitCommand: async (fallbackPosition) => {
    if (get().isGenerating) {
      return;
    }

    const prompt = get().promptInput.trim();
    if (!prompt) {
      return;
    }

    if (!hasWailsRuntime()) {
      useToastStore
        .getState()
        .info("生成機能はデスクトップ実行時に利用できます");
      return;
    }

    const startEpoch = get().canvasEpoch;
    const {
      nodes,
      edges,
      selectedNodeIds,
      commandMode,
      selectedImageProvider,
    } = get();

    const anchorNodeId =
      selectedNodeIds.length > 0
        ? selectedNodeIds[selectedNodeIds.length - 1]
        : null;

    const contextResult = collectCanvasContext(nodes, edges, selectedNodeIds);
    const contextData = contextResult.textItems
      .map((item) => item.text)
      .filter((t) => t.trim().length > 0)
      .join("\n\n---\n\n");

    set({ isGenerating: true });

    try {
      const imageDataURLs: string[] = [];
      for (const img of contextResult.imageSrcs) {
        if (!img.src) continue;
        try {
          const dataURL = await wailsBridge.getImageDataURL(img.src);
          if (dataURL) {
            imageDataURLs.push(dataURL);
          }
        } catch (err) {
          if (get().canvasEpoch !== startEpoch) {
            return;
          }
          const reason = err instanceof Error ? err.message : String(err);
          useToastStore
            .getState()
            .warning(`画像コンテキストをスキップしました (${img.src}): ${reason}`);
        }
      }

      if (get().canvasEpoch !== startEpoch) {
        return;
      }

      if (commandMode === "text") {
        const generatedText =
          imageDataURLs.length > 0
            ? await wailsBridge.generateTextWithImages(
                prompt,
                contextData,
                imageDataURLs,
              )
            : await wailsBridge.generateText(prompt, contextData);

        if (get().canvasEpoch !== startEpoch) {
          return;
        }

        const position = resolveNextNodePosition(
          get().nodes,
          anchorNodeId,
          fallbackPosition,
        );
        const newNodeId = get().addTextNode({
          content: generatedText,
          summary: "",
          originalPrompt: prompt,
          position,
          selected: true,
        });
        set({ promptInput: "" });

        void get().regenerateSummary(newNodeId, generatedText, startEpoch);
      } else {
        const relPath = await wailsBridge.generateImageWithProvider(
          prompt,
          contextData,
          imageDataURLs,
          selectedImageProvider,
        );

        if (get().canvasEpoch !== startEpoch) {
          return;
        }

        const position = resolveNextNodePosition(
          get().nodes,
          anchorNodeId,
          fallbackPosition,
        );
        const cfg = useConfigStore.getState().config;
        const model = cfg?.imageGen?.[selectedImageProvider]?.model;

        get().addImageNode({
          src: relPath,
          alt: prompt,
          prompt,
          provider: selectedImageProvider,
          model,
          position,
          selected: true,
        });
        set({ promptInput: "" });
        useToastStore.getState().success("画像を生成しました");
      }
    } catch (err) {
      if (get().canvasEpoch === startEpoch) {
        const message = err instanceof Error ? err.message : String(err);
        useToastStore.getState().error(`生成に失敗しました: ${message}`);
      }
    } finally {
      set({ isGenerating: false });
    }
  },

  regenerateSummary: async (nodeId, sourceContent, expectedEpoch) => {
    const startEpoch = expectedEpoch ?? get().canvasEpoch;
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "customNode") {
      return;
    }

    const content =
      sourceContent ??
      (get().activeInspectorNodeId === nodeId && get().inspectorDraft
        ? get().inspectorDraft!.content
        : (node.data as TextNodeData).content);

    if (!content || content.trim() === "") {
      return;
    }

    if (!hasWailsRuntime()) {
      useToastStore
        .getState()
        .info("サマリー生成はデスクトップ実行時に利用できます");
      return;
    }

    get().setSummarizingNode(nodeId, true);
    try {
      const summary = await wailsBridge.generateSummary(content);

      if (get().canvasEpoch !== startEpoch) {
        return;
      }
      const currentNode = get().nodes.find((n) => n.id === nodeId);
      if (!currentNode || currentNode.type !== "customNode") {
        return;
      }

      const state = get();
      if (
        state.activeInspectorNodeId === nodeId &&
        state.isInspectorSummaryDirty
      ) {
        useToastStore
          .getState()
          .info("サマリーを生成しました（編集中のため自動反映をスキップしました）");
        return;
      }

      get().updateNodeData(nodeId, { summary });
      if (get().activeInspectorNodeId === nodeId && get().inspectorDraft) {
        set((s) => ({
          inspectorDraft: s.inspectorDraft
            ? { ...s.inspectorDraft, summary }
            : null,
        }));
      }
    } catch (err) {
      if (
        get().canvasEpoch === startEpoch &&
        get().nodes.some((n) => n.id === nodeId)
      ) {
        const message = err instanceof Error ? err.message : String(err);
        useToastStore
          .getState()
          .warning(`サマリー生成に失敗しました（本文は維持されます）: ${message}`);
      }
    } finally {
      get().setSummarizingNode(nodeId, false);
    }
  },

  saveCanvas: async () => {
    if (get().activeInspectorNodeId !== null) {
      get().commitInspectorDraft();
    }

    if (!hasWailsRuntime()) {
      useToastStore
        .getState()
        .info("キャンバス保存はデスクトップ実行時に利用できます");
      return;
    }

    const { nodes, edges } = get();
    const llm = useConfigStore.getState().config?.llm;
    const jsonData = serializeCanvas(nodes, edges, {
      llm: llm ? { baseURL: llm.baseURL, model: llm.model } : undefined,
    });

    try {
      const savedPath = await wailsBridge.saveCanvasToFile(jsonData);
      if (!savedPath) {
        return;
      }
      useToastStore.getState().success("キャンバスを保存しました");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().error(`キャンバスの保存に失敗しました: ${message}`);
    }
  },

  openCanvas: async () => {
    if (!hasWailsRuntime()) {
      useToastStore
        .getState()
        .info("キャンバス読込はデスクトップ実行時に利用できます");
      return;
    }

    try {
      const rawJson = await wailsBridge.loadCanvasFromFile();
      if (!rawJson) {
        return;
      }
      const parsed = deserializeCanvas(rawJson);
      get().loadCanvasData(parsed.nodes, parsed.edges);
      useToastStore.getState().success("キャンバスを読み込みました");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore
        .getState()
        .error(`キャンバスの読み込みに失敗しました: ${message}`);
    }
  },

  importFilesAtPosition: async (paths, basePosition) => {
    if (paths.length === 0) {
      return;
    }
    if (!hasWailsRuntime()) {
      return;
    }

    let addedCount = 0;
    for (let i = 0; i < paths.length; i += 1) {
      const filePath = paths[i];
      const pos: CanvasPosition = {
        x: basePosition.x + addedCount * 28,
        y: basePosition.y + addedCount * 28,
      };
      try {
        const res = await wailsBridge.importFile(filePath);
        if (res.kind === "text") {
          get().addTextNode({
            content: res.content ?? "",
            summary: "",
            position: pos,
          });
          addedCount += 1;
        } else if (res.kind === "image" && res.src) {
          get().addImageNode({
            src: res.src,
            alt: res.name,
            position: pos,
          });
          addedCount += 1;
        } else {
          useToastStore
            .getState()
            .error(`ファイルの取り込みに失敗しました: ${res.name || filePath}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        useToastStore.getState().error(message);
      }
    }

    if (addedCount > 0) {
      useToastStore
        .getState()
        .success(`${addedCount}件のファイルを取り込みました`);
    }
  },
}));
