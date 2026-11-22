import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "確定",
  cancelLabel = "キャンセル",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold">
          {title}
        </h2>
        <p
          className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{
              backgroundColor: danger ? "var(--danger)" : "var(--accent-primary)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
