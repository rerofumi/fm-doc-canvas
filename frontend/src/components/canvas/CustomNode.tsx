import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { AppNode } from "../../types";

const CustomNode = ({ data, selected }: NodeProps<AppNode>) => {
  return (
    <div
      className={`px-4 py-2 shadow-md rounded-md bg-white border-2 transition-colors ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
      }`}
      style={{ minWidth: "150px", maxWidth: "300px" }}
    >
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
        className="w-3 h-3 bg-blue-400 border-2 border-white -translate-y-4"
      />

      <div className="flex flex-col">
        <div className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
          Summary
        </div>
        <div className="text-sm text-gray-700 line-clamp-10 whitespace-pre-wrap">
          {data.summary ||
            (data.content
              ? data.content.substring(0, 100) +
                (data.content.length > 100 ? "..." : "")
              : "No content")}
        </div>
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
        className="w-3 h-3 bg-blue-400 border-2 border-white translate-y-4"
      />
    </div>
  );
};

export default memo(CustomNode);
