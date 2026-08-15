import { create } from "zustand";
import {
  Connection,
  EdgeChange,
  NodeChange,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
} from "@xyflow/react";
import {
  AppConfig,
  AppEdge,
  AppNode,
  AppState,
  ArtifactNodeData,
  ImageNodeData,
  ImportFileResult,
  TextNodeData,
} from "../types";
import { ChatToolProposal } from "../types/chat";
import {
  applyCommand,
  createHistory,
  createRelation,
  HistoryState,
} from "../domain/workspaceCommands";
import {
  ApplyImageVariantInput,
  createEmptyWorkspace,
  DomainServices,
  isFolder,
  isTextBearing,
  WorkspaceState,
} from "../domain/workspace";
import { breadcrumbPath, projectCurrentCanvas } from "../domain/projectToFlow";
import {
  loadWorkspaceJSON,
  workspaceToPrettyJSON,
} from "../domain/workspacePersistence";
import { resolveContext } from "../domain/contextResolver";
import {
  createProposalFromLegacyTool,
  createTransformProposal,
  createRelationProposal,
  createImageVariantProposal,
  decideAndApplyProposal,
  applyDirectTransform,
} from "../domain/proposal";
import {
  buildTransformRequest,
  normalizeTransformDraft,
  revalidateDirectTransform,
  validateTransformSelection,
} from "../domain/transform";
import { DirectTransformReceipt } from "../types/chat";
import {
  ContextPacket,
  WebSearchEntryRoute,
  WebSearchRequest,
  hintExcerpt,
  incomingPacketRejection,
  resolveWebSearchQuery,
} from "../domain/contextPacket";
import {
  createProductionClock,
  createProductionIds,
  RuntimeEnvironment,
} from "../runtime/runtimeEnvironment";
import * as GeneratedBackend from "../../wailsjs/go/main/App";

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
  navigateCanvas: (canvasId: string) => void;
  navigateParent: () => void;
  navigateBack: () => void;
  undo: () => void;
  getBreadcrumb: () => Array<{ canvasId: string; name: string }>;
  resolveSharedContext: (
    mode: "dialogue" | "direct",
    operation: Parameters<typeof resolveContext>[0]["operation"],
  ) => ReturnType<typeof resolveContext>;
  setContextExcluded: (nodeId: string, excluded: boolean) => void;
  useCanvasAsContext: () => void;
  runDirectTransform: (
    operation: "summarize" | "compare" | "counterpoint",
  ) => Promise<boolean>;
  applyDirectImageVariant: (input: {
    src: string;
    alt?: string;
    prompt: string;
    provider?: string;
    model?: string;
    sourceNodeIds: string[];
    sourceRevisions: Record<string, number>;
    position?: { x: number; y: number };
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
    };

function normalizeModifyPatch(modified?: ProposalModifyPatch): {
  content?: string;
  reason?: string;
  suggestedRelations?: NonNullable<
    ChatToolProposal["transform"]
  >["suggestedRelations"];
  relation?: NonNullable<ChatToolProposal["relation"]>;
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
      });
    },
    discardWorkspace: () => {
      dispatch({ type: "discardWorkspace" });
      set({
        isEditorOpen: false,
        activePacket: null,
        lastSearchReceipt: null,
        lastSearchRequest: null,
      });
    },
    switchTextRole: (nodeId, role) => {
      dispatch({ type: "switchTextRole", nodeId, role });
    },
    createSubCanvas: (nodeIds, label) => {
      dispatch({ type: "createSubCanvas", nodeIds, label });
    },
    navigateCanvas: (canvasId) => {
      dispatch({ type: "navigateCanvas", canvasId });
      set({ isEditorOpen: false });
    },
    navigateParent: () => {
      dispatch({ type: "navigateParent" });
      set({ isEditorOpen: false });
    },
    navigateBack: () => {
      dispatch({ type: "navigateBack" });
      set({ isEditorOpen: false });
    },
    undo: () => {
      dispatch({ type: "undo" });
    },
    getBreadcrumb: () =>
      breadcrumbPath(get().workspace.document, get().workspace.runtime),
    resolveSharedContext: (mode, operation) =>
      resolveContext({
        document: get().workspace.document,
        runtime: get().workspace.runtime,
        mode,
        operation,
      }),
    runDirectTransform: async (operation) => {
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
      const error = validateTransformSelection(current, operation);
      if (error) {
        set({ lastError: error });
        return false;
      }
      const request = buildTransformRequest(
        current,
        operation,
        envelope.contextDigest,
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
        workspaceId: workspace.document.workspaceId,
        canvasId: workspace.runtime.currentCanvasId,
        runtimeGeneration: workspace.runtime.runtimeGeneration,
        scopeEpoch: workspace.runtime.scopeEpoch,
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
    },

    deleteEdge: (id: string) => {
      dispatch({ type: "removeRelation", id });
    },

    setPromptInput: (value: string) => set({ promptInput: value }),
    appendPromptInput: (value: string) => {
      const prompt = value.trim();
      if (!prompt) return;
      set((state) => ({
        promptInput: state.promptInput.trim()
          ? `${state.promptInput}\n\n${prompt}`
          : prompt,
      }));
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
        set({ isEditorOpen: false });
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
