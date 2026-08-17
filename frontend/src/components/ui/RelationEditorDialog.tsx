import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { presentRelationKind } from "../../i18n/presentation";

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
  returnFocusTarget?: HTMLElement | SVGElement | null;
}

const KINDS: RelationKindOption[] = ["source", "derived", "supports", "opposes", "similar"];

export default function RelationEditorDialog({
  title,
  initial,
  nodeOptions,
  onSubmit,
  onCancel,
  returnFocusTarget,
}: RelationEditorDialogProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const onCancelRef = useRef(onCancel);
  const [value, setValue] = useState<RelationEditorValue>(initial);
  const { t } = useTranslation();
  onCancelRef.current = onCancel;

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const current = document.activeElement as HTMLElement | null;
      const index = focusable.indexOf(current as HTMLElement);
      const next = event.shiftKey
        ? (index - 1 + focusable.length) % focusable.length
        : (index + 1) % focusable.length;
      event.preventDefault();
      focusable[next]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [returnFocusTarget]);

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
        ref={dialogRef}
        role="dialog"
        data-testid="relation-editor-dialog"
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
            {t(($) => $.relationDialog.sourceNode)}
            <select
              ref={firstFieldRef}
              data-testid="relation-source"
              aria-label={t(($) => $.relationDialog.sourceAria)}
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
            {t(($) => $.relationDialog.targetNode)}
            <select
              data-testid="relation-target"
              aria-label={t(($) => $.relationDialog.targetAria)}
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
            {t(($) => $.relationDialog.kind)}
            <select
              data-testid="relation-kind"
              aria-label={t(($) => $.relationDialog.kindAria)}
              className="block w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={value.kind}
              onChange={(event) =>
                setValue((prev) => ({ ...prev, kind: event.target.value as RelationKindOption }))
              }
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {presentRelationKind(kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-gray-700">
            {t(($) => $.relationDialog.direction)}
            <select
              data-testid="relation-direction"
              aria-label={t(($) => $.relationDialog.directionAria)}
              className="block w-full min-w-0 max-w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={value.direction}
              onChange={(event) =>
                setValue((prev) => ({
                  ...prev,
                  direction: event.target.value as "forward" | "reverse",
                }))
              }
            >
              <option value="forward">{t(($) => $.relationDialog.forward)}</option>
              <option value="reverse">{t(($) => $.relationDialog.reverse)}</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-gray-700">
            {t(($) => $.relationDialog.reason)}
            <textarea
              data-testid="relation-reason"
              aria-label={t(($) => $.relationDialog.reasonAria)}
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
            data-testid="relation-cancel"
            aria-label={t(($) => $.relationDialog.cancel)}
            onClick={onCancel}
          >
            {t(($) => $.common.action.cancel)}
          </button>
          <button
            type="submit"
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            data-testid="relation-save"
            aria-label={t(($) => $.relationDialog.save)}
          >
            {t(($) => $.common.action.save)}
          </button>
        </div>
      </form>
    </div>
  );
}
