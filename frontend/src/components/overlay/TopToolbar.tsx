import { useReactFlow } from "@xyflow/react";
import { FolderOpen, LayoutGrid, Plus, Save, Settings } from "lucide-react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useToastStore } from "../../store/useToastStore";

interface TopToolbarProps {
  onOpenCanvas?: () => void | Promise<void>;
  onSaveCanvas?: () => void | Promise<void>;
}

export function TopToolbar({ onOpenCanvas, onSaveCanvas }: TopToolbarProps) {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const zoom = useCanvasStore((s) => s.zoom);
  const addTextNode = useCanvasStore((s) => s.addTextNode);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);

  const handleAddMemo = () => {
    const center =
      typeof window !== "undefined"
        ? screenToFlowPosition({
            x: window.innerWidth / 2 - 140,
            y: window.innerHeight / 2 - 80,
          })
        : { x: 200, y: 200 };
    addTextNode({ position: center, selected: true });
  };

  const handleLayout = () => {
    const changed = applyLayout();
    if (changed) {
      requestAnimationFrame(() => {
        void fitView({ padding: 0.2, duration: 250 });
      });
    } else {
      useToastStore.getState().info("整頓するノードがありません");
    }
  };

  const handleFitView = () => {
    void fitView({ padding: 0.2, duration: 250 });
  };

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 active:bg-slate-200/70";

  return (
    <>
      <header
        className="fixed left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-white/85 px-2 py-1.5 shadow-sm backdrop-blur-md"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <button type="button" onClick={handleAddMemo} className={btnClass}>
          <Plus className="h-3.5 w-3.5 text-blue-600" />
          <span>+ メモ</span>
        </button>

        <button type="button" onClick={handleLayout} className={btnClass}>
          <LayoutGrid className="h-3.5 w-3.5 text-slate-600" />
          <span>整頓</span>
        </button>

        <div className="mx-0.5 h-4 w-px bg-slate-200" />

        <button
          type="button"
          onClick={() => {
            if (onOpenCanvas) {
              void onOpenCanvas();
            } else {
              useToastStore.getState().info("読み込み機能は次フェーズで接続されます");
            }
          }}
          className={btnClass}
        >
          <FolderOpen className="h-3.5 w-3.5 text-slate-600" />
          <span>開く</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onSaveCanvas) {
              void onSaveCanvas();
            } else {
              useToastStore.getState().info("保存機能は次フェーズで接続されます");
            }
          }}
          className={btnClass}
        >
          <Save className="h-3.5 w-3.5 text-slate-600" />
          <span>保存</span>
        </button>

        <div className="mx-0.5 h-4 w-px bg-slate-200" />

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className={btnClass}
        >
          <Settings className="h-3.5 w-3.5 text-slate-600" />
          <span>設定</span>
        </button>
      </header>

      <button
        type="button"
        onClick={handleFitView}
        title="全体を表示 (fitView)"
        className="fixed right-4 top-4 z-30 rounded-full border bg-white/85 px-3 py-1 text-xs font-medium tabular-nums text-slate-600 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-slate-900"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {Math.round(zoom * 100)}%
      </button>
    </>
  );
}
