"use client";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

/** Error boundary body for workspace routes; the sidebar and header stay usable. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mt-2">
      <ErrorState title="This page could not load" error={error} onRetry={reset} />
    </Card>
  );
}
