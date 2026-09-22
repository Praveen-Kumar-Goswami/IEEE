"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./button";

export function Pagination({ page, pageCount, total, pageSize, onPage }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  if (total === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-(--line) px-5 py-3">
      <p className="tabular text-small text-graphite-300" aria-live="polite">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <IconButton label="Previous page" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </IconButton>
        <span className="tabular min-w-12 text-center font-mono text-[11px] text-graphite-300">
          {page + 1} / {Math.max(1, pageCount)}
        </span>
        <IconButton label="Next page" size="sm" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </IconButton>
      </div>
    </nav>
  );
}
