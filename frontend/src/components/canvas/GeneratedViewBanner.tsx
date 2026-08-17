import type React from "react";
import { useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { renameCluster, removeCluster } from "../../domain/generatedView";
import ConvertClusterDialog from "./ConvertClusterDialog";
import { useTranslation } from "react-i18next";

export const CLUSTER_PALETTE = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#0ea5e9",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

export function clusterColor(clusterId: string): string {
  let hash = 0;
  for (const ch of clusterId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CLUSTER_PALETTE[hash % CLUSTER_PALETTE.length];
}

/**
 * Runtime-only banner for the active Generated View. Displays the view label,
 * one chip per cluster (rename / delete / Convert to SubCanvas), and Close view.
 * It never writes to the Workspace document.
 */
const GeneratedViewBanner: React.FC = () => {
  const activeGeneratedView = useAppStore((s) => s.activeGeneratedView);
  const setActiveGeneratedView = useAppStore((s) => s.setActiveGeneratedView);
  const closeGeneratedView = useAppStore((s) => s.closeGeneratedView);
  const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [convertingClusterId, setConvertingClusterId] = useState<string | null>(
    null,
  );
  const convertTriggerRef = useRef<HTMLElement | null>(null);
  const { t } = useTranslation();

  if (!activeGeneratedView) return null;
  const view = activeGeneratedView;

  const beginRename = (clusterId: string, label: string) => {
    setEditingClusterId(clusterId);
    setEditingLabel(label);
  };
  const commitRename = () => {
    if (editingClusterId && editingLabel.trim()) {
      setActiveGeneratedView(
        renameCluster(view, editingClusterId, editingLabel.trim()),
      );
    }
    setEditingClusterId(null);
  };
  const deleteCluster = (clusterId: string) => {
    const next = removeCluster(view, clusterId);
    setActiveGeneratedView(next.clusters.length === 0 ? null : next);
  };

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-xs"
      role="region"
      aria-label={t(($) => $.generatedView.active, { label: view.label })}
      data-testid="generated-view-banner"
    >
      <span className="font-bold text-indigo-900">{t(($) => $.generatedView.view, { label: view.label })}</span>
      <span className="text-indigo-500">{t(($) => $.generatedView.temporary)}</span>
      <div className="flex flex-wrap items-center gap-1">
        {view.clusters.map((cluster) => (
          <span
            key={cluster.id}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
            style={{
              backgroundColor: `${clusterColor(cluster.id)}22`,
              color: clusterColor(cluster.id),
            }}
          >
            {editingClusterId === cluster.id ? (
              <input
                aria-label={t(($) => $.generatedView.renameCluster, { label: cluster.label })}
                className="w-24 rounded border border-indigo-300 px-1 text-[11px]"
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => e.key === "Enter" && commitRename()}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="font-semibold"
                aria-label={t(($) => $.generatedView.renameCluster, { label: cluster.label })}
                onClick={() => beginRename(cluster.id, cluster.label)}
              >
                {cluster.label}
              </button>
            )}
            <span className="text-[10px] opacity-70">
              {cluster.nodeIds.length}
            </span>
            <button
              type="button"
              className="font-bold opacity-70 hover:opacity-100"
              aria-label={t(($) => $.generatedView.deleteCluster, { label: cluster.label })}
              onClick={() => deleteCluster(cluster.id)}
            >
              ×
            </button>
            <button
              type="button"
              className="underline"
            aria-label={t(($) => $.generatedView.convertCluster, { label: cluster.label })}
            data-testid={`convert-cluster-${cluster.id}`}
              onClick={(event) => {
                convertTriggerRef.current = event.currentTarget;
                setConvertingClusterId(cluster.id);
              }}
            >
              {t(($) => $.generatedView.convert)}
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        className="ml-auto rounded border border-indigo-300 bg-white px-2 py-1 font-bold text-indigo-800"
        aria-label={t(($) => $.generatedView.close)}
        onClick={closeGeneratedView}
      >
        {t(($) => $.generatedView.closeView)}
      </button>

      {convertingClusterId && (
        <ConvertClusterDialog
          cluster={view.clusters.find((c) => c.id === convertingClusterId)!}
          onCancel={() => setConvertingClusterId(null)}
          returnFocusTarget={convertTriggerRef.current}
          onConfirm={(label) => {
            useAppStore
              .getState()
              .convertClusterToSubCanvas(convertingClusterId, label);
            setConvertingClusterId(null);
          }}
        />
      )}
    </div>
  );
};

export default GeneratedViewBanner;
