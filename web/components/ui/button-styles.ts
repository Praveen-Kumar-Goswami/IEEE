import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "signal";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] " +
  "transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-(--dur-micro) ease-(--ease-out-quart) " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-offset-2";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-bone text-graphite-950 hover:bg-ivory shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]",
  secondary: "bg-graphite-800 text-bone border border-(--line-strong) hover:bg-graphite-750 hover:border-graphite-500",
  outline: "border border-(--line-strong) text-bone hover:border-bone/60 hover:bg-white/[0.03]",
  ghost: "text-graphite-200 hover:text-bone hover:bg-white/[0.05]",
  danger: "border border-critical/40 text-critical hover:bg-critical/10 hover:border-critical/70",
  signal: "bg-signal text-graphite-950 hover:bg-signal-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-small",
  md: "h-10 px-5 text-body",
  lg: "h-12 px-7 text-body",
};

export function buttonStyles({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}
