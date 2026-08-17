import type { ChatMessage } from "../types/chat";
import type { ContextEnvelope } from "./contextResolver";
import { boundedDialogueHistory } from "./runScope";
import { isFolder, isTextBearing, type WorkspaceState } from "./workspace";

export const NEXT_ACTION_KINDS = [
  "clarify",
  "compare",
  "counterpoint",
  "web_search",
  "suggest_relations",
  "suggest_clusters",
] as const;
export type NextActionKind = (typeof NEXT_ACTION_KINDS)[number];
export const isNextActionKind = (value: unknown): value is NextActionKind =>
  typeof value === "string" && (NEXT_ACTION_KINDS as readonly string[]).includes(value);
export type PlannerNodeType = "text" | "artifact" | "image";

export interface NextActionNodeHint {
  id: string;
  type: PlannerNodeType;
  revision: number;
  label: string;
  summary?: string;
  excerpt?: string;
}

export interface NextActionRelationHint {
  relationId: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind: string;
  reason?: string;
  provenance?: {
    origin: string;
    query?: string;
    url?: string;
    domain?: string;
    provider?: string;
    model?: string;
  };
}

export interface NextActionViewHint {
  viewId: string;
  kind: string;
  label: string;
}

export interface NextActionRequest {
  requestId: string;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  contextDigest: string;
  focusText?: string;
  dialogueHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  selectedNodeIds: string[];
  nodeHints: NextActionNodeHint[];
  relationHints: NextActionRelationHint[];
  viewHints: NextActionViewHint[];
  sourceRevisions: Record<string, number>;
}

export interface NextActionItem {
  id: string;
  kind: NextActionKind;
  role: string;
  actionLevel: string;
  route: string;
  targetNodeIds: string[];
  title: string;
  reason: string;
  expectedResult: string;
  documentEffect: string;
  control: string;
  query?: string;
  question?: string;
}

export interface NextActionProposalSet {
  requestId: string;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  contextDigest: string;
  sourceRevisions: Record<string, number>;
  actions: NextActionItem[];
}

export interface NextActionPresentation {
  role: string;
  actionLevel: string;
  route: string;
  /** Semantic codes are translated only by the presentation adapter. */
  documentEffect: "dialogue" | "transform" | "web-search" | "proposal";
  control: "answer-dismiss" | "undo" | "dismiss-promote" | "modify-accept-reject" | "modify-accept-reject-close";
  resultSurface: "dialogue" | "direct-transform" | "context-packet" | "relation-proposal" | "cluster-proposal";
}

export interface OrchestrationReceipt {
  kind: NextActionKind;
  targetNodeIds: string[];
  resultSurface: NextActionPresentation["resultSurface"];
}

export const NEXT_ACTION_MAPPINGS: Record<
  NextActionKind,
  NextActionPresentation
> = {
  clarify: {
    role: "questioner",
    actionLevel: "AL-0",
    route: "dialogue",
    documentEffect: "dialogue",
    control: "answer-dismiss",
    resultSurface: "dialogue",
  },
  compare: {
    role: "comparer",
    actionLevel: "AL-2",
    route: "direct-transform",
    documentEffect: "transform",
    control: "undo",
    resultSurface: "direct-transform",
  },
  counterpoint: {
    role: "critic",
    actionLevel: "AL-2",
    route: "direct-transform",
    documentEffect: "transform",
    control: "undo",
    resultSurface: "direct-transform",
  },
  web_search: {
    role: "researcher",
    actionLevel: "AL-2",
    route: "direct-web-search",
    documentEffect: "web-search",
    control: "dismiss-promote",
    resultSurface: "context-packet",
  },
  suggest_relations: {
    role: "organizer",
    actionLevel: "AL-1",
    route: "direct-relation-suggestion",
    documentEffect: "proposal",
    control: "modify-accept-reject",
    resultSurface: "relation-proposal",
  },
  suggest_clusters: {
    role: "organizer",
    actionLevel: "AL-1",
    route: "direct-cluster-suggestion",
    documentEffect: "proposal",
    control: "modify-accept-reject-close",
    resultSurface: "cluster-proposal",
  },
};

const MAX_NODES = 40;
const MAX_TITLE = 160;
const MAX_REASON = 600;
const MAX_QUERY = 500;
const MAX_QUESTION = 500;
const MAX_HISTORY = 12;

function cap(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function buildNextActionRequest(
  workspace: WorkspaceState,
  envelope: ContextEnvelope,
  messages: ChatMessage[],
  requestId: string,
): NextActionRequest {
  const bodyIds = [...new Set(envelope.bodyAllowlistNodeIds)];
  const excluded = new Set(envelope.excludedNodeIds);
  const ids = bodyIds.filter((id) => {
    const node = workspace.document.nodes[id];
    return Boolean(
      node &&
        node.parentCanvasId === envelope.canvasId &&
        !excluded.has(id) &&
        !isFolder(node),
    );
  });
  if (ids.length > MAX_NODES) {
    throw new Error("orchestration-node-cap-exceeded");
  }
  const nodeHints: NextActionNodeHint[] = ids.map((id) => {
    const node = workspace.document.nodes[id];
    if (isTextBearing(node)) {
      return {
        id,
        type: node.role,
        revision: node.revision,
        label: cap(
          node.summary || node.content.split(/\r?\n/, 1)[0] || id,
          120,
        ),
        summary: cap(node.summary, 240),
        excerpt: cap(node.content, 400),
      };
    }
    if (node.kind === "image") {
      const label = node.alt || node.prompt || id;
      const description = node.prompt || node.alt || "";
      return {
        id,
        type: "image",
        revision: node.revision,
        label: cap(label, 120),
        summary: cap(description, 240),
        excerpt: cap(node.alt || node.prompt || "", 240),
      };
    }
    throw new Error("orchestration-folder-hint-invalid");
  });

  const sourceRevisions: Record<string, number> = {};
  for (const hint of nodeHints) {
    sourceRevisions[hint.id] = hint.revision;
  }
  const selectedNodeIds = workspace.runtime.selection.selectedNodeIds.filter(
    (id) => nodeHints.some((hint) => hint.id === id),
  );
  const dialogueHistory = boundedDialogueHistory(messages, MAX_HISTORY).map(
    (message) => ({
      role: message.role,
      content: cap(message.content, 1000),
    }),
  );

  return {
    requestId,
    workspaceId: envelope.workspaceId,
    canvasId: envelope.canvasId,
    runtimeGeneration: envelope.runtimeGeneration,
    scopeEpoch: envelope.scopeEpoch,
    contextDigest: envelope.contextDigest,
    focusText: cap(envelope.focus?.text || "", 1000) || undefined,
    dialogueHistory,
    selectedNodeIds,
    nodeHints,
    relationHints: envelope.relationHints.map((hint) => ({
      relationId: hint.relationId,
      sourceNodeId: hint.sourceNodeId,
      targetNodeId: hint.targetNodeId,
      kind: hint.kind,
      reason: hint.reason,
      provenance: hint.provenance
        ? {
            origin: hint.provenance.origin,
            query: hint.provenance.query,
            url: hint.provenance.url,
            domain: hint.provenance.domain,
            provider: hint.provenance.provider,
            model: hint.provenance.model,
          }
        : undefined,
    })),
    viewHints: envelope.viewHints.map((hint) => ({
      viewId: hint.viewId,
      kind: hint.kind,
      label: hint.label,
    })),
    sourceRevisions,
  };
}

export function eligibleNextActionKinds(
  request: NextActionRequest,
): NextActionKind[] {
  const selected = request.selectedNodeIds
    .map((id) => request.nodeHints.find((hint) => hint.id === id))
    .filter(
      (hint): hint is NextActionNodeHint => Boolean(hint),
    );
  const textCount = selected.filter(
    (hint) => hint.type === "text" || hint.type === "artifact",
  ).length;
  const eligible: NextActionKind[] = ["clarify"];
  if (textCount >= 2) eligible.push("compare");
  if (textCount >= 1) eligible.push("counterpoint");
  const hasTextHint = request.nodeHints.some(
    (hint) => hint.type === "text" || hint.type === "artifact",
  );
  if (
    request.focusText?.trim() ||
    request.dialogueHistory?.length ||
    selected.length ||
    hasTextHint
  ) {
    eligible.push("web_search");
  }
  if (selected.length >= 2) {
    eligible.push("suggest_relations", "suggest_clusters");
  }
  return eligible;
}

/** Preserve typed Wails/provider errors instead of collapsing them to a generic
 * next-actions-failed string. Wails may reject with Error, a string, or a
 * serializable {code,message,error} object depending on the transport. */
export function normalizeNextActionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (isRecord(error)) {
    for (const key of ["code", "message", "error", "details"] as const) {
      const value = error[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (isRecord(value)) {
        const nested = normalizeNextActionError(value);
        if (nested !== "next-actions-failed") return nested;
      }
    }
  }
  return "next-actions-failed";
}

export function isNextActionError(error: unknown): boolean {
  const value = typeof error === "string"
    ? error.trim().toLowerCase()
    : error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code).trim().toLowerCase()
      : "";
  return value.startsWith("next-actions-") || value.startsWith("nextaction.") || value.startsWith("orchestration-") || value.startsWith("orchestration:");
}

export interface NextActionScopeEnvelope {
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  contextDigest: string;
  focusText?: string;
  selectedNodeIds: string[];
}

export function revalidateNextActionScope(
  request: NextActionRequest,
  current: WorkspaceState,
  envelope?: NextActionScopeEnvelope,
): boolean {
  if (
    request.workspaceId !== current.document.workspaceId ||
    request.canvasId !== current.runtime.currentCanvasId ||
    request.runtimeGeneration !== current.runtime.runtimeGeneration ||
    request.scopeEpoch !== current.runtime.scopeEpoch
  ) {
    return false;
  }
  for (const [id, revision] of Object.entries(request.sourceRevisions)) {
    const node = current.document.nodes[id];
    if (
      !node ||
      node.parentCanvasId !== current.runtime.currentCanvasId ||
      node.revision !== revision
    ) {
      return false;
    }
  }
  if (
    envelope &&
    (request.contextDigest !== envelope.contextDigest ||
      (request.focusText || "") !== (envelope.focusText || "") ||
      request.selectedNodeIds.join("\u0000") !==
        envelope.selectedNodeIds.join("\u0000"))
  ) {
    return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// Accept the pre-WP-2 wire prose while reading old provider fixtures. New
// requests/proposals use the semantic codes above; legacy values are normalized
// at this boundary and never need to be rendered by the domain layer.
function matchesSemanticOrLegacy(kind: NextActionKind, field: "documentEffect" | "control", value: unknown): boolean {
  const expected = NEXT_ACTION_MAPPINGS[kind][field];
  if (value === expected) return true;
  const legacy: Record<NextActionKind, Record<"documentEffect" | "control", string>> = {
    clarify: { documentEffect: "変更なし。質問をDialogueへ置く", control: "回答または拒否" },
    compare: { documentEffect: "可逆な派生Text。single undo", control: "取消/undo" },
    counterpoint: { documentEffect: "可逆な派生Text。single undo", control: "取消/undo" },
    web_search: { documentEffect: "Context Packet候補。文書変更なし", control: "dismiss / Promote" },
    suggest_relations: { documentEffect: "Proposalのみ。文書変更なし", control: "Modify / Accept / Reject" },
    suggest_clusters: { documentEffect: "Proposalのみ。文書変更なし", control: "Modify / Accept / Reject / Close" },
  };
  return value === legacy[kind][field];
}

function targetIsAllowed(
  kind: NextActionKind,
  targetIds: string[],
  request: NextActionRequest,
): boolean {
  const selected = new Set(request.selectedNodeIds);
  if (
    targetIds.some((id) => !selected.has(id)) ||
    new Set(targetIds).size !== targetIds.length
  ) {
    return false;
  }
  if (kind === "clarify" || kind === "web_search") {
    return targetIds.length === 0;
  }
  const min = kind === "compare" || kind.startsWith("suggest_") ? 2 : 1;
  if (targetIds.length < min) {
    return false;
  }
  return targetIds.every((id) => {
    const hint = request.nodeHints.find((item) => item.id === id);
    if (!hint) return false;
    if (kind === "compare" || kind === "counterpoint") {
      return hint.type === "text" || hint.type === "artifact";
    }
    return (
      hint.type === "text" ||
      hint.type === "artifact" ||
      hint.type === "image"
    );
  });
}

export function normalizeNextActionProposal(
  value: unknown,
  request: NextActionRequest,
): NextActionProposalSet {
  if (!isRecord(value) || value.requestId !== request.requestId) {
    throw new Error("next-actions-correlation-invalid");
  }
  for (const key of [
    "workspaceId",
    "canvasId",
    "runtimeGeneration",
    "scopeEpoch",
    "contextDigest",
  ] as const) {
    if (value[key] !== request[key]) {
      throw new Error("next-actions-correlation-invalid");
    }
  }
  if (!isRecord(value.sourceRevisions)) {
    throw new Error("next-actions-correlation-invalid");
  }
  const resultRevisions = value.sourceRevisions;
  const expectedKeys = Object.keys(request.sourceRevisions).sort();
  const actualKeys = Object.keys(resultRevisions).sort();
  if (
    expectedKeys.join("\u0000") !== actualKeys.join("\u0000") ||
    actualKeys.some(
      (id) => resultRevisions[id] !== request.sourceRevisions[id],
    )
  ) {
    throw new Error("next-actions-correlation-invalid");
  }
  if (
    !Array.isArray(value.actions) ||
    value.actions.length < 1 ||
    value.actions.length > 3
  ) {
    throw new Error("next-actions-count-invalid");
  }

  const seen = new Set<string>();
  const actions = value.actions.map((raw): NextActionItem => {
    if (!isRecord(raw) || typeof raw.id !== "string" || seen.has(raw.id)) {
      throw new Error("next-actions-id-invalid");
    }
    seen.add(raw.id);
    if (
      !isNextActionKind(raw.kind) ||
      typeof raw.title !== "string" ||
      typeof raw.reason !== "string" ||
      typeof raw.expectedResult !== "string" ||
      !isStringArray(raw.targetNodeIds)
    ) {
      throw new Error("next-actions-item-invalid");
    }
    const kind = raw.kind;
    const mapping = NEXT_ACTION_MAPPINGS[kind];
    if (
      raw.role !== mapping.role ||
      raw.actionLevel !== mapping.actionLevel ||
      raw.route !== mapping.route ||
      !matchesSemanticOrLegacy(kind, "documentEffect", raw.documentEffect) ||
      !matchesSemanticOrLegacy(kind, "control", raw.control)
    ) {
      throw new Error("next-actions-mapping-invalid");
    }
    const title = raw.title.trim();
    const reason = raw.reason.trim();
    const expectedResult = raw.expectedResult.trim();
    if (
      !title ||
      !reason ||
      !expectedResult ||
      title.length > MAX_TITLE ||
      reason.length > MAX_REASON ||
      expectedResult.length > MAX_REASON ||
      !targetIsAllowed(kind, raw.targetNodeIds, request)
    ) {
      throw new Error("next-actions-item-invalid");
    }
    const query =
      raw.query === undefined
        ? undefined
        : typeof raw.query === "string"
          ? raw.query.trim()
          : null;
    const question =
      raw.question === undefined
        ? undefined
        : typeof raw.question === "string"
          ? raw.question.trim()
          : null;
    if (query === null || question === null) {
      throw new Error("next-actions-text-invalid");
    }
    if (kind === "web_search" && (!query || query.length > MAX_QUERY)) {
      throw new Error("search-query-required");
    }
    if (kind === "clarify" && (!question || question.length > MAX_QUESTION)) {
      throw new Error("clarify-question-required");
    }
    return {
      id: raw.id,
      kind,
      ...mapping,
      targetNodeIds: [...raw.targetNodeIds],
      title,
      reason,
      expectedResult,
      ...(query === undefined ? {} : { query }),
      ...(question === undefined ? {} : { question }),
    };
  });
  return {
    requestId: request.requestId,
    workspaceId: request.workspaceId,
    canvasId: request.canvasId,
    runtimeGeneration: request.runtimeGeneration,
    scopeEpoch: request.scopeEpoch,
    contextDigest: request.contextDigest,
    sourceRevisions: { ...request.sourceRevisions },
    actions,
  };
}

export function validateEditedAction(
  item: NextActionItem,
  targets: string[] = item.targetNodeIds,
  query = item.query,
  request?: NextActionRequest,
): boolean {
  const fallback: NextActionRequest = {
    requestId: "edit",
    workspaceId: "workspace",
    canvasId: "canvas",
    runtimeGeneration: "generation",
    scopeEpoch: 0,
    contextDigest: "digest",
    selectedNodeIds: item.targetNodeIds,
    nodeHints: item.targetNodeIds.map((id) => ({
      id,
      type: "text",
      revision: 0,
      label: id,
    })),
    relationHints: [],
    viewHints: [],
    sourceRevisions: Object.fromEntries(
      item.targetNodeIds.map((id) => [id, 0]),
    ),
  };
  return (
    targetIsAllowed(item.kind, targets, request || fallback) &&
    (item.kind !== "web_search" || Boolean(query?.trim()))
  );
}
