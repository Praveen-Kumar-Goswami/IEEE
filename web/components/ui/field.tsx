"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { SPRING } from "@/lib/motion/tokens";

const CONTROL =
  "w-full rounded-md border bg-graphite-900 text-body text-bone transition-[border-color,box-shadow,background-color] duration-(--dur-micro-slow) ease-(--ease-out-quart) " +
  "placeholder:text-graphite-400 hover:border-graphite-500 focus:border-signal/60 focus:bg-graphite-850 focus:shadow-[0_0_0_4px_rgb(116_216_192/0.09)] focus:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-attention/60 aria-invalid:focus:shadow-[0_0_0_4px_rgb(242_122_98/0.1)]";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
  optional?: boolean;
}

export function Field({ label, hint, error, children, className, optional }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-small font-medium text-graphite-100">
        {label}
        {optional && <span className="text-label text-graphite-400">Optional</span>}
      </label>
      {children({ id, describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-small text-graphite-300">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="animate-shake text-small text-attention">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; trailing?: ReactNode }>(function Input(
  { className, leading, trailing, ...props },
  ref,
) {
  if (!leading && !trailing) return <input ref={ref} className={cn(CONTROL, "h-11 px-3.5", className)} {...props} />;
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite-400 [&_svg]:size-4">{leading}</span>}
      <input ref={ref} className={cn(CONTROL, "h-11", leading ? "pl-10" : "pl-3.5", trailing ? "pr-12" : "pr-3.5", className)} {...props} />
      {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, "min-h-28 resize-y px-3.5 py-3 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(CONTROL, "h-11 appearance-none pl-3.5 pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-graphite-300" />
    </div>
  );
});

/** Spring toggle. role="switch" with a visible label. */
export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="text-body text-bone">
          {label}
        </label>
        {description && <p className="mt-0.5 text-small text-graphite-300">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-(--dur-micro-slow)",
          checked ? "justify-end border-signal/50 bg-signal/25" : "justify-start border-(--line-strong) bg-graphite-800",
          disabled && "opacity-50",
        )}
      >
        <motion.span layout transition={SPRING.toggle} className={cn("size-[18px] rounded-full shadow-e1", checked ? "bg-signal" : "bg-graphite-300")} />
      </button>
    </div>
  );
}
