import { validateDocument } from "./invariants";
import {
  DomainServices,
  ImageNode,
  Provenance,
  RelationKind,
  RelationRecord,
  TextBearingNode,
  ValidatedWorkspaceLoad,
  WorkspaceDocument,
  WorkspaceNode,
  WorkspaceState,
  getContentStats,
  isFolder,
  isTextBearing,
  sanitizeFilename,
} from "./workspace";

export interface CanvasFileV1_3 {
  version: "1.3";
  metadata: {
    workspaceId: string;
    rootCanvasId: string;
    currentCanvasId: string;
    lastOpened?: string;
  };
  canvases: Array<{
    id: string;
    name: string;
    parentCanvasId?: string;
    folderNodeId?: string;
    extensions?: Record<string, unknown>;
  }>;
  nodes: PersistedNodeV1_3[];
  relations: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    kind: RelationKind;
    status: "accepted";
    reason?: string;
    provenance?: Provenance;
    presentation?: { sourceHandle?: string; targetHandle?: string };
    extensions?: Record<string, unknown>;
  }>;
  extensions?: Record<string, unknown>;
}

type PersistedNodeV1_3 =
  | {
      kind: "text";
      id: string;
      parentCanvasId: string;
      position: { x: number; y: number };
      order: number;
      revision: number;
      width?: number;
      height?: number;
      provenance?: Provenance;
      extensions?: Record<string, unknown>;
      role: "text" | "artifact";
      content: string;
      summary: string;
      originalPrompt?: string;
      filename?: string;
      language: "markdown" | "text";
      lastEditSummary?: string;
      lastEditedAt?: number;
    }
  | {
      kind: "image";
      id: string;
      parentCanvasId: string;
      position: { x: number; y: number };
      order: number;
      revision: number;
      width?: number;
      height?: number;
      provenance?: Provenance;
      extensions?: Record<string, unknown>;
      src: string;
      alt?: string;
      prompt?: string;
      provider?: string;
      model?: string;
    }
  | {
      kind: "folder";
      id: string;
      parentCanvasId: string;
      position: { x: number; y: number };
      order: number;
      revision: number;
      width?: number;
      height?: number;
      provenance?: Provenance;
      extensions?: Record<string, unknown>;
      childCanvasId: string;
      label: string;
    };

export type LoadResult =
  | { ok: true; load: ValidatedWorkspaceLoad }
  | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function requireString(v: unknown, field: string): string {
  if (typeof v !== "string" || !v) throw new Error(`${field} must be non-empty string`);
  return v;
}

function requireFiniteNumber(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${field} must be finite number`);
  return v;
}

export function serializeWorkspaceV1_3(
  state: WorkspaceState,
  clockISO: string,
): CanvasFileV1_3 {
  const { document, runtime } = state;
  const nodes: PersistedNodeV1_3[] = Object.values(document.nodes)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((node) => {
      const base = {
        id: node.id,
        parentCanvasId: node.parentCanvasId,
        position: node.position,
        order: node.order,
        revision: node.revision,
        width: node.width,
        height: node.height,
        provenance: node.provenance,
        extensions: node.extensions,
      };
      if (isTextBearing(node)) {
        return {
          ...base,
          kind: "text" as const,
          role: node.role,
          content: node.content,
          summary: node.summary,
          originalPrompt: node.originalPrompt,
          filename: node.filename,
          language: node.language,
          lastEditSummary: node.lastEditSummary,
          lastEditedAt: node.lastEditedAt,
        };
      }
      if (isFolder(node)) {
        return {
          ...base,
          kind: "folder" as const,
          childCanvasId: node.childCanvasId,
          label: node.label,
        };
      }
      return {
        ...base,
        kind: "image" as const,
        src: node.src,
        alt: node.alt,
        prompt: node.prompt,
        provider: node.provider,
        model: node.model,
      };
    });

  return {
    version: "1.3",
    metadata: {
      workspaceId: document.workspaceId,
      rootCanvasId: document.rootCanvasId,
      currentCanvasId: runtime.currentCanvasId,
      lastOpened: clockISO,
    },
    canvases: Object.values(document.canvases).map((c) => ({
      id: c.id,
      name: c.name,
      parentCanvasId: c.parentCanvasId,
      folderNodeId: c.folderNodeId,
      extensions: c.extensions,
    })),
    nodes,
    relations: Object.values(document.relations).map((r) => ({ ...r })),
    extensions: document.extensions,
  };
}

function hydrateNode(raw: PersistedNodeV1_3): WorkspaceNode {
  const base = {
    id: raw.id,
    parentCanvasId: raw.parentCanvasId,
    position: raw.position,
    order: raw.order,
    revision: raw.revision,
    width: raw.width,
    height: raw.height,
    provenance: raw.provenance,
    extensions: raw.extensions,
  };
  if (raw.kind === "text") {
    const stats = getContentStats(raw.content);
    const node: TextBearingNode = {
      ...base,
      kind: "text",
      role: raw.role,
      content: raw.content,
      summary: raw.summary,
      originalPrompt: raw.originalPrompt,
      filename: raw.filename,
      language: raw.language,
      charCount: stats.charCount,
      wordCount: stats.wordCount,
      lastEditSummary: raw.lastEditSummary,
      lastEditedAt: raw.lastEditedAt,
    };
    return node;
  }
  if (raw.kind === "folder") {
    return {
      ...base,
      kind: "folder",
      childCanvasId: raw.childCanvasId,
      label: raw.label,
    };
  }
  const image: ImageNode = {
    ...base,
    kind: "image",
    src: raw.src,
    alt: raw.alt,
    prompt: raw.prompt,
    provider: raw.provider,
    model: raw.model,
  };
  return image;
}

function parseV1_3(data: Record<string, unknown>): ValidatedWorkspaceLoad {
  const metadata = data.metadata;
  if (!isObject(metadata)) throw new Error("metadata required");
  const workspaceId = requireString(metadata.workspaceId, "metadata.workspaceId");
  const rootCanvasId = requireString(metadata.rootCanvasId, "metadata.rootCanvasId");
  const currentCanvasId = requireString(metadata.currentCanvasId, "metadata.currentCanvasId");

  const canvasesArr = data.canvases;
  const nodesArr = data.nodes;
  const relationsArr = data.relations;
  if (!Array.isArray(canvasesArr) || !Array.isArray(nodesArr) || !Array.isArray(relationsArr)) {
    throw new Error("canvases/nodes/relations must be arrays");
  }

  // Reject unknown top-level keys except extensions
  const allowedTop = new Set(["version", "metadata", "canvases", "nodes", "relations", "extensions"]);
  for (const key of Object.keys(data)) {
    if (!allowedTop.has(key)) throw new Error(`unknown V1.3 field: ${key}`);
  }

  const document: WorkspaceDocument = {
    workspaceId,
    rootCanvasId,
    canvases: {},
    nodes: {},
    relations: {},
    extensions: isObject(data.extensions) ? (data.extensions as Record<string, unknown>) : undefined,
  };

  for (const c of canvasesArr) {
    if (!isObject(c)) throw new Error("invalid canvas");
    const id = requireString(c.id, "canvas.id");
    if (document.canvases[id]) throw new Error(`duplicate canvas id ${id}`);
    document.canvases[id] = {
      id,
      name: requireString(c.name, "canvas.name"),
      parentCanvasId: typeof c.parentCanvasId === "string" ? c.parentCanvasId : undefined,
      folderNodeId: typeof c.folderNodeId === "string" ? c.folderNodeId : undefined,
      extensions: isObject(c.extensions) ? (c.extensions as Record<string, unknown>) : undefined,
    };
  }

  for (const n of nodesArr) {
    if (!isObject(n)) throw new Error("invalid node");
    const kind = requireString(n.kind, "node.kind");
    const id = requireString(n.id, "node.id");
    if (document.nodes[id]) throw new Error(`duplicate node id ${id}`);
    const position = n.position;
    if (!isObject(position)) throw new Error("node.position required");
    const base = {
      id,
      parentCanvasId: requireString(n.parentCanvasId, "node.parentCanvasId"),
      position: {
        x: requireFiniteNumber(position.x, "position.x"),
        y: requireFiniteNumber(position.y, "position.y"),
      },
      order: requireFiniteNumber(n.order, "node.order"),
      revision: requireFiniteNumber(n.revision, "node.revision"),
      width: typeof n.width === "number" ? n.width : undefined,
      height: typeof n.height === "number" ? n.height : undefined,
provenance: isObject(n.provenance) ? (n.provenance as unknown as Provenance) : undefined,
      extensions: isObject(n.extensions) ? (n.extensions as Record<string, unknown>) : undefined,
    };
    if (kind === "text") {
      const content = typeof n.content === "string" ? n.content : "";
      const stats = getContentStats(content);
      document.nodes[id] = {
        ...base,
        kind: "text",
        role: n.role === "artifact" ? "artifact" : "text",
        content,
        summary: typeof n.summary === "string" ? n.summary : "",
        originalPrompt: typeof n.originalPrompt === "string" ? n.originalPrompt : undefined,
        filename: typeof n.filename === "string" ? n.filename : undefined,
        language: n.language === "text" ? "text" : "markdown",
        charCount: stats.charCount,
        wordCount: stats.wordCount,
        lastEditSummary: typeof n.lastEditSummary === "string" ? n.lastEditSummary : undefined,
        lastEditedAt: typeof n.lastEditedAt === "number" ? n.lastEditedAt : undefined,
      };
    } else if (kind === "image") {
      document.nodes[id] = {
        ...base,
        kind: "image",
        src: requireString(n.src, "image.src"),
        alt: typeof n.alt === "string" ? n.alt : undefined,
        prompt: typeof n.prompt === "string" ? n.prompt : undefined,
        provider: typeof n.provider === "string" ? n.provider : undefined,
        model: typeof n.model === "string" ? n.model : undefined,
      };
    } else if (kind === "folder") {
      document.nodes[id] = {
        ...base,
        kind: "folder",
        childCanvasId: requireString(n.childCanvasId, "folder.childCanvasId"),
        label: requireString(n.label, "folder.label"),
      };
    } else {
      throw new Error(`unknown node kind ${kind}`);
    }
  }

  for (const r of relationsArr) {
    if (!isObject(r)) throw new Error("invalid relation");
    const id = requireString(r.id, "relation.id");
    if (document.relations[id]) throw new Error(`duplicate relation id ${id}`);
    document.relations[id] = {
      id,
      sourceNodeId: requireString(r.sourceNodeId, "relation.sourceNodeId"),
      targetNodeId: requireString(r.targetNodeId, "relation.targetNodeId"),
      kind: (typeof r.kind === "string" ? r.kind : "context") as RelationKind,
      status: "accepted",
      reason: typeof r.reason === "string" ? r.reason : undefined,
      provenance: isObject(r.provenance) ? (r.provenance as unknown as Provenance) : undefined,
      presentation: isObject(r.presentation)
        ? (r.presentation as RelationRecord["presentation"])
        : undefined,
      extensions: isObject(r.extensions) ? (r.extensions as Record<string, unknown>) : undefined,
    };
  }

  if (!document.canvases[currentCanvasId]) {
    throw new Error("currentCanvasId missing from canvases");
  }

  const err = validateDocument(document);
  if (err) throw new Error(err);

  return { document, restoredCurrentCanvasId: currentCanvasId };
}

function legacyNodeType(n: Record<string, unknown>): string {
  return typeof n.type === "string" ? n.type : "customNode";
}

function migrateLegacy(
  data: Record<string, unknown>,
  version: "1.0" | "1.1" | "1.2",
  services: DomainServices,
): ValidatedWorkspaceLoad {
  const nodesArr = Array.isArray(data.nodes) ? data.nodes : [];
  const edgesArr = Array.isArray(data.edges) ? data.edges : [];

  let workspaceId: string;
  if (version === "1.2") {
    const metadata = isObject(data.metadata) ? data.metadata : {};
    const canvasId = typeof metadata.canvasId === "string" ? metadata.canvasId.trim() : "";
    workspaceId = canvasId || services.ids.next("workspace");
  } else {
    workspaceId = services.ids.next("workspace");
  }
  const rootCanvasId = `legacy-root:${workspaceId}`;

  const document: WorkspaceDocument = {
    workspaceId,
    rootCanvasId,
    canvases: {
      [rootCanvasId]: { id: rootCanvasId, name: "Workspace" },
    },
    nodes: {},
    relations: {},
    extensions: {},
  };

  if (isObject(data.llm)) {
    document.extensions = {
      ...document.extensions,
      legacyFileMetadata: { llm: data.llm },
    };
  }

  nodesArr.forEach((raw, index) => {
    if (!isObject(raw)) throw new Error("invalid legacy node");
    const id = requireString(raw.id, "node.id");
    if (document.nodes[id]) throw new Error(`duplicate node id ${id}`);
    const position = isObject(raw.position) ? raw.position : null;
    if (!position) throw new Error("node.position required");
    const x = requireFiniteNumber(position.x, "position.x");
    const y = requireFiniteNumber(position.y, "position.y");
    const type = legacyNodeType(raw);
    if (type !== "customNode" && type !== "artifactNode" && type !== "imageNode") {
      if (version === "1.0") {
        // v1.0 treats all as text
      } else {
        throw new Error(`unknown node type ${type}`);
      }
    }
    const dataObj = isObject(raw.data) ? raw.data : {};
    const knownDataKeys = new Set([
      "content",
      "summary",
      "originalPrompt",
      "revision",
      "charCount",
      "wordCount",
      "filename",
      "language",
      "lastEditSummary",
      "lastEditedAt",
      "src",
      "alt",
      "prompt",
      "provider",
      "model",
    ]);
    const legacyData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dataObj)) {
      if (!knownDataKeys.has(k)) legacyData[k] = v;
    }
    const extensions =
      Object.keys(legacyData).length > 0 ? { legacyData } : undefined;

    const base = {
      id,
      parentCanvasId: rootCanvasId,
      position: { x, y },
      order: index,
      revision: typeof dataObj.revision === "number" ? dataObj.revision : 0,
      width: typeof raw.width === "number" ? raw.width : undefined,
      height: typeof raw.height === "number" ? raw.height : undefined,
      provenance: { origin: "migration" as const, createdAt: services.clock.nowISO() },
      extensions,
    };

    const asText = type === "customNode" || version === "1.0" || (type !== "artifactNode" && type !== "imageNode");
    if (type === "imageNode") {
      document.nodes[id] = {
        ...base,
        kind: "image",
        src: typeof dataObj.src === "string" ? dataObj.src : "",
        alt: typeof dataObj.alt === "string" ? dataObj.alt : undefined,
        prompt: typeof dataObj.prompt === "string" ? dataObj.prompt : undefined,
        provider: typeof dataObj.provider === "string" ? dataObj.provider : undefined,
        model: typeof dataObj.model === "string" ? dataObj.model : undefined,
      };
    } else if (type === "artifactNode") {
      const content = typeof dataObj.content === "string" ? dataObj.content : "";
      const stats = getContentStats(content);
      document.nodes[id] = {
        ...base,
        kind: "text",
        role: "artifact",
        content,
        summary:
          typeof dataObj.summary === "string"
            ? dataObj.summary
            : content.split(/\r?\n/, 1)[0] || "Untitled Artifact",
        filename: sanitizeFilename(
          typeof dataObj.filename === "string" && dataObj.filename
            ? dataObj.filename
            : "untitled.md",
        ),
        language: dataObj.language === "text" ? "text" : "markdown",
        charCount: stats.charCount,
        wordCount: stats.wordCount,
        lastEditSummary:
          typeof dataObj.lastEditSummary === "string" ? dataObj.lastEditSummary : undefined,
        lastEditedAt: typeof dataObj.lastEditedAt === "number" ? dataObj.lastEditedAt : undefined,
      };
    } else if (asText) {
      const content = typeof dataObj.content === "string" ? dataObj.content : "";
      const stats = getContentStats(content);
      document.nodes[id] = {
        ...base,
        kind: "text",
        role: "text",
        content,
        summary:
          typeof dataObj.summary === "string"
            ? dataObj.summary
            : content.split(/\r?\n/, 1)[0] || "",
        originalPrompt:
          typeof dataObj.originalPrompt === "string" ? dataObj.originalPrompt : undefined,
        language: "markdown",
        charCount: stats.charCount,
        wordCount: stats.wordCount,
      };
    }
  });

  edgesArr.forEach((raw, index) => {
    if (!isObject(raw)) throw new Error("invalid legacy edge");
    const source = requireString(raw.source, "edge.source");
    const target = requireString(raw.target, "edge.target");
    if (!document.nodes[source] || !document.nodes[target]) {
      throw new Error("missing relation endpoint");
    }
    const id =
      typeof raw.id === "string" && raw.id
        ? raw.id
        : `legacy-edge:${index}:${source}:${target}`;
    if (document.relations[id]) throw new Error(`duplicate relation id ${id}`);
    const extensions: Record<string, unknown> = {};
    if (raw.type !== undefined || raw.markerEnd !== undefined) {
      extensions.legacyPresentation = {
        type: raw.type,
        markerEnd: raw.markerEnd,
      };
    }
    document.relations[id] = {
      id,
      sourceNodeId: source,
      targetNodeId: target,
      kind: "context",
      status: "accepted",
      presentation: {
        sourceHandle: typeof raw.sourceHandle === "string" ? raw.sourceHandle : undefined,
        targetHandle: typeof raw.targetHandle === "string" ? raw.targetHandle : undefined,
      },
      extensions: Object.keys(extensions).length ? extensions : undefined,
      provenance: { origin: "migration", createdAt: services.clock.nowISO() },
    };
  });

  const err = validateDocument(document);
  if (err) throw new Error(err);
  return { document, restoredCurrentCanvasId: rootCanvasId };
}

export function loadWorkspaceJSON(
  json: string,
  services: DomainServices,
): LoadResult {
  try {
    const data = JSON.parse(json) as unknown;
    if (!isObject(data)) return { ok: false, error: "root must be object" };
    const version = data.version;
    if (version === "1.3") {
      return { ok: true, load: parseV1_3(data) };
    }
    if (version === "1.0" || version === "1.1" || version === "1.2") {
      return { ok: true, load: migrateLegacy(data, version, services) };
    }
    // missing version treated as unsupported unless clearly legacy without version
    if (version === undefined && Array.isArray(data.nodes)) {
      return { ok: true, load: migrateLegacy({ ...data, version: "1.0" }, "1.0", services) };
    }
    return { ok: false, error: `unknown version: ${String(version)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function workspaceToPrettyJSON(state: WorkspaceState, clockISO: string): string {
  return JSON.stringify(serializeWorkspaceV1_3(state, clockISO), null, 2);
}
