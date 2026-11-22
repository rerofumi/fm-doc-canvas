import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastType } from "../../store/useToastStore";

const TOAST_STYLES: Record<
  ToastType,
  { border: string; iconColor: string; bg: string }
> = {
  info: {
    border: "border-blue-200",
    iconColor: "text-blue-600",
    bg: "bg-white/95",
  },
  success: {
    border: "border-emerald-200",
    iconColor: "text-emerald-600",
    bg: "bg-white/95",
  },
  warning: {
    border: "border-amber-200",
    iconColor: "text-amber-600",
    bg: "bg-white/95",
  },
  error: {
    border: "border-red-200",
    iconColor: "text-red-600",
    bg: "bg-white/95",
  },
};

function ToastIcon({ type }: { type: ToastType }) {
  const cls = `h-4 w-4 shrink-0 ${TOAST_STYLES[type].iconColor}`;
  switch (type) {
    case "success":
      return <CheckCircle2 className={cls} />;
    case "warning":
      return <AlertTriangle className={cls} />;
    case "error":
      return <XCircle className={cls} />;
    case "info":
    default:
      return <Info className={cls} />;
  }
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-4 top-14 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-md backdrop-blur-md ${style.border} ${style.bg}`}
            style={{ color: "var(--text-primary)" }}
          >
            <div className="mt-0.5">
              <ToastIcon type={toast.type} />
            </div>
            <p className="min-w-0 flex-1 break-words text-xs leading-relaxed">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="通知を閉じる"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
