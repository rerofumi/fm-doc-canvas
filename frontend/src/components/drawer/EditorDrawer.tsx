import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Edit3, Eye, Zap, Loader2, GripVertical } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

const EditorDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    activeNodeId,
    nodes,
    updateNodeContent,
    updateNodeSummary,
    setDrawerOpen,
    setActiveNode,
    generateSummary,
  } = useAppStore();

  const [isEditMode, setIsEditMode] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  // Find the currently active node
  const activeNode = nodes.find((n) => n.id === activeNodeId);

  const handleClose = () => {
    setActiveNode(null);
    setDrawerOpen(false);
  };

  const handleRegenerateSummary = async () => {
    if (!activeNode || !activeNode.data.content || isSummarizing) return;

    setIsSummarizing(true);
    try {
      const summary = await generateSummary(activeNode.data.content);
      if (activeNodeId) {
        updateNodeSummary(activeNodeId, summary);
      }
    } catch (error: any) {
      console.error("Failed to regenerate summary:", error);
      alert(
        `Failed to regenerate summary: ${error.message || "Unknown error"}`,
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  // Resize logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        if (newWidth > 300 && newWidth < window.innerWidth * 0.8) {
          setDrawerWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      document.body.style.cursor = "col-resize";
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "default";
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  if (!activeNode && isDrawerOpen) {
    setDrawerOpen(false);
    return null;
  }

  return (
    <div
      ref={drawerRef}
      className={`fixed top-0 left-0 h-full bg-white shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col border-r border-gray-200 ${
        isDrawerOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        width: `${drawerWidth}px`,
        transitionProperty: isResizing ? "none" : "transform",
      }}
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors z-[60] flex items-center justify-center group"
      >
        <div className="hidden group-hover:flex items-center justify-center h-8 w-4 bg-white border border-gray-200 rounded shadow-sm -mr-3">
          <GripVertical size={12} className="text-gray-400" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 shrink-0">
        <h2 className="font-bold text-gray-700 flex items-center gap-2">
          <Edit3 size={18} />
          Node Editor
        </h2>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex p-2 gap-1 bg-white border-b border-gray-100 shrink-0">
        <button
          onClick={() => setIsEditMode(true)}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-sm font-medium transition-colors ${
            isEditMode
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Edit3 size={16} />
          Edit
        </button>
        <button
          onClick={() => setIsEditMode(false)}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-sm font-medium transition-colors ${
            !isEditMode
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Eye size={16} />
          Preview
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {isEditMode ? (
          <textarea
            className="flex-1 p-4 resize-none focus:outline-none text-gray-800 font-mono text-sm leading-relaxed"
            placeholder="Write your markdown here..."
            value={activeNode?.data.content || ""}
            onChange={(e) =>
              activeNodeId && updateNodeContent(activeNodeId, e.target.value)
            }
          />
        ) : (
          <div className="flex-1 p-6 overflow-y-auto prose prose-sm max-w-none prose-blue">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {activeNode?.data.content || "*No content to preview*"}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Summary Area (Fixed Bottom) */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Summary
          </label>
          <button
            onClick={handleRegenerateSummary}
            disabled={isSummarizing || !activeNode?.data.content}
            className={`flex items-center gap-1 text-xs font-bold transition-colors ${
              isSummarizing || !activeNode?.data.content
                ? "text-gray-400 cursor-not-allowed"
                : "text-blue-500 hover:text-blue-700"
            }`}
          >
            {isSummarizing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Zap size={12} />
            )}
            {isSummarizing ? "Generating..." : "Regenerate"}
          </button>
        </div>
        <textarea
          className="w-full p-2 text-sm border border-gray-200 rounded bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none h-20"
          placeholder="Summary will appear here..."
          value={activeNode?.data.summary || ""}
          onChange={(e) =>
            activeNodeId && updateNodeSummary(activeNodeId, e.target.value)
          }
        />
      </div>
    </div>
  );
};

export default EditorDrawer;
