import {
  FileText,
  Loader2,
  PlusCircle,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { hasWailsRuntime, wailsBridge } from "../../services/wailsBridge";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useToastStore } from "../../store/useToastStore";
import type { TextNodeData } from "../../types/canvas";

const MIN_WIDTH = 340;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 480;

export function NodeInspector() {
  const activeInspectorNodeId = useCanvasStore((s) => s.activeInspectorNodeId);
  const inspectorDraft = useCanvasStore((s) => s.inspectorDraft);
  const nodes = useCanvasStore((s) => s.nodes);
  const summarizingNodeIds = useCanvasStore((s) => s.summarizingNodeIds);

  const updateInspectorDraft = useCanvasStore((s) => s.updateInspectorDraft);
  const closeInspector = useCanvasStore((s) => s.closeInspector);
  const regenerateSummary = useCanvasStore((s) => s.regenerateSummary);
  const appendPromptInput = useCanvasStore((s) => s.appendPromptInput);

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [panelWidth, setPanelWidth] = useState<number>(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const node = activeInspectorNodeId
    ? nodes.find((n) => n.id === activeInspectorNodeId && n.type === "customNode")
    : undefined;

  useEffect(() => {
    setMode("edit");
  }, [activeInspectorNodeId]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const maxAllowed =
        typeof window !== "undefined"
          ? Math.min(MAX_WIDTH, Math.floor(window.innerWidth * 0.85))
          : MAX_WIDTH;
      const nextWidth = Math.max(
        MIN_WIDTH,
        Math.min(maxAllowed, window.innerWidth - e.clientX),
      );
      setPanelWidth(nextWidth);
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (!activeInspectorNodeId || !inspectorDraft || !node) {
    return null;
  }

  const data = node.data as TextNodeData;
  const originalPrompt = data.originalPrompt?.trim() ? data.originalPrompt : "";
  const isSummarizing = Boolean(summarizingNodeIds[node.id]);

  const handleExportMarkdown = async () => {
    const content = inspectorDraft.content || inspectorDraft.summary || "";
    if (!hasWailsRuntime()) {
      useToastStore
        .getState()
        .info("Markdown 出力はデスクトップ実行時に利用できます");
      return;
    }
    try {
      const saved = await wailsBridge.exportMarkdown(content);
      if (saved) {
        useToastStore.getState().success("Markdown を出力しました");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().error(`Markdown 出力に失敗しました: ${message}`);
    }
  };

  const handleAppendPrompt = () => {
    if (!originalPrompt) return;
    appendPromptInput(originalPrompt);
    useToastStore.getState().info("プロンプトを入力欄に追加しました");
  };

  return (
    <aside
      aria-label="テキストノード詳細エディタ"
      className="fixed bottom-0 right-0 top-0 z-40 flex flex-col border-l shadow-2xl"
      style={{
        width: `${panelWidth}px`,
        maxWidth: "85vw",
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      {/* Left resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="パネル幅リサイズ"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className="absolute bottom-0 left-0 top-0 w-1.5 cursor-col-resize transition hover:bg-blue-400/50"
      />

      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ backgroundColor: "var(--bg-surface-muted)" }}
          >
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                mode === "edit"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              編集
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                mode === "preview"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              プレビュー
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleExportMarkdown()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Markdown 出力</span>
          </button>

          <button
            type="button"
            onClick={() => closeInspector(true)}
            aria-label="インスペクターを閉じる"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === "edit" ? (
          <textarea
            aria-label="本文エディタ"
            value={inspectorDraft.content}
            onChange={(e) => updateInspectorDraft({ content: e.target.value })}
            placeholder="Markdown テキストを入力..."
            className="h-full min-h-[260px] w-full resize-none rounded-xl border bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-blue-500"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />
        ) : (
          <div className="prose prose-sm prose-slate max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {inspectorDraft.content.trim()
                ? inspectorDraft.content
                : "*（本文がありません）*"}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex flex-col gap-3 border-t p-4"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "var(--bg-surface-muted)",
        }}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="inspector-summary"
              className="text-xs font-semibold text-slate-700"
            >
              サマリー
            </label>
            <button
              type="button"
              disabled={isSummarizing || inspectorDraft.content.trim() === ""}
              onClick={() =>
                void regenerateSummary(node.id, inspectorDraft.content)
              }
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span>サマリー生成</span>
                </>
              )}
            </button>
          </div>

          <textarea
            id="inspector-summary"
            rows={2}
            value={inspectorDraft.summary}
            onChange={(e) => updateInspectorDraft({ summary: e.target.value })}
            placeholder="カードの要約表示（空の場合は本文先頭を表示）"
            className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-xs leading-relaxed outline-none focus:border-blue-500"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {originalPrompt && (
          <div
            className="flex flex-col gap-1.5 rounded-xl border bg-white p-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                元プロンプト
              </span>
              <button
                type="button"
                onClick={handleAppendPrompt}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>入力欄へ追記</span>
              </button>
            </div>
            <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
              {originalPrompt}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
