"use client";

import { useSyncExternalStore } from "react";

interface Channel {
  subs: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  now: number;
  subscribe: (onChange: () => void) => () => void;
  read: () => number;
}

const channels = new Map<number, Channel>();

/**
 * One ticking clock per interval. `subscribe` must be referentially stable and must not
 * change the snapshot synchronously, or React re-subscribes on every render and loops.
 */
function channel(intervalMs: number): Channel {
  let c = channels.get(intervalMs);
  if (c) return c;
  const tick = () => {
    c!.now = Date.now();
    c!.subs.forEach((s) => s());
  };
  c = {
    subs: new Set(),
    timer: null,
    now: Date.now(),
    read: () => c!.now,
    subscribe: (onChange) => {
      c!.subs.add(onChange);
      if (!c!.timer) {
        c!.timer = setInterval(tick, intervalMs);
        if (Date.now() - c!.now > intervalMs) setTimeout(tick, 0);
      }
      return () => {
        c!.subs.delete(onChange);
        if (c!.subs.size === 0 && c!.timer) {
          clearInterval(c!.timer);
          c!.timer = null;
        }
      };
    },
  };
  channels.set(intervalMs, c);
  return c;
}

const serverSnapshot = () => null;

/** Shared ticking clock. Components on the same interval re-render together. Null during SSR. */
export function useNow(intervalMs = 1000): number | null {
  const c = channel(intervalMs);
  return useSyncExternalStore(c.subscribe, c.read, serverSnapshot);
}
