import type React from "react";
import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { isTextBearing } from "../../domain/workspace";
import type { ClusterViewClusterDraft } from "../../domain/generatedView";

/**
 * Preview + confirm dialog for converting a single cluster to a SubCanvas.
 * Shows members, an editable Folder label, destination (Current Canvas), and
 * a note that boundary Relations are kept via the existing aggregate.
 */
const ConvertClusterDialog: React.FC<{
  cluster: ClusterViewClusterDraft;
  onCancel: () => void;
  onConfirm: (label: string) => void;
}> = ({ cluster, onCancel, onConfirm }) => {
  const workspace = useAppStore((s) => s.workspace);
  const [label, setLabel] = useState(cluster.label);

  useEffect(() => {
    setLabel(cluster.label);
  }, [cluster.label]);

  const members = cluster.nodeIds
    .map((id) => workspace.document.nodes[id])
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label={`Convert ${cluster.label} to SubCanvas`}
      data-testid="convert-cluster-dialog"
    >
      <div className="w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
        <div className="text-sm font-bold">Convert cluster to SubCanvas</div>
        <div className="mt-2 text-xs text-gray-500">
          Move {members.length} member{members.length === 1 ? "" : "s"} into a
          new SubCanvas (Folder) on the Current Canvas.
        </div>
        <div className="mt-2 max-h-40 overflow-auto rounded border border-gray-100 bg-gray-50 p-2">
          {members.map((node) => (
            <div key={node.id} className="truncate text-[11px] text-gray-600">
              {node.id}:{" "}
              {isTextBearing(node)
                ? node.summary || node.content.slice(0, 40)
                : node.kind}
            </div>
          ))}
        </div>
        <label className="mt-3 block text-xs font-semibold text-gray-700">
          Folder label
          <input
            aria-label="Folder label"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <div className="mt-2 text-[10px] text-gray-400">
          Boundary Relations to nodes outside this cluster are kept via the
          existing boundary aggregate. Undo restores both the document and the
          pre-conversion view.
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold"
            aria-label="Cancel convert"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-indigo-700 px-3 py-1 text-xs font-bold text-white"
            aria-label="Confirm convert to SubCanvas"
            disabled={!label.trim()}
            onClick={() => onConfirm(label.trim() || cluster.label)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConvertClusterDialog;
