import { useMemo, useState } from "react";
import { NEXT_ACTION_MAPPINGS } from "../../domain/orchestration";
import { useAppStore } from "../../store/useAppStore";
import type { ChatMessage } from "../../types/chat";

export default function NextActionPanel({
  messages,
  showTrigger = true,
  triggerDisabled = false,
  disabled = false,
  onRetry,
  onDispatch,
  onCancel,
}: {
  messages: ChatMessage[];
  showTrigger?: boolean;
  triggerDisabled?: boolean;
  disabled?: boolean;
  onRetry?: () => void;
  onDispatch?: (actionId: string, edits?: { targetNodeIds?: string[]; query?: string }) => void;
  onCancel?: () => void;
}) {
  const status = useAppStore((state) => state.orchestrationStatus);
  const proposal = useAppStore((state) => state.nextActionProposal);
  const request = useAppStore((state) => state.requestNextActions);
  const cancelRequest = useAppStore((state) => state.cancelNextActionRequest);
  const dismiss = useAppStore((state) => state.dismissNextActions);
  const reject = useAppStore((state) => state.rejectNextAction);
  const dispatch = useAppStore((state) => state.dispatchNextAction);
  const actionRequest = useAppStore((state) => state.orchestrationRequest);
  const receipt = useAppStore((state) => state.orchestrationReceipt);
  const error = useAppStore((state) => state.lastError);
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState<Record<string, string[]>>({});
  const actions = useMemo(() => proposal?.actions ?? [], [proposal]);
  const retry = () => {
    if (onRetry) onRetry();
    else void request(messages);
  };
  const cancel = () => {
    onCancel?.();
    cancelRequest();
  };
  const controlsDisabled = disabled || status === "dispatching";

  const targetLabel = (id: string): string =>
    actionRequest?.nodeHints.find((hint) => hint.id === id)?.label || id;

  return (
    <section
      aria-label="Next action proposals"
      className="max-h-[50vh] shrink-0 overflow-y-auto overscroll-contain border-b border-gray-200 bg-slate-50 p-3"
    >
      {status === "idle" && showTrigger && (
        <button
          type="button"
          aria-label="次の一手を提案"
          className="rounded border px-3 py-1 text-sm"
          onClick={retry}
          disabled={controlsDisabled || triggerDisabled}
        >
          次の一手
        </button>
      )}
      {status === "pending" && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between text-sm"
        >
          <span>提案を考えています…</span>
          <button
            type="button"
            aria-label="次の一手の提案をキャンセル"
            className="rounded border px-2 py-1"
            onClick={cancel}
          >
            キャンセル
          </button>
        </div>
      )}
      {(status === "cancelled" || status === "stale") && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between text-sm"
        >
          <span>
            {status === "cancelled"
              ? "提案をキャンセルしました。"
              : "提案は古くなりました。"}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              aria-label="次の一手を再提案"
              className="underline"
              onClick={retry}
              disabled={controlsDisabled}
            >
              再提案
            </button>
            <button
              type="button"
              aria-label="次の一手の提案を閉じる"
              className="underline"
              onClick={dismiss}
              disabled={controlsDisabled}
            >
              閉じる
            </button>
          </span>
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between text-sm text-red-700"
        >
          <span>
            {error || "次の一手を提案できませんでした。"}
            <span className="ml-2 text-xs text-red-600">
              再提案、対象を変更、または通常Chatで相談できます。
            </span>
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              aria-label="次の一手を再提案"
              className="underline"
              onClick={retry}
              disabled={controlsDisabled}
            >
              再提案
            </button>
            <button
              type="button"
              aria-label="次の一手の提案を閉じる"
              className="underline"
              onClick={dismiss}
              disabled={controlsDisabled}
            >
              閉じる
            </button>
          </span>
        </div>
      )}
      {status === "dispatched" && receipt && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between text-sm"
        >
          <span>
            実行しました: {receipt.kind}（{receipt.resultSurface}）
            {receipt.targetNodeIds.length
              ? ` / 対象 ${receipt.targetNodeIds.join(", ")}`
              : ""}
          </span>
          <button
            type="button"
            aria-label="実行結果を閉じる"
            className="underline"
            onClick={dismiss}
          >
            閉じる
          </button>
        </div>
      )}
      {status === "dispatching" && (
        <div role="status" aria-live="polite" className="text-sm">
          提案を実行しています…
        </div>
      )}
      {(status === "ready" || status === "dispatching") && (
        <div role="region" aria-label="Next action proposals">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">次の一手</h2>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="次の一手を再提案"
                onClick={retry}
                disabled={controlsDisabled}
              >
                もう一度考える
              </button>
              <button
                type="button"
                aria-label="次の一手の提案を閉じる"
                onClick={dismiss}
                disabled={controlsDisabled}
              >
                閉じる
              </button>
            </div>
          </div>
          {actions.map((action) => {
            const currentTargets = targets[action.id] || action.targetNodeIds;
            const presentation = NEXT_ACTION_MAPPINGS[action.kind];
            const updateTargets = (id: string, checked: boolean) => {
              setTargets((previous) => ({
                ...previous,
                [action.id]: checked
                  ? [...currentTargets, id]
                  : currentTargets.filter((target) => target !== id),
              }));
            };
            const edits =
              action.kind === "web_search"
                ? { query: query || action.query }
                : action.kind === "clarify"
                  ? undefined
                  : { targetNodeIds: currentTargets };

            return (
              <article
                key={action.id}
                className="mb-2 rounded border bg-white p-2"
                aria-labelledby={`next-action-${action.id}`}
              >
                <h3
                  id={`next-action-${action.id}`}
                  className="font-medium"
                >
                  {action.title}
                </h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-gray-700">
                  <dt>役割</dt>
                  <dd>{presentation.roleLabel}</dd>
                  <dt>権限</dt>
                  <dd>{presentation.actionLevelLabel}</dd>
                  <dt>導線</dt>
                  <dd>{presentation.routeLabel}</dd>
                  <dt>文書への影響</dt>
                  <dd>{action.documentEffect}</dd>
                  <dt>操作</dt>
                  <dd>{action.control}</dd>
                </dl>
                {action.kind !== "clarify" && action.kind !== "web_search" && (
                  <fieldset className="mt-1">
                    <legend className="text-xs">対象を選択</legend>
                    {action.targetNodeIds.map((id) => (
                      <label key={id} className="mr-2 text-xs">
                        <input
                          type="checkbox"
                          aria-label={`対象 ${targetLabel(id)}`}
                          checked={currentTargets.includes(id)}
                          disabled={controlsDisabled}
                          onChange={(event) =>
                            updateTargets(id, event.target.checked)
                          }
                        />
                        {" "}
                        {targetLabel(id)}{" "}
                        <span className="text-gray-400">({id})</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {action.kind === "web_search" && (
                  <label className="mt-1 block text-xs">
                    検索 query
                    <input
                      aria-label={`${action.title} の検索 query`}
                      className="mt-1 w-full rounded border px-2 py-1"
                      value={query || action.query || ""}
                      disabled={controlsDisabled}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                )}
                {action.kind === "clarify" && (
                  <p className="mt-1 rounded bg-blue-50 p-2 text-sm">
                    {action.question}
                  </p>
                )}
                <p className="mt-1 text-xs">
                  <span className="font-medium">なぜ今:</span> {action.reason}
                </p>
                <p className="text-xs">
                  <span className="font-medium">得られるもの:</span>{" "}
                  {action.expectedResult}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    aria-label={`${action.title}を実行`}
                    disabled={status === "dispatching"}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                    onClick={() => onDispatch ? onDispatch(action.id, edits) : void dispatch(action.id, edits)}
                  >
                    {action.kind === "clarify" ? "この質問に答える" : "実行"}
                  </button>
                  <button
                    type="button"
                    aria-label={`${action.title}を拒否`}
                    disabled={status === "dispatching"}
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => reject(action.id)}
                  >
                    拒否
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
