// AboutRail — the ignition figure, walking the margin above the film.
//
// Decorative sibling of the homepage ignition: the same persistence-engine
// beam draws the brand 3:2 Lissajous in a narrow fixed rail on the right.
// It sits in the right margin below the hero in z-order, so its coils pass
// behind the hero's cards. It lights about 2 s after load, once
// the hero's entrance has played, and as the reader scrolls toward the About film the
// knot rides down the margin and grows, coil by coil. It sits above the film
// (its canvas is transparent), so the film's rising edge never slices it; it
// fades out while the film scrolls in and stops the moment the film pins,
// which is when the film starts drawing, so only one canvas animates at a time.
// Below xl the rail is hidden and its loop never runs.
// Pure visual, no data feed. Desktop only (the rail lives in the free margin
// beside the content column); aria-hidden, pointer-inert.
import { useEffect, useRef, useState } from "react";
import { createPersistenceEngine } from "@/components/persistence-engine";

// vertical travel range of the knot center (normalized canvas coords)
const Y_TOP = 0.2;
const Y_BOT = 0.5;
// figure size at page top and at the film's start (multiplies the coil radii)
const SCALE_START = 0.45;
const SCALE_END = 1.3;
const XL = "(min-width: 1280px)";
const HERO_ENTRANCE_MS = 2000;
const PHI = 0.9; // fixed figure phase — this one is a visual, not a readout

export function AboutRail() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // the rail is hidden below xl: no WebGL engine is created there at all
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(XL).matches);
  useEffect(() => {
    const mq = window.matchMedia(XL);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // The figure lights once the hero's entrance (logo draw, title rise, about
  // 2 s) has played; the title's word rotation keeps going beside it (the
  // user's call over DESIGN.md's one-moving-section rule).
  const quiet = useRef(false);
  const recheck = useRef<() => void>(() => {});
  useEffect(() => {
    const t = setTimeout(() => { quiet.current = true; recheck.current(); }, HERO_ENTRANCE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wide || !wrap || !canvas) return;

    // 0 at page top, 1 when the film section reaches the top of the viewport
    const approach = () => {
      const film = document.querySelector<HTMLElement>("[data-about-story]");
      if (!film) return 0;
      const top = film.getBoundingClientRect().top + window.scrollY;
      return top > 0 ? Math.min(1, Math.max(0, window.scrollY / top)) : 1;
    };
    const ease = (t: number) => t * t * (3 - 2 * t);

    let u = 0; // orbit parameter
    let kDrawn = 0; // largest knot scale still in the afterglow
    let a = approach(); // eased toward the scroll position
    const engine = createPersistenceEngine(canvas, {
      tau: 2.2,
      onFrame: (api, _t, dt) => {
        const { w, h } = api.size();
        a += (approach() - a) * Math.min(1, dt * 2.6);
        const k = SCALE_START + (SCALE_END - SCALE_START) * ease(a);
        // shrinking (scrolling back up): the beam's afterglow would leave the
        // larger coils behind for seconds, so wipe it each time the knot has
        // shrunk by a tenth
        if (k < kDrawn * 0.9) { queueMicrotask(() => engine.clear()); kDrawn = k; }
        else if (k > kDrawn) kDrawn = k;
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

    // lit from load; fades out as the film's top edge rises through the
    // viewport and reaches zero as the film pins (its top at the viewport top),
    // the frame the film starts drawing. The rail is hidden below xl, so it
    // only runs while that media query matches.
    let running = false;
    const onScroll = () => {
      const film = document.querySelector<HTMLElement>("[data-about-story]");
      const top = film ? film.getBoundingClientRect().top : window.innerHeight;
      const rise = 1 - top / window.innerHeight;
      const fade = Math.min(1, Math.max(0, (rise - 0.2) / 0.8));
      wrap.style.opacity = (1 - fade).toFixed(3);
      // same test the film starts drawing on (its top within 1 px of the viewport top)
      const on = top > 1 && quiet.current;
      if (on === running) return;
      running = on;
      // restarting (back from the film): the knot resumes at the size this
      // scroll position calls for, with the old large trace wiped
      if (on) { a = approach(); kDrawn = 0; engine.clear(); engine.start(); }
      else engine.stop();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => onScroll();
    window.addEventListener("resize", onResize);
    recheck.current = onScroll;
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      engine.destroy();
    };
  }, [wide]);

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
