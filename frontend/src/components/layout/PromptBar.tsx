import React, { useState } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  Type,
  Image as ImageIcon,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { AppNode } from "../../types";

const PromptBar: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"text" | "image">("text"); // モード切替用
  const { nodes, addNode, generateText, generateSummary, generateImage } =
    useAppStore();

  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedNodesCount = selectedNodes.length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    try {
      if (mode === "text") {
        // 1. Construct context from selected nodes (text only)
        const context = selectedNodes
          .filter((n) => n.type === "customNode") // Only text nodes for text generation
          .map((n) => (n.data as any).content)
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

        // 5. Create and add the new text node
        const newNode: AppNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "customNode",
          position,
          data: {
            content: generatedText,
            summary: summary,
          },
        };

        addNode(newNode);
      } else if (mode === "image") {
        // Image generation mode
        // 1. Construct context from selected nodes (text only for Phase 2)
        const context = selectedNodes
          .filter((n) => n.type === "customNode") // Only text nodes for image generation context in Phase 2
          .map((n) => (n.data as any).content)
          .filter((content) => !!content)
          .join("\n\n---\n\n");

        // 2. For Phase 2, reference images are not included in the request
        const refImages: string[] = [];

        // 3. Generate image from LLM via Backend
        const imageSrc = await generateImage(prompt, refImages);

        // 4. Determine position for the new node
        let position = { x: 400, y: 300 };
        if (selectedNodes.length > 0) {
          const lastNode = selectedNodes[selectedNodes.length - 1];
          position = {
            x: lastNode.position.x + 350,
            y: lastNode.position.y,
          };
        }

        // 5. Create and add the new image node
        const newNode: AppNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "imageNode",
          position,
          data: {
            src: imageSrc,
            alt: prompt,
          },
          width: 300,
          height: 200,
        };

        addNode(newNode);

        // 6. Create a text node with the prompt used for image generation
        const promptNode: AppNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "customNode",
          position: {
            x: position.x,
            y: position.y + 250, // Position below the image node
          },
          data: {
            content: `**Prompt used for image generation:**\n\n${prompt}`,
            summary: "Image generation prompt",
          },
          width: 300,
          height: 150,
        };

        addNode(promptNode);
      }

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
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setMode("text")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                mode === "text"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Type size={14} />
              Text
            </button>
            <button
              onClick={() => setMode("image")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                mode === "image"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <ImageIcon size={14} />
              Image
            </button>
          </div>

          {selectedNodesCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">
              <Sparkles size={10} />
              {selectedNodesCount} Node(s) Selected as Context
            </span>
          )}
        </div>

        <div className="relative group">
          <textarea
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              isLoading
                ? mode === "text"
                  ? "AI is generating text..."
                  : "AI is generating image..."
                : mode === "text"
                  ? "Ask AI to generate documentation or expand on ideas... (Ctrl+Enter to send)"
                  : "Describe the image you want to generate... (Ctrl+Enter to send)"
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
            title={
              mode === "text"
                ? "Generate Text (Ctrl+Enter)"
                : "Generate Image (Ctrl+Enter)"
            }
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
