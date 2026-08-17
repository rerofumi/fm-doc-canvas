import React, { memo } from "react";
import { Handle, NodeProps, NodeResizer, Position } from "@xyflow/react";
import { AppNode, ArtifactNodeData } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import MarkdownContent from "../markdown/MarkdownContent";

const PREVIEW_LIMIT = 1800;

const ArtifactNode = ({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<AppNode>) => {
  const { updateNodeDimensions } = useAppStore();
  const artifact = data as ArtifactNodeData;
  const preview = artifact.content.slice(0, PREVIEW_LIMIT);

  return (
    <div
      className={`relative flex flex-col rounded-md border-2 bg-white shadow-md transition-colors ${
        selected ? "border-purple-500 ring-2 ring-purple-200" : "border-purple-200"
      }`}
      style={{
        width: width || 300,
        height: height || 220,
        minWidth: "180px",
        minHeight: "120px",
      }}
    >
      {selected && (
        <NodeResizer
          minWidth={180}
          minHeight={120}
          onResizeEnd={(_, params) => {
            updateNodeDimensions(id, params.width, params.height);
          }}
        />
      )}

      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="h-3 w-3 border-2 border-white bg-purple-400"
        style={{ top: "50%" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="pointer-events-none h-3 w-3 border-2 border-white bg-purple-400 opacity-0"
        style={{ top: "50%" }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <div className="mb-1 flex shrink-0 items-center gap-2">
          <div className="truncate text-xs font-bold text-purple-700" title={artifact.filename}>
            {artifact.filename}
          </div>
        </div>
        <div className="mb-2 flex shrink-0 gap-2 text-[10px] text-gray-400">
          <span>{artifact.charCount.toLocaleString()} chars</span>
          <span>·</span>
          <span>{artifact.wordCount.toLocaleString()} words</span>
        </div>
        <div className="prose prose-sm min-h-0 max-w-none flex-1 overflow-y-auto pr-1 text-gray-700 custom-scrollbar">
          <MarkdownContent>
            {preview || "*No content*"}
          </MarkdownContent>
          {artifact.content.length > PREVIEW_LIMIT && (
            <div className="mt-2 text-[10px] italic text-gray-400">Preview truncated…</div>
          )}
        </div>
      </div>

      {artifact.summary && (
        <div className="shrink-0 border-t border-purple-100 bg-purple-50/70 px-3 py-2">
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-400">
            Summary
          </div>
          <div
            className="overflow-hidden text-[10px] leading-4 text-purple-900"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
            title={artifact.summary}
          >
            {artifact.summary}
          </div>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="h-3 w-3 border-2 border-white bg-purple-400"
        style={{ top: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="pointer-events-none h-3 w-3 border-2 border-white bg-purple-400 opacity-0"
        style={{ top: "50%" }}
      />
    </div>
  );
};

export default memo(ArtifactNode);
