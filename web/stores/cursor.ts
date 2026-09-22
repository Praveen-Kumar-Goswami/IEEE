"use client";

import { create } from "zustand";

/**
 * Cursor variants. Elements opt in with data-cursor="view" (and optional data-cursor-label).
 * default: dot + ring. link: ring tightens. button: ring shrinks, target attracts.
 * label variants expand into a disc with a word. scene: minimal crosshair for 3D.
 */
export type CursorVariant =
  | "default"
  | "link"
  | "button"
  | "text"
  | "hidden"
  | "scene"
  | "view"
  | "open"
  | "drag"
  | "explore"
  | "play"
  | "next";

export const LABEL_VARIANTS: CursorVariant[] = ["view", "open", "drag", "explore", "play", "next"];

interface CursorState {
  enabled: boolean;
  variant: CursorVariant;
  label: string | null;
  image: string | null;
  setEnabled: (enabled: boolean) => void;
  set: (variant: CursorVariant, label?: string | null, image?: string | null) => void;
}

export const useCursorStore = create<CursorState>((set) => ({
  enabled: false,
  variant: "default",
  label: null,
  image: null,
  setEnabled: (enabled) => set({ enabled }),
  set: (variant, label = null, image = null) => set({ variant, label, image }),
}));
