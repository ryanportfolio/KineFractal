// about-story-model — data + timeline for the About page's scroll film.
//
// Every plotted value comes from a bundled engine artifact:
//   canyon    SPY full-history report, buy-and-hold leg drawdown (monthly)
//   episode   episodes/spy-2020.json (daily close, fear reading, simulated fills)
//   cohorts   board.json startCohorts (SPY, all cash from each start year)
//   funds     each deployed fund's full report, independent calendar years
// Nothing here invents a number. Counts are derived, never typed in.
import type { Board, LabReport } from "@/data/lab-data";

export type EpDay = { d: string; c: number; fear: number | null };
export type EpFill = { d: string; side: "buy" | "sell"; eng?: string; tag?: string; pctEq: number | null };
export type Episode = { sym: string; window: string; preset: string; days: EpDay[]; fills: EpFill[] };

// ---- timeline ---------------------------------------------------------------
// Scroll progress 0..1 is cut into beats. Scene code reads local 0..1 time per
// beat; captions fade on the same windows.
export const BEATS = {
  ignite: [0, 0.06],
  canyon: [0.06, 0.25],
  dive: [0.25, 0.33],
  episode: [0.33, 0.63],
  cohorts: [0.63, 0.77],
  years: [0.77, 0.9],
  close: [0.9, 1],
} as const satisfies Record<string, readonly [number, number]>;
export type BeatId = keyof typeof BEATS;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const beatT = (p: number, id: BeatId) => {
  const [a, b] = BEATS[id];
  return clamp01((p - a) / (b - a));
};
/**
 * 0 outside [a,b], 1 inside, with `edge`-wide linear fades just inside both
 * ends, so back-to-back windows (b of one == a of the next) never overlap
 */
export function windowAlpha(p: number, a: number, b: number, edge = 0.012): number {
  if (p <= a || p >= b) return 0;
  const e = Math.min(edge, (b - a) / 2);
  return Math.min(clamp01((p - a) / e), clamp01((b - p) / e));
}

// ---- playback pace ----------------------------------------------------------------
// Scroll sets where the reader wants to be; the film moves there no faster than
// these limits, so a hard flick still plays every beat. Inside a caption's
// window the limit stretches the window over the caption's reading time;
// between captions (camera flights, scene reveals) the film may move at most
// FREE_RATE. Rewinding is allowed REWIND_MULT times faster.
export const FREE_RATE = 1 / 45; // progress per second with no caption up
export const REWIND_MULT = 4;
/** how far scroll may run ahead of the film before the page is held */
export const SCROLL_LEAD = 0.01;

export interface PaceWindow { a: number; b: number; read: number }

/** seconds to read a caption: ~210 words a minute plus a beat to notice it */
export function readSecs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(7, Math.max(2.5, 1.5 + words * 0.29));
}

/** fastest allowed forward progress per second at progress p */
export function paceLimit(windows: PaceWindow[], p: number): number {
  let lim = FREE_RATE;
  for (const w of windows) {
    if (p >= w.a && p < w.b) lim = Math.min(lim, (w.b - w.a) / w.read);
  }
  return lim;
}

/** one playback step: eased toward target, clamped to the pace limit */
export function stepShown(windows: PaceWindow[], shown: number, target: number, dt: number): number {
  const eased = (target - shown) * (1 - Math.exp(-dt * 6));
  const lim = paceLimit(windows, shown) * dt;
  const next = shown + Math.max(-lim * REWIND_MULT, Math.min(lim, eased));
  return Math.abs(target - next) < 1e-5 ? target : next;
}

// ---- playback ----------------------------------------------------------------------
// Scroll position (`page`, 0..1 through the film section) and film position
// (`shown`) are decoupled:
//   before AUTOPLAY_AT   the film follows scroll at the capped pace, and the page
//                        is held SCROLL_LEAD ahead of it
//   autoplay             once the reader has pushed a little way into the film
//                        (the spot has lit), the film plays to the end at its own pace; the page
//                        is carried along and scrolling down cannot outrun it.
//                        Scrolling up rewinds and pauses autoplay; scrolling down
//                        again resumes it.
//   finished             after the film has reached the end once (or was
//                        skipped), scroll drives it directly with no cap
export const AUTOPLAY_AT = 0.015;
const REWIND_EPS = 0.002;

export class StoryPlayback {
  shown: number;
  page: number;
  wanted: number;
  auto = false;
  finished: boolean;
  private heldAt = -1e9;

  constructor(private pace: PaceWindow[], start: number) {
    this.shown = this.page = this.wanted = start;
    this.finished = start >= 1;
  }

  /** the reader scrolled to `page`; returns a progress to hold the page at, or null */
  onScroll(page: number, now: number): number | null {
    this.page = page;
    if (this.finished) {
      this.wanted = page;
      return null;
    }
    if (page < this.shown - REWIND_EPS) {
      this.auto = false;
      this.wanted = page;
      return null;
    }
    if (page > this.wanted) this.wanted = page;
    if (!this.auto && this.shown >= AUTOPLAY_AT && page > this.shown + 1e-4) this.auto = true;
    const max = this.shown + (this.auto ? 0 : SCROLL_LEAD);
    if (page > max + 1e-4) {
      this.heldAt = now;
      this.page = max;
      return max;
    }
    return null;
  }

  /** advance the film; returns a progress to carry the page to, or null */
  tick(dt: number): number | null {
    if (this.finished) {
      const next = this.shown + (this.wanted - this.shown) * (1 - Math.exp(-dt * 6));
      this.shown = Math.abs(this.wanted - next) < 1e-5 ? this.wanted : next;
      return null;
    }
    if (!this.auto && this.shown >= AUTOPLAY_AT && this.wanted > this.shown + 1e-4) this.auto = true;
    if (this.auto) this.wanted = 1;
    this.shown = stepShown(this.pace, this.shown, this.wanted, dt);
    if (this.shown >= 1) {
      this.finished = true;
      this.auto = false;
    }
    if (this.wanted > this.page) {
      const carry = this.auto || this.finished ? this.shown : Math.min(this.wanted, this.shown + SCROLL_LEAD);
      if (carry > this.page + 1e-4) {
        this.page = carry;
        return carry;
      }
    }
    return null;
  }

  skip() {
    this.shown = this.wanted = this.page = 1;
    this.finished = true;
    this.auto = false;
  }

  /** offer a skip while the film is autoplaying or holding the reader back */
  skipOffered(now: number): boolean {
    return !this.finished && (this.auto || now - this.heldAt < 2500);
  }
}

// ---- the 2020 episode's narrated events ---------------------------------------
// Date -> caption. Each must match a fill of the same side in the episode file
// (enforced by the model test); the copy mirrors the homepage rulebook callouts.
export const EPISODE_EVENTS: { d: string; side: "buy" | "sell"; text: (day: EpDay, fill: EpFill) => string }[] = [
  { d: "2020-02-03", side: "sell", text: (_d, f) => `A breadth warning trims ${pctLabel(f.pctEq)} while prices are still near the high.` },
  { d: "2020-03-09", side: "sell", text: (d) => `Fear reads ${d.fear}. The protective exit sells everything and steps aside.` },
  { d: "2020-03-12", side: "buy", text: (_d, f) => `Three sessions later, redeploy buys back ${pctLabel(f.pctEq)}.` },
  { d: "2020-03-23", side: "buy", text: () => "A small sniper buy lands on the lowest close of the year." },
  { d: "2020-05-29", side: "buy", text: (_d, f) => `Reclaim buys back the rest: ${pctLabel(f.pctEq)} of the account.` },
  { d: "2020-06-09", side: "sell", text: (_d, f) => `Into the rally, a trim sells ${pctLabel(f.pctEq)}.` },
];
const pctLabel = (v: number | null) => (v == null ? "part" : `${Math.round(v)}%`);

// ---- episode cursor --------------------------------------------------------------
// Inside the episode beat the cursor walks the year's sessions. Time slows
// around each narrated event so its caption can be read before the next one;
// a flat 253-session sweep would spend 0.3% of the scroll between Mar 9 and 12.
const EP_LEAD = 0.06; // beat fraction held at the first session
const EP_SPAN = 0.88;

export interface EpisodeClock {
  /** session cursor (fractional) at scroll progress p */
  cursor(p: number): number;
  /** scroll progress at which the cursor reaches session i */
  progressAt(i: number): number;
}

export function episodeClock(n: number, eventIdx: number[]): EpisodeClock {
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    let w = 1;
    for (const e of eventIdx) w += 14 * Math.exp(-(((i - 0.5 - e) / 2.2) ** 2));
    cum[i] = cum[i - 1] + w;
  }
  const total = cum[n - 1] || 1;
  const [a, b] = BEATS.episode;
  return {
    cursor(p) {
      const u = clamp01((beatT(p, "episode") - EP_LEAD) / EP_SPAN) * total;
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= u) lo = mid; else hi = mid;
      }
      const seg = cum[hi] - cum[lo];
      return seg > 0 ? lo + (u - cum[lo]) / seg : lo;
    },
    progressAt(i) {
      const k = Math.max(0, Math.min(n - 1, i));
      const lo = Math.floor(k), hi = Math.min(n - 1, lo + 1);
      const c = cum[lo] + (cum[hi] - cum[lo]) * (k - lo);
      return a + (EP_LEAD + (c / total) * EP_SPAN) * (b - a);
    },
  };
}

// ---- derived story data ----------------------------------------------------------
export interface CanyonMark { label: string; i: number; dd: number }
export interface FundYears {
  sym: string;
  variant: string;
  years: { y: number; ahead: boolean; partial: boolean }[];
  ahead: number;
  total: number;
}
export interface StoryData {
  canyon: { t: number; dd: number }[];
  canyonMarks: CanyonMark[];
  canyonRange: string; // "1993 to 2026"
  spyVariant: string;
  episode: Episode & {
    variant: string;
    lowIndex: number;
    events: { i: number; fill: EpFill; text: string; side: "buy" | "sell" }[];
  };
  cohorts: { year: number; s: number; b: number; edge: number }[];
  cohortsAhead: number;
  cohortPreset: string;
  cohortEnd: string;
  funds: FundYears[];
  firstYear: number;
  lastYear: number;
}

const yearOf = (t: number) => new Date(t * 1000).getUTCFullYear();

// Named crash windows for the canyon labels. The window picks where to look;
// the label and depth come from the deepest month the data holds inside it.
const CANYON_WINDOWS: [number, number][] = [[2000, 2003], [2007, 2009], [2020, 2020], [2022, 2022]];

export function buildStory(
  reports: { spy: LabReport; qqq: LabReport; iwm: LabReport },
  board: Board,
  ep: Episode,
): StoryData {
  const spy = reports.spy;
  const canyon = spy.drawdown.map((p) => ({ t: p.t, dd: p.b }));

  const canyonMarks: CanyonMark[] = [];
  for (const [y0, y1] of CANYON_WINDOWS) {
    let best = -1;
    canyon.forEach((p, i) => {
      const y = yearOf(p.t);
      if (y >= y0 && y <= y1 && (best < 0 || p.dd < canyon[best].dd)) best = i;
    });
    if (best >= 0 && canyon[best].dd < -5) {
      canyonMarks.push({ label: String(yearOf(canyon[best].t)), i: best, dd: canyon[best].dd });
    }
  }

  const days = ep.days;
  let lowIndex = 0;
  days.forEach((d, i) => { if (d.c < days[lowIndex].c) lowIndex = i; });
  const idx = new Map(days.map((d, i) => [d.d, i]));
  const events = EPISODE_EVENTS.flatMap((e) => {
    const i = idx.get(e.d);
    const fill = ep.fills.find((f) => f.d === e.d && f.side === e.side);
    return i == null || !fill ? [] : [{ i, fill, side: e.side, text: e.text(days[i], fill) }];
  });

  const cohorts = board.startCohorts.rows.map((r) => ({
    year: r.year, s: r.strategy_pct, b: r.benchmark_pct, edge: r.edge_pp,
  }));

  const funds: FundYears[] = (["spy", "qqq", "iwm"] as const).map((k) => {
    const r = reports[k];
    const years = r.yearlyBasis === "flat"
      ? r.yearly.map((y) => ({ y: y.y, ahead: y.edge > 0, partial: !!y.partial }))
      : [];
    const done = years.filter((y) => !y.partial);
    return {
      sym: r.sym,
      variant: r.variant ?? "",
      years,
      ahead: done.filter((y) => y.ahead).length,
      total: done.length,
    };
  });
  const allYears = funds.flatMap((f) => f.years.map((y) => y.y));

  return {
    canyon,
    canyonMarks,
    canyonRange: `${yearOf(canyon[0].t)} to ${yearOf(canyon[canyon.length - 1].t)}`,
    spyVariant: spy.variant ?? "",
    episode: {
      ...ep,
      variant: ep.preset.match(/-(v[\d.]+)-/)?.[1] ?? "",
      lowIndex,
      events,
    },
    cohorts,
    cohortsAhead: cohorts.filter((c) => c.edge > 0).length,
    cohortPreset: board.startCohorts.preset,
    cohortEnd: board.startCohorts.rows[0]?.end ?? "",
    funds,
    firstYear: Math.min(...allYears),
    lastYear: Math.max(...allYears),
  };
}

export const fmtPct = (v: number) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;
