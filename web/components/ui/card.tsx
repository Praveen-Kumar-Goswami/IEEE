import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Card({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-(--line) bg-graphite-900/80 shadow-e1",
        interactive && "transition-[border-color,background-color,transform] duration-(--dur-standard-fast) ease-(--ease-out-expo) hover:border-(--line-strong) hover:bg-graphite-850",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 pb-4 pt-5", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-label text-graphite-300">{eyebrow}</p>}
        <Heading className="text-h3 font-medium text-bone">{title}</Heading>
        {description && <p className="text-small text-graphite-300">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
