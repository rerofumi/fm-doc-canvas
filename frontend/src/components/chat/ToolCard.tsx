import { ResolveToolApplication } from "../../../wailsjs/go/main/App";
import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useChatStore } from "../../store/useChatStore";
import { ChatToolEvent } from "../../types/chat";

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
  const [modifiedContent, setModifiedContent] = useState(proposal?.proposed || "");
  const [isModifying, setIsModifying] = useState(false);

  const decide = async (decision: "accept" | "modify" | "reject") => {
    if (!proposal) return;
    const result = useAppStore.getState().decideToolProposal(
      proposal,
      decision,
      runId,
      decision === "modify" ? modifiedContent : undefined,
    );
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
      {(proposal?.targetNodeId || proposal?.nodeId) && (
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
      {proposal?.operation !== "edit" && proposal?.filename && (
        <div className="mt-1 truncate">{proposal.filename}</div>
      )}
      {proposal?.proposed && proposal.operation !== "edit" && (
        <div className="mt-1 max-h-16 overflow-auto rounded bg-gray-50 p-1 whitespace-pre-wrap">
          {proposal.proposed.slice(0, 400)}
        </div>
      )}
      {event.error && <div className="mt-1 text-red-600">{event.error}</div>}
      {event.summary && <div className="mt-1 truncate text-gray-500">{event.summary}</div>}
      {event.status === "proposed" && proposal && (
        <div className="mt-2 flex gap-2">
          {isModifying && (
            <textarea
              value={modifiedContent}
              onChange={(event) => setModifiedContent(event.target.value)}
              aria-label="Modified proposal content"
              className="min-h-16 flex-1 rounded border border-blue-300 p-1 text-[11px]"
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
