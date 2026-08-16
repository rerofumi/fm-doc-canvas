import React from "react";
import { ChevronRight, CornerUpLeft } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

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

  return (
    <div
      className="flex items-center gap-2 border-b border-gray-200 bg-white/90 px-3 py-1.5 text-xs"
      role="navigation"
      aria-label="Canvas breadcrumb"
    >
      <button
        type="button"
        onClick={() => navigateParent()}
        disabled={!parentCanvasId}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Go to parent canvas"
        title="Parent canvas"
      >
        <CornerUpLeft size={14} />
        Parent
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.canvasId}>
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-gray-400" />}
            <button
              type="button"
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
          title="Cross-canvas relations via up-boundary"
          aria-label={`${upCount} up-boundary relations`}
        >
          ↑ {upCount}
        </span>
      )}
    </div>
  );
};

export default CanvasBreadcrumb;
