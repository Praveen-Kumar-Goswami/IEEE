import { cn } from "@/utils/cn";
import { BRAND } from "@/lib/brand";

/**
 * The mark: a dressing outline with one reading crossing it. The small rise in the trace
 * is the localized temperature change the platform exists to surface.
 */
export function LogoMark({ className, strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <rect data-logo-frame x="2.5" y="2.5" width="27" height="27" rx="9" stroke="currentColor" strokeWidth={strokeWidth} />
      <path data-logo-trace d="M7.5 18.5H12.2C13.4 18.5 14 17.9 14.6 16.6L15.4 14.9C16 13.6 17.4 13.6 18 14.9L18.5 16C19 17.2 19.8 18.5 21.2 18.5H23" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle data-logo-node cx="24.2" cy="18.5" r="1.7" className="fill-signal" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-bone", className)}>
      <LogoMark className={cn("size-7", markClassName)} />
      <span className="text-[1.2rem] font-medium lowercase leading-none tracking-[-0.045em]">{BRAND.name}</span>
    </span>
  );
}
