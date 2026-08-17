import { useEffect, useRef } from "react";
import { ChatMessage } from "../../types/chat";
import MessageBubble from "./MessageBubble";
import { useTranslation } from "react-i18next";

export default function MessageList({
  messages,
  sessionId,
}: {
  messages: ChatMessage[];
  sessionId?: string;
}) {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="assistant-messages" aria-label={t($ => $.assistant.messagesAria)}>
      {messages.length === 0 && (
        <p className="pt-8 text-center text-sm text-gray-400">
          {t($ => $.assistant.emptyMessages)}
        </p>
      )}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} sessionId={sessionId} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
