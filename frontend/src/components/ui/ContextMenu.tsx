import React, { useEffect, useCallback, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onExport?: () => void;
  onExportMarp?: () => void;
  onCreateSubCanvas?: () => void;
  onTransform?: (operation: "summarize" | "compare" | "counterpoint") => void;
  onSearchWeb?: () => void;
  onAddRelation?: () => void;
  onEditRelation?: () => void;
  onReverseRelation?: () => void;
  label?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onDelete,
  onExport,
  onExportMarp,
  onCreateSubCanvas,
  onTransform,
  onSearchWeb,
  onAddRelation,
  onEditRelation,
  onReverseRelation,
  label = "Item",
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
      );
      if (!items.length) return;
      event.preventDefault();
      const current = document.activeElement as HTMLButtonElement | null;
      const index = items.indexOf(current as HTMLButtonElement);
      if (event.key === "Home") {
        items[0]?.focus();
        return;
      }
      if (event.key === "End") {
        items[items.length - 1]?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        items[(index + 1 + items.length) % items.length]?.focus();
        return;
      }
      items[(index - 1 + items.length) % items.length]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
      onClose();
    },
    [onDelete, onClose],
  );

  const itemClass =
    "w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none";

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${label} options`}
      className="fixed z-[100] min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl animate-in fade-in zoom-in duration-100"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 border-b border-gray-50 px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest leading-none text-gray-400">
          {label} Options
        </span>
      </div>

      {onCreateSubCanvas && (
        <button
          ref={firstItemRef}
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubCanvas();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 focus:bg-amber-50 focus:outline-none"
          aria-label="Create SubCanvas"
        >
          Create SubCanvas
        </button>
      )}

      {onTransform && (
        <>
          <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Direct Transform
          </div>
          {(["summarize", "compare", "counterpoint"] as const).map((operation, index) => (
            <button
              key={operation}
              ref={!onCreateSubCanvas && index === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                onTransform(operation);
                onClose();
              }}
              className="w-full px-3 py-2 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
              aria-label={`${operation} selected nodes`}
            >
              {operation === "summarize" ? "Summarize" : operation === "compare" ? "Compare" : "Counterpoint"}
            </button>
          ))}
        </>
      )}
      {onSearchWeb && (
        <button
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            onSearchWeb();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm font-medium text-sky-700 hover:bg-sky-50 focus:bg-sky-50 focus:outline-none"
          aria-label="Search Web"
        >
          Search Web
        </button>
      )}
      {onAddRelation && (
        <button
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            onAddRelation();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
          aria-label="Add Relation between selected nodes"
        >
          Add Relation
        </button>
      )}
      {onEditRelation && (
        <button
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            onEditRelation();
            onClose();
          }}
          className={itemClass}
          aria-label="Edit Relation"
        >
          Edit Relation
        </button>
      )}
      {onReverseRelation && (
        <button
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            onReverseRelation();
            onClose();
          }}
          className={itemClass}
          aria-label="Reverse Relation direction"
        >
          Reverse direction
        </button>
      )}

      {onExport && (
        <button
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            onExport();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
          aria-label="Export"
        >
          Export
        </button>
      )}

      {onExportMarp && (
        <button
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            onExportMarp();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm font-medium text-purple-600 hover:bg-purple-50 focus:bg-purple-50 focus:outline-none"
          aria-label="Export as Slides (Marp)"
        >
          Export as slides (Marp)
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={handleDeleteClick}
        className="w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
        aria-label={`Delete ${label}`}
      >
        Delete {label}
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={onClose}
        className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
        aria-label="Close context menu"
      >
        Cancel
      </button>
    </div>
  );
};

export default ContextMenu;
