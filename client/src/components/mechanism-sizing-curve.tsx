// One sizing curve at a time (SPY / QQQ / IWM tabs), drawn from each fund's
// live sizing policy in its report JSON `fear` block. The curve is the rule,
// not an order: cooldown, protection, regime and cash still gate a buy.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { FundFear } from "@/hooks/use-fear-state";
import { ord } from "@/data/lab-data";
import { clampPercent } from "@/lib/homepage-signal-model";

// size = 0 below the buy line; at or above it
// size = minPct + (maxPct - minPct) * F^power, F = (fear - buy line) / (100 - buy line)
// A boost multiplies F before the power, capped at 1, as the engine does.
export function orderSizeAt(fund: FundFear, fear: number, boost = 1): number {
  if (fear < fund.floorPct) return 0;
  const span = 100 - fund.floorPct;
  const f = span > 0 ? Math.min(1, Math.max(0, ((fear - fund.floorPct) / span) * boost)) : 1;
  return fund.minPct + (fund.maxPct - fund.minPct) * Math.pow(f, fund.power);
}

// The engine's confluence boost (range, fearlab/strategy.py favConfluence): price near a
// support level or inside a demand zone multiplies F by 1.5, and a fresh swing low or
// bullish engulfing candle adds another 0.5, so both together double it.
const CONFLUENCE_MAX = 2;
// The end-of-day decision rounds the fear buy to 0.01% of account and sends nothing at
// 0.00% (range, fearlab/bridge/intent.py), so a size under 0.005% places no order.
const NO_ORDER_BELOW = 0.005;

const pct = (n: number) => `${n >= 10 || Number.isInteger(n) ? Math.round(n) : n.toFixed(1)}%`;
// one significant figure under 1%, so 0.08% and 0.006% stay apart
const sizeText = (n: number) => (n > 0 && n < 1 ? `${Number(n.toPrecision(1))}%` : pct(n));

// the fear percentile where the rule's size first reaches NO_ORDER_BELOW; null when it
// starts at or above it
function noOrderEnd(fund: FundFear, boost = 1): number | null {
  const range = fund.maxPct - fund.minPct;
  if (fund.minPct >= NO_ORDER_BELOW || range <= 0 || fund.power <= 0) return null;
  const f = Math.pow((NO_ORDER_BELOW - fund.minPct) / range, 1 / fund.power) / boost;
  return Math.min(100, fund.floorPct + f * (100 - fund.floorPct));
}

type Tip = { lead: string; body: string };

// the whole percentile where both boosts add the most size, as the band's worked example
function boostTip(fund: FundFear): Tip & { fear: number; boosted: number } {
  let best = { fear: 100, gap: -1 };
  for (let f = Math.trunc(fund.floorPct) + 1; f <= 100; f++) {
    const gap = orderSizeAt(fund, f, CONFLUENCE_MAX) - orderSizeAt(fund, f);
    if (gap > best.gap) best = { fear: f, gap };
  }
  const base = orderSizeAt(fund, best.fear);
  const boosted = orderSizeAt(fund, best.fear, CONFLUENCE_MAX);
  return {
    fear: best.fear,
    boosted,
    lead: `${ord(best.fear)} percentile · ${sizeText(base)} of account, or ${sizeText(boosted)} with both boosts`,
    body: "Near a support level or inside a demand zone, the engine sizes the buy as if fear sat 1.5 times as far past the buy line. A fresh swing low or bullish engulfing candle adds another half. The band’s top edge shows both together, sized as if twice as far past.",
  };
}

function zeroTip(fund: FundFear, end: number): Tip {
  const boosted = fund.confluence ? noOrderEnd(fund, CONFLUENCE_MAX) : null;
  return {
    lead: `${ord(fund.floorPct)} to ${ord(Math.round(end))} percentile · under ${NO_ORDER_BELOW}% of account`,
    body: `That rounds to 0.00% of the account, so the end-of-day decision sends no buy order.${boosted != null ? ` If both boosts apply, this stretch ends near the ${ord(Math.round(boosted))}.` : ""}`,
  };
}

const spoken = (t: Tip) => `${t.lead.replace(" · ", ", ")}. ${t.body}`;

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
    // offsetWidth, not contentRect: Firefox 140 ESR reports contentRect in zoomed
    // px under the desktop root zoom (index.css, --pz), which drew the plot 1.4x
    // wider than its box
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
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

type TipKind = "boost" | "zero";
type TipHandlers = {
  onPointerEnter: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
};

function TipKey({ label, describedBy, swatch, on }: { label: string; describedBy: string; swatch: ReactNode; on: TipHandlers }) {
  return (
    <button
      type="button"
      data-sizing-tip=""
      aria-describedby={describedBy}
      className="inline-flex min-h-[44px] cursor-help items-center gap-2 underline decoration-dotted underline-offset-4 hover:text-beam-mid focus-visible:text-beam-hot focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-beam-hot sm:min-h-[24px]"
      {...on}
    >
      {swatch}
      {label}
    </button>
  );
}

function CurvePlot({ fund, width, drawn, instant }: { fund: FundFear; width: number; drawn: boolean; instant: boolean }) {
  const uid = useId().replace(/:/g, "");
  const [tip, setTip] = useState<{ kind: TipKind; pinned: boolean } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipBox, setTipBox] = useState({ w: 0, h: 0 });
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
  const xy = ([px, py]: [number, number]) => `${px.toFixed(1)},${py.toFixed(1)}`;

  // the size with both confluence boosts, drawn as a band above the rule
  const boostCurve: [number, number][] | null = fund.confluence && buy < 100
    ? [[x(buy), y(orderSizeAt(fund, buy, CONFLUENCE_MAX))]]
    : null;
  if (boostCurve) {
    for (let i = 1; i <= steps; i++) {
      const f = buy + ((100 - buy) * i) / steps;
      boostCurve.push([x(f), y(orderSizeAt(fund, f, CONFLUENCE_MAX))]);
    }
  }
  const bandPath = boostCurve ? `M${[...boostCurve, ...curve.slice(2).reverse()].map(xy).join("L")}Z` : null;
  const boost = boostCurve ? boostTip(fund) : null;

  // the stretch past the buy line where the rule's size rounds to 0.00%, hatched on the zero line
  const ZONE_H = 9;
  const zeroEnd = noOrderEnd(fund);
  const zone = zeroEnd != null && x(zeroEnd) - x(buy) >= 3 ? { x0: x(buy), x1: x(zeroEnd), ...zeroTip(fund, zeroEnd) } : null;

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
  if (boostCurve) for (let i = 1; i < boostCurve.length; i++) addSegment(boostCurve[i - 1][0], boostCurve[i - 1][1], boostCurve[i][0], boostCurve[i][1]);
  if (zone) addSegment(zone.x0, y(0) - ZONE_H, zone.x1, y(0) - ZONE_H);
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

  // Tooltips: hover or tap a shape, or hover, focus or press its key below the chart.
  // A tap or click pins the tooltip until the next tap elsewhere or Esc.
  const show = (kind: TipKind) => setTip((t) => (t?.pinned && t.kind === kind ? t : { kind, pinned: false }));
  const hide = () => setTip((t) => (t?.pinned ? t : null));
  const toggle = (kind: TipKind) => setTip((t) => (t?.pinned && t.kind === kind ? null : { kind, pinned: true }));
  const handlers = (kind: TipKind): TipHandlers => ({
    onPointerEnter: (e) => { if (e.pointerType !== "touch") show(kind); },
    onPointerLeave: (e) => { if (e.pointerType !== "touch") hide(); },
    onFocus: () => show(kind),
    onBlur: hide,
    onClick: () => toggle(kind),
  });
  useEffect(() => setTip(null), [fund.sym]);
  useEffect(() => {
    if (!tip) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setTip(null); };
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element && e.target.closest("[data-sizing-tip]"))) setTip(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [tip]);

  const tipText = tip?.kind === "boost" ? boost : tip?.kind === "zero" ? zone : null;
  // the band's tooltip points at its worked example, halfway between the two curves
  const anchor = tip?.kind === "boost" && boost
    ? { x: x(boost.fear), y: (y(boost.boosted) + y(orderSizeAt(fund, boost.fear))) / 2 }
    : tip?.kind === "zero" && zone ? { x: (zone.x0 + zone.x1) / 2, y: y(0) - ZONE_H } : null;
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (el) setTipBox((b) => (b.w === el.offsetWidth && b.h === el.offsetHeight ? b : { w: el.offsetWidth, h: el.offsetHeight }));
  }, [tip?.kind, fund.sym, width]);
  // The band's tooltip sits beside it, on the side with more room; the no-order
  // tooltip sits above its stretch. Each falls back to below, then above, and the
  // first spot inside the chart's width (and within 40px of its height) wins.
  let tipLeft = 0;
  let tipTop = 0;
  if (anchor) {
    const { w, h } = tipBox;
    const G = 12;
    const cx = Math.max(0, Math.min(width - w, anchor.x - w / 2));
    const cy = Math.max(0, Math.min(H - h, anchor.y - h / 2));
    const side = anchor.x > width / 2 ? { left: anchor.x - G - w, top: cy } : { left: anchor.x + G, top: cy };
    const above = { left: cx, top: anchor.y - G - h };
    const below = { left: cx, top: anchor.y + G };
    const spots = tip?.kind === "boost" ? [side, below, above] : [above, below];
    const fits = (sp: { left: number; top: number }) => sp.left >= 0 && sp.left + w <= width && sp.top >= -40 && sp.top + h <= H + 40;
    ({ left: tipLeft, top: tipTop } = spots.find(fits) ?? below);
  }
  const lit = tip?.kind;
  const hitH = narrow ? 44 : 28;

  return (
    <>
      <div className="relative">
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="block font-mono" role="img"
          aria-label={`${fund.sym} sizing rule: order size as % of account against fear percentile. ${caption(fund)} ${todayText(fund)}${boost ? ` Shaded band, with boosts: ${spoken(boost)}` : ""}${zone ? ` Hatched stretch, no order sent: ${spoken(zone)}` : ""}`}>
          <defs>
            <pattern id={`${uid}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="hsl(var(--beam-dim))" strokeWidth="1.4" />
            </pattern>
          </defs>
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

          {/* with both boosts */}
          {bandPath && boostCurve && (
            <g style={fade(1300)}>
              <path d={bandPath} fill="hsl(var(--beam-mid))" fillOpacity={lit === "boost" ? 0.32 : 0.2} style={{ transition: "fill-opacity .15s" }} />
              <polyline points={boostCurve.map(xy).join(" ")} fill="none" stroke="hsl(var(--beam-mid) / .75)" strokeWidth="1.2" strokeDasharray="4 3" />
            </g>
          )}

          {/* sizes that round to 0.00%: no order sent */}
          {zone && (
            <g style={fade(1000)}>
              <rect x={zone.x0} y={y(0) - ZONE_H} width={zone.x1 - zone.x0} height={ZONE_H} fill={`url(#${uid}-hatch)`} opacity={lit === "zero" ? 1 : 0.85} style={{ transition: "opacity .15s" }} />
              <line x1={zone.x0} y1={y(0) - ZONE_H} x2={zone.x1} y2={y(0) - ZONE_H} stroke="hsl(var(--beam-dim) / .8)" />
            </g>
          )}

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

          {/* hover and tap targets, larger than the marks they explain */}
          {drawn && bandPath && (
            <path d={bandPath} data-sizing-tip="" aria-hidden="true" fill="none" stroke="transparent" strokeWidth="16" strokeLinejoin="round"
              pointerEvents="all" style={{ cursor: "help" }} {...handlers("boost")} />
          )}
          {drawn && zone && (
            <rect data-sizing-tip="" aria-hidden="true" x={zone.x0 - 4} y={y(0) + 8 - hitH} width={zone.x1 - zone.x0 + 8} height={hitH}
              fill="transparent" pointerEvents="all" style={{ cursor: "help" }} {...handlers("zero")} />
          )}
        </svg>
        {tipText && anchor && (
          <div ref={tipRef} aria-hidden="true" style={{ left: tipLeft, top: tipTop }}
            className="pointer-events-none absolute z-10 w-[min(17rem,100%)] border border-[hsl(var(--beam-dim))] bg-background px-3 py-2 font-mono text-[13px] leading-relaxed text-beam-mid shadow-[0_0_18px_hsl(var(--beam-ghost)/0.55)]">
            <p className="text-beam-hot">{tipText.lead}</p>
            <p className="mt-1">{tipText.body}</p>
          </div>
        )}
      </div>
      {(boost || zone) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 font-mono text-xs text-beam-dim">
          <span className="inline-flex min-h-[44px] items-center gap-2 sm:min-h-[24px]">
            <svg width="24" height="14" aria-hidden="true"><line x1="0" y1="7" x2="24" y2="7" stroke="hsl(var(--beam-hot))" strokeWidth="2" /></svg>
            sizing rule
          </span>
          {boost && (
            <TipKey label="with boosts" describedBy={`${uid}-boost`} on={handlers("boost")} swatch={
              <svg width="24" height="14" aria-hidden="true">
                <rect x="0" y="2" width="24" height="12" fill="hsl(var(--beam-mid))" fillOpacity={lit === "boost" ? 0.32 : 0.2} />
                <line x1="0" y1="2" x2="24" y2="2" stroke="hsl(var(--beam-mid) / .75)" strokeWidth="1.2" strokeDasharray="4 3" />
              </svg>
            } />
          )}
          {zone && (
            <TipKey label="no order sent" describedBy={`${uid}-zero`} on={handlers("zero")} swatch={
              <svg width="24" height="14" aria-hidden="true">
                <rect x="0" y="2" width="24" height="12" fill={`url(#${uid}-hatch)`} opacity={lit === "zero" ? 1 : 0.85} />
                <line x1="0" y1="2" x2="24" y2="2" stroke="hsl(var(--beam-dim) / .8)" />
              </svg>
            } />
          )}
          {boost && <span id={`${uid}-boost`} className="sr-only">{spoken(boost)}</span>}
          {zone && <span id={`${uid}-zero`} className="sr-only">{spoken(zone)}</span>}
        </div>
      )}
    </>
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
