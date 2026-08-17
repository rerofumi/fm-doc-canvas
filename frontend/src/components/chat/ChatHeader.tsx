import { Plus, X } from "lucide-react";
import { ChatSession, ChatTarget, ImageProvider } from "../../types/chat";
import type { AssistantMode } from "../../store/useChatStore";
import { useTranslation } from "react-i18next";
import { presentUiMessage } from "../../i18n/messages";
import { presentChatTargetType } from "../../i18n/presentation";

export default function ChatHeader({ target, sessions, activeSessionId, mode = "chat", imageProvider, disabled, onChangeMode, onChangeSession, onChangeImageProvider, onNew, onClose }: { target: ChatTarget | null; sessions: ChatSession[]; activeSessionId: string | null; mode?: AssistantMode; imageProvider: ImageProvider; disabled: boolean; onChangeMode?: (mode: AssistantMode) => void; onChangeSession: (id: string) => void; onChangeImageProvider: (provider: ImageProvider) => void; onNew: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const targetType = target ? presentChatTargetType(target.type) : undefined;
  return <header className="border-b border-gray-200 bg-gray-50 p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-gray-700">{t($ => $.assistant.title)}</h2>
        <p className="truncate text-xs text-gray-500" title={target ? t($ => $.assistant.targetTitle, { type: targetType, label: target.label }) : undefined}>{target ? t($ => $.assistant.target, { type: targetType, label: target.label }) : t($ => $.assistant.targetEmpty)}</p>
      </div>
      <button data-testid="assistant-close" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-200" title={t($ => $.assistant.close)} aria-label={t($ => $.assistant.close)}><X size={18} /></button>
    </div>
    <div className="mb-2 grid grid-cols-2 gap-1 rounded bg-gray-100 p-1" role="tablist" aria-label={t($ => $.assistant.mode)}>
      {(["chat", "direct"] as const).map((item) => <button key={item} type="button" role="tab" data-testid={`assistant-mode-${item}`} aria-selected={mode === item} disabled={disabled} onClick={() => onChangeMode?.(item)} className={`rounded px-2 py-1 text-xs font-semibold ${mode === item ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{item === "chat" ? t($ => $.assistant.modeChat) : t($ => $.assistant.modeDirect)}</button>)}
    </div>
    {mode === "chat" && <div className="flex gap-2">
      <select data-testid="assistant-session" aria-label={t($ => $.assistant.session)} value={activeSessionId ?? ""} disabled={disabled} onChange={(event) => onChangeSession(event.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none disabled:bg-gray-100">
        {sessions.length === 0 && <option value="">{t($ => $.assistant.noSessions)}</option>}
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.isDefaultTitle ? presentUiMessage({ code: "messages.defaultChatTitle" }) : session.title}</option>)}
      </select>
      <button data-testid="assistant-new-session" onClick={onNew} disabled={disabled} className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400" title={t($ => $.assistant.newSession)}><Plus size={14} />{t($ => $.assistant.newSession)}</button>
    </div>}
    <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
      <span className="font-medium">{t($ => $.assistant.imageProvider)}</span>
      <select
        aria-label={t($ => $.assistant.imageProviderAria)}
        data-testid="assistant-image-provider"
        value={imageProvider}
        disabled={disabled}
        onChange={(event) => onChangeImageProvider(event.target.value as ImageProvider)}
        className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none disabled:bg-gray-100"
      >
        <option value="openrouter">OpenRouter</option>
        <option value="openai">OpenAI</option>
        <option value="google">Google</option>
        <option value="xai">xAI</option>
      </select>
    </label>
  </header>;
}
