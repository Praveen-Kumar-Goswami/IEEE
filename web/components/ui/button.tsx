"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Spinner } from "./spinner";

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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, iconLeft, iconRight, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  tone?: "default" | "subtle";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", tone = "default", className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full text-graphite-200 transition-[transform,background-color,color] duration-(--dur-micro) ease-(--ease-out-quart) hover:bg-white/[0.06] hover:text-bone active:scale-90 disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "size-8 [&_svg]:size-4" : "size-10 [&_svg]:size-[18px]",
        tone === "default" && "border border-(--line)",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
