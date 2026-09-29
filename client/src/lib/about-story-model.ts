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
// FREE_RATE. The limits apply forward only: rewinding eases straight to the
// reader's scroll position (about 90% of the way in 0.3 s), whatever the gap.
export const FREE_RATE = 1 / 45; // progress per second with no caption up
/** how far scroll may run ahead of the film before the page is held */
export const SCROLL_LEAD = 0.01;

export interface PaceWindow { a: number; b: number; read: number }

/** seconds to read a caption: ~200 words a minute plus a beat to notice it */
export function readSecs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(16, Math.max(3, 1.5 + words * 0.3));
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
  if (target < shown) {
    const back = shown + (target - shown) * (1 - Math.exp(-dt * 8));
    return Math.abs(target - back) < 1e-5 ? target : back;
  }
  const eased = (target - shown) * (1 - Math.exp(-dt * 6));
  const lim = paceLimit(windows, shown) * dt;
  const next = shown + Math.min(lim, eased);
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
  /**
   * The reader is below a film that has not played (data arrived late, or
   * keyboard focus jumped past it). The film is parked at its end: scrolling
   * back up rewinds it with no hold, and only a fresh downward push plays it.
   */
  parked = false;
  private heldAt = -1e9;

  constructor(private pace: PaceWindow[], start: number) {
    this.shown = this.page = this.wanted = start;
    this.finished = start >= 1;
  }

  /**
   * Playback for a film whose data arrived while the reader was at `page`.
   * The film always starts unplayed at its first frame, so no caption is
   * skipped. A reader inside the film is held back to the start (the returned
   * `holdAt`); a reader already below it is left where they are, and the usual
   * hold takes them to the start if they scroll back into the film.
   */
  static atLoad(pace: PaceWindow[], page: number): { play: StoryPlayback; holdAt: number | null } {
    const play = new StoryPlayback(pace, 0);
    if (page >= 1) {
      play.park();
      return { play, holdAt: null };
    }
    const inside = page > SCROLL_LEAD;
    // held back to the start: the model's page is where the page is moved to,
    // so the reader's first downward scroll reads as downward and plays
    play.page = inside ? 0 : Math.max(0, page);
    return { play, holdAt: inside ? 0 : null };
  }

  /** the reader is now below the film without having played it (see `parked`) */
  park(pageNow = 1) {
    if (this.finished) return;
    this.shown = this.wanted = 1;
    this.page = pageNow; // where the page is now (the End key parks before it moves)
    this.auto = false;
    this.parked = true;
  }

  /** the reader scrolled to `page`; returns a progress to hold the page at, or null */
  onScroll(page: number, now: number): number | null {
    // any upward move by the reader, however small, pauses autoplay so the next
    // tick cannot carry the page back down over it (the film's own carries
    // only ever move the page down)
    // (the page's own scrolls never reach here: the component recognises them
    // by their landing pixel and skips them, so any upward move is the reader)
    const up = page < this.page - 1e-9;
    this.page = page;
    if (this.finished) {
      this.wanted = page;
      return null;
    }
    if (this.parked) {
      // below the film, or scrolling back up into it: follow, never hold
      // (only a move up unparks: a smooth scroll still travelling down to the
      // end, End key or a link below, passes through the film on its way)
      if (up && page < this.shown - REWIND_EPS) {
        this.parked = false;
        this.wanted = page;
      }
      return null;
    }
    if (up || page < this.shown - REWIND_EPS) {
      this.auto = false;
      this.wanted = Math.min(this.wanted, page);
      if (page < this.shown - REWIND_EPS) this.wanted = page;
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
    if (this.parked) return null;
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

  /** hard re-sync with no playback in between (the reader jumped outside the film) */
  jumpTo(p: number) {
    this.shown = this.wanted = this.page = p;
    this.auto = false;
    this.parked = false;
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
// (enforced by the model test). A fill's date is the day it filled: market
// orders are decided on the previous close and fill at that day's open. The
// plain-words rule descriptions follow the engine's signal docs (range repo,
// fearlab/signal_docs.json: PB participation trim, PR protect, RD redeploy,
// SMC sniper, RC reclaim, Z* extension-ladder trim; the 2020 file tags it Z1).
// `eng` picks the fill when one day holds several of the same side (May 29 has two buys).
export const EPISODE_EVENTS: { d: string; side: "buy" | "sell"; eng?: string; text: (day: EpDay, fill: EpFill, prev?: EpDay) => string }[] = [
  { d: "2020-02-03", side: "sell", text: (_d, f) => `Prices sit near the high, but fewer stocks carry the rise. The engine sells ${pctLabel(f.pctEq)} of the account.` },
  { d: "2020-03-09", side: "sell", text: (d, _f, prev) => `SPY broke well below its long-term average at the close, with fear at ${prev?.fear ?? d.fear}. A protective rule sells everything at the next open.` },
  { d: "2020-03-12", side: "buy", text: (_d, f) => `Three sessions later, the engine puts ${pctLabel(f.pctEq)} of the account back in.` },
  { d: "2020-03-23", side: "buy", text: () => "A small buy fills at the open on Mar 23, the day of the year's lowest close." },
  { d: "2020-05-29", side: "buy", eng: "Reclaim", text: (_d, f) => `SPY climbs back above its long-term average. The engine puts ${pctLabel(f.pctEq)} of the account back in.` },
  { d: "2020-06-09", side: "sell", text: (_d, f) => `Into the rally, prices stretch well above their usual range. The engine sells ${pctLabel(f.pctEq)} of the account.` },
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
  /** false when this fund's report has no independent calendar years ("carried" basis) */
  available: boolean;
  /** this fund's report's last data date (ISO) */
  end: string;
  ahead: number;
  total: number;
}
export interface StoryData {
  canyon: { t: number; dd: number }[];
  canyonMarks: CanyonMark[];
  canyonRange: string; // "1993 to 2026"
  /** the continuous report's last data date (ISO) and whether its final year is partial */
  canyonEnd: string;
  canyonEndPartial: boolean;
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
  /** false when no report has independent calendar years (all "carried"): the years beat is left out */
  hasYears: boolean;
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
    const fill = ep.fills.find((f) => f.d === e.d && f.side === e.side && (!e.eng || (f.eng ?? "").startsWith(e.eng)));
    return i == null || !fill ? [] : [{ i, fill, side: e.side, text: e.text(days[i], fill, days[i - 1]) }];
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
      available: years.length > 0,
      end: r.window.end,
      ahead: done.filter((y) => y.ahead).length,
      total: done.length,
    };
  });
  const allYears = funds.flatMap((f) => f.years.map((y) => y.y));
  const hasYears = allYears.length > 0;

  return {
    canyon,
    canyonMarks,
    canyonRange: `${yearOf(canyon[0].t)} to ${yearOf(canyon[canyon.length - 1].t)}`,
    canyonEnd: spy.window.end,
    canyonEndPartial: !!spy.yearly.at(-1)?.partial,
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
    hasYears,
    firstYear: hasYears ? Math.min(...allYears) : 0,
    lastYear: hasYears ? Math.max(...allYears) : 0,
  };
}

/** "data through Sep 25, 2026", or per fund when the annual reports end on different days */
export function yearsThrough(d: StoryData, fmt: (iso: string) => string): string {
  const funds = d.funds.filter((f) => f.available);
  const ends = [...new Set(funds.map((f) => f.end))];
  if (ends.length <= 1) return `data through ${ends[0] ? fmt(ends[0]) : d.lastYear}`;
  return `data through ${funds.map((f) => `${fmt(f.end)} (${f.sym})`).join(", ")}`;
}

export const fmtPct = (v: number) => {
  const r = Math.round(v);
  if (r === 0) return "0%"; // rounds to nothing: no sign either way
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toLocaleString("en-US")}%`;
};

// ---- render-resolution governor ------------------------------------------------------
/**
 * Decides the film's render scale from frame timing. It first learns the
 * display's own frame interval from the median of the first CALIBRATE frames
 * (16.7 ms at 60 Hz, 33 ms at 30 Hz or in iPhone Low Power Mode) and never
 * lowers resolution before then, so a steady slow display is not mistaken for
 * a slow GPU. The target then only moves to a faster sustained rate (the median of the
 * last 90 intervals), never to a slower one. After that, six frames in a row that miss the interval by 60%
 * (or whose draw work nears it) drop the scale a step; 240 on-time frames
 * raise it again. The learned interval follows a display that changes rate.
 */
export class FrameGovernor {
  static readonly CALIBRATE = 20;
  static readonly WINDOW = 90;
  static readonly RELEARN = 300;
  scale = 1;
  budget = 0;
  private seen: number[] = [];
  private slow = 0;
  private good = 0;
  /** frames the median has held steady at a slower interval than the target */
  private steadySlow = 0;
  /** the median interval when quality was last lowered: raising needs frames faster than that */
  private droppedAt = Infinity;
  /** consecutive frames whose draw cost was under 30% of the display interval */
  private cheap = 0;
  /** a raise on trial: frames left, median before it, scale to go back to */
  private probe: { left: number; before: number; from: number } | null = null;
  /** after a failed raise: no raise until the median is below this */
  private blockedAbove = Infinity;

  /** one frame: `interval` since the last frame, `work` its draw time (ms); returns the scale */
  report(interval: number, work = 0): number {
    if (!(interval > 5) || interval > 250) return this.scale; // stray, tab switch or first frame
    // the display interval is the median of the last WINDOW intervals: an
    // occasional short frame (a hiccup's catch-up half) cannot pull it down
    const calibrated = this.seen.length >= FrameGovernor.CALIBRATE;
    this.seen.push(interval);
    if (this.seen.length > FrameGovernor.WINDOW) this.seen.shift();
    const sorted = [...this.seen].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    if (!calibrated) {
      if (this.seen.length === FrameGovernor.CALIBRATE) this.budget = median;
      return this.scale;
    }
    // The target follows a faster sustained rate at once. A slower one is
    // adopted only after quality is already at its floor and the median has
    // held steady there for RELEARN frames: a display that slowed down (144 Hz
    // to 60, Low Power Mode) stops counting as missed frames, but quality stays
    // where it is. It is raised only once frames run faster than they did when
    // it was lowered, or once each frame's draw cost has stayed under 30% of
    // the (relearned) display interval for 240 frames while frames arrive on
    // that interval (the display, not the film, sets the pace); never while
    // the achieved interval stays well above the target (GPU-bound).
    if (median < this.budget) { this.budget = median; this.steadySlow = 0; }
    else if (this.scale <= 0.6 && median > this.budget * 1.2 && Math.abs(interval - median) < median * 0.15) {
      // (and the slow level is now this rate: raising needs frames faster than it)
      if (++this.steadySlow > FrameGovernor.RELEARN) { this.budget = median; this.droppedAt = median; this.steadySlow = 0; }
    } else this.steadySlow = 0;
    // the slow level quality was lowered for: the slowest recent interval
    // (90th percentile of the window) seen since the drop
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    if (this.scale < 1) this.droppedAt = this.droppedAt === Infinity ? p90 : Math.max(this.droppedAt, p90);
    const missed = interval > this.budget * 1.6 || work > this.budget * 0.9;
    if (missed) { this.slow++; this.good = 0; } else { this.good++; this.slow = 0; }
    // draw cost far under the display interval: the GPU has room, the display sets the pace
    this.cheap = work > 0 && work < this.budget * 0.3 ? this.cheap + 1 : 0;
    if (this.slow > 5 && this.scale > 0.6) {
      this.scale = Math.round((this.scale - 0.2) * 10) / 10;
      this.slow = 0;
    } else if (this.good > 240 && this.scale < 1 && median <= this.budget * 1.15 && (median < this.droppedAt * 0.85 || this.cheap > 240)
      && median < this.blockedAbove) {
      this.scale = Math.round((this.scale + 0.2) * 10) / 10;
      this.good = 0;
      this.probe = { left: 60, before: median, from: Math.round((this.scale - 0.2) * 10) / 10 };
      if (this.scale >= 1) this.droppedAt = Infinity;
    }
    // A raise is on trial for 60 frames: if frames got more than 15% slower
    // it was the GPU after all, so the step is undone and no raise is tried
    // again until frames run faster than they did before it.
    if (this.probe && --this.probe.left <= 0) {
      if (median > this.probe.before * 1.15) {
        this.scale = this.probe.from;
        this.blockedAbove = this.probe.before * 0.85;
        this.droppedAt = Math.max(this.droppedAt === Infinity ? 0 : this.droppedAt, this.probe.before);
      }
      this.probe = null;
    }
    if (median < this.blockedAbove * 0.999) this.blockedAbove = Infinity;
    return this.scale;
  }
}
