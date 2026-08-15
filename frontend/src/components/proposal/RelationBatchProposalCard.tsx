import type React from "react";
import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { ProposalRecord } from "../../domain/proposal";
import type { RelationBatchItem } from "../../domain/generatedView";

const KIND_LABELS: Record<string, string> = {
  source: "source",
  derived: "derived",
  supports: "supports",
  opposes: "opposes",
  similar: "similar",
};

/**
 * Batch Relation proposal card: one row per candidate, checkbox to exclude
 * (modify), Accept selected / Reject / Stop. Accept applies all selected items
 * atomically with a single undo.
 */
const RelationBatchProposalCard: React.FC<{
  proposal: ProposalRecord;
  onDecide: (
    decision: "accept" | "reject",
    modified?: { relations?: RelationBatchItem[] },
  ) => void;
}> = ({ proposal, onDecide }) => {
  const workspace = useAppStore((s) => s.workspace);
  const operation = proposal.operation;
  const relations =
    operation.kind === "add-relation-batch" ? operation.relations : [];
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selected = relations.filter((_, index) => !excluded.has(index));

  const nodeLabel = (id: string) => {
    const node = workspace.document.nodes[id];
    return node ? `${id} (${node.kind})` : id;
  };

  return (
    <div
      className="my-1 rounded border border-gray-200 bg-white/80 p-2 text-xs text-gray-700"
      role="group"
      aria-label="Relation batch proposal"
      data-testid="relation-batch-proposal"
    >
      <div className="font-semibold">
        Relation batch proposal · {relations.length} candidate
        {relations.length === 1 ? "" : "s"}
      </div>
      <div className="mt-1 space-y-1">
        {relations.map((relation, index) => (
          <label
            key={`${relation.sourceNodeId}-${relation.targetNodeId}-${index}`}
            className="flex items-center gap-2 rounded border border-gray-100 p-1"
          >
            <input
              type="checkbox"
              aria-label={`Include relation ${index + 1}`}
              checked={!excluded.has(index)}
              onChange={() => toggle(index)}
            />
            <span className="font-mono text-[11px]">
              {nodeLabel(relation.sourceNodeId)} →{" "}
              {nodeLabel(relation.targetNodeId)}
            </span>
            <span className="rounded bg-slate-100 px-1 font-semibold">
              {KIND_LABELS[relation.kind] ?? relation.kind}
            </span>
            {relation.reason && (
              <span className="truncate text-gray-500">{relation.reason}</span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded bg-green-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
          aria-label={`Accept selected (${selected.length})`}
          disabled={selected.length === 0}
          onClick={() =>
            onDecide("accept", {
              relations: selected,
            })
          }
        >
          Accept selected ({selected.length})
        </button>
        <button
          type="button"
          className="rounded bg-gray-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label="Reject all relations"
          onClick={() => onDecide("reject")}
        >
          Reject all
        </button>
        <button
          type="button"
          className="rounded bg-slate-600 px-2 py-1 text-[11px] font-bold text-white"
          aria-label="Stop relation batch"
          onClick={() => onDecide("reject")}
        >
          Stop
        </button>
      </div>
    </div>
  );
};

export default RelationBatchProposalCard;
