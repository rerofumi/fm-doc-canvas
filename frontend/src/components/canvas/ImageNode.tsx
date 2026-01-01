import React, { memo, useEffect, useState } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { ImageNodeData } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import * as AppBackend from "../../../wailsjs/go/main/App";

const ImageNode = ({ data, selected, width, height }: NodeProps<any>) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
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
          onResizeEnd={(ns) => {
            // ns.width and ns.height contain the new dimensions
            // This is handled by React Flow's internal state management
            // If you need to do something specific on resize end, you can do it here
          }}
        />
      )}
      {/* Left Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-3 h-3 bg-blue-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="w-3 h-3 bg-blue-400 border-2 border-white"
        style={{ transform: "translateY(12px)" }}
      />

      <div className="w-full h-full flex items-center justify-center p-2">
        {loading && (
          <div className="text-xs text-gray-500">Loading image...</div>
        )}
        {error && (
          <div className="text-xs text-red-500 text-center p-2">{error}</div>
        )}
        {imageSrc && !loading && !error && (
          <img
            src={imageSrc}
            alt={(data as ImageNodeData)?.alt || "Generated image"}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Right Handles */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-3 h-3 bg-blue-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-3 h-3 bg-blue-400 border-2 border-white"
        style={{ transform: "translateY(12px)" }}
      />
    </div>
  );
};

export default memo(ImageNode);
