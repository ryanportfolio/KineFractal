// Chart drawings for the Alerts settings. Each is a small hand-authored
// candlestick series that shows what a setting means: an open gap is the empty
// price space between one candle's high and the next candle's low; an order
// block is the zone of the last down candle before a strong rise; the middle of
// the range sits halfway between a marked recent high and low. Prices here are
// illustrative shapes, not market data. Up candles are filled, down candles are
// hollow, all in the beam ramp (no red/green pair; DESIGN.md keeps three hues).

import type { ReactNode } from "react";

type Bar = readonly [open: number, high: number, low: number, close: number];

const HOT = "hsl(var(--beam-hot))";
const MID = "hsl(var(--beam-mid))";
const ZONE = "hsl(var(--beam-hot) / 0.16)";
const ZONE_EDGE = "hsl(var(--beam-hot) / 0.55)";
const GRID = "hsl(var(--beam-ghost))";

// Maps prices onto a viewBox: x by bar index, y by price (higher = up).
export type Frame = { width: number; height: number; x: (index: number) => number; y: (price: number) => number; step: number };

function frame(bars: readonly Bar[], width: number, height: number, lo: number, hi: number, pad = { l: 8, r: 8, t: 10, b: 10 }, slots = bars.length): Frame {
  const step = (width - pad.l - pad.r) / slots;
  return {
    width,
    height,
    step,
    x: (index) => pad.l + step * (index + 0.5),
    y: (price) => pad.t + ((hi - price) / (hi - lo)) * (height - pad.t - pad.b),
  };
}

function Candles({ bars, f, from = 0, dim = false }: { bars: readonly Bar[]; f: Frame; from?: number; dim?: boolean }) {
  const body = Math.max(3, f.step * 0.56);
  return (
    <g opacity={dim ? 0.45 : 1}>
      {bars.map(([open, high, low, close], i) => {
        const up = close >= open;
        const x = f.x(from + i);
        const top = f.y(Math.max(open, close));
        const bottom = f.y(Math.min(open, close));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={f.y(high)} y2={f.y(low)} stroke={up ? HOT : MID} strokeWidth="1.4" />
            <rect
              x={x - body / 2}
              y={top}
              width={body}
              height={Math.max(1.5, bottom - top)}
              fill={up ? HOT : "hsl(var(--background))"}
              stroke={up ? HOT : MID}
              strokeWidth="1.4"
            />
          </g>
        );
      })}
    </g>
  );
}

function Zone({ f, fromIndex, top, bottom, toX }: { f: Frame; fromIndex: number; top: number; bottom: number; toX?: number }) {
  const x = f.x(fromIndex) - f.step / 2;
  const right = toX ?? f.width - 4;
  return (
    <g>
      <rect x={x} y={f.y(top)} width={right - x} height={f.y(bottom) - f.y(top)} fill={ZONE} />
      <line x1={x} x2={right} y1={f.y(top)} y2={f.y(top)} stroke={ZONE_EDGE} strokeDasharray="5 4" />
      <line x1={x} x2={right} y1={f.y(bottom)} y2={f.y(bottom)} stroke={ZONE_EDGE} strokeDasharray="5 4" />
    </g>
  );
}

function Label({ x, y, children, anchor = "start", size = 17, color = HOT }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; size?: number; color?: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color} fontFamily="var(--font-mono)" letterSpacing="0.04em">
      {children}
    </text>
  );
}

function Svg({ f, label, children }: { f: Frame; label: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${f.width} ${f.height}`} role="img" aria-label={label} className="block h-auto w-full">
      {children}
    </svg>
  );
}

// ---- open gap: a rise, a gap up, then price comes back down into the gap ----

const GAP_RISE: Bar[] = [
  [94, 96, 93, 95.4], [95.4, 97, 94.6, 96.6], [96.6, 99, 96, 98.6], [98.6, 100, 97.6, 99.4],
  [105, 108, 104, 107.6], [107.6, 110, 106.6, 109.6], [109.6, 112, 108.6, 111.2],
];
const GAP_RETURN: Bar[] = [[111.2, 111.6, 108, 108.4], [108.4, 109, 105.6, 106], [106, 106.4, 103.4, 103.8]];

export function OpenGapEvent({ on }: { on: boolean }) {
  const bars = [...GAP_RISE, ...GAP_RETURN];
  const f = frame(bars, 300, 150, 92, 114);
  return (
    <Svg f={f} label="Price gaps up, leaving an empty gap below, then falls back into the gap">
      <g opacity={on ? 1 : 0.55}>
        <Zone f={f} fromIndex={3.5} top={104} bottom={100} />
        <Candles bars={bars} f={f} />
        <Label x={f.x(5)} y={f.y(102) + 4}>GAP</Label>
        <circle cx={f.x(9)} cy={f.y(103.8)} r="6" fill="none" stroke={HOT} strokeWidth="1.5" />
      </g>
    </Svg>
  );
}

// ---- order block: the last down candle before a strong rise, then a return ----

const OB_BARS: Bar[] = [
  [106, 106.5, 104.4, 104.8], [104.8, 105.2, 102.4, 102.8], [102.8, 103.2, 100.8, 101.2], [101.2, 101.5, 98, 98.6],
  [98.6, 103, 98.2, 102.6], [102.6, 106.6, 102, 106.2], [106.2, 109.4, 105.6, 108.8],
  [108.8, 109, 105.4, 105.8], [105.8, 106.2, 102.6, 103], [103, 103.4, 100.4, 100.8],
];

export function OrderBlockEvent({ on }: { on: boolean }) {
  const f = frame(OB_BARS, 300, 160, 94.5, 111);
  return (
    <Svg f={f} label="The last down candle before a strong rise marks an order block; price later returns to it">
      <g opacity={on ? 1 : 0.55}>
        <Zone f={f} fromIndex={3} top={101.5} bottom={98} />
        <Candles bars={OB_BARS} f={f} />
        <Label x={f.x(3)} y={f.y(96.5) + 4} anchor="middle" size={15}>LAST DOWN</Label>
        <circle cx={f.x(9)} cy={f.y(100.8)} r="6" fill="none" stroke={HOT} strokeWidth="1.5" />
      </g>
    </Svg>
  );
}

// ---- middle of the range: halfway between a recent high and low ----

const RANGE_BARS: Bar[] = [
  [97, 98.6, 96, 98.2], [98.2, 101, 97.6, 100.6], [100.6, 104, 100, 103.6], [103.6, 107, 103, 106.6],
  [106.6, 110, 106, 109.6], [109.6, 112, 108.6, 110.2], [110.2, 111, 107.6, 108], [108, 109.6, 106.6, 109],
  [109, 110.4, 107, 107.4], [107.4, 108, 105, 105.4], [105.4, 106, 103.6, 104.2],
];

export function RangeMiddleEvent({ on }: { on: boolean }) {
  const f = frame(RANGE_BARS, 300, 160, 94, 114, { l: 8, r: 54, t: 10, b: 10 });
  const line = (price: number, text: string, bright = false) => (
    <g>
      <line x1={8} x2={f.width - 52} y1={f.y(price)} y2={f.y(price)} stroke={bright ? HOT : MID} strokeDasharray={bright ? "6 3" : "3 4"} strokeWidth={bright ? 1.6 : 1} />
      <Label x={f.width - 46} y={f.y(price) + 5} size={15} color={bright ? HOT : MID}>{text}</Label>
    </g>
  );
  return (
    <Svg f={f} label="Price falls from the upper half of its range to the halfway line between the recent high and low">
      <g opacity={on ? 1 : 0.55}>
        {line(112, "HIGH")}
        {line(104, "50%", true)}
        {line(96, "LOW")}
        <Candles bars={RANGE_BARS} f={f} />
        <circle cx={f.x(10)} cy={f.y(104.2)} r="6" fill="none" stroke={HOT} strokeWidth="1.5" />
      </g>
    </Svg>
  );
}

// ---- gap stage: price falling toward a gap below, with the four stages marked ----
// Marker heights for a gap from 100 to 104: getting close sits just above the
// near edge, inside just past it, about to fill near the far edge, filled past
// it. Spread a little wider than the real 1% thresholds so the buttons beside
// the drawing never overlap.

export const GAP_STAGE_PRICES = { approaching: 106.4, tagged: 103, about: 100.8, filled: 98.2 } as const;
const STAGE_LO = 96;
const STAGE_HI = 114;
const STAGE_BARS: Bar[] = [...GAP_RISE, [111.2, 111.6, 108.6, 109], [109, 109.4, 106.4, 106.8], [106.8, 107.2, 104.8, 105.2]];

export function gapStageTop(stage: keyof typeof GAP_STAGE_PRICES): string {
  return `${((STAGE_HI - GAP_STAGE_PRICES[stage]) / (STAGE_HI - STAGE_LO)) * 100}%`;
}

export function GapStageChart({ activeFrom }: { activeFrom: number }) {
  // the chart's top and bottom padding are zero so percentages line up with gapStageTop
  const f = frame(STAGE_BARS, 460, 280, STAGE_LO, STAGE_HI, { l: 8, r: 8, t: 0, b: 0 }, STAGE_BARS.length + 2);
  const order = ["approaching", "tagged", "about", "filled"] as const;
  return (
    <Svg f={f} label="Price falling toward an open gap below it, with the four points where gap emails can start">
      <Zone f={f} fromIndex={3.5} top={104} bottom={100} />
      <Label x={f.x(4.2)} y={f.y(102) + 4}>OPEN GAP</Label>
      <Candles bars={STAGE_BARS} f={f} />
      <path
        d={`M ${f.x(9)} ${f.y(105.2)} L ${f.x(10)} ${f.y(102.4)} L ${f.x(11)} ${f.y(99.4)}`}
        fill="none"
        stroke={MID}
        strokeDasharray="4 4"
        strokeWidth="1.4"
      />
      {order.map((stage, index) => (
        <line
          key={stage}
          x1={f.x(8)}
          x2={f.width}
          y1={f.y(GAP_STAGE_PRICES[stage])}
          y2={f.y(GAP_STAGE_PRICES[stage])}
          stroke={index >= activeFrom ? HOT : GRID}
          strokeWidth={index === activeFrom ? 2 : 1}
          strokeDasharray={index === activeFrom ? undefined : "3 4"}
        />
      ))}
    </Svg>
  );
}

// ---- which gaps: a gap below price (left by a gap up) or above (gap down) ----

export function GapBelowMini() {
  const bars = GAP_RISE;
  const f = frame(bars, 200, 90, 92, 113);
  return (
    <Svg f={f} label="A gap up leaves an open gap below the price">
      <Zone f={f} fromIndex={3.5} top={104} bottom={100} />
      <Candles bars={bars} f={f} />
    </Svg>
  );
}

const GAP_DOWN: Bar[] = [
  [112, 113, 110.6, 111], [111, 111.6, 108.8, 109.4], [109.4, 110, 107.6, 108], [108, 108.4, 106, 106.4],
  [101.6, 102, 98.4, 99], [99, 99.6, 96.4, 96.8], [96.8, 97.4, 94.6, 95.2],
];

export function GapAboveMini() {
  const f = frame(GAP_DOWN, 200, 90, 93, 114);
  return (
    <Svg f={f} label="A gap down leaves an open gap above the price">
      <Zone f={f} fromIndex={3.5} top={106} bottom={102} />
      <Candles bars={GAP_DOWN} f={f} />
    </Svg>
  );
}

// ---- gap limit price: where the buy limit sits inside an open gap below ----

// a wider gap (99 to 105) than the other drawings, so its three prices sit far
// enough apart for a button each
const LIMIT_LO = 90;
const LIMIT_HI = 116;
export const GAP_LIMIT_PRICES = { top: 105, middle: 102, fill: 99 } as const;
const LIMIT_BARS: Bar[] = [
  [93, 95, 92, 94.4], [94.4, 96, 93.6, 95.6], [95.6, 98, 95, 97.6], [97.6, 99, 96.6, 98.4],
  [106, 109, 105, 108.6], [108.6, 111, 107.6, 110.6], [110.6, 113, 109.6, 112.2], [112.2, 114, 111.6, 113.6],
  [113.6, 114.6, 112.2, 112.6], [112.6, 113.8, 111.8, 113.2],
];

export function gapLimitTop(placement: keyof typeof GAP_LIMIT_PRICES): string {
  return `${((LIMIT_HI - GAP_LIMIT_PRICES[placement]) / (LIMIT_HI - LIMIT_LO)) * 100}%`;
}

export function GapLimitChart({ placement }: { placement: keyof typeof GAP_LIMIT_PRICES }) {
  const f = frame(LIMIT_BARS, 460, 300, LIMIT_LO, LIMIT_HI, { l: 8, r: 8, t: 0, b: 0 }, LIMIT_BARS.length + 1);
  const price = GAP_LIMIT_PRICES[placement];
  return (
    <Svg f={f} label={`An open gap below the price; the buy limit sits at the gap's ${placement === "fill" ? "bottom" : placement}`}>
      <Zone f={f} fromIndex={3.5} top={105} bottom={99} />
      <Candles bars={LIMIT_BARS} f={f} />
      <line x1={f.x(9.5)} x2={f.width} y1={f.y(113.2)} y2={f.y(113.2)} stroke={MID} strokeDasharray="3 4" />
      <Label x={f.width - 4} y={f.y(113.2) - 12} anchor="end" color={MID}>LATEST CLOSE</Label>
      <line x1={f.x(3.5)} x2={f.width} y1={f.y(price)} y2={f.y(price)} stroke={HOT} strokeWidth="2" strokeDasharray="8 4" />
      <Label x={10} y={f.y(price) - 9}>YOUR BUY LIMIT</Label>
      <Label x={f.x(5)} y={f.y(99) + 22} color={MID}>OPEN GAP</Label>
    </Svg>
  );
}

// ---- combined levels: an open gap next to a fresh order block (and support) ----

const COMBO_BARS: Bar[] = [
  [106, 106.5, 104.6, 105], [105, 105.4, 103, 103.4], [103.4, 103.8, 100.6, 101], [101, 101.2, 98, 98.4],
  [98.4, 100.6, 98.2, 100.4], [102.4, 104.6, 102, 104.2], [104.2, 106.6, 103.6, 106.2], [106.2, 108.6, 105.8, 108.2],
];

export function CombinedLevelsChart({ triple, distance }: { triple: boolean; distance: string }) {
  const f = frame(COMBO_BARS, 320, 190, 96, 110, { l: 8, r: 92, t: 10, b: 10 });
  const gapMid = 101.3;
  const blockMid = 99.6;
  const bracketX = f.width - 80;
  return (
    <Svg
      f={f}
      label={triple
        ? `An open gap, a fresh order block and a support line within ${distance} of each other`
        : `An open gap and a fresh order block whose middles are within ${distance} of each other`}
    >
      <Zone f={f} fromIndex={3} top={101.2} bottom={98} toX={bracketX - 6} />
      <Zone f={f} fromIndex={4.5} top={102} bottom={100.6} toX={bracketX - 6} />
      {triple && (
        <g>
          <line x1={8} x2={bracketX - 6} y1={f.y(99.8)} y2={f.y(99.8)} stroke={HOT} strokeWidth="1.6" />
          <Label x={10} y={f.y(99.8) - 7} size={15}>SUPPORT</Label>
        </g>
      )}
      <Candles bars={COMBO_BARS} f={f} />
      <Label x={f.x(3)} y={f.y(96.6) + 8} anchor="middle" size={15} color={MID}>ORDER BLOCK</Label>
      <Label x={f.x(5.6)} y={f.y(102) - 7} size={15} color={MID}>GAP</Label>
      <line x1={bracketX} x2={bracketX} y1={f.y(gapMid)} y2={f.y(blockMid)} stroke={HOT} strokeWidth="1.6" />
      <line x1={bracketX - 6} x2={bracketX + 6} y1={f.y(gapMid)} y2={f.y(gapMid)} stroke={HOT} strokeWidth="1.6" />
      <line x1={bracketX - 6} x2={bracketX + 6} y1={f.y(blockMid)} y2={f.y(blockMid)} stroke={HOT} strokeWidth="1.6" />
      <Label x={bracketX + 12} y={(f.y(gapMid) + f.y(blockMid)) / 2 - 6} size={15}>WITHIN</Label>
      <Label x={bracketX + 12} y={(f.y(gapMid) + f.y(blockMid)) / 2 + 16} size={20}>{distance}</Label>
    </Svg>
  );
}
