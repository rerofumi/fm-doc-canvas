import { create } from "zustand";
import {
  type Connection,
  type EdgeChange,
  type NodeChange,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
} from "@xyflow/react";
import type {
  AppConfig,
  AppEdge,
  AppNode,
  AppState,
  ArtifactNodeData,
  ImageNodeData,
  ImportFileResult,
  TextNodeData,
} from "../types";
import type { ChatMessage, ChatToolProposal } from "../types/chat";
import {
  applyCommand,
  computeSubCanvasGroupPositions,
  createHistory,
  createRelation,
  type HistoryState,
} from "../domain/workspaceCommands";
import {
  type ApplyImageVariantInput,
  createEmptyWorkspace,
  type DomainServices,
  isFolder,
  isTextBearing,
  nodesOnCanvas,
  type WorkspaceState,
} from "../domain/workspace";
import { breadcrumbPath, projectCurrentCanvas } from "../domain/projectToFlow";
import {
  loadWorkspaceJSON,
  workspaceToPrettyJSON,
} from "../domain/workspacePersistence";
import { resolveContext } from "../domain/contextResolver";
import { buildNextActionRequest, NEXT_ACTION_MAPPINGS, normalizeNextActionError, normalizeNextActionProposal, revalidateNextActionScope, validateEditedAction, type NextActionProposalSet, type NextActionRequest } from "../domain/orchestration";
import {
  createProposalFromLegacyTool,
  createTransformProposal,
  createRelationProposal,
  createImageVariantProposal,
  createRelationBatchProposal,
  createGeneratedViewProposal,
  decideAndApplyProposal,
  applyDirectTransform,
  type ProposalRecord,
} from "../domain/proposal";
import {
  type ClusterViewDraft,
  type GeneratedViewRecord,
  type RelationBatchItem,
  MAX_CLUSTER_NODES,
  normalizeClusterViewDraft,
  normalizeRelationBatchDraft,
  pruneEmptyClusters,
  removeCluster,
  revalidateDirectSuggestion,
} from "../domain/generatedView";
import {
  buildTransformRequest,
  normalizeTransformDraft,
  revalidateDirectTransform,
  validateTransformSelection,
} from "../domain/transform";
import type { DirectTransformReceipt } from "../types/chat";
import {
  type ContextPacket,
  type WebSearchEntryRoute,
  type WebSearchRequest,
  hintExcerpt,
  incomingPacketRejection,
  resolveWebSearchQuery,
} from "../domain/contextPacket";
import {
  createProductionClock,
  createProductionIds,
  type RuntimeEnvironment,
} from "../runtime/runtimeEnvironment";
import * as GeneratedBackend from "../../wailsjs/go/main/App";
import { useChatStore } from "./useChatStore";
import type { AssistantScopeSnapshot } from "./useChatStore";

const initialConfig: AppConfig = {
  llm: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "",
  },
  imageGen: {
    provider: "openrouter",
    downloadPath: "Image/",
    openrouter: {
      baseURL: "https://openrouter.ai/api/v1",
      model: "sourceful/riverflow-v2-fast",
      apiKey: "",
    },
    openai: {
      baseURL: "https://api.openai.com/v1",
      model: "gpt-image-1.5",
      apiKey: "",
    },
    google: {
      model: "gemini-2.5-flash-image",
      apiKey: "",
    },
    xai: {
      model: "grok-imagine-image",
      apiKey: "",
    },
  },
  generation: {
    summaryMaxChars: 100,
  },
  webSearch: {
    provider: "ollama",
    ollama: { apiKey: "" },
    kagi: { apiKey: "" },
    brave: { apiKey: "" },
  },
};

type BackendLike = typeof GeneratedBackend;

let runtimeEnv: RuntimeEnvironment = {
  mode: "production",
  ids: createProductionIds(),
  clock: createProductionClock(),
  backend: GeneratedBackend as unknown as RuntimeEnvironment["backend"],
  faultState: { consumed: {} },
};

function services(): DomainServices {
  return {
    ids: runtimeEnv.ids,
    clock: runtimeEnv.clock,
    faultPlan: runtimeEnv.faultPlan,
    faultState: runtimeEnv.faultState,
  };
}

function backend(): BackendLike {
  return runtimeEnv.backend as unknown as BackendLike;
}

export function configureAppRuntime(env: RuntimeEnvironment) {
  runtimeEnv = env;
}

interface StoreExtras {
  workspace: WorkspaceState;
  history: HistoryState;
  lastError: string | null;
  boundaryAggregates: ReturnType<
    typeof projectCurrentCanvas
  >["boundaryAggregates"];
  dispatch: (command: Parameters<typeof applyCommand>[1]) => boolean;
  newWorkspace: () => void;
  discardWorkspace: () => void;
  switchTextRole: (nodeId: string, role: "text" | "artifact") => void;
  createSubCanvas: (nodeIds: string[], label?: string) => void;
  renameSubCanvas: (canvasId: string, label: string) => boolean;
  dissolveSubCanvas: (canvasId: string) => boolean;
  moveNodesToParent: (nodeIds: string[]) => boolean;
  createDirectText: (input: {
    content: string;
    summary?: string;
    originalPrompt: string;
    position?: { x: number; y: number };
    scope: AssistantScopeSnapshot;
  }) => { ok: boolean; nodeId?: string; error?: string };
  navigateCanvas: (canvasId: string) => void;
  navigateParent: () => void;
  navigateBack: () => void;
  undo: () => void;
  redo: () => void;
  getBreadcrumb: () => Array<{ canvasId: string; name: string }>;
  resolveSharedContext: (
    mode: "dialogue" | "direct",
    operation: Parameters<typeof resolveContext>[0]["operation"],
  ) => ReturnType<typeof resolveContext>;
  /** @deprecated Context exclusions are no longer honored by the resolver. */
  setContextExcluded: (nodeId: string, excluded: boolean) => void;
  useCanvasAsContext: () => void;
  runDirectTransform: (
    operation: "summarize" | "compare" | "counterpoint",
    sourceNodeIds?: string[],
  ) => Promise<boolean>;
  orchestrationStatus: "idle" | "pending" | "ready" | "cancelled" | "stale" | "error" | "dispatching" | "dispatched";
  orchestrationRequest: NextActionRequest | null;
  nextActionProposal: NextActionProposalSet | null;
  orchestrationReceipt: { kind: string; targetNodeIds: string[]; resultSurface: string } | null;
  requestNextActions: (messages?: ChatMessage[]) => Promise<boolean>;
  cancelNextActionRequest: () => void;
  dismissNextActions: () => void;
  rejectNextAction: (actionId: string) => void;
  dispatchNextAction: (actionId: string, edits?: { targetNodeIds?: string[]; query?: string }) => Promise<boolean>;
  applyDirectImageVariant: (input: {
    src: string;
    alt?: string;
    prompt: string;
    provider?: string;
    model?: string;
    sourceNodeIds: string[];
    sourceRevisions: Record<string, number>;
    position?: { x: number; y: number };
    scope?: AssistantScopeSnapshot;
  }) => boolean;
  lastDirectReceipt: DirectTransformReceipt | null;
  activePacket: ContextPacket | null;
  lastSearchRequest: WebSearchRequest | null;
  lastOpenedURL: string | null;
  lastSearchReceipt: {
    entryRoute: WebSearchEntryRoute;
    packet: ContextPacket;
  } | null;
  isWebSearchPending: boolean;
  runWebSearch: (
    query: string,
    options?: { entryRoute?: WebSearchEntryRoute; knownUrls?: string[] },
  ) => Promise<boolean>;
  applyIncomingPacket: (
    packet: ContextPacket,
    entryRoute: WebSearchEntryRoute,
  ) => boolean;
  promoteActivePacket: (selection: {
    selectedClaimIds: string[];
    selectedSourceIds: string[];
    acceptedRelations: NonNullable<ContextPacket["suggestedRelations"]>;
  }) => boolean;
  dismissPacket: () => void;
  openExternalURL: (url: string) => Promise<boolean>;
  activeGeneratedView: GeneratedViewRecord | null;
  lastSuggestReceipt: {
    operation: "relations" | "clusters";
    status: "pending" | "error" | "done";
    error?: string;
  } | null;
  pendingDirectProposal: ProposalRecord | null;
  runDirectSuggestRelations: (sourceNodeIds?: string[]) => Promise<boolean>;
  runDirectSuggestClusters: (sourceNodeIds?: string[]) => Promise<boolean>;
  closeGeneratedView: () => void;
  setActiveGeneratedView: (view: GeneratedViewRecord | null) => void;
  convertClusterToSubCanvas: (clusterId: string, label?: string) => boolean;
  decideDirectProposal: (
    decision: "accept" | "modify" | "reject",
    modified?: { relations?: RelationBatchItem[]; view?: ClusterViewDraft },
  ) => {
    status: "applied" | "rejected" | "conflict" | "error";
    error?: string;
  };
  dismissDirectProposal: () => void;
}

export type FullAppState = AppState & StoreExtras;

function projectInto(
  set: (partial: Partial<FullAppState>) => void,
  workspace: WorkspaceState,
  history: HistoryState,
  extra: Partial<FullAppState> = {},
) {
  const projected = projectCurrentCanvas(workspace);
  set({
    workspace,
    history,
    nodes: projected.nodes,
    edges: projected.edges,
    boundaryAggregates: projected.boundaryAggregates,
    canvasId: workspace.document.workspaceId,
    activeNodeId: workspace.runtime.selection.activeNodeId ?? null,
    ...extra,
  });
}

export type ProposalModifyPatch =
  | string
  | {
      content?: string;
      reason?: string;
      suggestedRelations?: NonNullable<
        ChatToolProposal["transform"]
      >["suggestedRelations"];
      relation?: NonNullable<ChatToolProposal["relation"]>;
      relations?: RelationBatchItem[];
      view?: ClusterViewDraft;
    };

function normalizeModifyPatch(modified?: ProposalModifyPatch): {
  content?: string;
  reason?: string;
  suggestedRelations?: NonNullable<
    ChatToolProposal["transform"]
  >["suggestedRelations"];
  relation?: NonNullable<ChatToolProposal["relation"]>;
  relations?: RelationBatchItem[];
  view?: ClusterViewDraft;
} {
  if (modified == null) return {};
  if (typeof modified === "string") return { content: modified };
  return modified;
}

function createToolProposalDecider(
  get: () => FullAppState,
  set: (partial: Partial<FullAppState>) => void,
) {
  return (
    proposal: ChatToolProposal,
    decision: "accept" | "modify" | "reject" | "cancel",
    requestedRunId?: string,
    modified?: ProposalModifyPatch,
  ) => {
    const ws = get().workspace;
    const activeRunEntry = requestedRunId
      ? ws.runtime.asyncRuns[requestedRunId]
      : Object.values(ws.runtime.asyncRuns).find((r) => r.status === "active");
    const activeRun = requestedRunId
      ? activeRunEntry
        ? {
            runId: activeRunEntry.runId,
            epoch: activeRunEntry.epoch,
            status: activeRunEntry.status,
          }
        : { runId: requestedRunId, epoch: -1, status: "missing" }
      : activeRunEntry
        ? {
            runId: activeRunEntry.runId,
            epoch: activeRunEntry.epoch,
            status: activeRunEntry.status,
          }
        : undefined;
    const runId = requestedRunId || activeRunEntry?.runId || "legacy";
    const runEpoch = proposal.runEpoch ?? activeRunEntry?.epoch ?? 0;
    const modifyPatch = normalizeModifyPatch(modified);
    let content = proposal.proposed;
    if (
      proposal.operation === "edit" &&
      proposal.searchText != null &&
      proposal.replacement != null
    ) {
      const targetId = proposal.targetNodeId || proposal.nodeId;
      const node = targetId ? ws.document.nodes[targetId] : undefined;
      if (node && isTextBearing(node)) {
        content = node.content.replace(
          proposal.searchText,
          proposal.replacement,
        );
      }
    }
    if (decision === "modify" && modifyPatch.content !== undefined) {
      content = modifyPatch.content;
    }
    if (proposal.operation === "transform" && proposal.transform) {
      const transform = {
        ...proposal.transform,
        provenance: {
          origin: "llm" as const,
          sourceNodeIds: proposal.transform.sourceNodeIds,
          operation: proposal.transform.operation,
        },
      };
      const record = createTransformProposal({
        proposalId: proposal.toolCallId,
        providerToolCallId: proposal.toolCallId,
        runId,
        runEpoch,
        workspaceId: proposal.workspaceId || ws.document.workspaceId,
        canvasId: proposal.canvasId || ws.runtime.currentCanvasId,
        runtimeGeneration:
          proposal.runtimeGeneration || ws.runtime.runtimeGeneration,
        scopeEpoch: proposal.scopeEpoch ?? ws.runtime.scopeEpoch,
        transform,
      });
      const result = decideAndApplyProposal(
        ws,
        record,
        {
          proposalId: record.proposalId,
          decisionId: `decision-${proposal.toolCallId}-${decision}`,
          decision,
          modifiedContent:
            decision === "modify"
              ? (modifyPatch.content ?? proposal.transform.content)
              : undefined,
          modifiedReason:
            decision === "modify" ? modifyPatch.reason : undefined,
          modifiedSuggestedRelations:
            decision === "modify" ? modifyPatch.suggestedRelations : undefined,
        },
        services(),
        get().history,
        activeRun,
      );
      if (result.status === "applied" && result.history) {
        projectInto(set, result.state, result.history, { lastError: null });
        return { status: "applied" as const };
      }
      if (result.status === "rejected") return { status: "rejected" as const };
      if (result.status === "conflict") return { status: "conflict" as const };
      if (result.status === "stale")
        return { status: "error" as const, error: "stale proposal" };
      if (result.status === "cancelled")
        return { status: "error" as const, error: result.error || "cancelled" };
      return { status: "error" as const, error: result.error || result.status };
    }
    if (proposal.operation === "relation" && proposal.relation) {
      const relation = modifyPatch.relation
        ? { ...proposal.relation, ...modifyPatch.relation }
        : proposal.relation;
      const record = createRelationProposal({
        proposalId: proposal.toolCallId,
        providerToolCallId: proposal.toolCallId,
        runId,
        runEpoch,
        workspaceId: proposal.workspaceId || ws.document.workspaceId,
        canvasId: proposal.canvasId || ws.runtime.currentCanvasId,
        runtimeGeneration:
          proposal.runtimeGeneration || ws.runtime.runtimeGeneration,
        scopeEpoch: proposal.scopeEpoch ?? ws.runtime.scopeEpoch,
        relation,
      });
      const result = decideAndApplyProposal(
        ws,
        record,
        {
          proposalId: record.proposalId,
          decisionId: `decision-${proposal.toolCallId}-${decision}`,
          decision,
          modifiedRelation: decision === "modify" ? relation : undefined,
        },
        services(),
        get().history,
        activeRun,
      );
      if (result.status === "applied" && result.history) {
        projectInto(set, result.state, result.history, { lastError: null });
        return { status: "applied" as const };
      }
      if (result.status === "rejected") return { status: "rejected" as const };
      if (result.status === "conflict") return { status: "conflict" as const };
      if (result.status === "stale")
        return { status: "error" as const, error: "stale proposal" };
      if (result.status === "cancelled")
        return { status: "error" as const, error: result.error || "cancelled" };
      return { status: "error" as const, error: result.error || result.status };
    }
    if (proposal.operation === "image-variant" && proposal.imageVariant) {
      const variant = proposal.imageVariant;
      const record = createImageVariantProposal({
        proposalId: variant.proposalId || proposal.toolCallId,
        providerToolCallId: proposal.toolCallId,
        runId,
        runEpoch,
        workspaceId: variant.workspaceId || ws.document.workspaceId,
        canvasId: variant.canvasId || ws.runtime.currentCanvasId,
        runtimeGeneration:
          variant.runtimeGeneration || ws.runtime.runtimeGeneration,
        scopeEpoch: variant.scopeEpoch ?? ws.runtime.scopeEpoch,
        variant: {
          src: variant.src,
          alt: variant.alt,
          prompt: variant.prompt,
          provider: variant.provider,
          model: variant.model,
          sourceNodeIds: variant.sourceNodeIds,
          sourceRevisions: variant.sourceRevisions,
        },
      });
      const result = decideAndApplyProposal(
        ws,
        record,
        {
          proposalId: record.proposalId,
          decisionId: `decision-${proposal.toolCallId}-${decision}`,
          decision,
        },
        services(),
        get().history,
        activeRun,
      );
      if (result.status === "applied" && result.history) {
        projectInto(set, result.state, result.history, { lastError: null });
        return { status: "applied" as const };
      }
      if (result.status === "rejected") return { status: "rejected" as const };
      if (result.status === "conflict") return { status: "conflict" as const };
      if (result.status === "stale")
        return { status: "error" as const, error: "stale proposal" };
      if (result.status === "cancelled")
        return { status: "error" as const, error: result.error || "cancelled" };
      return { status: "error" as const, error: result.error || result.status };
    }
    if (proposal.operation === "relation-batch" && proposal.relationBatch) {
      const record = createRelationBatchProposal({
        proposalId: proposal.toolCallId,
        providerToolCallId: proposal.toolCallId,
        runId,
        runEpoch,
        workspaceId: proposal.workspaceId || ws.document.workspaceId,
        canvasId: proposal.canvasId || ws.runtime.currentCanvasId,
        runtimeGeneration:
          proposal.runtimeGeneration || ws.runtime.runtimeGeneration,
        scopeEpoch: proposal.scopeEpoch ?? ws.runtime.scopeEpoch,
        relations: proposal.relationBatch.relations,
        sourceRevisions: proposal.relationBatch.sourceRevisions,
        imageInputModes: proposal.relationBatch.imageInputModes,
        provenance: {
          origin: "relation-batch",
          operation: "propose_relation_batch",
        },
      });
      const result = decideAndApplyProposal(
        ws,
        record,
        {
          proposalId: record.proposalId,
          decisionId: `decision-${proposal.toolCallId}-${decision}`,
          decision,
          modifiedRelations:
            decision === "modify" ? modifyPatch.relations : undefined,
        },
        services(),
        get().history,
        activeRun,
      );
      if (result.status === "applied" && result.history) {
        projectInto(set, result.state, result.history, { lastError: null });
        return { status: "applied" as const };
      }
      if (result.status === "rejected") return { status: "rejected" as const };
      if (result.status === "conflict") return { status: "conflict" as const };
      if (result.status === "stale")
        return { status: "error" as const, error: "stale proposal" };
      if (result.status === "cancelled")
        return { status: "error" as const, error: result.error || "cancelled" };
      return { status: "error" as const, error: result.error || result.status };
    }
    if (proposal.operation === "generated-view" && proposal.generatedView) {
      const gv = proposal.generatedView;
      const normalized = normalizeClusterViewDraft(
        {
          label: gv.viewLabel,
          clusters: gv.clusters.map((c) => ({
            label: c.label,
            reason: c.reason,
            nodeIds: c.nodeIds,
          })),
          ungroupedNodeIds: gv.ungroupedNodeIds,
          sourceRevisions: gv.sourceRevisions,
          imageInputModes: gv.imageInputModes,
          provenance: { origin: "cluster-view" },
        },
        ws,
        services(),
      );
      if (!normalized.ok) {
        return { status: "error" as const, error: normalized.error };
      }
      const view =
        decision === "modify" && modifyPatch.view
          ? modifyPatch.view
          : normalized.value;
      const record = createGeneratedViewProposal({
        proposalId: proposal.toolCallId,
        providerToolCallId: proposal.toolCallId,
        runId,
        runEpoch,
        workspaceId: proposal.workspaceId || ws.document.workspaceId,
        canvasId: proposal.canvasId || ws.runtime.currentCanvasId,
        runtimeGeneration:
          proposal.runtimeGeneration || ws.runtime.runtimeGeneration,
        scopeEpoch: proposal.scopeEpoch ?? ws.runtime.scopeEpoch,
        view,
        provenance: { origin: "cluster-view" },
        source: "dialogue",
      });
      const result = decideAndApplyProposal(
        ws,
        record,
        {
          proposalId: record.proposalId,
          decisionId: `decision-${proposal.toolCallId}-${decision}`,
          decision,
          modifiedView: decision === "modify" ? view : undefined,
        },
        services(),
        get().history,
        activeRun,
      );
      if (result.status === "applied") {
        if (result.generatedView) {
          set({ activeGeneratedView: result.generatedView, lastError: null });
        }
        return { status: "applied" as const };
      }
      if (result.status === "rejected") return { status: "rejected" as const };
      if (result.status === "conflict") return { status: "conflict" as const };
      if (result.status === "stale")
        return { status: "error" as const, error: "stale proposal" };
      if (result.status === "cancelled")
        return { status: "error" as const, error: result.error || "cancelled" };
      return { status: "error" as const, error: result.error || result.status };
    }
    if (
      proposal.operation !== "create" &&
      proposal.operation !== "replace" &&
      proposal.operation !== "edit"
    ) {
      return {
        status: "error" as const,
        error: "unsupported proposal operation",
      };
    }
    const record = createProposalFromLegacyTool({
      toolCallId: proposal.toolCallId,
      runId,
      runEpoch,
      workspaceId: proposal.workspaceId || ws.document.workspaceId,
      canvasId: proposal.canvasId || ws.runtime.currentCanvasId,
      runtimeGeneration:
        proposal.runtimeGeneration || ws.runtime.runtimeGeneration,
      scopeEpoch: proposal.scopeEpoch ?? ws.runtime.scopeEpoch,
      operation: proposal.operation,
      targetNodeId: proposal.targetNodeId || proposal.nodeId,
      baseRevision: proposal.baseRevision,
      proposed: content,
      filename: proposal.filename,
      lastEditSummary: proposal.lastEditSummary,
    });
    const result = decideAndApplyProposal(
      ws,
      record,
      {
        proposalId: record.proposalId,
        decisionId: `decision-${proposal.toolCallId}-${decision}`,
        decision,
        modifiedContent: content,
      },
      services(),
      get().history,
      activeRun,
    );
    if (result.status === "applied" && result.history) {
      projectInto(set, result.state, result.history, { lastError: null });
      return { status: "applied" as const };
    }
    if (result.status === "rejected") return { status: "rejected" as const };
    if (result.status === "conflict") return { status: "conflict" as const };
    if (result.status === "stale") {
      return { status: "error" as const, error: "stale proposal" };
    }
    if (result.status === "cancelled") {
      return { status: "error" as const, error: result.error || "cancelled" };
    }
    return {
      status: "error" as const,
      error: result.error || get().lastError || "failed",
    };
  };
}

const mergeWebSearchConfig = (
  webSearch: any = {},
): NonNullable<AppConfig["webSearch"]> => ({
  provider:
    webSearch.provider === "kagi" ||
    webSearch.provider === "brave" ||
    webSearch.provider === "ollama"
      ? webSearch.provider
      : "ollama",
  ollama: { apiKey: "", ...(webSearch.ollama || {}) },
  kagi: { apiKey: "", ...(webSearch.kagi || {}) },
  brave: { apiKey: "", ...(webSearch.brave || {}) },
});

const mergeImageGenConfig = (imageGen: any = {}): AppConfig["imageGen"] => {
  const provider = imageGen.provider || initialConfig.imageGen.provider;
  const downloadPath =
    imageGen.downloadPath || initialConfig.imageGen.downloadPath;
  const migrated: AppConfig["imageGen"] = {
    ...initialConfig.imageGen,
    ...imageGen,
    provider,
    downloadPath,
    openrouter: {
      ...initialConfig.imageGen.openrouter!,
      ...(imageGen.openrouter || {}),
    },
    openai: { ...initialConfig.imageGen.openai!, ...(imageGen.openai || {}) },
    google: { ...initialConfig.imageGen.google!, ...(imageGen.google || {}) },
    xai: { ...initialConfig.imageGen.xai!, ...(imageGen.xai || {}) },
  };
  delete (migrated as any).baseURL;
  delete (migrated as any).model;
  delete (migrated as any).apiKey;
  return migrated;
};

function directSuggestTargets(
  state: WorkspaceState,
  maxNodes: number,
  requestedNodeIds?: string[],
): { nodeIds: string[] } | { error: string } {
  const current = state.runtime.currentCanvasId;
  const requested = requestedNodeIds ?? state.runtime.selection.selectedNodeIds;
  const selected = requested.filter((id) => {
    const node = state.document.nodes[id];
    return !!node && node.parentCanvasId === current && !isFolder(node);
  });
  const ids =
    selected.length >= 2
      ? selected
      : nodesOnCanvas(state.document, current)
          .filter((node) => !isFolder(node))
          .map((node) => node.id);
  if (ids.length < 2) return { error: "suggest-requires-2-nodes" };
  if (maxNodes > 0 && ids.length > maxNodes)
    return { error: "suggest-node-cap-exceeded" };
  return { nodeIds: [...new Set(ids)] };
}

function buildDirectSuggestSource(
  state: WorkspaceState,
  operation: "relate" | "group",
  requestedNodeIds?: string[],
):
  | { error: string }
  | {
      nodeIds: string[];
      sourceNodes: Array<{
        id: string;
        type: string;
        revision: number;
        filename?: string;
        markdown?: string;
        imageRef?: string;
        prompt?: string;
        imageIncluded?: boolean;
      }>;
      sourceRevisions: Record<string, number>;
      imageInputModes: Record<string, "vision" | "metadata-only">;
      contextDigest: string;
    } {
  const envelope = resolveContext({
    document: state.document,
    runtime: state.runtime,
    mode: "direct",
    operation,
  });
  const maxNodes = operation === "group" ? MAX_CLUSTER_NODES : 0;
  const target = directSuggestTargets(state, maxNodes, requestedNodeIds);
  if ("error" in target) return { error: target.error };
  const nodeIds = target.nodeIds;
  const visionBinaryIds = new Set(
    envelope.payloadItems
      .filter(
        (
          p,
        ): p is {
          kind: "image-binary";
          nodeId: string;
          destination: "llm" | "image-provider";
        } => p.kind === "image-binary" && p.destination === "llm",
      )
      .map((p) => p.nodeId),
  );
  const sourceNodes = nodeIds.map((id) => {
    const node = state.document.nodes[id];
    if (isTextBearing(node)) {
      return {
        id,
        type: node.role === "artifact" ? "artifact" : "text",
        revision: node.revision,
        markdown: node.content,
        filename: node.filename,
      };
    }
    if (node.kind === "image") {
      return {
        id,
        type: "image",
        revision: node.revision,
        imageRef: node.src,
        prompt: node.prompt || node.alt || "",
        imageIncluded: visionBinaryIds.has(id),
      };
    }
    return { id, type: "text", revision: node.revision, markdown: "" };
  });
  const sourceRevisions: Record<string, number> = {};
  for (const id of nodeIds)
    sourceRevisions[id] = state.document.nodes[id].revision;
  const imageInputModes: Record<string, "vision" | "metadata-only"> = {};
  for (const node of sourceNodes) {
    if (node.type === "image")
      imageInputModes[node.id] = node.imageIncluded
        ? "vision"
        : "metadata-only";
  }
  return {
    nodeIds,
    sourceNodes,
    sourceRevisions,
    imageInputModes,
    contextDigest: envelope.contextDigest,
  };
}

function pruneViewForDeletedNodes(
  view: GeneratedViewRecord | null,
  deletedIds: string[],
): GeneratedViewRecord | null {
  if (!view) return null;
  const deleted = new Set(deletedIds);
  const next: GeneratedViewRecord = {
    ...view,
    clusters: view.clusters.map((c) => ({
      ...c,
      nodeIds: c.nodeIds.filter((id) => !deleted.has(id)),
    })),
    ungroupedNodeIds: view.ungroupedNodeIds.filter((id) => !deleted.has(id)),
  };
  const pruned = pruneEmptyClusters(next);
  return pruned.clusters.length === 0 ? null : pruned;
}

function createInitialWorkspace() {
  return createEmptyWorkspace(services());
}

export const useAppStore = create<FullAppState>((set, get) => {
  const initialWorkspace = createInitialWorkspace();
  const initialHistory = createHistory();
  const initialProjection = projectCurrentCanvas(initialWorkspace);

  const dispatch = (command: Parameters<typeof applyCommand>[1]): boolean => {
    const { workspace, history } = get();
    const result = applyCommand(workspace, command, services(), history);
    if (!result.ok) {
      set({ lastError: result.error || "command failed" });
      return false;
    }
    projectInto(set, result.state, result.history || history, {
      lastError: null,
    });
    if (command.type === "clearCanvas") {
      // Clear removes the current canvas' node identity surface.  Drop all
      // store-level proposals/receipts that may still reference those nodes;
      // the domain scope bump above makes any late provider result stale.
      set({
        activeGeneratedView: null,
        pendingDirectProposal: null,
        lastSuggestReceipt: null,
        lastDirectReceipt: null,
        activePacket: null,
        lastSearchRequest: null,
        lastSearchReceipt: null,
        isWebSearchPending: false,
        orchestrationStatus: "idle",
        orchestrationRequest: null,
        nextActionProposal: null,
        orchestrationReceipt: null,
        isEditorOpen: false,
        activeNodeId: null,
      });
    }
    // Domain mutations invalidate active dialogue runs.  Propagate that
    // cancellation through both local chat correlation and the backend so a
    // late stream cannot keep appending after Undo/navigation/dissolve.
    for (const runId of result.cancelledRunIds ?? []) {
      const run = workspace.runtime.asyncRuns[runId];
      if (run?.kind !== "dialogue") continue;
      const chat = useChatStore.getState();
      for (const [sessionId, active] of Object.entries(chat.activeRuns)) {
        if (active.runId !== runId) continue;
        chat.replaceMessage(sessionId, active.assistantMessageId, {
          content: "キャンセルしました。",
          status: "cancelled",
        });
        chat.cancelRun(sessionId);
      }
      const cancelChat = (backend() as any).CancelChat;
      if (typeof cancelChat === "function") {
        void Promise.resolve(cancelChat(runId)).catch((error) =>
          console.warn("Failed to cancel chat run after workspace mutation", error),
        );
      }
    }
    return true;
  };

  const decideToolProposal = createToolProposalDecider(get, set);

  return {
    workspace: initialWorkspace,
    history: initialHistory,
    lastError: null,
    lastDirectReceipt: null,
    activePacket: null,
    lastSearchRequest: null,
    lastOpenedURL: null,
    lastSearchReceipt: null,
    isWebSearchPending: false,
    activeGeneratedView: null,
    lastSuggestReceipt: null,
    pendingDirectProposal: null,
    orchestrationStatus: "idle",
    orchestrationRequest: null,
    nextActionProposal: null,
    orchestrationReceipt: null,
    boundaryAggregates: initialProjection.boundaryAggregates,
    nodes: initialProjection.nodes,
    edges: initialProjection.edges,
    canvasId: initialWorkspace.document.workspaceId,
    isEditorOpen: false,
    isSettingsOpen: false,
    activeNodeId: null,
    config: initialConfig,
    promptInput: "",

    dispatch,

    newWorkspace: () => {
      dispatch({ type: "newWorkspace" });
      set({
        isEditorOpen: false,
        activePacket: null,
        lastSearchReceipt: null,
        lastSearchRequest: null,
        activeGeneratedView: null,
        pendingDirectProposal: null,
        lastSuggestReceipt: null,
        orchestrationStatus: "idle",
        orchestrationRequest: null,
        nextActionProposal: null,
        orchestrationReceipt: null,
      });
    },
    discardWorkspace: () => {
      dispatch({ type: "discardWorkspace" });
      set({
        isEditorOpen: false,
        activePacket: null,
        lastSearchReceipt: null,
        lastSearchRequest: null,
        activeGeneratedView: null,
        pendingDirectProposal: null,
        lastSuggestReceipt: null,
        orchestrationStatus: "idle",
        orchestrationRequest: null,
        nextActionProposal: null,
        orchestrationReceipt: null,
      });
    },
    switchTextRole: (nodeId, role) => {
      dispatch({ type: "switchTextRole", nodeId, role });
    },
    createSubCanvas: (nodeIds, label) => {
      dispatch({ type: "createSubCanvas", nodeIds, label });
    },
    renameSubCanvas: (canvasId, label) => {
      const normalized = label.trim();
      if (!normalized) {
        set({ lastError: "SubCanvas name cannot be empty" });
        return false;
      }
      return dispatch({ type: "renameSubCanvas", canvasId, label: normalized });
    },
    dissolveSubCanvas: (canvasId) => dispatch({ type: "dissolveSubCanvas", canvasId }),
    moveNodesToParent: (nodeIds) => {
      const state = get();
      const currentCanvas = state.workspace.document.canvases[
        state.workspace.runtime.currentCanvasId
      ];
      if (!currentCanvas?.parentCanvasId || !currentCanvas.folderNodeId) {
        set({ lastError: "Current Canvas has no parent" });
        return false;
      }
      const uniqueIds = [...new Set(nodeIds)].filter((id) => {
        const node = state.workspace.document.nodes[id];
        return node?.parentCanvasId === currentCanvas.id;
      });
      if (!uniqueIds.length) {
        set({ lastError: "No nodes to move" });
        return false;
      }
      const anchor = state.workspace.document.nodes[currentCanvas.folderNodeId];
      if (!anchor || anchor.kind !== "folder") {
        set({ lastError: "Parent FolderNode is missing" });
        return false;
      }
      const members = uniqueIds
        .map((id) => state.workspace.document.nodes[id])
        .filter((node): node is NonNullable<typeof node> => Boolean(node));
      // The parent FolderNode anchor is an existing bounding box too.  Keep
      // it in the collision set so the lifted group never overlaps the
      // visible anchor itself.
      const existing = Object.values(state.workspace.document.nodes).filter(
        (node) =>
          node.parentCanvasId === currentCanvas.parentCanvasId &&
          !uniqueIds.includes(node.id),
      );
      const positions = computeSubCanvasGroupPositions(members, existing, anchor.position);
      const ok = dispatch({
        type: "moveNodes",
        nodeIds: uniqueIds,
        destinationCanvasId: currentCanvas.parentCanvasId,
        positions,
      });
      // Success is represented by CanvasArea's notification/toast.  Do not
      // put success text in lastError: that state renders the red error
      // banner and must remain reserved for failures.
      return ok;
    },
    createDirectText: (input) => {
      const current = get().workspace;
      const scope = input.scope;
      if (
        current.document.workspaceId !== scope.workspaceId ||
        current.runtime.currentCanvasId !== scope.canvasId ||
        current.runtime.runtimeGeneration !== scope.runtimeGeneration ||
        current.runtime.scopeEpoch !== scope.scopeEpoch ||
        current.runtime.selection.revision !== scope.selectionRevision
      ) {
        return { ok: false, error: "direct-text-stale" };
      }
      const result = applyCommand(current, {
        type: "createDirectText",
        canvasId: scope.canvasId,
        workspaceId: scope.workspaceId,
        runtimeGeneration: scope.runtimeGeneration,
        scopeEpoch: scope.scopeEpoch,
        selectionRevision: scope.selectionRevision,
        role: "text",
        input: {
          content: input.content,
          summary: input.summary,
          originalPrompt: input.originalPrompt,
          position: input.position,
          provenance: { origin: "llm", sourceNodeIds: [] },
        },
      }, services(), get().history);
      if (!result.ok) {
        set({ lastError: result.error || "direct-text failed" });
        return { ok: false, error: result.error || "direct-text failed" };
      }
      projectInto(set, result.state, result.history || get().history, { lastError: null });
      return { ok: true, nodeId: result.createdNodeId };
    },
    navigateCanvas: (canvasId) => {
      dispatch({ type: "navigateCanvas", canvasId });
      set({
        isEditorOpen: false,
        activeGeneratedView: null,
        pendingDirectProposal: null,
        orchestrationStatus: "stale",
        orchestrationRequest: null,
        nextActionProposal: null,
        orchestrationReceipt: null,
      });
    },
    navigateParent: () => {
      dispatch({ type: "navigateParent" });
      set({
        isEditorOpen: false,
        activeGeneratedView: null,
        pendingDirectProposal: null,
        orchestrationStatus: "stale",
        orchestrationRequest: null,
        nextActionProposal: null,
        orchestrationReceipt: null,
      });
    },
    navigateBack: () => {
      dispatch({ type: "navigateBack" });
      set({
        isEditorOpen: false,
        activeGeneratedView: null,
        pendingDirectProposal: null,
        orchestrationStatus: "stale",
        orchestrationRequest: null,
        nextActionProposal: null,
      });
    },
    undo: () => {
      const { history } = get();
      const entry = history.past[history.past.length - 1];
      const ok = dispatch({ type: "undo" });
      if (ok && entry?.viewSnapshot) {
        set({
          activeGeneratedView: (entry.viewSnapshot.before ??
            null) as GeneratedViewRecord | null,
        });
      }
    },
    redo: () => {
      const { history } = get();
      const entry = history.future[0];
      const ok = dispatch({ type: "redo" });
      if (ok && entry?.viewSnapshot) {
        set({
          activeGeneratedView: (entry.viewSnapshot.after ??
            null) as GeneratedViewRecord | null,
        });
      }
    },
    getBreadcrumb: () =>
      breadcrumbPath(get().workspace.document, get().workspace.runtime),
    resolveSharedContext: (mode, operation) =>
      resolveContext({
        document: get().workspace.document,
        runtime: get().workspace.runtime,
        mode,
        operation,
        generatedView: get().activeGeneratedView,
      }),
    runDirectTransform: async (operation, sourceNodeIds) => {
      const current = get().workspace;
      const envelope = resolveContext({
        document: current.document,
        runtime: current.runtime,
        mode: "direct",
        operation:
          operation === "compare" ||
          operation === "summarize" ||
          operation === "counterpoint"
            ? "summarize"
            : "read",
      });
      const error = validateTransformSelection(current, operation, sourceNodeIds);
      if (error) {
        set({ lastError: error });
        return false;
      }
      const request = buildTransformRequest(
        current,
        operation,
        envelope.contextDigest,
        sourceNodeIds,
      );
      try {
        const directDraft = await (backend() as any).DirectTransform({
          operation,
          sourceNodeIds: request.sourceNodeIds,
          sourceRevisions: request.sourceRevisions,
          workspaceId: request.workspaceId,
          canvasId: request.canvasId,
          runtimeGeneration: request.runtimeGeneration,
          scopeEpoch: request.scopeEpoch,
          contextDigest: request.contextDigest,
          sourceNodes: request.sources.map((source) => ({
            id: source.nodeId,
            type: "text",
            revision: source.revision,
            markdown: source.content,
          })),
        });
        // Always re-read latest workspace after provider await; never projectInto pre-await state.
        const latest = get().workspace;
        const guard = revalidateDirectTransform(request, latest);
        if (guard) {
          set({ lastError: guard.error });
          return false;
        }
        // Echoed correlation from backend response is also checked when present.
        if (
          directDraft.workspaceId &&
          (directDraft.workspaceId !== request.workspaceId ||
            directDraft.canvasId !== request.canvasId ||
            directDraft.runtimeGeneration !== request.runtimeGeneration ||
            Number(directDraft.scopeEpoch ?? request.scopeEpoch) !==
              request.scopeEpoch)
        ) {
          set({
            lastError: "direct-transform-stale: response correlation mismatch",
          });
          return false;
        }
        const generated = directDraft.content;
        const transform = normalizeTransformDraft(request, {
          operation: directDraft.operation,
          sourceNodeIds: request.sourceNodeIds,
          sourceRevisions: request.sourceRevisions,
          content: generated,
          summary: directDraft.summary,
          reason: directDraft.reason,
          suggestedRelations: directDraft.suggestedRelations,
          provenance: { origin: "llm" },
        });
        const result = applyDirectTransform(
          latest,
          transform,
          services(),
          get().history,
        );
        if (result.status !== "applied" || !result.history) {
          set({ lastError: result.error || "direct transform failed" });
          return false;
        }
        const outputNode =
          result.state.document.nodes[result.receipt.createdNodeId || ""];
        projectInto(set, result.state, result.history, {
          lastError: null,
          lastDirectReceipt: {
            operation,
            sourceNodeIds: request.sourceNodeIds,
            createdNodeId: result.receipt.createdNodeId,
            createdRelationIds: result.receipt.createdRelationIds,
            summary: result.receipt.summary,
            diff: {
              sources: request.sources.map((source) => ({
                nodeId: source.nodeId,
                content: source.content,
                revision: source.revision,
              })),
              output: isTextBearing(outputNode) ? outputNode.content : "",
            },
          },
        });
        return true;
      } catch (caught) {
        set({
          lastError:
            caught instanceof Error
              ? caught.message
              : "direct transform failed",
        });
        return false;
      }
    },
    requestNextActions: async (messages: ChatMessage[] = []) => {
      const state = get();
      if (state.orchestrationStatus === "pending" || state.orchestrationStatus === "dispatching") return false;
      const requestId = services().ids.next("next-action");
      const envelope = resolveContext({ document: state.workspace.document, runtime: state.workspace.runtime, mode: "direct", operation: "orchestrate", generatedView: state.activeGeneratedView });
      let request: NextActionRequest;
      try { request = buildNextActionRequest(state.workspace, envelope, messages, requestId); } catch (error) { set({ orchestrationStatus: "error", lastError: error instanceof Error ? error.message : "orchestration-context-error" }); return false; }
      set({ orchestrationStatus: "pending", orchestrationRequest: request, nextActionProposal: null, lastError: null });
      try {
        const result = await (backend() as any).SuggestNextActions(request);
        const latest = get().workspace;
        const latestEnvelope = resolveContext({ document: latest.document, runtime: latest.runtime, mode: "direct", operation: "orchestrate", generatedView: get().activeGeneratedView });
        const currentSelected = latest.runtime.selection.selectedNodeIds.filter((id) => latestEnvelope.bodyAllowlistNodeIds.includes(id) && !latestEnvelope.excludedNodeIds.includes(id) && latest.document.nodes[id]?.kind !== "folder");
        const scope = { ...latestEnvelope, focusText: latestEnvelope.focus?.text, selectedNodeIds: currentSelected };
        if (get().orchestrationRequest?.requestId !== requestId || !revalidateNextActionScope(request, latest, scope)) { set({ orchestrationStatus: "stale", nextActionProposal: null }); return false; }
        const normalized = normalizeNextActionProposal(result, request);
        set({ orchestrationStatus: "ready", nextActionProposal: normalized, orchestrationReceipt: null }); return true;
      } catch (error) { if (get().orchestrationRequest?.requestId !== requestId) return false; set({ orchestrationStatus: "error", lastError: normalizeNextActionError(error) }); return false; }
    },
    cancelNextActionRequest: () => {
      if (get().orchestrationStatus !== "pending") return;
      set({ orchestrationStatus: "cancelled", orchestrationRequest: null, nextActionProposal: null, orchestrationReceipt: null });
    },
    dismissNextActions: () => set({ orchestrationStatus: "idle", orchestrationRequest: null, nextActionProposal: null, orchestrationReceipt: null }),
    rejectNextAction: (actionId) => set((state) => {
      if (!state.nextActionProposal) return state;
      const actions = state.nextActionProposal.actions.filter((a) => a.id !== actionId);
      return actions.length ? { nextActionProposal: { ...state.nextActionProposal, actions } } : { orchestrationStatus: "idle", nextActionProposal: null, orchestrationRequest: null, orchestrationReceipt: null };
    }),
    dispatchNextAction: async (actionId, edits) => {
      const state = get(); const proposal = state.nextActionProposal; if (!proposal || state.orchestrationStatus !== "ready") return false;
      const item = proposal.actions.find((a) => a.id === actionId);
      const currentEnvelope = resolveContext({ document: state.workspace.document, runtime: state.workspace.runtime, mode: "direct", operation: "orchestrate", generatedView: state.activeGeneratedView });
      const currentSelected = state.workspace.runtime.selection.selectedNodeIds.filter((id) => currentEnvelope.bodyAllowlistNodeIds.includes(id) && !currentEnvelope.excludedNodeIds.includes(id) && state.workspace.document.nodes[id]?.kind !== "folder");
      const scope = { ...currentEnvelope, focusText: currentEnvelope.focus?.text, selectedNodeIds: currentSelected };
      if (!item || !state.orchestrationRequest || !revalidateNextActionScope(state.orchestrationRequest, state.workspace, scope)) { set({ orchestrationStatus: "stale", nextActionProposal: null }); return false; }
      if (get().orchestrationStatus === "dispatching") return false;
      const targets = edits?.targetNodeIds ?? item.targetNodeIds ?? []; const query = edits?.query ?? item.query;
      if (!validateEditedAction(item, targets, query, state.orchestrationRequest) || targets.some((id) => !state.orchestrationRequest?.selectedNodeIds.includes(id))) { set({ orchestrationStatus: "error", lastError: "next-action-edit-invalid" }); return false; }
      set({ orchestrationStatus: "dispatching" }); let ok = false;
      try {
        if (item.kind === "compare" || item.kind === "counterpoint") ok = await get().runDirectTransform(item.kind, targets);
        else if (item.kind === "web_search") ok = await get().runWebSearch(query?.trim() || state.orchestrationRequest.focusText || "", { entryRoute: "direct-action" });
        else if (item.kind === "suggest_relations") ok = await get().runDirectSuggestRelations(targets);
        else if (item.kind === "suggest_clusters") ok = await get().runDirectSuggestClusters(targets);
        else if (item.kind === "clarify" && item.question?.trim()) {
          const chat = (await import("./useChatStore")).useChatStore;
          const current = chat.getState();
          const session = current.activeSessionId ? current.sessions.find((s) => s.id === current.activeSessionId) : undefined;
          const targetSession = session ?? current.createSession();
          chat.getState().appendMessage(targetSession.id, { id: services().ids.next("clarify"), role: "assistant", content: item.question.trim(), createdAt: services().clock.now() });
          window.dispatchEvent(new CustomEvent("fm:focus-chat-input"));
          ok = true;
        } else ok = false;
      } catch { ok = false; }
      set(ok ? { orchestrationStatus: "dispatched", nextActionProposal: null, orchestrationReceipt: { kind: item.kind, targetNodeIds: targets, resultSurface: NEXT_ACTION_MAPPINGS[item.kind].resultSurface } } : { orchestrationStatus: "error", lastError: get().lastError || "next-action-dispatch-failed" });
      return ok;
    },
    applyDirectImageVariant: (input) => {
      const { workspace, history } = get();
      const fullInput: ApplyImageVariantInput = {
        src: input.src,
        alt: input.alt || input.prompt,
        prompt: input.prompt,
        provider: input.provider,
        model: input.model,
        sourceNodeIds: input.sourceNodeIds,
        sourceRevisions: input.sourceRevisions,
        workspaceId: input.scope?.workspaceId ?? workspace.document.workspaceId,
        canvasId: input.scope?.canvasId ?? workspace.runtime.currentCanvasId,
        runtimeGeneration: input.scope?.runtimeGeneration ?? workspace.runtime.runtimeGeneration,
        scopeEpoch: input.scope?.scopeEpoch ?? workspace.runtime.scopeEpoch,
        position: input.position,
      };
      const result = applyCommand(
        workspace,
        { type: "applyImageVariant", input: fullInput },
        services(),
        history,
      );
      if (!result.ok) {
        set({ lastError: result.error || "image variant failed" });
        return false;
      }
      projectInto(set, result.state, result.history || history, {
        lastError: null,
        lastDirectReceipt: {
          operation: "generate-image",
          sourceNodeIds: input.sourceNodeIds,
          createdNodeId: result.createdNodeId,
          createdRelationIds: result.createdRelationIds,
          summary: input.prompt,
        },
      });
      return true;
    },
    applyIncomingPacket: (packet, entryRoute) => {
      const current = get().workspace;
      const run = packet.runId
        ? current.runtime.asyncRuns[packet.runId]
        : undefined;
      const rejection = incomingPacketRejection(
        packet,
        {
          workspaceId: current.document.workspaceId,
          canvasId: current.runtime.currentCanvasId,
          runtimeGeneration: current.runtime.runtimeGeneration,
          scopeEpoch: current.runtime.scopeEpoch,
        },
        entryRoute,
        run
          ? { runId: run.runId, epoch: run.epoch, status: run.status }
          : undefined,
      );
      if (rejection) {
        set({ lastError: rejection });
        return false;
      }
      set({
        activePacket: packet,
        lastSearchReceipt:
          entryRoute === "direct-action"
            ? { entryRoute, packet }
            : get().lastSearchReceipt,
        lastError:
          packet.status === "failed"
            ? packet.error?.code || "web-search-provider-error"
            : null,
      });
      return true;
    },
    runWebSearch: async (query, options) => {
      const entryRoute = options?.entryRoute ?? "direct-action";
      const current = get().workspace;
      const envelope = resolveContext({
        document: current.document,
        runtime: current.runtime,
        mode: entryRoute === "dialogue-agent" ? "dialogue" : "direct",
        operation: "web-search",
      });
      const hintNodeIds: string[] = [];
      const hintSummaries: string[] = [];
      for (const id of envelope.bodyAllowlistNodeIds) {
        const node = current.document.nodes[id];
        if (!node || !isTextBearing(node)) continue;
        hintNodeIds.push(id);
        hintSummaries.push(hintExcerpt(node.summary, node.content));
      }
      const request: WebSearchRequest = {
        query:
          entryRoute === "direct-action"
            ? resolveWebSearchQuery(query, hintSummaries)
            : resolveWebSearchQuery(query, []),
        hintNodeIds,
        hintSummaries,
        knownUrls: options?.knownUrls,
        workspaceId: current.document.workspaceId,
        canvasId: current.runtime.currentCanvasId,
        runtimeGeneration: current.runtime.runtimeGeneration,
        scopeEpoch: current.runtime.scopeEpoch,
        entryRoute,
      };
      set({ lastSearchRequest: request });
      if (!request.query) {
        set({ lastError: "web-search-invalid-query" });
        return false;
      }
      set({ isWebSearchPending: true, lastError: null });
      let runId: string | undefined;
      if (entryRoute === "dialogue-agent") {
        runId = `search-${Date.now()}`;
        get().dispatch({ type: "startAsyncRun", kind: "dialogue", runId });
        const runEpoch = get().workspace.runtime.asyncRuns[runId]?.epoch;
        request.runId = runId;
        request.runEpoch = runEpoch;
        set({ lastSearchRequest: request });
      }
      try {
        const packet = (await (backend() as any).SearchWeb(
          request,
        )) as ContextPacket;
        if (entryRoute === "dialogue-agent") {
          const chat = (await import("./useChatStore")).useChatStore.getState();
          const sessionId = chat.activeSessionId ?? chat.createSession().id;
          const packetRunId = packet.runId || runId || `search-${Date.now()}`;
          const assistantId = `search-assistant-${Date.now()}`;
          if (
            !chat.sessions
              .find((session) => session.id === sessionId)
              ?.messages.some((message) => message.runId === packetRunId)
          ) {
            chat.appendMessage(sessionId, {
              id: assistantId,
              role: "assistant",
              content: "",
              createdAt: Date.now(),
              runId: packetRunId,
              status: "complete",
              toolEvents: [],
            });
          }
          chat.upsertToolEvent(sessionId, packetRunId, {
            toolCallId: packet.packetId,
            name: "web_search",
            status: packet.status === "failed" ? "error" : "done",
            summary: packet.query,
            packet,
            error: packet.error?.message,
          });
        }
        const accepted = get().applyIncomingPacket(packet, entryRoute);
        const rejection = accepted ? null : get().lastError;
        if (runId) {
          get().dispatch({
            type: accepted ? "completeAsyncRun" : "cancelAsyncRun",
            runId,
          });
        }
        if (rejection) set({ lastError: rejection });
        set({ isWebSearchPending: false });
        return accepted;
      } catch (caught) {
        if (runId) {
          get().dispatch({ type: "cancelAsyncRun", runId });
        }
        set({
          isWebSearchPending: false,
          lastError:
            caught instanceof Error
              ? caught.message
              : "web-search-provider-error",
        });
        return false;
      }
    },
    promoteActivePacket: (selection) => {
      const packet = get().activePacket;
      const workspace = get().workspace;
      if (!packet) {
        set({ lastError: "promote-stale" });
        return false;
      }
      const applied = dispatch({
        type: "promoteContextItems",
        input: {
          packetId: packet.packetId,
          workspaceId: workspace.document.workspaceId,
          canvasId: workspace.runtime.currentCanvasId,
          runtimeGeneration: workspace.runtime.runtimeGeneration,
          scopeEpoch: workspace.runtime.scopeEpoch,
          selectedClaimIds: selection.selectedClaimIds,
          selectedSourceIds: selection.selectedSourceIds,
          acceptedRelations: selection.acceptedRelations,
          packet: {
            packetId: packet.packetId,
            query: packet.query,
            retrievedAt: packet.retrievedAt,
            contextProvider: packet.contextProvider,
            sources: packet.sources,
            claims: packet.claims,
          },
        },
      });
      if (applied) {
        set({ activePacket: null, lastSearchReceipt: null });
      }
      return applied;
    },
    dismissPacket: () => set({ activePacket: null, lastSearchReceipt: null }),
    openExternalURL: async (url) => {
      try {
        await (backend() as any).OpenExternalURL(url);
        set({ lastOpenedURL: url, lastError: null });
        return true;
      } catch (caught) {
        set({
          lastError:
            caught instanceof Error ? caught.message : "web-search-invalid-url",
        });
        return false;
      }
    },
    // Kept only so old E2E/serialized fixtures can be loaded and re-selected;
    // ContextPreview no longer exposes this mutation and the resolver ignores
    // the legacy field.
    setContextExcluded: (nodeId, excluded) => {
      dispatch({ type: "setContextExcluded", nodeId, excluded });
    },
    useCanvasAsContext: () => {
      const canvasId = get().workspace.runtime.currentCanvasId;
      dispatch({
        type: "addContextTarget",
        target: { kind: "canvas", canvasId, expansion: "direct-members" },
      });
    },

    closeGeneratedView: () => set({ activeGeneratedView: null }),
    setActiveGeneratedView: (view) => {
      set({
        activeGeneratedView: view && view.clusters.length > 0 ? view : null,
      });
    },
    dismissDirectProposal: () =>
      set({ pendingDirectProposal: null, lastSuggestReceipt: null }),
    runDirectSuggestRelations: async (sourceNodeIds) => {
      if (get().lastSuggestReceipt?.status === "pending") return false;
      const current = get().workspace;
      const built = buildDirectSuggestSource(current, "relate", sourceNodeIds);
      if ("error" in built) {
        set({ lastError: built.error });
        return false;
      }
      const requestCorrelation = {
        workspaceId: current.document.workspaceId,
        canvasId: current.runtime.currentCanvasId,
        runtimeGeneration: current.runtime.runtimeGeneration,
        scopeEpoch: current.runtime.scopeEpoch,
        sourceRevisions: built.sourceRevisions,
      };
      set({
        lastSuggestReceipt: { operation: "relations", status: "pending" },
        lastError: null,
      });
      try {
        const directDraft = await (backend() as any).SuggestRelations({
          ...requestCorrelation,
          contextDigest: built.contextDigest,
          sourceNodeIds: built.nodeIds,
          sourceNodes: built.sourceNodes,
        });
        const latest = get().workspace;
        const guard = revalidateDirectSuggestion(requestCorrelation, latest);
        if (guard) {
          set({
            lastError: guard.error,
            lastSuggestReceipt: {
              operation: "relations",
              status: "error",
              error: guard.error,
            },
          });
          return false;
        }
        const relations: RelationBatchItem[] = (
          directDraft.relations ?? []
        ).map((r: any) => ({
          sourceNodeId: r.sourceNodeId,
          targetNodeId: r.targetNodeId,
          kind: r.kind,
          reason: r.reason,
          direction: r.direction,
        }));
        const normalized = normalizeRelationBatchDraft(
          {
            relations,
            sourceRevisions: built.sourceRevisions,
            imageInputModes: built.imageInputModes,
            provenance: {
              origin: "relation-batch",
              operation: "propose_relation_batch",
            },
          },
          latest,
        );
        if (!normalized.ok) {
          set({
            lastError: normalized.error,
            lastSuggestReceipt: {
              operation: "relations",
              status: "error",
              error: normalized.error,
            },
          });
          return false;
        }
        const record = createRelationBatchProposal({
          proposalId: `direct-relations-${Date.now()}`,
          runId: "direct",
          runEpoch: 0,
          workspaceId: latest.document.workspaceId,
          canvasId: latest.runtime.currentCanvasId,
          runtimeGeneration: latest.runtime.runtimeGeneration,
          scopeEpoch: latest.runtime.scopeEpoch,
          relations: normalized.value,
          sourceRevisions: built.sourceRevisions,
          imageInputModes: built.imageInputModes,
          provenance: {
            origin: "relation-batch",
            operation: "propose_relation_batch",
          },
        });
        set({
          pendingDirectProposal: record,
          lastSuggestReceipt: { operation: "relations", status: "done" },
        });
        return true;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : typeof caught === "string"
              ? caught
              : "suggest-relations-failed";
        set({
          lastError: message,
          lastSuggestReceipt: {
            operation: "relations",
            status: "error",
            error: message,
          },
        });
        return false;
      }
    },
    runDirectSuggestClusters: async (sourceNodeIds) => {
      if (get().lastSuggestReceipt?.status === "pending") return false;
      const current = get().workspace;
      const built = buildDirectSuggestSource(current, "group", sourceNodeIds);
      if ("error" in built) {
        set({ lastError: built.error });
        return false;
      }
      const requestCorrelation = {
        workspaceId: current.document.workspaceId,
        canvasId: current.runtime.currentCanvasId,
        runtimeGeneration: current.runtime.runtimeGeneration,
        scopeEpoch: current.runtime.scopeEpoch,
        sourceRevisions: built.sourceRevisions,
      };
      set({
        lastSuggestReceipt: { operation: "clusters", status: "pending" },
        lastError: null,
      });
      try {
        const directDraft = await (backend() as any).SuggestClusters({
          ...requestCorrelation,
          contextDigest: built.contextDigest,
          sourceNodeIds: built.nodeIds,
          sourceNodes: built.sourceNodes,
        });
        const latest = get().workspace;
        const guard = revalidateDirectSuggestion(requestCorrelation, latest);
        if (guard) {
          set({
            lastError: guard.error,
            lastSuggestReceipt: {
              operation: "clusters",
              status: "error",
              error: guard.error,
            },
          });
          return false;
        }
        const normalized = normalizeClusterViewDraft(
          {
            label: directDraft.viewLabel,
            clusters: (directDraft.clusters ?? []).map((c: any) => ({
              label: c.label,
              reason: c.reason,
              nodeIds: c.nodeIds,
            })),
            ungroupedNodeIds: directDraft.ungroupedNodeIds ?? [],
            sourceRevisions: built.sourceRevisions,
            imageInputModes: built.imageInputModes,
            provenance: { origin: "cluster-view" },
          },
          latest,
          services(),
        );
        if (!normalized.ok) {
          set({
            lastError: normalized.error,
            lastSuggestReceipt: {
              operation: "clusters",
              status: "error",
              error: normalized.error,
            },
          });
          return false;
        }
        const record = createGeneratedViewProposal({
          proposalId: `direct-clusters-${Date.now()}`,
          runId: "direct",
          runEpoch: 0,
          workspaceId: latest.document.workspaceId,
          canvasId: latest.runtime.currentCanvasId,
          runtimeGeneration: latest.runtime.runtimeGeneration,
          scopeEpoch: latest.runtime.scopeEpoch,
          view: normalized.value,
          provenance: { origin: "cluster-view" },
          source: "direct",
        });
        set({
          pendingDirectProposal: record,
          lastSuggestReceipt: { operation: "clusters", status: "done" },
        });
        return true;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : typeof caught === "string"
              ? caught
              : "suggest-clusters-failed";
        set({
          lastError: message,
          lastSuggestReceipt: {
            operation: "clusters",
            status: "error",
            error: message,
          },
        });
        return false;
      }
    },
    decideDirectProposal: (decision, modified) => {
      const record = get().pendingDirectProposal;
      if (!record)
        return { status: "error" as const, error: "no pending proposal" };
      const result = decideAndApplyProposal(
        get().workspace,
        record,
        {
          proposalId: record.proposalId,
          decisionId: `decision-${record.proposalId}-${decision}`,
          decision: modified ? "modify" : decision,
          modifiedRelations: modified?.relations,
          modifiedView: modified?.view,
        },
        services(),
        get().history,
      );
      if (result.status === "applied") {
        if (result.generatedView) {
          set({
            activeGeneratedView: result.generatedView,
            pendingDirectProposal: null,
            lastError: null,
            lastSuggestReceipt: null,
          });
        } else if (result.history) {
          projectInto(set, result.state, result.history, {
            lastError: null,
            pendingDirectProposal: null,
          });
        }
        return { status: "applied" as const };
      }
      if (result.status === "rejected") {
        set({ pendingDirectProposal: null });
        return { status: "rejected" as const };
      }
      if (result.status === "conflict") {
        set({ lastError: result.error || "conflict" });
        return { status: "conflict" as const };
      }
      set({ lastError: result.error || result.status });
      return { status: "error" as const, error: result.error || result.status };
    },
    convertClusterToSubCanvas: (clusterId, label) => {
      const view = get().activeGeneratedView;
      if (!view) return false;
      const cluster = view.clusters.find((c) => c.id === clusterId);
      if (!cluster) {
        set({ lastError: "cluster not found" });
        return false;
      }
      if (cluster.nodeIds.length < 2) {
        set({ lastError: "cluster has fewer than 2 members" });
        return false;
      }
      const viewBefore = view;
      const { workspace, history } = get();
      const result = applyCommand(
        workspace,
        { type: "createSubCanvas", nodeIds: cluster.nodeIds, label },
        services(),
        history,
      );
      if (!result.ok) {
        set({ lastError: result.error || "createSubCanvas failed" });
        return false;
      }
      const viewAfter = removeCluster(view, clusterId);
      const pruned = viewAfter.clusters.length === 0 ? null : viewAfter;
      const newHistory = result.history ?? history;
      const lastEntry = newHistory.past[newHistory.past.length - 1];
      if (lastEntry)
        lastEntry.viewSnapshot = { before: viewBefore, after: pruned };
      projectInto(set, result.state, newHistory, { lastError: null });
      set({ activeGeneratedView: pruned });
      return true;
    },

    addNode: (node: AppNode) => {
      if (node.type === "imageNode") {
        const data = node.data as ImageNodeData;
        dispatch({
          type: "createImageRef",
          input: {
            src: data.src,
            alt: data.alt,
            prompt: data.prompt,
            provider: data.provider,
            model: data.model,
            position: node.position,
            width: node.width,
            height: node.height,
          },
        });
        return;
      }
      if (node.type === "artifactNode") {
        const data = node.data as ArtifactNodeData;
        dispatch({
          type: "createText",
          role: "artifact",
          input: {
            content: data.content,
            summary: data.summary,
            filename: data.filename,
            language: data.language,
            position: node.position,
            width: node.width,
            height: node.height,
          },
        });
        return;
      }
      const data = node.data as TextNodeData;
      dispatch({
        type: "createText",
        role: "text",
        input: {
          content: data.content,
          summary: data.summary,
          originalPrompt: data.originalPrompt,
          position: node.position,
          width: node.width,
          height: node.height,
        },
      });
    },

    addEmptyNode: () => {
      dispatch({ type: "createText", role: "text", input: {} });
      set({ isEditorOpen: true });
    },

    addArtifactNode: () => {
      dispatch({ type: "createText", role: "artifact", input: {} });
      set({ isEditorOpen: true });
    },

    deleteNode: (id: string) => {
      const node = get().workspace.document.nodes[id];
      if (node && isFolder(node)) {
        set({ lastError: "Use Dissolve SubCanvas for folder nodes" });
        return;
      }
      dispatch({ type: "deleteNodes", nodeIds: [id] });
      const view = get().activeGeneratedView;
      if (view)
        set({ activeGeneratedView: pruneViewForDeletedNodes(view, [id]) });
    },

    deleteEdge: (id: string) => {
      dispatch({ type: "removeRelation", id });
    },

    setPromptInput: (value: string) => {
      const canvasId = get().workspace.runtime.currentCanvasId;
      useChatStore.getState().setDraft(canvasId, value);
    },
    appendPromptInput: (value: string) => {
      const prompt = value.trim();
      if (!prompt) return;
      const canvasId = get().workspace.runtime.currentCanvasId;
      useChatStore.getState().appendDraft(canvasId, prompt);
    },

    applyToolProposal: (proposal, requestedRunId) =>
      decideToolProposal(proposal, "accept", requestedRunId),
    decideToolProposal,

    updateNodeContent: (id, content) => {
      const node = get().workspace.document.nodes[id];
      if (!node || !isTextBearing(node)) return;
      dispatch({
        type: "editTextContent",
        nodeId: id,
        content,
        baseRevision: node.revision,
      });
    },

    updateArtifactContent: (id, content) => {
      get().updateNodeContent(id, content);
    },

    updateArtifactFilename: (id, filename) => {
      dispatch({ type: "editTextMetadata", nodeId: id, patch: { filename } });
    },

    setArtifactLastEditSummary: (id, summary) => {
      dispatch({
        type: "editTextMetadata",
        nodeId: id,
        patch: { lastEditSummary: summary },
      });
    },

    updateNodeSummary: (id, summary) => {
      dispatch({ type: "editTextMetadata", nodeId: id, patch: { summary } });
    },

    updateNodeDimensions: (id, width, height) => {
      dispatch({ type: "resizeNode", nodeId: id, width, height });
    },

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    setActiveNode: (id, preserveSelection = false) => {
      const currentSelection =
        get().workspace.runtime.selection.selectedNodeIds;
      const selectedNodeIds = id
        ? preserveSelection
          ? [...new Set([...currentSelection, id])]
          : [id]
        : [];
      dispatch({
        type: "setSelection",
        state: {
          selectedNodeIds,
          activeNodeId: id || undefined,
          revision: get().workspace.runtime.selection.revision + 1,
        },
      });
    },

    setEditorOpen: (isOpen) => set({ isEditorOpen: isOpen }),
    setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

    setConfig: (config) => {
      set((state) => ({
        config: {
          ...state.config,
          ...config,
          imageGen: config.imageGen
            ? mergeImageGenConfig({
                ...state.config.imageGen,
                ...config.imageGen,
              })
            : state.config.imageGen,
          webSearch: config.webSearch
            ? mergeWebSearchConfig({
                ...state.config.webSearch,
                ...config.webSearch,
              })
            : state.config.webSearch,
        },
      }));
    },

    loadConfig: async () => {
      try {
        const config = await backend().GetConfig();
        const fullConfig: AppConfig = {
          llm: (config as any).llm || initialConfig.llm,
          generation: (config as any).generation || initialConfig.generation,
          imageGen: mergeImageGenConfig((config as any).imageGen),
          webSearch: mergeWebSearchConfig((config as any).webSearch),
        };
        set({ config: fullConfig });
      } catch (error) {
        console.error("Failed to load config:", error);
      }
    },

    saveConfig: async (config) => {
      try {
        const fullConfig: AppConfig = {
          llm: config.llm || initialConfig.llm,
          generation: config.generation || initialConfig.generation,
          imageGen: mergeImageGenConfig(config.imageGen),
          webSearch: mergeWebSearchConfig(config.webSearch),
        };
        await backend().SaveConfig(fullConfig as any);
        set({ config: fullConfig });
      } catch (error) {
        console.error("Failed to save config:", error);
      }
    },

    saveCanvas: async () => {
      const json = workspaceToPrettyJSON(
        get().workspace,
        services().clock.nowISO(),
      );
      try {
        return await backend().SaveCanvasToFile(json);
      } catch (error) {
        console.error("Failed to save canvas:", error);
        throw error;
      }
    },

    loadCanvas: async () => {
      try {
        const jsonString = await backend().LoadCanvasFromFile();
        if (!jsonString) return;
        const loaded = loadWorkspaceJSON(jsonString, services());
        if (!loaded.ok) {
          set({ lastError: loaded.error });
          throw new Error(loaded.error);
        }
        dispatch({
          type: "replaceWorkspaceAfterValidatedLoad",
          load: loaded.load,
        });
        set({
          isEditorOpen: false,
          activeGeneratedView: null,
          pendingDirectProposal: null,
          lastSuggestReceipt: null,
          orchestrationStatus: "idle",
          orchestrationRequest: null,
          nextActionProposal: null,
          orchestrationReceipt: null,
        });
      } catch (error) {
        console.error("Failed to load canvas:", error);
        throw error;
      }
    },

    generateText: async (prompt, context) =>
      backend().GenerateText(prompt, context),
    generateSummary: async (text) => backend().GenerateSummary(text),
    generateImage: async (prompt, context, refImages, provider?) =>
      provider
        ? backend().GenerateImageWithProvider(
            prompt,
            context,
            refImages,
            provider,
          )
        : backend().GenerateImage(prompt, context, refImages),
    getImageDataURL: async (src) => backend().GetImageDataURL(src),

    importFile: async (filePath) => {
      const result = (await backend().ImportFile(
        filePath,
      )) as ImportFileResult & {
        filename?: string;
      };
      return result;
    },

    exportMarkdown: async (content) => backend().ExportMarkdown(content),

    exportNode: async (nodeId) => {
      const node = get().workspace.document.nodes[nodeId];
      if (!node) throw new Error("Node not found");
      if (isTextBearing(node)) {
        if (node.role === "artifact") {
          return backend().ExportMarkdownWithFilename(
            node.content,
            node.filename || "untitled.md",
          );
        }
        const name = node.filename || `${node.summary || "text"}.md`;
        return backend().ExportMarkdownWithFilename(node.content, name);
      }
      if (node.kind === "image") return backend().ExportImage(node.src);
      throw new Error("Unsupported node type for export");
    },

    exportImage: async (src) => backend().ExportImage(src),

    exportNodesAsMarp: async (nodeIds) => {
      const slides = ["---", "marp: true", "theme: default", "---", ""];
      for (const id of nodeIds) {
        const node = get().workspace.document.nodes[id];
        if (node && isTextBearing(node)) {
          slides.push(node.content, "", "---", "");
        }
      }
      return backend().ExportMarkdown(slides.join("\n"));
    },

    onNodesChange: (changes: NodeChange<AppNode>[]) => {
      const positionChanges: Array<{
        nodeId: string;
        position: { x: number; y: number };
      }> = [];
      const selectIds: string[] = [];
      let selectionTouched = false;
      const removeIds: string[] = [];

      for (const change of changes) {
        if (
          change.type === "position" &&
          change.position &&
          change.dragging === false
        ) {
          positionChanges.push({
            nodeId: change.id,
            position: change.position,
          });
        } else if (change.type === "select") {
          selectionTouched = true;
          if (change.selected) selectIds.push(change.id);
        } else if (change.type === "remove") {
          removeIds.push(change.id);
        } else if (
          change.type === "dimensions" &&
          change.dimensions &&
          (change as any).resizing === false
        ) {
          dispatch({
            type: "resizeNode",
            nodeId: change.id,
            width: change.dimensions.width,
            height: change.dimensions.height,
          });
        }
      }

      if (positionChanges.length) {
        dispatch({ type: "moveNodePositions", changes: positionChanges });
      }
      if (selectionTouched) {
        const projectedSelection = applyNodeChanges(changes, get().nodes)
          .filter((node) => node.selected)
          .map((node) => node.id);
        dispatch({
          type: "setSelection",
          state: {
            selectedNodeIds: projectedSelection.length
              ? projectedSelection
              : selectIds,
            // Prefer the node selected by this interaction while preserving the
            // complete React Flow selection set for Ctrl/Meta/Shift selection.
            activeNodeId:
              selectIds[selectIds.length - 1] ??
              (projectedSelection.length ? projectedSelection : selectIds)[0],
            revision: get().workspace.runtime.selection.revision + 1,
          },
        });
      }
      if (removeIds.length) {
        const folders = removeIds.filter((id) =>
          isFolder(get().workspace.document.nodes[id]),
        );
        const normals = removeIds.filter((id) => !folders.includes(id));
        if (normals.length) dispatch({ type: "deleteNodes", nodeIds: normals });
        if (folders.length) {
          set({
            lastError: "Folder delete is disabled; use Dissolve SubCanvas",
          });
        }
        const view = get().activeGeneratedView;
        if (view && normals.length) {
          set({ activeGeneratedView: pruneViewForDeletedNodes(view, normals) });
        }
      }

      const hasTransient = changes.some(
        (c) => c.type === "position" && c.dragging === true,
      );
      if (hasTransient) {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      }
    },

    onEdgesChange: (changes: EdgeChange<AppEdge>[]) => {
      for (const change of changes) {
        if (change.type === "remove") {
          dispatch({ type: "removeRelation", id: change.id });
        }
      }
      const nonRemove = changes.filter((c) => c.type !== "remove");
      if (nonRemove.length) {
        set({ edges: applyEdgeChanges(nonRemove, get().edges) });
      }
    },

    onConnect: (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const rel = createRelation(
        services(),
        connection.source,
        connection.target,
        "context",
        {
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
        },
      );
      dispatch({ type: "addRelation", relation: rel });
    },
  };
});

void MarkerType;
