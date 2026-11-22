import { useEffect } from "react";
import { Download, Edit3, FileText, Maximize2, Presentation, Trash2 } from "lucide-react";
import { hasWailsRuntime, wailsBridge } from "../../services/wailsBridge";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useToastStore } from "../../store/useToastStore";
import type { ImageNodeData, TextNodeData } from "../../types/canvas";
import { buildMarpMarkdown, collectMarpSlideNodes } from "../../utils/marpExport";

export type ContextMenuTarget =
  | { kind: "textNode"; nodeId: string }
  | { kind: "imageNode"; nodeId: string }
  | { kind: "multiSelection"; nodeIds: string[] }
  | { kind: "edge"; edgeId: string };

export interface ContextMenuState {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  useEffect(() => {
    if (!menu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const handleClickOutside = () => onClose();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [menu, onClose]);

  if (!menu) {
    return null;
  }

  const handleExportMarp = async (targetNodeIds: string[]) => {
    const { nodes, edges } = useCanvasStore.getState();
    const { orderedNodes, warnings } = collectMarpSlideNodes(
      nodes,
      edges,
      targetNodeIds,
    );
    if (orderedNodes.length === 0) {
      useToastStore.getState().warning("出力対象のノードがありません");
      return;
    }

    const imageUrlMap: Record<string, string> = {};
    if (hasWailsRuntime()) {
      for (const n of orderedNodes) {
        if (n.type === "imageNode") {
          const src = (n.data as ImageNodeData).src;
          if (src && !imageUrlMap[src]) {
            try {
              imageUrlMap[src] = await wailsBridge.getImageFileURL(src);
            } catch {
              // 欠損画像は marpExport 側でフォールバックコメントになる
            }
          }
        }
      }
    }

    const md = buildMarpMarkdown(orderedNodes, imageUrlMap);
    if (!hasWailsRuntime()) {
      useToastStore.getState().info("Marp Markdown を生成しました");
      return;
    }
    try {
      const saved = await wailsBridge.exportMarkdown(md);
      if (saved) {
        if (warnings.length > 0) {
          useToastStore.getState().warning(warnings[0]);
        }
        useToastStore.getState().success("Marp スライドを出力しました");
      }
    } catch (err) {
      useToastStore
        .getState()
        .error(
          `Marp 出力に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
  };

  const handleExportSingleMarkdown = async (nodeId: string) => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "customNode") return;
    const data = node.data as TextNodeData;
    const content = data.content || data.summary || "";
    if (!hasWailsRuntime()) {
      useToastStore.getState().info("Markdown 出力はデスクトップ実行時に利用できます");
      return;
    }
    try {
      const saved = await wailsBridge.exportMarkdown(content);
      if (saved) {
        useToastStore.getState().success("Markdown を出力しました");
      }
    } catch (err) {
      useToastStore
        .getState()
        .error(
          `Markdown 出力に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
  };

  const handleExportSingleImage = async (nodeId: string) => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "imageNode") return;
    const src = (node.data as ImageNodeData).src;
    if (!src) {
      useToastStore.getState().error("画像パスが指定されていません");
      return;
    }
    if (!hasWailsRuntime()) {
      useToastStore.getState().info("画像出力はデスクトップ実行時に利用できます");
      return;
    }
    try {
      const saved = await wailsBridge.exportImage(src);
      if (saved) {
        useToastStore.getState().success("画像を出力しました");
      }
    } catch (err) {
      useToastStore
        .getState()
        .error(
          `画像出力に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
  };

  const left = Math.min(menu.x, typeof window !== "undefined" ? window.innerWidth - 200 : menu.x);
  const top = Math.min(menu.y, typeof window !== "undefined" ? window.innerHeight - 200 : menu.y);

  const itemClass =
    "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100";
  const dangerClass =
    "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50";

  return (
    <div
      className="fixed z-50 min-w-[176px] rounded-xl border p-1.5 shadow-lg backdrop-blur-md"
      style={{
        left,
        top,
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.target.kind === "textNode" && (
        <>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              useCanvasStore.getState().openInspector(menu.target.kind === "textNode" ? menu.target.nodeId : "");
              onClose();
            }}
          >
            <Edit3 className="h-3.5 w-3.5" />
            編集
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              if (menu.target.kind === "textNode") {
                void handleExportSingleMarkdown(menu.target.nodeId);
              }
              onClose();
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            Markdown 出力
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              if (menu.target.kind === "textNode") {
                void handleExportMarp([menu.target.nodeId]);
              }
              onClose();
            }}
          >
            <Presentation className="h-3.5 w-3.5" />
            Marp 出力
          </button>
          <div className="my-1 border-t" style={{ borderColor: "var(--border-subtle)" }} />
          <button
            type="button"
            className={dangerClass}
            onClick={() => {
              if (menu.target.kind === "textNode") {
                useCanvasStore.getState().deleteNodes([menu.target.nodeId]);
              }
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            削除
          </button>
        </>
      )}

      {menu.target.kind === "imageNode" && (
        <>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              if (menu.target.kind === "imageNode") {
                useCanvasStore.getState().openLightbox(menu.target.nodeId);
              }
              onClose();
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            拡大表示
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              if (menu.target.kind === "imageNode") {
                void handleExportSingleImage(menu.target.nodeId);
              }
              onClose();
            }}
          >
            <Download className="h-3.5 w-3.5" />
            画像出力
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              if (menu.target.kind === "imageNode") {
                void handleExportMarp([menu.target.nodeId]);
              }
              onClose();
            }}
          >
            <Presentation className="h-3.5 w-3.5" />
            Marp 出力
          </button>
          <div className="my-1 border-t" style={{ borderColor: "var(--border-subtle)" }} />
          <button
            type="button"
            className={dangerClass}
            onClick={() => {
              if (menu.target.kind === "imageNode") {
                useCanvasStore.getState().deleteNodes([menu.target.nodeId]);
              }
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            削除
          </button>
        </>
      )}

      {menu.target.kind === "multiSelection" && (
        <>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              if (menu.target.kind === "multiSelection") {
                void handleExportMarp(menu.target.nodeIds);
              }
              onClose();
            }}
          >
            <Presentation className="h-3.5 w-3.5" />
            Marp 出力（{menu.target.nodeIds.length}件）
          </button>
          <div className="my-1 border-t" style={{ borderColor: "var(--border-subtle)" }} />
          <button
            type="button"
            className={dangerClass}
            onClick={() => {
              if (menu.target.kind === "multiSelection") {
                useCanvasStore.getState().deleteNodes(menu.target.nodeIds);
              }
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            選択ノードを削除
          </button>
        </>
      )}

      {menu.target.kind === "edge" && (
        <button
          type="button"
          className={dangerClass}
          onClick={() => {
            if (menu.target.kind === "edge") {
              useCanvasStore.getState().deleteEdges([menu.target.edgeId]);
            }
            onClose();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          エッジを削除
        </button>
      )}
    </div>
  );
}
