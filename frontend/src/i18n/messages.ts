import { getI18n } from "./i18n";

/**
 * User-facing messages deliberately carry a stable semantic code instead of
 * translated prose.  This keeps stores/domain locale-independent and lets a
 * visible error be re-rendered when the locale changes.
 */
export type UiMessageDescriptor =
  | { code: "messages.defaultChatTitle" }
  | { code: "canvas.saveFailed" | "canvas.loadFailed" | "canvas.importFailed" | "canvas.exportFailed" }
  | { code: "image.loadFailed" | "editor.summaryFailed" | "tool.imagePreviewFailed" | "tool.staleRun" | "tool.decisionRequired" | "tool.modifiedApplied" | "tool.rejectedByUser" | "tool.creationGuardText" | "tool.creationGuardArtifact" | "operation.directTextGenerated" | "operation.directImageGenerated" | "context.packetFailed" }
  | { code: "chat.loadFailed" | "chat.saveFailed" | "chat.contextWarning" | "chat.responseFailed" | "chat.cancelled" }
  | { code: "subcanvas.emptyName" }
  | { code: "operation.failed" | "operation.commandFailed" | "operation.directTransformFailed" | "operation.directActionFailed" | "operation.searchFailed" | "operation.searchInvalidQuery" | "operation.proposalStale" | "operation.proposalConflict" | "operation.selectionRequiresTwo" | "operation.subcanvasEmptyName" | "operation.subcanvasNoParent" | "operation.subcanvasNoNodes" | "operation.subcanvasParentMissing" | "operation.folderDeleteDisabled" | "operation.clusterNotFound" | "operation.clusterTooSmall" | "operation.invalidInput" }
  | { code: "subcanvas.moveSuccess"; values: { count: number } }
  | { code: "nextAction.failed" | "nextAction.invalid" };

export type UiMessageCode = UiMessageDescriptor["code"];

const assertNever = (value: never): never => {
  throw new Error(`Unhandled UI message code: ${String(value)}`);
};

/** Resolve a descriptor using the current bundled i18next instance. */
export function presentUiMessage(descriptor: UiMessageDescriptor): string {
  const t = getI18n().t.bind(getI18n());
  switch (descriptor.code) {
    case "messages.defaultChatTitle": return t(($) => $.messages.defaultChatTitle);
    case "canvas.saveFailed": return t(($) => $.messages.canvas.saveFailed);
    case "canvas.loadFailed": return t(($) => $.messages.canvas.loadFailed);
    case "canvas.importFailed": return t(($) => $.messages.canvas.importFailed);
    case "canvas.exportFailed": return t(($) => $.messages.canvas.exportFailed);
    case "image.loadFailed": return t(($) => $.messages.image.loadFailed);
    case "editor.summaryFailed": return t(($) => $.messages.editor.summaryFailed);
    case "tool.imagePreviewFailed": return t(($) => $.messages.tool.imagePreviewFailed);
    case "tool.staleRun": return t(($) => $.messages.tool.staleRun);
    case "tool.decisionRequired": return t(($) => $.messages.tool.decisionRequired);
    case "tool.modifiedApplied": return t(($) => $.messages.tool.modifiedApplied);
    case "tool.rejectedByUser": return t(($) => $.messages.tool.rejectedByUser);
    case "tool.creationGuardText": return t(($) => $.messages.tool.creationGuardText);
    case "tool.creationGuardArtifact": return t(($) => $.messages.tool.creationGuardArtifact);
    case "operation.directTextGenerated": return t(($) => $.messages.operation.directTextGenerated);
    case "operation.directImageGenerated": return t(($) => $.messages.operation.directImageGenerated);
    case "context.packetFailed": return t(($) => $.messages.context.packetFailed);
    case "chat.loadFailed": return t(($) => $.messages.chat.loadFailed);
    case "chat.saveFailed": return t(($) => $.messages.chat.saveFailed);
    case "chat.contextWarning": return t(($) => $.messages.chat.contextWarning);
    case "chat.responseFailed": return t(($) => $.messages.chat.responseFailed);
    case "chat.cancelled": return t(($) => $.messages.chat.cancelled);
    case "subcanvas.emptyName": return t(($) => $.subcanvasDialog.emptyName);
    case "operation.failed": return t(($) => $.messages.operation.failed);
    case "operation.commandFailed": return t(($) => $.messages.operation.commandFailed);
    case "operation.directTransformFailed": return t(($) => $.messages.operation.directTransformFailed);
    case "operation.directActionFailed": return t(($) => $.messages.operation.directActionFailed);
    case "operation.searchFailed": return t(($) => $.messages.operation.searchFailed);
    case "operation.searchInvalidQuery": return t(($) => $.messages.operation.searchInvalidQuery);
    case "operation.proposalStale": return t(($) => $.messages.operation.proposalStale);
    case "operation.proposalConflict": return t(($) => $.messages.operation.proposalConflict);
    case "operation.selectionRequiresTwo": return t(($) => $.messages.operation.selectionRequiresTwo);
    case "operation.subcanvasEmptyName": return t(($) => $.messages.operation.subcanvasEmptyName);
    case "operation.subcanvasNoParent": return t(($) => $.messages.operation.subcanvasNoParent);
    case "operation.subcanvasNoNodes": return t(($) => $.messages.operation.subcanvasNoNodes);
    case "operation.subcanvasParentMissing": return t(($) => $.messages.operation.subcanvasParentMissing);
    case "operation.folderDeleteDisabled": return t(($) => $.messages.operation.folderDeleteDisabled);
    case "operation.clusterNotFound": return t(($) => $.messages.operation.clusterNotFound);
    case "operation.clusterTooSmall": return t(($) => $.messages.operation.clusterTooSmall);
    case "operation.invalidInput": return t(($) => $.messages.operation.invalidInput);
    case "subcanvas.moveSuccess": return t(($) => $.messages.subcanvas.moveSuccess, descriptor.values);
    case "nextAction.failed": return t(($) => $.messages.nextAction.failed);
    case "nextAction.invalid": return t(($) => $.messages.nextAction.invalid);
    default: return assertNever(descriptor);
  }
}

/**
 * Convert an operation/backend failure into a safe primary-UI descriptor.
 * The original value is diagnostic-only and never enters application state.
 */
export function toUiMessageDescriptor(error: unknown, fallback: UiMessageCode = "operation.failed"): UiMessageDescriptor {
  console.error("UI operation diagnostic", error);
  const raw = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  const value = raw.toLowerCase();
  if (value.includes("save") && value.includes("canvas")) return { code: "canvas.saveFailed" };
  if (value.includes("load") && value.includes("canvas")) return { code: "canvas.loadFailed" };
  if (value.includes("chat-session-load")) return { code: "chat.loadFailed" };
  if (value.includes("chat-session-save")) return { code: "chat.saveFailed" };
  if (value.includes("next-action") || value.includes("orchestration")) return { code: "nextAction.failed" };
  if (value.includes("new text node") || value.includes("新しい text node")) return { code: "tool.creationGuardText" };
  if (value.includes("new artifact node") || value.includes("新しい artifact node")) return { code: "tool.creationGuardArtifact" };
  if (value.includes("cancelled") || value.includes("workspace changed")) return { code: "operation.proposalStale" };
  if (value.includes("stale")) return { code: "operation.proposalStale" };
  if (value.includes("conflict")) return { code: "operation.proposalConflict" };
  if (value.includes("relation") && (value.includes("2") || value.includes("node"))) return { code: "operation.selectionRequiresTwo" };
  if (value.includes("empty") && value.includes("name")) return { code: "operation.subcanvasEmptyName" };
  if (value.includes("no parent")) return { code: "operation.subcanvasNoParent" };
  if (value.includes("no nodes")) return { code: "operation.subcanvasNoNodes" };
  if (value.includes("folder") && value.includes("delete")) return { code: "operation.folderDeleteDisabled" };
  if (value.includes("direct-transform")) return { code: "operation.directTransformFailed" };
  if (value.includes("direct") && value.includes("failed")) return { code: "operation.directActionFailed" };
  if (value.includes("search") && value.includes("query")) return { code: "operation.searchInvalidQuery" };
  if (value.includes("search")) return { code: "operation.searchFailed" };
  if (value.includes("cluster") && value.includes("not found")) return { code: "operation.clusterNotFound" };
  if (value.includes("cluster") && (value.includes("fewer") || value.includes("2"))) return { code: "operation.clusterTooSmall" };
  return { code: fallback } as UiMessageDescriptor;
}

export function isUiMessageDescriptor(value: unknown): value is UiMessageDescriptor {
  return typeof value === "object" && value !== null && typeof (value as { code?: unknown }).code === "string";
}

export const presentMessage = presentUiMessage;
