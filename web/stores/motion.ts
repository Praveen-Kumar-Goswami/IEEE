"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MotionPreference = "system" | "reduced" | "full";

interface MotionState {
  preference: MotionPreference;
  systemReduced: boolean;
  setPreference: (preference: MotionPreference) => void;
  setSystemReduced: (reduced: boolean) => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      preference: "system",
      systemReduced: false,
      setPreference: (preference) => set({ preference }),
      setSystemReduced: (systemReduced) => set({ systemReduced }),
    }),
    { name: "tend-motion", partialize: (s) => ({ preference: s.preference }) },
  ),
);

export const selectReduced = (s: MotionState) => (s.preference === "system" ? s.systemReduced : s.preference === "reduced");
