"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-graphite-950 px-(--margin)">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-8 flex size-14 items-center justify-center rounded-full border border-attention/30 bg-attention/10 text-attention">
          <TriangleAlert className="size-6" />
        </div>
        <h1 className="text-h1 font-light text-bone">Something went wrong.</h1>
        <p className="mx-auto mt-5 max-w-md text-body text-graphite-300">The page hit an unexpected error. Nothing you entered was lost on the server.</p>
        {error.digest && <p className="mt-3 font-mono text-[11px] text-graphite-500">Reference {error.digest}</p>}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" iconLeft={<RotateCcw className="size-4" />} onClick={reset}>
            Try again
          </Button>
          <Link href="/" className={buttonStyles({ variant: "outline", size: "lg" })}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
