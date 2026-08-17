import {
  GetImageDataURL,
  ResolveToolApplication,
} from "../../../wailsjs/go/main/App";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { useChatStore } from "../../store/useChatStore";
import { ChatToolEvent, ChatToolProposal } from "../../types/chat";
import { isTextBearing } from "../../domain/workspace";
import { presentUiMessage, type UiMessageDescriptor } from "../../i18n/messages";
import { presentDirectOperation, presentRelationDirection, presentRelationKind, presentStatus, presentToolOperation } from "../../i18n/presentation";

function correlation(proposal: NonNullable<ChatToolEvent["proposal"]>) {
  return {
    workspaceId: proposal.workspaceId,
    canvasId: proposal.canvasId,
    runtimeGeneration: proposal.runtimeGeneration,
    scopeEpoch: proposal.scopeEpoch,
    runEpoch: proposal.runEpoch,
  };
}

type RelationDraft = NonNullable<ChatToolProposal["relation"]>;
type SuggestedRelation = NonNullable<NonNullable<ChatToolProposal["transform"]>["suggestedRelations"]>[number];

function previewText(content: string, max = 180) {
  const trimmed = content.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export default function ToolCard({
  event,
  sessionId,
  runId,
}: {
  event: ChatToolEvent;
  sessionId?: string;
  runId?: string;
}) {
  const { t } = useTranslation();
  const proposal = event.proposal;
  const workspace = useAppStore((state) => state.workspace);
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedContent, setModifiedContent] = useState(proposal?.proposed || proposal?.transform?.content || "");
  const [modifiedReason, setModifiedReason] = useState(
    proposal?.transform?.reason || proposal?.relation?.reason || "",
  );
  const [modifiedRelation, setModifiedRelation] = useState<RelationDraft | null>(
    proposal?.relation ? { ...proposal.relation } : null,
  );
  const [modifiedSuggested, setModifiedSuggested] = useState<SuggestedRelation[]>(
    proposal?.transform?.suggestedRelations ? [...proposal.transform.suggestedRelations] : [],
  );
  const [excludedBatch, setExcludedBatch] = useState<Set<number>>(new Set());
  const [imagePreviewURL, setImagePreviewURL] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState<UiMessageDescriptor | null>(null);

  useEffect(() => {
    const src = proposal?.imageVariant?.src;
    if (!src) {
      setImagePreviewURL(null);
      setImagePreviewError(null);
      return;
    }
    let active = true;
    setImagePreviewURL(null);
    setImagePreviewError(null);
    void GetImageDataURL(src)
      .then((dataURL) => {
        if (active) setImagePreviewURL(dataURL);
      })
      .catch((error) => {
        console.error("Failed to load image preview:", error);
        if (active) {
          setImagePreviewError({ code: "tool.imagePreviewFailed" });
        }
      });
    return () => {
      active = false;
    };
  }, [proposal?.imageVariant?.src]);

  const sourcePreviews = useMemo(() => {
    if (!proposal?.transform) return [];
    const fromProposal = proposal.transform.sources ?? [];
    if (fromProposal.length) {
      return fromProposal.map((source) => ({
        nodeId: source.nodeId,
        revision: source.revision,
        content: source.content,
      }));
    }
    return (proposal.transform.sourceNodeIds || []).map((nodeId) => {
      const node = workspace.document.nodes[nodeId];
      return {
        nodeId,
        revision: proposal.transform?.sourceRevisions?.[nodeId] ?? (node?.revision ?? 0),
        content: node && isTextBearing(node) ? node.content : t($ => $.assistant.tool.sourceFallback, { id: nodeId }),
      };
    });
  }, [proposal, workspace.document.nodes, t]);

  const decide = async (decision: "accept" | "modify" | "reject") => {
    if (!proposal) return;
    let modified: any;
    if (decision === "modify") {
      if (proposal.operation === "transform") {
        modified = {
          content: modifiedContent,
          reason: modifiedReason,
          suggestedRelations: modifiedSuggested,
        };
      } else if (proposal.operation === "relation-batch" && proposal.relationBatch) {
        modified = {
          relations: proposal.relationBatch.relations.filter(
            (_, index) => !excludedBatch.has(index),
          ),
        };
      } else if (proposal.operation === "relation" && modifiedRelation) {
        modified = { relation: modifiedRelation, content: modifiedContent, reason: modifiedReason };
      } else {
        modified = modifiedContent;
      }
    }
    const result = useAppStore.getState().decideToolProposal(proposal, decision, runId, modified);
    if (decision === "reject" || result.status === "rejected") {
      useChatStore.getState().upsertToolEvent(sessionId || "", runId || "", {
        ...event,
        status: "rejected",
        summaryDescriptor: { code: "tool.rejectedByUser" },
      });
      await ResolveToolApplication({
        toolCallId: proposal.toolCallId,
        status: "cancelled",
        error: "rejected_by_user",
        ...correlation(proposal),
      }).catch(() => undefined);
      return;
    }
    const status =
      result.status === "applied"
        ? "applied"
        : result.status === "conflict"
          ? "conflict"
          : result.error?.includes("stale")
            ? "stale"
            : "error";
    if (sessionId && runId) {
      useChatStore.getState().upsertToolEvent(sessionId, runId, {
        ...event,
        status,
        error: result.error,
        summaryDescriptor: decision === "modify" && status === "applied" ? { code: "tool.modifiedApplied" } : undefined,
      });
    }
    await ResolveToolApplication({
      toolCallId: proposal.toolCallId,
      status:
        result.status === "applied"
          ? "applied"
          : result.status === "conflict"
            ? "conflict"
            : "error",
      error: result.error,
      ...correlation(proposal),
    }).catch(() => undefined);
    setIsModifying(false);
  };

  const reverseRelationDraft = () => {
    if (!modifiedRelation) return;
    setModifiedRelation({
      ...modifiedRelation,
      sourceNodeId: modifiedRelation.targetNodeId,
      targetNodeId: modifiedRelation.sourceNodeId,
      direction: modifiedRelation.direction === "reverse" ? "forward" : "reverse",
    });
  };

  return (
    <div
      className="my-1 rounded border border-gray-200 bg-white/70 px-2 py-1.5 text-xs text-gray-600"
      role="group"
      aria-label={t($ => $.assistant.tool.proposalAria, { status: presentStatus(event.status as Parameters<typeof presentStatus>[0]) })}
      data-testid={`tool-card-${event.toolCallId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{event.name}</span>
        <span
          className={
            event.status === "conflict" || event.status === "error" || event.status === "stale"
              ? "text-red-600"
              : event.status === "applied"
                ? "text-green-700"
                : "text-gray-500"
          }
        >
          {presentStatus(event.status as Parameters<typeof presentStatus>[0])}
        </span>
      </div>

      {event.packet && (
        <div className="mt-1 space-y-1 text-[11px]">
          <div>{t($ => $.assistant.tool.packetQuery, { query: event.packet.query })}</div>
          <div>
            {t($ => $.assistant.tool.packetCounts.sources, { count: event.packet.sources.length })}
            {t($ => $.assistant.tool.packetCounts.separator)}
            {t($ => $.assistant.tool.packetCounts.claims, { count: event.packet.claims.length })}
          </div>
          <button
            type="button"
            className="font-semibold text-sky-800 underline"
            aria-label={t($ => $.assistant.tool.openProjectedContext)}
            onClick={() => useAppStore.getState().applyIncomingPacket(event.packet!, "dialogue-agent")}
          >
            {t($ => $.assistant.tool.openProjectedContext)}
          </button>
        </div>
      )}

      {proposal && (
        <div className="mt-1 space-y-1 text-[11px] text-gray-600" data-testid="proposal-metadata">
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.proposalId)}</span> {proposal.toolCallId}
          </div>
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.operation)}</span> {presentToolOperation(proposal.operation)}
            {proposal.transform?.operation ? t($ => $.assistant.tool.operationVariant, { operation: presentToolOperation(proposal.operation), variant: presentDirectOperation(proposal.transform.operation) }) : ""}
          </div>
          {(proposal.canvasId || proposal.workspaceId) && (
            <div>
              <span className="font-semibold">{t($ => $.assistant.tool.placement)}</span> {t($ => $.assistant.tool.placementValue, { canvas: proposal.canvasId || t($ => $.assistant.tool.current), workspace: proposal.workspaceId || t($ => $.assistant.tool.current) })}
            </div>
          )}
        </div>
      )}

      {(proposal?.targetNodeId || proposal?.nodeId) && proposal?.operation !== "transform" && proposal?.operation !== "relation" && (
        <div className="mt-1 truncate text-gray-500">
          {t($ => $.assistant.tool.target)} {proposal.targetNodeId || proposal.nodeId}
        </div>
      )}

      {proposal?.operation === "edit" && (
        <div className="mt-1 grid grid-cols-2 gap-1">
          <div className="rounded bg-red-50 p-1 line-through">{proposal.searchText}</div>
          <div className="rounded bg-green-50 p-1">{proposal.replacement}</div>
        </div>
      )}

      {proposal?.operation === "transform" && proposal.transform && (
        <div className="mt-2 space-y-2" data-testid="transform-comparison">
          <div className="font-semibold text-gray-700">{t($ => $.assistant.tool.sourceOutputComparison)}</div>
          {sourcePreviews.map((source) => (
            <div key={source.nodeId} className="grid grid-cols-2 gap-1" data-testid={`source-preview-${source.nodeId}`}>
              <div className="rounded bg-red-50 p-1">
                <div className="mb-0.5 font-semibold text-red-800">
                  {t($ => $.assistant.tool.sourceRevision, { id: source.nodeId, revision: source.revision })}
                </div>
                <div className="max-h-20 overflow-auto whitespace-pre-wrap">{previewText(source.content)}</div>
              </div>
              <div className="rounded bg-green-50 p-1">
                <div className="mb-0.5 font-semibold text-green-800">{t($ => $.assistant.tool.outputPreview)}</div>
                <div className="max-h-20 overflow-auto whitespace-pre-wrap">
                  {previewText(isModifying ? modifiedContent : proposal.transform!.content)}
                </div>
              </div>
            </div>
          ))}
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.reason)}</span>{" "}
            {isModifying ? (
              <input
                aria-label={t($ => $.assistant.tool.modifiedReasonAria)}
                className="ml-1 rounded border border-blue-300 px-1 py-0.5"
                value={modifiedReason}
                onChange={(event) => setModifiedReason(event.target.value)}
              />
            ) : (
              proposal.transform.reason || t($ => $.assistant.tool.none)
            )}
          </div>
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.baseRevisions)}</span>{" "}
            {Object.entries(proposal.transform.sourceRevisions || {})
              .map(([id, rev]) => t($ => $.assistant.tool.baseRevisionValue, { id, revision: rev }))
              .join(", ")}
          </div>
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.provenance)}</span> {t($ => $.assistant.tool.provenanceValue, { origin: t($ => $.assistant.tool.originLlm), provider: proposal.transform.provenance?.provider ? ` · ${proposal.transform.provenance.provider}` : "", model: proposal.transform.provenance?.model ? ` / ${proposal.transform.provenance.model}` : "" })}
          </div>
          <div data-testid="suggested-relations">
            <div className="font-semibold">{t($ => $.assistant.tool.suggestedRelation)}</div>
            {(isModifying ? modifiedSuggested : proposal.transform.suggestedRelations || []).length === 0 && (
              <div className="text-gray-400">{t($ => $.assistant.tool.none)}</div>
            )}
            {(isModifying ? modifiedSuggested : proposal.transform.suggestedRelations || []).map((relation, index) => (
              <div key={`${relation.sourceNodeId}-${index}`} className="mt-1 rounded border border-gray-100 p-1">
                {isModifying ? (
                  <div className="grid gap-1">
                    <label className="flex items-center gap-1">
                      {t($ => $.assistant.tool.kind)}
                      <select
                        aria-label={t($ => $.assistant.tool.suggestedKindAria, { index: index + 1 })}
                        value={relation.kind}
                        onChange={(event) => {
                          const next = [...modifiedSuggested];
                          next[index] = { ...relation, kind: event.target.value as SuggestedRelation["kind"] };
                          setModifiedSuggested(next);
                        }}
                      >
                        {["source", "derived", "supports", "opposes", "similar"].map((kind) => (
                          <option key={kind} value={kind}>
                            {presentRelationKind(kind as Parameters<typeof presentRelationKind>[0])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      {t($ => $.assistant.tool.direction)}
                      <select
                        aria-label={t($ => $.assistant.tool.suggestedDirectionAria, { index: index + 1 })}
                        value={relation.direction || "forward"}
                        onChange={(event) => {
                          const next = [...modifiedSuggested];
                          const direction = event.target.value as "forward" | "reverse";
                          next[index] = {
                            ...relation,
                            direction,
                            sourceNodeId: direction === "reverse" && relation.targetNodeId
                              ? relation.targetNodeId
                              : relation.sourceNodeId,
                            targetNodeId:
                              direction === "reverse"
                                ? relation.sourceNodeId
                                : relation.targetNodeId,
                          };
                          setModifiedSuggested(next);
                        }}
                      >
                        <option value="forward">{t($ => $.assistant.tool.forward)}</option>
                        <option value="reverse">{t($ => $.assistant.tool.reverse)}</option>
                      </select>
                    </label>
                    <input
                      aria-label={t($ => $.assistant.tool.suggestedReasonAria, { index: index + 1 })}
                      className="rounded border border-blue-300 px-1 py-0.5"
                      value={relation.reason || ""}
                      onChange={(event) => {
                        const next = [...modifiedSuggested];
                        next[index] = { ...relation, reason: event.target.value };
                        setModifiedSuggested(next);
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    {relation.reason
                      ? t($ => $.assistant.tool.relationPreviewWithReason, { source: relation.sourceNodeId, target: relation.targetNodeId || t($ => $.assistant.tool.derivedOutput), kind: presentRelationKind(relation.kind as Parameters<typeof presentRelationKind>[0]), reason: relation.reason })
                      : t($ => $.assistant.tool.relationPreview, { source: relation.sourceNodeId, target: relation.targetNodeId || t($ => $.assistant.tool.derivedOutput), kind: presentRelationKind(relation.kind as Parameters<typeof presentRelationKind>[0]) })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {proposal?.operation === "relation" && proposal.relation && (
        <div className="mt-2 space-y-1" data-testid="relation-proposal">
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.relationSource)}</span>{" "}
            {(isModifying ? modifiedRelation : proposal.relation)?.sourceNodeId}
          </div>
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.relationTarget)}</span>{" "}
            {(isModifying ? modifiedRelation : proposal.relation)?.targetNodeId}
          </div>
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.relationKind)}</span>{" "}
            {isModifying && modifiedRelation ? (
              <select
                aria-label={t($ => $.assistant.tool.modifiedKindAria)}
                value={modifiedRelation.kind}
                onChange={(event) =>
                  setModifiedRelation({
                    ...modifiedRelation,
                    kind: event.target.value as RelationDraft["kind"],
                  })
                }
              >
                {["source", "derived", "supports", "opposes", "similar"].map((kind) => (
                  <option key={kind} value={kind}>
                    {presentRelationKind(kind as Parameters<typeof presentRelationKind>[0])}
                  </option>
                ))}
              </select>
            ) : (
              presentRelationKind(proposal.relation.kind as Parameters<typeof presentRelationKind>[0])
            )}
          </div>
          <div>
            <span className="font-semibold">{t($ => $.assistant.tool.reason)}</span>{" "}
            {isModifying ? (
              <input
                aria-label={t($ => $.assistant.tool.modifiedRelationReasonAria)}
                className="rounded border border-blue-300 px-1 py-0.5"
                value={modifiedReason}
                onChange={(event) => {
                  setModifiedReason(event.target.value);
                  if (modifiedRelation) {
                    setModifiedRelation({ ...modifiedRelation, reason: event.target.value });
                  }
                }}
              />
            ) : (
              proposal.relation.reason || t($ => $.assistant.tool.none)
            )}
          </div>
          {isModifying && (
            <button
              type="button"
              className="rounded bg-slate-600 px-2 py-1 text-[11px] font-bold text-white"
              aria-label={t($ => $.assistant.tool.reverseProposal)}
              onClick={reverseRelationDraft}
            >
              {t($ => $.assistant.tool.reverse)}
            </button>
          )}
        </div>
      )}

      {proposal?.operation === "relation-batch" && proposal.relationBatch && (
        <div className="mt-2 space-y-1" data-testid="relation-batch-proposal">
          <div className="font-semibold">{t($ => $.assistant.tool.relationBatchPreview)}</div>
          {proposal.relationBatch.relations.map((relation, index) => (
            <label
              key={`${relation.sourceNodeId}-${relation.targetNodeId}-${index}`}
              className="flex items-center gap-2 rounded border border-gray-100 p-1"
            >
              <input
                type="checkbox"
                aria-label={t($ => $.assistant.tool.includeRelationAria, { index: index + 1 })}
                checked={!excludedBatch.has(index)}
                onChange={() =>
                  setExcludedBatch((previous) => {
                    const next = new Set(previous);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
              />
              <span>
                {relation.reason
                  ? t($ => $.assistant.tool.relationPreviewWithReason, { source: relation.sourceNodeId, target: relation.targetNodeId, kind: presentRelationKind(relation.kind as Parameters<typeof presentRelationKind>[0]), reason: relation.reason })
                  : t($ => $.assistant.tool.relationPreview, { source: relation.sourceNodeId, target: relation.targetNodeId, kind: presentRelationKind(relation.kind as Parameters<typeof presentRelationKind>[0]) })}
              </span>
            </label>
          ))}
          <div className="text-[10px] text-gray-500">
            {Object.entries(proposal.relationBatch.sourceRevisions)
              .map(([id, revision]) => t($ => $.assistant.tool.baseRevisionValue, { id, revision }))
              .join(", ")}
          </div>
          <button
            type="button"
            className="rounded bg-green-700 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
            aria-label={t($ => $.assistant.tool.acceptSelectedRelationsAria)}
            data-proposal-decision="accept"
            disabled={proposal.relationBatch.relations.every((_, index) => excludedBatch.has(index))}
            onClick={() => void decide("modify")}
          >
            {t($ => $.proposal.acceptSelected, { count: proposal.relationBatch.relations.length - excludedBatch.size })}
          </button>
        </div>
      )}

      {proposal?.operation === "generated-view" && proposal.generatedView && (
        <div className="mt-2 space-y-1" data-testid="generated-view-proposal">
          <div className="font-semibold">{t($ => $.assistant.tool.generatedViewPreview, { label: proposal.generatedView.viewLabel })}</div>
          {proposal.generatedView.clusters.map((cluster) => (
            <div key={cluster.label} className="rounded border border-gray-100 p-1">
              <div className="font-semibold">
                {cluster.label}
                {cluster.reason ? ` · ${cluster.reason}` : ""}
              </div>
              <div className="font-mono text-[10px]">{cluster.nodeIds.join(", ")}</div>
            </div>
          ))}
          {proposal.generatedView.ungroupedNodeIds.length > 0 && (
            <div className="text-gray-500">
              {t($ => $.proposal.ungroupedValue, { nodes: proposal.generatedView.ungroupedNodeIds.join(", ") })}
            </div>
          )}
        </div>
      )}

      {proposal?.operation === "image-variant" && proposal.imageVariant && (
        <div className="mt-2 space-y-1" data-testid="image-variant-proposal">
          <div className="font-semibold text-gray-700">{t($ => $.assistant.tool.generatedImagePreview)}</div>
          <div className="flex min-h-40 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-100">
            {!imagePreviewURL && !imagePreviewError && (
              <span className="text-xs text-gray-500">{t($ => $.assistant.tool.imageLoading)}</span>
            )}
            {imagePreviewError && (
              <span className="p-3 text-xs text-red-600" role="alert">
                {presentUiMessage(imagePreviewError)}
              </span>
            )}
            {imagePreviewURL && (
              <img
                src={imagePreviewURL}
                alt={t($ => $.assistant.tool.imageAlt, { prompt: proposal.imageVariant.prompt })}
                className="max-h-80 w-full object-contain"
              />
            )}
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-1">
            <div className="text-[10px] text-gray-500">{t($ => $.assistant.tool.assetValue, { value: proposal.imageVariant.src })}</div>
            <div className="text-[10px] text-gray-500">{t($ => $.assistant.tool.promptValue, { value: proposal.imageVariant.prompt })}</div>
            {proposal.imageVariant.provider && (
              <div className="text-[10px] text-gray-500">{t($ => $.assistant.tool.providerValue, { value: proposal.imageVariant.provider })}</div>
            )}
          </div>
          <div>
            {t($ => $.assistant.tool.sourceList, { sources: (proposal.imageVariant.sourceNodeIds || []).length === 0
              ? t($ => $.assistant.tool.promptOnly)
              : proposal.imageVariant.sourceNodeIds
                  .map((id) => t($ => $.assistant.tool.baseRevisionValue, { id, revision: proposal.imageVariant?.sourceRevisions?.[id] ?? "?" }))
                  .join(", ") })}
          </div>
        </div>
      )}

      {proposal?.operation !== "edit" &&
        proposal?.operation !== "transform" &&
        proposal?.operation !== "relation" &&
        proposal?.filename && <div className="mt-1 truncate">{proposal.filename}</div>}
      {proposal?.proposed &&
        proposal.operation !== "edit" &&
        proposal.operation !== "transform" &&
        proposal.operation !== "relation" && (
          <div className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-1">
            {proposal.proposed.slice(0, 400)}
          </div>
        )}

      {(event.error || event.errorDescriptor) && (
        <div className="mt-1 rounded border border-red-200 bg-red-50 p-1 text-red-700" role="alert">
          <div>{presentUiMessage(event.errorDescriptor ?? { code: "operation.failed" })}</div>
          <div className="mt-1 text-[10px] text-red-600">
            {t($ => $.assistant.tool.recovery)}
          </div>
        </div>
      )}
      {event.summaryDescriptor && <div className="mt-1 truncate text-gray-500">{presentUiMessage(event.summaryDescriptor)}</div>}

      {event.status === "proposed" && proposal && (
        <div className="mt-2 flex flex-wrap gap-2">
          {isModifying &&
            proposal.operation !== "relation" &&
            proposal.operation !== "transform" &&
            proposal.operation !== "relation-batch" &&
            proposal.operation !== "generated-view" && (
            <textarea
              value={modifiedContent}
              onChange={(event) => setModifiedContent(event.target.value)}
              aria-label={t($ => $.assistant.tool.modifiedProposalAria)}
              className="min-h-16 flex-1 rounded border border-blue-300 p-1 text-[11px]"
            />
          )}
          {isModifying && proposal.operation === "transform" && (
            <textarea
              value={modifiedContent}
              onChange={(event) => setModifiedContent(event.target.value)}
              aria-label={t($ => $.assistant.tool.modifiedProposalAria)}
              className="min-h-16 w-full rounded border border-blue-300 p-1 text-[11px]"
            />
          )}
          <button
            type="button"
            className="rounded bg-green-600 px-2 py-1 text-[11px] font-bold text-white"
            aria-label={t($ => $.assistant.tool.acceptAria)}
            data-tool-decision="accept"
            data-testid="tool-decision-accept"
            onClick={() => void decide("accept")}
          >
            {t($ => $.assistant.tool.accept)}
          </button>
          <button
            type="button"
            className="rounded bg-gray-600 px-2 py-1 text-[11px] font-bold text-white"
            aria-label={t($ => $.assistant.tool.rejectAria)}
            data-tool-decision="reject"
            data-testid="tool-decision-reject"
            onClick={() => void decide("reject")}
          >
            {t($ => $.assistant.tool.reject)}
          </button>
          {!isModifying &&
            proposal.operation !== "relation-batch" &&
            proposal.operation !== "generated-view" && (
            <button
              type="button"
              className="rounded bg-blue-600 px-2 py-1 text-[11px] font-bold text-white"
              aria-label={t($ => $.assistant.tool.modifyAria)}
              data-testid="tool-decision-modify"
              onClick={() => setIsModifying(true)}
            >
              {t($ => $.assistant.tool.modify)}
            </button>
          )}
          {isModifying && (
            <button
              type="button"
              className="rounded bg-blue-700 px-2 py-1 text-[11px] font-bold text-white"
              aria-label={t($ => $.assistant.tool.applyModifiedAria)}
              data-testid="tool-decision-apply-modified"
              onClick={() => void decide("modify")}
            >
              {t($ => $.assistant.tool.applyModified)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
