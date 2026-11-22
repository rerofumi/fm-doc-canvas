import { MarkerType } from "@xyflow/react";
import type {
  CanvasEdge,
  CanvasFileV1_1,
  CanvasNode,
  ImageNodeData,
  TextNodeData,
} from "../types/canvas";

export interface SerializeCanvasOptions {
  llm?: {
    baseURL?: string;
    model?: string;
  };
  lastOpened?: string;
}

export interface DeserializedCanvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  metadata?: CanvasFileV1_1["metadata"];
  llm?: CanvasFileV1_1["llm"];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNodeData(
  type: CanvasNode["type"],
  data: unknown,
): TextNodeData | ImageNodeData {
  const raw = isPlainObject(data) ? data : {};
  if (type === "imageNode") {
    const out: ImageNodeData = {
      src: typeof raw.src === "string" ? raw.src : "",
    };
    if (typeof raw.alt === "string") {
      out.alt = raw.alt;
    }
    if (typeof raw.prompt === "string") {
      out.prompt = raw.prompt;
    }
    if (typeof raw.provider === "string") {
      out.provider = raw.provider;
    }
    if (typeof raw.model === "string") {
      out.model = raw.model;
    }
    return out;
  }

  const out: TextNodeData = {
    content: typeof raw.content === "string" ? raw.content : "",
    summary: typeof raw.summary === "string" ? raw.summary : "",
  };
  if (typeof raw.originalPrompt === "string") {
    out.originalPrompt = raw.originalPrompt;
  }
  return out;
}

/**
 * Serializes canvas nodes and edges into v1.1 JSON, excluding any secret fields such as API keys.
 */
export function serializeCanvas(
  nodes: ReadonlyArray<CanvasNode>,
  edges: ReadonlyArray<CanvasEdge>,
  options?: SerializeCanvasOptions,
): string {
  const payload: CanvasFileV1_1 = {
    version: "1.1",
    metadata: {
      lastOpened: options?.lastOpened ?? new Date().toISOString(),
    },
    nodes: nodes.map((node) => {
      const serialized: CanvasFileV1_1["nodes"][number] = {
        id: node.id,
        type: node.type,
        position: {
          x: node.position.x,
          y: node.position.y,
        },
        data: sanitizeNodeData(node.type, node.data),
      };
      if (typeof node.width === "number" && Number.isFinite(node.width)) {
        serialized.width = node.width;
      }
      if (typeof node.height === "number" && Number.isFinite(node.height)) {
        serialized.height = node.height;
      }
      return serialized;
    }),
    edges: edges.map((edge) => {
      const serialized: CanvasFileV1_1["edges"][number] = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
      };
      if (edge.sourceHandle !== undefined) {
        serialized.sourceHandle = edge.sourceHandle;
      }
      if (edge.targetHandle !== undefined) {
        serialized.targetHandle = edge.targetHandle;
      }
      if (edge.type !== undefined) {
        serialized.type = edge.type;
      }
      if (edge.markerEnd !== undefined) {
        serialized.markerEnd = { type: edge.markerEnd.type };
      }
      return serialized;
    }),
  };

  if (options?.llm) {
    const safeLlm: NonNullable<CanvasFileV1_1["llm"]> = {};
    if (typeof options.llm.baseURL === "string") {
      safeLlm.baseURL = options.llm.baseURL;
    }
    if (typeof options.llm.model === "string") {
      safeLlm.model = options.llm.model;
    }
    payload.llm = safeLlm;
  }

  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and normalizes v1.0 / v1.1 canvas JSON into React Flow compatible nodes and edges.
 * Throws an Error on malformed JSON, unsupported versions, or missing node/edge arrays.
 */
export function deserializeCanvas(jsonText: string): DeserializedCanvas {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("キャンバス JSON の解析に失敗しました");
  }

  if (!isPlainObject(parsed)) {
    throw new Error("キャンバス JSON の形式が不正です");
  }

  const version = parsed.version;
  if (
    version !== undefined &&
    version !== null &&
    version !== "1.0" &&
    version !== "1.1"
  ) {
    throw new Error(`未対応のキャンバスバージョンです: ${String(version)}`);
  }

  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error("nodes または edges 配列が不正です");
  }

  const nodes: CanvasNode[] = [];
  const validNodeIds = new Set<string>();

  for (const rawNode of parsed.nodes) {
    if (!isPlainObject(rawNode) || typeof rawNode.id !== "string" || !rawNode.id) {
      continue;
    }

    const type = rawNode.type === "imageNode" ? "imageNode" : "customNode";
    const rawPos = isPlainObject(rawNode.position) ? rawNode.position : {};
    const x =
      typeof rawPos.x === "number" && Number.isFinite(rawPos.x) ? rawPos.x : 0;
    const y =
      typeof rawPos.y === "number" && Number.isFinite(rawPos.y) ? rawPos.y : 0;

    const normalizedNode: CanvasNode = {
      id: rawNode.id,
      type,
      position: { x, y },
      data: sanitizeNodeData(type, rawNode.data),
    };

    if (typeof rawNode.width === "number" && Number.isFinite(rawNode.width)) {
      normalizedNode.width = rawNode.width;
    }
    if (typeof rawNode.height === "number" && Number.isFinite(rawNode.height)) {
      normalizedNode.height = rawNode.height;
    }

    nodes.push(normalizedNode);
    validNodeIds.add(normalizedNode.id);
  }

  const edges: CanvasEdge[] = [];
  for (const rawEdge of parsed.edges) {
    if (
      !isPlainObject(rawEdge) ||
      typeof rawEdge.id !== "string" ||
      !rawEdge.id ||
      typeof rawEdge.source !== "string" ||
      typeof rawEdge.target !== "string"
    ) {
      continue;
    }

    if (!validNodeIds.has(rawEdge.source) || !validNodeIds.has(rawEdge.target)) {
      continue;
    }

    const sourceHandle =
      typeof rawEdge.sourceHandle === "string" && rawEdge.sourceHandle.length > 0
        ? rawEdge.sourceHandle
        : "right";
    const targetHandle =
      typeof rawEdge.targetHandle === "string" && rawEdge.targetHandle.length > 0
        ? rawEdge.targetHandle
        : "left";

    const markerEnd =
      isPlainObject(rawEdge.markerEnd) &&
      typeof rawEdge.markerEnd.type === "string" &&
      rawEdge.markerEnd.type.length > 0
        ? { type: rawEdge.markerEnd.type }
        : { type: MarkerType.ArrowClosed };

    const normalizedEdge: CanvasEdge = {
      id: rawEdge.id,
      source: rawEdge.source,
      target: rawEdge.target,
      sourceHandle,
      targetHandle,
      markerEnd,
    };

    if (typeof rawEdge.type === "string" && rawEdge.type.length > 0) {
      normalizedEdge.type = rawEdge.type;
    }

    edges.push(normalizedEdge);
  }

  const result: DeserializedCanvas = { nodes, edges };

  if (isPlainObject(parsed.metadata)) {
    const metadata: NonNullable<CanvasFileV1_1["metadata"]> = {};
    if (typeof parsed.metadata.lastOpened === "string") {
      metadata.lastOpened = parsed.metadata.lastOpened;
    }
    result.metadata = metadata;
  }

  if (isPlainObject(parsed.llm)) {
    const llm: NonNullable<CanvasFileV1_1["llm"]> = {};
    if (typeof parsed.llm.baseURL === "string") {
      llm.baseURL = parsed.llm.baseURL;
    }
    if (typeof parsed.llm.model === "string") {
      llm.model = parsed.llm.model;
    }
    result.llm = llm;
  }

  return result;
}
