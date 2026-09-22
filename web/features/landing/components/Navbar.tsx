"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { Logo } from "@/components/brand/Logo";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ScrollTrigger } from "@/lib/motion/gsap";
import { useMagnetic } from "@/hooks/use-magnetic";
import { useFocusTrap, useScrollLock } from "@/hooks/use-focus-trap";
import { BEZIER, DURATION, SPRING } from "@/lib/motion/tokens";
import { BRAND } from "@/lib/brand";
import { useIntroStore } from "@/stores/intro";

export const NAV_ITEMS = [
  { id: "platform", label: "Platform" },
  { id: "technology", label: "Technology" },
  { id: "how-it-works", label: "How It Works" },
  { id: "security", label: "Security" },
  { id: "about", label: "About" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = document.documentElement.classList.contains("reduced-motion");
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

function NavLink({ id, label, active, onSelect }: { id: NavId; label: string; active: boolean; onSelect: (id: NavId) => void }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useMagnetic(ref, { strength: 0.25, radius: 10 });
  return (
    <a
      ref={ref}
      href={`#${id}`}
      data-magnetic
      aria-current={active ? "location" : undefined}
      onClick={(e) => {
        e.preventDefault();
        onSelect(id);
      }}
      className={cn("relative px-3.5 py-2 text-small transition-colors duration-(--dur-micro)", active ? "text-bone" : "text-graphite-300 hover:text-bone")}
    >
      {active && <motion.span layoutId="nav-active" transition={SPRING.soft} className="absolute inset-0 rounded-full bg-white/[0.06]" />}
      <span className="relative">{label}</span>
    </a>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<NavId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const ready = useIntroStore((s) => s.loaderDone);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const triggers = NAV_ITEMS.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;
      return ScrollTrigger.create({
        trigger: el,
        start: "top 55%",
        end: "bottom 45%",
        onToggle: (self) => {
          if (self.isActive) setActive(id);
          else setActive((cur) => (cur === id ? null : cur));
        },
      });
    });
    return () => triggers.forEach((t) => t?.kill());
  }, [ready]);

  const select = (id: NavId) => {
    setMenuOpen(false);
    requestAnimationFrame(() => scrollToSection(id));
  };

  return (
    <>
      <header style={{ viewTransitionName: "site-nav" }} className="pointer-events-none fixed inset-x-0 top-0 z-(--z-nav) flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
        <motion.nav
          aria-label="Primary"
          initial={false}
          animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : -16 }}
          transition={{ duration: DURATION.standardSlow, ease: BEZIER.outExpo, delay: ready ? 0.5 : 0 }}
          className={cn(
            "pointer-events-auto flex w-full max-w-(--page-max) items-center justify-between rounded-full border transition-[background-color,border-color,padding,backdrop-filter,max-width] duration-(--dur-standard) ease-(--ease-out-expo)",
            scrolled ? "max-w-5xl border-(--line) bg-graphite-950/70 py-2 pl-5 pr-2 backdrop-blur-xl" : "border-transparent bg-transparent py-3 pl-3 pr-3 sm:pl-5",
          )}
        >
          <Link href="/" aria-label={`${BRAND.name} home`} className="shrink-0" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Logo />
          </Link>

          <div className="hidden items-center lg:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.id} id={item.id} label={item.label} active={active === item.id} onSelect={select} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <MagneticButton href="/login" transitionTypes={["nav-enter"]} size="md" strength={0.22}>
                Enter Platform
                <ArrowRight className="size-4 transition-transform duration-(--dur-micro) group-hover/mag:translate-x-0.5" />
              </MagneticButton>
            </div>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
              className="relative z-10 flex size-11 items-center justify-center rounded-full border border-(--line-strong) lg:hidden"
            >
              <span className="relative block h-3 w-4">
                <span className={cn("absolute left-0 top-0 h-px w-4 bg-bone transition-transform duration-(--dur-standard-fast) ease-(--ease-out-expo)", menuOpen && "translate-y-1.5 rotate-45")} />
                <span className={cn("absolute bottom-0 left-0 h-px w-4 bg-bone transition-transform duration-(--dur-standard-fast) ease-(--ease-out-expo)", menuOpen && "-translate-y-1.5 -rotate-45")} />
              </span>
            </button>
          </div>
        </motion.nav>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={select} active={active} />
    </>
  );
}

function MobileMenu({ open, onClose, onSelect, active }: { open: boolean; onClose: () => void; onSelect: (id: NavId) => void; active: NavId | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  useScrollLock(open);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[190] flex flex-col bg-graphite-950 px-(--margin) pb-10 pt-28 lg:hidden"
          initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: { duration: DURATION.standard, ease: BEZIER.inOutCine, delay: 0.15 } }}
          transition={{ duration: DURATION.standardSlow, ease: BEZIER.inOutCine }}
        >
          <nav aria-label="Sections" className="flex flex-1 flex-col justify-center">
            <ol className="space-y-1">
              {NAV_ITEMS.map((item, i) => (
                <li key={item.id} className="overflow-hidden">
                  <motion.a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelect(item.id);
                    }}
                    initial={{ y: "110%" }}
                    animate={{ y: "0%" }}
                    exit={{ y: "-110%", transition: { duration: DURATION.standardFast, ease: BEZIER.inQuart, delay: i * 0.03 } }}
                    transition={{ duration: DURATION.standardSlow, ease: BEZIER.outExpo, delay: 0.18 + i * 0.06 }}
                    className="flex items-baseline gap-4 py-1"
                  >
                    <span className="text-label w-6 text-graphite-400">{String(i + 1).padStart(2, "0")}</span>
                    <span className={cn("text-[clamp(2.4rem,11vw,4rem)] font-light leading-[1.05] tracking-[-0.045em]", active === item.id ? "text-bone" : "text-graphite-200")}>{item.label}</span>
                  </motion.a>
                </li>
              ))}
            </ol>
          </nav>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.standard, ease: BEZIER.outExpo, delay: 0.5 }}
            className="space-y-6"
          >
            <Link
              href="/login"
              transitionTypes={["nav-enter"]}
              onClick={onClose}
              className="flex h-14 w-full items-center justify-between rounded-full bg-bone px-6 text-body font-medium text-graphite-950"
            >
              Enter Platform
              <ArrowRight className="size-5" />
            </Link>
            <p className="text-small text-graphite-300">{BRAND.disclaimer}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
