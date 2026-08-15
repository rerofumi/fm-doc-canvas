import type React from "react";
import { useAppStore } from "../../store/useAppStore";
import type { ProposalRecord } from "../../domain/proposal";

/**
 * Cluster View proposal card: previews the view label, each cluster's label /
 * reason / members, and offers Accept / Reject / Stop. Accept turns it into an
 * active runtime-only Generated View without changing the document.
 */
const ClusterViewProposalCard: React.FC<{
  proposal: ProposalRecord;
  onDecide: (decision: "accept" | "reject") => void;
}> = ({ proposal, onDecide }) => {
  const workspace = useAppStore((s) => s.workspace);
  const operation = proposal.operation;
  const view =
    operation.kind === "create-generated-view" ? operation.view : null;
  if (!view) return null;

  const nodeLabel = (id: string) => {
    const node = workspace.document.nodes[id];
    return node ? `${id} (${node.kind})` : id;
  };

  return (
    <div
      className="my-1 rounded border border-gray-200 bg-white/80 p-2 text-xs text-gray-700"
      role="group"
      aria-label="Cluster view proposal"
      data-testid="cluster-view-proposal"
    >
      <div className="font-semibold">Cluster View proposal · {view.label}</div>
      <div className="mt-1 space-y-1">
        {view.clusters.map((cluster) => (
          <div key={cluster.id} className="rounded border border-gray-100 p-1">
            <div className="font-semibold">
              {cluster.label}
              {cluster.reason && (
                <span className="ml-1 font-normal text-gray-500">
                  · {cluster.reason}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {cluster.nodeIds.map((id) => (
                <span
                  key={id}
                  className="rounded bg-slate-100 px-1 font-mono text-[10px]"
                >
                  {nodeLabel(id)}
                </span>
              ))}
            </div>
          </div>
        ))}
        {view.ungroupedNodeIds.length > 0 && (
          <div className="text-gray-500">
            ungrouped: {view.ungroupedNodeIds.map(nodeLabel).join(", ")}
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded bg-green-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label="Accept cluster view"
          onClick={() => onDecide("accept")}
        >
          Accept
        </button>
        <button
          type="button"
          className="rounded bg-gray-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label="Reject cluster view"
          onClick={() => onDecide("reject")}
        >
          Reject
        </button>
        <button
          type="button"
          className="rounded bg-slate-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label="Stop cluster view"
          onClick={() => onDecide("reject")}
        >
          Stop
        </button>
      </div>
    </div>
  );
};

export default ClusterViewProposalCard;
