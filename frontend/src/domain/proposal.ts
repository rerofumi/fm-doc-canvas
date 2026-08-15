import {
  applyCommand,
  createHistory,
  type HistoryState,
} from "./workspaceCommands";
import {
  type DomainServices,
  type NodeId,
  type Provenance,
  type RelationRecord,
  type TransformApplyInput,
  type WorkspaceState,
  isTextBearing,
} from "./workspace";
import {
  type ClusterViewDraft,
  type GeneratedViewRecord,
  type RelationBatchItem,
  revalidateViewSourceRevisions,
  validateRelationBatch,
} from "./generatedView";

export type ProposalDecision = "accept" | "modify" | "reject" | "cancel";
export type ProposalStatus =
  | "proposed"
  | "accepted"
  | "modified"
  | "rejected"
  | "cancelled"
  | "applied"
  | "stale"
  | "conflict"
  | "error"
  | "undone";

export interface ProposalRecord {
  proposalId: string;
  providerToolCallId: string;
  runId: string;
  runEpoch: number;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  operation:
    | {
        kind: "edit-text";
        targetNodeId: NodeId;
        baseRevision: number;
        content: string;
      }
    | {
        kind: "create-text";
        role: "text" | "artifact";
        content: string;
        summary: string;
        filename?: string;
      }
    | {
        kind: "create-derived-text";
        transform: TransformApplyInput;
      }
    | {
        kind: "add-relation";
        relation: {
          sourceNodeId: NodeId;
          targetNodeId: NodeId;
          kind: "source" | "derived" | "supports" | "opposes" | "similar";
          reason?: string;
        };
      }
    | {
        kind: "create-image-variant";
        variant: {
          src: string;
          alt?: string;
          prompt: string;
          provider?: string;
          model?: string;
          sourceNodeIds: NodeId[];
          sourceRevisions: Record<NodeId, number>;
        };
      }
    | {
        kind: "add-relation-batch";
        relations: RelationBatchItem[];
        sourceRevisions: Record<NodeId, number>;
        imageInputModes?: Record<NodeId, "vision" | "metadata-only">;
        provenance?: Provenance;
      }
    | {
        kind: "create-generated-view";
        view: ClusterViewDraft;
        provenance?: Provenance;
        source?: "dialogue" | "direct";
      };
  reason?: string;
  status: ProposalStatus;
  decisionId?: string;
  receiptId?: string;
  createdNodeId?: NodeId;
  resultingRevision?: number;
  error?: string;
}

export interface ProposalDecisionInput {
  proposalId: string;
  decisionId: string;
  decision: ProposalDecision;
  modifiedContent?: string;
  modifiedReason?: string;
  modifiedRelation?: {
    sourceNodeId: NodeId;
    targetNodeId: NodeId;
    kind: "source" | "derived" | "supports" | "opposes" | "similar";
    reason?: string;
  };
  modifiedSuggestedRelations?: TransformApplyInput["suggestedRelations"];
  modifiedRelations?: RelationBatchItem[];
  modifiedView?: ClusterViewDraft;
}

export interface ProposalApplyResult {
  status: "applied" | "stale" | "conflict" | "cancelled" | "error" | "rejected";
  proposal: ProposalRecord;
  state: WorkspaceState;
  history?: HistoryState;
  error?: string;
  generatedView?: GeneratedViewRecord;
}

export function createProposalFromLegacyTool(input: {
  toolCallId: string;
  runId: string;
  runEpoch: number;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  operation: "create" | "replace" | "edit";
  targetNodeId?: string;
  baseRevision?: number;
  proposed: string;
  filename?: string;
  lastEditSummary?: string;
  searchText?: string;
  replacement?: string;
}): ProposalRecord {
  if (input.operation === "create") {
    return {
      proposalId: input.toolCallId,
      providerToolCallId: input.toolCallId,
      runId: input.runId,
      runEpoch: input.runEpoch,
      workspaceId: input.workspaceId,
      canvasId: input.canvasId,
      runtimeGeneration: input.runtimeGeneration,
      scopeEpoch: input.scopeEpoch,
      operation: {
        kind: "create-text",
        role: "artifact",
        content: input.proposed,
        summary: input.lastEditSummary || "proposal",
        filename: input.filename,
      },
      status: "proposed",
    };
  }
  const content = input.proposed;
  return {
    proposalId: input.toolCallId,
    providerToolCallId: input.toolCallId,
    runId: input.runId,
    runEpoch: input.runEpoch,
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    runtimeGeneration: input.runtimeGeneration,
    scopeEpoch: input.scopeEpoch,
    operation: {
      kind: "edit-text",
      targetNodeId: input.targetNodeId || "",
      baseRevision: input.baseRevision ?? 0,
      content,
    },
    status: "proposed",
  };
}

export function createTransformProposal(input: {
  proposalId: string;
  runId: string;
  runEpoch: number;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  transform: TransformApplyInput;
  providerToolCallId?: string;
}): ProposalRecord {
  return {
    proposalId: input.proposalId,
    providerToolCallId: input.providerToolCallId ?? input.proposalId,
    runId: input.runId,
    runEpoch: input.runEpoch,
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    runtimeGeneration: input.runtimeGeneration,
    scopeEpoch: input.scopeEpoch,
    operation: { kind: "create-derived-text", transform: input.transform },
    status: "proposed",
  };
}

export function createRelationProposal(input: {
  proposalId: string;
  runId: string;
  runEpoch: number;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  relation: {
    sourceNodeId: NodeId;
    targetNodeId: NodeId;
    kind: "source" | "derived" | "supports" | "opposes" | "similar";
    reason?: string;
  };
  providerToolCallId?: string;
}): ProposalRecord {
  return {
    proposalId: input.proposalId,
    providerToolCallId: input.providerToolCallId ?? input.proposalId,
    runId: input.runId,
    runEpoch: input.runEpoch,
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    runtimeGeneration: input.runtimeGeneration,
    scopeEpoch: input.scopeEpoch,
    operation: { kind: "add-relation", relation: input.relation },
    status: "proposed",
  };
}

export function createImageVariantProposal(input: {
  proposalId: string;
  runId: string;
  runEpoch: number;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  variant: {
    src: string;
    alt?: string;
    prompt: string;
    provider?: string;
    model?: string;
    sourceNodeIds: NodeId[];
    sourceRevisions: Record<NodeId, number>;
  };
  providerToolCallId?: string;
}): ProposalRecord {
  return {
    proposalId: input.proposalId,
    providerToolCallId: input.providerToolCallId ?? input.proposalId,
    runId: input.runId,
    runEpoch: input.runEpoch,
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    runtimeGeneration: input.runtimeGeneration,
    scopeEpoch: input.scopeEpoch,
    operation: { kind: "create-image-variant", variant: input.variant },
    status: "proposed",
  };
}

export function createRelationBatchProposal(input: {
  proposalId: string;
  runId: string;
  runEpoch: number;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  relations: RelationBatchItem[];
  sourceRevisions: Record<NodeId, number>;
  imageInputModes?: Record<NodeId, "vision" | "metadata-only">;
  provenance?: Provenance;
  providerToolCallId?: string;
}): ProposalRecord {
  return {
    proposalId: input.proposalId,
    providerToolCallId: input.providerToolCallId ?? input.proposalId,
    runId: input.runId,
    runEpoch: input.runEpoch,
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    runtimeGeneration: input.runtimeGeneration,
    scopeEpoch: input.scopeEpoch,
    operation: {
      kind: "add-relation-batch",
      relations: input.relations,
      sourceRevisions: input.sourceRevisions,
      imageInputModes: input.imageInputModes,
      provenance: input.provenance,
    },
    status: "proposed",
  };
}

export function createGeneratedViewProposal(input: {
  proposalId: string;
  runId: string;
  runEpoch: number;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  view: ClusterViewDraft;
  provenance?: Provenance;
  source?: "dialogue" | "direct";
  providerToolCallId?: string;
}): ProposalRecord {
  return {
    proposalId: input.proposalId,
    providerToolCallId: input.providerToolCallId ?? input.proposalId,
    runId: input.runId,
    runEpoch: input.runEpoch,
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    runtimeGeneration: input.runtimeGeneration,
    scopeEpoch: input.scopeEpoch,
    operation: {
      kind: "create-generated-view",
      view: input.view,
      provenance: input.provenance,
      source: input.source,
    },
    status: "proposed",
  };
}

export function applyDirectTransform(
  state: WorkspaceState,
  transform: TransformApplyInput,
  services: DomainServices,
  history?: HistoryState,
) {
  const result = applyCommand(
    state,
    { type: "applyTransform", input: transform },
    services,
    history ?? createHistory(),
  );
  if (!result.ok) {
    return {
      status: "error" as const,
      state,
      history,
      error: result.error,
      receipt: {
        kind: "direct-action" as const,
        summary: result.error || "failed",
      },
    };
  }
  return {
    status: "applied" as const,
    state: result.state,
    history: result.history,
    receipt: {
      kind: "direct-action" as const,
      createdNodeId: result.createdNodeId,
      createdRelationIds: result.createdRelationIds,
      summary: `${transform.operation} applied without changing source nodes`,
    },
  };
}

export function decideAndApplyProposal(
  state: WorkspaceState,
  proposal: ProposalRecord,
  decision: ProposalDecisionInput,
  services: DomainServices,
  history?: HistoryState,
  activeRun?: { runId: string; epoch: number; status: string },
): ProposalApplyResult {
  const nextProposal: ProposalRecord = {
    ...proposal,
    decisionId: decision.decisionId,
  };

  if (
    activeRun &&
    (activeRun.runId !== proposal.runId ||
      activeRun.epoch !== proposal.runEpoch ||
      activeRun.status !== "active")
  ) {
    nextProposal.status = "cancelled";
    return {
      status: "cancelled",
      proposal: nextProposal,
      state,
      history,
      error: "run is not active",
    };
  }

  if (
    state.document.workspaceId !== proposal.workspaceId ||
    state.runtime.runtimeGeneration !== proposal.runtimeGeneration ||
    state.runtime.scopeEpoch !== proposal.scopeEpoch ||
    state.runtime.currentCanvasId !== proposal.canvasId
  ) {
    nextProposal.status = "stale";
    return { status: "stale", proposal: nextProposal, state, history };
  }

  if (decision.decision === "reject") {
    nextProposal.status = "rejected";
    return { status: "rejected", proposal: nextProposal, state, history };
  }
  if (decision.decision === "cancel") {
    nextProposal.status = "cancelled";
    return { status: "cancelled", proposal: nextProposal, state, history };
  }

  let op = proposal.operation;
  if (decision.decision === "modify") {
    if (op.kind === "edit-text" || op.kind === "create-text") {
      op = {
        ...op,
        content: decision.modifiedContent ?? op.content,
      };
      nextProposal.status = "modified";
    } else if (op.kind === "create-derived-text") {
      op = {
        ...op,
        transform: {
          ...op.transform,
          content: decision.modifiedContent ?? op.transform.content,
          reason: decision.modifiedReason ?? op.transform.reason,
          suggestedRelations:
            decision.modifiedSuggestedRelations ??
            op.transform.suggestedRelations,
        },
      };
      nextProposal.status = "modified";
    } else if (op.kind === "add-relation" && decision.modifiedRelation) {
      op = {
        ...op,
        relation: { ...op.relation, ...decision.modifiedRelation },
      };
      nextProposal.status = "modified";
    } else if (op.kind === "add-relation-batch") {
      op = { ...op, relations: decision.modifiedRelations ?? op.relations };
      nextProposal.status = "modified";
    } else if (op.kind === "create-generated-view" && decision.modifiedView) {
      op = { ...op, view: decision.modifiedView };
      nextProposal.status = "modified";
    }
    nextProposal.operation = op;
  } else {
    nextProposal.status = "accepted";
  }

  if (op.kind === "create-derived-text") {
    const transform = {
      ...op.transform,
      content:
        decision.decision === "modify"
          ? (decision.modifiedContent ?? op.transform.content)
          : op.transform.content,
      reason: decision.modifiedReason ?? op.transform.reason,
      suggestedRelations:
        decision.decision === "modify"
          ? (decision.modifiedSuggestedRelations ??
            op.transform.suggestedRelations)
          : op.transform.suggestedRelations,
    };
    const result = applyCommand(
      state,
      { type: "applyTransform", input: transform },
      services,
      history ?? createHistory(),
    );
    if (!result.ok) {
      nextProposal.status = result.error?.includes("revision")
        ? "conflict"
        : "error";
      nextProposal.error = result.error;
      return {
        status: nextProposal.status === "conflict" ? "conflict" : "error",
        proposal: nextProposal,
        state,
        history: result.history,
        error: result.error,
      };
    }
    nextProposal.status = "applied";
    nextProposal.createdNodeId = result.createdNodeId;
    nextProposal.receiptId = `receipt-${proposal.proposalId}`;
    return {
      status: "applied",
      proposal: nextProposal,
      state: result.state,
      history: result.history,
    };
  }

  if (op.kind === "add-relation") {
    const source = state.document.nodes[op.relation.sourceNodeId];
    const target = state.document.nodes[op.relation.targetNodeId];
    if (!source || !target) {
      nextProposal.status = "error";
      nextProposal.error = "relation-endpoint-missing";
      return {
        status: "error",
        proposal: nextProposal,
        state,
        history,
        error: "relation-endpoint-missing",
      };
    }
    if (
      source.parentCanvasId !== state.runtime.currentCanvasId ||
      target.parentCanvasId !== state.runtime.currentCanvasId
    ) {
      nextProposal.status = "error";
      nextProposal.error = "relation-endpoint-out-of-scope";
      return {
        status: "error",
        proposal: nextProposal,
        state,
        history,
        error: "relation-endpoint-out-of-scope",
      };
    }
    const relation = {
      ...op.relation,
      id: services.ids.next("relation"),
      status: "accepted" as const,
      provenance: { origin: "llm" as const, operation: "propose_relation" },
    };
    const result = applyCommand(
      state,
      { type: "addRelation", relation },
      services,
      history ?? createHistory(),
    );
    if (!result.ok) {
      nextProposal.status = "error";
      nextProposal.error = result.error;
      return {
        status: "error",
        proposal: nextProposal,
        state,
        history: result.history,
        error: result.error,
      };
    }
    nextProposal.status = "applied";
    nextProposal.receiptId = `receipt-${proposal.proposalId}`;
    return {
      status: "applied",
      proposal: nextProposal,
      state: result.state,
      history: result.history,
    };
  }

  if (op.kind === "create-image-variant") {
    const result = applyCommand(
      state,
      {
        type: "applyImageVariant",
        input: {
          src: op.variant.src,
          alt: op.variant.alt,
          prompt: op.variant.prompt,
          provider: op.variant.provider,
          model: op.variant.model,
          sourceNodeIds: op.variant.sourceNodeIds,
          sourceRevisions: op.variant.sourceRevisions,
          workspaceId: state.document.workspaceId,
          canvasId: state.runtime.currentCanvasId,
          runtimeGeneration: state.runtime.runtimeGeneration,
          scopeEpoch: state.runtime.scopeEpoch,
          proposalId: proposal.proposalId,
        },
      },
      services,
      history ?? createHistory(),
    );
    if (!result.ok) {
      nextProposal.status =
        result.error === "image-variant-stale" ? "stale" : "error";
      nextProposal.error = result.error;
      return {
        status: nextProposal.status === "stale" ? "stale" : "error",
        proposal: nextProposal,
        state,
        history: result.history,
        error: result.error,
      };
    }
    nextProposal.status = "applied";
    nextProposal.createdNodeId = result.createdNodeId;
    nextProposal.receiptId = `receipt-${proposal.proposalId}`;
    return {
      status: "applied",
      proposal: nextProposal,
      state: result.state,
      history: result.history,
    };
  }

  if (op.kind === "add-relation-batch") {
    const batchError = validateRelationBatch(op.relations, state);
    if (batchError) {
      nextProposal.status = "error";
      nextProposal.error = batchError;
      return {
        status: "error",
        proposal: nextProposal,
        state,
        history,
        error: batchError,
      };
    }
    const relations: RelationRecord[] = op.relations.map((item) => ({
      id: services.ids.next("relation"),
      sourceNodeId: item.sourceNodeId,
      targetNodeId: item.targetNodeId,
      kind: item.kind,
      status: "accepted",
      reason: item.reason,
      provenance: {
        ...(op.provenance ?? {}),
        origin: "relation-batch" as const,
        operation: "propose_relation_batch",
      },
    }));
    const result = applyCommand(
      state,
      { type: "addRelations", relations },
      services,
      history ?? createHistory(),
    );
    if (!result.ok) {
      nextProposal.status = "error";
      nextProposal.error = result.error;
      return {
        status: "error",
        proposal: nextProposal,
        state,
        history: result.history,
        error: result.error,
      };
    }
    nextProposal.status = "applied";
    nextProposal.receiptId = `receipt-${proposal.proposalId}`;
    return {
      status: "applied",
      proposal: nextProposal,
      state: result.state,
      history: result.history,
    };
  }

  if (op.kind === "create-generated-view") {
    const viewError = revalidateViewSourceRevisions(
      op.view.sourceRevisions,
      state,
    );
    if (viewError) {
      nextProposal.status = viewError.includes("conflict")
        ? "conflict"
        : "stale";
      nextProposal.error = viewError;
      return {
        status: nextProposal.status === "conflict" ? "conflict" : "stale",
        proposal: nextProposal,
        state,
        history,
        error: viewError,
      };
    }
    const view: GeneratedViewRecord = {
      ...op.view,
      id: services.ids.next("view"),
      kind: "cluster",
      workspaceId: state.document.workspaceId,
      canvasId: state.runtime.currentCanvasId,
      runtimeGeneration: state.runtime.runtimeGeneration,
      scopeEpoch: state.runtime.scopeEpoch,
      source: op.source ?? "dialogue",
      createdAt: services.clock.nowISO(),
      provenance: { ...(op.provenance ?? {}), origin: "cluster-view" as const },
    };
    nextProposal.status = "applied";
    nextProposal.receiptId = `receipt-${proposal.proposalId}`;
    return {
      status: "applied",
      proposal: nextProposal,
      state,
      history,
      generatedView: view,
    };
  }

  if (op.kind === "create-text") {
    const result = applyCommand(
      state,
      {
        type: "createText",
        role: op.role,
        input: {
          content: op.content,
          summary: op.summary,
          filename: op.filename,
          provenance: { origin: "llm", operation: "create-text" },
        },
      },
      services,
      history ?? createHistory(),
    );
    if (!result.ok) {
      nextProposal.status = "error";
      nextProposal.error = result.error;
      return {
        status: "error",
        proposal: nextProposal,
        state,
        history: result.history,
        error: result.error,
      };
    }
    nextProposal.status = "applied";
    nextProposal.createdNodeId = result.createdNodeId;
    nextProposal.receiptId = `receipt-${proposal.proposalId}`;
    return {
      status: "applied",
      proposal: nextProposal,
      state: result.state,
      history: result.history,
    };
  }

  const node = state.document.nodes[op.targetNodeId];
  if (!node || !isTextBearing(node)) {
    nextProposal.status = "error";
    nextProposal.error = "target missing";
    return {
      status: "error",
      proposal: nextProposal,
      state,
      history,
      error: "target missing",
    };
  }
  if (node.revision !== op.baseRevision) {
    nextProposal.status = "conflict";
    return { status: "conflict", proposal: nextProposal, state, history };
  }

  const result = applyCommand(
    state,
    {
      type: "editTextContent",
      nodeId: op.targetNodeId,
      content: op.content,
      baseRevision: op.baseRevision,
    },
    services,
    history ?? createHistory(),
  );
  if (!result.ok) {
    nextProposal.status = result.error?.includes("revision")
      ? "conflict"
      : "error";
    nextProposal.error = result.error;
    return {
      status: nextProposal.status === "conflict" ? "conflict" : "error",
      proposal: nextProposal,
      state,
      history: result.history,
      error: result.error,
    };
  }
  const updated = result.state.document.nodes[op.targetNodeId];
  nextProposal.status = "applied";
  nextProposal.resultingRevision = isTextBearing(updated)
    ? updated.revision
    : undefined;
  nextProposal.receiptId = `receipt-${proposal.proposalId}`;
  return {
    status: "applied",
    proposal: nextProposal,
    state: result.state,
    history: result.history,
  };
}
