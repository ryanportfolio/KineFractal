// AboutStory — the About page's scroll film.
//
// A tall section pins one full-screen canvas; scrolling drives the story's
// progress 0..1 (eased, so a flick glides instead of jumping). The WebGL
// scene (story-scene.ts) draws the beam, and this component owns the DOM
// layers on top: captions per beat, labels projected from 3D anchors, the
// 2020 readout and a timebase bar. Captions are real text in reading order,
// so the story still reads without WebGL.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { DEPLOY } from "@/data/fearlab-board";
import { fetchBoardLiveShared, fetchReportWithMeta, type LiveMeta } from "@/data/lab-data";
import {
  StoryPlayback, buildStory, fmtPct, yearsThrough, clamp01, episodeClock, readSecs, windowAlpha, paceLimit,
  type Episode, type PaceWindow, type StoryData,
} from "@/lib/about-story-model";
import { buildGeometry, drawStory, type Label, type Palette } from "./story-scene";
import { StoryRenderer, hslTriplet } from "./story-renderer";
import { FilmDebug } from "./film-debug";

// /about?film=debug in dev builds: review harness (film-debug.ts), film starts at once
const FILM_DEBUG = import.meta.env.DEV && typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("film") === "debug";

const SCROLL_VH = 1100;
const EPISODE_URL = "/fearlab/episodes/spy-2020.json";

interface Caption {
  key: string;
  a: number;
  b: number;
  eyebrow?: string;
  body: ReactNode;
  stamp?: string;
  /** reading time in seconds; string bodies derive it from their word count */
  read?: number;
}

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type Source = "live" | "stale" | "snapshot";
type Sources = { canyon: Source; cohorts: Source; years: Source };
const ALL_LIVE: Sources = { canyon: "live", cohorts: "live", years: "live" };
const SOURCE_NOTE: Record<Source, string> = { live: "", stale: " · stale", snapshot: " · snapshot" };

/** which years are partial, from the reports' own partial flags (stamp form) */
function partialNote(d: StoryData): string {
  const funds = d.funds.filter((f) => f.available);
  if (!funds.some((f) => f.years.some((y) => y.partial))) return "";
  const firstPartial = funds.length > 0 && funds.every((f) => f.years[0]?.partial);
  const lastPartial = funds.some((f) => { const y = f.years.at(-1); return !!y?.partial && y.y === d.lastYear; });
  const parts = [...(firstPartial ? ["first years"] : []), ...(lastPartial ? [String(d.lastYear)] : [])];
  return ` · not counted: ${parts.length ? parts.join(", ") : "partial years"}`;
}

function buildCaptions(d: StoryData, source: Sources = ALL_LIVE): Caption[] {
  const clock = episodeClock(d.episode.days.length, d.episode.events.map((e) => e.i));
  const marks = d.canyonMarks.map((m) => m.label).join(", ");
  const epStamp = `SPY ${d.episode.variant} backtest · simulated next-open fills`;

  const caps: Caption[] = [
    {
      key: "open",
      a: -1,
      b: 0.05,
      eyebrow: "FearLab · Kine Fractal",
      body: <span className="text-beam-hot">buys fear in SPY, QQQ and IWM → trims into strength</span>,
      stamp: "scroll to play ↓",
    },
    {
      key: "high",
      a: 0.075,
      b: 0.135,
      body: "The flat line is a simulated buy-and-hold SPY account's high so far. Each dip shows how far it fell from that high.",
      stamp: `simulated buy-and-hold SPY · drop from prior high · deposits not counted as gains · monthly · ${d.canyonRange.split(" to ")[0]} to ${shortDate(d.canyonEnd)}${d.canyonEndPartial ? " (partial)" : ""}${SOURCE_NOTE[source.canyon]}`,
    },
    {
      key: "fear",
      a: 0.14,
      b: 0.2,
      body: "Falls bring fear. The engine reads it after every close and buys when it runs high, more as it climbs.",
    },
    {
      key: "canyons",
      a: 0.205,
      // ends before the camera's fly-in pushes the 2002 and 2008 labels out of frame
      b: 0.232,
      body: `The deepest falls: ${marks}. Each has recovered to a new high so far. The engine buys while they are deep.`,
    },
    {
      key: "zoom",
      a: 0.232,
      b: 0.3,
      eyebrow: "Zoom in · 2020",
      body: "The 2020 dip unfolds into a year of daily closes.",
    },
    {
      key: "chart",
      a: 0.3,
      b: 0.345,
      eyebrow: "SPY · 2020",
      body: "The bright line is SPY's daily close. The amber band is the fear reading, 0 to 100.",
      stamp: epStamp,
    },
  ];

  const evP = d.episode.events.map((e) => clock.progressAt(e.i - 0.6));
  const firstEv = evP[0] ?? 0.37;
  caps.push({
    key: "marks",
    a: 0.345,
    b: firstEv,
    body: "Filled dots under the line are buys. Amber rings above it are sells. Bigger marks moved more of the account.",
    stamp: epStamp,
  });
  d.episode.events.forEach((e, k) => {
    const a = evP[k];
    const next = evP[k + 1] ?? clock.progressAt(e.i + 26);
    caps.push({
      key: `ev${k}`,
      a,
      b: next,
      eyebrow: shortDate(d.episode.days[e.i].d),
      body: e.text,
      stamp: epStamp,
    });
  });
  const lastEv = d.episode.events.at(-1);
  caps.push({
    key: "ep-rest",
    a: lastEv ? clock.progressAt(lastEv.i + 26) : 0.5,
    b: 0.638,
    body: "Every mark is a simulated fill, drawn on its fill day. None was a broker order.",
    stamp: `SPY ${d.episode.variant} backtest · fills at the next open · marked on that day's close`,
  });

  caps.push(
    {
      key: "cohorts",
      a: 0.638,
      b: 0.72,
      eyebrow: "Start any year",
      body: `Start in any year from ${d.cohorts[0]?.year ?? ""}. All cash on day one, no deposits, held to the latest close.`,
      stamp: `SPY start-year cohorts · ${d.cohortPreset.match(/-(v[\d.]+)-/)?.[1] ?? d.cohortPreset} · simulated · through ${d.cohortEnd}${SOURCE_NOTE[source.cohorts]}`,
    },
    {
      key: "cohorts-result",
      a: 0.72,
      b: d.hasYears ? 0.786 : 0.914,
      body: `Bright columns are the strategy, grey dashed ones buy-and-hold over the same dates. The strategy leads in ${d.cohortsAhead} of ${d.cohorts.length} start years.`,
      stamp: "log height · simulated",
    },
    {
      key: "years",
      a: 0.786,
      b: 0.85,
      eyebrow: "Year by year",
      body: "Single years are rougher. Each year starts from all cash, with the same capital and dates for both sides.",
      stamp: `independent calendar years · ${d.firstYear} to ${d.lastYear} · ${yearsThrough(d, shortDate)} · simulated${SOURCE_NOTE[source.years]}`,
    },
    {
      key: "years-result",
      a: 0.85,
      b: 0.914,
      body: "A filled cell is a year ahead of buy-and-hold, an outline a year behind. Corner brackets mark partial years.",
      stamp: d.funds.filter((f) => f.available).map((f) => `${f.sym} ${f.ahead}/${f.total}`).join(" · ") + " years ahead"
        + d.funds.filter((f) => !f.available).map((f) => ` · ${f.sym} years unavailable`).join("") + partialNote(d),
    },
    {
      key: "close",
      a: 0.914,
      b: 2,
      eyebrow: "Every close",
      // the links that follow the film live in one row below it (pages/about.tsx)
      body: "After each close the engine re-reads the full history and publishes one decision per fund. It never places an order.",
      stamp: "buys fear in SPY, QQQ and IWM → trims into strength",
      read: 5,
    },
  );
  return d.hasYears ? caps : caps.filter((c) => !c.key.startsWith("years"));
}

// ---- projected labels ------------------------------------------------------------------
/** a rectangle in label-host CSS px */
interface Box { l: number; t: number; r: number; b: number }

/**
 * Projected labels, laid out every frame: each label is placed at its anchor,
 * kept inside `bounds` (below the navbar, above the active caption) and clear
 * of `obstacles` (the chart key, the readout) and of every label placed before
 * it. Higher `prio` places first; a label that cannot fit is hidden.
 */
class LabelLayer {
  // last written style values: the DOM is only touched when one changes
  private els = new Map<string, { el: HTMLDivElement; text: string; w: number; h: number; css: string; shown: boolean }>();
  constructor(private host: HTMLDivElement) {}
  /** forget measured sizes (the web font arrived and text widths changed) */
  invalidate() {
    this.els.forEach((rec) => { rec.text = ""; });
  }

  update(labels: Label[], project: (p: Label["pos"]) => { x: number; y: number } | null, bounds: Box, obstacles: Box[]) {
    const seen = new Set<string>();
    const placed: Box[] = [...obstacles];
    // read the host size once: reading it after label writes would force a style recalc per label
    const hostW = this.host.clientWidth, hostH = this.host.clientHeight;
    const order = labels.filter((l) => l.alpha > 0.01).sort((a, b) => (b.prio ?? 1) - (a.prio ?? 1));
    for (const l of order) {
      const s = project(l.pos);
      // a label whose anchor is off the stage would point at nothing: hide it
      if (!s || s.x < -12 || s.x > hostW + 12 || s.y < -12 || s.y > hostH + 12) continue;
      const narrow = hostW < NARROW_PX;
      const text = narrow && l.short !== undefined ? l.short : l.text;
      if (!text) continue;
      let rec = this.els.get(l.key);
      if (!rec) {
        const el = document.createElement("div");
        el.className = "etched absolute left-0 top-0 whitespace-nowrap rounded-sm px-1 will-change-transform";
        // a dark plate keeps a label legible where a trace passes behind it
        el.style.background = "hsl(var(--background) / 0.78)";
        if (l.tight) { el.style.letterSpacing = "0.06em"; el.style.padding = "0 2px"; }
        this.host.appendChild(el);
        rec = { el, text: "", w: 0, h: 0, css: "", shown: true };
        this.els.set(l.key, rec);
      }
      const { el } = rec;
      if (rec.text !== text) {
        el.textContent = text;
        el.style.display = "";
        rec.shown = true;
        rec.text = text;
        rec.w = el.offsetWidth;
        rec.h = el.offsetHeight;
      }
      const { w, h } = rec;
      let x = s.x, y = s.y;
      switch (l.anchor) {
        case "above": x -= w / 2; y -= h + 6; break;
        case "aboveStart": y -= h + 6; break;
        case "belowStart": y += 6; break;
        case "left": x -= w + 12; y -= h / 2; break;
        case "right": x += 12; y -= h / 2; break;
        default: x -= w / 2; y += 8;
      }
      const clamped = Math.min(Math.max(x, bounds.l), bounds.r - w);
      if (l.pin && Math.abs(clamped - x) > 4) {
        // a pinned label never slides off its tick. A scale value with no room
        // left of the axis sits on its own line just inside the plot instead.
        if (l.anchor !== "left") continue;
        x = s.x + 6;
        y = s.y - h - 1;
        if (x < bounds.l || x + w > bounds.r) continue;
      } else x = clamped;
      const d = h + 3;
      let spot: Box | null = null;
      // pinned labels (axis ticks, gridline values) never wander: they fit or hide
      for (const dy of l.pin ? [0] : [0, d, -d, 2 * d, -2 * d, 3 * d, -3 * d]) {
        const t = y + dy;
        if (t < bounds.t || t + h > bounds.b) continue;
        const box = { l: x, t, r: x + w, b: t + h };
        if (!placed.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) { spot = box; break; }
      }
      if (!spot || w > bounds.r - bounds.l) continue;
      placed.push(spot);
      seen.add(l.key);
      const color = l.tone === "amber" ? "hsl(var(--accent))" : l.tone === "hot" ? "hsl(var(--beam-hot))" : "hsl(var(--beam-dim))";
      const css = `${spot.l.toFixed(0)},${spot.t.toFixed(0)},${l.alpha.toFixed(2)},${color}`;
      if (css !== rec.css) {
        rec.css = css;
        el.style.color = color;
        el.style.transform = `translate(${spot.l.toFixed(0)}px, ${spot.t.toFixed(0)}px)`;
        el.style.opacity = l.alpha.toFixed(2);
      }
      if (!rec.shown) { el.style.display = ""; rec.shown = true; }
    }
    this.els.forEach((rec, k) => {
      if (!seen.has(k) && rec.shown) { rec.el.style.display = "none"; rec.shown = false; }
    });
  }
}

/** the film's data must arrive within this, or the text account (with retry) shows */
const LOAD_DEADLINE_MS = 20000;
/** below this window height (CSS px) the film cannot fit its chart and caption */
const SHORT_STAGE_PX = 360;
const SHORT_MQ = `(max-height: ${SHORT_STAGE_PX - 1}px)`;
const CANYON_CAPS = new Set(["high", "fear", "canyons"]);

/** below this stage width (Tailwind lg) labels and chart keys use their short forms */
const NARROW_PX = 1024;

// ---- chart keys ------------------------------------------------------------------------
const HOT = "hsl(var(--beam-hot))", DIM = "hsl(var(--beam-dim))", AMBER = "hsl(var(--accent))";
const BENCH = "hsl(var(--muted-foreground))";
const swatch = (kind: string) => (
  <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true" className="mr-1.5 inline-block shrink-0 align-[-1px]">
    {kind === "line" && <line x1="1" y1="6" x2="15" y2="6" stroke={HOT} strokeWidth="2" />}
    {kind === "fear" && <rect x="2" y="2" width="12" height="9" fill={AMBER} opacity="0.35" stroke={AMBER} strokeWidth="1" />}
    {kind === "buy" && <circle cx="8" cy="6" r="4.5" fill={HOT} />}
    {kind === "sell" && <circle cx="8" cy="6" r="4.5" fill="none" stroke={AMBER} strokeWidth="1.5" />}
    {kind === "strategy" && <line x1="8" y1="1" x2="8" y2="11" stroke={HOT} strokeWidth="2.5" />}
    {kind === "hold" && <line x1="8" y1="1" x2="8" y2="11" stroke={BENCH} strokeWidth="2" strokeDasharray="2 1.5" />}
    {kind === "ahead" && <><rect x="3" y="1" width="10" height="10" fill="none" stroke={HOT} strokeWidth="1.2" /><path d="M5 4h6M5 6h6M5 8h6" stroke={HOT} strokeWidth="1.2" /></>}
    {kind === "behind" && <rect x="3" y="1" width="10" height="10" fill="none" stroke={DIM} strokeWidth="1.2" />}
    {kind === "partial" && <path d="M3 4V1h3M10 1h3v3M13 8v3h-3M6 11H3V8" fill="none" stroke={DIM} strokeWidth="1.2" />}
  </svg>
);
// [swatch, label, shorter label for phones ("" hides the item there)]
const LEGENDS: { stage: string; items: [string, string, string][] }[] = [
  { stage: "episode", items: [["line", "SPY close", "close"], ["fear", "fear reading, 0 to 100", "fear"], ["buy", "simulated buy", "buy"], ["sell", "simulated sell", "sell"], ["", "mark size = share of account", "size = share of account"]] },
  { stage: "cohorts", items: [["strategy", "strategy", "strategy"], ["hold", "buy & hold, same dates", "buy & hold"], ["", "height on a log scale", ""]] },
  { stage: "years", items: [["ahead", "ahead of buy & hold", "ahead"], ["behind", "behind", "behind"], ["partial", "partial year, not counted", "partial"]] },
];

function readPalette(): { pal: Palette; bg: [number, number, number] } {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: [number, number, number]) => hslTriplet(cs.getPropertyValue(name), fb);
  const accentHue = parseFloat(cs.getPropertyValue("--accent")) || 35;
  return {
    pal: {
      core: v("--beam-core", [0.9, 1, 0.95]),
      hot: v("--beam-hot", [0.3, 1, 0.6]),
      mid: v("--beam-mid", [0.1, 0.8, 0.45]),
      dim: v("--beam-dim", [0.2, 0.55, 0.4]),
      ghost: v("--beam-ghost", [0.08, 0.18, 0.13]),
      // the accent pre-shifted toward red: bright additive light tonemaps toward
      // yellow, so the unshifted hue would render gold instead of amber
      amber: ((c) => (accentHue >= 25 && accentHue <= 50 ? [c[0], c[1] * 0.68, c[2]] : c) as [number, number, number])(v("--accent", [1, 0.6, 0])),
      bench: v("--muted-foreground", [0.5, 0.55, 0.53]),
    },
    bg: v("--background", [0.02, 0.04, 0.035]),
  };
}

export function AboutStory() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const legendRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [data, setData] = useState<StoryData | null>(null);
  const [failed, setFailed] = useState(false);
  // "unavailable": no WebGL2 at all; "lost": the context dropped and may come back
  const [noGl, setNoGl] = useState<false | "unavailable" | "lost">(false);
  const [attempt, setAttempt] = useState(0);
  // the film is replaced by the text account: its effect tears down renderer and listeners
  // A stage shorter than SHORT_STAGE_PX (a landscape phone, heavy page zoom)
  // cannot fit the 2020 chart and its caption even at the chart's smallest
  // scale: the text account replaces the film there. 1280x400 still fits.
  const [short, setShort] = useState(() => typeof window !== "undefined" && window.matchMedia(SHORT_MQ).matches);
  useEffect(() => {
    const mq = window.matchMedia(SHORT_MQ);
    const on = () => setShort(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const textOnly = failed || noGl === "unavailable" || short;
  const [source, setSource] = useState<Sources>(ALL_LIVE);
  // the WebGL context and its render targets are made only once the film nears view
  const [near, setNear] = useState(FILM_DEBUG);
  useEffect(() => {
    const section = sectionRef.current;
    if (near || !section) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin: "50% 0px" });
    io.observe(section);
    return () => io.disconnect();
  }, [near, data]);

  useEffect(() => {
    let live = true;
    setFailed(false);
    const key = (sym: string) => DEPLOY.find((f) => f.sym === sym)?.reportKey ?? `${sym.toLowerCase()}-1d-full`;
    // report keys resolve against the same board the film shows; a load that
    // hangs past the deadline gives the text account and its retry button
    const boardP = fetchBoardLiveShared();
    // this batch's own requests stop on its deadline, a retry or unmount
    // (the board request is shared with the rest of the page and left alone)
    const batch = new AbortController();
    const withBoard = (sym: string) => boardP.then((b) => fetchReportWithMeta(key(sym), b.data, batch.signal), () => fetchReportWithMeta(key(sym), undefined, batch.signal));
    let deadlineTimer = 0;
    const deadline = new Promise<never>((_, no) => {
      deadlineTimer = window.setTimeout(() => { batch.abort(); no(new Error(`timed out after ${LOAD_DEADLINE_MS} ms`)); }, LOAD_DEADLINE_MS);
    });
    Promise.race([Promise.all([
      withBoard("SPY"),
      withBoard("QQQ"),
      withBoard("IWM"),
      boardP,
      fetch(EPISODE_URL, { signal: batch.signal }).then((r) => (r.ok ? (r.json() as Promise<Episode>) : Promise.reject(new Error("episode")))),
    ]), deadline])
      .then(([spy, qqq, iwm, board, ep]) => {
        if (!live) return;
        // where the numbers came from: live service, a stale live copy, or the bundled snapshot
        // per scene: the canyon is SPY's report, the cohorts the board, the years all three reports
        const of = (...ms: LiveMeta[]): Source => (ms.some((m) => !m.live) ? "snapshot" : ms.some((m) => m.stale) ? "stale" : "live");
        setSource({ canyon: of(spy.meta), cohorts: of(board.meta), years: of(spy.meta, qqq.meta, iwm.meta) });
        setData(buildStory({ spy: spy.data, qqq: qqq.data, iwm: iwm.data }, board.data, ep));
      })
      .catch((e) => {
        if (!live) return; // left the page or retried: the abort is ours, not a failure
        console.error("about film: story data failed to load (reports, board or 2020 episode)", e);
        setFailed(true);
      });
    return () => { live = false; batch.abort(); clearTimeout(deadlineTimer); };
  }, [attempt]);

  const captions = useMemo(() => (data ? buildCaptions(data, source) : []), [data, source]);
  const pace = useMemo<PaceWindow[]>(
    () => captions.map((c) => ({ a: c.a, b: c.b, read: c.read ?? readSecs(typeof c.body === "string" ? c.body : "") })),
    [captions],
  );

  useEffect(() => {
    const section = sectionRef.current, canvas = canvasRef.current, labelHost = labelsRef.current;
    if (!data || !near || textOnly || !section || !canvas || !labelHost) return;

    const renderer = new StoryRenderer(canvas);
    if (!renderer.ok) setNoGl("unavailable");
    // render targets the device cannot build: plain text account, like no WebGL2
    renderer.onFail = () => setNoGl("unavailable");
    // a lost WebGL context drops to captions only until the browser restores it
    // a restored context starts blank: let the opening frame draw again
    // a restore that fails (no context, shaders or render targets) is final:
    // the plain text account replaces the film instead of a pause that never ends
    renderer.onContextChange = (ok, restoring) => {
      setNoGl(ok ? false : restoring ? "unavailable" : "lost");
      idleDrawn = false;
      kick();
    };
    const isTall = () => canvas.clientWidth < canvas.clientHeight;
    let tall = isTall();
    let geo = buildGeometry(data, tall);
    // bottom of the episode chart key in label-host px (Infinity when absent)
    const epKeyBottom = () => {
      const i = LEGENDS.findIndex((l) => l.stage === "episode");
      const el = legendRefs.current[i];
      if (!el) return Infinity;
      const hb = labelHost.getBoundingClientRect(), k = hb.width / (labelHost.clientWidth || 1) || 1;
      let bottom = el.getBoundingClientRect().bottom;
      // on phones the readout sits under the key, in the same band
      const hr = hudRef.current?.getBoundingClientRect();
      if (hr && hr.height > 0 && hr.top < hb.top + hb.height / 2) bottom = Math.max(bottom, hr.bottom);
      return (bottom - hb.top) / k;
    };
    const layer = new LabelLayer(labelHost);
    // labels are measured once per text; a late web font changes every width
    const remeasure = () => layer.invalidate();
    document.fonts?.addEventListener?.("loadingdone", remeasure);
    let { pal, bg } = readPalette();
    renderer.bg = bg;
    const themeObs = new MutationObserver(() => { ({ pal, bg } = readPalette()); renderer.bg = bg; });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phosphor"] });

    // StoryPlayback (about-story-model) decides where the film is and when the
    // page must be held or carried; this effect only reads and moves the scroll.
    const span = () => {
      const rect = section.getBoundingClientRect();
      return { top: rect.top + window.scrollY, total: rect.height - window.innerHeight, rectTop: rect.top };
    };
    const pageNow = () => {
      const { total, rectTop } = span();
      return total > 0 ? clamp01(-rectTop / total) : 0;
    };
    // The page's own scrolls are recognised by the pixel they land on (read
    // back straight after scrollTo) and skipped in measure(), so a genuine
    // 1 px upward scroll by the reader is never mistaken for one of them.
    let ownY = -1;
    const scrollToP = (p: number) => {
      const { top, total } = span();
      if (total > 0) { window.scrollTo(0, top + p * total); ownY = window.scrollY; }
    };
    // data may arrive after the reader has scrolled into or past the film:
    // inside, the film is held at its first frame; below, it is parked (see StoryPlayback)
    // ?film=scrub: scroll maps straight to film position (review captures)
    const scrub = new URLSearchParams(window.location.search).get("film") === "scrub";
    const { play, holdAt } = StoryPlayback.atLoad(pace, pageNow());
    if (scrub) { play.jumpTo(pageNow()); play.finished = true; }
    else if (holdAt != null) scrollToP(holdAt);
    // ?film=debug (dev builds only): pause, scrub and a blank-frame log (film-debug.ts)
    const seekDebug = (v: number) => {
      play.jumpTo(v);
      play.finished = v >= 1;
      if (v < 1) { play.wanted = 1; play.auto = true; }
      scrollToP(v);
      kick();
    };
    const debug = FILM_DEBUG
      ? new FilmDebug(section, { seek: seekDebug, stepBack: (v) => Math.max(0, v - paceLimit(pace, v) / 60) })
      : null;
    // The End key scrolls smoothly, through the film: its first steps would be
    // held back. It means "take me past this", so an unfinished film parks.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "End" || e.defaultPrevented || play.finished) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      play.park(pageNow());
    };
    window.addEventListener("keydown", onKey);
    const measure = () => {
      if (window.scrollY === ownY) return;
      ownY = -1;
      const page = pageNow();
      // a reader scroll (End key, a link below, focus) that lands past the
      // film's end before it finished parks the film instead of pulling them
      // back; wheel and touch scrolling never get there, holds stop them first
      if (page >= 1 && !play.finished) { play.park(page); return; }
      const hold = play.onScroll(page, performance.now());
      if (hold != null) scrollToP(hold);
    };
    const skip = () => {
      play.skip();
      scrollToP(1);
      // keyboard focus goes on to the links after the film, never lost with the button
      if (document.activeElement === skipBtn) {
        const next = document.getElementById("about-next");
        (next?.querySelector<HTMLElement>("a") ?? next)?.focus();
      }
    };
    const skipBtn = skipRef.current;
    skipBtn?.addEventListener("click", skip);

    // "live": pinned or scrolling out below, the film plays. "above": the stage
    // is on screen but has not pinned; it shows the opening frame, drawn once,
    // so it never holds a stale mid-film frame. "off": nothing on screen.
    type Mode = "live" | "above" | "off";
    const modeNow = (): Mode => {
      const r = section.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) return "off";
      return r.top <= 1 ? "live" : "above";
    };
    let scrollMode: Mode = "off";
    let mode: Mode = "off", idleDrawn = false, raf = 0, last = performance.now();
    const t0 = last;
    const frame = (now: number) => {
      raf = 0;
      mode = modeNow();
      // a frame started by kick() can carry a timestamp older than kick's own
      // clock read: never step the film backwards by a negative dt
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      const ms = now - last;
      last = now;
      const live = mode === "live";
      const stepping = !!debug && debug.paused && debug.steps > 0;
      if (live) {
        idleDrawn = false;
        if (!debug?.paused || stepping) {
          const carry = play.tick(stepping ? 1 / 60 : dt);
          if (carry != null) scrollToP(carry);
        }
      } else idleDrawn = true;
      const p = live ? play.shown : 0, time = debug ? debug.clock(ms) : (now - t0) / 1000;
      if (stepping) debug.steps--;
      // a lost context hides everything projected from the chart until it returns
      labelHost.style.visibility = renderer.ok ? "" : "hidden";
      if (!renderer.ok) {
        legendRefs.current.forEach((el) => { if (el) el.style.opacity = "0"; });
        if (hudRef.current) hudRef.current.style.opacity = "0";
      }
      if (skipBtn) {
        const on = live && play.skipOffered(now);
        if (skipBtn.tabIndex !== (on ? 0 : -1)) {
          skipBtn.style.opacity = on ? "1" : "0";
          skipBtn.style.pointerEvents = on ? "auto" : "none";
          // hidden means out of the tab order and the accessibility tree too
          skipBtn.tabIndex = on ? 0 : -1;
          skipBtn.setAttribute("aria-hidden", on ? "false" : "true");
          if (!on && document.activeElement === skipBtn) {
            const next = document.getElementById("about-next");
            (next?.querySelector<HTMLElement>("a") ?? next)?.focus();
          }
        }
      }

      if (renderer.ok) {
        renderer.resize();
        if (isTall() !== tall) { tall = !tall; geo = buildGeometry(data, tall, geo.epScale); }
        // portrait years grid fits above the taller of the two years captions
        // and the canyon fits above the tallest of its three captions
        let yearsCap = Infinity, canyonCap = Infinity, episodeCap = Infinity;
        const hostBox = labelHost.getBoundingClientRect();
        captions.forEach((c, i) => {
          const el = capRefs.current[i];
          if (!el) return;
          if (c.key.startsWith("years")) yearsCap = Math.min(yearsCap, el.getBoundingClientRect().top);
          if (CANYON_CAPS.has(c.key)) canyonCap = Math.min(canyonCap, el.getBoundingClientRect().top);
          if (c.key === "marks" || c.key === "ep-rest" || /^ev\d/.test(c.key)) episodeCap = Math.min(episodeCap, el.getBoundingClientRect().top);
        });
        const yearsCapFrac = Number.isFinite(yearsCap) && hostBox.height > 0 ? (yearsCap - hostBox.top) / hostBox.height : 0.64;
        const kz = hostBox.width / (labelHost.clientWidth || 1) || 1;
        const out = drawStory(renderer, data, geo, pal, p, time, yearsCapFrac, (canyonCap - hostBox.top) / kz, (episodeCap - hostBox.top) / kz, epKeyBottom());
        // a short stage asks for a flatter 2020 chart: rebuild once it settles
        if (Math.abs(out.epFit - geo.epScale) > 0.02) {
          geo = buildGeometry(data, tall, out.epFit);
          if (scrub) section.dataset.rebuilds = String(+(section.dataset.rebuilds ?? 0) + 1);
        }
        renderer.end(time, out.flash);
        if (live) renderer.reportFrame(ms, performance.now() - now);
        // layout bounds in label-host CSS px (host rects are zoomed by --pz; k undoes it)
        const hostRect = labelHost.getBoundingClientRect();
        const k = hostRect.width / (labelHost.clientWidth || 1) || 1;
        const toHost = (r: DOMRect): Box => ({
          l: (r.left - hostRect.left) / k, t: (r.top - hostRect.top) / k,
          r: (r.right - hostRect.left) / k, b: (r.bottom - hostRect.top) / k,
        });
        const navBottom = document.querySelector("nav")?.getBoundingClientRect().bottom ?? hostRect.top;
        let capTop = Infinity;
        captions.forEach((c, i) => {
          const el = capRefs.current[i];
          if (el && windowAlpha(p, c.a, c.b, 0.0015) > 0) capTop = Math.min(capTop, el.getBoundingClientRect().top);
        });
        const bounds: Box = {
          l: 8, r: labelHost.clientWidth - 8,
          t: (navBottom - hostRect.top) / k + 6,
          b: Number.isFinite(capTop) ? (capTop - hostRect.top) / k - 10 : labelHost.clientHeight - 48,
        };
        const obstacles: Box[] = [];
        LEGENDS.forEach((lg, i) => {
          const el = legendRefs.current[i];
          if (el && (out.stages[lg.stage] ?? 0) > 0.55) obstacles.push(toHost(el.getBoundingClientRect()));
        });
        if (out.hud && hudRef.current) obstacles.push(toHost(hudRef.current.getBoundingClientRect()));
        layer.update(out.labels, (pos) => renderer.project(pos), bounds, obstacles);
        LEGENDS.forEach((lg, i) => {
          const el = legendRefs.current[i];
          // a key shows only once its scene is past halfway in, so two keys never overlap mid-handoff
          if (el) el.style.opacity = Math.min(1, Math.max(0, ((out.stages[lg.stage] ?? 0) - 0.55) / 0.35)).toFixed(3);
        });
        if (scrub) section.dataset.stages = JSON.stringify(out.stages);
        const hud = hudRef.current;
        if (hud) {
          hud.style.opacity = out.hud ? "1" : "0";
          if (out.hud) {
            const txt = labelHost.clientWidth < NARROW_PX
              ? `${out.hud.date} · SPY ${out.hud.close} · fear ${out.hud.fear}`
              : `${out.hud.date} · SPY close ${out.hud.close} · fear ${out.hud.fear}`;
            if (hud.textContent !== txt) hud.textContent = txt;
          }
        }
      }
      captions.forEach((c, i) => {
        const el = capRefs.current[i];
        if (!el) return;
        const a = windowAlpha(p, c.a, c.b, 0.0015);
        el.style.opacity = a.toFixed(3);
        el.style.transform = `translateY(${((1 - a) * 10).toFixed(1)}px)`;
        el.style.visibility = a > 0 ? "visible" : "hidden";
      });
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      debug?.frame({
        p, ms, canvas, scale: renderer.renderScale,
        beat: captions.filter((c) => p >= c.a && p < c.b).map((c) => c.key).join(" "),
      });
      if (mode === "live" && !document.hidden) raf = requestAnimationFrame(frame);
    };
    // One beam on screen: the film animates only once its section has pinned
    // (top at the viewport top), the same test AboutRail stops on.
    function kick() {
      mode = modeNow();
      const want = mode === "live" || (mode === "above" && !idleDrawn);
      if (!raf && want && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
    const io = new IntersectionObserver(() => kick(), { threshold: [0, 0.01, 0.5, 1] });
    io.observe(section);
    const onScroll = () => {
      const was = scrollMode;
      mode = scrollMode = modeNow();
      if (mode !== "above") idleDrawn = false;
      // The reader left the pinned stage: re-sync playback to where they are,
      // so coming back never flashes the old scene before rewinding.
      if (was === "live" && mode !== "live") {
        const aboveFilm = section.getBoundingClientRect().top > 0;
        if (aboveFilm) play.jumpTo(0);
        else if (!play.finished) play.park();
      }
      // the frame loop owns the skip button; when it stops, the button goes with it
      if (mode !== "live" && skipBtn && skipBtn.tabIndex !== -1) {
        skipBtn.style.opacity = "0";
        skipBtn.style.pointerEvents = "none";
        skipBtn.tabIndex = -1;
        skipBtn.setAttribute("aria-hidden", "true");
      }
      measure();
      kick();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // a resize changes the canvas, so the opening frame must be drawn again
    const onResize = () => { idleDrawn = false; onScroll(); };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", kick);
    if (debug) seekDebug(0);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      themeObs.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", kick);
      skipBtn?.removeEventListener("click", skip);
      window.removeEventListener("keydown", onKey);
      document.fonts?.removeEventListener?.("loadingdone", remeasure);
      debug?.destroy();
      renderer.destroy();
      labelHost.replaceChildren();
    };
  }, [data, captions, pace, near, textOnly]);

  if (textOnly) {
    // no film without its data or without WebGL2: a short plain account in its
    // place, page-height only; the page's link row follows it
    return (
      <section data-about-story data-story-failed aria-labelledby="about-story-fallback" className="mx-auto max-w-4xl px-5 py-16 md:px-10">
        <h2 id="about-story-fallback" className="etched mb-4 text-beam-dim">How FearLab works</h2>
        <div className="max-w-[68ch] space-y-4 font-mono text-[15px] leading-relaxed text-beam-mid">
          <p>
            FearLab is an end-of-day research engine for SPY, QQQ and IWM. After each close it takes a fear reading,
            buys when fear runs high and trims into strength.
          </p>
          <p>
            Its backtests are simulated. None of their fills were broker orders, and the site never places one.
          </p>
          {failed ? (
            <>
              <p className="text-beam-dim">
                The film's data files did not load.
              </p>
              <p>
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex min-h-[44px] items-center text-beam-hot underline underline-offset-4">try again</button>
              </p>
            </>
          ) : short ? (
            <p className="text-beam-dim">
              The film needs a taller window. The backtest reports and rulebook cover the same ground.
            </p>
          ) : (
            <p className="text-beam-dim">
              The film needs WebGL2, which this browser lacks. The backtest reports and rulebook cover the same ground.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} data-about-story aria-label="How FearLab works, as a scrolling story" className="relative" style={{ height: `calc(${SCROLL_VH}vh / var(--pz))` }}>
      {/* the film's words in reading order, for screen readers; the animated
          captions below are the visual copy and stay out of the accessibility tree */}
      {captions.length > 0 && (
        <div className="sr-only">
          <h2>How FearLab works</h2>
          <ol>
            {captions.map((c) => (
              <li key={c.key}>
                {c.eyebrow && <p>{c.eyebrow}</p>}
                <p>{c.body}</p>
                {c.stamp && <p>{c.stamp}</p>}
              </li>
            ))}
          </ol>
          {data && (
            <>
              {/* the numbers the canvas draws, which the captions only summarise */}
              <h3>Start-year cohorts, simulated, through {data.cohortEnd}</h3>
              <ul>
                {data.cohorts.map((c) => (
                  <li key={c.year}>{c.year} start: strategy {fmtPct(c.s)}, buy and hold {fmtPct(c.b)}</li>
                ))}
              </ul>
              {data.hasYears && (
                <>
                  <h3>Independent calendar years, simulated</h3>
                  <ul>
                    {data.funds.map((f) => (
                      <li key={f.sym}>
                        {f.available
                          ? `${f.sym}: ahead of buy and hold in ${f.years.filter((y) => !y.partial && y.ahead).map((y) => y.y).join(", ") || "none"}; behind in ${f.years.filter((y) => !y.partial && !y.ahead).map((y) => y.y).join(", ") || "none"}; partial, not counted: ${f.years.filter((y) => y.partial).map((y) => y.y).join(", ") || "none"}.`
                          : `${f.sym}: calendar years unavailable.`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
      {/* viewport units divide out the desktop CSS zoom (--pz, index.css) */}
      <div className="sticky top-0 w-full overflow-hidden" style={{ height: "calc(100vh / var(--pz))" }}>
        {/* the top edge feathers into the page so the film never enters as a hard line */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 block h-full w-full"
          style={{
            visibility: noGl ? "hidden" : "visible",
            maskImage: "linear-gradient(to bottom, transparent, black 14%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 14%)",
          }}
        />
        <div ref={labelsRef} data-story-labels aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-background via-background/70 to-transparent" />

        <div ref={hudRef} aria-hidden="true" className="etched pointer-events-none absolute right-5 top-[8rem] whitespace-nowrap text-beam-mid opacity-0 transition-opacity duration-300 tabular-nums md:right-[6vw] md:top-auto md:bottom-[calc(9vh/var(--pz))]" />

        {LEGENDS.map((lg, i) => (
          <div
            key={lg.stage}
            ref={(el) => { legendRefs.current[i] = el; }}
            aria-hidden="true"
            className="etched pointer-events-none absolute left-5 right-5 top-[4.5rem] flex flex-wrap items-center gap-x-3 gap-y-1 text-beam-dim md:gap-x-5 md:left-[6vw] md:right-auto md:top-[5.5rem]"
            style={{ opacity: 0 }}
          >
            {lg.items.map(([kind, text, short]) => (
              <span key={text} className={`${short ? "inline-flex" : "hidden lg:inline-flex"} items-center whitespace-nowrap`}>
                {kind && swatch(kind)}
                <span className="lg:hidden">{short}</span>
                <span className="hidden lg:inline">{text}</span>
              </span>
            ))}
          </div>
        ))}

        {!data && (
          <div className="etched absolute inset-0 flex items-center justify-center text-beam-dim">
            {failed ? "engine files unreachable · the story needs the bundled report data" : "reading engine files…"}
          </div>
        )}

        <div data-story-captions className="pointer-events-none absolute left-5 right-5 md:left-[6vw] md:right-auto md:w-[min(46ch,48vw)]" style={{ bottom: "calc(9vh / var(--pz))" }}>
          {captions.map((c, i) => (
            <div
              key={c.key}
              ref={(el) => { capRefs.current[i] = el; }}
              // the transcript carries the words
              aria-hidden="true"
              className="absolute bottom-0 left-0 right-0"
              style={{ opacity: 0, visibility: "hidden" }}
            >
              {c.eyebrow && <div aria-hidden="true" className="etched mb-2 text-beam-dim">{c.eyebrow}</div>}
              <p className="font-mono text-[15px] leading-relaxed text-beam-mid md:text-[17px] [text-shadow:0_0_18px_hsl(var(--background))]">
                {c.body}
              </p>
              {c.stamp && <div aria-hidden="true" className="etched mt-3 text-beam-dim">{c.stamp}</div>}
            </div>
          ))}
        </div>

        <button
          ref={skipRef}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          // 44 px minimum touch target; the text sits where it did
          className="etched absolute right-3 inline-flex min-h-[44px] items-center px-2 text-beam-dim transition-opacity duration-300 hover:text-beam-hot md:right-[calc(6vw-0.5rem)]"
          style={{ bottom: "calc(4vh / var(--pz) - 4px)", opacity: 0, pointerEvents: "none" }}
        >
          skip to the end ↓
        </button>

        <div aria-hidden="true" className="absolute left-5 right-5 h-px bg-[hsl(var(--beam-ghost))] md:left-[6vw] md:right-[6vw]" style={{ bottom: "calc(4vh / var(--pz))" }}>
          <div ref={barRef} className="h-px origin-left bg-[hsl(var(--beam-hot))]" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}
