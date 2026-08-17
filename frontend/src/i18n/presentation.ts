import { getI18n } from "./i18n";
import type { NextActionKind } from "../domain/orchestration";

type RoleCode = "questioner" | "comparer" | "critic" | "researcher" | "organizer";
type ActionLevelCode = "AL-0" | "AL-1" | "AL-2";
type RouteCode = "dialogue" | "direct-transform" | "direct-web-search" | "direct-relation-suggestion" | "direct-cluster-suggestion";
type DocumentEffectCode = "dialogue" | "transform" | "web-search" | "proposal";
type ControlCode = "answer-dismiss" | "undo" | "dismiss-promote" | "modify-accept-reject" | "modify-accept-reject-close";
type ResultSurfaceCode = "dialogue" | "direct-transform" | "context-packet" | "relation-proposal" | "cluster-proposal";

export interface SemanticPresentation {
  role: RoleCode;
  actionLevel: ActionLevelCode;
  route: RouteCode;
  documentEffect: DocumentEffectCode;
  control: ControlCode;
  resultSurface: ResultSurfaceCode;
}

const PRESENTATION: Record<NextActionKind, SemanticPresentation> = {
  clarify: { role: "questioner", actionLevel: "AL-0", route: "dialogue", documentEffect: "dialogue", control: "answer-dismiss", resultSurface: "dialogue" },
  compare: { role: "comparer", actionLevel: "AL-2", route: "direct-transform", documentEffect: "transform", control: "undo", resultSurface: "direct-transform" },
  counterpoint: { role: "critic", actionLevel: "AL-2", route: "direct-transform", documentEffect: "transform", control: "undo", resultSurface: "direct-transform" },
  web_search: { role: "researcher", actionLevel: "AL-2", route: "direct-web-search", documentEffect: "web-search", control: "dismiss-promote", resultSurface: "context-packet" },
  suggest_relations: { role: "organizer", actionLevel: "AL-1", route: "direct-relation-suggestion", documentEffect: "proposal", control: "modify-accept-reject", resultSurface: "relation-proposal" },
  suggest_clusters: { role: "organizer", actionLevel: "AL-1", route: "direct-cluster-suggestion", documentEffect: "proposal", control: "modify-accept-reject-close", resultSurface: "cluster-proposal" },
};

const assertNever = (value: never): never => { throw new Error(`Unhandled presentation value: ${String(value)}`); };

export function presentationFor(kind: NextActionKind): SemanticPresentation {
  return PRESENTATION[kind];
}

export function presentRole(code: RoleCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "questioner": return t(($) => $.messages.presentation.role.questioner);
    case "comparer": return t(($) => $.messages.presentation.role.comparer);
    case "critic": return t(($) => $.messages.presentation.role.critic);
    case "researcher": return t(($) => $.messages.presentation.role.researcher);
    case "organizer": return t(($) => $.messages.presentation.role.organizer);
    default: return assertNever(code);
  }
}

export function presentActionLevel(code: ActionLevelCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "AL-0": return t(($) => $.messages.presentation.actionLevel.al0);
    case "AL-1": return t(($) => $.messages.presentation.actionLevel.al1);
    case "AL-2": return t(($) => $.messages.presentation.actionLevel.al2);
    default: return assertNever(code);
  }
}

export function presentRoute(code: RouteCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "dialogue": return t(($) => $.messages.presentation.route.dialogue);
    case "direct-transform": return t(($) => $.messages.presentation.route.directTransform);
    case "direct-web-search": return t(($) => $.messages.presentation.route.directWebSearch);
    case "direct-relation-suggestion": return t(($) => $.messages.presentation.route.relationProposal);
    case "direct-cluster-suggestion": return t(($) => $.messages.presentation.route.clusterProposal);
    default: return assertNever(code);
  }
}

export function presentDocumentEffect(code: DocumentEffectCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "dialogue": return t(($) => $.messages.presentation.documentEffect.dialogue);
    case "transform": return t(($) => $.messages.presentation.documentEffect.transform);
    case "web-search": return t(($) => $.messages.presentation.documentEffect.webSearch);
    case "proposal": return t(($) => $.messages.presentation.documentEffect.proposal);
    default: return assertNever(code);
  }
}

export function presentControl(code: ControlCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "answer-dismiss": return t(($) => $.messages.presentation.control.answerDismiss);
    case "undo": return t(($) => $.messages.presentation.control.undo);
    case "dismiss-promote": return t(($) => $.messages.presentation.control.dismissPromote);
    case "modify-accept-reject": return t(($) => $.messages.presentation.control.modifyAcceptReject);
    case "modify-accept-reject-close": return t(($) => $.messages.presentation.control.modifyAcceptRejectClose);
    default: return assertNever(code);
  }
}

export function presentResultSurface(code: ResultSurfaceCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "dialogue": return t(($) => $.messages.presentation.resultSurface.dialogue);
    case "direct-transform": return t(($) => $.messages.presentation.resultSurface.directTransform);
    case "context-packet": return t(($) => $.messages.presentation.resultSurface.contextPacket);
    case "relation-proposal": return t(($) => $.messages.presentation.resultSurface.relationProposal);
    case "cluster-proposal": return t(($) => $.messages.presentation.resultSurface.clusterProposal);
    default: return assertNever(code);
  }
}

export type SemanticStatusCode = "running" | "proposed" | "applied" | "rejected" | "conflict" | "cancelled" | "stale" | "error" | "done" | "pending" | "ready" | "failed";
export type RelationKindCode = "source" | "derived" | "supports" | "opposes" | "similar";
export type RelationDirectionCode = "forward" | "reverse";

export type ChatTargetTypeCode = "artifact" | "text" | "image";
export type ClaimKindCode = "consensus" | "disagreement" | "minority" | "uncertainty" | "freshness";
export type ContextProviderCode = "ollama-web" | "kagi-web" | "brave-web" | "fake-web";
export type ToolOperationCode = "edit" | "transform" | "relation" | "relation-batch" | "generated-view" | "image-variant";

export function presentChatTargetType(code: ChatTargetTypeCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "artifact": return t(($) => $.assistant.targetType.artifact);
    case "text": return t(($) => $.assistant.targetType.text);
    case "image": return t(($) => $.assistant.targetType.image);
    default: return assertNever(code);
  }
}

export function presentClaimKind(code: ClaimKindCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "consensus": return t(($) => $.context.claimKind.consensus);
    case "disagreement": return t(($) => $.context.claimKind.disagreement);
    case "minority": return t(($) => $.context.claimKind.minority);
    case "uncertainty": return t(($) => $.context.claimKind.uncertainty);
    case "freshness": return t(($) => $.context.claimKind.freshness);
    default: return assertNever(code);
  }
}

export function presentContextProvider(code: ContextProviderCode | string): string {
  const t = getI18n().t.bind(getI18n());
  switch (code as ContextProviderCode) {
    case "ollama-web": return t(($) => $.context.provider.ollamaWeb);
    case "kagi-web": return t(($) => $.context.provider.kagiWeb);
    case "brave-web": return t(($) => $.context.provider.braveWeb);
    case "fake-web": return t(($) => $.context.provider.fakeWeb);
    default: return t(($) => $.context.provider.unknown);
  }
}

export function presentPacketStatus(code: "complete" | "partial" | "failed"): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "complete": return t(($) => $.context.packetStatus.complete);
    case "partial": return t(($) => $.context.packetStatus.partial);
    case "failed": return t(($) => $.context.packetStatus.failed);
    default: return assertNever(code);
  }
}

export function presentToolOperation(code: ToolOperationCode | string): string {
  const t = getI18n().t.bind(getI18n());
  switch (code as ToolOperationCode) {
    case "edit": return t(($) => $.assistant.tool.operationValue.edit);
    case "transform": return t(($) => $.assistant.tool.operationValue.transform);
    case "relation": return t(($) => $.assistant.tool.operationValue.relation);
    case "relation-batch": return t(($) => $.assistant.tool.operationValue.relationBatch);
    case "generated-view": return t(($) => $.assistant.tool.operationValue.generatedView);
    case "image-variant": return t(($) => $.assistant.tool.operationValue.imageVariant);
    default: return t(($) => $.assistant.tool.operationValue.unknown);
  }
}

export function presentNextActionKind(code: NextActionKind): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "clarify": return t(($) => $.nextAction.kind.clarify);
    case "compare": return t(($) => $.nextAction.kind.compare);
    case "counterpoint": return t(($) => $.nextAction.kind.counterpoint);
    case "web_search": return t(($) => $.nextAction.kind.webSearch);
    case "suggest_relations": return t(($) => $.nextAction.kind.suggestRelations);
    case "suggest_clusters": return t(($) => $.nextAction.kind.suggestClusters);
    default: return assertNever(code);
  }
}

export function presentStatus(code: SemanticStatusCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "running": return t(($) => $.messages.presentation.status.running);
    case "proposed": return t(($) => $.messages.presentation.status.proposed);
    case "applied": return t(($) => $.messages.presentation.status.applied);
    case "rejected": return t(($) => $.messages.presentation.status.rejected);
    case "conflict": return t(($) => $.messages.presentation.status.conflict);
    case "cancelled": return t(($) => $.messages.presentation.status.cancelled);
    case "stale": return t(($) => $.messages.presentation.status.stale);
    case "error": return t(($) => $.messages.presentation.status.error);
    case "done": return t(($) => $.messages.presentation.status.done);
    case "pending": return t(($) => $.messages.presentation.status.pending);
    case "ready": return t(($) => $.messages.presentation.status.ready);
    case "failed": return t(($) => $.messages.presentation.status.failed);
    default: return assertNever(code);
  }
}

export function presentRelationKind(code: RelationKindCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "source": return t(($) => $.messages.presentation.relation.source);
    case "derived": return t(($) => $.messages.presentation.relation.derived);
    case "supports": return t(($) => $.messages.presentation.relation.supports);
    case "opposes": return t(($) => $.messages.presentation.relation.opposes);
    case "similar": return t(($) => $.messages.presentation.relation.similar);
    default: return assertNever(code);
  }
}

export function presentRelationDirection(code: RelationDirectionCode): string {
  const t = getI18n().t.bind(getI18n());
  switch (code) {
    case "forward": return t(($) => $.messages.presentation.relation.forward);
    case "reverse": return t(($) => $.messages.presentation.relation.reverse);
    default: return assertNever(code);
  }
}

export type DirectOperationCode =
  | "summarize"
  | "compare"
  | "counterpoint"
  | "generate-text"
  | "generate-image"
  | "direct-stale";

/** Translate an operation code at the presentation boundary; raw codes never
 * become visible UI copy. Unknown values intentionally use a generic label. */
export function presentDirectOperation(code: string): string {
  const t = getI18n().t.bind(getI18n());
  switch (code as DirectOperationCode) {
    case "summarize": return t(($) => $.messages.operation.labels.summarize);
    case "compare": return t(($) => $.messages.operation.labels.compare);
    case "counterpoint": return t(($) => $.messages.operation.labels.counterpoint);
    case "generate-text": return t(($) => $.messages.operation.labels.generateText);
    case "generate-image": return t(($) => $.messages.operation.labels.generateImage);
    case "direct-stale": return t(($) => $.messages.operation.labels.directStale);
    default: return t(($) => $.messages.operation.labels.unknown);
  }
}

export function presentAction(kind: NextActionKind): SemanticPresentation & Record<`${string}Label`, string> {
  const value = presentationFor(kind);
  return {
    ...value,
    roleLabel: presentRole(value.role),
    actionLevelLabel: presentActionLevel(value.actionLevel),
    routeLabel: presentRoute(value.route),
    documentEffectLabel: presentDocumentEffect(value.documentEffect),
    controlLabel: presentControl(value.control),
    resultSurfaceLabel: presentResultSurface(value.resultSurface),
  };
}
