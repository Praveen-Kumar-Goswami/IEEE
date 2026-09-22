"use client";

import Link from "next/link";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { useMagnetic } from "@/hooks/use-magnetic";

interface MagneticButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "solid" | "outline" | "ghost";
  size?: "md" | "lg" | "xl";
  strength?: number;
  className?: string;
  transitionTypes?: string[];
  ariaLabel?: string;
  cursorLabel?: string;
}

const SIZE = {
  md: "h-11 px-6 text-small",
  lg: "h-14 px-8 text-body",
  xl: "h-[clamp(4.5rem,9vw,7.5rem)] px-[clamp(2rem,5vw,4.5rem)] text-[clamp(1.1rem,1.8vw,1.6rem)]",
};

/**
 * Pill that attracts the pointer. A fill expands from where the pointer entered,
 * and the label travels further than the pill for a sense of depth.
 */
export function MagneticButton({
  children,
  href,
  onClick,
  variant = "solid",
  size = "md",
  strength = 0.3,
  className,
  transitionTypes,
  ariaLabel,
  cursorLabel,
}: MagneticButtonProps) {
  const root = useRef<HTMLElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  useMagnetic(root, { strength, innerStrength: strength * 0.55, radius: size === "xl" ? 60 : 24 }, inner);

  const onEnter = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    fill.current?.style.setProperty("--fx", `${e.clientX - r.left}px`);
    fill.current?.style.setProperty("--fy", `${e.clientY - r.top}px`);
  };

  const classes = cn(
    "group/mag relative inline-flex items-center justify-center overflow-hidden rounded-full font-medium tracking-[-0.015em] will-change-transform",
    "transition-[color,border-color] duration-(--dur-standard-fast) ease-(--ease-out-expo)",
    SIZE[size],
    variant === "solid" && "bg-bone text-graphite-950",
    variant === "outline" && "border border-(--line-strong) text-bone hover:border-bone/50 hover:text-graphite-950",
    variant === "ghost" && "text-bone hover:text-graphite-950",
    className,
  );

  const content = (
    <>
      <span
        ref={fill}
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-(--fx) top-(--fy) size-[260%] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full transition-transform duration-(--dur-standard) ease-(--ease-out-expo) group-hover/mag:scale-100",
          variant === "solid" ? "bg-ivory" : "bg-bone",
        )}
        style={{ ["--fx" as string]: "50%", ["--fy" as string]: "50%", aspectRatio: "1" }}
      />
      <span ref={inner} className="relative z-10 inline-flex items-center gap-3">
        {children}
      </span>
    </>
  );

  const shared = {
    "data-magnetic": "",
    "data-cursor": cursorLabel ? "open" : "button",
    "data-cursor-label": cursorLabel,
    onMouseEnter: onEnter,
    className: classes,
    "aria-label": ariaLabel,
  } as const;

  if (href) {
    return (
      <Link ref={root as React.RefObject<HTMLAnchorElement>} href={href} transitionTypes={transitionTypes} {...shared}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={root as React.RefObject<HTMLButtonElement>} type="button" onClick={onClick} {...shared}>
      {content}
    </button>
  );
}
