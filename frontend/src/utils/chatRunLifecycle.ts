import type { ActiveChatRuns, ChatMessageStatus } from "../types/chat";
import type { UiMessageDescriptor } from "../i18n/messages";
import type { OrderedEventQueueDiagnostic } from "./orderedEventQueue";

export type ActiveChatRunCancellationTarget = {
  sessionId: string;
  runId: string;
  assistantMessageId: string;
};

/**
 * Select the one local chat run that owns a queue diagnostic.
 *
 * Keeping this decision pure makes the correlation boundary testable without
 * mounting ChatDrawer. Once the local active run is released, a repeated
 * diagnostic cannot select it again; the ordered queue's tombstone prevents
 * the same run from producing another diagnostic while it remains mounted.
 */
export const selectActiveChatRunForCancellation = (
  activeRuns: ActiveChatRuns,
  runId: string,
): ActiveChatRunCancellationTarget | null => {
  if (!runId) return null;
  for (const [sessionId, active] of Object.entries(activeRuns)) {
    if (active.runId !== runId) continue;
    return { sessionId, runId, assistantMessageId: active.assistantMessageId };
  }
  return null;
};

export const queueDiagnosticMessage = (
  reason: OrderedEventQueueDiagnostic["reason"],
): { content: string; messageDescriptor: UiMessageDescriptor; status: ChatMessageStatus } => ({
  content: "",
  messageDescriptor: { code: "chat.responseFailed" },
  status: "error",
});
