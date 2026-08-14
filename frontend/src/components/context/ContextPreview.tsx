import React, { useMemo, useState } from "react";
import { useAppStore } from "../../store/useAppStore";

const ContextPreview: React.FC<{
  mode: "dialogue" | "direct";
  operation?: "read" | "generate-text" | "generate-image" | "mutate-text" | "summarize";
}> = ({ mode, operation = "read" }) => {
  const resolveSharedContext = useAppStore((s) => s.resolveSharedContext);
  const setContextExcluded = useAppStore((s) => s.setContextExcluded);
  const workspace = useAppStore((s) => s.workspace);
  const [open, setOpen] = useState(false);

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
    <div className="rounded border border-gray-200 bg-white text-xs" data-testid="context-preview">
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-1.5 text-left font-semibold text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Context ${envelope.activeContextNodeIds.length}`}
      >
        <span>
          Context {envelope.activeContextNodeIds.length}
          <span className="ml-2 font-normal text-gray-500">
            text {textCount} · image {imageCount}
          </span>
        </span>
        <span className="text-gray-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-gray-100 px-2 py-2">
          <div className="text-[11px] text-gray-500">
            Canvas: {envelope.canvasId} · digest {envelope.contextDigest}
          </div>
          {envelope.mutationTarget && (
            <div aria-label="Mutation target">
              Mutation: {JSON.stringify(envelope.mutationTarget)}
            </div>
          )}
          {envelope.payloadItems.map((item, idx) => {
            if (item.kind === "text" || item.kind.startsWith("image")) {
              const nodeId = "nodeId" in item ? item.nodeId : "";
              const node = workspace.document.nodes[nodeId];
              const label =
                node && "summary" in node
                  ? String((node as any).summary || nodeId)
                  : nodeId;
              const excluded = envelope.excludedNodeIds.includes(nodeId);
              return (
                <label key={`${item.kind}-${nodeId}-${idx}`} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={(e) => setContextExcluded(nodeId, !e.target.checked)}
                    aria-label={`Include ${label} in context`}
                  />
                  <span className="truncate">
                    {item.kind} → {item.destination}: {label}
                    {item.kind === "image-metadata" ? " (metadata only)" : ""}
                    {item.kind === "image-binary" ? " (pixel to LLM)" : ""}
                  </span>
                </label>
              );
            }
            return (
              <div key={`${item.kind}-${idx}`} className="text-gray-600">
                {item.kind}
                {"canvasId" in item ? `: ${item.canvasId}` : ""}
                {"relationId" in item ? `: ${item.relationId}` : ""}
              </div>
            );
          })}
          {envelope.projectedContextRefs.length > 0 && (
            <div aria-label="Candidate projected context">
              Candidate Context: {envelope.projectedContextRefs.length}
            </div>
          )}
          {envelope.relationHints.length > 0 && (
            <div aria-label="Accepted relations" className="rounded bg-indigo-50 p-1 text-indigo-800">
              Relations: {envelope.relationHints.map((relation) => `${relation.kind} (${relation.sourceNodeId} → ${relation.targetNodeId})`).join(", ")}
            </div>
          )}
          {envelope.spatialHints.length > 0 && (
            <div aria-label="Spatial hints" className="rounded bg-slate-50 p-1 text-slate-700">
              Spatial hints (meaning is not inferred): {envelope.spatialHints.map((hint) => `${hint.nodeId}@${Math.round(hint.position.x)},${Math.round(hint.position.y)}`).join(" · ")}
            </div>
          )}
          {envelope.delegatedSessionRefs.length > 0 && (
            <div aria-label="External work">
              External work: {envelope.delegatedSessionRefs.length}
            </div>
          )}
          {envelope.warnings.map((w, i) => (
            <div key={i} className="text-amber-700">
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContextPreview;
