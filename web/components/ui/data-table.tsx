"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { TONE_CLASS, type Tone } from "@/lib/domain/labels";
import { useUiStore } from "@/stores/ui";
import { Pagination } from "./pagination";
import { SkeletonRows } from "./skeleton";
import { ErrorState } from "./states";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
  /** Hide on narrow screens; the first column always stays. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  width?: string;
}

interface DataTableProps<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  rowHref?: (row: T) => string;
  rowTone?: (row: T) => Tone | null;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: { id: string; dir: "asc" | "desc" };
  className?: string;
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T>({ rows, columns, rowKey, caption, rowHref, rowTone, loading, error, onRetry, empty, pageSize = 12, initialSort, className }: DataTableProps<T>) {
  const router = useRouter();
  const compact = useUiStore((s) => s.compactTables);
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!rows) return [];
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.ceil(sorted.length / pageSize);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const toggleSort = (id: string) => {
    setPage(0);
    setSort((s) => (s?.id !== id ? { id, dir: "desc" } : s.dir === "desc" ? { id, dir: "asc" } : null));
  };

  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading || !rows) return <SkeletonRows rows={Math.min(pageSize, 8)} />;
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-(--line)">
              {columns.map((col, i) => {
                const sorted = sort?.id === col.id ? sort.dir : null;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    style={{ width: col.width }}
                    className={cn(
                      "h-10 whitespace-nowrap px-3 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-graphite-300 first:pl-5 last:pr-5",
                      col.align === "right" && "text-right",
                      i > 0 && col.hideBelow && HIDE[col.hideBelow],
                    )}
                  >
                    {col.sortValue ? (
                      <button onClick={() => toggleSort(col.id)} className={cn("inline-flex items-center gap-1.5 transition-colors hover:text-bone", sorted && "text-bone", col.align === "right" && "flex-row-reverse")}>
                        {col.header}
                        {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const tone = rowTone?.(row);
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  onClick={
                    href
                      ? (e) => {
                          if ((e.target as HTMLElement).closest("a, button, input, select")) return;
                          router.push(href, { transitionTypes: ["nav-forward"] });
                        }
                      : undefined
                  }
                  className={cn("group/row relative border-b border-(--line) transition-colors duration-(--dur-micro) last:border-0 hover:bg-white/[0.025]", href && "cursor-pointer")}
                >
                  {columns.map((col, i) => (
                    <td
                      key={col.id}
                      className={cn(
                        "px-3 text-small text-graphite-100 first:pl-5 last:pr-5",
                        compact ? "h-11" : "h-14",
                        col.align === "right" && "text-right",
                        i > 0 && col.hideBelow && HIDE[col.hideBelow],
                        i === 0 && "relative",
                        col.className,
                      )}
                    >
                      {i === 0 && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-y-2 left-0 w-[2px] rounded-full transition-opacity duration-(--dur-micro)",
                            tone ? cn(TONE_CLASS[tone].dot, "opacity-80") : "bg-bone opacity-0 group-hover/row:opacity-40",
                          )}
                        />
                      )}
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && <Pagination page={safePage} pageCount={pageCount} total={sorted.length} pageSize={pageSize} onPage={setPage} />}
    </div>
  );
}
