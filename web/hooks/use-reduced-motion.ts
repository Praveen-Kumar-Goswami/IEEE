"use client";

import { selectReduced, useMotionStore } from "@/stores/motion";

/** System preference, overridable from workspace Settings. */
export function useReducedMotion() {
  return useMotionStore(selectReduced);
}
