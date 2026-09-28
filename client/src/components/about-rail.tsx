// AboutRail — the ignition figure, walking the margin above the film.
//
// Decorative sibling of the homepage ignition: the same persistence-engine
// beam draws the brand 3:2 Lissajous in a narrow fixed rail on the right.
// It lights on page load, and as the reader scrolls toward the About film the
// knot rides down the margin and grows, coil by coil. It sits above the film
// (its canvas is transparent), so the film's rising edge never slices it; it
// fades out while the film scrolls in and stops once the film pins, so only
// one canvas animates at a time.
// Pure visual, no data feed. Desktop only (the rail lives in the free margin
// beside the content column); aria-hidden, pointer-inert.
import { useEffect, useRef } from "react";
import { createPersistenceEngine } from "@/components/persistence-engine";

// vertical travel range of the knot center (normalized canvas coords)
const Y_TOP = 0.2;
const Y_BOT = 0.5;
// figure size at page top and at the film's start (multiplies the coil radii)
const SCALE_START = 0.45;
const SCALE_END = 1.3;
const PHI = 0.9; // fixed figure phase — this one is a visual, not a readout

export function AboutRail() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // 0 at page top, 1 when the film section reaches the top of the viewport
    const approach = () => {
      const film = document.querySelector<HTMLElement>("[data-about-story]");
      if (!film) return 0;
      const top = film.getBoundingClientRect().top + window.scrollY;
      return top > 0 ? Math.min(1, Math.max(0, window.scrollY / top)) : 1;
    };
    const ease = (t: number) => t * t * (3 - 2 * t);

    let u = 0; // orbit parameter
    let a = approach(); // eased toward the scroll position
    const engine = createPersistenceEngine(canvas, {
      tau: 2.2,
      onFrame: (api, _t, dt) => {
        const { w, h } = api.size();
        a += (approach() - a) * Math.min(1, dt * 2.6);
        const k = SCALE_START + (SCALE_END - SCALE_START) * ease(a);
        // near-round coils despite the rail's tall aspect
        const rx = 0.34 * k;
        const ry = h > 0 ? Math.min(0.09 * k, rx * (w / h)) : 0.05;
        const py = Y_TOP + ease(a) * (Y_BOT - Y_TOP);

        const du = dt / 1.6;
        const steps = Math.max(1, Math.ceil(du * 140));
        const pts: number[] = [];
        for (let s = 0; s <= steps; s++) {
          const th = (u + (du * s) / steps) * Math.PI * 2;
          pts.push(0.5 + rx * Math.sin(3 * th + PHI), py + ry * Math.sin(2 * th));
        }
        u += du;
        api.path(pts, { energy: 0.5, width: 1.8 * Math.sqrt(k) });
        api.spot(pts[pts.length - 2], pts[pts.length - 1], 0.7, 2.2 * Math.sqrt(k));
      },
    });
    if (!engine.ok) return () => engine.destroy(); // decorative — no fallback

    // lit from load; fades out as the film's top edge rises from the bottom
    // of the viewport to the top, and stops once the film takes the beam
    let running = false;
    const onScroll = () => {
      const film = document.querySelector<HTMLElement>("[data-about-story]");
      const rise = film ? 1 - film.getBoundingClientRect().top / window.innerHeight : 0;
      const fade = Math.min(1, Math.max(0, (rise - 0.2) / 0.55));
      wrap.style.opacity = (1 - fade).toFixed(3);
      const on = fade < 1;
      if (on === running) return;
      running = on;
      if (on) engine.start();
      else engine.stop();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      engine.destroy();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 right-0 z-[5] hidden xl:block"
      style={{ width: "clamp(180px, calc((100vw - 56rem) / 2), 400px)" }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" data-testid="about-rail" />
    </div>
  );
}
