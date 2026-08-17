import { ChatMessage } from "../../types/chat";
import ToolCard from "./ToolCard";
import { useTranslation } from "react-i18next";
import { presentUiMessage } from "../../i18n/messages";

export default function MessageBubble({
  message,
  sessionId,
}: {
  message: ChatMessage;
  sessionId?: string;
}) {
  const { t } = useTranslation();
  const user = message.role === "user";
  return (
    <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
          user ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
        }`}
      >
        {!user &&
          message.toolEvents?.map((event) => (
            <ToolCard
              key={event.toolCallId}
              event={event}
              sessionId={sessionId}
              runId={message.runId}
            />
          ))}
        {message.status === "streaming" ? (
          <span className="inline-flex gap-1 py-1" aria-label={t($ => $.assistant.responseGenerating)}>
            <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
            <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
            <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
          </span>
        ) : (
          message.messageDescriptor ? presentUiMessage(message.messageDescriptor) : message.content
        )}
      </div>
    </div>
  );
}
