import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Edit3, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useToastStore } from "../../store/useToastStore";
import type { TextNodeData } from "../../types/canvas";

export function TextCardNode({ id, data, selected }: NodeProps) {
  const textData = data as TextNodeData;
  const openInspector = useCanvasStore((s) => s.openInspector);
  const deleteNodes = useCanvasStore((s) => s.deleteNodes);
  const appendPromptInput = useCanvasStore((s) => s.appendPromptInput);
  const isSummarizing = useCanvasStore((s) => Boolean(s.summarizingNodeIds[id]));

  const summary = textData.summary?.trim() ?? "";
  const content = textData.content?.trim() ?? "";
  const hasSummary = summary.length > 0;
  const displayText = hasSummary ? textData.summary : textData.content;
  const originalPrompt = textData.originalPrompt?.trim() ?? "";
  const hasOriginalPrompt = originalPrompt.length > 0;

  return (
    <div
      className={`group relative flex w-[280px] flex-col rounded-xl border shadow-sm transition-shadow ${
        selected
          ? "border-[var(--accent-primary)] ring-2 ring-blue-500/20"
          : "border-[var(--border-subtle)] hover:shadow-md"
      }`}
      style={{ backgroundColor: "var(--bg-surface)" }}
      onDoubleClick={() => openInspector(id)}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400 hover:!bg-blue-500"
      />

      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {hasSummary ? "要約" : "メモ"}
          </span>
          {isSummarizing && (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              要約中
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInspector(id);
            }}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="詳細を編集"
            aria-label="詳細を編集"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteNodes([id]);
            }}
            className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="ノードを削除"
            aria-label="ノードを削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        {displayText && (hasSummary || content.length > 0) ? (
          <p
            className="line-clamp-[8] whitespace-pre-wrap break-words text-xs leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          >
            {displayText}
          </p>
        ) : (
          <p
            className="text-xs italic"
            style={{ color: "var(--text-secondary)" }}
          >
            （ダブルクリックでテキストを入力）
          </p>
        )}
      </div>

      {hasOriginalPrompt && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            appendPromptInput(textData.originalPrompt ?? "");
            useToastStore.getState().info("プロンプトを入力欄に追加しました");
          }}
          title={textData.originalPrompt}
          className="flex w-full flex-col items-start gap-0.5 border-t px-3 py-2 text-left transition hover:bg-slate-50"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--bg-surface-muted)",
          }}
        >
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
            <Sparkles className="h-2.5 w-2.5" />
            Prompt:
          </span>
          <span
            className="line-clamp-3 w-full break-words text-[11px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {textData.originalPrompt}
          </span>
        </button>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-400 hover:!bg-blue-500"
      />
    </div>
  );
}
