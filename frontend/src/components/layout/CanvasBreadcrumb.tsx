import React from "react";
import { ChevronRight, CornerUpLeft } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useTranslation } from "react-i18next";

const CanvasBreadcrumb: React.FC = () => {
  const getBreadcrumb = useAppStore((s) => s.getBreadcrumb);
  const navigateCanvas = useAppStore((s) => s.navigateCanvas);
  const navigateParent = useAppStore((s) => s.navigateParent);
  const parentCanvasId = useAppStore((s) =>
    s.workspace.document.canvases[s.workspace.runtime.currentCanvasId]?.parentCanvasId,
  );
  const boundaryAggregates = useAppStore((s) => s.boundaryAggregates);
  const crumbs = getBreadcrumb();
  const upCount = boundaryAggregates
    .filter((b) => b.kind === "up-boundary")
    .reduce((n, b) => n + b.count, 0);
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-2 border-b border-gray-200 bg-white/90 px-3 py-1.5 text-xs"
      role="navigation"
      data-testid="canvas-breadcrumb"
      aria-label={t(($) => $.layout.canvasBreadcrumb)}
    >
      <button
        type="button"
        onClick={() => navigateParent()}
        disabled={!parentCanvasId}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label={t(($) => $.layout.goToParentCanvas)}
        data-testid="breadcrumb-parent"
        title={t(($) => $.layout.parentCanvas)}
      >
        <CornerUpLeft size={14} />
        {t(($) => $.layout.parent)}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.canvasId}>
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-gray-400" />}
            <button
              type="button"
              data-testid={`breadcrumb-canvas-${c.canvasId}`}
              onClick={() => navigateCanvas(c.canvasId)}
              className={`truncate rounded px-1.5 py-0.5 font-medium ${
                i === crumbs.length - 1
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              aria-current={i === crumbs.length - 1 ? "page" : undefined}
            >
              {c.name}
            </button>
          </React.Fragment>
        ))}
      </div>
      {upCount > 0 && (
        <span
          role="status"
          className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700"
          title={t(($) => $.layout.crossCanvasRelations)}
          aria-label={t(($) => $.layout.upBoundaryRelations, { count: upCount })}
        >
          ↑ {upCount}
        </span>
      )}
    </div>
  );
};

export default CanvasBreadcrumb;
