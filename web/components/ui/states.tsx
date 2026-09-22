import type { ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "./button";
import { Spinner } from "./spinner";

export function EmptyState({ title, body, icon, action, className }: { title: string; body?: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="relative mb-5 flex size-12 items-center justify-center rounded-full border border-(--line) text-graphite-300 [&_svg]:size-5">
          <span aria-hidden className="absolute inset-[-6px] rounded-full border border-dashed border-(--line)" />
          {icon}
        </div>
      )}
      <p className="text-body font-medium text-bone">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-small text-graphite-300">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "This view could not load", error, onRetry, className }: { title?: string; error?: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Check the connection and try again.";
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-5 flex size-12 items-center justify-center rounded-full border border-attention/30 bg-attention/10 text-attention">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-body font-medium text-bone">{title}</p>
      <p className="mt-1.5 max-w-md text-small text-graphite-300">{message}</p>
      {onRetry && (
        <Button className="mt-5" size="sm" variant="outline" onClick={onRetry} iconLeft={<RotateCcw className="size-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-3 px-6 py-14 text-small text-graphite-300", className)}>
      <Spinner className="size-4 text-signal" />
      {label}
    </div>
  );
}
