import { useEffect, useId, useRef, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { presentUiMessage, type UiMessageDescriptor } from "../../i18n/messages";

interface SubCanvasDialogProps {
  mode: "rename" | "dissolve";
  currentName?: string;
  memberCount?: number;
  folderRelationCount?: number;
  onRename?: (label: string) => void;
  onConfirm?: () => void;
  onCancel: () => void;
}

export default function SubCanvasDialog({
  mode,
  currentName = "",
  memberCount = 0,
  folderRelationCount = 0,
  onRename,
  onConfirm,
  onCancel,
}: SubCanvasDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const firstRef = useRef<HTMLInputElement | HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(currentName);
  const [error, setError] = useState<UiMessageDescriptor | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
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
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const submitRename = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = label.trim();
    if (!normalized) {
      setError({ code: "subcanvas.emptyName" });
      return;
    }
    onRename?.(normalized);
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-base font-bold text-gray-900">
          {mode === "rename" ? t(($) => $.subcanvasDialog.renameTitle) : t(($) => $.subcanvasDialog.dissolveTitle)}
        </h2>
        {mode === "rename" ? (
          <form onSubmit={submitRename}>
            <label className="mt-4 grid gap-1 text-sm font-medium text-gray-700">
              {t(($) => $.subcanvasDialog.name)}
              <input
                ref={firstRef as React.RefObject<HTMLInputElement>}
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  if (error) setError(null);
                }}
                data-testid="subcanvas-name"
                aria-label={t(($) => $.subcanvasDialog.nameAria)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${descriptionId}-error` : descriptionId}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <p id={descriptionId} className="mt-2 text-xs text-gray-500">
              {t(($) => $.subcanvasDialog.renameDescription)}
            </p>
            {error && (
              <p id={`${descriptionId}-error`} role="alert" className="mt-1 text-xs text-red-600">
                {error && presentUiMessage(error)}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" data-testid="subcanvas-cancel-rename" onClick={onCancel} className="rounded border border-gray-300 px-3 py-2 text-sm" aria-label={t(($) => $.subcanvasDialog.cancelRename)}>
                {t(($) => $.common.action.cancel)}
              </button>
              <button type="submit" data-testid="subcanvas-confirm-rename" className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white" aria-label={t(($) => $.subcanvasDialog.confirmRename)}>
                {t(($) => $.subcanvasDialog.renameTitle)}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p id={descriptionId} className="mt-3 text-sm leading-6 text-gray-700">
              <span className="block">{t(($) => $.subcanvasDialog.memberSummary, { count: memberCount })}</span>
              <span className="block">{t(($) => $.subcanvasDialog.folderRelationSummary, { count: folderRelationCount })}</span>
              <span className="block">{t(($) => $.subcanvasDialog.preserveSummary)}</span>
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button ref={firstRef as React.RefObject<HTMLButtonElement>} type="button" data-testid="subcanvas-cancel-delete" onClick={onCancel} className="rounded border border-gray-300 px-3 py-2 text-sm" aria-label={t(($) => $.subcanvasDialog.cancelDelete)}>
                {t(($) => $.common.action.cancel)}
              </button>
              <button type="button" data-testid="subcanvas-confirm-delete" onClick={onConfirm} className="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white" aria-label={t(($) => $.subcanvasDialog.confirmDelete)}>
                {t(($) => $.subcanvasDialog.delete)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
