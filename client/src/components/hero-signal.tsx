// HeroSignal — movement 1: IGNITION.
//
// One beam ignites at center, weaves the brand Lissajous (a 3:2 figure whose
// phase literally holds today's SPY fear percentile), decoheres, then sweeps
// the REAL SPY return history (interval deltas of spy-1d-2007's benchmark
// curve) as a live scope channel — a two-sided signal swinging above and
// below the baseline. The wordmark traces itself above the waveform; one
// typed sentence; three live channel readouts. No buttons — the first scroll
// is the commitment.
//
// First visit: full ~4s sequence, skippable by scroll/keypress. Return visits
// (sessionStorage kf_ignited): straight to steady state. Reduced motion: one
// static frame, everything visible.
import { useEffect, useRef, useState } from "react";
import { createPersistenceEngine, type EngineApi } from "@/components/persistence-engine";
import { CodeRain } from "@/components/code-rain";
import { KfLogo } from "@/components/kf-logo";
import { useFearState } from "@/hooks/use-fear-state";
import { fetchReportCached } from "@/data/lab-data";
import { DEPLOY } from "@/data/fearlab-board";
import {
  acquisitionDuration,
  acquisitionProgress,
} from "@/lib/hero-signal-acquisition";
import { intervalReturnFromCumulativePct } from "@/lib/hero-return-model";

// the flagship full-history report — the hero sweeps its ENTIRE window
const SPY_REPORT = DEPLOY.find((d) => d.sym === "SPY")!.reportKey;

// The report curve is a ~400-sample polyline of the whole 33-year window. On
// a desktop tube that's ~3.5px per swing; on a phone it's ~1px — every swing
// lands on its neighbor and the trace reads as solid fuzz. Narrow viewports
// sweep the recent ~120 samples (≈ the last decade) instead, rescaled to that
// window, which restores desktop's px-per-swing. (Window chosen at data load;
// a later resize across the breakpoint keeps the loaded trace — acceptable
// for a rotation.)
const MOBILE_RET_WINDOW = 120;
const narrowTube = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

// sequence timings (ms)
const T_LISS = 700;
const T_DECOHERE = 2100;
const T_SWEEP = 2900;
const T_WORD = 2400;
const T_LINE = 3200;
const SWEEP_S = 9; // seconds per full sweep of the drawdown history

const TAGLINE = `buys fear in SPY, QQQ and IWM → trims into strength`;

function TypedLine({
  text,
  active,
  highlight,
}: {
  text: string;
  active: boolean;
  /** word to sweep with the hl-mark highlighter once typing lands */
  highlight?: string;
}) {
  const [n, setN] = useState(active ? 0 : -1);
  const [marked, setMarked] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    let i = 0;
    const iv = setInterval(() => {
      i += 2; // chunked, terminal cadence
      setN(Math.min(i, text.length));
      if (i >= text.length) clearInterval(iv);
    }, 28);
    return () => clearInterval(iv);
  }, [active, text]);
  const done = n >= text.length;
  // the highlighter sweeps one beat after the sentence lands
  useEffect(() => {
    if (!done || marked) return;
    const t = setTimeout(() => setMarked(true), 60);
    return () => clearTimeout(t);
  }, [done, marked]);
  const shown = n < 0 ? "" : text.slice(0, n);
  const hi = highlight ? text.indexOf(highlight) : -1;
  return (
    <p className="font-mono text-[15px] md:text-[17px] leading-relaxed text-beam-mid min-h-[1.6em]">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {done && hi >= 0 && highlight ? (
          <>
            {text.slice(0, hi)}
            <span className={`hl-mark ${marked ? "on" : ""}`}>{highlight}</span>
            {text.slice(hi + highlight.length)}
          </>
        ) : (
          shown
        )}
        {active && !done && <span className="beam-caret ml-0.5" />}
      </span>
    </p>
  );
}

export function HeroSignal() {
  const fear = useFearState();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const ddRef = useRef<Float32Array | null>(null); // normalized drawdown polyline ys
  const [noGL, setNoGL] = useState(false);

  const returning = useRef<boolean>(
    (() => {
      try {
        return sessionStorage.getItem("kf_ignited") === "1";
      } catch {
        return false;
      }
    })(),
  );
  const instant = returning.current;

  const [wordOn, setWordOn] = useState(instant);
  const [lineOn, setLineOn] = useState(instant);
  const skipRef = useRef(instant);

  // phase from today's real SPY fear percentile — the brand mark holds the day
  const spy = fear.funds.find((f) => f.sym === "SPY") ?? fear.hottest;
  const phiRef = useRef(0);
  phiRef.current = ((spy?.nowPct ?? 50) / 100) * Math.PI;

  // real interval returns of the SPY benchmark curve — a genuine two-sided
  // signal (up-swings cross above the baseline, panics plunge below), unlike
  // the drawdown series which pins at zero and reads as a ceiling
  useEffect(() => {
    let live = true;
    fetchReportCached(SPY_REPORT)
      .then((r) => {
        if (!live || !r.curve || r.curve.length < 3) return;
        const src = r.curve;
        const full = new Float32Array(src.length - 1);
        for (let i = 1; i < src.length; i++) {
          full[i - 1] = intervalReturnFromCumulativePct(src[i - 1].b, src[i].b) ?? 0;
        }
        // phones sweep the recent window only — see MOBILE_RET_WINDOW
        const rets = narrowTube() && full.length > MOBILE_RET_WINDOW
          ? full.slice(-MOBILE_RET_WINDOW)
          : full;
        // robust scale: normalize to the 98th percentile swing and let the
        // true panics clip at full deflection — otherwise 2008 alone sets
        // the scale and every ordinary week flattens into a ribbon
        const mags = Array.from(rets, Math.abs).sort((a, b) => a - b);
        const p98 = mags[Math.floor(0.98 * (mags.length - 1))];
        if (!p98 || p98 < 1e-6) return; // flat feed — keep the dark tube
        const div = p98 * 1.35;
        for (let i = 0; i < rets.length; i++) {
          rets[i] = Math.max(-1, Math.min(1, rets[i] / div));
        }
        ddRef.current = rets;
      })
      .catch(() => {
        /* feed offline — beam keeps the baseline; readouts note nothing false */
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    // plot frame inside the canvas (normalized). The baseline is a center
    // line, not a ceiling — returns swing above it and crash below it.
    const BASE = 0.72; // center y of the sweep — the lower third, clear of the centered mark
    const DEPTH = 0.13; // half-scale swing amplitude (each direction)
    // full-bleed sweep with a hair of overscan: the endpoints sit just past
    // the glass so the trace enters and exits mid-stroke — no fade-in gutter
    const X0 = -0.015,
      X1 = 1.015;

    const ddY = (fx: number): number => {
      const ys = ddRef.current;
      if (!ys || ys.length < 2) return BASE;
      const p = fx * (ys.length - 1);
      const i = Math.floor(p);
      const f = p - i;
      const v = ys[i] * (1 - f) + ys[Math.min(i + 1, ys.length - 1)] * f;
      return BASE - v * DEPTH; // positive return = above the line
    };

    let seqStart: number | null = null;
    let u = 0; // beam parameter
    let lastPt: [number, number] | null = null;
    let bedSeeded = false; // full-history bed completed by the acquisition pass
    let bedFrame = 0;
    let acquisitionStart: number | null = null;
    let acquiredTo = 0;
    let acquisitionDone = false;

    // the persistent bed: the ENTIRE history stays lit edge to edge while the
    // comet sweeps on top — without it the tube is dark ahead of the beam and
    // the trace reads as cut off mid-screen. A dim full-width pass every few
    // frames balances against phosphor decay at a steady low glow (periodic
    // deposits also survive 8-bit buffers where per-frame sub-LSB energy dies).
    const depositBed = (
      api: EngineApi,
      energy: number,
      from = 0,
      to = 1,
    ) => {
      if (!ddRef.current) return;
      const start = Math.max(0, Math.min(1, from));
      const end = Math.max(start, Math.min(1, to));
      if (end <= start) return;
      const steps = Math.max(1, Math.ceil((end - start) * 300));
      const pts: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const f = start + ((end - start) * i) / steps;
        pts.push(X0 + f * (X1 - X0), ddY(f));
      }
      api.path(pts, { energy, width: 1.5 });
    };

    const engine = createPersistenceEngine(canvas, {
      tau: 0.5,
      cursorLens: true,
      lensHost: section, // the content column overlays the canvas; the lens
      // should follow the pointer across the whole hero
      onFrame: (api, t, dt) => {
        if (seqStart === null) seqStart = t;
        const el = skipRef.current ? T_SWEEP + 1 + (t - seqStart) * 1000 : (t - seqStart) * 1000;

        if (el < T_LISS) {
          // ignition: the spot blooms at center
          const k = el / T_LISS;
          const w = 2 + Math.sin(k * Math.PI) * 9;
          api.spot(0.5, 0.42, 1, w);
          return;
        }
        if (el < T_DECOHERE) {
          // XY mode — 3:2 Lissajous, phase = today's fear
          api.setTau(0.55);
          const du = dt / 1.15;
          const steps = Math.max(1, Math.ceil(du * 160));
          const pts: number[] = [];
          for (let s = 0; s <= steps; s++) {
            const th = (u + (du * s) / steps) * Math.PI * 2;
            pts.push(
              0.5 + 0.26 * Math.sin(3 * th + phiRef.current),
              0.42 + 0.2 * Math.sin(2 * th),
            );
          }
          u += du;
          api.path(pts, { energy: 0.85, width: 2.1 });
          api.spot(pts[pts.length - 2], pts[pts.length - 1], 1, 2.8);
          return;
        }
        if (el < T_SWEEP) {
          // decohere: the figure's vertical amplitude collapses to the baseline
          const k = (el - T_DECOHERE) / (T_SWEEP - T_DECOHERE);
          const du = dt / (1.15 - k * 0.8);
          const steps = Math.max(1, Math.ceil(du * 160));
          const pts: number[] = [];
          const amp = 0.2 * (1 - k) * (1 - k);
          for (let s = 0; s <= steps; s++) {
            const th = (u + (du * s) / steps) * Math.PI * 2;
            pts.push(
              0.5 + 0.26 * Math.sin(3 * th + phiRef.current + k * 4),
              BASE - 0.02 + amp * Math.sin(2 * th),
            );
          }
          u += du;
          api.path(pts, { energy: 0.8, width: 2.1 });
          lastPt = null;
          return;
        }

        // steady state: the full history held as a dim bed edge to edge, the
        // hot comet re-tracing it — immersive full-screen signal, never a
        // trace that stops mid-tube
        api.setTau(2.2);
        if (ddRef.current && !acquisitionDone) {
          if (acquisitionStart === null) acquisitionStart = el;
          const progress = acquisitionProgress(
            el - acquisitionStart,
            acquisitionDuration(returning.current),
          );
          depositBed(api, 0.28, acquiredTo, progress);
          const headX = X0 + progress * (X1 - X0);
          api.spot(headX, ddY(progress), 0.72, 2.6);
          acquiredTo = progress;
          if (progress < 1) return;
          acquisitionDone = true;
          bedSeeded = true;
          bedFrame = 0;
          lastPt = null;
        }
        if (ddRef.current) {
          if (!bedSeeded) {
            return; // acquisition owns the first full-width illumination
          } else if (++bedFrame % 10 === 0) {
            depositBed(api, 0.02); // maintenance: decay equilibrium ≈ dim-mid glow
          }
        }
        const sweepT = ((el - T_SWEEP) / 1000) % SWEEP_S;
        const fx = sweepT / SWEEP_S;
        const prevFx = lastPt ? (lastPt[0] - X0) / (X1 - X0) : fx;
        if (fx > prevFx) {
          // trace the REAL polyline between frames, not a straight shortcut —
          // sub-sample the data so every spike keeps its true shape (density
          // tied to canvas width so narrow tubes don't overdraw into blobs)
          const density = Math.min(900, api.size().w * 1.1);
          const steps = Math.max(1, Math.ceil((fx - prevFx) * density));
          const pts: number[] = [];
          for (let i = 0; i <= steps; i++) {
            const f = prevFx + ((fx - prevFx) * i) / steps;
            pts.push(X0 + f * (X1 - X0), ddY(f));
          }
          // adjacent subsample gaussians overlap ~4x — keep the summed deposit
          // just under saturation so the trace cools visibly behind the beam
          api.path(pts, { energy: 0.16, width: 1.55 });
        }
        const x = X0 + fx * (X1 - X0);
        const y = ddY(fx);
        api.spot(x, y, 0.5, 2.2);
        lastPt = [x, y];
        if (fx < 0.002) lastPt = null; // wrap
      },
    });

    if (!engine.ok) {
      setNoGL(true);
      return () => engine.destroy();
    }

    engine.start(); // hero owns the beam on load; scheduler not needed here —
    // the engine self-pauses via visibility; on scroll past, IO below stops it.
    // Yield early (15% visibility) so the beam never runs two tubes at once
    // while the next movement draws.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.15) engine.start();
        else engine.stop();
      },
      { threshold: [0, 0.15, 0.5] },
    );
    io.observe(canvas);

    // skip the ceremony on first interaction
    const skip = () => {
      if (!skipRef.current) {
        skipRef.current = true;
        setWordOn(true);
        setLineOn(true);
      }
    };
    window.addEventListener("wheel", skip, { passive: true, once: true });
    window.addEventListener("touchstart", skip, { passive: true, once: true });
    window.addEventListener("keydown", skip, { once: true });

    // DOM reveals riding the same clock
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!instant) {
      timers.push(setTimeout(() => setWordOn(true), T_WORD));
      timers.push(setTimeout(() => setLineOn(true), T_LINE));
      timers.push(
        setTimeout(() => {
          try {
            sessionStorage.setItem("kf_ignited", "1");
          } catch {
            /* private mode — sequence just replays next visit */
          }
        }, T_LINE + 900),
      );
    }

    return () => {
      io.disconnect();
      for (const t of timers) clearTimeout(t);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
      window.removeEventListener("keydown", skip);
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100svh] overflow-hidden"
      aria-label="Kine Fractal: buys fear in SPY, QQQ and IWM, trims into strength"
    >
      {/* graticule bed */}
      <div className="absolute inset-0 graticule opacity-40" aria-hidden="true" />
      {/* the engine's own source drifting down the tube — real code as texture.
          Skipped on phones: the corpus lines run up to ~660px wide, so a 375px
          tube clips every statement mid-read (the whole point is legibility)
          and the second canvas just burns battery under the WebGL beam. */}
      {!narrowTube() && (
        <div className="absolute inset-0 opacity-60" aria-hidden="true">
          <CodeRain />
        </div>
      )}
      {/* the beam */}
      <div className="absolute inset-0" aria-hidden="true">
        {noGL ? (
          <NoGLTrace />
        ) : (
          <canvas ref={canvasRef} className="block w-full h-full" data-testid="hero-signal" />
        )}
      </div>

      {/* the mark + tagline — dead center, the composition's focal point; the
          full-width trace runs beneath it and the readouts pin the corners */}
      <div className="relative z-10 flex flex-col min-h-[100svh] px-5 md:px-10 pt-20 pb-10">
        <div className="flex flex-col items-center text-center mt-[3vh]">
          <h1 className="sr-only">KINE FRACTAL</h1>
          <div
            style={{
              // vh divided by --pz: viewport units don't shrink under the
              // desktop CSS zoom, so the mark compensates to keep screen fit
              width: "clamp(170px, calc(26vh / var(--pz, 1)), 260px)",
              height: "clamp(170px, calc(26vh / var(--pz, 1)), 260px)",
            }}
            aria-hidden="true"
          >
            {wordOn && <KfLogo animate revealFx />}
          </div>
          <div className="mt-5 max-w-[620px]">
            <TypedLine text={TAGLINE} active={lineOn} highlight="fear" />
          </div>
        </div>

        <div className="mt-auto" aria-hidden="true" />
      </div>
    </section>
  );
}

/** Static fallback when WebGL2 is unavailable — same data, one SVG trace. */
function NoGLTrace() {
  const [d, setD] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchReportCached(SPY_REPORT)
      .then((r) => {
        if (!live || !r.curve || r.curve.length < 3) return;
        let rets: number[] = [];
        for (let i = 1; i < r.curve.length; i++) {
          rets.push(intervalReturnFromCumulativePct(r.curve[i - 1].b, r.curve[i].b) ?? 0);
        }
        // same mobile window as the live tube
        if (narrowTube() && rets.length > MOBILE_RET_WINDOW) rets = rets.slice(-MOBILE_RET_WINDOW);
        const mags = rets.map(Math.abs).sort((a, b) => a - b);
        const p98 = mags[Math.floor(0.98 * (mags.length - 1))];
        if (!p98 || p98 < 1e-6) return;
        const div = p98 * 1.35;
        const pts = rets.map((v, i) => {
          const x = (i / (rets.length - 1)) * 100;
          const y = 72 - Math.max(-1, Math.min(1, v / div)) * 17;
          return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
        });
        setD(pts.join(""));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="hero-signal-fallback-in w-full h-full"
    >
      <path d={d} fill="none" stroke="hsl(var(--beam-hot))" strokeWidth="0.35" />
    </svg>
  );
}
