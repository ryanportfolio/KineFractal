// StorageSweep — movement 3: 33 YEARS IN 60 SECONDS.
//
// The replay cast (902 real SPY fills, 1993→2026) as one continuous beam
// performance on a storage scope. Long tau: the whole history accumulates as
// an unbroken phosphor line while a ghost beam dashes the benchmark beneath.
// Every real entry blooms the beam and drops an amber tick into the fill lane
// (by 2026 the lane is a dense, honest barcode). While equity sits below its
// running peak, tau drops — 2008 makes the phosphor itself fade — and crash
// years strain the sweep to 0.45x. Sticky inside a 190vh wrapper: the page
// never hijacks scroll.
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { createPersistenceEngine } from "@/components/persistence-engine";
import { BeamHeading } from "@/components/beam-heading";
import { DecodeText } from "@/components/decode-text";
import { useBeam } from "@/hooks/use-beam";
import { ENGINE_VARIANT } from "@/data/lab-data";

const DUR = 60; // seconds, full history
const CRASH_YEARS = new Set([2000, 2001, 2002, 2008, 2020, 2022]);

// plot frame (normalized, y down)
const X0 = 0.05, X1 = 0.95;
const Y0 = 0.16, Y1 = 0.72;
const LANE0 = 0.8, LANE1 = 0.855;

type Cast = {
  years: [number, number, number, number, number][];
  fills: [number, number, string, string, number, number, number, number][];
  equity: [number, number, number][];
  metrics?: Record<string, unknown>;
};

const fmtMoney = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}k` : `$${v.toFixed(0)}`;

export function StorageSweep() {
  const { ref: sectionRef, phase } = useBeam<HTMLElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const yearRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const playTRef = useRef(0);
  const [cast, setCast] = useState<Cast | null>(null);
  const castRef = useRef<Cast | null>(null);
  const [logRows, setLogRows] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [noGL, setNoGL] = useState(false);
  const ctlRef = useRef({ playing: true, speed: 1, seek: -1, restart: false });
  ctlRef.current.playing = playing;
  ctlRef.current.speed = speed;

  useEffect(() => {
    let live = true;
    fetch(`/fearlab/casts/spy-1d-${ENGINE_VARIANT}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("cast missing"))))
      .then((c: Cast) => {
        if (!live) return;
        castRef.current = c;
        setCast(c);
      })
      .catch(() => {
        /* cast offline — section still shows the plaque copy */
      });
    return () => {
      live = false;
    };
  }, []);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ---- playback state ----------------------------------------------------
    let playT = 0;
    let fillIdx = 0;
    let exitIdx = 0;
    let peak = -Infinity;
    let lastYear = 0;
    let finished = false;
    const syncSlider = (yr: number) => {
      sliderRef.current?.setAttribute("aria-valuenow", String(yr));
    };
    let exits: { t: number; fx: number }[] = [];
    let fills: Cast["fills"] = [];
    let range: { t0: number; t1: number; lo: number; span: number } | null = null;

    const prep = (c: Cast) => {
      const t0 = c.equity[0][0];
      const t1 = c.equity[c.equity.length - 1][0];
      let lo = Infinity, hi = -Infinity;
      for (const [, s, b] of c.equity) {
        lo = Math.min(lo, s, b);
        hi = Math.max(hi, s, b);
      }
      const l = Math.log10(Math.max(lo, 1));
      const h = Math.log10(Math.max(hi, 10));
      range = { t0, t1, lo: l, span: h - l || 1 };
      // the cast ships fills sorted by EXIT ts; both event streams here need
      // their own chronological order
      fills = [...c.fills].sort((a, b) => a[0] - b[0]);
      exits = c.fills
        .map((f) => ({ t: f[1], fx: (f[1] - t0) / (t1 - t0) }))
        .filter((e) => e.fx > 0 && e.fx <= 1)
        .sort((a, b) => a.t - b.t);
    };

    const fx = (ts: number) => (range ? (ts - range.t0) / (range.t1 - range.t0) : 0);
    const px = (f: number) => X0 + f * (X1 - X0);
    const eqAt = (f: number, sel: 1 | 2): number => {
      const c = castRef.current!;
      const p = f * (c.equity.length - 1);
      const i = Math.floor(p);
      const fr = p - i;
      const a = c.equity[i][sel];
      const b = c.equity[Math.min(i + 1, c.equity.length - 1)][sel];
      const v = a * (1 - fr) + b * fr;
      return Y1 - ((Math.log10(Math.max(v, 1)) - range!.lo) / range!.span) * (Y1 - Y0);
    };
    const yearAt = (f: number) =>
      new Date((range!.t0 + f * (range!.t1 - range!.t0)) * 1000).getUTCFullYear();

    const engine = createPersistenceEngine(canvas, {
      tau: 16,
      cursorLens: true,
      onFrame: (api, _t, dt) => {
        const c = castRef.current;
        if (!c || c.equity.length < 2) return;
        if (!range) prep(c);

        // seek / restart requests from the ruler
        const ctl = ctlRef.current;
        if (ctl.restart) {
          ctl.restart = false;
          finished = false;
          setDone(false);
          ctl.seek = 0;
        }
        if (ctl.seek >= 0) {
          const target = ctl.seek;
          ctl.seek = -1;
          engine.clear();
          // redraw held history up to the seek point in one frame
          const steps = Math.max(2, Math.floor(target * 420));
          const sPts: number[] = [];
          const bPts: number[] = [];
          api.setTau(60);
          for (let i = 0; i <= steps; i++) {
            const f = (i / steps) * target;
            sPts.push(px(f), eqAt(f, 1));
            // same parity dashing as live playback, so a seeked benchmark
            // still reads as the older, dashed signal
            if (Math.floor(f * 240) % 2 === 0) bPts.push(px(f), eqAt(f, 2));
            else {
              if (bPts.length >= 4) api.path(bPts, { energy: 0.1, width: 1.4 });
              bPts.length = 0;
            }
          }
          if (sPts.length >= 4) api.path(sPts, { energy: 0.3, width: 1.8 });
          if (bPts.length >= 4) api.path(bPts, { energy: 0.1, width: 1.4 });
          fillIdx = 0;
          exitIdx = 0;
          for (const f of fills) {
            if (fx(f[0]) > target) break;
            const x = px(fx(f[0]));
            api.path([x, LANE0, x, LANE1], { energy: 0.28, width: 0.7, accent: true });
            fillIdx++;
          }
          while (exitIdx < exits.length && exits[exitIdx].fx <= target) exitIdx++;
          peak = -Infinity;
          for (let i = 0; i <= steps; i++) {
            const f = (i / steps) * target;
            peak = Math.max(peak, eqAt(f, 1) * -1);
          }
          playT = target;
          playTRef.current = target;
          lastYear = yearAt(Math.min(target, 1));
          if (yearRef.current) yearRef.current.textContent = String(lastYear);
          syncSlider(lastYear);
          finished = target >= 1;
          if (finished) setDone(true);
        }

        if (finished || !ctl.playing) {
          api.setTau(999); // hold the picture between frames
          return;
        }

        // strain: crash years run at 0.45x
        const yr = yearAt(Math.min(playT, 1));
        const strain = CRASH_YEARS.has(yr) ? 0.45 : 1;
        const prevT = playT;
        playT = Math.min(1, playT + (dt * ctl.speed * strain) / DUR);
        playTRef.current = playT;

        // year counter + yearly log (React state only on year flips)
        if (yr !== lastYear) {
          lastYear = yr;
          if (yearRef.current) yearRef.current.textContent = String(yr);
          syncSlider(yr);
          const row = c.years.find((y) => y[0] === yr - 1);
          if (row) {
            const [y, s, b] = row;
            const line = `${y} · ${s >= 0 ? "+" : ""}${s.toFixed(1)}% vs ${b >= 0 ? "+" : ""}${b.toFixed(1)}%`;
            setLogRows((prev) => [...prev.slice(-2), line]);
          }
          if (CRASH_YEARS.has(yr)) api.flash(0.82);
        }

        // drawdown physics: below the running peak the phosphor forgets faster
        const yNow = eqAt(playT, 1);
        peak = Math.max(peak, -yNow); // y down: higher equity = smaller y
        const inDrawdown = -yNow < peak - 0.004;
        api.setTau(inDrawdown ? 2.5 : 90);

        // the beams advance
        const density = Math.min(900, api.size().w * 1.1);
        const steps = Math.max(1, Math.ceil((playT - prevT) * density));
        const sPts: number[] = [];
        for (let i = 0; i <= steps; i++) {
          const f = prevT + ((playT - prevT) * i) / steps;
          sPts.push(px(f), eqAt(f, 1));
        }
        if (sPts.length >= 4) api.path(sPts, { energy: 0.3, width: 2.0 });
        // benchmark ghost: dashed by depositing alternating slices
        const bPts: number[] = [];
        for (let i = 0; i <= steps; i++) {
          const f = prevT + ((playT - prevT) * i) / steps;
          if (Math.floor(f * 240) % 2 === 0) bPts.push(px(f), eqAt(f, 2));
          else if (bPts.length >= 4) {
            api.path(bPts, { energy: 0.12, width: 1.5 });
            bPts.length = 0;
          } else bPts.length = 0;
        }
        if (bPts.length >= 4) api.path(bPts, { energy: 0.12, width: 1.5 });
        api.spot(px(playT), yNow, 0.7, 2.6);

        // real fills fire as they happened
        while (fillIdx < fills.length && fx(fills[fillIdx][0]) <= playT) {
          const f = fills[fillIdx];
          const xf = Math.max(0, Math.min(1, fx(f[0])));
          const x = px(xf);
          api.spot(x, eqAt(xf, 1), 1.15, 2.9); // bloom on the curve
          api.path([x, LANE0, x, LANE1], { energy: 0.4, width: 0.7, accent: true });
          fillIdx++;
        }
        while (exitIdx < exits.length && exits[exitIdx].fx <= playT) {
          const e = exits[exitIdx];
          api.spot(px(e.fx), eqAt(e.fx, 1), 0.3, 2.2);
          exitIdx++;
        }

        if (playT >= 1 && !finished) {
          finished = true;
          setDone(true);
        }
      },
    });

    if (!engine.ok) {
      setNoGL(true);
      return () => engine.destroy();
    }

    // beam grants drive the loop
    let granted = false;
    const tick = setInterval(() => {
      const p = phaseRef.current;
      if (p === "drawing" && !granted) {
        granted = true;
        engine.start();
      } else if (p !== "drawing" && granted) {
        granted = false;
        engine.stop();
      }
    }, 120);

    return () => {
      clearInterval(tick);
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seekTo = (f: number) => {
    ctlRef.current.seek = Math.max(0, Math.min(1, f));
    setDone(f >= 1);
  };

  const years = cast?.years ?? [];
  const firstYear = years.length ? years[0][0] : 1993;
  const lastYr = years.length ? years[years.length - 1][0] : 2026;
  const lastEq = cast?.equity?.length ? cast.equity[cast.equity.length - 1] : null;
  const finalS = lastEq ? lastEq[1] : null;
  const finalB = lastEq ? lastEq[2] : null;

  return (
    <section
      ref={sectionRef}
      id="sweep"
      className="relative h-[190svh] scroll-mt-16"
      aria-label="Thirty-three years of real SPY trades replayed in sixty seconds"
    >
      <p className="sr-only">
        The real SPY daily strategy replayed from 1993 to 2026: every one of the 902 recorded
        fills fires as it happened, accumulating on a storage oscilloscope.
        {finalS != null && finalB != null
          ? ` Final result: ${fmtMoney(finalS)} for the strategy versus ${fmtMoney(finalB)} for buy and hold on the same deposits.`
          : ""}
      </p>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute inset-0 graticule opacity-30" aria-hidden="true" />
        {noGL ? (
          <NoGLSweep cast={cast} />
        ) : (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block"
            data-testid="storage-sweep"
            aria-hidden="true"
          />
        )}

        {/* HUD */}
        <div className="relative z-10 h-full flex flex-col px-5 md:px-10 pt-20 pb-6 max-w-7xl mx-auto pointer-events-none">
          <div className="flex items-start justify-between gap-6">
            <div className="max-w-[900px]">
              <BeamHeading
                text="33 YEARS IN 60 SECONDS"
                as="h2"
                active={phase !== "dark"}
                instant={phase === "held"}
              />
              <p className="etched mt-3">
                <DecodeText
                  text="spy · daily · every closed trade replayed as it happened · storage mode"
                  active={phase !== "dark"}
                  instant={phase === "held"}
                />
              </p>
              <div className="mt-4 space-y-1" aria-hidden="true">
                {logRows.map((r) => (
                  <div key={r} className="etched tabular-nums text-beam-dim">
                    {r}
                  </div>
                ))}
              </div>
            </div>
            <div
              ref={yearRef}
              className="font-mono font-semibold text-beam-mid tabular-nums text-5xl md:text-7xl leading-none select-none"
              aria-hidden="true"
            >
              {firstYear}
            </div>
          </div>

          {/* end plaque — parked below the year counter, clear of the trace */}
          {done && finalS != null && finalB != null && (
            <div className="absolute right-5 md:right-10 top-[38%] text-right pointer-events-auto">
              <div className="font-mono text-xl md:text-2xl text-beam-hot tabular-nums">
                {fmtMoney(finalS)}
              </div>
              <div className="font-mono text-base text-beam-dim tabular-nums">
                vs {fmtMoney(finalB)} hold
              </div>
              <p className="etched mt-2">
                every fill is real ·{" "}
                <Link href={`/lab/spy-1d-full-${ENGINE_VARIANT}`} className="text-beam-mid hover:text-beam-hot transition-colors">
                  open the ledger →
                </Link>
              </p>
            </div>
          )}

          {/* transport — meaningless without a live playback, so it only
              renders when one exists */}
          {!noGL && (
            <div className="mt-auto pointer-events-auto">
              <div className="flex items-center gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => (done ? (ctlRef.current.restart = true) : setPlaying((p) => !p))}
                  className="etched border border-beam-ghost px-3 py-1.5 hover:border-beam-dim hover:text-beam-mid transition-colors"
                >
                  {done ? "replay" : playing ? "pause" : "play"}
                </button>
                <button
                  type="button"
                  onClick={() => setSpeed((s) => (s === 1 ? 4 : 1))}
                  className="etched border border-beam-ghost px-3 py-1.5 hover:border-beam-dim hover:text-beam-mid transition-colors"
                  aria-pressed={speed === 4}
                >
                  {speed}×
                </button>
                <span className="etched text-beam-dim hidden sm:inline">
                  fill lane below · amber tick = real buy
                </span>
              </div>
              {/* year ruler — labels sit in plot space (X0..X1); clicks invert
                  the same mapping so a click on a year seeks to that year */}
              <div
                ref={sliderRef}
                className="relative h-8 border-t border-beam-ghost/70 flex cursor-pointer select-none"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const frac = (e.clientX - r.left) / r.width;
                  seekTo((frac - X0) / (X1 - X0));
                }}
                role="slider"
                aria-label="Replay position, year"
                aria-valuemin={firstYear}
                aria-valuemax={lastYr}
                aria-valuenow={firstYear}
                tabIndex={0}
                onKeyDown={(e) => {
                  const yearStep = 1 / Math.max(1, lastYr - firstYear);
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    seekTo(Math.min(1, playTRef.current + yearStep));
                  }
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    seekTo(Math.max(0, playTRef.current - yearStep));
                  }
                  if (e.key === "Home") seekTo(0);
                  if (e.key === "End") seekTo(1);
                }}
              >
                {years
                  .filter((y) => y[0] % 5 === 0 || y[0] === firstYear)
                  .map((y) => {
                    const f = (y[0] - firstYear) / Math.max(1, lastYr - firstYear);
                    return (
                      <span
                        key={y[0]}
                        className="etched absolute top-1.5 -translate-x-1/2 text-beam-dim pointer-events-none"
                        style={{ left: `${(X0 + f * (X1 - X0)) * 100}%` }}
                      >
                        {y[0]}
                      </span>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Static SVG fallback — same real data, no playback. */
function NoGLSweep({ cast }: { cast: Cast | null }) {
  if (!cast || !cast.equity || cast.equity.length < 2) return null;
  let lo = Infinity, hi = -Infinity;
  for (const [, s, b] of cast.equity) {
    lo = Math.min(lo, s, b);
    hi = Math.max(hi, s, b);
  }
  const l = Math.log10(Math.max(lo, 1));
  const span = Math.log10(Math.max(hi, 10)) - l || 1;
  const t0 = cast.equity[0][0];
  const t1 = cast.equity[cast.equity.length - 1][0];
  const path = (sel: 1 | 2) =>
    cast.equity
      .map((p, i) => {
        const x = 5 + ((p[0] - t0) / (t1 - t0)) * 90;
        const y = 72 - ((Math.log10(Math.max(p[sel], 1)) - l) / span) * 56;
        return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join("");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      <path d={path(2)} fill="none" stroke="hsl(var(--beam-dim))" strokeWidth="0.25" strokeDasharray="1 0.8" />
      <path d={path(1)} fill="none" stroke="hsl(var(--beam-hot))" strokeWidth="0.4" />
      {cast.fills.map((f, i) => {
        const x = 5 + ((f[0] - t0) / (t1 - t0)) * 90;
        return x >= 5 && x <= 95 ? (
          <line key={i} x1={x} y1={80} x2={x} y2={85.5} stroke="hsl(var(--accent))" strokeWidth="0.08" />
        ) : null;
      })}
    </svg>
  );
}
