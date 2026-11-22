import {
  Download,
  ImageOff,
  Loader2,
  PlusCircle,
  X,
} from "lucide-react";
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

export function ImageLightbox() {
  const lightboxNodeId = useCanvasStore((s) => s.lightboxNodeId);
  const nodes = useCanvasStore((s) => s.nodes);
  const closeLightbox = useCanvasStore((s) => s.closeLightbox);
  const appendPromptInput = useCanvasStore((s) => s.appendPromptInput);

  const node = lightboxNodeId
    ? nodes.find((n) => n.id === lightboxNodeId && n.type === "imageNode")
    : undefined;

  const data = node ? (node.data as ImageNodeData) : null;
  const src = data?.src ?? "";

  const [dataURL, setDataURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxNodeId || !node) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxNodeId, node, closeLightbox]);

  useEffect(() => {
    if (!lightboxNodeId || !node) {
      setDataURL(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    if (!src) {
      setDataURL(null);
      setLoadError("画像パスが指定されていません");
      setLoading(false);
      return;
    }

    if (!hasWailsRuntime()) {
      setDataURL(null);
      setLoadError("デスクトップ実行時に画像を読み込みます");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void wailsBridge
      .getImageDataURL(src)
      .then((url) => {
        if (!cancelled) {
          setDataURL(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDataURL(null);
          setLoadError(
            err instanceof Error ? err.message : "画像の読み込みに失敗しました",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lightboxNodeId, node, src]);

  if (!lightboxNodeId || !node || !data) {
    return null;
  }

  const prompt = data.prompt?.trim() ? data.prompt : "";
  const providerLabel = data.provider
    ? PROVIDER_LABELS[data.provider] ?? data.provider
    : "";

  const handleAppendPrompt = () => {
    if (!prompt) return;
    appendPromptInput(prompt);
    useToastStore.getState().info("プロンプトを入力欄に追加しました");
  };

  const handleExportImage = async () => {
    if (!src) {
      useToastStore.getState().error("画像パスが指定されていません");
      return;
    }
    if (!hasWailsRuntime()) {
      useToastStore
        .getState()
        .info("画像出力はデスクトップ実行時に利用できます");
      return;
    }
    try {
      const saved = await wailsBridge.exportImage(src);
      if (saved) {
        useToastStore.getState().success("画像を出力しました");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().error(`画像出力に失敗しました: ${message}`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="画像拡大表示"
      onClick={closeLightbox}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {providerLabel && (
              <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {providerLabel}
              </span>
            )}
            {data.model && (
              <span className="truncate text-xs font-medium text-slate-600">
                {data.model}
              </span>
            )}
            {!providerLabel && !data.model && (
              <span className="truncate text-xs font-medium text-slate-600">
                {src || "画像プレビュー"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportImage()}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <Download className="h-3.5 w-3.5" />
              <span>画像をエクスポート</span>
            </button>

            <button
              type="button"
              onClick={closeLightbox}
              aria-label="ライトボックスを閉じる"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image Viewer */}
        <div className="flex min-h-[280px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-xs">画像を読み込み中...</span>
            </div>
          ) : dataURL ? (
            <img
              src={dataURL}
              alt={data.alt || prompt || src}
              className="max-h-[62vh] max-w-full rounded-lg object-contain shadow-sm"
            />
          ) : (
            <div className="flex max-w-md flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <ImageOff className="h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">
                画像を読み込めません
              </p>
              {src && (
                <p className="break-all font-mono text-xs text-slate-500">
                  {src}
                </p>
              )}
              {loadError && (
                <p className="text-xs text-red-600">{loadError}</p>
              )}
            </div>
          )}
        </div>

        {/* Prompt Footer */}
        {prompt && (
          <div
            className="flex flex-col gap-2 border-t p-4"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-surface-muted)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">
                生成プロンプト
              </span>
              <button
                type="button"
                onClick={handleAppendPrompt}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>入力欄へ追記</span>
              </button>
            </div>
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-white p-3 text-xs leading-relaxed text-slate-700"
               style={{ borderColor: "var(--border-subtle)" }}>
              {prompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
