"use client";

import { useSyncExternalStore } from "react";

const subscribers = new Map<string, (onChange: () => void) => () => void>();

/** Cached per query so useSyncExternalStore does not re-subscribe on every render. */
function subscribeQuery(query: string) {
  let subscribe = subscribers.get(query);
  if (!subscribe) {
    subscribe = (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    };
    subscribers.set(query, subscribe);
  }
  return subscribe;
}

/** SSR returns `serverValue`; the client value is read after hydration. */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    subscribeQuery(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const usePointerFine = () => useMediaQuery("(hover: hover) and (pointer: fine)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)", true);
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
