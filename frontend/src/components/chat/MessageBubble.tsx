import { ChatMessage } from "../../types/chat";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const user = message.role === "user";
  return <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${user ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>
      {message.status === "streaming" ? <span className="inline-flex gap-1 py-1" aria-label="応答を生成中"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" /></span> : message.content}
    </div>
  </div>;
}
