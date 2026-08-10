import React, { useEffect, useRef } from "react";

import CanvasArea from "./components/canvas/CanvasArea";

import EditorDrawer from "./components/drawer/EditorDrawer";

import PromptBar from "./components/layout/PromptBar";

import SettingsDrawer from "./components/drawer/SettingsDrawer";

import ChatDrawer from "./components/drawer/ChatDrawer";

import LayoutButton from "./components/layout/LayoutButton";

import ChatToggleButton from "./components/layout/ChatToggleButton";

import { useAppStore } from "./store/useAppStore";

import { useChatStore } from "./store/useChatStore";

import { ActiveChatRuns, ChatSession } from "./types/chat";

import { describeChatTarget } from "./utils/chatContext";

import { fromBackendChatSessions, settleInterruptedChatSessions, toBackendChatSessions } from "./utils/chatSession";

import { LoadChatSessions, SaveChatSessions } from "../wailsjs/go/main/App";

import { Save, FolderOpen, Plus, Menu } from "lucide-react";

import { ReactFlowProvider } from "@xyflow/react";

function App() {
  const {
    addEmptyNode,
    addArtifactNode,
    nodes,
    canvasId,
    activeNodeId,
    isEditorOpen,
    loadConfig,
    saveCanvas,
    loadCanvas,
    setSettingsOpen,
  } = useAppStore();
  const chatCanvasId = useChatStore((state) => state.canvasId);
  const chatLoaded = useChatStore((state) => state.isLoaded);
  const chatSessions = useChatStore((state) => state.sessions);
  const activeChatRuns = useChatStore((state) => state.activeRuns);
  const beginChatLoad = useChatStore((state) => state.beginLoad);
  const hydrateChat = useChatStore((state) => state.hydrate);
  const failChatLoad = useChatStore((state) => state.failLoad);
  const setChatTarget = useChatStore((state) => state.setTarget);
  const initialNodeAdded = useRef(false);
  const latestChat = useRef<{
    canvasId: string | null;
    isLoaded: boolean;
    sessions: ChatSession[];
    activeRuns: ActiveChatRuns;
  }>({ canvasId: null, isLoaded: false, sessions: [], activeRuns: {} });
  latestChat.current = {
    canvasId: chatCanvasId,
    isLoaded: chatLoaded,
    sessions: chatSessions,
    activeRuns: activeChatRuns,
  };

  // Load configuration on startup
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 新規キャンバスだけに初期 Artifact を 1 個用意する。
  useEffect(() => {
    if (nodes.length === 0 && !initialNodeAdded.current) {
      initialNodeAdded.current = true;
      addArtifactNode();
    }
  }, [addArtifactNode, nodes.length]);

  // Text/Artifact targets follow EditorDrawer focus. Images can be targeted
  // directly because they do not use EditorDrawer. Target changes never switch
  // the selected chat session.
  useEffect(() => {
    const activeNode = nodes.find((node) => node.id === activeNodeId);
    const canTarget = activeNode?.type === "imageNode" || isEditorOpen;
    setChatTarget(canTarget ? describeChatTarget(activeNode) : null);
  }, [activeNodeId, isEditorOpen, nodes, setChatTarget]);

  useEffect(() => {
    const previous = latestChat.current;
    let cancelled = false;
    beginChatLoad(canvasId);

    const load = async () => {
      if (previous.isLoaded && previous.canvasId && previous.canvasId !== canvasId) {
        try {
          const settled = settleInterruptedChatSessions(previous.sessions, previous.activeRuns);
          await SaveChatSessions(previous.canvasId, toBackendChatSessions(settled));
        } catch (error) {
          console.error("Failed to flush previous chat sessions:", error);
        }
      }
      if (cancelled) return;
      try {
        const sessions = await LoadChatSessions(canvasId);
        if (!cancelled) hydrateChat(canvasId, fromBackendChatSessions(sessions));
      } catch (error) {
        console.error("Failed to load chat sessions:", error);
        if (!cancelled) failChatLoad(canvasId, error instanceof Error ? error.message : String(error));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [beginChatLoad, canvasId, failChatLoad, hydrateChat]);

  useEffect(() => {
    if (!chatLoaded || chatCanvasId !== canvasId) return;
    const timer = window.setTimeout(() => {
      SaveChatSessions(canvasId, toBackendChatSessions(chatSessions)).catch((error) => console.error("Failed to save chat sessions:", error));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [canvasId, chatCanvasId, chatLoaded, chatSessions]);

  useEffect(() => {
    const flushLatest = () => {
      const latest = latestChat.current;
      if (!latest.isLoaded || !latest.canvasId) return;
      const settled = settleInterruptedChatSessions(latest.sessions, latest.activeRuns);
      void SaveChatSessions(latest.canvasId, toBackendChatSessions(settled)).catch((error) =>
        console.error("Failed to flush chat sessions:", error),
      );
    };
    window.addEventListener("beforeunload", flushLatest);
    return () => {
      window.removeEventListener("beforeunload", flushLatest);
      flushLatest();
    };
  }, []);

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
      {/* Settings Drawer */}
      <SettingsDrawer />
      <ChatDrawer />

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
            <span>Node</span>
          </button>
          <button
            onClick={addArtifactNode}
            className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700"
            title="Add Artifact"
          >
            <Plus size={14} />
            <span>Artifact</span>
          </button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <LayoutButton />

          <ChatToggleButton />

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Settings button moved to header */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
            title="Settings"
          >
            <Menu size={20} />
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
