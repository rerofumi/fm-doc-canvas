import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { isTextBearing } from "../../domain/workspace";
import type { ClusterViewClusterDraft } from "../../domain/generatedView";
import { useTranslation } from "react-i18next";

/**
 * Preview + confirm dialog for converting a single cluster to a SubCanvas.
 * Shows members, an editable Folder label, destination (Current Canvas), and
 * a note that boundary Relations are kept via the existing aggregate.
 */
const ConvertClusterDialog: React.FC<{
  cluster: ClusterViewClusterDraft;
  onCancel: () => void;
  onConfirm: (label: string) => void;
  returnFocusTarget?: HTMLElement | null;
}> = ({ cluster, onCancel, onConfirm, returnFocusTarget }) => {
  const workspace = useAppStore((s) => s.workspace);
  const [label, setLabel] = useState(cluster.label);
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();
  onCancelRef.current = onCancel;

  useEffect(() => {
    setLabel(cluster.label);
  }, [cluster.label]);

  useEffect(() => {
    labelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (index - 1 + focusable.length) % focusable.length
        : (index + 1) % focusable.length;
      event.preventDefault();
      focusable[next]?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [returnFocusTarget]);

  const members = cluster.nodeIds
    .map((id) => workspace.document.nodes[id])
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label={t(($) => $.generatedView.convertCluster, { label: cluster.label })}
      aria-labelledby={titleId}
      ref={dialogRef}
      data-testid="convert-cluster-dialog"
    >
      <div className="w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
        <div id={titleId} className="text-sm font-bold">{t(($) => $.generatedView.convertTitle)}</div>
        <div className="mt-2 text-xs text-gray-500">
          {t(($) => $.generatedView.moveMembers, { count: members.length })}
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
          {t(($) => $.generatedView.folderLabel)}
          <input
            ref={labelRef}
            aria-label={t(($) => $.generatedView.folderLabel)}
            data-testid="convert-cluster-label"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <div className="mt-2 text-[10px] text-gray-400">
          {t(($) => $.generatedView.boundaryRelations)}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold"
            aria-label={t(($) => $.generatedView.cancelConvert)}
            data-testid="convert-cluster-cancel"
            onClick={onCancel}
          >
            {t(($) => $.common.action.cancel)}
          </button>
          <button
            type="button"
            className="rounded bg-indigo-700 px-3 py-1 text-xs font-bold text-white"
            aria-label={t(($) => $.generatedView.confirmConvert)}
            data-testid="convert-cluster-confirm"
            disabled={!label.trim()}
            onClick={() => onConfirm(label.trim() || cluster.label)}
          >
            {t(($) => $.common.action.save)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConvertClusterDialog;
