import ContextPreview from "../context/ContextPreview";
import React, { useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, Send, Sparkles, Type } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { AppNode } from "../../types";
import * as AppBackend from "../../../wailsjs/go/main/App";

const PromptBar: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"text" | "image">("text");
  const [imageProvider, setImageProvider] = useState("openrouter");
  const [isImageProviderDirty, setIsImageProviderDirty] = useState(false);

  const {
    nodes,
    addNode,
    generateText,
    generateSummary,
    generateImage,
    getImageDataURL,
    resolveSharedContext,
    config,
    promptInput,
    setPromptInput,
  } = useAppStore();

  useEffect(() => {
    if (!isImageProviderDirty) {
      setImageProvider(config.imageGen.provider || "openrouter");
    }
  }, [config.imageGen.provider, isImageProviderDirty]);

  const getSelectedImageModel = () => {
    switch (imageProvider) {
      case "openrouter":
        return config.imageGen.openrouter?.model || "";
      case "openai":
        return config.imageGen.openai?.model || "";
      case "google":
        return config.imageGen.google?.model || "";
      case "xai":
        return config.imageGen.xai?.model || "";
      default:
        return "";
    }
  };

  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedNodesCount = selectedNodes.length;
  const selectedImageNodesCount = selectedNodes.filter(
    (node) => node.type === "imageNode",
  ).length;

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const prompt = promptInput;
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // Direct Action and Dialogue share the same resolver and allowlist.
      const operation = mode === "text" ? "generate-text" : "generate-image";
      const envelope = resolveSharedContext("direct", operation);
      const allowlisted = new Set(envelope.bodyAllowlistNodeIds);
      const contextNodes = nodes.filter((node) => allowlisted.has(node.id));
      const contextText = contextNodes
        .filter((node) => node.type === "customNode" || node.type === "artifactNode")
        .map((node) => (node.data as { content?: string }).content)
        .filter((content): content is string => Boolean(content))
        .join("\n\n---\n\n");

      const imageDataURLs: string[] = [];
      for (const node of contextNodes.filter((item) => item.type === "imageNode")) {
        try {
          imageDataURLs.push(await getImageDataURL((node.data as { src: string }).src));
        } catch (error) {
          console.warn("Failed to resolve an allowlisted image context:", error);
        }
      }

      const lastNode = selectedNodes.at(-1);
      const position = lastNode
        ? { x: lastNode.position.x + 350, y: lastNode.position.y }
        : { x: 400, y: 300 };

      if (mode === "text") {
        const generatedText = imageDataURLs.length > 0
          ? await AppBackend.GenerateTextWithImages(prompt, contextText, imageDataURLs)
          : await generateText(prompt, contextText);
        const summary = await generateSummary(generatedText);
        const newNode: AppNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: "customNode",
          position,
          data: { content: generatedText, summary, originalPrompt: prompt },
          width: 250,
          height: 150,
        };
        addNode(newNode);
      } else {
        const imageSrc = await generateImage(
          prompt,
          contextText,
          imageDataURLs,
          imageProvider,
        );
        const newNode: AppNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: "imageNode",
          position,
          data: {
            src: imageSrc,
            alt: prompt,
            prompt,
            provider: imageProvider,
            model: getSelectedImageModel(),
          },
          width: 300,
          height: 200,
        };
        addNode(newNode);
      }
      setPromptInput("");
    } catch (error: any) {
      console.error("Error generating AI content:", error);
      alert(`Failed to generate content: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      void handleSubmit();
    }
  };

  return (
    <div className="w-full bg-white border-t border-gray-200 p-4 shadow-lg z-10">
      <div className="px-3 pt-2">
        <ContextPreview
          mode="direct"
          operation={mode === "text" ? "generate-text" : "generate-image"}
        />
      </div>
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center bg-gray-100 rounded-md p-1" role="group" aria-label="Generation mode">
            <button
              type="button"
              onClick={() => setMode("text")}
              aria-pressed={mode === "text"}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${mode === "text" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Type size={14} /> Text
            </button>
            <button
              type="button"
              onClick={() => setMode("image")}
              aria-pressed={mode === "image"}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${mode === "image" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <ImageIcon size={14} /> Image
            </button>
          </div>

          {selectedNodesCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
              <Sparkles size={10} /> {selectedNodesCount} Node(s) Selected as Context
            </span>
          )}
          {selectedImageNodesCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
              <ImageIcon size={10} />+ {selectedImageNodesCount} Image(s)
            </span>
          )}

          {mode === "image" && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-medium">Provider</span>
              <select
                value={imageProvider}
                onChange={(event) => {
                  setImageProvider(event.target.value);
                  setIsImageProviderDirty(true);
                }}
                disabled={isLoading}
                className="h-7 rounded border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                title="Image generation provider for this request"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="xai">xAI</option>
              </select>
            </label>
          )}
        </div>

        <div className="relative group">
          <textarea
            rows={1}
            value={promptInput}
            onChange={(event) => setPromptInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={isLoading ? (mode === "text" ? "AI is generating text..." : "AI is generating image...") : (mode === "text" ? "Ask AI to generate documentation or expand on ideas... (Ctrl+Enter to send)" : "Describe the image you want to generate... (Ctrl+Enter to send)")}
            aria-label="Prompt"
            className={`w-full p-3 pr-14 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm transition-all min-h-[56px] max-h-32 ${isLoading ? "bg-gray-50 opacity-70" : ""}`}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!promptInput.trim() || isLoading}
            aria-label={mode === "text" ? "Generate Text" : "Generate Image"}
            title={mode === "text" ? "Generate Text (Ctrl+Enter)" : "Generate Image (Ctrl+Enter)"}
            className={`absolute right-2 bottom-2 p-2 rounded-md flex items-center justify-center transition-all ${promptInput.trim() && !isLoading ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptBar;
