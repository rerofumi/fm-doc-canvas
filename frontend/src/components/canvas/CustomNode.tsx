import React, { memo } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { AppNode, TextNodeData } from "../../types";
import { useAppStore } from "../../store/useAppStore";

const CustomNode = ({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<AppNode>) => {
  const { updateNodeDimensions } = useAppStore();

  return (
    <div
      className={`relative shadow-md rounded-md bg-white border-2 transition-colors flex flex-col ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
      }`}
      style={{
        width: width || 250,
        height: height || 150,
        minWidth: "150px",
        minHeight: "80px",
      }}
    >
      {selected && (
        <NodeResizer
          minWidth={150}
          minHeight={80}
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
        style={{ top: "50%" }}
      />
      {/* Invisible target handle for connection logic compatibility */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-3 h-3 bg-blue-400 border-2 border-white opacity-0 pointer-events-none"
        style={{ top: "50%" }}
      />

      <div className="flex flex-col h-full overflow-hidden p-3">
        <div className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider flex-shrink-0">
          Summary
        </div>
        <div className="text-sm text-gray-700 flex-grow overflow-y-auto custom-scrollbar whitespace-pre-wrap pr-1">
          {(data as TextNodeData).summary ||
            ((data as TextNodeData).content
              ? (data as TextNodeData).content.substring(0, 100) +
                ((data as TextNodeData).content.length > 100 ? "..." : "")
              : "No content")}
        </div>
      </div>

      {/* Right Handle - Target (In) */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-3 h-3 bg-blue-400 border-2 border-white"
        style={{ top: "50%" }}
      />
      {/* Invisible source handle for connection logic compatibility */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-3 h-3 bg-blue-400 border-2 border-white opacity-0 pointer-events-none"
        style={{ top: "50%" }}
      />
    </div>
  );
};

export default memo(CustomNode);
