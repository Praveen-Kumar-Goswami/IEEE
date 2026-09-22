"use client";

import { useCountUp } from "@/hooks/use-count-up";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

export function CountUp({ value, decimals = 0, durationMs, className, suffix }: { value: number; decimals?: number; durationMs?: number; className?: string; suffix?: string }) {
  const current = useCountUp(value, { decimals, durationMs });
  return (
    <span className={cn("tabular", className)}>
      <span aria-hidden>{formatNumber(current, decimals)}</span>
      <span className="sr-only">{formatNumber(value, decimals)}</span>
      {suffix}
    </span>
  );
}

const DIGITS = "0123456789";

/**
 * Odometer for values that change in place (live telemetry). Each digit is a strip of 0-9
 * translated to the current digit, so a change reads as the number rolling, not flashing.
 */
export function RollingNumber({ value, decimals = 1, className }: { value: number | null; decimals?: number; className?: string }) {
  if (value == null || Number.isNaN(value)) return <span className={cn("tabular text-graphite-400", className)}>--</span>;
  const text = value.toFixed(decimals);
  return (
    <span className={cn("tabular inline-flex overflow-hidden leading-none", className)} aria-label={text} role="img">
      {text.split("").map((ch, i) => {
        const d = DIGITS.indexOf(ch);
        if (d < 0) {
          return (
            <span key={`${i}-${ch}`} aria-hidden>
              {ch}
            </span>
          );
        }
        return (
          <span key={`${text.length - i}`} aria-hidden className="relative inline-block h-[1em] overflow-hidden">
            <span
              className="flex flex-col transition-transform duration-(--dur-standard-slow) ease-(--ease-out-expo)"
              style={{ transform: `translateY(-${d * 10}%)` }}
            >
              {DIGITS.split("").map((n) => (
                <span key={n} className="block h-[1em] leading-none">
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
