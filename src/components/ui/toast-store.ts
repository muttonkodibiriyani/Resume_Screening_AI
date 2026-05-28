import { create } from 'zustand';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: 'success' | 'warning' | 'error' | 'info';
  durationMs?: number;
}

export interface ToastEntry extends ToastInput {
  id: string;
  durationMs: number;
}

interface ToastState {
  toasts: ToastEntry[];
  push: (t: ToastInput) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = `t_${Date.now()}_${counter++}`;
    const entry: ToastEntry = { ...t, id, durationMs: t.durationMs ?? 4500 };
    set((s) => ({ toasts: [...s.toasts, entry] }));
    if (entry.durationMs > 0) {
      setTimeout(() => get().dismiss(id), entry.durationMs);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export function toast(input: ToastInput): void {
  useToastStore.getState().push(input);
}
