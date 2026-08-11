import React, { useEffect } from "react";
import CanvasArea from "./components/canvas/CanvasArea";
import EditorDrawer from "./components/drawer/EditorDrawer";
import PromptBar from "./components/layout/PromptBar";
import SettingsDrawer from "./components/drawer/SettingsDrawer";
import ChatDrawer from "./components/drawer/ChatDrawer";
import LayoutButton from "./components/layout/LayoutButton";
import ChatToggleButton from "./components/layout/ChatToggleButton";
import CanvasBreadcrumb from "./components/layout/CanvasBreadcrumb";
import { useAppStore } from "./store/useAppStore";
import { useChatStore } from "./store/useChatStore";
import { Save, FolderOpen, Plus, Menu, Trash2, Undo2 } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { useE2EBridge } from "./runtime/e2eBridge";

function App() {
const {
    addEmptyNode,
    addArtifactNode,
    loadConfig,
    saveCanvas,
    loadCanvas,
    setSettingsOpen,
    newWorkspace,
    undo,
    lastError,
    workspace,
  } = useAppStore();

  useE2EBridge();
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Dialogue is memory-only and scoped to the active workspace generation.
  useEffect(() => {
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
      activeRuns: {},
      isLoaded: true,
      loadError: null,
      canvasId: workspace.document.workspaceId,
      contextWarning: null,
    });
  }, [workspace.document.workspaceId, workspace.runtime.runtimeGeneration]);

  const handleSave = async () => {
    try {
      const path = await saveCanvas();
      if (path) console.log("Saved to:", path);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const handleLoad = async () => {
    try {
      await loadCanvas();
    } catch (error) {
      console.error("Load failed:", error);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 font-sans text-gray-900">
      <SettingsDrawer />
      <ChatDrawer />

      <header className="z-20 flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
            FM
          </div>
          <h1 className="text-sm font-bold tracking-tight">FM Doc Canvas</h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={addEmptyNode}
            className="mr-1 flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
            title="Add Text"
            aria-label="Add Text"
          >
            <Plus size={14} />
            <span>Text</span>
          </button>
          <button
            onClick={addArtifactNode}
            className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700"
            title="Add Artifact"
            aria-label="Add Artifact"
          >
            <Plus size={14} />
            <span>Artifact</span>
          </button>

          <div className="mx-1 h-4 w-px bg-gray-200" />

          <button
            onClick={() => newWorkspace()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            title="Discard current unsaved work and Dialogue"
            aria-label="New Workspace (discard current work and Dialogue)"
          >
            <Trash2 size={14} />
            New Workspace
          </button>

          <button
            onClick={() => undo()}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 size={18} />
          </button>

          <button
            onClick={handleSave}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            title="Save"
            aria-label="Save Workspace"
          >
            <Save size={18} />
          </button>
          <button
            onClick={handleLoad}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            title="Load"
            aria-label="Load Workspace"
          >
            <FolderOpen size={18} />
          </button>

          <div className="mx-1 h-4 w-px bg-gray-200" />
          <LayoutButton />
          <ChatToggleButton />
          <div className="mx-1 h-4 w-px bg-gray-200" />
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            title="Settings"
            aria-label="Settings"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {lastError && (
        <div
          className="border-b border-red-200 bg-red-50 px-4 py-1 text-xs text-red-700"
          role="alert"
          aria-label="Workspace error"
        >
          {lastError}
        </div>
      )}

      <CanvasBreadcrumb />

      <div className="relative flex flex-1 overflow-hidden">
        <EditorDrawer />
        <main className="relative h-full w-full flex-1">
          <ReactFlowProvider>
            <CanvasArea />
          </ReactFlowProvider>
        </main>
      </div>

      <PromptBar />
    </div>
  );
}

export default App;

