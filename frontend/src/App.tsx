import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import CanvasArea from "./components/canvas/CanvasArea";
import EditorDrawer from "./components/drawer/EditorDrawer";
import ProjectedContextPanel from "./components/context/ProjectedContextPanel";
import SettingsDrawer from "./components/drawer/SettingsDrawer";
import ChatDrawer from "./components/drawer/ChatDrawer";
import LayoutButton from "./components/layout/LayoutButton";
import ChatToggleButton from "./components/layout/ChatToggleButton";
import CanvasBreadcrumb from "./components/layout/CanvasBreadcrumb";
import GeneratedViewBanner from "./components/canvas/GeneratedViewBanner";
import DirectProposalPanel from "./components/proposal/DirectProposalPanel";
import { useAppStore } from "./store/useAppStore";
import {
  Plus,
  Menu,
  Undo2,
  Loader2,
} from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { useE2EBridge } from "./runtime/e2eBridge";
import { isNextActionError } from "./domain/orchestration";
import { presentUiMessage } from "./i18n/messages";
import { presentDirectOperation } from "./i18n/presentation";

function App() {
  // Subscribe to i18next so visible descriptors are re-presented immediately
  // when the locale changes, even if the underlying store error is unchanged.
  const { t } = useTranslation();
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const {
    addEmptyNode,
    addArtifactNode,
    loadConfig,
    setSettingsOpen,
    undo,
    lastError,
    lastDirectReceipt,
    isWebSearchPending,
    lastSuggestReceipt,
  } = useAppStore();

  const clearDirectReceipt = () => {
    useAppStore.setState({ lastDirectReceipt: null });
  };

  const undoDirectReceipt = () => {
    undo();
    useAppStore.setState({ lastDirectReceipt: null });
  };

  useE2EBridge();
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Next Action failures have their own recovery controls in ChatDrawer.
  // Keep the global workspace banner for document/action errors only.
  const globalError = lastError && !isNextActionError(lastError) ? lastError : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 font-sans text-gray-900">
      <SettingsDrawer returnFocusRef={settingsButtonRef} />
      <ChatDrawer />

      <header className="z-20 flex h-12 shrink-0 flex-nowrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 shrink items-center gap-2 whitespace-nowrap">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
            FM
          </div>
          <h1 className="text-sm font-bold tracking-tight">FM Doc Canvas</h1>
        </div>

        <div className="flex shrink-0 flex-nowrap items-center gap-1 whitespace-nowrap">
          <button
            data-testid="shell-add-text"
            onClick={() => addEmptyNode(t(($) => $.shell.defaultTextLabel))}
            className="mr-1 flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
            title={t(($) => $.shell.addText)}
            aria-label={t(($) => $.shell.addText)}
          >
            <Plus size={14} />
            <span>{t(($) => $.shell.text)}</span>
          </button>
          <button
            data-testid="shell-add-artifact"
            onClick={() => addArtifactNode(t(($) => $.shell.defaultArtifactLabel))}
            className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700"
            title={t(($) => $.shell.addArtifact)}
            aria-label={t(($) => $.shell.addArtifact)}
          >
            <Plus size={14} />
            <span>{t(($) => $.shell.artifact)}</span>
          </button>

          <div className="mx-1 h-4 w-px bg-gray-200" />

          <button
            data-testid="shell-undo"
            onClick={() => undo()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            title={t(($) => $.shell.undo)}
            aria-label={t(($) => $.shell.undo)}
          >
            <Undo2 size={16} />
            <span>{t(($) => $.shell.undo)}</span>
          </button>

          <div className="mx-1 h-4 w-px bg-gray-200" />
          <LayoutButton />
          <ChatToggleButton />
          <div className="mx-1 h-4 w-px bg-gray-200" />
          <button
            data-testid="shell-settings"
            ref={settingsButtonRef}
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            title={t(($) => $.shell.settings)}
            aria-label={t(($) => $.shell.settings)}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {isWebSearchPending && (
        <div
          className="flex shrink-0 items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800"
          role="status"
          aria-label={t(($) => $.shell.webSearchInProgress)}
          data-testid="web-search-progress"
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {t(($) => $.shell.webSearchInProgress)}
        </div>
      )}

      {lastSuggestReceipt?.status === "pending" && (
        <div
          className="flex shrink-0 items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800"
          role="status"
          aria-live="polite"
          aria-label={
            lastSuggestReceipt.operation === "relations"
              ? t(($) => $.shell.relationAnalysisInProgress)
              : t(($) => $.shell.clusterAnalysisInProgress)
          }
          data-operation={lastSuggestReceipt.operation}
          data-testid="suggest-progress"
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {lastSuggestReceipt.operation === "relations"
            ? t(($) => $.shell.relationAnalysisInProgress)
            : t(($) => $.shell.clusterAnalysisInProgress)}
        </div>
      )}

      {globalError && (
        <div
          className="border-b border-red-200 bg-red-50 px-4 py-1 text-xs text-red-700"
          role="alert"
          aria-label={t(($) => $.shell.workspaceError)}
          data-testid="global-error-banner"
        >
          <div>{presentUiMessage(globalError)}</div>
          <div className="mt-0.5 text-[10px] text-red-600">
            {t(($) => $.shell.recovery)}
          </div>
        </div>
      )}

      <ProjectedContextPanel />

      <GeneratedViewBanner />
      <DirectProposalPanel />

      {lastDirectReceipt && (
        <div
          className="border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-900"
          role="status"
          aria-label={t(($) => $.shell.directActionResult)}
          data-testid="direct-action-receipt"
        >
          <div className="font-semibold">
            {t(($) => $.shell.operationApplied, {
              operation: presentDirectOperation(lastDirectReceipt.operation),
            })}
          </div>
          <div>{lastDirectReceipt.summary}</div>
          {lastDirectReceipt.createdNodeId && (
            <div>{t(($) => $.shell.createdDerivedNode, { id: lastDirectReceipt.createdNodeId })}</div>
          )}
          {lastDirectReceipt.diff && (
            <div
              className="mt-2 grid gap-2 md:grid-cols-2"
              data-testid="direct-action-diff"
            >
              <div>
                <div className="font-semibold">{t(($) => $.shell.diffSources)}</div>
                {(lastDirectReceipt.diff.sources || []).map((source, index) => {
                  if (typeof source === "string") {
                    return (
                      <div
                        key={`src-${index}`}
                        className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-1"
                      >
                        {source}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={source.nodeId}
                      className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-1"
                      data-testid={`direct-diff-source-${source.nodeId}`}
                    >
                      <div className="font-semibold">
                        {source.nodeId} · rev {source.revision}
                      </div>
                      {source.content}
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="font-semibold">{t(($) => $.shell.diffOutput)}</div>
                <div
                  className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-1"
                  data-testid="direct-diff-output"
                >
                  {lastDirectReceipt.diff.output}
                </div>
              </div>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded bg-indigo-700 px-2 py-1 text-[11px] font-bold text-white"
              aria-label={t(($) => $.shell.undoDirectAction)}
              data-testid="direct-action-undo"
              onClick={undoDirectReceipt}
            >
              {t(($) => $.shell.undo)}
            </button>
            <button
              type="button"
              className="rounded border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-800"
              aria-label={t(($) => $.shell.dismissDirectAction)}
              onClick={clearDirectReceipt}
            >
              {t(($) => $.common.action.close)}
            </button>
          </div>
        </div>
      )}

      <CanvasBreadcrumb />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <EditorDrawer />
        <main className="relative h-full min-h-0 min-w-0 w-full flex-1">
          <ReactFlowProvider>
            <CanvasArea />
          </ReactFlowProvider>
        </main>
      </div>

    </div>
  );
}

export default App;
