// AboutRail — the ignition figure, walking the margin.
//
// Decorative sibling of the homepage ignition: the same persistence-engine
// beam draws the brand 3:2 Lissajous in a narrow fixed rail on the right,
// and the figure's center rides the reader's scroll. Reading the page pulls
// the knot down the margin, coil by coil; stop and it parks, still orbiting.
// Pure visual, no data feed. Desktop only (the rail lives in the free margin
// beside the content column); dark until the reader scrolls past the hero so
// it never competes with the hero's own motion. aria-hidden, pointer-inert.
import { useEffect, useRef } from "react";
import { createPersistenceEngine } from "@/components/persistence-engine";

// fraction of a viewport height scrolled before the rail lights up
const SHOW_AFTER = 0.55;
// vertical travel range of the knot center (normalized canvas coords)
const Y_TOP = 0.08;
const Y_BOT = 0.92;
const PHI = 0.9; // fixed figure phase — this one is a visual, not a readout

export function AboutRail() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const scrollT = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    let u = 0; // orbit parameter
    let py = Y_TOP + scrollT() * (Y_BOT - Y_TOP); // knot center, eased toward scroll

    const engine = createPersistenceEngine(canvas, {
      tau: 2.2,
      onFrame: (api, _t, dt) => {
        const { w, h } = api.size();
        // near-round coils despite the rail's tall aspect
        const rx = 0.34;
        const ry = h > 0 ? Math.min(0.09, rx * (w / h)) : 0.05;

        py += (Y_TOP + scrollT() * (Y_BOT - Y_TOP) - py) * Math.min(1, dt * 2.6);
        const du = dt / 1.6;
        const steps = Math.max(1, Math.ceil(du * 140));
        const pts: number[] = [];
        for (let s = 0; s <= steps; s++) {
          const th = (u + (du * s) / steps) * Math.PI * 2;
          pts.push(0.5 + rx * Math.sin(3 * th + PHI), py + ry * Math.sin(2 * th));
        }
        u += du;
        api.path(pts, { energy: 0.5, width: 1.8 });
        api.spot(pts[pts.length - 2], pts[pts.length - 1], 0.7, 2.2);
      },
    });
    if (!engine.ok) return () => engine.destroy(); // decorative — no fallback

    // the rail owns the beam only below the hero — fade + start/stop together
    let shown = false;
    const onScroll = () => {
      const on = window.scrollY > window.innerHeight * SHOW_AFTER;
      if (on === shown) return;
      shown = on;
      wrap.style.opacity = on ? "1" : "0";
      if (on) engine.start();
      else engine.stop();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      engine.destroy();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden opacity-0 transition-opacity duration-700 xl:block"
      style={{ width: "clamp(180px, calc((100vw - 56rem) / 2), 400px)" }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" data-testid="about-rail" />
    </div>
  );
}
