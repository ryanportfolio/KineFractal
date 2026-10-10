// One sizing curve at a time (SPY / QQQ / IWM tabs), drawn from each fund's
// live sizing policy in its report JSON `fear` block. The curve is the rule,
// not an order: cooldown, protection, regime and cash still gate a buy.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FundFear } from "@/hooks/use-fear-state";
import { ord } from "@/data/lab-data";
import { clampPercent } from "@/lib/homepage-signal-model";

// size = 0 below the buy line; at or above it
// size = minPct + (maxPct - minPct) * F^power, F = (fear - buy line) / (100 - buy line)
export function orderSizeAt(fund: FundFear, fear: number): number {
  if (fear < fund.floorPct) return 0;
  const span = 100 - fund.floorPct;
  const f = span > 0 ? Math.min(1, Math.max(0, (fear - fund.floorPct) / span)) : 1;
  return fund.minPct + (fund.maxPct - fund.minPct) * Math.pow(f, fund.power);
}

const pct = (n: number) => `${n >= 10 || Number.isInteger(n) ? Math.round(n) : n.toFixed(1)}%`;

function shapeWords(power: number): string {
  if (power > 1.05) return "slowly at first, then steeply as fear nears the extreme";
  if (power < 0.35) return "almost at once toward its maximum, then slowly";
  if (power < 0.95) return "quickly at first, then more gradually";
  return "in a straight line";
}

function caption(fund: FundFear): string {
  const line = ord(fund.floorPct);
  const rise = shapeWords(fund.power);
  return fund.minPct > 0
    ? `Below the ${line} percentile the rule sizes no ${fund.sym} buy. At the line it starts at ${fund.minPct}% of account and rises ${rise}, reaching ${fund.maxPct}% at the 100th percentile.`
    : `Below the ${line} percentile the rule sizes no ${fund.sym} buy. Above it, order size rises ${rise}, up to ${fund.maxPct}% of account at the 100th percentile.`;
}

function todayText(fund: FundFear): string {
  const now = ord(fund.nowPct);
  return fund.nowPct >= fund.floorPct
    ? `Today’s ${now} percentile is past the line, so the rule points to ${pct(orderSizeAt(fund, fund.nowPct))} of account, before cooldown, protection, market regime and available cash are checked.`
    : `Today’s ${now} percentile is below the line, so the rule sizes no buy.`;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

type Anchor = "start" | "middle" | "end";
type Label = { x: number; y: number; anchor: Anchor; text: string };
type Box = { x0: number; x1: number; y0: number; y1: number };

// 11px mono glyphs advance 6.6px; the text box runs about 11.5px above the
// baseline and 3.5px below it. Labels keep GAP px apart on at least one axis.
const CH = 6.6;
const ASC = 11.5;
const DESC = 3.5;
const GAP = 10;

const boxOf = ({ x, y, anchor, text }: Label): Box => {
  const w = text.length * CH;
  const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - ASC, y1: y + DESC };
};
const apart = (a: Box, b: Box) =>
  a.x1 + GAP <= b.x0 || b.x1 + GAP <= a.x0 || a.y1 + GAP <= b.y0 || b.y1 + GAP <= a.y0;

function CurvePlot({ fund, width, drawn, instant }: { fund: FundFear; width: number; drawn: boolean; instant: boolean }) {
  const narrow = width < 560;
  const H = narrow ? 260 : 330;
  // top margin holds two label lanes: the y-axis title, then the buy line label
  const m = { l: narrow ? 40 : 52, r: narrow ? 14 : 24, t: 51, b: 54 };
  const pw = Math.max(10, width - m.l - m.r);
  const ph = H - m.t - m.b;
  const top = fund.maxPct > 0 ? fund.maxPct : 1;
  const x = (f: number) => m.l + (clampPercent(f) / 100) * pw;
  const y = (s: number) => m.t + ph - (s / top) * ph;

  const buy = clampPercent(fund.floorPct);
  const steps = 80;
  const curve: [number, number][] = [[x(0), y(0)], [x(buy), y(0)], [x(buy), y(orderSizeAt(fund, buy))]];
  for (let i = 1; i <= steps; i++) {
    const f = buy + ((100 - buy) * i) / steps;
    curve.push([x(f), y(orderSizeAt(fund, f))]);
  }
  const pts = curve.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`);

  const now = clampPercent(fund.nowPct);
  const nowSize = orderSizeAt(fund, fund.nowPct);
  const dotX = x(now);
  const dotY = y(nowSize);
  const yTicks = [0, top / 2, top];
  const xTickY = m.t + ph + 18;
  const buyLane = m.t - 14;
  const titleLane = buyLane - ASC - DESC - GAP; // its own lane, clear of the buy label
  // y-axis title, above the axis
  const yTitle = narrow ? "% of account" : "order size, % of account";

  // Fixed labels: axis numbers and the axis titles.
  const fixed: Label[] = [
    ...[0, 25, 50, 75, 100].map((f): Label => ({ x: x(f), y: xTickY, anchor: f === 0 ? "start" : f === 100 ? "end" : "middle", text: String(f) })),
    ...yTicks.map((s): Label => ({ x: m.l - 8, y: y(s) + 4, anchor: "end", text: pct(s) })),
    { x: m.l + pw / 2, y: H - 6, anchor: "middle", text: "fear percentile" },
    { x: 1, y: titleLane, anchor: "start", text: yTitle },
  ];

  // Placed labels: each has candidate spots in order of preference. The first
  // set that keeps every label apart and inside the plot wins; a set that also
  // keeps the today and maximum labels off the curve, the dot and the buy line
  // is preferred over one that does not.
  const buyText = `buy line ${ord(fund.floorPct)}`;
  const buyHome: Anchor = buy > 80 ? "end" : buy < 20 ? "start" : "middle";
  const buyCands: Label[] = [buyHome, "end", "start", "middle"]
    .filter((a, i, all) => all.indexOf(a) === i)
    .map((anchor) => ({ x: x(buy), y: buyLane, anchor: anchor as Anchor, text: buyText }));

  const maxText = `${fund.maxPct}% maximum`;
  const maxCands: Label[] = [
    { x: x(100), y: y(top) - 8, anchor: "end", text: maxText },
    { x: x(100), y: buyLane, anchor: "end", text: maxText },
    { x: x(100) - 6, y: y(top) + 18, anchor: "end", text: maxText },
    { x: x(100) - 6, y: y(top) + 32, anchor: "end", text: maxText },
    // along the top gridline next to its axis number; left of the buy line the curve is at 0
    { x: m.l + 6, y: y(top) + 16, anchor: "start", text: maxText },
  ];

  const nowText = `today: ${ord(fund.nowPct)}, ${pct(nowSize)}`;
  const sides: Anchor[] = now > 62 ? ["end", "start"] : ["start", "end"];
  const todayCands: Label[] = [];
  for (const [dx, dy] of [[10, -12], [14, 4], [24, 4], [34, 4], [10, 20], [10, -26], [10, 34]]) {
    for (const anchor of sides) todayCands.push({ x: anchor === "end" ? dotX - dx : dotX + dx, y: dotY + dy, anchor, text: nowText });
  }
  todayCands.sort((a, b) => (a.anchor === sides[0] ? 0 : 1) - (b.anchor === sides[0] ? 0 : 1));

  const inside = (b: Box) => b.x0 >= 1 && b.x1 <= width - 1 && b.y0 >= 1 && b.y1 <= H - 1;
  const fixedBoxes = fixed.map(boxOf);
  // the curve, the dot and the buy line, sampled every 2px
  const marks: [number, number][] = [];
  const addSegment = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
    for (let i = 0; i <= n; i++) marks.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  for (let i = 1; i < curve.length; i++) addSegment(curve[i - 1][0], curve[i - 1][1], curve[i][0], curve[i][1]);
  addSegment(x(buy), m.t - 8, x(buy), m.t + ph);
  for (let a = 0; a < 16; a++) marks.push([dotX + 7 * Math.cos((a * Math.PI) / 8), dotY + 7 * Math.sin((a * Math.PI) / 8)]);
  const offMarks = (b: Box) => !marks.some(([px, py]) => px > b.x0 - 3 && px < b.x1 + 3 && py > b.y0 - 3 && py < b.y1 + 3);

  // the maximum label stays by the curve's end when it can; the gridline spot is a last resort
  const nearEnd = maxCands.slice(0, -1);
  const maxClean = new Map(maxCands.map((c) => [c, offMarks(boxOf(c))]));
  const search = (maxes: Label[], clean: boolean): readonly [Label, Label, Label] | null => {
    for (const today of todayCands) {
      const tb = boxOf(today);
      if (!inside(tb) || !fixedBoxes.every((f) => apart(tb, f)) || (clean && !offMarks(tb))) continue;
      for (const buyLabel of buyCands) {
        const bb = boxOf(buyLabel);
        if (!inside(bb) || !apart(bb, tb) || !fixedBoxes.every((f) => apart(bb, f))) continue;
        for (const max of maxes) {
          const mb = boxOf(max);
          if (!inside(mb) || !apart(mb, tb) || !apart(mb, bb) || !fixedBoxes.every((f) => apart(mb, f))) continue;
          if (!clean || maxClean.get(max)) return [today, buyLabel, max];
        }
      }
    }
    return null;
  };
  const layout = search(nearEnd, true) ?? search(maxCands, true) ?? search(nearEnd, false) ?? search(maxCands, false)
    ?? [todayCands[0], buyCands[0], maxCands[0]];
  const [todayLabel, buyLabel, maxLabel] = layout;
  const fade = (delay: number) => ({ opacity: drawn ? 1 : 0, transition: instant ? "none" : `opacity .5s ease ${delay}ms` });

  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="block font-mono" role="img"
      aria-label={`${fund.sym} sizing rule: order size as % of account against fear percentile. ${caption(fund)} ${todayText(fund)}`}>
      {/* graticule */}
      {[0, 25, 50, 75, 100].map((f) => (
        <g key={f}>
          <line x1={x(f)} y1={m.t} x2={x(f)} y2={m.t + ph} stroke="hsl(var(--beam-ghost))" strokeDasharray="3 4" />
          <text x={x(f)} y={xTickY} textAnchor={f === 0 ? "start" : f === 100 ? "end" : "middle"} fontSize="11" fill="hsl(var(--beam-dim))">{f}</text>
        </g>
      ))}
      {yTicks.map((s) => (
        <g key={s}>
          <line x1={m.l} y1={y(s)} x2={m.l + pw} y2={y(s)} stroke="hsl(var(--beam-ghost))" strokeDasharray={s === 0 ? undefined : "3 4"} />
          <text x={m.l - 8} y={y(s) + 4} textAnchor="end" fontSize="11" fill="hsl(var(--beam-dim))">{pct(s)}</text>
        </g>
      ))}
      <line x1={m.l} y1={m.t} x2={m.l} y2={m.t + ph} stroke="hsl(var(--beam-dim) / .6)" />
      <text x={m.l + pw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="hsl(var(--beam-dim))">fear percentile</text>
      <text x={1} y={titleLane} fontSize="11" fill="hsl(var(--beam-dim))">{yTitle}</text>

      {/* buy line */}
      <g style={fade(150)}>
        <line x1={x(buy)} y1={m.t - 8} x2={x(buy)} y2={m.t + ph} stroke="hsl(var(--accent))" strokeDasharray="5 4" strokeWidth="1.4" />
        <text x={buyLabel.x} y={buyLabel.y} textAnchor={buyLabel.anchor} fontSize="11" fill="hsl(var(--accent))">{buyText}</text>
      </g>

      {/* the rule */}
      <polyline
        key={fund.sym}
        points={pts.join(" ")}
        fill="none"
        stroke="hsl(var(--beam-hot))"
        strokeWidth="2"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={drawn ? 0 : 1}
        style={{ transition: instant ? "none" : "stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1) 200ms", filter: "drop-shadow(0 0 3px hsl(var(--beam-mid) / .6))" }}
      />
      <text x={maxLabel.x} y={maxLabel.y} textAnchor={maxLabel.anchor} fontSize="11" fill="hsl(var(--beam-mid))" style={fade(900)}>{maxText}</text>

      {/* today */}
      <g style={fade(1100)}>
        <line x1={dotX} y1={dotY} x2={dotX} y2={m.t + ph} stroke="hsl(var(--beam-dim) / .7)" strokeDasharray="2 3" />
        <circle cx={dotX} cy={dotY} r="5.5" fill="hsl(var(--beam-hot))" stroke="hsl(var(--background))" style={{ filter: "drop-shadow(0 0 5px hsl(var(--beam-mid)))" }} />
        <text x={todayLabel.x} y={todayLabel.y} textAnchor={todayLabel.anchor} fontSize="11" fill="hsl(var(--beam-hot))">
          {nowText}
        </text>
      </g>
    </svg>
  );
}

export function MechanismSizingCurve({ funds, defaultSym, drawn, instant }: {
  funds: FundFear[];
  defaultSym: string;
  drawn: boolean;
  instant: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const selected = funds.find((f) => f.sym === (picked ?? defaultSym)) ?? funds[0];
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { ref, width } = useWidth<HTMLDivElement>(720);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = funds.findIndex((f) => f.sym === selected.sym);
    const next =
      e.key === "ArrowRight" ? (i + 1) % funds.length
      : e.key === "ArrowLeft" ? (i - 1 + funds.length) % funds.length
      : e.key === "Home" ? 0
      : e.key === "End" ? funds.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setPicked(funds[next].sym);
    tabs.current[funds[next].sym]?.focus();
  };

  const crossed = selected.nowPct >= selected.floorPct;
  const waiting = Math.ceil(selected.floorPct - selected.nowPct);

  return (
    <div className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <p className="etched">order size by fear percentile, one fund at a time</p>
        <div role="tablist" aria-label="Sizing curve fund" className="flex gap-1" onKeyDown={onKey}>
          {funds.map((f) => {
            const on = f.sym === selected.sym;
            return (
              <button
                key={f.sym}
                ref={(el) => { tabs.current[f.sym] = el; }}
                id={`sizing-tab-${f.sym}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="sizing-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setPicked(f.sym)}
                className={`min-h-[44px] min-w-[64px] border-b-2 px-4 font-mono text-sm font-semibold tracking-wider sm:min-h-[32px] ${on ? "border-beam-hot text-beam-hot" : "border-transparent text-beam-dim hover:text-beam-mid"}`}
              >
                {f.sym}
              </button>
            );
          })}
        </div>
      </div>

      <div id="sizing-panel" role="tabpanel" aria-labelledby={`sizing-tab-${selected.sym}`} className="mt-5 border-t border-beam-ghost pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono">
            <span className="text-2xl font-semibold text-beam-hot">{selected.sym}</span>
            <span className={crossed ? "text-accent" : "text-beam-mid"}>{ord(selected.nowPct)} percentile today</span>
            <span className={crossed ? "text-accent" : "text-beam-dim"}>
              {crossed ? "buy line crossed" : `waiting ${waiting} ${waiting === 1 ? "point" : "points"}`}
            </span>
          </p>
          <p className="etched">sizing rule, not an executed order</p>
        </div>
        <div ref={ref} className="mt-6 w-full">
          <CurvePlot fund={selected} width={width} drawn={drawn} instant={instant} />
        </div>
        <p className="mt-4 max-w-[82ch] font-mono text-sm leading-relaxed text-beam-mid">{caption(selected)}</p>
        <p className="mt-2 max-w-[82ch] font-mono text-sm leading-relaxed text-beam-dim">{todayText(selected)}</p>
      </div>
    </div>
  );
}
