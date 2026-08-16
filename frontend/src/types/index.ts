import {
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import { ChatToolProposal, DirectTransformReceipt } from "./chat";

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
  originalPrompt?: string; // 元の質問プロンプト（テキスト生成時）
  revision?: number; // 競合検出用の content mutation counter
  charCount?: number;
  wordCount?: number;
  filename?: string; // hidden when role is text
  domainKind?: "text";
  domainRole?: "text" | "artifact";
}

export interface ArtifactNodeData extends Record<string, unknown> {
  filename: string;
  language: "markdown" | "text";
  content: string;
  summary: string;
  revision: number;
  charCount: number;
  wordCount: number;
  lastEditSummary?: string;
  lastEditedAt?: number;
  originalPrompt?: string;
  domainKind?: "text";
  domainRole?: "text" | "artifact";
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
  prompt?: string;
  provider?: string;
  model?: string;
  domainKind?: "image";
}

export interface FolderNodeData extends Record<string, unknown> {
  label: string;
  childCanvasId: string;
  domainKind?: "folder";
  badgeCount?: number;
}

// Node Types
export type NodeData = TextNodeData | ArtifactNodeData | ImageNodeData | FolderNodeData;

// Import File Result (Backend interaction)
export interface ImportFileResult {
  type: "text" | "image";
  content: string; // text: content itself, image: relative path
  filename?: string;
}

/** =========================
 *  実行時モデル（Runtime）
 *  ========================= */

// LLM設定など（アプリのローカル設定）
export interface OpenRouterConfig {
  baseURL: string;
  model: string;
  apiKey?: string; // 秘匿情報（ローカル設定にのみ保存）
}

export interface OpenAIConfig {
  baseURL: string;
  model: string;
  apiKey?: string; // 秘匿情報（ローカル設定にのみ保存）
}

export interface GoogleConfig {
  model: string;
  apiKey?: string; // 秘匿情報（ローカル設定にのみ保存）
}

export interface XAIConfig {
  model: string;
  apiKey?: string; // 秘匿情報（ローカル設定にのみ保存）
}

// プロバイダごとの設定を保持する型
export type ProviderConfig =
  | { provider: "openrouter"; config: OpenRouterConfig }
  | { provider: "openai"; config: OpenAIConfig }
  | { provider: "xai"; config: XAIConfig };

export interface AppConfig {
  llm: {
    baseURL: string; // OpenAI互換APIのBase URL
    model: string; // 使用モデル名
    apiKey?: string; // 秘匿情報（ローカル設定にのみ保存）
    systemPrompt?: string; // システムプロンプト
  };
  // 画像生成プロバイダの設定
  imageGen: {
    provider: string; // "openrouter" | "stabilityai" | "dalle" | "local"
    downloadPath: string;
    // プロバイダごとの設定（バックエンドとの互換性のために残す）
    baseURL?: string;
    model?: string;
    apiKey?: string;
    // プロバイダごとの設定
    openrouter?: OpenRouterConfig;
    openai?: OpenAIConfig;
    google?: GoogleConfig;
    xai?: XAIConfig;
  };
  generation: {
    summaryMaxChars: number; // サマリー上限文字数
  };
  webSearch?: {
    provider: "ollama" | "kagi" | "brave";
    ollama?: { apiKey: string };
    kagi?: { apiKey: string };
    brave?: { apiKey: string };
  };
}

export type ImageGenProvider = "openrouter" | "openai" | "google" | "xai";

// アプリケーション上のノード定義（Runtime）
// React Flow の Node 型を拡張
export type AppNode = Node<
  NodeData,
  "customNode" | "artifactNode" | "imageNode" | "folderNode"
>;

// ライン（エッジ）定義（Runtime）
// React Flow の Edge 型を拡張
export type AppEdge = Edge;

// Zustand ストアの状態（Runtime）
export interface AppState {
  nodes: AppNode[];
  edges: AppEdge[];
  canvasId: string;
  isEditorOpen: boolean;
  isSettingsOpen: boolean;
  activeNodeId: string | null;
  config: AppConfig;
  promptInput: string;

  // Actions
  addNode: (node: AppNode) => void;
  addEmptyNode: () => void;
  addArtifactNode: () => void;
  updateNodeContent: (id: string, content: string) => void;
  updateArtifactContent: (id: string, content: string) => void;
  updateArtifactFilename: (id: string, filename: string) => void;
  setArtifactLastEditSummary: (id: string, summary: string) => void;
  updateNodeSummary: (id: string, summary: string) => void;
  updateNodeDimensions: (id: string, width: number, height: number) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;
  setActiveNode: (id: string | null, preserveSelection?: boolean) => void;
  setEditorOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setConfig: (config: Partial<AppConfig>) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  setPromptInput: (value: string) => void;
  appendPromptInput: (value: string) => void;
  applyToolProposal: (proposal: ChatToolProposal, runId?: string) => {
    status: "applied" | "rejected" | "conflict" | "error";
    error?: string;
  };
  decideToolProposal: (
    proposal: ChatToolProposal,
    decision: "accept" | "modify" | "reject" | "cancel",
    runId?: string,
    modified?:
      | string
      | {
          content?: string;
          reason?: string;
          suggestedRelations?: NonNullable<ChatToolProposal["transform"]>["suggestedRelations"];
          relation?: NonNullable<ChatToolProposal["relation"]>;
        },
  ) => {
    status: "applied" | "rejected" | "conflict" | "error";
    error?: string;
  };
  runDirectTransform: (operation: "summarize" | "compare" | "counterpoint", sourceNodeIds?: string[]) => Promise<boolean>;
  lastDirectReceipt: DirectTransformReceipt | null;

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
    provider?: string,
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

export type CanvasFileVersion = "1.0" | "1.1" | "1.2" | "1.3";

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

export interface PersistedArtifactNode {
  id: string;
  type: "artifactNode";
  position: { x: number; y: number };
  data: ArtifactNodeData;
  width?: number;
  height?: number;
}

export type PersistedNode =
  | PersistedTextNode
  | PersistedArtifactNode
  | PersistedImageNode;

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

export interface CanvasFileV1_2 {
  version: "1.2";
  metadata: {
    canvasId: string;
    lastOpened?: string;
  };
  llm?: {
    baseURL?: string;
    model?: string;
  };
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}

export type CanvasFile = CanvasFileV1_0 | CanvasFileV1_1 | CanvasFileV1_2;
