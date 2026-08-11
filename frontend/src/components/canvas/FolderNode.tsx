import React, { memo } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Folder } from "lucide-react";
import { AppNode, FolderNodeData } from "../../types";

const FolderNode = ({ data, selected }: NodeProps<AppNode>) => {
  const folder = data as FolderNodeData;
  return (
    <div
      className={`rounded-lg border-2 bg-amber-50 shadow-md transition-colors ${
        selected ? "border-amber-500 ring-2 ring-amber-200" : "border-amber-200"
      }`}
      style={{ width: 220, minHeight: 100 }}
      data-testid={`folder-node-${folder.childCanvasId}`}
      role="group"
      aria-label={`SubCanvas ${folder.label}`}
    >
      <Handle type="source" position={Position.Left} id="left-source" className="w-3 h-3 bg-amber-400" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <div className="flex items-start gap-2 p-3">
        <Folder className="mt-0.5 text-amber-600" size={18} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            SubCanvas
          </div>
          <div className="truncate text-sm font-semibold text-gray-800">{folder.label}</div>
          {typeof folder.badgeCount === "number" && folder.badgeCount > 0 && (
            <div className="mt-1 inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              {folder.badgeCount} relations
            </div>
          )}
        </div>
      </div>
      <Handle type="target" position={Position.Right} id="right-target" className="w-3 h-3 bg-amber-400" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />
    </div>
  );
};

export default memo(FolderNode);
