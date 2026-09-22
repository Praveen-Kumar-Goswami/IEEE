import { cn } from "@/utils/cn";

export function SectionLabel({ index, children, className }: { index: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-label flex items-center gap-3 text-graphite-300", className)}>
      <span className="tabular text-graphite-400">{index}</span>
      <span aria-hidden className="h-px w-8 bg-graphite-600" />
      {children}
    </p>
  );
}

/** Splits a sentence into word spans for scroll-scrubbed reveals, keeping the text readable to assistive tech. */
export function Words({ text, className, wordClassName }: { text: string; className?: string; wordClassName?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i} data-word className={cn("inline-block will-change-[opacity,transform]", wordClassName)}>
            {w}
            {i < words.length - 1 ? "\u00a0" : ""}
          </span>
        ))}
      </span>
    </span>
  );
}
