"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { TONE_CLASS, type Tone } from "@/lib/domain/labels";
import { CountUp } from "./count-up";
import { Skeleton } from "./skeleton";

interface MetricCardProps {
  label: string;
  value: number | null | undefined;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  href?: string;
  decimals?: number;
  suffix?: string;
  emphasis?: boolean;
  spark?: number[];
}

export function MetricCard({ label, value, hint, tone = "neutral", icon, href, decimals, suffix, emphasis, spark }: MetricCardProps) {
  const t = TONE_CLASS[tone];
  const body = (
    <>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-label text-graphite-300">{label}</span>
        {(href || icon) && (
          <span className={cn("flex size-7 items-center justify-center rounded-full border border-(--line) [&_svg]:size-3.5", emphasis ? t.text : "text-graphite-300")}>
            {href ? <ArrowUpRight className="transition-transform duration-(--dur-micro) group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /> : icon}
          </span>
        )}
      </div>
      <div className="mt-6 flex items-end justify-between gap-4">
        {value == null ? (
          <Skeleton className="h-11 w-20" />
        ) : (
          <CountUp value={value} decimals={decimals} suffix={suffix} className={cn("text-[2.75rem] font-light leading-none tracking-[-0.04em]", emphasis && value > 0 ? t.text : "text-bone")} />
        )}
        {spark && spark.length > 1 && <Spark values={spark} tone={tone} />}
      </div>
      {hint && <p className="mt-3 text-small text-graphite-300">{hint}</p>}
      {emphasis && value != null && value > 0 && <span aria-hidden className={cn("absolute inset-x-5 top-0 h-px", t.dot, "opacity-60")} />}
    </>
  );

  const classes = "group relative block overflow-hidden rounded-lg border border-(--line) bg-graphite-900/80 p-5 shadow-e1 transition-[border-color,background-color] duration-(--dur-standard-fast) ease-(--ease-out-expo)";
  if (href) {
    return (
      <Link href={href} transitionTypes={["nav-section"]} className={cn(classes, "hover:border-(--line-strong) hover:bg-graphite-850")}>
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}

function Spark({ values, tone }: { values: number[]; tone: Tone }) {
  const w = 84;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cn("shrink-0 overflow-visible", TONE_CLASS[tone].text)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}
