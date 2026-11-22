import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, durationMs?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  info: (message: string, durationMs?: number) => string;
  success: (message: string, durationMs?: number) => string;
  warning: (message: string, durationMs?: number) => string;
  error: (message: string, durationMs?: number) => string;
}

const DEFAULT_DURATION_MS: Record<ToastType, number> = {
  info: 3500,
  success: 3500,
  warning: 4500,
  error: 6500,
};

let toastSeq = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (type, message, durationMs) => {
    const id = `toast-${Date.now()}-${++toastSeq}`;
    const resolvedDuration = durationMs ?? DEFAULT_DURATION_MS[type];

    set((state) => ({
      toasts: [...state.toasts, { id, type, message, durationMs: resolvedDuration }],
    }));

    if (resolvedDuration > 0 && typeof setTimeout !== "undefined") {
      const timer = setTimeout(() => {
        timers.delete(id);
        get().removeToast(id);
      }, resolvedDuration);
      timers.set(id, timer);
    }

    return id;
  },

  removeToast: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    set({ toasts: [] });
  },

  info: (message, durationMs) => get().addToast("info", message, durationMs),
  success: (message, durationMs) => get().addToast("success", message, durationMs),
  warning: (message, durationMs) => get().addToast("warning", message, durationMs),
  error: (message, durationMs) => get().addToast("error", message, durationMs),
}));
