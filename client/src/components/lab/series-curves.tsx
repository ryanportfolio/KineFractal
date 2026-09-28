import { useMemo, useRef, useState } from "react";
import type { DdPt, InvPt } from "@/data/lab-data";

// Two more views on the same backtest the EquityCurve charts, drawn in the same
// SVG idiom (emerald glows, benchmark stays flat grey, mono legend on hover).
// Both series already ship in every /fearlab/<key>.json but were never charted.

const W = 1000;
const H = 340;
const PAD = { t: 14, r: 8, b: 22, l: 8 };
const BENCH = "hsl(var(--beam-dim))"; // benchmark = the fainter, older signal
const fmtDate = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

// ---- Drawdown / underwater -------------------------------------------------
// How far below its own running peak each line sits (always <= 0). The strategy
// spending less depth/time underwater than buy-and-hold is the story, so the
// emerald line glows; the faint red fill is the water you are under.
export function DrawdownCurve({ points, height = 300 }: { points: DdPt[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  const { sPath, sArea, bPath, lo, span, n, worst, zeroY } = useMemo(() => {
    const n = points.length;
    let min = 0;
    for (const p of points) min = Math.min(min, p.s, p.b);
    const lo = min, top = 0; // 0% at the top, deepest drawdown at the bottom
    const span = top - lo || 1;
    const px = (i: number) => PAD.l + (i / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r);
    const py = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
    const line = (sel: (p: DdPt) => number) =>
      points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(sel(p)).toFixed(1)}`).join("");
    const sPath = line((p) => p.s);
    const bPath = line((p) => p.b);
    const zeroY = py(0);
    const sArea = `${sPath}L${px(n - 1).toFixed(1)} ${zeroY.toFixed(1)}L${px(0).toFixed(1)} ${zeroY.toFixed(1)}Z`;
    let worst = 0;
    for (const p of points) worst = Math.min(worst, p.s);
    return { sPath, sArea, bPath, lo, span, n, worst, zeroY };
  }, [points]);

  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHi(Math.round(frac * (n - 1)));
  };

  const cur = hi != null ? points[hi] : points[n - 1];
  const curX = hi != null ? PAD.l + (hi / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r) : null;

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}
      onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full block">
        <defs>
          <linearGradient id="ddfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 100% 60%)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(0 100% 60%)" stopOpacity="0" />
          </linearGradient>
          <filter id="ddglow" x="-5%" y="-20%" width="110%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="hsl(0 0% 45%)" strokeOpacity="0.5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={sArea} fill="url(#ddfill)" />
        <path d={bPath} fill="none" stroke={BENCH} strokeWidth="1.4" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <path d={sPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.2" vectorEffect="non-scaling-stroke" filter="url(#ddglow)" />
        {curX != null && (
          <line x1={curX} y1={PAD.t} x2={curX} y2={H - PAD.b} stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* legend pinned to the BOTTOM: the drawdown trace hugs the 0% line at the
          top, so a bottom legend sits over the empty deep-water zone and never
          collides with the bright strategy line */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] pointer-events-none px-3 py-1.5 bg-gradient-to-t from-black/75 via-black/40 to-transparent">
        <span className="text-muted-foreground tabular-nums">{cur ? fmtDate(cur.t) : ""}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
          <span className="text-primary font-bold tabular-nums">{cur ? `${cur.s.toFixed(1)}%` : ""}</span>
          <span className="text-muted-foreground">strategy</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px]" style={{ background: BENCH }} />
          <span className="tabular-nums" style={{ color: BENCH }}>{cur ? `${cur.b.toFixed(1)}%` : ""}</span>
          <span className="text-muted-foreground">buy &amp; hold</span>
        </span>
        <span className="tabular-nums text-muted-foreground ml-auto">deepest <span className="text-foreground font-bold">{worst.toFixed(1)}%</span></span>
      </div>
    </div>
  );
}

// ---- Invested / exposure ---------------------------------------------------
// Percent of capital actually deployed over time (0 = all cash, ~100 = fully
// in). Amber is the site's accent for exposure/risk-on. Buys fear, trims
// strength, so the line breathes; plain buy-and-hold would be a flat 100%.
export function InvestedCurve({ points, height = 240 }: { points: InvPt[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  const { path, area, top, n, avg } = useMemo(() => {
    const n = points.length;
    let max = 0, sum = 0;
    for (const p of points) { max = Math.max(max, p.v); sum += p.v; }
    const top = Math.max(100, Math.ceil(max / 10) * 10);
    const px = (i: number) => PAD.l + (i / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r);
    const py = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
    const path = points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(p.v).toFixed(1)}`).join("");
    const base = H - PAD.b;
    const area = `${path}L${px(n - 1).toFixed(1)} ${base}L${px(0).toFixed(1)} ${base}Z`;
    return { path, area, top, n, avg: n ? sum / n : 0 };
  }, [points]);

  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHi(Math.round(frac * (n - 1)));
  };

  const cur = hi != null ? points[hi] : points[n - 1];
  const curX = hi != null ? PAD.l + (hi / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r) : null;

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}
      onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full block">
        <defs>
          <linearGradient id="invfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.26" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          </linearGradient>
          <filter id="invglow" x="-5%" y="-20%" width="110%" height="140%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={area} fill="url(#invfill)" />
        <path d={path} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.2" vectorEffect="non-scaling-stroke" filter="url(#invglow)" />
        {curX != null && (
          <line x1={curX} y1={PAD.t} x2={curX} y2={H - PAD.b} stroke="hsl(var(--accent))" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div className="absolute top-0 left-0 right-0 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] pointer-events-none px-3 py-1.5 bg-gradient-to-b from-black/75 via-black/40 to-transparent">
        <span className="text-muted-foreground tabular-nums">{cur ? fmtDate(cur.t) : ""}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.8)]" />
          <span className="text-accent font-bold tabular-nums">{cur ? `${cur.v.toFixed(0)}%` : ""}</span>
          <span className="text-muted-foreground">invested</span>
        </span>
        <span className="tabular-nums text-muted-foreground ml-auto">avg <span className="text-foreground font-bold">{avg.toFixed(0)}%</span></span>
      </div>
    </div>
  );
}
