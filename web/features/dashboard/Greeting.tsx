"use client";

import { firstName, formatWeekday, greeting, lastName } from "@/utils/format";
import { useNow } from "@/hooks/use-now";
import type { Viewer } from "@/types/domain";

/** Time-of-day greeting. Rendered after mount so the server clock never disagrees with the browser. */
export function useGreeting(viewer: Viewer) {
  const now = useNow(60_000);
  const name = viewer.role === "doctor" ? `Dr ${lastName(viewer.fullName)}` : firstName(viewer.fullName);
  return {
    title: now ? `${greeting(new Date(now))}, ${name}` : `Welcome, ${name}`,
    date: now ? formatWeekday(now) : "\u00a0",
  };
}
