"use client";

import { useRef } from "react";
import { cn } from "@/utils/cn";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { usePointerFine } from "@/hooks/use-media";
import { SectionLabel } from "../components/SectionLabel";

type NodeId = "patient" | "device" | "data" | "analysis" | "alert" | "doctor" | "nurse" | "team" | "action";

const LABELS: Record<NodeId, { title: string; detail: string }> = {
  patient: { title: "Patient", detail: "Wears the dressing" },
  device: { title: "Device", detail: "Samples every 5 s" },
  data: { title: "Data", detail: "Buffered and synced" },
  analysis: { title: "Analysis", detail: "Baseline and thresholds" },
  alert: { title: "Alert", detail: "Indicator opened" },
  doctor: { title: "Doctor", detail: "Reviews the trend" },
  nurse: { title: "Nurse", detail: "Checks the bedside" },
  team: { title: "Doctor / Nurse", detail: "Notified by role" },
  action: { title: "Action", detail: "Recorded to the timeline" },
};

interface Layout {
  w: number;
  h: number;
  nodes: Partial<Record<NodeId, [number, number]>>;
  /** Sequential legs; a leg with two paths runs them in parallel. */
  legs: { id: string; d: string; to: NodeId }[][];
}

const line = (a: [number, number], b: [number, number]) => `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
const curveH = (a: [number, number], b: [number, number]) => {
  const mx = (a[0] + b[0]) / 2;
  return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`;
};

const WIDE_NODES: Layout["nodes"] = {
  patient: [70, 200],
  device: [240, 200],
  data: [410, 200],
  analysis: [580, 200],
  alert: [750, 200],
  doctor: [930, 96],
  nurse: [930, 304],
  action: [1120, 200],
};
const n = WIDE_NODES as Record<NodeId, [number, number]>;
const WIDE: Layout = {
  w: 1200,
  h: 400,
  nodes: WIDE_NODES,
  legs: [
    [{ id: "w0", d: line(n.patient, n.device), to: "device" }],
    [{ id: "w1", d: line(n.device, n.data), to: "data" }],
    [{ id: "w2", d: line(n.data, n.analysis), to: "analysis" }],
    [{ id: "w3", d: line(n.analysis, n.alert), to: "alert" }],
    [
      { id: "w4", d: curveH(n.alert, n.doctor), to: "doctor" },
      { id: "w5", d: curveH(n.alert, n.nurse), to: "nurse" },
    ],
    [
      { id: "w6", d: curveH(n.doctor, n.action), to: "action" },
      { id: "w7", d: curveH(n.nurse, n.action), to: "action" },
    ],
  ],
};

const TALL_ORDER: NodeId[] = ["patient", "device", "data", "analysis", "alert", "team", "action"];
const TALL_NODES = Object.fromEntries(TALL_ORDER.map((id, i) => [id, [40, 40 + i * 120]])) as Record<NodeId, [number, number]>;
const TALL: Layout = {
  w: 320,
  h: 40 * 2 + (TALL_ORDER.length - 1) * 120,
  nodes: TALL_NODES,
  legs: TALL_ORDER.slice(1).map((id, i) => [{ id: `t${i}`, d: line(TALL_NODES[TALL_ORDER[i]], TALL_NODES[id]), to: id }]),
};

export function Workflow() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const fine = usePointerFine();

  useGSAP(
    () => {
      if (reduced) return;
      const mm = gsap.matchMedia();
      const build = (key: "wide" | "tall", layout: Layout) => {
        const scope = root.current!.querySelector<HTMLElement>(`[data-flow="${key}"]`)!;
        const q = gsap.utils.selector(scope);
        const edges = q<SVGPathElement>("[data-edge]");
        gsap.set(edges, { drawSVG: "0%" });
        gsap.to(edges, { drawSVG: "100%", duration: 1.2, stagger: 0.12, ease: "power2.inOut", scrollTrigger: { trigger: scope, start: "top 75%", once: true } });
        gsap.from(q("[data-node]"), { opacity: 0, scale: 0.6, duration: 0.9, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: scope, start: "top 75%", once: true } });

        const packets = q<SVGGElement>("[data-packet]");
        const pulse = (id: NodeId) => {
          const ring = scope.querySelector(`[data-ring="${id}"]`);
          if (ring) gsap.fromTo(ring, { scale: 1, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 1.1, ease: "power2.out", transformOrigin: "50% 50%" });
        };
        const along = (dot: SVGGElement, path: SVGPathElement, duration: number) => {
          const len = path.getTotalLength();
          const proxy = { l: 0 };
          return gsap.to(proxy, {
            l: len,
            duration,
            ease: "power1.inOut",
            onStart: () => gsap.set(dot, { opacity: 1 }),
            onUpdate: () => {
              const p = path.getPointAtLength(proxy.l);
              dot.setAttribute("transform", `translate(${p.x} ${p.y})`);
            },
          });
        };

        const cores = q("[data-packet-core]");
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.9, paused: true, delay: 0.6 });
        tl.set(packets, { opacity: 0 }, 0)
          .set(cores, { attr: { fill: "var(--color-signal)" } }, 0)
          .call(() => pulse("patient"), [], 0);
        layout.legs.forEach((leg, li) => {
          const at = `leg${li}`;
          tl.addLabel(at);
          leg.forEach((edge, ei) => {
            const path = scope.querySelector<SVGPathElement>(`[data-edge="${edge.id}"]`)!;
            tl.add(along(packets[ei], path, 0.75), at);
          });
          tl.call(() => leg.forEach((e) => pulse(e.to)));
          if (leg[0].to === "alert") tl.set(cores, { attr: { fill: "var(--color-watch)" } });
          if (leg[0].to === "action") tl.set(cores, { attr: { fill: "var(--color-signal)" } });
        });
        tl.to(packets, { opacity: 0, duration: 0.4 }, "+=0.15");

        const st = ScrollTrigger.create({ trigger: scope, start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? tl.play() : tl.pause()) });
        return () => {
          st.kill();
          tl.kill();
        };
      };
      mm.add("(min-width: 768px)", () => build("wide", WIDE));
      mm.add("(max-width: 767px)", () => build("tall", TALL));
      return () => mm.revert();
    },
    { scope: root, dependencies: [reduced] },
  );

  useGSAP(
    () => {
      if (reduced || !fine || !stage.current) return;
      const rx = gsap.quickTo(stage.current, "rotateX", { duration: 1.2, ease: "power3.out" });
      const ry = gsap.quickTo(stage.current, "rotateY", { duration: 1.2, ease: "power3.out" });
      const el = root.current!;
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        ry(x * 6);
        rx(-y * 5);
        stage.current!.style.setProperty("--sx", `${(x + 0.5) * 100}%`);
        stage.current!.style.setProperty("--sy", `${(y + 0.5) * 100}%`);
      };
      const onLeave = () => {
        rx(0);
        ry(0);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      return () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      };
    },
    { scope: root, dependencies: [reduced, fine] },
  );

  return (
    <section id="workflow" ref={root} aria-labelledby="workflow-title" className="relative py-(--section-space)">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionLabel index="06">Real-time workflow</SectionLabel>
            <h2 id="workflow-title" className="mt-6 max-w-[15ch] text-display-m font-light text-bone">
              Two seconds from skin <span className="text-editorial text-ivory">to screen.</span>
            </h2>
          </div>
          <p className="max-w-[28rem] text-body text-graphite-300 lg:col-span-4 lg:col-start-9">
            Every packet follows the same route. When a reading crosses a threshold, the indicator forks to the doctor and the nurse assigned to that patient, and whatever they do is recorded.
          </p>
        </div>

        <ol className="sr-only">
          {(["patient", "device", "data", "analysis", "alert", "team", "action"] as NodeId[]).map((id) => (
            <li key={id}>
              {LABELS[id].title}: {LABELS[id].detail}
            </li>
          ))}
        </ol>

        <div aria-hidden className="mt-16 [perspective:1400px] lg:mt-24">
          <div
            ref={stage}
            className="relative rounded-xl border border-(--line) bg-graphite-900/40 [transform-style:preserve-3d] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:[background:radial-gradient(420px_circle_at_var(--sx,50%)_var(--sy,50%),rgb(116_216_192/0.07),transparent_70%)]"
          >
            <Flow kind="wide" layout={WIDE} className="hidden px-6 py-10 md:block lg:px-10 lg:py-14" />
            <Flow kind="tall" layout={TALL} className="px-4 py-8 md:hidden" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Flow({ kind, layout, className }: { kind: "wide" | "tall"; layout: Layout; className?: string }) {
  const nodes = Object.entries(layout.nodes) as [NodeId, [number, number]][];
  const maxParallel = Math.max(...layout.legs.map((l) => l.length));
  const tall = kind === "tall";
  return (
    <div data-flow={kind} className={className}>
      <div className="relative" style={{ aspectRatio: `${layout.w} / ${layout.h}` }}>
        <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="absolute inset-0 size-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`pk-${kind}`}>
              <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.6" />
              <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {layout.legs.flat().map((e) => (
            <g key={e.id}>
              <path d={e.d} fill="none" stroke="var(--color-graphite-700)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path data-edge={e.id} d={e.d} fill="none" stroke="var(--color-graphite-400)" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {Array.from({ length: maxParallel }, (_, i) => (
            <g key={i} data-packet style={{ opacity: 0 }} transform={`translate(${layout.nodes.patient![0]} ${layout.nodes.patient![1]})`}>
              <circle r="16" fill={`url(#pk-${kind})`} />
              <circle data-packet-core r="4" fill="var(--color-signal)" />
            </g>
          ))}
        </svg>

        {nodes.map(([id, [x, y]]) => {
          const accent = id === "alert" ? "border-watch/50" : id === "action" ? "border-signal/50" : "border-(--line-strong)";
          return (
            <div
              key={id}
              className="absolute"
              style={{ left: `${(x / layout.w) * 100}%`, top: `${(y / layout.h) * 100}%`, transform: tall ? "translate(-28px, -50%)" : "translate(-50%, -28px)" }}
            >
             <div data-node className={tall ? "flex items-center gap-5" : "flex flex-col items-center"}>
              <span className={cn("relative flex size-14 shrink-0 items-center justify-center rounded-full border bg-graphite-900", accent)}>
                <span data-ring={id} className={cn("absolute inset-0 rounded-full border opacity-0", id === "alert" ? "border-watch" : "border-signal")} />
                <span className={cn("size-1.5 rounded-full", id === "alert" ? "bg-watch" : id === "action" ? "bg-signal" : "bg-bone")} />
              </span>
              <span className={cn("block", tall ? "min-w-[12rem]" : "mt-4 text-center")}>
                <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-bone">{LABELS[id].title}</span>
                <span className="mt-1 block whitespace-nowrap text-[12px] text-graphite-400">{LABELS[id].detail}</span>
              </span>
             </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
