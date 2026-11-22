export type CanvasNodeType = "customNode" | "imageNode";

export interface TextNodeData extends Record<string, unknown> {
  content: string;
  summary: string;
  originalPrompt?: string;
}

export interface ImageNodeData extends Record<string, unknown> {
  src: string;
  alt?: string;
  prompt?: string;
  provider?: string;
  model?: string;
}

export type CanvasNodeData = TextNodeData | ImageNodeData;

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  position: CanvasPosition;
  data: CanvasNodeData;
  width?: number;
  height?: number;
  measured?: {
    width?: number;
    height?: number;
  };
  selected?: boolean;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  markerEnd?: { type: string };
  selected?: boolean;
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
  nodes: Array<{
    id: string;
    type: CanvasNodeType;
    position: CanvasPosition;
    data: CanvasNodeData;
    width?: number;
    height?: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string;
    markerEnd?: { type: string };
  }>;
}
