"use client";

import { useEffect, useState, type RefObject } from "react";

/** True while the element is within `margin` of the viewport. Used to mount and pause 3D scenes. */
export function useInView<T extends Element>(ref: RefObject<T | null>, { margin = "200px", once = false } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin, once]);
  return inView;
}
