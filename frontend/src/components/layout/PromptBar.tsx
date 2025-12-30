import React, { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { AppNode } from "../../types";

const PromptBar: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { nodes, addNode, generateText, generateSummary } = useAppStore();

  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedNodesCount = selectedNodes.length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // 1. Construct context from selected nodes
      const context = selectedNodes
        .map((n) => n.data.content)
        .filter((content) => !!content)
        .join("\n\n---\n\n");

      // 2. Generate text from LLM via Backend
      const generatedText = await generateText(prompt, context);

      // 3. Generate summary for the new content via Backend
      const summary = await generateSummary(generatedText);

      // 4. Determine position for the new node
      let position = { x: 400, y: 300 };
      if (selectedNodes.length > 0) {
        const lastNode = selectedNodes[selectedNodes.length - 1];
        position = {
          x: lastNode.position.x + 350,
          y: lastNode.position.y,
        };
      }

      // 5. Create and add the new node
      const newNode: AppNode = {
        id: `node-${Date.now()}`,
        type: "customNode",
        position,
        data: {
          content: generatedText,
          summary: summary,
        },
      };

      addNode(newNode);
      setPrompt("");
    } catch (error: any) {
      console.error("Error generating AI content:", error);
      alert(`Failed to generate content: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="w-full bg-white border-t border-gray-200 p-4 shadow-lg z-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {selectedNodesCount > 0 && (
          <div className="flex items-center gap-2 px-2">
            <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">
              <Sparkles size={10} />
              {selectedNodesCount} Node(s) Selected as Context
            </span>
          </div>
        )}

        <div className="relative group">
          <textarea
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              isLoading
                ? "AI is generating content..."
                : "Ask AI to generate documentation or expand on ideas... (Ctrl+Enter to send)"
            }
            className={`w-full p-3 pr-14 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm transition-all min-h-[56px] max-h-32 ${
              isLoading ? "bg-gray-50 opacity-70" : ""
            }`}
            style={{
              height: "auto",
              minHeight: "56px",
            }}
          />

          <button
            onClick={() => handleSubmit()}
            disabled={!prompt.trim() || isLoading}
            className={`absolute right-2 bottom-2 p-2 rounded-md flex items-center justify-center transition-all ${
              prompt.trim() && !isLoading
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            title="Send (Ctrl+Enter)"
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptBar;
