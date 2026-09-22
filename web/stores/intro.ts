"use client";

import { create } from "zustand";

/** Landing choreography: the hero waits for the preloader to hand over. */
interface IntroState {
  loaderDone: boolean;
  setLoaderDone: () => void;
}

export const useIntroStore = create<IntroState>((set) => ({
  loaderDone: false,
  setLoaderDone: () => set({ loaderDone: true }),
}));
