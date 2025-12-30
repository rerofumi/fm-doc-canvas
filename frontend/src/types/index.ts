/**
 * NOTE: 実行時モデル（React Flow / Zustand で扱う形）と、
 * 永続化モデル（JSONファイルに保存する形）を分離する。
 */

/** =========================
 *  共通データ構造
 *  ========================= */

// ノードが保持するカスタムデータ
export interface NodeData {
  content: string; // 本文テキスト（Markdown）
  summary: string; // サマリー
}

/** =========================
 *  実行時モデル（Runtime）
 *  ========================= */

// LLM設定など（アプリのローカル設定）
export interface AppConfig {
  llm: {
    baseURL: string; // OpenAI互換APIのBase URL
    model: string;   // 使用モデル名
    apiKey?: string; // 秘匿情報（ローカル設定にのみ保存）
  };
  generation: {
    summaryMaxChars: number; // サマリー上限文字数
  };
}

// アプリケーション上のノード定義（Runtime）
// React Flow の Node 型を拡張して使用することを想定
export interface AppNode {
  id: string;
  type: 'customNode';
  position: { x: number; y: number };
  data: NodeData;
  selected?: boolean;
}

// ライン（エッジ）定義（Runtime）
export interface AppEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | string;
  markerEnd?: {
    type: string;
  };
}

// Zustand ストアの状態（Runtime）
export interface AppState {
  nodes: AppNode[];
  edges: AppEdge[];
  isDrawerOpen: boolean;
  activeNodeId: string | null;
  config: AppConfig;

  // Actions
  addNode: (node: AppNode) => void;
  updateNodeContent: (id: string, content: string) => void;
  updateNodeSummary: (id: string, summary: string) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;
  setActiveNode: (id: string | null) => void;
  setDrawerOpen: (isOpen: boolean) => void;
  setConfig: (config: Partial<AppConfig>) => void;
}

/** =========================
 *  永続化モデル（Persisted）
 *  ========================= */

export type CanvasFileVersion = '1.0';

export interface PersistedNode {
  id: string;
  type: 'customNode';
  position: { x: number; y: number };
  data: NodeData;
}

export interface PersistedEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | string;
  markerEnd?: {
    type: string;
  };
}

export interface CanvasFileV1 {
  version: CanvasFileVersion;
  metadata?: {
    lastOpened?: string;
  };
  llm?: {
    baseURL?: string;
    model?: string;
  };
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}
