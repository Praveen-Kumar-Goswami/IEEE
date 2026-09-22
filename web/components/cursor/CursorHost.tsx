"use client";

import { usePathname } from "next/navigation";
import { Cursor } from "./Cursor";

/** The ambient spotlight belongs to the story pages; workspaces keep the plain dot and ring. */
export function CursorHost() {
  const pathname = usePathname();
  const story = pathname === "/" || pathname === "/login";
  return <Cursor spotlight={story} />;
}
