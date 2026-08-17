import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import type { ChatMessage } from "../../types/chat";
import { presentAction, presentNextActionKind, presentResultSurface, presentUiMessage } from "../../i18n";

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
  const { t } = useTranslation();
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
      aria-label={t($ => $.nextAction.regionAria)}
      data-testid="next-action-panel"
      className="max-h-[50vh] shrink-0 overflow-y-auto overscroll-contain border-b border-gray-200 bg-slate-50 p-3"
    >
      {status === "idle" && showTrigger && (
        <button
          type="button"
          aria-label={t($ => $.nextAction.triggerAria)}
          data-testid="next-action-trigger"
          className="rounded border px-3 py-1 text-sm"
          onClick={retry}
          disabled={controlsDisabled || triggerDisabled}
        >
          {t($ => $.nextAction.trigger)}
        </button>
      )}
      {status === "pending" && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between text-sm"
        >
          <span>{t($ => $.nextAction.thinking)}</span>
          <button
            type="button"
            data-testid="next-action-cancel"
            aria-label={t($ => $.nextAction.cancelAria)}
            className="rounded border px-2 py-1"
            onClick={cancel}
          >
            {t($ => $.nextAction.cancel)}
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
              ? t($ => $.nextAction.cancelled)
              : t($ => $.nextAction.stale)}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              aria-label={t($ => $.nextAction.retryAria)}
              className="underline"
              onClick={retry}
              disabled={controlsDisabled}
            >
              {t($ => $.nextAction.retry)}
            </button>
            <button
              type="button"
              aria-label={t($ => $.nextAction.dismissAria)}
              className="underline"
              onClick={dismiss}
              disabled={controlsDisabled}
            >
              {t($ => $.nextAction.dismiss)}
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
            {error ? presentUiMessage(error) : presentUiMessage({ code: "nextAction.failed" })}
            <span className="ml-2 text-xs text-red-600">
              {t($ => $.nextAction.recovery)}
            </span>
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              aria-label={t($ => $.nextAction.retryAria)}
              className="underline"
              onClick={retry}
              disabled={controlsDisabled}
            >
              {t($ => $.nextAction.retry)}
            </button>
            <button
              type="button"
              aria-label={t($ => $.nextAction.dismissAria)}
              className="underline"
              onClick={dismiss}
              disabled={controlsDisabled}
            >
              {t($ => $.nextAction.dismiss)}
            </button>
          </span>
        </div>
      )}
      {status === "dispatched" && receipt && (
        <div
          role="status"
          aria-live="polite"
          data-testid="next-action-result-status"
          data-result-surface={receipt.resultSurface}
          className="flex items-center justify-between text-sm"
        >
          <span>
            {t($ => $.nextAction.executed, { kind: presentNextActionKind(receipt.kind), surface: presentResultSurface(receipt.resultSurface) })}
            {receipt.targetNodeIds.length
              ? t($ => $.nextAction.target, { targets: receipt.targetNodeIds.join(", ") })
              : ""}
          </span>
          <button
            type="button"
            aria-label={t($ => $.nextAction.resultDismissAria)}
            className="underline"
            onClick={dismiss}
          >
            {t($ => $.nextAction.dismiss)}
          </button>
        </div>
      )}
      {status === "dispatching" && (
        <div role="status" aria-live="polite" className="text-sm">
          {t($ => $.nextAction.dispatching)}
        </div>
      )}
      {(status === "ready" || status === "dispatching") && (
        <div role="region" aria-label={t($ => $.nextAction.regionAria)}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t($ => $.nextAction.title)}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={t($ => $.nextAction.retryAria)}
                onClick={retry}
                disabled={controlsDisabled}
              >
                {t($ => $.nextAction.rethink)}
              </button>
              <button
                type="button"
                aria-label={t($ => $.nextAction.dismissAria)}
                onClick={dismiss}
                disabled={controlsDisabled}
              >
                {t($ => $.nextAction.dismiss)}
              </button>
            </div>
          </div>
          {actions.map((action) => {
            const currentTargets = targets[action.id] || action.targetNodeIds;
            const presentation = presentAction(action.kind);
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
                data-testid={`next-action-${action.id}`}
              >
                <h3
                  id={`next-action-${action.id}`}
                  className="font-medium"
                >
                  {action.title}
                </h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-gray-700">
                  <dt>{t($ => $.nextAction.role)}</dt>
                  <dd>{presentation.roleLabel}</dd>
                  <dt>{t($ => $.nextAction.authority)}</dt>
                  <dd>{presentation.actionLevelLabel}</dd>
                  <dt>{t($ => $.nextAction.route)}</dt>
                  <dd>{presentation.routeLabel}</dd>
                  <dt>{t($ => $.nextAction.documentEffect)}</dt>
                  <dd>{presentation.documentEffectLabel}</dd>
                  <dt>{t($ => $.nextAction.control)}</dt>
                  <dd>{presentation.controlLabel}</dd>
                </dl>
                {action.kind !== "clarify" && action.kind !== "web_search" && (
                  <fieldset className="mt-1">
                    <legend className="text-xs">{t($ => $.nextAction.selectTarget)}</legend>
                    {action.targetNodeIds.map((id) => (
                      <label key={id} className="mr-2 text-xs">
                        <input
                          type="checkbox"
                          aria-label={t($ => $.nextAction.targetAria, { label: targetLabel(id) })}
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
                    {t($ => $.nextAction.searchQuery)}
                    <input
                      aria-label={t($ => $.nextAction.searchQueryAria, { title: action.title })}
                      data-testid={"next-action-search-query-" + action.id}
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
                  <span className="font-medium">{t($ => $.nextAction.whyNow)}</span> {action.reason}
                </p>
                <p className="text-xs">
                  <span className="font-medium">{t($ => $.nextAction.outcome)}</span>{" "}
                  {action.expectedResult}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    aria-label={t($ => $.nextAction.executeAria, { title: action.title })}
                    data-testid={`next-action-execute-${action.id}`}
                    disabled={status === "dispatching"}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                    onClick={() => onDispatch ? onDispatch(action.id, edits) : void dispatch(action.id, edits)}
                  >
                    {action.kind === "clarify" ? t($ => $.nextAction.answer) : t($ => $.nextAction.execute)}
                  </button>
                  <button
                    type="button"
                    aria-label={t($ => $.nextAction.rejectAria, { title: action.title })}
                    data-testid={`next-action-reject-${action.id}`}
                    disabled={status === "dispatching"}
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => reject(action.id)}
                  >
                    {t($ => $.nextAction.reject)}
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
