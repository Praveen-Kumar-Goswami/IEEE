"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server rendering and hydration, true after. For state persisted in localStorage. */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
