// Rulebook — movement: THE RULEBOOK.
//
// Teaches the deployed engine's actual rules in plain words, then proves them
// on a real replayed year: episodes/spy-2020.json (static artifact emitted by
// fearlab/emit_episode.py from the deployed preset — regenerate only when the
// deployed preset changes). The strip is the scene: SPY 2020 closes, the fear
// percentile underneath, and each simulated fill ticked where it happened.
//
// Below the replay, the five rules run as a loop (rulebook-cycle.tsx): a wheel
// of stations, a when / then / limits panel per step and a SPY / QQQ / IWM
// switch. Rule numbers = deployed preset facts (presets.json fav-spy-v4.6-1d
// etc.); live buy-line and order-size numbers bind to the same live fear state
// the HOW IT BUYS rails render.
import { useEffect, useMemo, useState } from "react";
import { BeamHeading } from "@/components/beam-heading";
import { DecodeText } from "@/components/decode-text";
import { useBeam } from "@/hooks/use-beam";
import { useFearState } from "@/hooks/use-fear-state";
import { RulebookCycle, type FundsBySym } from "@/components/rulebook-cycle";
import { DEPLOY } from "@/data/fearlab-board";

// Version label comes from the episode file's own preset, not the deploy: the
// replay is a static artifact and may lag a deploy relabel until re-emitted.
const presetVariant = (preset: string) => preset.match(/-(v[\d.]+)-/)?.[1] ?? null;

type EpDay = { d: string; c: number; fear: number | null };
type EpFill = { d: string; side: "buy" | "sell"; eng?: string; tag?: string; usd: number; pctEq: number | null; lots?: number };
type Episode = { sym: string; window: string; preset: string; days: EpDay[]; fills: EpFill[] };

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

        <p className="font-mono text-[14px] md:text-[15px] mt-14 mb-8 max-w-[72ch] leading-relaxed text-beam-mid">
          Five rules run as one loop, checked at every close. Pick a step to read its rule. The fund switch shows where QQQ and IWM
          differ from SPY.
        </p>

        <RulebookCycle funds={funds} drawn={drawn} instant={instant} />
      </div>
    </section>
  );
}
