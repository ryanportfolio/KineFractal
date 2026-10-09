// Rulebook — movement: THE RULEBOOK.
//
// Teaches the deployed engine's actual rules in plain words, then proves them
// on a real replayed year: episodes/spy-2020.json (static artifact emitted by
// fearlab/emit_episode.py from the deployed preset — regenerate only when the
// deployed preset changes). The strip is the scene: SPY 2020 closes, the fear
// percentile underneath, and each simulated fill ticked where it happened.
//
// Copy register: fragments joined with · and →, no em dashes, no jargon term
// before its plain-words meaning. Rule numbers = deployed preset facts
// (presets.json fav-spy-v4.6-1d etc.); live buy-line/curve numbers in cards
// 01-02 bind to the same live fear state section 05 renders.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BeamHeading } from "@/components/beam-heading";
import { DecodeText } from "@/components/decode-text";
import { useBeam } from "@/hooks/use-beam";
import { useFearState, type FundFear } from "@/hooks/use-fear-state";
import { DEPLOY } from "@/data/fearlab-board";
import { ord } from "@/data/lab-data";

// Version label comes from the episode file's own preset, not the deploy: the
// replay is a static artifact and may lag a deploy relabel until re-emitted.
const presetVariant = (preset: string) => preset.match(/-(v[\d.]+)-/)?.[1] ?? null;

type EpDay = { d: string; c: number; fear: number | null };
type EpFill = { d: string; side: "buy" | "sell"; eng?: string; tag?: string; usd: number; pctEq: number | null; lots?: number };
type Episode = { sym: string; window: string; preset: string; days: EpDay[]; fills: EpFill[] };

const AmbientWave = lazy(() => import("@/components/ambient-wave"));

function LazyAmbientWave() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="h-[180px] w-full max-w-[270px]" aria-hidden="true">
      {near && (
        <Suspense fallback={null}>
          <AmbientWave />
        </Suspense>
      )}
    </div>
  );
}

// the strip's callouts: date -> short plain label (all verifiable in the file)
const CALLOUTS: Record<string, { text: string; side: "buy" | "sell" }> = {
  "2020-02-03": { text: "breadth watch trims 85%", side: "sell" },
  "2020-03-09": { text: "protective exit sells all", side: "sell" },
  "2020-03-12": { text: "redeploy buys back 96%", side: "buy" },
  "2020-03-23": { text: "sniper at the exact low", side: "buy" },
  "2020-05-29": { text: "reclaim brings the rest home", side: "buy" },
  "2020-06-09": { text: "trim takes 80% into the rally", side: "sell" },
};

const W = 1000;
const H = 260;
const PRICE_H = 190; // price band height; fear strip lives below it
const FEAR_Y0 = 210; // top of the fear strip
const FEAR_H = 44;

function EpisodeStrip({ ep, drawn, instant }: { ep: Episode; drawn: boolean; instant: boolean }) {
  const { pts, fearBars, ticks, callouts } = useMemo(() => {
    const days = ep.days;
    const n = days.length;
    const lo = Math.min(...days.map((d) => d.c));
    const hi = Math.max(...days.map((d) => d.c));
    const x = (i: number) => (i / (n - 1)) * (W - 16) + 8;
    const y = (c: number) => 12 + (1 - (c - lo) / (hi - lo)) * (PRICE_H - 24);
    const idx = new Map(days.map((d, i) => [d.d, i]));

    const pts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.c).toFixed(1)}`).join(" ");
    const fearBars = days.map((d, i) => ({
      x: x(i),
      h: ((d.fear ?? 0) / 100) * FEAR_H,
    }));

    // one tick per fill; big moves (>=50% of equity) get emphasis
    const ticks = ep.fills
      .filter((f) => idx.has(f.d))
      .map((f) => {
        const i = idx.get(f.d)!;
        return {
          x: x(i),
          y: y(days[i].c),
          side: f.side,
          big: (f.pctEq ?? 0) >= 50,
          key: `${f.d}-${f.side}-${f.eng ?? f.tag}`,
        };
      });

    const callouts = Object.entries(CALLOUTS)
      .filter(([d]) => idx.has(d))
      .map(([d, c], k) => {
        const i = idx.get(d)!;
        return {
          x: x(i),
          y: y(days[i].c),
          text: `${d.slice(5)} ${c.text}`,
          side: c.side,
          up: k % 2 === 0, // alternate label stems so they never collide
        };
      });

    return { pts, fearBars, ticks, callouts };
  }, [ep]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full block"
      role="img"
      aria-label="SPY 2020 simulated backtest: daily closes, fear percentile, and simulated next-open fills"
    >
      {/* graticule */}
      <line x1="8" y1={PRICE_H} x2={W - 8} y2={PRICE_H} stroke="hsl(var(--beam-ghost))" strokeWidth="1" />
      <line x1="8" y1={FEAR_Y0 + FEAR_H} x2={W - 8} y2={FEAR_Y0 + FEAR_H} stroke="hsl(var(--beam-ghost))" strokeWidth="1" />

      {/* fear percentile strip: amber, the register reserved for fear */}
      {fearBars.map((b, i) => (
        <line
          key={i}
          x1={b.x}
          y1={FEAR_Y0 + FEAR_H}
          x2={b.x}
          y2={FEAR_Y0 + FEAR_H - b.h}
          stroke="hsl(var(--accent) / 0.55)"
          strokeWidth={(W - 16) / fearBars.length}
          style={{ opacity: drawn ? 1 : 0, transition: instant ? "none" : `opacity 0.3s ease ${600 + i * 2}ms` }}
        />
      ))}

      {/* price line */}
      <polyline
        points={pts}
        fill="none"
        stroke="hsl(var(--beam-hot))"
        strokeWidth="1.6"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={drawn ? 0 : 1}
        style={{ transition: instant ? "none" : "stroke-dashoffset 2.2s ease" }}
      />

      {/* fills: up tick under the line = buy, down tick above = sell */}
      {ticks.map((t) => (
        <line
          key={t.key}
          x1={t.x}
          y1={t.side === "buy" ? t.y + 6 : t.y - 6}
          x2={t.x}
          y2={t.side === "buy" ? t.y + (t.big ? 22 : 13) : t.y - (t.big ? 22 : 13)}
          stroke={t.side === "buy" ? "hsl(var(--beam-mid))" : "hsl(var(--accent))"}
          strokeWidth={t.big ? 2.2 : 1.2}
          style={{ opacity: drawn ? 1 : 0, transition: instant ? "none" : "opacity 0.4s ease 1.6s" }}
        />
      ))}

      {/* callouts with leader stems, alternating above/below */}
      {callouts.map((c, i) => {
        const ly = c.up ? Math.max(14, c.y - 46) : Math.min(PRICE_H - 6, c.y + 52);
        const anchor = c.x > W - 230 ? "end" : c.x < 220 ? "start" : "middle";
        return (
          <g key={i} className="hidden md:inline" style={{ opacity: drawn ? 1 : 0, transition: instant ? "none" : `opacity 0.5s ease ${1800 + i * 180}ms` }}>
            <line x1={c.x} y1={c.y + (c.up ? -8 : 8)} x2={c.x} y2={ly + (c.up ? 6 : -10)} stroke="hsl(var(--beam-dim) / 0.6)" strokeWidth="0.8" />
            <text
              x={c.x}
              y={ly}
              textAnchor={anchor}
              className="font-mono"
              fontSize="11"
              fill={c.side === "sell" ? "hsl(var(--accent))" : "hsl(var(--beam-mid))"}
            >
              {c.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- the five rules (SPY flagship numbers; per-fund contrast below) ----------
// Buy lines and max sizes come from the same live fear blocks the HOW IT BUYS
// gauges read (useFearState), so a preset change cannot strand this copy.
type FundsBySym = Partial<Record<"SPY" | "QQQ" | "IWM", FundFear>>;

function buyRule({ SPY, QQQ, IWM }: FundsBySym): string {
  const spy = SPY ? `SPY buys once fear reaches the ${ord(SPY.floorPct)} percentile` : "SPY buys once fear crosses its buy line";
  const others = QQQ && IWM ? ` (QQQ waits for the ${ord(QQQ.floorPct)}, IWM the ${ord(IWM.floorPct)})` : "";
  return `${spy}${others} · sizing starts at 3% of the account and climbs toward everything available as fear deepens · big buys wait 16 trading days between shots · small buys may also fire: 0.5% the day a dip first passes 1.75%, 1 to 10% when a reversal prints at a tested support`;
}

function ruleCards(funds: FundsBySym): { n: string; name: string; body: string }[] {
  return [
    {
      n: "01",
      name: "THE GAUGE",
      body: "every close asks one question → how far did today dip below the highest close of the last 22 trading days · that dip, ranked against the previous 100 days, becomes the day's fear score · every other rule keys off it",
    },
    {
      n: "02",
      name: "THE BUY",
      body: buyRule(funds),
    },
    {
      n: "03",
      name: "THE TRIM",
      body: "sells only what is profitable, never at a loss · price stretched a full band above its own 500-day smoothed path → sell up to 80% of the account, most profitable lots first · five other markets stand watch while price climbs: equal-weight breadth, semiconductors, transports, inflation bonds, IPO appetite → any of them rotting trims 40 to 100%",
    },
    {
      n: "04",
      name: "THE EXIT",
      body: "close 0.75% below the 160-day average → everything sold at the next open, the one rule allowed to take a loss · while out, only 90th-percentile fear buys · close 0.5% back above the line → the whole pool re-enters at once",
    },
    {
      n: "05",
      name: "THE RECYCLE",
      body: "raised cash pools and waits for tested support or 90th-percentile fear · cooldown blocks can delay it: 12 days between re-entries and 5 days after the watch markets force a sell",
    },
  ];
}

// per-fund contrast: where the three deployments genuinely differ. Buy line
// and max size are live (same fear block as the gauges); the rest are preset
// facts the report JSON does not carry (IWM: reservePct 5, reserveFloorPct 85).
function contrast({ SPY, QQQ, IWM }: FundsBySym) {
  return [
    {
      sym: "SPY",
      tone: "the eager one",
      lines: [
        SPY ? `buys from the ${ord(SPY.floorPct)} percentile, up to ${SPY.maxPct}% of the account per buy` : "buys early in a dip, nearly all-in per buy",
        "five market watches + support snipers",
        "protection line on: the 160-day average is the exit",
      ],
    },
    {
      sym: "QQQ",
      tone: "the patient one",
      lines: [
        QQQ ? `waits for the ${ord(QQQ.floorPct)} percentile · only extreme fear sizes up, ${QQQ.maxPct}% max` : "waits for deep fear · only extreme fear sizes up",
        "rides winners: sells 12% of a lot on a 5% retrace from its peak",
        "watches semiconductors + market internals · no protection line",
      ],
    },
    {
      sym: "IWM",
      tone: "the cautious one",
      lines: [
        `${IWM ? `${ord(IWM.floorPct)}-percentile buy line · ${IWM.maxPct}% max per buy` : "small buys that grow with fear"} · 5% cash reserve until fear hits the 85th`,
        "sells a whole lot after a 2% retrace",
        "watches junk-bond credit + the dollar · no protection line",
      ],
    },
  ];
}

// Replay files whose preset differs from the deploy only by name: the engine's
// presets.json carries identical SPY settings for these pairs (verified
// 2026-10-09 against range@prod, fav-spy-v4.6-1d vs fav-spy-v4.7-1d).
const SAME_SPY_SETTINGS = new Set(["v4.6>v4.7"]);

export function Rulebook() {
  const { ref, phase } = useBeam<HTMLElement>({ releaseAfter: 3600 });
  const fear = useFearState();
  const [ep, setEp] = useState<Episode | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/fearlab/episodes/spy-2020.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j?.days?.length) setEp(j); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const drawn = phase !== "dark";
  const instant = phase === "held";
  const funds: FundsBySym = Object.fromEntries(fear.funds.map((f) => [f.sym, f]));
  const epVariant = ep ? presetVariant(ep.preset) : null;
  // same report the thresholds come from; bundled DEPLOY only while it loads or offline
  const deployVariant = funds.SPY?.variant ?? DEPLOY.find((d) => d.sym === "SPY")?.variant ?? null;
  const replayNote = epVariant && deployVariant && epVariant !== deployVariant
    ? `Recorded under ${epVariant}; the site now runs ${deployVariant}${SAME_SPY_SETTINGS.has(`${epVariant}>${deployVariant}`) ? ", which keeps the same SPY settings" : ""}.`
    : null;
  return (
    <section ref={ref} id="rulebook" className="px-5 md:px-10 py-24 scroll-mt-16" aria-label="The rulebook: how the engine works">
      <div className="max-w-6xl mx-auto">
        <div className="etched text-beam-dim mb-2" aria-hidden="true">05</div>
        <div className="max-w-[560px] mb-3">
          <BeamHeading text="SPY, STEP BY STEP" as="h2" active={drawn} instant={instant} />
        </div>
        <p className="etched mb-10 max-w-[72ch]">
          <DecodeText
            text={`SPY ${epVariant ? `${epVariant} ` : ""}full-history backtest, viewed during 2020. Simulated next-open fills.`}
            active={drawn}
            instant={instant}
          />
          {replayNote && <span className="block mt-1 text-beam-dim">{replayNote}</span>}
        </p>

        {/* the scene: 2020 replayed */}
        {ep ? (
          <div className={`mb-4 ${drawn ? "anno-in" : ""}`}>
            {/* phones: 1000-wide scene squeezed to 375px makes the ticks and
                fear bars unreadable — let it keep ~2x width and scroll, same
                affordance as the monthly table */}
            <div className="overflow-x-auto overscroll-x-contain">
              <div className="min-w-[680px] md:min-w-0">
                <EpisodeStrip ep={ep} drawn={drawn} instant={instant} />
              </div>
            </div>
            <div className="etched text-beam-dim mt-1 md:hidden anno" aria-hidden="true">
              swipe the scene →
            </div>
            <div className="etched text-beam-dim mt-2 anno">
              SPY 2020 simulated replay · <span className="text-beam-mid">green line</span> price ·{" "}
              <span className="text-accent">amber strip</span> fear percentile · up ticks buys · down ticks sells · tall ticks move ≥50% of the account
            </div>
            {/* small screens: the SVG callouts are unreadable at phone scale, list them instead */}
            <ul className="md:hidden mt-3 space-y-1 anno">
              {Object.entries(CALLOUTS).map(([d, c]) => (
                <li key={d} className={`etched ${c.side === "sell" ? "text-accent" : "text-beam-mid"}`}>
                  {d.slice(5)} · {c.text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="etched py-6 text-beam-dim mb-4">episode feed offline</div>
        )}

        <p className="etched mb-6 max-w-[76ch] leading-relaxed text-beam-dim">
          Five moves shape SPY. QQQ and IWM use different thresholds and exits.
        </p>

        {/* the five rules */}
        <div className={`grid gap-px bg-[hsl(var(--beam-ghost))] border border-[hsl(var(--beam-ghost))] md:grid-cols-2 lg:grid-cols-3 mb-12 ${drawn ? "anno-in" : ""}`}>
          {ruleCards(funds).map((r) => (
            <div key={r.n} className="bg-background p-5 anno">
              <div className="etched text-beam-dim mb-1">{r.n}</div>
              <h3 className="font-mono font-semibold tracking-[0.14em] text-beam-hot mb-3">{r.name}</h3>
              <p className="font-mono text-[14px] md:text-[15.5px] leading-relaxed text-beam-mid">{r.body}</p>
            </div>
          ))}
          {/* sixth cell: the retired standing-wave language, now purely atmospheric */}
          <div className="bg-background p-5 hidden lg:flex items-center justify-center" aria-hidden="true">
            <LazyAmbientWave />
          </div>
        </div>

        {/* per-fund contrast */}
        <div className="etched text-beam-dim mb-3">same rulebook, three temperaments</div>
        <div className={`grid gap-px bg-[hsl(var(--beam-ghost))] border border-[hsl(var(--beam-ghost))] md:grid-cols-3 ${drawn ? "anno-in" : ""}`}>
          {contrast(funds).map((c) => (
            <div key={c.sym} className="bg-background p-5 anno">
              <div className="font-mono font-semibold text-beam-hot text-lg mb-1.5">{c.sym}</div>
              <div className="etched mb-4">
                <span className="hl-mark">{c.tone}</span>
              </div>
              {c.lines.map((l, i) => (
                <p key={i} className="font-mono text-[14px] md:text-[15.5px] leading-relaxed text-beam-mid mb-2.5">{l}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
