import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** The custom type scale in globals.css; without it, `text-display-m` and `text-bone` would be treated as the same group. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display-xl", "display-l", "display-m", "h1", "h2", "h3", "body-l", "body", "small", "micro"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
