import { Loader2, Search, Send, Sparkles, Square } from "lucide-react";
import type { AssistantMode } from "../../store/useChatStore";

export default function AssistantActionRow({
  mode,
  disabled,
  canStop = true,
  hasPrompt,
  pending,
  chatRunning = false,
  onNext,
  onSearch,
  onSubmit,
  onStop,
}: {
  mode: AssistantMode;
  disabled: boolean;
  canStop?: boolean;
  hasPrompt: boolean;
  pending: boolean;
  chatRunning?: boolean;
  onNext: () => void;
  onSearch: () => void;
  onSubmit: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-white px-3 py-2" data-testid="assistant-action-row">
      <div className="ml-auto flex flex-wrap items-center gap-1">
        <button type="button" onClick={onNext} disabled={disabled || pending} aria-label="次の一手を提案" className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={13} />次の一手</button>
        <button type="button" onClick={onSearch} disabled={disabled || !hasPrompt || pending} aria-label="Web検索" className="inline-flex items-center gap-1 rounded border border-sky-200 px-2 py-1 text-xs text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"><Search size={13} />Web検索</button>
        {mode === "chat" && chatRunning ? (
          <button type="button" onClick={onStop} disabled={!canStop} aria-label="Stop dialogue run" className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"><Square size={13} />停止</button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={disabled || !hasPrompt || pending} aria-label={mode === "chat" ? "送信" : "生成"} className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"><Send size={13} />{pending ? <Loader2 size={13} className="animate-spin" /> : mode === "chat" ? "送信" : "生成"}</button>
        )}
      </div>
    </div>
  );
}
