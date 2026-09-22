"use client";

import { create } from "zustand";

export type ToastTone = "neutral" | "success" | "error" | "watch" | "attention" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; href: string };
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => string;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 4;
let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `t${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { durationMs: 5200, ...toast, id }].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, body?: string) => useToastStore.getState().push({ tone: "success", title, body }),
  error: (title: string, body?: string) => useToastStore.getState().push({ tone: "error", title, body, durationMs: 7000 }),
  info: (title: string, body?: string) => useToastStore.getState().push({ tone: "info", title, body }),
  push: (t: Parameters<ToastState["push"]>[0]) => useToastStore.getState().push(t),
};
