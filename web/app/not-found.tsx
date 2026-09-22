import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden bg-graphite-950 px-(--margin)">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(116_216_192/0.06),transparent)]" />
      <div className="motion-safe:animate-page-in relative max-w-lg text-center">
        <div className="mx-auto mb-8 flex size-14 items-center justify-center rounded-full border border-(--line-strong) text-signal">
          <Compass className="size-6" />
        </div>
        <p className="text-label text-graphite-400">404 · No signal</p>
        <h1 className="mt-4 text-h1 font-light text-bone">
          Nothing is reporting <span className="text-editorial text-ivory">from here.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-body text-graphite-300">The page may have moved, or the link is incomplete.</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={buttonStyles({ variant: "primary", size: "lg" })}>
            Back to home <ArrowRight className="size-4" />
          </Link>
          <Link href="/login" className={buttonStyles({ variant: "outline", size: "lg" })}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
