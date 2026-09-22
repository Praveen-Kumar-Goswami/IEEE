"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { usePointerFine } from "@/hooks/use-media";
import type { StaffRole } from "@/types/domain";
import { SectionLabel } from "../components/SectionLabel";

const ROLES: { role: StaffRole; title: string; summary: string; duties: string[] }[] = [
  {
    role: "doctor",
    title: "Doctor",
    summary: "Clinical overview across every monitored patient, with the trend behind each indicator.",
    duties: ["Clinical overview", "Patient monitoring", "Alerts", "Treatment decisions", "Historical trends", "Reports"],
  },
  {
    role: "nurse",
    title: "Nurse",
    summary: "A shift-shaped queue: who to see next, what to record, and when to escalate.",
    duties: ["Assigned patients", "Tasks", "Measurements", "Live monitoring", "Alerts", "Care updates", "Escalation"],
  },
  {
    role: "admin",
    title: "Admin",
    summary: "People, devices and permissions, with the audit trail to show who did what.",
    duties: ["Users", "Devices", "Analytics", "Permissions", "Approvals", "Security", "Audit logs", "System health"],
  },
];

export function Roles() {
  const root = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-roles-head] > *"), {
        opacity: 0,
        y: 28,
        duration: 1.1,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
      gsap.from(q("[data-role-card]"), {
        opacity: 0,
        y: 80,
        rotateX: -8,
        duration: 1.4,
        stagger: 0.12,
        ease: "expo.out",
        scrollTrigger: { trigger: q("[data-role-grid]")[0], start: "top 80%", once: true },
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section id="roles" ref={root} aria-labelledby="roles-title" className="relative overflow-hidden py-(--section-space)">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:96px_96px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_60%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-[60vh] w-[40vw] -translate-x-1/2 rounded-full bg-signal/[0.06] blur-[120px] transition-[left,opacity] duration-(--dur-cine) ease-(--ease-out-expo)"
        style={{ left: hovered == null ? "50%" : `${18 + hovered * 32}%`, opacity: hovered == null ? 0.4 : 1 }}
      />
      <div className="container-page relative">
        <div data-roles-head className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionLabel index="05">Role ecosystem</SectionLabel>
            <h2 id="roles-title" className="mt-6 max-w-[14ch] text-display-m font-light text-bone">
              Three roles. <span className="text-editorial text-ivory">One record.</span>
            </h2>
          </div>
          <p className="max-w-[28rem] text-body text-graphite-300 lg:col-span-4 lg:col-start-9">
            Each role sees the same patient data through a workspace built for its job. Row-level security decides what reaches the screen, not the interface.
          </p>
        </div>

        <ul data-role-grid className="mt-16 grid gap-4 [perspective:1600px] md:grid-cols-3 lg:mt-24 lg:gap-6">
          {ROLES.map((r, i) => (
            <li key={r.role} data-role-card className="[transform-style:preserve-3d]">
              <RoleCard index={i} {...r} onHover={setHovered} reduced={reduced} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RoleCard({
  index,
  role,
  title,
  summary,
  duties,
  onHover,
  reduced,
}: (typeof ROLES)[number] & { index: number; onHover: (i: number | null) => void; reduced: boolean }) {
  const card = useRef<HTMLAnchorElement>(null);
  const fine = usePointerFine();
  const tilt = fine && !reduced;
  const quick = useRef<{ rx: gsap.QuickToFunc; ry: gsap.QuickToFunc; z: gsap.QuickToFunc } | null>(null);

  useGSAP(() => {
    if (!tilt || !card.current) return;
    quick.current = {
      rx: gsap.quickTo(card.current, "rotateX", { duration: 0.8, ease: "power3.out" }),
      ry: gsap.quickTo(card.current, "rotateY", { duration: 0.8, ease: "power3.out" }),
      z: gsap.quickTo(card.current, "z", { duration: 0.8, ease: "power3.out" }),
    };
  }, [tilt]);

  const onMove = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    const el = card.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    quick.current?.ry((x - 0.5) * 10);
    quick.current?.rx(-(y - 0.5) * 8);
  };
  const onEnter = () => {
    onHover(index);
    quick.current?.z(40);
  };
  const onLeave = () => {
    onHover(null);
    quick.current?.rx(0);
    quick.current?.ry(0);
    quick.current?.z(0);
  };

  return (
    <Link
      ref={card}
      href="/login"
      transitionTypes={["nav-enter"]}
      onPointerMove={tilt ? onMove : undefined}
      onPointerEnter={tilt ? onEnter : undefined}
      onPointerLeave={tilt ? onLeave : undefined}
      data-cursor="view"
      data-cursor-label="View"
      className="group/role relative flex min-h-[26rem] flex-col justify-between rounded-xl border border-(--line) bg-graphite-900/70 p-6 [transform-style:preserve-3d] focus-visible:outline-offset-4 sm:p-8 lg:min-h-[34rem]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-(--dur-standard) group-hover/role:opacity-100 [background:radial-gradient(360px_circle_at_var(--mx,50%)_var(--my,0%),color-mix(in_oklab,var(--color-signal)_70%,transparent),transparent_60%)] [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-(--dur-standard) group-hover/role:opacity-100 [background:radial-gradient(520px_circle_at_var(--mx,50%)_var(--my,0%),rgb(237_234_228/0.05),transparent_65%)]"
      />

      <div className="relative flex items-start justify-between [transform:translateZ(30px)]">
        <span className="tabular font-mono text-[11px] tracking-[0.14em] text-graphite-400">{String(index + 1).padStart(2, "0")}</span>
        <RoleGlyph role={role} />
      </div>

      <div className="relative [transform:translateZ(50px)]">
        <h3 className="text-display-m font-light text-bone">{title}</h3>
        <p className="mt-4 max-w-[26ch] text-body text-graphite-300">{summary}</p>
        <ul
          aria-label={`${title} responsibilities`}
          className="mt-8 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite-200"
        >
          {duties.map((d, i) => (
            <li
              key={d}
              className="transition-[opacity,transform] duration-(--dur-standard) ease-(--ease-out-expo) [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-40 [@media(hover:hover)]:group-hover/role:translate-y-0 [@media(hover:hover)]:group-hover/role:opacity-100 [@media(hover:hover)]:group-focus-visible/role:translate-y-0 [@media(hover:hover)]:group-focus-visible/role:opacity-100"
              style={{ transitionDelay: `${i * 35}ms` }}
            >
              {d}
            </li>
          ))}
        </ul>
        <p className="mt-10 flex items-center gap-2 text-small text-bone">
          Enter as {title.toLowerCase()}
          <ArrowUpRight aria-hidden className="size-4 transition-transform duration-(--dur-micro-slow) ease-(--ease-out-quart) group-hover/role:-translate-y-0.5 group-hover/role:translate-x-0.5" />
        </p>
      </div>
    </Link>
  );
}

/** One quiet drawing per role, so the cards differ by what each person looks at. */
function RoleGlyph({ role }: { role: StaffRole }) {
  const common = "h-10 w-20 text-graphite-400 transition-colors duration-(--dur-standard) group-hover/role:text-signal";
  if (role === "doctor") {
    return (
      <svg viewBox="0 0 80 40" className={common} fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
        <path d="M0 30 C10 30 14 28 20 26 S30 18 36 20 S46 30 52 24 S62 8 70 10 S78 14 80 14" />
        <line x1="0" x2="80" y1="18" y2="18" strokeDasharray="2 3" strokeOpacity="0.5" />
        <circle cx="70" cy="10" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (role === "nurse") {
    return (
      <svg viewBox="0 0 80 40" className={common} fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
        {[6, 20, 34].map((y, i) => (
          <g key={y}>
            <rect x="40" y={y - 4} width="8" height="8" rx="2" />
            {i < 2 && <path d={`M42 ${y} l2 2 l3 -4`} />}
            <line x1="54" x2="80" y1={y} y2={y} strokeOpacity={i < 2 ? 0.5 : 1} />
          </g>
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 40" className={common} fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
      {Array.from({ length: 15 }, (_, i) => (
        <circle key={i} cx={34 + (i % 5) * 11} cy={8 + Math.floor(i / 5) * 12} r="2.2" fill={i === 7 ? "none" : "currentColor"} fillOpacity={i === 7 ? 0 : 0.6} />
      ))}
    </svg>
  );
}
