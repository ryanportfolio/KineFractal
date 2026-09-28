import { useMemo, useRef, useState } from "react";
import type { CurvePt } from "@/data/lab-data";
import { fmtPct } from "@/data/lab-data";

const W = 1000;
const H = 340;
const PAD = { t: 14, r: 8, b: 22, l: 8 };

const BENCH = "hsl(var(--beam-dim))"; // benchmark = the fainter, older signal
const fmtDate = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

// Cash-flow-adjusted cumulative return. External simulation flows are removed
// before compounding, so the two lines can be compared as percentages.
export function EquityCurve({ points, height = 340 }: { points: CurvePt[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  const { sPath, sArea, bPath, n } = useMemo(() => {
    const n = points.length;
    let min = Infinity, max = -Infinity;
    for (const p of points) {
      min = Math.min(min, p.s, p.b);
      max = Math.max(max, p.s, p.b);
    }
    const tf = (v: number) => v;
    const lo = tf(min), hi = tf(max);
    const span = hi - lo || 1;
    const px = (i: number) => PAD.l + (i / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r);
    const py = (v: number) => PAD.t + (1 - (tf(v) - lo) / span) * (H - PAD.t - PAD.b);
    const line = (sel: (p: CurvePt) => number) =>
      points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(sel(p)).toFixed(1)}`).join("");
    const sPath = line((p) => p.s);
    const bPath = line((p) => p.b);
    const base = H - PAD.b;
    const sArea = `${sPath}L${px(n - 1).toFixed(1)} ${base}L${px(0).toFixed(1)} ${base}Z`;
    return { sPath, sArea, bPath, n };
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
          <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.16" />
            <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
          <filter id="eqglow" x="-5%" y="-20%" width="110%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={sArea} fill="url(#eqfill)" />
        <path d={bPath} fill="none" stroke={BENCH} strokeWidth="1.4" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <path d={sPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.2" vectorEffect="non-scaling-stroke" filter="url(#eqglow)" />
        {curX != null && (
          <line x1={curX} y1={PAD.t} x2={curX} y2={H - PAD.b} stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* legend overlay */}
      <div className="absolute top-2 left-3 right-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] pointer-events-none">
        <span className="text-muted-foreground tabular-nums">{cur ? fmtDate(cur.t) : ""}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
          <span className="text-primary font-bold tabular-nums">{cur ? fmtPct(cur.s, 2) : ""}</span>
          <span className="text-muted-foreground">strategy</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px]" style={{ background: BENCH }} />
          <span className="tabular-nums" style={{ color: BENCH }}>{cur ? fmtPct(cur.b, 2) : ""}</span>
          <span className="text-muted-foreground">buy &amp; hold</span>
        </span>
        <span className="text-muted-foreground/60 ml-auto">cash-flow-adjusted cumulative return</span>
      </div>
    </div>
  );
}
