"use client";

import Link from "next/link";
import { useRef } from "react";
import { BRAND } from "@/lib/brand";
import { useInView } from "@/hooks/use-in-view";
import { useApiHealth } from "@/hooks/use-api-health";
import { StatusDot } from "@/components/ui/badge";
import { LogoMark } from "@/components/brand/Logo";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Live monitoring", href: "#platform" },
      { label: "Technology", href: "#technology" },
      { label: "Security", href: "#security" },
    ],
  },
  {
    title: "Workspaces",
    links: [
      { label: "Doctor", href: "/login" },
      { label: "Nurse", href: "/login" },
      { label: "Admin", href: "/login" },
    ],
  },
  {
    title: "Contact",
    links: [{ label: BRAND.supportEmail, href: `mailto:${BRAND.supportEmail}` }],
  },
];

export function Footer() {
  const root = useRef<HTMLElement>(null);
  const visible = useInView(root, { margin: "0px" });
  const api = useApiHealth(visible, 15000);
  const apiText = !api.configured
    ? "API not configured"
    : api.status === "checking"
      ? "Checking API"
      : api.status === "operational"
        ? `API operational · ${api.latencyMs} ms`
        : "API unreachable";

  return (
    <footer id="about" ref={root} className="relative overflow-hidden border-t border-(--line) pt-20">
      <div className="container-page">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="flex items-center gap-3 text-h3 text-bone">
              <LogoMark className="size-8" />
              {BRAND.name}
            </p>
            <p className="mt-6 max-w-[30rem] text-body text-graphite-300">
              {BRAND.name} is a clinician platform for a sensor dressing built for {BRAND.program}. It streams localized temperature, humidity and moisture from the wound site so a care team sees change as it happens.
            </p>
            <p className="mt-6 max-w-[30rem] text-small text-graphite-400">{BRAND.disclaimer}</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-label text-graphite-400">{col.title}</h2>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="link-underline break-all text-small text-graphite-200 transition-colors hover:text-bone">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-20 flex flex-col gap-4 border-t border-(--line) py-6 font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {BRAND.name} · {BRAND.program}</span>
          <span className="flex items-center gap-2" aria-live="polite">
            <StatusDot tone={api.status === "operational" ? "signal" : api.status === "checking" ? "neutral" : "critical"} pulse={api.status === "operational"} />
            {apiText}
          </span>
        </div>
      </div>
      <p
        aria-hidden
        className="pointer-events-none select-none text-center text-[clamp(8rem,34vw,34rem)] font-medium leading-[0.72] tracking-[-0.07em] text-transparent [-webkit-text-stroke:1px_var(--line-strong)] [margin-bottom:-0.12em]"
      >
        {BRAND.name.toLowerCase()}
      </p>
    </footer>
  );
}
