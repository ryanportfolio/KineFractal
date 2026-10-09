// RulebookCycle: the five rules as one loop (gauge → buy → trim → exit →
// recycle → back to the buy), with a when / then / limits panel per step and a
// SPY / QQQ / IWM switch.
//
// Numbers: buy line and order-size range are live (useFearState, the same
// report fear block the HOW IT BUYS rails read). Everything else is a deployed
// preset fact the report JSON does not carry; those are SPY's flagship
// settings unless a fund-specific fact is listed (QQQ trim 12% of a lot on a
// 5% retrace, IWM whole lot on a 2% retrace, IWM 5% reserve until the 85th).
// When QQQ or IWM is selected, SPY-only rules say so instead of showing SPY
// numbers as theirs.
import { useState, type CSSProperties } from "react";
import type { FundFear } from "@/hooks/use-fear-state";
import { ord } from "@/data/lab-data";

export type Sym = "SPY" | "QQQ" | "IWM";
export type FundsBySym = Partial<Record<Sym, FundFear>>;

const FUNDS: { sym: Sym; nick: string }[] = [
  { sym: "SPY", nick: "eager" },
  { sym: "QQQ", nick: "patient" },
  { sym: "IWM", nick: "cautious" },
];

type KeyNum = { value: string; unit: string; label: string; amber?: boolean };
type Detail = { question: string; when: string; then: string; limits: string; keys: KeyNum[] };

// ---- wheel geometry (viewBox units) ------------------------------------------
const VW = 800;
const VH = 560;
const CX = 400;
const CY = 320;
const R = 190; // station ring
const NODE = 26; // station dot radius
const GAP = 12; // degrees of ring left open around each station
const RETURN_R = 140; // recycle → buy return arc, inside the ring

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, r: number) => ({ x: CX + r * Math.cos(rad(deg)), y: CY + r * Math.sin(rad(deg)) });
const f1 = (n: number) => n.toFixed(1);
const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(2)}%`;

type Side = "top" | "right" | "left";
type Station = {
  n: string;
  name: string;
  summary: string;
  deg: number;
  side: Side;
  // button box in viewBox units; the station dot sits inside it
  box: { x: number; y: number; w: number; h: number };
};

const STATIONS: Station[] = [
  { n: "01", name: "THE GAUGE", summary: "Rank today's dip against recent history.", deg: -90, side: "top", box: { x: 270, y: 4, w: 260, h: 156 } },
  { n: "02", name: "THE BUY", summary: "Buy once fear crosses the buy line.", deg: -18, side: "right", box: { x: 550, y: 206, w: 246, h: 110 } },
  { n: "03", name: "THE TRIM", summary: "Trim into strength.", deg: 54, side: "right", box: { x: 482, y: 426, w: 314, h: 96 } },
  { n: "04", name: "THE EXIT", summary: "SPY sells everything below its protection line.", deg: 126, side: "left", box: { x: 4, y: 426, w: 314, h: 96 } },
  { n: "05", name: "THE RECYCLE", summary: "Raised cash waits for the next buy.", deg: 198, side: "left", box: { x: 4, y: 206, w: 245, h: 110 } },
];

// ring segments, in cycle order; 05 → 01 stays a dim graticule arc because
// the loop returns from the recycle to the buy, not to the gauge
const ARCS = [
  { from: -90, to: -18, live: true },
  { from: -18, to: 54, live: true },
  { from: 54, to: 126, live: true },
  { from: 126, to: 198, live: true },
  { from: 198, to: 270, live: false },
];

function arcPath(from: number, to: number, r: number) {
  const a = at(from, r);
  const b = at(to, r);
  return `M ${f1(a.x)} ${f1(a.y)} A ${r} ${r} 0 0 1 ${f1(b.x)} ${f1(b.y)}`;
}

// arrowhead pointing along the ring's clockwise tangent at `deg`
function Arrow({ deg, r, color, style }: { deg: number; r: number; color: string; style?: CSSProperties }) {
  const p = at(deg, r);
  return (
    <polygon
      points="0,0 -9,-5 -9,5"
      fill={color}
      transform={`translate(${f1(p.x)} ${f1(p.y)}) rotate(${deg + 90})`}
      style={style}
    />
  );
}

// ---- per-step, per-fund copy ---------------------------------------------------
function detail(step: string, sym: Sym, f: FundFear | undefined): Detail {
  const line = f ? `${ord(f.floorPct)}` : null;
  const lineKey: KeyNum[] = line ? [{ value: line, unit: "percentile", label: `${sym} buy line` }] : [];

  switch (step) {
    case "01":
      return {
        question: "How deep is today's dip?",
        when: "At every trading-day close.",
        then:
          "Measure how far the close sits below the highest close of the last 22 trading days, then rank that dip against the previous 100 days. The rank is the day's fear percentile, from 0 to 100; higher means more fear.",
        limits: `Every other rule keys off this one number. ${sym} compares it with its own buy line.`,
        keys: [
          { value: "22", unit: "trading days", label: "highest-close window" },
          { value: "100", unit: "days", label: "ranking window" },
          ...lineKey,
        ],
      };

    case "02": {
      const spySpacing =
        "SPY waits 16 trading days between big buys and also fires small buys on shallow dips and tested support; those are SPY settings, and this page does not list " +
        `${sym}'s own.`;
      if (sym === "SPY") {
        return {
          question: "When does it buy, and how much?",
          when: line ? `Fear reaches the ${line} percentile, SPY's buy line.` : "Fear crosses SPY's buy line.",
          then: f
            ? `The first order is ${f.minPct}% of the account. Order size climbs toward everything available as fear deepens, up to ${f.maxPct}% of the account per buy.`
            : "The first order is 3% of the account. Order size climbs toward everything available as fear deepens, nearly all-in per buy.",
          limits:
            "Big buys wait 16 trading days between them. Small buys may also fire: 0.5% of the account the day a dip first passes 1.75%, and 1 to 10% when a reversal prints at a tested support.",
          keys: [
            ...lineKey,
            { value: f ? `${f.minPct}%` : "3%", unit: "of account", label: "first order" },
            { value: "16", unit: "trading days", label: "between big buys" },
          ],
        };
      }
      if (sym === "QQQ") {
        return {
          question: "When does it buy, and how much?",
          when: line ? `Fear reaches the ${line} percentile, QQQ's buy line.` : "Fear reaches QQQ's buy line; it waits for deep fear.",
          then: f
            ? `Only extreme fear sizes up. Order size grows from ${f.minPct}% of the account at the buy line to ${f.maxPct}% at most.`
            : "Only extreme fear sizes up.",
          limits: spySpacing,
          keys: f
            ? [...lineKey, { value: `${f.minPct}%`, unit: "of account", label: "order size at the buy line" }, { value: `${f.maxPct}%`, unit: "of account", label: "largest order" }]
            : [],
        };
      }
      return {
        question: "When does it buy, and how much?",
        when: line ? `Fear reaches the ${line} percentile, IWM's buy line.` : "Fear crosses IWM's buy line.",
        then: f
          ? `Small buys that grow with fear: order size rises from ${f.minPct}% of the account at the buy line to ${f.maxPct}% per buy at most.`
          : "Small buys that grow with fear.",
        limits: `IWM keeps a 5% cash reserve until fear reaches the 85th percentile. ${spySpacing}`,
        keys: [
          ...lineKey,
          ...(f ? [{ value: `${f.maxPct}%`, unit: "of account", label: "largest order" }] : []),
          { value: "5%", unit: "cash reserve", label: "held until the 85th percentile" },
        ],
      };
    }

    case "03":
      if (sym === "SPY") {
        return {
          question: "When does it sell into strength?",
          when: "Price stretches a full band above its own 500-day smoothed path.",
          then: "SPY sells up to 80% of the account, most profitable lots first.",
          limits:
            "It sells only profitable lots, never at a loss. Five watch markets stand guard while price climbs: equal-weight breadth, semiconductors, transports, inflation bonds and IPO appetite. If any of them weakens, SPY trims 40 to 100%.",
          keys: [
            { value: "500", unit: "days", label: "smoothed price path" },
            { value: "80%", unit: "of account", label: "most a band trim sells" },
            { value: "5", unit: "watch markets", label: "any one weakening trims 40 to 100%" },
          ],
        };
      }
      if (sym === "QQQ") {
        return {
          question: "When does it sell into strength?",
          when: "A winning lot retraces 5% from its peak.",
          then: "QQQ sells 12% of that lot and rides the rest.",
          limits:
            "QQQ watches two markets: semiconductors and market internals. The 500-day band trim and the five watch markets are SPY settings.",
          keys: [
            { value: "5%", unit: "retrace", label: "from a lot's peak" },
            { value: "12%", unit: "of the lot", label: "sold per trim" },
            { value: "2", unit: "watch markets", label: "semiconductors, internals" },
          ],
        };
      }
      return {
        question: "When does it sell into strength?",
        when: "A lot retraces 2%.",
        then: "IWM sells the whole lot.",
        limits:
          "IWM watches two markets: junk-bond credit and the dollar. The 500-day band trim and the five watch markets are SPY settings.",
        keys: [
          { value: "2%", unit: "retrace", label: "triggers the sell" },
          { value: "100%", unit: "of the lot", label: "sold at once" },
          { value: "2", unit: "watch markets", label: "credit, the dollar" },
        ],
      };

    case "04":
      if (sym === "SPY") {
        return {
          question: "When does it leave?",
          when: "SPY closes 0.75% below its 160-day average, the protection line.",
          then: "Everything is sold at the next open. This is the one rule allowed to take a loss.",
          limits:
            "While out, only 90th-percentile fear buys. A close 0.5% back above the line brings the whole pool back in at once.",
          keys: [
            { value: "160", unit: "day average", label: "the protection line" },
            { value: "0.75%", unit: "below", label: "sells everything next open", amber: true },
            { value: "0.5%", unit: "above", label: "whole pool re-enters" },
          ],
        };
      }
      return {
        question: "When does it leave?",
        when: `${sym} has no protection line.`,
        then: `The 160-day average exit is SPY's alone; a close below that average does not trigger this rule for ${sym}.`,
        limits: "Switch to SPY to read the protection line.",
        keys: [{ value: "off", unit: "protection line", label: `not set for ${sym}` }],
      };

    default:
      if (sym === "SPY") {
        return {
          question: "Where does the cash go?",
          when: "A trim or an exit raises cash.",
          then: "Raised cash pools and waits for tested support or 90th-percentile fear, then goes back in through the buy.",
          limits:
            "Cooldown blocks can delay it: 12 days between re-entries and 5 days after the watch markets force a sell.",
          keys: [
            { value: "90th", unit: "percentile", label: "fear that brings cash back" },
            { value: "12", unit: "days", label: "between re-entries" },
            { value: "5", unit: "days", label: "after a watch-market sell" },
          ],
        };
      }
      return {
        question: "Where does the cash go?",
        when: "A sell raises cash.",
        then: `Raised cash waits for ${sym}'s next buy.`,
        limits:
          `SPY's recycle waits for tested support or 90th-percentile fear, with 12-day and 5-day cooldowns; those are SPY settings, and this page does not list ${sym}'s own.` +
          (sym === "IWM" ? " IWM also holds its 5% cash reserve until fear reaches the 85th percentile." : ""),
        keys: [
          ...lineKey,
          ...(sym === "IWM" ? [{ value: "5%", unit: "cash reserve", label: "held until the 85th percentile" }] : []),
        ],
      };
  }
}

// ---- component -------------------------------------------------------------------
const SIDE_CLASS: Record<Side, string> = {
  top: "md:flex-col md:items-center md:text-center md:justify-start",
  right: "md:items-center md:pl-[8.6%] md:text-left",
  left: "md:items-center md:flex-row-reverse md:pr-[8.6%] md:text-right",
};

export function RulebookCycle({ funds, drawn, instant }: { funds: FundsBySym; drawn: boolean; instant: boolean }) {
  const [step, setStep] = useState("01");
  const [sym, setSym] = useState<Sym>("SPY");
  const station = STATIONS.find((s) => s.n === step) ?? STATIONS[0];
  const d = detail(step, sym, funds[sym]);
  const t = (css: string) => (instant ? "none" : css);

  return (
    <div className={`grid gap-10 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start ${drawn ? "anno-in" : ""}`}>
      {/* the wheel: one SVG drawing, HTML buttons on top of it */}
      <div className="relative w-full max-w-[800px] mx-auto md:aspect-[800/560]">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="hidden md:block absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          <circle cx={CX} cy={CY} r={R + 40} fill="none" stroke="hsl(var(--beam-ghost))" strokeWidth="1" strokeDasharray="2 7" />

          {ARCS.map((a, i) => (
            <path
              key={i}
              d={arcPath(a.from + GAP, a.to - GAP, R)}
              fill="none"
              stroke={a.live ? "hsl(var(--beam-mid))" : "hsl(var(--beam-ghost))"}
              strokeWidth={a.live ? 1.8 : 1.2}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={drawn ? 0 : 1}
              style={{ transition: t(`stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1) ${200 + i * 380}ms`) }}
            />
          ))}
          {ARCS.filter((a) => a.live).map((a, i) => (
            <Arrow
              key={i}
              deg={a.to - GAP}
              r={R}
              color="hsl(var(--beam-mid))"
              style={{ opacity: drawn ? 1 : 0, transition: t(`opacity 0.2s ease ${700 + i * 380}ms`) }}
            />
          ))}

          {/* recycle → back to the buy */}
          {(() => {
            const s0 = at(198, R - NODE - 4), s1 = at(198, RETURN_R), e1 = at(342, RETURN_R), e0 = at(342, R - NODE - 4);
            return (
              <g style={{ opacity: drawn ? 1 : 0, transition: t("opacity 0.5s ease 2100ms") }}>
                <path
                  d={`M ${f1(s0.x)} ${f1(s0.y)} L ${f1(s1.x)} ${f1(s1.y)} A ${RETURN_R} ${RETURN_R} 0 0 1 ${f1(e1.x)} ${f1(e1.y)} L ${f1(e0.x)} ${f1(e0.y)}`}
                  fill="none"
                  stroke="hsl(var(--beam-dim))"
                  strokeWidth="1.2"
                  strokeDasharray="4 5"
                />
                <polygon points="0,0 -8,-4.5 -8,4.5" fill="hsl(var(--beam-dim))" transform={`translate(${f1(e0.x)} ${f1(e0.y)}) rotate(342)`} />
              </g>
            );
          })()}

          {STATIONS.map((s, i) => {
            const p = at(s.deg, R);
            const on = s.n === step;
            const exit = s.n === "04";
            const tone = exit ? "var(--accent)" : on ? "var(--beam-hot)" : "var(--beam-mid)";
            return (
              <g key={s.n} style={{ opacity: drawn ? 1 : 0, transition: t(`opacity 0.3s ease ${100 + i * 380}ms`) }}>
                <circle
                  cx={f1(p.x)}
                  cy={f1(p.y)}
                  r={NODE}
                  fill={on ? `hsl(${tone} / 0.16)` : "hsl(var(--background))"}
                  stroke={`hsl(${tone})`}
                  strokeWidth={on ? 2.4 : 1.4}
                />
                <text
                  x={f1(p.x)}
                  y={f1(p.y + 5)}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="14"
                  fontWeight="600"
                  fill={`hsl(${tone})`}
                >
                  {s.n}
                </text>
              </g>
            );
          })}
        </svg>

        {/* hub: what the loop runs on */}
        <div
          className="anno mb-5 md:mb-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[36%] md:text-center"
          style={{ top: `${(CY + 28) / VH * 100}%` }}
        >
          <div className="etched text-beam-dim">fear percentile</div>
          <div className="font-mono font-semibold text-beam-hot text-[26px] md:text-[34px] leading-tight">0-100</div>
          <p className="font-mono text-[12.5px] leading-snug text-beam-mid mt-0.5">Higher means more fear.</p>
          <p className="font-mono text-[12px] leading-snug text-beam-dim mt-1.5">
            Dip below the 22-day closing high, ranked against the previous 100 days.
          </p>
        </div>

        {/* stations: a vertical list on phones, placed around the ring from md up */}
        <div className="relative md:static" role="group" aria-label="The five rules, in cycle order">
          <div className="md:hidden absolute left-[21px] top-3 bottom-3 w-px bg-[hsl(var(--beam-ghost))]" aria-hidden="true" />
          {STATIONS.map((s, i) => {
            const on = s.n === step;
            const exit = s.n === "04";
            const style = {
              "--x": pct(s.box.x, VW),
              "--y": pct(s.box.y, VH),
              "--w": pct(s.box.w, VW),
              "--h": pct(s.box.h, VH),
              "--anno-delay": `${300 + i * 380}ms`,
            } as CSSProperties;
            return (
              <button
                key={s.n}
                type="button"
                data-station={s.n}
                aria-pressed={on}
                aria-controls="rulebook-step-panel"
                onClick={() => setStep(s.n)}
                style={style}
                className={`anno relative flex w-full gap-3 items-start text-left min-h-[44px] py-3 pr-2 md:py-0 md:pr-0 md:gap-0 md:min-h-0 md:absolute md:left-(--x) md:top-(--y) md:w-(--w) md:h-(--h) ${SIDE_CLASS[s.side]} ${on ? "bg-[hsl(var(--beam-hot)/0.07)] md:bg-transparent" : ""}`}
              >
                {/* phone dot; from md up the SVG draws it */}
                <span
                  className={`md:hidden shrink-0 grid place-items-center w-[43px] h-[43px] rounded-full border font-mono text-[13px] font-semibold bg-background ${exit ? "border-accent text-accent" : on ? "border-beam-hot text-beam-hot border-2" : "border-beam-mid text-beam-mid"}`}
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <span className="block min-w-0 pt-0.5 md:pt-0">
                  <span className={`block font-mono font-semibold tracking-[0.12em] text-[14px] md:text-[15px] ${on ? "text-beam-hot" : "text-beam-mid"}`}>
                    {s.name}
                  </span>
                  <span className={`block font-mono text-[13px] leading-snug mt-0.5 ${on ? "text-beam-mid" : "text-beam-dim"}`}>{s.summary}</span>
                </span>
              </button>
            );
          })}
          <div className="md:hidden etched text-beam-dim pl-[56px] mt-1 anno">then back to 02, the buy</div>
        </div>
      </div>

      {/* detail panel */}
      <div
        id="rulebook-step-panel"
        role="region"
        aria-labelledby="rulebook-step-title"
        className="anno border border-[hsl(var(--beam-ghost))] p-5 md:p-6"
        style={{ "--anno-delay": "900ms" } as CSSProperties}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-4">
          <h3 id="rulebook-step-title" className="font-mono font-semibold tracking-[0.14em] text-beam-hot text-[17px]">
            <span className={station.n === "04" ? "text-accent" : "text-beam-dim"}>{station.n}</span> {station.name}
          </h3>
          <div className="flex gap-px bg-[hsl(var(--beam-ghost))] border border-[hsl(var(--beam-ghost))]" role="group" aria-label="Fund">
            {FUNDS.map((fd) => (
              <button
                key={fd.sym}
                type="button"
                data-fund={fd.sym}
                aria-pressed={sym === fd.sym}
                onClick={() => setSym(fd.sym)}
                className={`min-h-[44px] md:min-h-[32px] px-3 font-mono text-[13px] leading-none flex flex-col items-center justify-center gap-1 ${sym === fd.sym ? "bg-[hsl(var(--beam-hot)/0.14)] text-beam-hot" : "bg-background text-beam-mid hover:text-beam-hot"}`}
              >
                <span className="font-semibold tracking-[0.1em]">{fd.sym}</span>
                <span className="text-[10.5px] tracking-[0.12em] uppercase text-beam-dim">{fd.nick}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="font-mono text-beam-hot text-[18px] md:text-[20px] leading-snug mb-4">{d.question}</p>

        <dl className="font-mono text-[14px] leading-relaxed">
          {([["when", d.when], ["then", d.then], ["limits", d.limits]] as const).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2.5 border-t border-[hsl(var(--beam-ghost))]">
              <dt className="etched text-beam-dim pt-[3px]">{k}</dt>
              <dd className="text-beam-mid">{v}</dd>
            </div>
          ))}
        </dl>

        {d.keys.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 pt-4 border-t border-[hsl(var(--beam-ghost))]">
            {d.keys.map((k) => (
              <div key={`${k.value}-${k.label}`} className="border-l border-[hsl(var(--beam-ghost))] pl-3 pr-2">
                <div className={`font-mono font-semibold text-[24px] leading-none ${k.amber ? "text-accent" : "text-beam-hot"}`}>{k.value}</div>
                <div className="etched text-beam-mid text-[11px] tracking-[0.08em] mt-1.5">{k.unit}</div>
                <div className="font-mono text-[12px] leading-snug text-beam-dim mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>
        )}

        <p className="etched text-beam-dim text-[11px] mt-5">
          {sym === "SPY" ? "SPY's rules. QQQ and IWM differ; use the switch." : `${sym}'s own values where known; SPY settings are marked.`} Rules, not account results.
        </p>
      </div>
    </div>
  );
}
