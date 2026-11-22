import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { CanvasViewport } from "./components/canvas/CanvasViewport";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { CommandDock } from "./components/overlay/CommandDock";
import { ImageLightbox } from "./components/overlay/ImageLightbox";
import { NodeInspector } from "./components/overlay/NodeInspector";
import { SettingsModal } from "./components/overlay/SettingsModal";
import { ToastContainer } from "./components/overlay/ToastContainer";
import { TopToolbar } from "./components/overlay/TopToolbar";
import { useCanvasStore } from "./store/useCanvasStore";
import { useConfigStore } from "./store/useConfigStore";

export function App() {
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const setSelectedImageProvider = useCanvasStore(
    (s) => s.setSelectedImageProvider,
  );
  const isClearConfirmOpen = useCanvasStore((s) => s.isClearConfirmOpen);
  const setClearConfirmOpen = useCanvasStore((s) => s.setClearConfirmOpen);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const submitCommand = useCanvasStore((s) => s.submitCommand);
  const openCanvas = useCanvasStore((s) => s.openCanvas);
  const saveCanvas = useCanvasStore((s) => s.saveCanvas);

  useEffect(() => {
    void loadConfig().then((cfg) => {
      if (cfg?.imageGen?.provider) {
        setSelectedImageProvider(cfg.imageGen.provider);
      }
    });
  }, [loadConfig, setSelectedImageProvider]);

  return (
    <ReactFlowProvider>
      <main
        className="relative h-full w-full overflow-hidden"
        style={{
          backgroundColor: "var(--bg-canvas)",
          color: "var(--text-primary)",
        }}
      >
        <CanvasViewport />
        <TopToolbar onOpenCanvas={openCanvas} onSaveCanvas={saveCanvas} />
        <CommandDock onSubmit={() => submitCommand()} />
        <NodeInspector />
        <ImageLightbox />
        <SettingsModal />
        <ToastContainer />

        <ConfirmDialog
          open={isClearConfirmOpen}
          title="キャンバスを初期化"
          description="現在のノードとエッジをすべて消去します。この操作は取り消せません。よろしいですか？"
          confirmLabel="初期化する"
          cancelLabel="キャンセル"
          danger
          onConfirm={clearCanvas}
          onCancel={() => setClearConfirmOpen(false)}
        />
      </main>
    </ReactFlowProvider>
  );
}

export default App;
