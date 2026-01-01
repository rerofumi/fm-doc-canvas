import { create } from "zustand";
import {
  AppState,
  AppNode,
  AppEdge,
  AppConfig,
  CanvasFileV1_0,
  CanvasFileV1_1,
  TextNodeData,
  ImageNodeData,
  CanvasFile,
} from "../types";
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
  imageGen: {
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    model: "sourceful/riverflow-v2-standard-preview",
    apiKey: "",
    downloadPath: "Image/",
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
    const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNode: AppNode = {
      id,
      type: "customNode",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        content: "",
        summary: "New Node",
      },
      width: 250,
      height: 150,
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
        node.id === id && node.type === "customNode"
          ? { ...node, data: { ...node.data, content } }
          : node,
      ),
    }));
  },

  updateNodeSummary: (id: string, summary: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id && node.type === "customNode"
          ? { ...node, data: { ...node.data, summary } }
          : node,
      ),
    }));
  },

  updateNodeDimensions: (id: string, width: number, height: number) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, width, height } : node,
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
      // Type assertion to ensure compatibility with AppConfig
      // This is necessary because the backend Config struct might not perfectly match the frontend AppConfig type
      // Specifically, the backend might not include all optional fields or might have different field types
      // Ensure the config object has all required properties
      // If imageGen is missing, use the default values
      const fullConfig: AppConfig = {
        llm: (config as any).llm || initialConfig.llm,
        generation: (config as any).generation || initialConfig.generation,
        imageGen: (config as any).imageGen || initialConfig.imageGen,
      };
      set({ config: fullConfig });
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  },

  saveConfig: async (config: AppConfig) => {
    try {
      await AppBackend.SaveConfig(config as any);
      // Ensure the config object has all required properties
      // If imageGen is missing, use the default values
      const fullConfig: AppConfig = {
        llm: config.llm || initialConfig.llm,
        generation: config.generation || initialConfig.generation,
        imageGen: config.imageGen || initialConfig.imageGen,
      };
      set({ config: fullConfig });
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  },

  saveCanvas: async () => {
    const { nodes, edges } = get();
    // Version 1.1 として保存
    const canvasData: CanvasFile = {
      version: "1.1",
      nodes: nodes.map((n) => {
        if (n.type === "customNode") {
          return {
            id: n.id,
            type: "customNode" as const,
            position: n.position,
            data: n.data as TextNodeData,
            width: n.width,
            height: n.height,
          };
        } else if (n.type === "imageNode") {
          return {
            id: n.id,
            type: "imageNode" as const,
            position: n.position,
            data: n.data as ImageNodeData,
            width: n.width,
            height: n.height,
          };
        }
        // Fallback for unknown node types - treat as customNode
        return {
          id: n.id,
          type: "customNode" as const,
          position: n.position,
          data: n.data as TextNodeData,
          width: n.width,
          height: n.height,
        };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || "right-source",
        targetHandle: e.targetHandle || "left-target",
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

      const data = JSON.parse(jsonString) as CanvasFile;

      let nodesToSet: AppNode[] = [];
      if ((data as CanvasFileV1_0).version === "1.0") {
        // Version 1.0: Only text nodes
        nodesToSet = (data as CanvasFileV1_0).nodes.map((n: any) => ({
          ...n,
          type: "customNode" as const,
        })) as AppNode[];
      } else if ((data as CanvasFileV1_1).version === "1.1") {
        // Version 1.1: Mixed nodes (text and image)
        nodesToSet = (data as CanvasFileV1_1).nodes as AppNode[];
      } else {
        // Unknown version - try to load as v1.1, but filter out unknown types for safety
        console.warn(`Unknown canvas file version: ${data.version}`);
        const v1_1Data = data as CanvasFileV1_1;
        nodesToSet = v1_1Data.nodes.filter(
          (n: any) => n.type === "customNode" || n.type === "imageNode",
        ) as AppNode[];
      }

      set({
        nodes: nodesToSet,
        edges: ((data as CanvasFileV1_1).edges || []).map((e: any) => ({
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

  generateImage: async (
    prompt: string,
    context: string,
    refImages: string[],
  ) => {
    try {
      const result = await AppBackend.GenerateImage(prompt, context, refImages);
      return result;
    } catch (error) {
      console.error("Failed to generate image:", error);
      throw error;
    }
  },

  getImageDataURL: async (src: string) => {
    try {
      const dataURL = await AppBackend.GetImageDataURL(src);
      return dataURL;
    } catch (error) {
      console.error("Failed to get image data URL:", error);
      throw error;
    }
  },

  importFile: async (filePath: string) => {
    try {
      const result = await AppBackend.ImportFile(filePath);
      return result as any;
    } catch (error) {
      console.error("Failed to import file:", error);
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
    // Adjust connection to ensure proper flow direction
    // Right connector (older context) -> Left connector (newer context)
    const adjustedConnection = {
      ...connection,
      sourceHandle: connection.sourceHandle || "right-source",
      targetHandle: connection.targetHandle || "left-target",
    };

    set({
      edges: addEdge(
        {
          ...adjustedConnection,
          type: "default",
          // Remove markerEnd to display simple lines without arrows
        },
        get().edges,
      ),
    });
  },
}));
