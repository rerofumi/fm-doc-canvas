import React, { useEffect, useId, useRef, useState } from "react";

export type RelationKindOption = "source" | "derived" | "supports" | "opposes" | "similar";

export interface RelationEditorValue {
  sourceNodeId: string;
  targetNodeId: string;
  kind: RelationKindOption;
  reason: string;
  direction: "forward" | "reverse";
}

interface RelationEditorDialogProps {
  title: string;
  initial: RelationEditorValue;
  nodeOptions: Array<{ id: string; label: string }>;
  onSubmit: (value: RelationEditorValue) => void;
  onCancel: () => void;
}

const KINDS: RelationKindOption[] = ["source", "derived", "supports", "opposes", "similar"];

export default function RelationEditorDialog({
  title,
  initial,
  nodeOptions,
  onSubmit,
  onCancel,
}: RelationEditorDialogProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const [value, setValue] = useState<RelationEditorValue>(initial);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.sourceNodeId || !value.targetNodeId) return;
    if (value.sourceNodeId === value.targetNodeId) return;
    onSubmit(value);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100vh-2rem)] w-full max-w-md min-w-0 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        onSubmit={submit}
      >
        <h2 id={titleId} className="text-sm font-bold text-gray-900">
          {title}
        </h2>
        <div className="mt-3 grid gap-3">
          <label className="grid min-w-0 gap-1 text-xs font-medium text-gray-700">
            Source node
            <select
              ref={firstFieldRef}
              aria-label="Relation source node"
              className="block w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={value.sourceNodeId}
              onChange={(event) => setValue((prev) => ({ ...prev, sourceNodeId: event.target.value }))}
            >
              {nodeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-gray-700">
            Target node
            <select
              aria-label="Relation target node"
              className="block w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={value.targetNodeId}
              onChange={(event) => setValue((prev) => ({ ...prev, targetNodeId: event.target.value }))}
            >
              {nodeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-gray-700">
            Kind
            <select
              aria-label="Relation kind"
              className="block w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={value.kind}
              onChange={(event) =>
                setValue((prev) => ({ ...prev, kind: event.target.value as RelationKindOption }))
              }
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-gray-700">
            Direction
            <select
              aria-label="Relation direction"
              className="block w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={value.direction}
              onChange={(event) =>
                setValue((prev) => ({
                  ...prev,
                  direction: event.target.value as "forward" | "reverse",
                }))
              }
            >
              <option value="forward">forward (source → target)</option>
              <option value="reverse">reverse (target → source)</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-gray-700">
            Reason
            <textarea
              aria-label="Relation reason"
              className="min-h-16 w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={value.reason}
              onChange={(event) => setValue((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            aria-label="Cancel relation editor"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            aria-label="Save relation"
          >
            Save Relation
          </button>
        </div>
      </form>
    </div>
  );
}
