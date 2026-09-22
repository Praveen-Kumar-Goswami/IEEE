"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Presence } from "@/types/domain";

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  presence: Presence;
  alertSound: boolean;
  compactTables: boolean;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommand: (open: boolean) => void;
  setPresence: (presence: Presence) => void;
  setAlertSound: (on: boolean) => void;
  setCompactTables: (on: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandOpen: false,
      presence: "available",
      alertSound: false,
      compactTables: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
      setCommand: (commandOpen) => set({ commandOpen }),
      setPresence: (presence) => set({ presence }),
      setAlertSound: (alertSound) => set({ alertSound }),
      setCompactTables: (compactTables) => set({ compactTables }),
    }),
    {
      name: "tend-ui",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, presence: s.presence, alertSound: s.alertSound, compactTables: s.compactTables }),
    },
  ),
);
