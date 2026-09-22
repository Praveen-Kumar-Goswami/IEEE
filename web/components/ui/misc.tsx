import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { initials } from "@/utils/format";
import { hashString } from "@/utils/math";

const AVATAR_TONES = ["from-[#2b3a36] to-[#1a2321]", "from-[#3a3129] to-[#221d19]", "from-[#2c3340] to-[#1b1f27]", "from-[#39302f] to-[#221c1c]", "from-[#30353a] to-[#1c1f22]"];

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const tone = AVATAR_TONES[hashString(name) % AVATAR_TONES.length];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-(--line-strong) bg-linear-to-br font-medium text-bone",
        tone,
        size === "xs" && "size-6 text-[9px]",
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-10 text-small",
        size === "lg" && "size-16 text-h3",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-(--line-strong) bg-graphite-800 px-1 font-mono text-[10px] text-graphite-200", className)}>{children}</kbd>;
}

/** Section label used across dashboards: mono index + title. */
export function Eyebrow({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-label flex items-center gap-3 text-graphite-300", className)}>
      {index && <span className="text-graphite-400">{index}</span>}
      {index && <span aria-hidden className="h-px w-6 bg-graphite-600" />}
      {children}
    </p>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-(--line)", className)} />;
}

export function KeyValue({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2.5", className)}>
      <dt className="text-small text-graphite-300">{label}</dt>
      <dd className="text-right text-small text-bone">{value}</dd>
    </div>
  );
}
