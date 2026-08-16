import React, { useMemo } from "react";
import { useAppStore } from "../../store/useAppStore";

const ContextPreview: React.FC<{
  mode: "dialogue" | "direct";
  operation?: "read" | "generate-text" | "generate-image" | "mutate-text" | "summarize";
}> = ({ mode, operation = "read" }) => {
  const resolveSharedContext = useAppStore((s) => s.resolveSharedContext);
  const workspace = useAppStore((s) => s.workspace);

  const envelope = useMemo(
    () => resolveSharedContext(mode, operation),
    // recompute when workspace identity fields change
    [mode, operation, resolveSharedContext, workspace.runtime.scopeEpoch, workspace.runtime.commandSequence, workspace.runtime.selection.revision, workspace.runtime.contextSelection.revision],
  );

  const textCount = envelope.payloadItems.filter((p) => p.kind === "text").length;
  const imageCount = envelope.payloadItems.filter((p) =>
    p.kind.startsWith("image"),
  ).length;

  return (
    <div
      className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700"
      data-testid="context-preview"
      data-context-mode={mode}
      data-context-operation={operation}
      role="status"
      aria-label={`Context payload: Text ${textCount}, Image ${imageCount}`}
    >
      Context <span className="font-normal">Text {textCount} · Image {imageCount}</span>
    </div>
  );
};

export default ContextPreview;
