import {
  GetImageDataURL,
  ResolveToolApplication,
} from "../../../wailsjs/go/main/App";
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useChatStore } from "../../store/useChatStore";
import { ChatToolEvent, ChatToolProposal } from "../../types/chat";
import { isTextBearing } from "../../domain/workspace";

function correlation(proposal: NonNullable<ChatToolEvent["proposal"]>) {
  return {
    workspaceId: proposal.workspaceId,
    canvasId: proposal.canvasId,
    runtimeGeneration: proposal.runtimeGeneration,
    scopeEpoch: proposal.scopeEpoch,
    runEpoch: proposal.runEpoch,
  };
}

const labels: Record<string, string> = {
  running: "実行中",
  proposed: "提案",
  applied: "適用済み",
  rejected: "拒否",
  conflict: "競合で拒否",
  cancelled: "キャンセル",
  stale: "無効 (stale)",
  error: "エラー",
  done: "完了",
};

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
  const [imagePreviewURL, setImagePreviewURL] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState<string | null>(null);

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
        if (active) {
          setImagePreviewError(
            error instanceof Error ? error.message : "画像を読み込めませんでした",
          );
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
        content: node && isTextBearing(node) ? node.content : `(source ${nodeId})`,
      };
    });
  }, [proposal, workspace.document.nodes]);

  const decide = async (decision: "accept" | "modify" | "reject") => {
    if (!proposal) return;
    const modified =
      decision === "modify"
        ? proposal.operation === "transform"
          ? {
              content: modifiedContent,
              reason: modifiedReason,
              suggestedRelations: modifiedSuggested,
            }
          : proposal.operation === "relation" && modifiedRelation
            ? { relation: modifiedRelation, content: modifiedContent, reason: modifiedReason }
            : modifiedContent
        : undefined;
    const result = useAppStore.getState().decideToolProposal(proposal, decision, runId, modified);
    if (decision === "reject" || result.status === "rejected") {
      useChatStore.getState().upsertToolEvent(sessionId || "", runId || "", {
        ...event,
        status: "rejected",
        summary: "rejected by user",
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
        summary: decision === "modify" && status === "applied" ? "modified and applied" : status,
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
      aria-label={`Proposal ${event.status}`}
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
          {labels[event.status] ?? event.status}
        </span>
      </div>

      {event.packet && (
        <div className="mt-1 space-y-1 text-[11px]">
          <div>query: {event.packet.query}</div>
          <div>{event.packet.sources.length} sources · {event.packet.claims.length} claims</div>
          <button
            type="button"
            className="font-semibold text-sky-800 underline"
            aria-label="Open projected context"
            onClick={() => useAppStore.getState().applyIncomingPacket(event.packet!, "dialogue-agent")}
          >
            Open projected context
          </button>
        </div>
      )}

      {proposal && (
        <div className="mt-1 space-y-1 text-[11px] text-gray-600" data-testid="proposal-metadata">
          <div>
            <span className="font-semibold">Proposal ID:</span> {proposal.toolCallId}
          </div>
          <div>
            <span className="font-semibold">operation:</span> {proposal.operation}
            {proposal.transform?.operation ? ` / ${proposal.transform.operation}` : ""}
          </div>
          {(proposal.canvasId || proposal.workspaceId) && (
            <div>
              <span className="font-semibold">placement:</span> canvas {proposal.canvasId || "current"} · workspace{" "}
              {proposal.workspaceId || "current"}
            </div>
          )}
        </div>
      )}

      {(proposal?.targetNodeId || proposal?.nodeId) && proposal?.operation !== "transform" && proposal?.operation !== "relation" && (
        <div className="mt-1 truncate text-gray-500">
          対象: {proposal.targetNodeId || proposal.nodeId}
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
          <div className="font-semibold text-gray-700">Source → Output comparison</div>
          {sourcePreviews.map((source) => (
            <div key={source.nodeId} className="grid grid-cols-2 gap-1" data-testid={`source-preview-${source.nodeId}`}>
              <div className="rounded bg-red-50 p-1">
                <div className="mb-0.5 font-semibold text-red-800">
                  source {source.nodeId} · rev {source.revision}
                </div>
                <div className="max-h-20 overflow-auto whitespace-pre-wrap">{previewText(source.content)}</div>
              </div>
              <div className="rounded bg-green-50 p-1">
                <div className="mb-0.5 font-semibold text-green-800">output preview</div>
                <div className="max-h-20 overflow-auto whitespace-pre-wrap">
                  {previewText(isModifying ? modifiedContent : proposal.transform!.content)}
                </div>
              </div>
            </div>
          ))}
          <div>
            <span className="font-semibold">reason:</span>{" "}
            {isModifying ? (
              <input
                aria-label="Modified transform reason"
                className="ml-1 rounded border border-blue-300 px-1 py-0.5"
                value={modifiedReason}
                onChange={(event) => setModifiedReason(event.target.value)}
              />
            ) : (
              proposal.transform.reason || "(none)"
            )}
          </div>
          <div>
            <span className="font-semibold">base revisions:</span>{" "}
            {Object.entries(proposal.transform.sourceRevisions || {})
              .map(([id, rev]) => `${id}@${rev}`)
              .join(", ")}
          </div>
          <div>
            <span className="font-semibold">provenance:</span> origin=llm
            {proposal.transform.provenance?.provider ? ` · ${proposal.transform.provenance.provider}` : ""}
            {proposal.transform.provenance?.model ? ` / ${proposal.transform.provenance.model}` : ""}
          </div>
          <div data-testid="suggested-relations">
            <div className="font-semibold">suggested Relation</div>
            {(isModifying ? modifiedSuggested : proposal.transform.suggestedRelations || []).length === 0 && (
              <div className="text-gray-400">none</div>
            )}
            {(isModifying ? modifiedSuggested : proposal.transform.suggestedRelations || []).map((relation, index) => (
              <div key={`${relation.sourceNodeId}-${index}`} className="mt-1 rounded border border-gray-100 p-1">
                {isModifying ? (
                  <div className="grid gap-1">
                    <label className="flex items-center gap-1">
                      kind
                      <select
                        aria-label={`Suggested relation kind ${index + 1}`}
                        value={relation.kind}
                        onChange={(event) => {
                          const next = [...modifiedSuggested];
                          next[index] = { ...relation, kind: event.target.value as SuggestedRelation["kind"] };
                          setModifiedSuggested(next);
                        }}
                      >
                        {["source", "derived", "supports", "opposes", "similar"].map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      direction
                      <select
                        aria-label={`Suggested relation direction ${index + 1}`}
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
                        <option value="forward">forward</option>
                        <option value="reverse">reverse</option>
                      </select>
                    </label>
                    <input
                      aria-label={`Suggested relation reason ${index + 1}`}
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
                    {relation.sourceNodeId}
                    {" → "}
                    {relation.targetNodeId || "(derived output)"} · {relation.kind}
                    {relation.reason ? ` · ${relation.reason}` : ""}
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
            <span className="font-semibold">source:</span>{" "}
            {(isModifying ? modifiedRelation : proposal.relation)?.sourceNodeId}
          </div>
          <div>
            <span className="font-semibold">target:</span>{" "}
            {(isModifying ? modifiedRelation : proposal.relation)?.targetNodeId}
          </div>
          <div>
            <span className="font-semibold">kind:</span>{" "}
            {isModifying && modifiedRelation ? (
              <select
                aria-label="Modified relation kind"
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
                    {kind}
                  </option>
                ))}
              </select>
            ) : (
              proposal.relation.kind
            )}
          </div>
          <div>
            <span className="font-semibold">reason:</span>{" "}
            {isModifying ? (
              <input
                aria-label="Modified relation reason"
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
              proposal.relation.reason || "(none)"
            )}
          </div>
          {isModifying && (
            <button
              type="button"
              className="rounded bg-slate-600 px-2 py-1 text-[11px] font-bold text-white"
              aria-label="Reverse proposed relation"
              onClick={reverseRelationDraft}
            >
              Reverse
            </button>
          )}
        </div>
      )}

      {proposal?.operation === "image-variant" && proposal.imageVariant && (
        <div className="mt-2 space-y-1" data-testid="image-variant-proposal">
          <div className="font-semibold text-gray-700">Generated image preview</div>
          <div className="flex min-h-40 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-100">
            {!imagePreviewURL && !imagePreviewError && (
              <span className="text-xs text-gray-500">画像を読み込み中…</span>
            )}
            {imagePreviewError && (
              <span className="p-3 text-xs text-red-600" role="alert">
                Preview unavailable: {imagePreviewError}
              </span>
            )}
            {imagePreviewURL && (
              <img
                src={imagePreviewURL}
                alt={`Generated proposal: ${proposal.imageVariant.prompt}`}
                className="max-h-80 w-full object-contain"
              />
            )}
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-1">
            <div className="text-[10px] text-gray-500">asset: {proposal.imageVariant.src}</div>
            <div className="text-[10px] text-gray-500">prompt: {proposal.imageVariant.prompt}</div>
            {proposal.imageVariant.provider && (
              <div className="text-[10px] text-gray-500">provider: {proposal.imageVariant.provider}</div>
            )}
          </div>
          <div>
            <span className="font-semibold">sources:</span>{" "}
            {(proposal.imageVariant.sourceNodeIds || []).length === 0
              ? "(prompt only)"
              : proposal.imageVariant.sourceNodeIds
                  .map((id) => `${id}@${proposal.imageVariant?.sourceRevisions?.[id] ?? "?"}`)
                  .join(", ")}
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

      {event.error && (
        <div className="mt-1 rounded border border-red-200 bg-red-50 p-1 text-red-700" role="alert">
          <div>{event.error}</div>
          <div className="mt-1 text-[10px] text-red-600">
            次の操作: Reject で閉じる、Modify で内容を直す、Undo で直前適用を戻す、再送で retry。
          </div>
        </div>
      )}
      {event.summary && <div className="mt-1 truncate text-gray-500">{event.summary}</div>}

      {event.status === "proposed" && proposal && (
        <div className="mt-2 flex flex-wrap gap-2">
          {isModifying && proposal.operation !== "relation" && proposal.operation !== "transform" && (
            <textarea
              value={modifiedContent}
              onChange={(event) => setModifiedContent(event.target.value)}
              aria-label="Modified proposal content"
              className="min-h-16 flex-1 rounded border border-blue-300 p-1 text-[11px]"
            />
          )}
          {isModifying && proposal.operation === "transform" && (
            <textarea
              value={modifiedContent}
              onChange={(event) => setModifiedContent(event.target.value)}
              aria-label="Modified proposal content"
              className="min-h-16 w-full rounded border border-blue-300 p-1 text-[11px]"
            />
          )}
          <button
            type="button"
            className="rounded bg-green-600 px-2 py-1 text-[11px] font-bold text-white"
            aria-label="Accept proposal"
            onClick={() => void decide("accept")}
          >
            Accept
          </button>
          <button
            type="button"
            className="rounded bg-gray-600 px-2 py-1 text-[11px] font-bold text-white"
            aria-label="Reject proposal"
            onClick={() => void decide("reject")}
          >
            Reject
          </button>
          {!isModifying && (
            <button
              type="button"
              className="rounded bg-blue-600 px-2 py-1 text-[11px] font-bold text-white"
              aria-label="Modify proposal"
              onClick={() => setIsModifying(true)}
            >
              Modify
            </button>
          )}
          {isModifying && (
            <button
              type="button"
              className="rounded bg-blue-700 px-2 py-1 text-[11px] font-bold text-white"
              aria-label="Apply modified proposal"
              onClick={() => void decide("modify")}
            >
              Apply modified
            </button>
          )}
        </div>
      )}
    </div>
  );
}
