import { Plus, X } from "lucide-react";
import { ChatSession, ChatTarget, ImageProvider } from "../../types/chat";

export default function ChatHeader({ target, sessions, activeSessionId, imageProvider, disabled, onChangeSession, onChangeImageProvider, onNew, onClose }: { target: ChatTarget | null; sessions: ChatSession[]; activeSessionId: string | null; imageProvider: ImageProvider; disabled: boolean; onChangeSession: (id: string) => void; onChangeImageProvider: (provider: ImageProvider) => void; onNew: () => void; onClose: () => void }) {
  const targetType = target && { artifact: "Artifact", text: "Text", image: "Image" }[target.type];
  return <header className="border-b border-gray-200 bg-gray-50 p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-gray-700">Chat</h2>
        <p className="truncate text-xs text-gray-500" title={target ? `${targetType}: ${target.label}` : undefined}>{target ? `対象: ${targetType} · ${target.label}` : "対象未選択"}</p>
      </div>
      <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-200" title="Close chat"><X size={18} /></button>
    </div>
    <div className="flex gap-2">
      <select aria-label="Chat session" value={activeSessionId ?? ""} disabled={disabled} onChange={(event) => onChangeSession(event.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none disabled:bg-gray-100">
        {sessions.length === 0 && <option value="">会話なし</option>}
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
      </select>
      <button onClick={onNew} disabled={disabled} className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400" title="New chat"><Plus size={14} />New</button>
    </div>
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
