import { useEffect, useRef } from "react";
import { ChatMessage } from "../../types/chat";
import MessageBubble from "./MessageBubble";

export default function MessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  return <div className="flex-1 overflow-y-auto space-y-3 p-4">
    {messages.length === 0 && <p className="pt-8 text-center text-sm text-gray-400">メッセージを入力して会話を始めます。</p>}
    {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
    <div ref={endRef} />
  </div>;
}
