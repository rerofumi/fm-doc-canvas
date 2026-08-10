import React, { memo, useEffect, useState } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { Check, Copy } from "lucide-react";
import { ImageNodeData } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import * as AppBackend from "../../../wailsjs/go/main/App";
import ImageOverlay from "./ImageOverlay/ImageOverlay";

const ImageNode = ({ id, data, selected, width, height }: NodeProps<any>) => {
  const { updateNodeDimensions, appendPromptInput } = useAppStore();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isPromptCopied, setIsPromptCopied] = useState(false);

  useEffect(() => {
    if (!selected && isOverlayOpen) {
      setIsOverlayOpen(false);
    }
  }, [selected, isOverlayOpen]);

  const getImageDataURL = async (src: string) => {
    try {
      const dataURL = await AppBackend.GetImageDataURL(src);
      return dataURL;
    } catch (error) {
      console.error("Failed to get image data URL:", error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchImage = async () => {
      if (!data || !(data as ImageNodeData).src) {
        setError("No image source provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const dataURL = await getImageDataURL((data as ImageNodeData).src);
        setImageSrc(dataURL);
      } catch (err: any) {
        console.error("Failed to load image:", err);
        setError(`Failed to load image: ${err.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [(data as ImageNodeData)?.src]);

  const promptText = ((data as ImageNodeData)?.prompt || "").toString().trim();
  const altText = ((data as ImageNodeData)?.alt || "Generated image")
    .toString()
    .trim();

  return (
    <>
      <div
        className={`shadow-md rounded-md border-2 transition-colors relative ${
          selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
        }`}
        style={{
          width: width || 200,
          height: height || 150,
          backgroundColor: "#f9fafb",
        }}
      >
        {selected && (
          <NodeResizer
            minWidth={100}
            minHeight={50}
            onResizeEnd={(_, params) => {
              updateNodeDimensions(id, params.width, params.height);
            }}
          />
        )}

        {/* Left Handle - Source (Out) */}
        <Handle
          type="source"
          position={Position.Left}
          id="left-source"
          className="w-3 h-3 bg-blue-400 border-2 border-white"
        />

        {/* Invisible target handle for connection logic compatibility if needed */}
        <Handle
          type="target"
          position={Position.Left}
          id="left-target"
          className="w-3 h-3 bg-blue-400 border-2 border-white opacity-0 pointer-events-none"
        />

        <div
          className={`w-full flex items-center justify-center p-2 overflow-hidden ${
            promptText ? "h-[calc(100%-40px)]" : "h-full"
          }`}
          onDoubleClick={() => {
            if (imageSrc) {
              setIsOverlayOpen(true);
            }
          }}
        >
          {loading && (
            <div className="text-xs text-gray-500">Loading image...</div>
          )}
          {error && (
            <div className="text-xs text-red-500 text-center p-2">{error}</div>
          )}
          {imageSrc && !loading && !error && (
            <img
              src={imageSrc}
              alt={altText}
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>

        {promptText && (
          <div className="absolute bottom-0 left-0 right-0 flex h-10 border-t border-gray-200 bg-white/95">
            <button
              type="button"
              title={promptText}
              onClick={(event) => {
                event.stopPropagation();
                appendPromptInput(promptText);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              className="min-w-0 flex-1 px-2 text-left text-[10px] leading-4 text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
            <span
              className="block overflow-hidden break-words"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {promptText}
            </span>
            </button>
            <button
              type="button"
              title="Copy prompt"
              onClick={async (event) => {
                event.stopPropagation();
                try {
                  await navigator.clipboard.writeText(promptText);
                  setIsPromptCopied(true);
                  window.setTimeout(() => setIsPromptCopied(false), 1200);
                } catch (copyError) {
                  console.error("Failed to copy image prompt:", copyError);
                }
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              className="flex w-8 shrink-0 items-center justify-center border-l border-gray-200 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {isPromptCopied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        )}

        {/* Right Handle - Target (In) */}
        <Handle
          type="target"
          position={Position.Right}
          id="right-target"
          className="w-3 h-3 bg-blue-400 border-2 border-white"
        />

        {/* Invisible source handle for connection logic compatibility if needed */}
        <Handle
          type="source"
          position={Position.Right}
          id="right-source"
          className="w-3 h-3 bg-blue-400 border-2 border-white opacity-0 pointer-events-none"
        />
      </div>

      {isOverlayOpen && (
        <ImageOverlay
          src={imageSrc!}
          alt={(data as ImageNodeData)?.alt || "Generated image"}
          onClose={() => setIsOverlayOpen(false)}
        />
      )}
    </>
  );
};

export default memo(ImageNode);
