import React, { useEffect, useState, useRef } from "react";
import CanvasArea from "./components/canvas/CanvasArea";
import EditorDrawer from "./components/drawer/EditorDrawer";
import PromptBar from "./components/layout/PromptBar";
import SettingsModal from "./components/ui/SettingsModal";
import LayoutButton from "./components/layout/LayoutButton";
import { useAppStore } from "./store/useAppStore";
import { Save, FolderOpen, Settings, Plus } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";

function App() {
  const { addNode, addEmptyNode, nodes, loadConfig, saveCanvas, loadCanvas } =
    useAppStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const initialNodeAdded = useRef(false);

  // Load configuration on startup
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Add an initial node if the canvas is empty (for demo/development)
  useEffect(() => {
    if (nodes.length === 0 && !initialNodeAdded.current) {
      initialNodeAdded.current = true;
      addNode({
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "customNode",
        position: { x: 250, y: 150 },
        width: 250,
        height: 200,
        data: {
          content:
            "# Welcome to FM Doc Canvas\n\nThis is a node-based documentation tool. \n\n- **Click** a node to edit its content in the drawer.\n- **Drag** from the handles to connect nodes.\n- **Use the Prompt Bar** at the bottom to generate new content using AI.",
          summary:
            "Welcome to FM Doc Canvas! Click to start editing and exploring node-based documentation.",
        },
      } as any);
    }
  }, [addNode, nodes.length]);

  const handleSave = async () => {
    try {
      const path = await saveCanvas();
      if (path) {
        console.log("Saved to:", path);
      }
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 font-sans text-gray-900">
      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Header */}
      <header className="h-12 border-b border-gray-200 bg-white flex items-center px-4 justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">
            FM
          </div>
          <h1 className="text-sm font-bold tracking-tight">FM Doc Canvas</h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={addEmptyNode}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors mr-2"
            title="Add New Node"
          >
            <Plus size={14} />
            <span>New Node</span>
          </button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <LayoutButton />

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <button
            onClick={handleLoad}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="Open Canvas (JSON)"
          >
            <FolderOpen size={14} />
            <span>Open</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="Save Canvas (JSON)"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content: Canvas Area & Drawer */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* The Drawer is fixed/absolute so it slides over the canvas */}
        <EditorDrawer />

        <main className="flex-1 h-full w-full relative">
          <ReactFlowProvider>
            <CanvasArea />
          </ReactFlowProvider>
        </main>
      </div>

      {/* AI Interaction Bar */}
      <PromptBar />
    </div>
  );
}

export default App;
