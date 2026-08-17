import type React from "react";
import { useAppStore } from "../../store/useAppStore";
import type { ProposalRecord } from "../../domain/proposal";
import { useTranslation } from "react-i18next";

/**
 * Cluster View proposal card: previews the view label, each cluster's label /
 * reason / members, and offers Accept / Reject / Stop. Accept turns it into an
 * active runtime-only Generated View without changing the document.
 */
const ClusterViewProposalCard: React.FC<{
  proposal: ProposalRecord;
  onDecide: (decision: "accept" | "reject") => void;
}> = ({ proposal, onDecide }) => {
  const { t } = useTranslation();
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
      aria-label={t($ => $.proposal.clusterView)}
      data-testid="cluster-view-proposal"
    >
      <div className="font-semibold">{t($ => $.proposal.clusterView)} · {view.label}</div>
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
            {t($ => $.proposal.ungroupedValue, { nodes: view.ungroupedNodeIds.map(nodeLabel).join(", ") })}
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded bg-green-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label={t($ => $.proposal.acceptClusterAria)}
          data-proposal-decision="accept"
          onClick={() => onDecide("accept")}
        >
          {t($ => $.proposal.accept)}
        </button>
        <button
          type="button"
          className="rounded bg-gray-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label={t($ => $.proposal.rejectClusterAria)}
          onClick={() => onDecide("reject")}
        >
          {t($ => $.proposal.reject)}
        </button>
        <button
          type="button"
          className="rounded bg-slate-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label={t($ => $.proposal.stopClusterAria)}
          onClick={() => onDecide("reject")}
        >
          {t($ => $.proposal.stop)}
        </button>
      </div>
    </div>
  );
};

export default ClusterViewProposalCard;
