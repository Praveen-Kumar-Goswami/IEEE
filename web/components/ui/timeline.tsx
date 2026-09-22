import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { TONE_CLASS, type Tone } from "@/lib/domain/labels";

export interface TimelineItem {
  id: string;
  at: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}

/** Vertical chronology. Time sits in its own column so titles align. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, i) => {
        const tone = TONE_CLASS[item.tone ?? "neutral"];
        return (
          <li key={item.id} className="relative grid grid-cols-[4.5rem_1.5rem_1fr] gap-x-3 pb-6 last:pb-0 sm:grid-cols-[6.5rem_1.5rem_1fr]">
            <div className="tabular pt-0.5 text-right font-mono text-[11px] leading-5 text-graphite-300">{item.at}</div>
            <div className="relative flex justify-center">
              {i < items.length - 1 && <span aria-hidden className="absolute bottom-[-1.5rem] top-6 w-px bg-(--line-strong)" />}
              <span className={cn("relative z-10 mt-1 flex size-3.5 items-center justify-center rounded-full border bg-graphite-900", tone.border)}>
                <span className={cn("size-1.5 rounded-full", tone.dot)} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-small font-medium text-bone">{item.title}</p>
              {item.detail && <p className="mt-1 text-small text-graphite-300">{item.detail}</p>}
              {item.meta && <p className="mt-1.5 text-label text-graphite-400">{item.meta}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
