import { applyCommand, createHistory, HistoryState } from "./workspaceCommands";
import {
  DomainServices,
  NodeId,
  WorkspaceState,
  isTextBearing,
} from "./workspace";

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
}

export interface ProposalApplyResult {
  status: "applied" | "stale" | "conflict" | "cancelled" | "error" | "rejected";
  proposal: ProposalRecord;
  state: WorkspaceState;
  history?: HistoryState;
  error?: string;
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
  let content = input.proposed;
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
    if (op.kind === "edit-text") {
      op = {
        ...op,
        content: decision.modifiedContent ?? op.content,
      };
      nextProposal.status = "modified";
    } else {
      op = {
        ...op,
        content: decision.modifiedContent ?? op.content,
      };
      nextProposal.status = "modified";
    }
    nextProposal.operation = op;
  } else {
    nextProposal.status = "accepted";
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
    nextProposal.status =
      result.error?.includes("revision") ? "conflict" : "error";
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
