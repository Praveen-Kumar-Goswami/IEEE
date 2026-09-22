"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SceneGate } from "../components/SceneGate";
import { ShieldFallback } from "../components/fallbacks";
import { SectionLabel } from "../components/SectionLabel";
import type { SecuritySceneState } from "../three/SecurityScene";

const SecurityCanvas = dynamic(() => import("../three/SecurityScene"), { ssr: false });

/** Order matches the structure: shell, three rings, core. */
const CONCEPTS = [
  { title: "Encrypted data", body: "TLS 1.3 in transit and AES-256 at rest. Readings never travel or sit in plain text." },
  { title: "Role-based access", body: "Doctor, nurse and admin are database roles, not interface modes. Policies decide what each can read." },
  { title: "Audit logging", body: "Every acknowledgement, note, export and permission change is appended with who, what and when." },
  { title: "Secure authentication", body: "Supabase Auth with short-lived JWTs, refresh rotation and server-side session checks on every route." },
  { title: "Controlled permissions", body: "New staff request access and an admin approves it. Nobody grants themselves a role." },
] as const;

export function Security() {
  const root = useRef<HTMLElement>(null);
  const state = useRef<SecuritySceneState>({ focus: -1, px: 0, py: 0 });
  const [focus, setFocus] = useState(-1);
  const reduced = useReducedMotion();

  useEffect(() => {
    state.current.focus = focus;
  }, [focus]);

  useEffect(() => {
    if (reduced) return;
    const el = root.current!;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      state.current.px = ((e.clientX - r.left) / r.width) * 2 - 1;
      state.current.py = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => el.removeEventListener("pointermove", onMove);
  }, [reduced]);

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-sec-head] > *"), {
        opacity: 0,
        y: 28,
        duration: 1.1,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
      gsap.from(q("[data-concept]"), {
        opacity: 0,
        y: 24,
        duration: 1,
        stagger: 0.07,
        ease: "expo.out",
        scrollTrigger: { trigger: q("[data-concepts]")[0], start: "top 85%", once: true },
      });
      gsap.fromTo(
        q("[data-sec-visual]"),
        { scale: 0.86, opacity: 0 },
        { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top 90%", end: "top 30%", scrub: 0.6 } },
      );
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section id="security" ref={root} aria-labelledby="security-title" className="relative overflow-hidden py-(--section-space)">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div data-sec-head className="lg:col-span-5">
            <SectionLabel index="08">Security</SectionLabel>
            <h2 id="security-title" className="mt-6 max-w-[13ch] text-display-m font-light text-bone">
              Access is a policy, <span className="text-editorial text-ivory">not a screen.</span>
            </h2>
            <p className="mt-8 max-w-[26rem] text-body text-graphite-300">
              Patient data is protected in the database itself. The interface can only show what the signed-in role is allowed to read.
            </p>
          </div>
          <div data-sec-visual className="relative aspect-square w-full max-w-[640px] justify-self-center lg:col-span-6 lg:col-start-7">
            <SceneGate className="absolute inset-0" fallback={<ShieldFallback />} cursorLabel="Explore">
              {(p) => <SecurityCanvas state={state} {...p} />}
            </SceneGate>
          </div>
        </div>

        <ul data-concepts className="mt-16 grid gap-px overflow-hidden rounded-xl border border-(--line) bg-(--line) sm:grid-cols-2 lg:mt-20 lg:grid-cols-5">
          {CONCEPTS.map((c, i) => (
            <li
              key={c.title}
              data-concept
              onPointerEnter={() => setFocus(i)}
              onPointerLeave={() => setFocus(-1)}
              className={cn(
                "relative bg-graphite-950 p-6 transition-colors duration-(--dur-standard-fast) lg:p-7",
                focus === i && "bg-graphite-900",
                i === CONCEPTS.length - 1 && "sm:col-span-2 lg:col-span-1",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 top-0 h-px origin-left bg-signal transition-transform duration-(--dur-standard) ease-(--ease-out-expo)",
                  focus === i ? "scale-x-100" : "scale-x-0",
                )}
              />
              <span className={cn("tabular font-mono text-[11px] tracking-[0.14em] transition-colors", focus === i ? "text-signal" : "text-graphite-500")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 text-h3 font-normal text-bone">{c.title}</h3>
              <p className="mt-3 text-small text-graphite-300">{c.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
