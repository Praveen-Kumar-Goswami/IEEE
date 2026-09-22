"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { useFocusTrap, useScrollLock } from "@/hooks/use-focus-trap";
import { useMounted } from "@/hooks/use-mounted";
import { useUiStore } from "@/stores/ui";
import { IconButton } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/Logo";
import type { Viewer } from "@/types/domain";
import { WorkspaceProvider } from "./context";
import { RealtimeBridge } from "./RealtimeBridge";
import { ConnectionCard, Sidebar, SidebarNav, WorkspaceSwitch } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";

export function Workspace({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return (
    <WorkspaceProvider viewer={viewer}>
      <RealtimeBridge />
      <Shell>{children}</Shell>
      <CommandPalette />
    </WorkspaceProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const stored = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const collapsed = mounted && stored;
  const pathname = usePathname();

  return (
    <div className="relative min-h-dvh bg-graphite-950">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgb(116_216_192/0.05),transparent_60%)]" />
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <MobileNav />
      <div className="relative flex min-h-dvh flex-col transition-[padding] duration-(--dur-standard) ease-(--ease-out-expo) lg:pl-(--sb)" style={{ ["--sb" as string]: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}>
        <Header />
        <main id="main" key={pathname} className="motion-safe:animate-page-in flex-1 px-(--margin) pb-16 pt-8 lg:px-8 lg:pt-10">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function MobileNav() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNav);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useFocusTrap(ref, open, close);
  useScrollLock(open);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-(--z-drawer) lg:hidden">
          <motion.div aria-hidden className="absolute inset-0 bg-void/70 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col border-r border-(--line-strong) bg-graphite-950"
          >
            <div className="flex h-16 items-center justify-between border-b border-(--line) px-4">
              <span className="flex items-center gap-2.5 text-small font-medium text-bone">
                <LogoMark className="size-7" /> Tend
              </span>
              <IconButton label="Close navigation" size="sm" onClick={close}>
                <X />
              </IconButton>
            </div>
            <WorkspaceSwitch onNavigate={close} />
            <SidebarNav onNavigate={close} layoutGroup="mobile" />
            <ConnectionCard />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
