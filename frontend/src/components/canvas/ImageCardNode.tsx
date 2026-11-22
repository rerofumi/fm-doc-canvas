import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { ImageOff, Maximize2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { hasWailsRuntime, wailsBridge } from "../../services/wailsBridge";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useToastStore } from "../../store/useToastStore";
import type { ImageNodeData } from "../../types/canvas";

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
};

function formatProviderLabel(provider?: string): string | null {
  if (!provider) return null;
  const key = provider.toLowerCase();
  return PROVIDER_LABELS[key] ?? provider;
}

export function ImageCardNode({ id, data, selected }: NodeProps) {
  const imageData = data as ImageNodeData;
  const openLightbox = useCanvasStore((s) => s.openLightbox);
  const deleteNodes = useCanvasStore((s) => s.deleteNodes);
  const appendPromptInput = useCanvasStore((s) => s.appendPromptInput);

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const src = imageData.src?.trim() ?? "";

    if (!src) {
      setDataUrl(null);
      setLoading(false);
      setErrorMsg("画像パスが指定されていません");
      return;
    }

    if (!hasWailsRuntime()) {
      setDataUrl(null);
      setLoading(false);
      setErrorMsg("デスクトップ実行時のみ画像を読み込みます");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    wailsBridge
      .getImageDataURL(src)
      .then((url) => {
        if (cancelled) return;
        setDataUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDataUrl(null);
        setLoading(false);
        setErrorMsg(
          err instanceof Error ? err.message : "画像を読み込めません",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [imageData.src]);

  const promptText = imageData.prompt?.trim() ?? "";
  const hasPrompt = promptText.length > 0;
  const providerLabel = formatProviderLabel(imageData.provider);

  return (
    <div
      className={`group relative flex h-full w-full min-w-[180px] min-h-[140px] flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow ${
        selected
          ? "border-[var(--accent-primary)] ring-2 ring-blue-500/20"
          : "border-[var(--border-subtle)] hover:shadow-md"
      }`}
      style={{ backgroundColor: "var(--bg-surface)" }}
      onDoubleClick={() => openLightbox(id)}
    >
      <NodeResizer
        isVisible={Boolean(selected)}
        minWidth={180}
        minHeight={140}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border !border-white !bg-blue-600"
      />

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
        <span
          className="truncate text-[11px] font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {imageData.alt || "画像"}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openLightbox(id);
            }}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="拡大表示"
            aria-label="拡大表示"
          >
            <Maximize2 className="h-3.5 w-3.5" />
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

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-50 p-2">
        {loading && (
          <div className="h-full w-full animate-pulse rounded-lg bg-slate-200" />
        )}

        {!loading && dataUrl && (
          <img
            src={dataUrl}
            alt={imageData.alt ?? "生成画像"}
            className="max-h-full max-w-full rounded object-contain"
            draggable={false}
          />
        )}

        {!loading && !dataUrl && (
          <div className="flex max-w-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            <ImageOff className="h-6 w-6 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">
              画像を読み込めません
            </span>
            {imageData.src && (
              <span className="max-w-full break-all text-[10px] text-slate-400">
                {imageData.src}
              </span>
            )}
            {errorMsg && (
              <span className="max-w-full line-clamp-2 text-[10px] text-red-500">
                {errorMsg}
              </span>
            )}
          </div>
        )}
      </div>

      {hasPrompt && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            appendPromptInput(imageData.prompt ?? "");
            useToastStore.getState().info("プロンプトを入力欄に追加しました");
          }}
          title={imageData.prompt}
          className="flex w-full flex-col items-start gap-1 border-t px-3 py-2 text-left transition hover:bg-slate-50"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--bg-surface-muted)",
          }}
        >
          <div className="flex w-full items-center justify-between gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
              <Sparkles className="h-2.5 w-2.5" />
              Prompt:
            </span>
            {providerLabel && (
              <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                {providerLabel}
              </span>
            )}
          </div>
          <span
            className="line-clamp-3 w-full break-words text-[11px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {imageData.prompt}
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
