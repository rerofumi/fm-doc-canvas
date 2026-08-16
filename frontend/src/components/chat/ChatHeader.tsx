import { Plus, X } from "lucide-react";
import { ChatSession, ChatTarget, ImageProvider } from "../../types/chat";
import type { AssistantMode } from "../../store/useChatStore";

export default function ChatHeader({ target, sessions, activeSessionId, mode = "chat", imageProvider, disabled, onChangeMode, onChangeSession, onChangeImageProvider, onNew, onClose }: { target: ChatTarget | null; sessions: ChatSession[]; activeSessionId: string | null; mode?: AssistantMode; imageProvider: ImageProvider; disabled: boolean; onChangeMode?: (mode: AssistantMode) => void; onChangeSession: (id: string) => void; onChangeImageProvider: (provider: ImageProvider) => void; onNew: () => void; onClose: () => void }) {
  const targetType = target && { artifact: "Artifact", text: "Text", image: "Image" }[target.type];
  return <header className="border-b border-gray-200 bg-gray-50 p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-gray-700">Chat</h2>
        <p className="truncate text-xs text-gray-500" title={target ? `${targetType}: ${target.label}` : undefined}>{target ? `対象: ${targetType} · ${target.label}` : "対象未選択"}</p>
      </div>
      <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-200" title="Close assistant" aria-label="Close assistant"><X size={18} /></button>
    </div>
    <div className="mb-2 grid grid-cols-2 gap-1 rounded bg-gray-100 p-1" role="tablist" aria-label="Assistant mode">
      {(["chat", "direct"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} disabled={disabled} onClick={() => onChangeMode?.(item)} className={`rounded px-2 py-1 text-xs font-semibold ${mode === item ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{item === "chat" ? "Chat" : "Direct"}</button>)}
    </div>
    {mode === "chat" && <div className="flex gap-2">
      <select aria-label="Chat session" value={activeSessionId ?? ""} disabled={disabled} onChange={(event) => onChangeSession(event.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none disabled:bg-gray-100">
        {sessions.length === 0 && <option value="">会話なし</option>}
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
      </select>
      <button onClick={onNew} disabled={disabled} className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400" title="New chat"><Plus size={14} />New</button>
    </div>}
    <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
      <span className="font-medium">Image Provider</span>
      <select
        aria-label="Dialogue image provider"
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
