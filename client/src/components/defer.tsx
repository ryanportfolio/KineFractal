// Defer — mount children only once a placeholder nears the viewport.
//
// The homepage stacks several heavy movements (each with its own report
// fetches, canvases and WebGL/2d beam engines). Rendering them all on load
// makes the first paint do work for content two screens down. Defer holds a
// light placeholder until it scrolls within `rootMargin` of the viewport, then
// swaps in the real section — so first paint builds just the hero, and each
// movement comes online as you approach it. Once mounted it stays mounted.
import { useEffect, useRef, useState, type ReactNode } from "react";

interface DeferProps {
  children: ReactNode;
  /** placeholder height that reserves scroll space before mount (px) */
  minHeight?: number;
  /** how far ahead of the viewport to mount (IntersectionObserver rootMargin) */
  rootMargin?: string;
}

export function Defer({ children, minHeight = 480, rootMargin = "700px" }: DeferProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true); // no IO (old browser / SSR) — just render
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  if (show) return <>{children}</>;
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />;
}
