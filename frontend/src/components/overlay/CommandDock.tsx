import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  Send,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useToastStore } from "../../store/useToastStore";
import type { ImageGenProviderId } from "../../types/config";
import { collectCanvasContext } from "../../utils/graphContext";

interface CommandDockProps {
  onSubmit?: () => void | Promise<void>;
}

const PROVIDER_OPTIONS: Array<{ id: ImageGenProviderId; label: string }> = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
  { id: "xai", label: "xAI" },
];

export function CommandDock({ onSubmit }: CommandDockProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const promptInput = useCanvasStore((s) => s.promptInput);
  const commandMode = useCanvasStore((s) => s.commandMode);
  const selectedImageProvider = useCanvasStore((s) => s.selectedImageProvider);
  const isGenerating = useCanvasStore((s) => s.isGenerating);

  const setPromptInput = useCanvasStore((s) => s.setPromptInput);
  const setCommandMode = useCanvasStore((s) => s.setCommandMode);
  const setSelectedImageProvider = useCanvasStore(
    (s) => s.setSelectedImageProvider,
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const contextResult = useMemo(
    () => collectCanvasContext(nodes, edges, selectedNodeIds),
    [nodes, edges, selectedNodeIds],
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [promptInput]);

  const canSubmit = !isGenerating && promptInput.trim().length > 0;

  const triggerSubmit = () => {
    if (!canSubmit) return;
    if (onSubmit) {
      void onSubmit();
    } else {
      useToastStore.getState().info("生成実行は次フェーズで接続されます");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isGenerating) {
        triggerSubmit();
      }
    }
  };

  const textCount = contextResult.textItems.length;
  const imageCount = contextResult.imageSrcs.length;
  const warnings = contextResult.warnings;

  return (
    <section
      aria-label="コマンドドック"
      className="fixed bottom-4 left-1/2 z-30 flex w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-1.5"
    >
      {/* Context Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <div
          className="inline-flex items-center gap-2 rounded-full border bg-white/85 px-3 py-1 text-[11px] shadow-sm backdrop-blur-md"
          style={{
            borderColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          {textCount === 0 && imageCount === 0 ? (
            <span>コンテキストなし</span>
          ) : (
            <span className="font-medium text-slate-700">
              コンテキスト: テキスト {textCount}件 / 画像 {imageCount}枚
            </span>
          )}
        </div>

        {warnings.length > 0 && (
          <div
            title={warnings.join("\n")}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[11px] font-medium text-amber-800 shadow-sm backdrop-blur-md"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="truncate">{warnings[0]}</span>
          </div>
        )}
      </div>

      {/* Main Dock */}
      <div
        className="flex flex-col gap-2 rounded-2xl border bg-white/90 p-2.5 shadow-lg backdrop-blur-md"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ backgroundColor: "var(--bg-surface-muted)" }}
          >
            <button
              type="button"
              onClick={() => setCommandMode("text")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                commandMode === "text"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              テキスト
            </button>
            <button
              type="button"
              onClick={() => setCommandMode("image")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                commandMode === "image"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              画像
            </button>
          </div>

          {commandMode === "image" && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="command-provider-select"
                className="text-[11px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                プロバイダー:
              </label>
              <select
                id="command-provider-select"
                value={selectedImageProvider}
                onChange={(e) =>
                  setSelectedImageProvider(e.target.value as ImageGenProviderId)
                }
                disabled={isGenerating}
                className="rounded-lg border bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              commandMode === "text"
                ? "AI に指示や質問を入力... (Ctrl+Enter で送信)"
                : "生成したい画像のプロンプトを入力... (Ctrl+Enter で送信)"
            }
            className="max-h-40 min-h-[38px] flex-1 resize-none rounded-xl border bg-white px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-blue-500"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />

          <button
            type="button"
            disabled={!canSubmit}
            onClick={triggerSubmit}
            aria-label="送信"
            className="inline-flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-primary)" }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>生成中</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>送信</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
