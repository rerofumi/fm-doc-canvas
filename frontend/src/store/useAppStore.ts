import { create } from "zustand";
import { AppState, AppNode, AppEdge, AppConfig, CanvasFileV1 } from "../types";
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from "@xyflow/react";
import * as AppBackend from "../../wailsjs/go/main/App";

const initialConfig: AppConfig = {
  llm: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "",
  },
  generation: {
    summaryMaxChars: 100,
  },
};

export const useAppStore = create<AppState>((set, get) => ({
  nodes: [],
  edges: [],
  isDrawerOpen: false,
  activeNodeId: null,
  config: initialConfig,

  // Actions
  addNode: (node: AppNode) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }));
  },

  addEmptyNode: () => {
    const id = `node-${Date.now()}`;
    const newNode: AppNode = {
      id,
      type: "customNode",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        content: "",
        summary: "New Node",
      },
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      activeNodeId: id,
      isDrawerOpen: true,
    }));
  },

  deleteNode: (id: string) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id,
      ),
      activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
      isDrawerOpen: state.activeNodeId === id ? false : state.isDrawerOpen,
    }));
  },

  deleteEdge: (id: string) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    }));
  },

  updateNodeContent: (id: string, content: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, content } } : node,
      ),
    }));
  },

  updateNodeSummary: (id: string, summary: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, summary } } : node,
      ),
    }));
  },

  setNodes: (nodes: AppNode[]) => {
    set({ nodes });
  },

  setEdges: (edges: AppEdge[]) => {
    set({ edges });
  },

  setActiveNode: (id: string | null) => {
    // Note: In single click, we only set the ID for tracking selection
    // isDrawerOpen remains unchanged unless explicitly set
    set({
      activeNodeId: id,
    });
  },

  setDrawerOpen: (isOpen: boolean) => {
    set({ isDrawerOpen: isOpen });
  },

  setConfig: (config: Partial<AppConfig>) => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
  },

  loadConfig: async () => {
    try {
      const config = await AppBackend.GetConfig();
      set({ config });
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  },

  saveConfig: async (config: AppConfig) => {
    try {
      await AppBackend.SaveConfig(config as any);
      set({ config });
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  },

  saveCanvas: async () => {
    const { nodes, edges } = get();
    const canvasData: CanvasFileV1 = {
      version: "1.0",
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as "customNode",
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        markerEnd: e.markerEnd as any,
      })),
    };

    try {
      const filePath = await AppBackend.SaveCanvasToFile(
        JSON.stringify(canvasData, null, 2),
      );
      return filePath;
    } catch (error) {
      console.error("Failed to save canvas:", error);
      throw error;
    }
  },

  loadCanvas: async () => {
    try {
      const jsonString = await AppBackend.LoadCanvasFromFile();
      if (!jsonString) return;

      const data = JSON.parse(jsonString) as CanvasFileV1;
      set({
        nodes: data.nodes as AppNode[],
        edges: (data.edges || []).map((e) => ({
          ...e,
          sourceHandle: e.sourceHandle || "right-source",
          targetHandle: e.targetHandle || "left-target",
        })) as AppEdge[],
      });
    } catch (error) {
      console.error("Failed to load canvas:", error);
      throw error;
    }
  },

  generateText: async (prompt: string, context: string) => {
    try {
      const result = await AppBackend.GenerateText(prompt, context);
      return result;
    } catch (error) {
      console.error("Failed to generate text:", error);
      throw error;
    }
  },

  generateSummary: async (text: string) => {
    try {
      const summary = await AppBackend.GenerateSummary(text);
      return summary;
    } catch (error) {
      console.error("Failed to generate summary:", error);
      throw error;
    }
  },

  // React Flow integration actions
  onNodesChange: (changes: NodeChange<AppNode>[]) => {
    set({
      nodes: applyNodeChanges<AppNode>(changes, get().nodes),
    });
  },

  onEdgesChange: (changes: EdgeChange<AppEdge>[]) => {
    set({
      edges: applyEdgeChanges<AppEdge>(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          sourceHandle: connection.sourceHandle || "right-source",
          targetHandle: connection.targetHandle || "left-target",
          type: "default",
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        get().edges,
      ),
    });
  },
}));
