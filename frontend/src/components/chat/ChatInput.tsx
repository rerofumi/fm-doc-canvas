import { FormEvent, KeyboardEvent, useState } from "react";
import { Send, Square } from "lucide-react";

export default function ChatInput({ disabled, sending, onSend, onStop }: { disabled: boolean; sending: boolean; onSend: (text: string) => void; onStop: () => void }) {
  const [value, setValue] = useState("");
  const submit = (event?: FormEvent) => { event?.preventDefault(); const text = value.trim(); if (!text || disabled || sending) return; onSend(text); setValue(""); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } };
  return <form onSubmit={submit} className="border-t border-gray-200 bg-white p-3">
    <textarea value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={keyDown} disabled={disabled || sending} rows={3} placeholder={disabled ? "会話履歴を読み込み中…" : "メッセージを入力… (Enter で送信)"} className="w-full resize-none rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-gray-50" />
    <div className="mt-2 flex justify-end">
{sending ? <button type="button" onClick={onStop} aria-label="Stop dialogue run" className="inline-flex items-center gap-1 rounded bg-gray-700 px-3 py-1.5 text-xs font-bold text-white"><Square size={13} />Stop</button> : <button type="submit" disabled={disabled || !value.trim()} aria-label="Send dialogue message" className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"><Send size={13} />送信</button>}
    </div>
  </form>;
}
