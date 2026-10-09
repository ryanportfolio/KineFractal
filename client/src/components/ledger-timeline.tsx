// LedgerTimeline: the recent simulated SPY fills on a date axis. One tick per
// fill; buys rise from the zero line, sells drop below it, and tick height is
// the simulated order size as a percent of the simulated account (axis fixed
// at 100% of account). Ticks draw in once when the section holds the beam and
// settle instantly when it is held.
import { useEffect, useRef, useState } from "react";
import type { RecentRow } from "@/data/lab-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400;
const LABELLED = 3;

const utcMonthStart = (ts: number, add = 0) => {
  const d = new Date(ts * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + add, 1) / 1000;
};

export function LedgerTimeline({ rows, drawn, instant }: { rows: RecentRow[]; drawn: boolean; instant: boolean }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // grow on the frame after the zero-height ticks paint, so the transition runs
  useEffect(() => {
    if (!drawn || grown || !width) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setGrown(true)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [drawn, grown, width]);

  const fills = rows.filter((row) => row.account_pct != null && Number.isFinite(row.account_pct));
  const narrow = width > 0 && width < 520;
  const height = narrow ? 168 : 192;
  const padL = narrow ? 36 : 46;
  const padR = 10;
  const padT = 26;
  const padB = 40;
  const mid = padT + (height - padT - padB) / 2;
  const half = (height - padT - padB) / 2;

  const t0 = fills.length ? utcMonthStart(Math.min(...fills.map((row) => row.ts))) : 0;
  const t1 = fills.length ? Math.max(...fills.map((row) => row.ts)) + 6 * DAY : 1;
  const x = (ts: number) => padL + ((ts - t0) / Math.max(DAY, t1 - t0)) * (width - padL - padR);

  const months: { ts: number; label: string }[] = [];
  for (let m = t0, i = 0; m <= t1 && i < 36; m = utcMonthStart(m, 1), i++) {
    const d = new Date(m * 1000);
    // narrow: month only (the year range is in the line above the chart)
    months.push({ ts: m, label: narrow ? MONTHS[d.getUTCMonth()] : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
  }
  const monthGap = months.length > 1 ? x(months[1].ts) - x(months[0].ts) : width;
  const monthEvery = monthGap < (narrow ? 34 : 70) ? 2 : 1;

  const labelled = new Set(
    [...fills].sort((a, b) => (b.account_pct ?? 0) - (a.account_pct ?? 0)).slice(0, LABELLED),
  );
  const shown = instant || grown;
  const buys = fills.filter((row) => row.side === "buy").length;
  const summary = fills.length
    ? `Timeline of ${fills.length} simulated SPY fills, ${new Date(fills[0].ts * 1000).toISOString().slice(0, 10)} to ${new Date(fills[fills.length - 1].ts * 1000).toISOString().slice(0, 10)}: ${buys} buys drawn upward, ${fills.length - buys} sells drawn downward. Tick height is the order size as a percent of the simulated account. Each fill is listed in the table below.`
    : "No simulated fills to plot.";

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-beam-dim">
        <span className="text-beam-mid">Buy ↑</span>
        <span className="text-accent">Sell ↓</span>
        <span>Tick height = order size, % of account</span>
      </div>
      <div ref={boxRef} className="mt-2 w-full">
        {width > 0 && (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} className="block font-mono">
            {/* graticule: 100% buy, zero line, 100% sell */}
            {[padT, mid, height - padB].map((y, i) => (
              <line key={y} x1={padL} x2={width - padR} y1={y} y2={y}
                stroke="hsl(var(--beam-ghost))" strokeOpacity={i === 1 ? 0.9 : 0.45} strokeDasharray={i === 1 ? undefined : "2 4"} />
            ))}
            <line x1={padL} x2={padL} y1={padT} y2={height - padB} stroke="hsl(var(--beam-ghost))" strokeOpacity={0.7} />
            <g fontSize={11} fill="hsl(var(--beam-dim))" textAnchor="end">
              <text x={padL - 6} y={padT + 3.5}>100%</text>
              <text x={padL - 6} y={mid + 3.5}>0</text>
              <text x={padL - 6} y={height - padB + 3.5}>100%</text>
            </g>
            {months.map((month, i) => (
              <g key={month.ts}>
                <line x1={x(month.ts)} x2={x(month.ts)} y1={padT} y2={height - padB} stroke="hsl(var(--beam-ghost))" strokeOpacity={0.3} strokeDasharray="2 4" />
                {i % monthEvery === 0 && x(month.ts) < width - padR - 24 && (
                  <text x={x(month.ts)} y={height - 7} fontSize={11} fill="hsl(var(--beam-dim))" textAnchor={i === 0 ? "start" : "middle"}>{month.label}</text>
                )}
              </g>
            ))}
            {fills.map((row, i) => {
              const sell = row.side === "sell";
              const h = Math.max(2, (Math.min(100, row.account_pct ?? 0) / 100) * half);
              const cx = x(row.ts);
              const colour = sell ? "hsl(var(--accent))" : "hsl(var(--beam-hot))";
              const delay = `${i * 70}ms`;
              return (
                <g key={`${row.ts}-${i}`}>
                  <rect
                    x={cx - 1} y={sell ? mid : mid - h} width={2} height={h} fill={colour}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: sell ? "top" : "bottom",
                      transform: shown ? "scaleY(1)" : "scaleY(0)",
                      transition: instant ? "none" : `transform 0.6s var(--ease-out-expo) ${delay}`,
                    }}
                  />
                  {labelled.has(row) && (
                    <text
                      x={Math.min(width - padR - 22, Math.max(padL + 22, cx))} y={sell ? mid + h + 13 : mid - h - 6} fontSize={11} textAnchor="middle" fill={colour}
                      style={{ opacity: shown ? 1 : 0, transition: instant ? "none" : `opacity 0.3s ease-out ${i * 70 + 450}ms` }}
                    >
                      {(row.account_pct ?? 0).toFixed(2)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
