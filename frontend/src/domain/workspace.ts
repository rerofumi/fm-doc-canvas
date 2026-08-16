/** Domain types for Collaborative Workspace Foundation (F-1). */

export type WorkspaceId = string;
export type CanvasId = string;
export type NodeId = string;
export type RelationId = string;

export interface Provenance {
  origin:
    | "user"
    | "file-import"
    | "llm"
    | "migration"
    | "web"
    | "image"
    | "relation-batch"
    | "cluster-view";
  sourceNodeIds?: NodeId[];
  operation?: string;
  provider?: string;
  model?: string;
  createdAt?: string;
  sourceRevisions?: Record<NodeId, number>;
  url?: string;
  domain?: string;
  retrievedAt?: string;
  query?: string;
  contextProvider?: string;
  prompt?: string;
}

export interface NodeBase {
  id: NodeId;
  parentCanvasId: CanvasId;
  position: { x: number; y: number };
  order: number;
  width?: number;
  height?: number;
  revision: number;
  provenance?: Provenance;
  extensions?: Record<string, unknown>;
}

export interface TextBearingNode extends NodeBase {
  kind: "text";
  role: "text" | "artifact";
  content: string;
  summary: string;
  originalPrompt?: string;
  filename?: string;
  language: "markdown" | "text";
  charCount: number;
  wordCount: number;
  lastEditSummary?: string;
  lastEditedAt?: number;
}

export interface ImageNode extends NodeBase {
  kind: "image";
  src: string;
  alt?: string;
  prompt?: string;
  provider?: string;
  model?: string;
}

export interface FolderNode extends NodeBase {
  kind: "folder";
  childCanvasId: CanvasId;
  label: string;
}

export type WorkspaceNode = TextBearingNode | ImageNode | FolderNode;

export interface CanvasRecord {
  id: CanvasId;
  parentCanvasId?: CanvasId;
  folderNodeId?: NodeId;
  name: string;
  extensions?: Record<string, unknown>;
}

export type RelationKind =
  | "context"
  | "source"
  | "derived"
  | "supports"
  | "opposes"
  | "similar";

export interface RelationRecord {
  id: RelationId;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  kind: RelationKind;
  status: "accepted";
  reason?: string;
  provenance?: Provenance;
  presentation?: { sourceHandle?: string; targetHandle?: string };
  extensions?: Record<string, unknown>;
}

export interface WorkspaceDocument {
  workspaceId: WorkspaceId;
  rootCanvasId: CanvasId;
  canvases: Record<CanvasId, CanvasRecord>;
  nodes: Record<NodeId, WorkspaceNode>;
  relations: Record<RelationId, RelationRecord>;
  extensions?: Record<string, unknown>;
}

export type WorkspaceTargetRef =
  | { kind: "nodes"; nodeIds: NodeId[] }
  | {
      kind: "canvas";
      canvasId: CanvasId;
      expansion: "metadata-only" | "direct-members";
    };

export interface SelectionState {
  selectedNodeIds: NodeId[];
  activeNodeId?: NodeId;
  revision: number;
}

export interface DelegatedSessionRef {
  kind: "delegated-session";
  sessionId: string;
  executor: string;
  focusRef?: string;
  workingDirectoryRef?: string;
  sourceRevision: string;
  permissions: {
    readableNodeIds: NodeId[];
    workspaceWrite: "none" | "proposal-only";
    externalNetwork: "none" | "explicit";
  };
  limits: {
    maxRounds: number;
    maxRetries: number;
    maxDurationMs: number;
    maxCost?: number;
  };
  status: "proposed" | "running" | "stopped" | "completed" | "failed";
  provenance: Provenance;
}

export interface ProjectedContextItemRef {
  itemId: string;
  summary: string;
  sourceRefs: string[];
  inference: boolean;
  uncertainty?: string;
}

export interface ProjectedContextRef {
  kind: "projected-context";
  packetId: string;
  delegatedSessionId?: string;
  items: ProjectedContextItemRef[];
  provenance: Provenance;
  status: "candidate" | "adopted" | "rejected";
}

export interface ContextSelectionState {
  addedContextTargets: WorkspaceTargetRef[];
  explicitMutationTarget?: WorkspaceTargetRef;
  explicitRelationTargetNodeIds: NodeId[];
  includedRemoteRelationIds: RelationId[];
  candidateSeedNodeIds: NodeId[];
  excludedNodeIds: NodeId[];
  delegatedSessions: DelegatedSessionRef[];
  projectedContexts: ProjectedContextRef[];
  revision: number;
}

export interface FocusState {
  id: string;
  canvasId: CanvasId;
  target?:
    | { kind: "nodes"; nodeIds: NodeId[] }
    | { kind: "canvas"; canvasId: CanvasId };
  text?: string;
  source: "explicit" | "selection" | "dialogue";
}

export interface NavigationEntry {
  canvasId: CanvasId;
  viewport?: { x: number; y: number; zoom: number };
  highlightNodeId?: NodeId;
}

export interface AsyncRunState {
  runId: string;
  epoch: number;
  kind: "dialogue" | "direct";
  status: "active" | "cancelled" | "completed";
}

export interface WorkspaceRuntime {
  currentCanvasId: CanvasId;
  runtimeGeneration: string;
  commandSequence: number;
  scopeEpoch: number;
  selection: SelectionState;
  contextSelection: ContextSelectionState;
  focus: FocusState | null;
  navigationBackStack: NavigationEntry[];
  runEpochCounter: number;
  asyncRuns: Record<string, AsyncRunState>;
}

export interface WorkspaceState {
  document: WorkspaceDocument;
  runtime: WorkspaceRuntime;
}

export interface ValidatedWorkspaceLoad {
  document: WorkspaceDocument;
  restoredCurrentCanvasId: CanvasId;
}

export interface HistoryEntry {
  label: string;
  undo: WorkspaceCommand;
  redo: WorkspaceCommand;
  /** Ephemeral active Generated View snapshots for composite transactions. */
  viewSnapshot?: { before?: unknown; after?: unknown };
}

export type WorkspaceCommand =
  | { type: "createText"; role: "text" | "artifact"; input: CreateTextInput }
  | {
      type: "createDirectText";
      workspaceId: WorkspaceId;
      canvasId: CanvasId;
      runtimeGeneration: string;
      scopeEpoch: number;
      selectionRevision: number;
      role: "text" | "artifact";
      input: CreateTextInput;
    }
  | { type: "createImageRef"; input: CreateImageInput }
  | { type: "importTextFile"; result: ImportTextResult }
  | {
      type: "editTextContent";
      nodeId: NodeId;
      content: string;
      baseRevision: number;
    }
  | {
      type: "editTextMetadata";
      nodeId: NodeId;
      patch: Partial<TextMetadataPatch>;
    }
  | { type: "switchTextRole"; nodeId: NodeId; role: "text" | "artifact" }
  | { type: "createSubCanvas"; nodeIds: NodeId[]; label?: string }
  | { type: "dissolveSubCanvas"; canvasId: CanvasId }
  | {
      type: "moveFolderSubtree";
      folderNodeId: NodeId;
      destinationCanvasId: CanvasId;
      position: { x: number; y: number };
    }
  | { type: "renameSubCanvas"; canvasId: CanvasId; label: string }
  | {
      type: "moveNodes";
      nodeIds: NodeId[];
      destinationCanvasId: CanvasId;
      positions?: Record<NodeId, { x: number; y: number }>;
    }
  | {
      type: "moveNodePositions";
      changes: Array<{ nodeId: NodeId; position: { x: number; y: number } }>;
    }
  | { type: "resizeNode"; nodeId: NodeId; width: number; height: number }
  | { type: "deleteNodes"; nodeIds: NodeId[] }
  | { type: "addRelation"; relation: RelationRecord }
  | { type: "addRelations"; relations: RelationRecord[] }
  | {
      type: "updateRelation";
      id: RelationId;
      patch: Partial<
        Pick<RelationRecord, "kind" | "reason" | "presentation" | "provenance">
      >;
    }
  | { type: "reverseRelation"; id: RelationId }
  | { type: "removeRelation"; id: RelationId }
  | { type: "applyTransform"; input: TransformApplyInput }
  | { type: "applyImageVariant"; input: ApplyImageVariantInput }
  | { type: "promoteContextItems"; input: PromoteContextItemsInput }
  | { type: "setSelection"; state: SelectionState }
  | { type: "setFocus"; focus: FocusState | null }
  | { type: "addContextTarget"; target: WorkspaceTargetRef }
  | { type: "removeContextTarget"; target: WorkspaceTargetRef }
  /** @deprecated Retained for legacy fixture compatibility; resolver ignores it. */
  | { type: "setContextExcluded"; nodeId: NodeId; excluded: boolean }
  | { type: "setMutationTarget"; target?: WorkspaceTargetRef }
  | { type: "setRelationTargets"; nodeIds: NodeId[] }
  | {
      type: "setRemoteRelationIncluded";
      relationId: RelationId;
      included: boolean;
    }
  | { type: "setCandidateSeeds"; nodeIds: NodeId[] }
  | {
      type: "setExternalContextRefs";
      delegatedSessions: DelegatedSessionRef[];
      projectedContexts: ProjectedContextRef[];
    }
  | {
      type: "navigateCanvas";
      canvasId: CanvasId;
      viewport?: NavigationEntry["viewport"];
    }
  | { type: "navigateParent" }
  | { type: "navigateBack" }
  | { type: "startAsyncRun"; kind: "dialogue" | "direct"; runId: string }
  | { type: "cancelAsyncRun"; runId: string }
  | { type: "completeAsyncRun"; runId: string }
  | { type: "newWorkspace" }
  | { type: "clearCanvas" }
  | { type: "discardWorkspace" }
  | { type: "replaceWorkspaceAfterValidatedLoad"; load: ValidatedWorkspaceLoad }
  | { type: "undo" }
  | { type: "redo" }
  | {
      type: "restoreSnapshot";
      document: WorkspaceDocument;
      runtimePatch?: Partial<WorkspaceRuntime>;
      bumpContentRevisions?: NodeId[];
    };

export interface CreateTextInput {
  content?: string;
  summary?: string;
  filename?: string;
  language?: "markdown" | "text";
  position?: { x: number; y: number };
  originalPrompt?: string;
  provenance?: Provenance;
  width?: number;
  height?: number;
}

export interface CreateImageInput {
  src: string;
  alt?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  provenance?: Provenance;
}

export interface ImportTextResult {
  content: string;
  filename: string;
  position?: { x: number; y: number };
}

export interface TextMetadataPatch {
  summary?: string;
  filename?: string;
  language?: "markdown" | "text";
  lastEditSummary?: string;
  originalPrompt?: string;
}

export interface CommandResult {
  ok: boolean;
  state: WorkspaceState;
  error?: string;
  historyEntry?: HistoryEntry;
  cancelledRunIds?: string[];
  createdNodeId?: NodeId;
  createdCanvasId?: CanvasId;
  createdRelationIds?: RelationId[];
}

export interface PromoteContextItemsInput {
  packetId: string;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  selectedClaimIds: string[];
  selectedSourceIds: string[];
  acceptedRelations: Array<{
    claimId?: string;
    sourceId?: string;
    targetNodeId: NodeId;
    kind: "supports" | "opposes" | "similar";
    reason?: string;
  }>;
  packet: {
    packetId: string;
    query: string;
    retrievedAt: string;
    contextProvider: string;
    sources: Array<{
      sourceId: string;
      title: string;
      url: string;
      domain: string;
      snippet: string;
      retrievedAt: string;
    }>;
    claims: Array<{
      claimId: string;
      kind: string;
      text: string;
      sourceIds: string[];
    }>;
  };
}

export interface TransformApplyInput {
  operation: "summarize" | "compare" | "counterpoint";
  sourceNodeIds: NodeId[];
  sourceRevisions: Record<NodeId, number>;
  content: string;
  summary: string;
  reason?: string;
  position?: { x: number; y: number };
  suggestedRelations?: Array<{
    sourceNodeId: NodeId;
    targetNodeId?: NodeId;
    kind: Exclude<RelationKind, "context">;
    reason?: string;
  }>;
  provenance?: Provenance;
}

// ApplyImageVariantInput is the atomic command that places a generated image as
// a new Image Node on the Current Canvas, with a `derived` Relation to each
// explicit source and `origin=image` provenance. It never overwrites the source.
export interface ApplyImageVariantInput {
  src: string;
  alt?: string;
  prompt: string;
  provider?: string;
  model?: string;
  sourceNodeIds: NodeId[];
  sourceRevisions: Record<NodeId, number>;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  proposalId?: string;
  position?: { x: number; y: number };
}

export interface DomainServices {
  ids: { next(kind: string): string };
  clock: { now(): number; nowISO(): string };
  faultPlan?: { failOnceAt?: string };
  /** Mutable one-shot fault flags used by E2E only. */
  faultState?: { consumed: Record<string, boolean> };
}

export const emptyContextSelection = (): ContextSelectionState => ({
  addedContextTargets: [],
  explicitRelationTargetNodeIds: [],
  includedRemoteRelationIds: [],
  candidateSeedNodeIds: [],
  excludedNodeIds: [],
  delegatedSessions: [],
  projectedContexts: [],
  revision: 0,
});

export const emptySelection = (): SelectionState => ({
  selectedNodeIds: [],
  revision: 0,
});

export function getContentStats(content: string): {
  charCount: number;
  wordCount: number;
} {
  return {
    charCount: content.length,
    wordCount: content.trim() ? content.trim().split(/\s+/u).length : 0,
  };
}

export function createEmptyWorkspace(services: DomainServices): WorkspaceState {
  const workspaceId = services.ids.next("workspace");
  const rootCanvasId = services.ids.next("canvas");
  const runtimeGeneration = services.ids.next("generation");
  return {
    document: {
      workspaceId,
      rootCanvasId,
      canvases: {
        [rootCanvasId]: { id: rootCanvasId, name: "Workspace" },
      },
      nodes: {},
      relations: {},
    },
    runtime: {
      currentCanvasId: rootCanvasId,
      runtimeGeneration,
      commandSequence: 0,
      scopeEpoch: 0,
      selection: emptySelection(),
      contextSelection: emptyContextSelection(),
      focus: null,
      navigationBackStack: [],
      runEpochCounter: 0,
      asyncRuns: {},
    },
  };
}

export function cloneWorkspaceState(state: WorkspaceState): WorkspaceState {
  return structuredClone(state);
}

export function nodesOnCanvas(
  document: WorkspaceDocument,
  canvasId: CanvasId,
): WorkspaceNode[] {
  return Object.values(document.nodes)
    .filter((n) => n.parentCanvasId === canvasId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function isTextBearing(node: WorkspaceNode): node is TextBearingNode {
  return node.kind === "text";
}

export function isFolder(node: WorkspaceNode): node is FolderNode {
  return node.kind === "folder";
}

export function sanitizeFilename(input: string | undefined): string {
  let name = (input ?? "").trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  name = name.replace(/^\.+/, "").replace(/\s+/g, " ");
  if (!name) name = "untitled.md";
  if (!/\.[A-Za-z0-9]+$/.test(name)) name = `${name}.md`;
  return name.slice(0, 180);
}

export function suggestFilenameFromText(
  content: string,
  summary: string,
): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const base = heading || summary || "untitled";
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitizeFilename(slug || "untitled");
}
