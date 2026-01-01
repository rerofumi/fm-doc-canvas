import {
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";

/**
 * NOTE: 実行時モデル（React Flow / Zustand で扱う形）と、
 * 永続化モデル（JSONファイルに保存する形）を分離する。
 */

/** =========================
 *  共通データ構造
 *  ========================= */

// ノードが保持するカスタムデータ
// Text Node Data (Existing)
export interface TextNodeData extends Record<string, unknown> {
  content: string; // 本文テキスト（Markdown）
  summary: string; // サマリー
}

// Image Node Data (New)
export interface ImageNodeData extends Record<string, unknown> {
  /**
   * 画像ファイルの識別子（`imageGen.downloadPath` 配下からの相対パス）
   * 例:
   * - "generated_001.png"
   * - "Import/photo.png"
   */
  src: string;
  alt?: string; // 生成プロンプト等
}

// Node Types
export type NodeData = TextNodeData | ImageNodeData;

// Import File Result (Backend interaction)
export interface ImportFileResult {
  type: "text" | "image";
  content: string; // text: content itself, image: relative path
}

/** =========================
 *  実行時モデル（Runtime）
 *  ========================= */

// LLM設定など（アプリのローカル設定）
export interface AppConfig {
  llm: {
    baseURL: string; // OpenAI互換APIのBase URL
    model: string; // 使用モデル名
    apiKey?: string; // 秘匿情報（ローカル設定にのみ保存）
  };
  // 新規追加
  imageGen: {
    provider: string; // 固定
    baseURL: string;
    model: string;
    apiKey?: string;
    /**
     * 画像保存先ディレクトリ
     * - デフォルト: "Image/"（アプリ実行ファイルと同階層を基準に解釈）
     */
    downloadPath: string;
  };
  generation: {
    summaryMaxChars: number; // サマリー上限文字数
  };
}

// アプリケーション上のノード定義（Runtime）
// React Flow の Node 型を拡張
export type AppNode = Node<NodeData, "customNode" | "imageNode">;

// ライン（エッジ）定義（Runtime）
// React Flow の Edge 型を拡張
export type AppEdge = Edge;

// Zustand ストアの状態（Runtime）
export interface AppState {
  nodes: AppNode[];
  edges: AppEdge[];
  isEditorOpen: boolean;
  isSettingsOpen: boolean;
  activeNodeId: string | null;
  config: AppConfig;

  // Actions
  addNode: (node: AppNode) => void;
  addEmptyNode: () => void;
  updateNodeContent: (id: string, content: string) => void;
  updateNodeSummary: (id: string, summary: string) => void;
  updateNodeDimensions: (id: string, width: number, height: number) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;
  setActiveNode: (id: string | null) => void;
  setEditorOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setConfig: (config: Partial<AppConfig>) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;

  // Backend actions
  loadConfig: () => Promise<void>;
  saveConfig: (config: AppConfig) => Promise<void>;
  saveCanvas: () => Promise<string>;
  loadCanvas: () => Promise<void>;
  generateText: (prompt: string, context: string) => Promise<string>;
  generateSummary: (text: string) => Promise<string>;
  generateImage: (
    prompt: string,
    context: string,
    refImages: string[],
  ) => Promise<string>;
  getImageDataURL: (src: string) => Promise<string>;
  importFile: (filePath: string) => Promise<ImportFileResult>;
  exportMarkdown: (content: string) => Promise<string>;
  exportNode: (nodeId: string) => Promise<string>;
  exportImage: (src: string) => Promise<string>;
  exportNodesAsMarp: (nodeIds: string[]) => Promise<string>;

  // React Flow integration actions
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
}

/** =========================
 *  永続化モデル（Persisted）
 *  ========================= */

export type CanvasFileVersion = "1.0" | "1.1";

export interface PersistedTextNode {
  id: string;
  type: "customNode";
  position: { x: number; y: number };
  data: TextNodeData;
  width?: number;
  height?: number;
}

export interface PersistedImageNode {
  id: string;
  type: "imageNode";
  position: { x: number; y: number };
  data: ImageNodeData;
  width?: number;
  height?: number;
}

export type PersistedNode = PersistedTextNode | PersistedImageNode;

export interface PersistedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  markerEnd?: {
    type: MarkerType;
  };
}

export interface CanvasFileV1_0 {
  version: "1.0";
  metadata?: {
    lastOpened?: string;
  };
  llm?: {
    baseURL?: string;
    model?: string;
  };
  nodes: PersistedTextNode[];
  edges: PersistedEdge[];
}

export interface CanvasFileV1_1 {
  version: "1.1";
  metadata?: {
    lastOpened?: string;
  };
  llm?: {
    baseURL?: string;
    model?: string;
  };
  nodes: PersistedNode[]; // TextNode と ImageNode の混合
  edges: PersistedEdge[];
}

export type CanvasFile = CanvasFileV1_0 | CanvasFileV1_1;
