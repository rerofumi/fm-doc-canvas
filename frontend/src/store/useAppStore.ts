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
import { traverseContextBackwards, TraversalResult } from "../utils/graphUtils";

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
  isEditorOpen: false,
  isSettingsOpen: false,
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
      isEditorOpen: true,
    }));
  },

  deleteNode: (id: string) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id,
      ),
      activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
      isEditorOpen: state.activeNodeId === id ? false : state.isEditorOpen,
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

  setEditorOpen: (isOpen: boolean) => {
    set({ isEditorOpen: isOpen });
  },

  setSettingsOpen: (isOpen: boolean) => {
    set({ isSettingsOpen: isOpen });
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

  exportMarkdown: async (content: string) => {
    try {
      const result = await AppBackend.ExportMarkdown(content);
      return result;
    } catch (error) {
      console.error("Failed to export markdown:", error);
      throw error;
    }
  },

  exportNode: async (nodeId: string) => {
    const { nodes } = get();
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      throw new Error("Node not found");
    }

    try {
      if (node.type === "customNode") {
        const content = (node.data as TextNodeData).content;
        return await AppBackend.ExportMarkdown(content);
      } else if (node.type === "imageNode") {
        const src = (node.data as ImageNodeData).src;
        return await AppBackend.ExportImage(src);
      }
      throw new Error("Unsupported node type for export");
    } catch (error) {
      console.error("Failed to export node:", error);
      throw error;
    }
  },

  exportImage: async (src: string) => {
    try {
      const result = await AppBackend.ExportImage(src);
      return result;
    } catch (error) {
      console.error("Failed to export image:", error);
      throw error;
    }
  },

  exportNodesAsMarp: async (nodeIds: string[]) => {
    const { nodes, edges } = get();
    if (nodeIds.length === 0) return "";

    // Collect all nodes to include in export.
    // We traverse backwards from each target node to get its context.
    const includedNodeMap = new Map<string, AppNode>();
    let traversalWarningShown = false;

    for (const id of nodeIds) {
      const traversalResult = traverseContextBackwards(id, nodes, edges);

      // Display warning if there was a traversal issue (only once)
      if (traversalResult.warning && !traversalWarningShown) {
        alert(traversalResult.warning.message);
        traversalWarningShown = true;
      }

      for (const node of traversalResult.nodes) {
        includedNodeMap.set(node.id, node);
      }
    }

    // Sort nodes using topological sort to ensure upstream nodes appear before downstream nodes
    const orderedNodes: AppNode[] = [];
    const visited = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;

      // Find all source nodes for this node (upstream)
      const incomingEdges = edges.filter((e) => e.target === nodeId);
      for (const edge of incomingEdges) {
        if (includedNodeMap.has(edge.source)) {
          visit(edge.source);
        }
      }

      visited.add(nodeId);
      const node = includedNodeMap.get(nodeId);
      if (node) {
        orderedNodes.push(node);
      }
    };

    // Start traversal from all nodes in the map
    // Topological sort will naturally handle the ordering
    for (const id of includedNodeMap.keys()) {
      visit(id);
    }

    // Build the Marp content
    let marpSlides = ["---", "marp: true", "theme: default", "---", ""];
    let imageWarningShown = false;

    for (const node of orderedNodes) {
      let slideContent = "";

      if (node.type === "customNode") {
        slideContent = (node.data as TextNodeData).content;
      } else if (node.type === "imageNode") {
        try {
          const fileURL = await AppBackend.GetImageFileURL(
            (node.data as ImageNodeData).src,
          );
          slideContent = `![](${fileURL})`;
        } catch (error) {
          if (!imageWarningShown) {
            alert("画像の一部を解決できませんでした。スキップして続行します。");
            imageWarningShown = true;
          }
          console.warn("Failed to resolve image URL for export:", error);
          // Skip the image if we can't resolve it
          continue;
        }
      }

      // Add slide separator if not the first slide
      if (marpSlides.length > 5) {
        marpSlides.push("---");
        marpSlides.push("");
      }

      const title =
        node.type === "customNode"
          ? (node.data as TextNodeData).summary
          : "Image";
      marpSlides.push(`# ${title}`);
      marpSlides.push(slideContent);
      marpSlides.push("");
    }

    const marpContent = marpSlides.join("\n");

    try {
      const result = await AppBackend.ExportMarkdown(marpContent);
      return result;
    } catch (error) {
      console.error("Failed to export nodes as Marp:", error);
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
