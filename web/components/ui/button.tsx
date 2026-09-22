"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Spinner } from "./spinner";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button-styles";

export type { ButtonSize, ButtonVariant };
export { buttonStyles };

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
