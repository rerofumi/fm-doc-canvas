import { FormEvent, KeyboardEvent, useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";

export default function ChatInput({ value, disabled, sending, onChange, onSend, onStop, showSubmit = true }: { value: string; disabled: boolean; sending: boolean; onChange: (value: string) => void; onSend: () => void; onStop: () => void; showSubmit?: boolean }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const focus = () => inputRef.current?.focus(); window.addEventListener("fm:focus-chat-input", focus); return () => window.removeEventListener("fm:focus-chat-input", focus); }, []);
  const submit = (event?: FormEvent) => { event?.preventDefault(); if (!value.trim() || disabled || sending) return; onSend(); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); submit(); } };
  return <form onSubmit={submit} className="border-t border-gray-200 bg-white p-3">
    <textarea ref={inputRef} aria-label="Chat message input" data-testid="assistant-prompt" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={keyDown} disabled={disabled || sending} rows={3} placeholder={disabled ? "会話履歴を読み込み中…" : "メッセージを入力… (Ctrl+Enter で送信)"} className="w-full resize-y rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-gray-50" />
    {showSubmit && <div className="mt-2 flex justify-end">
    {sending ? <button type="button" onClick={onStop} aria-label="Stop dialogue run" className="inline-flex items-center gap-1 rounded bg-gray-700 px-3 py-1.5 text-xs font-bold text-white"><Square size={13} />停止</button> : <button type="submit" disabled={disabled || !value.trim()} aria-label="Send dialogue message" className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"><Send size={13} />送信</button>}
    </div>}
  </form>;
}
