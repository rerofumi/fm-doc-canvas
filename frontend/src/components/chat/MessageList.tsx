import { useEffect, useRef } from "react";
import { ChatMessage } from "../../types/chat";
import MessageBubble from "./MessageBubble";

export default function MessageList({
  messages,
  sessionId,
}: {
  messages: ChatMessage[];
  sessionId?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-label="Dialogue messages">
      {messages.length === 0 && (
        <p className="pt-8 text-center text-sm text-gray-400">
          メッセージを入力して会話を始めます。
        </p>
      )}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} sessionId={sessionId} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
