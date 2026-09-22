import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 lg:mb-10", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="text-label mb-3 text-graphite-400">{eyebrow}</p>}
        <h1 className="text-h1 font-light text-bone">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-body text-graphite-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Card section title used inside dashboards. */
export function SectionTitle({ title, meta, actions, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5", className)}>
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="text-body font-medium text-bone">{title}</h2>
        {meta && <span className="text-label truncate text-graphite-400">{meta}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
