"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { cn } from "@/utils/cn";

interface SearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export const Search = forwardRef<HTMLInputElement, SearchProps>(function Search({ value, onChange, label, className, placeholder, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-graphite-400" />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder ?? label}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-full border border-(--line) bg-graphite-900 pl-9 pr-9 text-small text-bone transition-[border-color,box-shadow] duration-(--dur-micro-slow) placeholder:text-graphite-400 hover:border-graphite-600 focus:border-signal/50 focus:shadow-[0_0_0_4px_rgb(116_216_192/0.08)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-graphite-400 hover:text-bone">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
});
