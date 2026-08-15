import type React from "react";
import { useAppStore } from "../../store/useAppStore";
import type { RelationBatchItem } from "../../domain/generatedView";
import type { ClusterViewDraft } from "../../domain/generatedView";
import RelationBatchProposalCard from "./RelationBatchProposalCard";
import ClusterViewProposalCard from "./ClusterViewProposalCard";

/**
 * Renders the Direct suggestion proposal (Relation batch or Cluster View) that
 * is awaiting a human decision. Direct suggestions never enter the Dialogue.
 */
const DirectProposalPanel: React.FC = () => {
  const proposal = useAppStore((s) => s.pendingDirectProposal);
  const decideDirectProposal = useAppStore((s) => s.decideDirectProposal);
  const dismissDirectProposal = useAppStore((s) => s.dismissDirectProposal);

  if (!proposal) return null;

  const decide = (
    decision: "accept" | "reject",
    modified?: { relations?: RelationBatchItem[]; view?: ClusterViewDraft },
  ) => {
    if (decision === "reject") {
      decideDirectProposal("reject");
      dismissDirectProposal();
      return;
    }
    decideDirectProposal("accept", modified);
  };

  return (
    <div
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2"
      role="region"
      aria-label="Direct suggestion proposal"
      data-testid="direct-proposal-panel"
    >
      {proposal.operation.kind === "add-relation-batch" ? (
        <RelationBatchProposalCard proposal={proposal} onDecide={decide} />
      ) : proposal.operation.kind === "create-generated-view" ? (
        <ClusterViewProposalCard proposal={proposal} onDecide={decide} />
      ) : null}
      <button
        type="button"
        className="mt-1 text-[11px] text-amber-700 underline"
        aria-label="Dismiss direct suggestion"
        onClick={dismissDirectProposal}
      >
        Dismiss
      </button>
    </div>
  );
};

export default DirectProposalPanel;
