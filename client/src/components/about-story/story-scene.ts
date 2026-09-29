// story-scene — choreography for the About film.
//
// Given scroll progress p (0..1) and wall time, submit one frame of beam
// geometry to the renderer and return the DOM labels + HUD for this frame.
// Stages live at separate world positions and the camera flies between them:
//
//   canyon   origin      33 years of buy-and-hold SPY drawdown as a canyon
//                        terrain, amber fear light pooling in the deep ones
//   episode  E (2020)    SPY 2020 daily close + fear columns; simulated fills
//                        fall in (buys) or rise out (sells) as the cursor passes
//   cohorts  C           start-year cohorts as paired light columns
//   years    G           independent calendar years per fund, lit when ahead
//   close    F           one spot, one decision per close
//
// Data values drive every plotted position. Embers, rings, sparks and camera
// moves are decoration.
import type { StoryData } from "@/lib/about-story-model";
import { beatT, clamp01, episodeClock, fmtPct, type EpisodeClock } from "@/lib/about-story-model";
import type { Camera, RGB, StoryRenderer, Vec3 } from "./story-renderer";

export interface Palette { core: RGB; hot: RGB; mid: RGB; dim: RGB; ghost: RGB; amber: RGB; bench: RGB }

export interface Label {
  key: string;
  text: string;
  pos: Vec3;
  alpha: number;
  tone: "hot" | "dim" | "amber";
  anchor?: "above" | "aboveStart" | "below" | "belowStart" | "left" | "right";
  /** shorter text for narrow (phone) stages; "" hides the label there */
  short?: string;
  /** never step away from the anchor to dodge a collision: fit or hide */
  pin?: boolean;
  /** layout priority: higher places first and wins collisions (default 1) */
  prio?: number;
  /** tight letter spacing and padding: dense tick labels (month names) */
  tight?: boolean;
}
export interface FrameOut {
  labels: Label[];
  hud: { date: string; close: string; fear: string } | null;
  flash: number;
  /** the 2020 chart's vertical scale this stage needs (see buildGeometry) */
  epFit: number;
  /** per-stage visibility 0..1 this frame (review tooling reads it) */
  stages: Record<string, number>;
}

const X0 = -4, X1 = 4;
const GRID_PCT = [10, 25, 50];
const DD_Y = 2.6 / 100; // world units per percentage point of drawdown
const ROWS = 12; // terrain rows each side of the centre trench
const ROW_DZ = 0.27;

const ss = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// deterministic hash for decorative particles
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export interface Geometry {
  tall: boolean;
  /** 2020 chart vertical scale (1 = natural) and the resulting world scale */
  epScale: number;
  ve: number;
  /** the story has a years beat; without one the cohorts hold until the close */
  hasYears: boolean;
  /** vertical stretch for portrait stages */
  vs: number;
  /** world units per percentage point of drawdown */
  ddY: number;
  epBase: number;
  epFearH: number;
  n: number;
  xs: Float32Array;
  rows: { k: number; f: number; pts: Float32Array }[];
  deep: number[];
  x2020: number;
  y2020: number;
  xMid2020: number;
  E: Vec3;
  C: Vec3;
  G: Vec3;
  F: Vec3;
  ep: {
    n: number;
    xs: Float32Array;
    ys: Float32Array;
    price: Float32Array; // flat xyz, world
    ghost: Float32Array;
    fearTop: Float32Array;
    from: Float32Array;
    morph: Float32Array;
  };
  keys: Key[];
  clock: EpisodeClock;
}

const EP_W = 3.2;

/**
 * `tall` = a portrait stage: the renderer fits the scene's width, which leaves
 * height to spare, so charts stretch vertically and the years grid turns sideways.
 */
/**
 * `epScale` shrinks the 2020 chart's vertical extent (price and fear strip) on
 * stages too short to fit it between the chart key and the caption.
 */
export function buildGeometry(d: StoryData, tall = false, epScale = 1): Geometry {
  const vs = tall ? 1.9 : 1;
  const ddY = DD_Y * vs;
  const ve = vs * epScale; // vertical scale of the 2020 chart
  const epBase = -1.25 * ve, epFearH = 0.85 * ve;
  const n = d.canyon.length;
  const xs = new Float32Array(n);
  for (let i = 0; i < n; i++) xs[i] = X0 + ((X1 - X0) * i) / (n - 1);

  const rows: Geometry["rows"] = [];
  for (let k = -ROWS; k <= ROWS; k++) {
    const f = Math.exp(-((k / 4.4) ** 2));
    rows.push({ k, f, pts: new Float32Array(n * 3) });
  }
  const deep: number[] = [];
  d.canyon.forEach((p, i) => { if (p.dd < -14) deep.push(i); });

  // 2020 canyon floor: the deepest month in calendar 2020
  let i20 = -1;
  d.canyon.forEach((p, i) => {
    if (new Date(p.t * 1000).getUTCFullYear() !== 2020) return;
    if (i20 < 0 || p.dd < d.canyon[i20].dd) i20 = i;
  });
  if (i20 < 0) i20 = Math.round(n * 0.8);
  const x2020 = xs[i20];
  const y2020 = d.canyon[i20].dd * ddY;
  // the monthly 2020 slice of the canyon line: where the daily chart unfolds from
  const in2020 = d.canyon.map((p, i) => (new Date(p.t * 1000).getUTCFullYear() === 2020 ? i : -1)).filter((i) => i >= 0);
  const j0 = in2020[0] ?? i20, j1 = in2020.at(-1) ?? i20;
  const xMid2020 = (xs[j0] + xs[j1]) / 2;

  const E: Vec3 = [x2020, 0, 0];
  const C: Vec3 = [0, -0.8, 11];
  const G: Vec3 = [0, -1.1, 22];
  const F: Vec3 = [0, 0.2, 22];

  const days = d.episode.days;
  const en = days.length;
  let lo = Infinity, hi = -Infinity;
  for (const x of days) { lo = Math.min(lo, x.c); hi = Math.max(hi, x.c); }
  const exs = new Float32Array(en), eys = new Float32Array(en);
  const price = new Float32Array(en * 3), ghost = new Float32Array(en * 3), fearTop = new Float32Array(en * 3);
  const from = new Float32Array(en * 3); // each session's spot on the monthly canyon line
  for (let i = 0; i < en; i++) {
    const x = E[0] - EP_W + (2 * EP_W * i) / (en - 1);
    const y = E[1] - 0.1 * ve + ((days[i].c - lo) / (hi - lo || 1)) * 1.5 * ve;
    exs[i] = x; eys[i] = y;
    price.set([x, y, E[2]], i * 3);
    ghost.set([x, y, E[2] - 0.02], i * 3);
    fearTop.set([x, E[1] + epBase + ((days[i].fear ?? 0) / 100) * epFearH, E[2]], i * 3);
    const u = j0 + ((j1 - j0) * i) / (en - 1);
    const a = Math.floor(u), b = Math.min(n - 1, a + 1), fr = u - a;
    from.set([lerp(xs[a], xs[b], fr), lerp(d.canyon[a].dd, d.canyon[b].dd, fr) * ddY, 0], i * 3);
  }

  const g = { tall, epScale, ve, hasYears: d.hasYears, vs, ddY, epBase, epFearH, n, xs, rows, deep, x2020, y2020, xMid2020, E, C, G, F, ep: { n: en, xs: exs, ys: eys, price, ghost, fearTop, from, morph: new Float32Array(en * 3) }, keys: [] as Key[], clock: episodeClock(en, d.episode.events.map((e) => e.i)) };
  g.keys = cameraKeys(g);
  return g;
}

// ---- camera path ----------------------------------------------------------------
type Key = { p: number; eye: Vec3; target: Vec3; fov: number };
function cameraKeys(g: Omit<Geometry, "keys" | "clock">): Key[] {
  const { E, C, G, F, xMid2020, y2020 } = g;
  return [
    { p: 0, eye: [0, 0, 11.5], target: [0, 0, 0], fov: 36 },
    { p: 0.07, eye: [0, -0.2, 11], target: [0, -0.35, 0], fov: 35 },
    { p: 0.155, eye: [0, -0.35, 10.2], target: [0, -0.5, 0], fov: 34 },
    { p: 0.215, eye: [-3.8, 2.7, 7.6], target: [0.4, -1.05, 0], fov: 40 },
    { p: 0.25, eye: [xMid2020 - 0.8, 0.4, 4.0], target: [xMid2020, y2020 * 0.5, 0], fov: 40 },
    { p: 0.27, eye: [xMid2020, y2020 * 0.4, 2.9], target: [xMid2020, y2020 * 0.4, 0], fov: 40 },
    { p: 0.29, eye: [xMid2020 - 0.3, 0.2, 5.0], target: [xMid2020, 0.1, 0], fov: 39 },
    { p: 0.31, eye: [E[0] - 1.0, E[1] - 0.05, 9.3], target: [E[0], E[1] - 0.2 * g.vs, 0], fov: 38 },
    { p: 0.62, eye: [E[0] + 0.8, E[1] - 0.1, 9.1], target: [E[0] + 0.2, E[1] - 0.2 * g.vs, 0], fov: 38 },
    { p: 0.665, eye: [E[0] * 0.4, 2.0, C[2] + 10.2], target: [0, C[1] + 0.7, C[2]], fov: 42 },
    { p: 0.72, eye: [-2.4, 1.0, C[2] + 9.6], target: [0.3, C[1] + 0.75, C[2]], fov: 40 },
    { p: 0.77, eye: [-0.6, 1.8, C[2] + 9.8], target: [0, C[1] + 0.75, C[2]], fov: 40 },
    ...(g.hasYears
      ? [
        { p: 0.8, eye: [-0.4, G[1] + 0.9, G[2] + 9.4], target: [0.2, G[1], G[2]], fov: 40 } as Key,
        { p: 0.9, eye: [0.4, G[1] + 0.7, G[2] + 9.2], target: [0.2, G[1], G[2]], fov: 40 } as Key,
      ]
      // no years beat: the camera stays on the cohorts until the close
      : [{ p: 0.9, eye: [-0.3, 1.8, C[2] + 9.8], target: [0, C[1] + 0.75, C[2]], fov: 40 } as Key]),
    { p: 0.95, eye: [0, F[1], F[2] + 8.5], target: [F[0], F[1], F[2]], fov: 36 },
    { p: 1, eye: [0, F[1], F[2] + 8.2], target: [F[0], F[1], F[2]], fov: 36 },
  ];
}

function cameraAt(keys: Key[], p: number, time: number): Camera {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i], b = keys[i + 1];
  const t = ss(0, 1, (p - a.p) / (b.p - a.p || 1));
  // a slow breathing drift keeps a parked frame alive
  const drift: Vec3 = [Math.sin(time * 0.21) * 0.06, Math.sin(time * 0.17) * 0.04, 0];
  return {
    eye: add(lerp3(a.eye, b.eye, t), drift),
    target: lerp3(a.target, b.target, t),
    fov: lerp(a.fov, b.fov, t),
    fogNear: 10,
    fogFar: 26,
  };
}

// ---- the frame -------------------------------------------------------------------------
export function drawStory(
  r: StoryRenderer,
  d: StoryData,
  g: Geometry,
  pal: Palette,
  p: number,
  time: number,
  /** top of the tallest years caption, as a fraction of stage height (portrait fit) */
  yearsCapFrac = 0.64,
  /** top of the tallest canyon-beat caption, in label-host px (canyon fit) */
  canyonCapPx = Infinity,
  /** top of the tallest 2020-episode caption, in label-host px (episode fit) */
  episodeCapPx = Infinity,
  /** bottom of the 2020 chart key, in label-host px */
  keyBottomPx = Infinity,
): FrameOut {
  // Canyon fit: the deepest trough, its label and the -50% line must sit
  // above the caption on every stage. Projected through the flat-view
  // cameras each frame (a few projections): first the view is lifted (the
  // camera lowered) into the empty space above, and only if that is not
  // enough is the depth scaled. Both ease out as the terrain rises, so the
  // 2020 slice still meets the unfold exactly.
  let cz = 1, lift = 0;
  if (p < 0.27 && Number.isFinite(canyonCapPx)) {
    const depth = Math.max(50, -Math.min(...d.canyonMarks.map((m) => m.dd), 0)) + 4;
    const floor = canyonCapPx - 38; // 30 px for the trough label, 8 px clear of the caption
    const top = r.cssHeight() * 0.2; // below the navbar and the keys
    for (const pp of [0.09, 0.12, 0.155]) {
      r.begin(cameraAt(g.keys, pp, 0));
      const y0 = r.project([0, 0, 0])?.y, yd = r.project([0, -depth * g.ddY, 0])?.y;
      if (y0 == null || yd == null || yd <= y0) continue;
      const pxPerWorld = (yd - y0) / (depth * g.ddY);
      const room = floor - top;
      const k = Math.min(1, room / (yd - y0));
      const drop = y0 + (yd - y0) * k - floor; // px the fitted trough still sits below the floor
      cz = Math.min(cz, k);
      lift = Math.max(lift, Math.max(0, drop) / pxPerWorld);
    }
    cz = Math.max(0.35, cz);
    const out = ss(0.2, 0.245, p);
    cz = cz + (1 - cz) * out;
    lift *= 1 - out;
  }
  // Episode fit, the same way: the fear strip's baseline and its month names
  // must clear the tallest 2020 caption; the view is lifted into the space above.
  // If even the whole band between the key and the caption is too short, the
  // chart's vertical scale is reported back (epFit) and the page rebuilds the
  // geometry with it, so key, sell rings, chart, fear strip and caption all clear.
  let epFit = g.epScale;
  const epIn = ss(0.285, 0.31, p) * (1 - ss(0.638, 0.646, p)); // held until the stage has faded out
  if (epIn > 0 && Number.isFinite(episodeCapPx)) {
    // Measured at both ends of the chart through the episode's first, middle
    // and last cameras: the view is angled, so one end sits lower than the
    // centre, and the camera drifts across the beat. Worst case wins, so the
    // month names under the lower end never meet the caption.
    const ringTop = g.E[1] + 1.45 * g.ve + 0.45; // price top plus a sell ring
    let yb: number | null = null, yt: number | null = null;
    for (const pp of [0.335, 0.45, 0.62]) {
      r.begin(cameraAt(g.keys, pp, 0));
      for (const x of [g.E[0] - EP_W, g.E[0] + EP_W]) {
        const b = r.project([x, g.E[1] + g.epBase, 0])?.y, t = r.project([x, ringTop, 0])?.y;
        if (b == null || t == null) continue;
        yb = yb == null ? b : Math.max(yb, b);
        yt = yt == null ? t : Math.min(yt, t);
      }
    }
    if (yb != null && yt != null && yb > yt) {
      const pxPerWorld = (yb - yt) / (ringTop - (g.E[1] + g.epBase));
      const floor = episodeCapPx - 46; // month names under the baseline (~36 px), 10 px clear
      const ceil = Number.isFinite(keyBottomPx) ? keyBottomPx + 8 : r.cssHeight() * (g.tall ? 0.16 : 0.22);
      // do not push the chart (or its sell rings) up under the keys
      const room = Math.max(0, yt - ceil);
      const need = Math.min(Math.max(0, yb - floor), room);
      lift = Math.max(lift, (need / pxPerWorld) * epIn);
      // span needed vs band available; the 0.45 ring allowance does not scale
      const span = yb - yt, band = floor - ceil, fixed = 0.45 * pxPerWorld;
      if (span > band + 1) epFit = Math.max(0.45, g.epScale * (band - fixed) / (span - fixed));
      else if (g.epScale < 1 && span < band - 12) epFit = Math.min(1, g.epScale * (band - fixed) / (span - fixed));
    }
  }
  const cam = cameraAt(g.keys, p, time);
  if (lift > 0) { cam.eye = [cam.eye[0], cam.eye[1] - lift, cam.eye[2]]; cam.target = [cam.target[0], cam.target[1] - lift, cam.target[2]]; }
  r.begin(cam);
  const labels: Label[] = [];
  let hud: FrameOut["hud"] = null;
  let flash = 0;

  // stage visibilities: each outgoing stage is dark before the next one lights
  const canyonA = 1 - ss(0.27, 0.29, p);
  // (outgoing reaches 0 at the exact progress the incoming starts; the caption
  // handoff sits on the same progress, see about-story.tsx)
  const episodeA = ss(0.3, 0.326, p) * (1 - ss(0.622, 0.638, p));
  const cohortA = ss(0.638, 0.66, p) * (1 - (g.hasYears ? ss(0.772, 0.786, p) : ss(0.9, 0.914, p)));
  const yearsA = ss(0.786, 0.802, p) * (1 - ss(0.9, 0.914, p));
  const closeA = ss(0.914, 0.934, p);

  if (canyonA > 0) drawCanyon(r, d, { ...g, ddY: g.ddY * cz }, pal, p, time, canyonA, labels);
  drawUnfold(r, g, pal, p, labels);
  if (episodeA > 0) {
    const out = drawEpisode(r, d, g, pal, p, time, episodeA, labels);
    hud = out.hud;
    flash = out.flash;
  }
  if (cohortA > 0) drawCohorts(r, d, g, pal, p, time, cohortA, labels);
  if (yearsA > 0 && d.hasYears) drawYears(r, d, g, pal, p, time, yearsA, labels, yearsCapFrac);
  if (closeA > 0) drawClose(r, g, pal, time, closeA);

  return { labels, hud, flash, epFit, stages: { canyon: canyonA, episode: episodeA, cohorts: cohortA, years: d.hasYears ? yearsA : 0, close: closeA } };
}

// ---- the unfold: 2020's monthly slice of the canyon line stretches into the
// daily chart while the camera pulls back, then hands over to the beam replay
function drawUnfold(r: StoryRenderer, g: Geometry, pal: Palette, p: number, labels: Label[]) {
  // stays up (bright) through the "bright line" caption, which ends at 0.345
  const a = ss(0.252, 0.266, p) * (1 - ss(0.348, 0.362, p));
  if (a <= 0) return;
  const m = ease(ss(0.272, 0.322, p));
  // name the slice before it unfolds
  const tagA = a * (1 - ss(0.28, 0.295, p));
  if (tagA > 0.01) {
    const i = Math.floor(g.ep.n / 2);
    labels.push({ key: "u2020", text: "2020", pos: [g.ep.from[i * 3], g.ep.from[i * 3 + 1] - 0.12, 0], alpha: tagA, tone: "hot", anchor: "below", prio: 3 });
  }
  const { from, price, morph } = g.ep;
  for (let i = 0; i < morph.length; i++) morph[i] = from[i] + (price[i] - from[i]) * m;
  // bright while unfolding, then settles to the replay's dim ghost level
  r.path(morph, 1.8, pal.hot, a * (1.3 - 1.15 * ss(0.345, 0.358, p)));
}

// ---- canyon ----------------------------------------------------------------------------
function drawCanyon(r: StoryRenderer, d: StoryData, g: Geometry, pal: Palette, p: number, time: number, A: number, labels: Label[]) {
  const n = g.n;
  const ti = beatT(p, "ignite");
  const tc = beatT(p, "canyon");

  // ignition: the spot flares, then the all-time-high line opens from the centre
  const open = ease(ti * 1.25);
  const pulse = 0.75 + 0.25 * Math.sin(time * 3.1);
  if (tc < 0.05) {
    // lights from nothing as the film pins, where the margin figure has just gone out
    r.spot([0, 0, 0], 3.2, pal.core, (2.4 + pulse) * A * ss(0, 0.006, p) * (1 - ss(0.02, 0.05, tc)));
  }

  // sweep head carves the drawdown into the flat line (first ~55% of the beat)
  const head = ease(tc / 0.55) * (n - 1);
  const carve = (i: number) => ss(0, 6, head - i);
  const halfOpen = open * (X1 - X0) * 0.5;

  // centre trench + terrain rows
  const rise = ss(0.155, 0.21, p); // terrain reveal as the camera lifts
  const dive = 1 - ss(0.235, 0.265, p); // only the data line is left as the camera dives
  for (const row of g.rows) {
    const centre = row.k === 0;
    // decorative rows stay well under the data line, and fade out for the dive
    const rowA = centre ? 1 : rise * dive * (0.08 + 0.3 * row.f) * (1 - Math.abs(row.k) / (ROWS + 2));
    if (rowA <= 0.004) continue;
    const pts = row.pts;
    const z = row.k * ROW_DZ;
    for (let i = 0; i < n; i++) {
      const x = g.xs[i];
      const y = d.canyon[i].dd * g.ddY * row.f * carve(i);
      pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z;
    }
    // only the opened span of the line exists during ignition
    const from = Math.max(0, ((-halfOpen - X0) / (X1 - X0)) * (n - 1));
    const to = Math.min(n - 1, ((halfOpen - X0) / (X1 - X0)) * (n - 1));
    if (to <= from) continue;
    const col = centre ? pal.hot : pal.mid;
    const lineA = centre ? 1.25 * (1 - 0.85 * ss(0.258, 0.278, p)) : rowA;
    r.path(pts, centre ? 1.7 : 0.9, col, lineA * A, from, to);
    if (centre) r.path(pts, 5, pal.mid, 0.12 * lineA * A, from, to); // soft sheath
  }

  // cross-hatching along z every 8 months turns the rows into a surface
  if (rise * dive > 0) {
    const col = new Float32Array((ROWS * 2 + 1) * 3);
    for (let i = 0; i < n; i += 8) {
      let m = 0;
      for (const row of g.rows) {
        col[m++] = g.xs[i];
        col[m++] = d.canyon[i].dd * g.ddY * row.f * carve(i);
        col[m++] = row.k * ROW_DZ;
      }
      r.path(col, 0.7, pal.dim, 0.18 * rise * dive * A);
    }
  }

  // the sweep head: electron spot on the trench
  if (tc > 0 && tc < 0.6) {
    const hi = Math.min(n - 1, Math.floor(head));
    r.spot([g.xs[hi], d.canyon[hi].dd * g.ddY, 0], 2.4, pal.core, 2.6 * A);
  }

  // fear light pools in the canyons
  const fearA = ss(0.14, 0.2, p) * A;
  if (fearA > 0) {
    const only2020 = ss(0.24, 0.26, p);
    for (let i = 0; i < n; i += 2) {
      const dd = d.canyon[i].dd * carve(i);
      if (dd > -7) continue;
      const keep = Math.abs(g.xs[i] - g.xMid2020) <= 0.2 ? 1 : 1 - only2020;
      if (keep <= 0.01) continue;
      const depth = -dd / 55;
      const y = dd * g.ddY;
      r.spot([g.xs[i], y + 0.08, 0], 10 + depth * 26, pal.amber, fearA * keep * 0.07 * depth ** 1.3);
      r.seg([g.xs[i], y, 0], [g.xs[i], 0, 0], 3.5, pal.amber, fearA * keep * 0.05 * depth);
    }
    // embers rising out of the deep canyons (decoration)
    if (g.deep.length) {
      for (let k = 0; k < 150; k++) {
        const i = g.deep[Math.floor(hash(k) * g.deep.length)];
        const floor = d.canyon[i].dd * g.ddY * carve(i);
        const ph = (time * (0.05 + hash(k + 9) * 0.07) + hash(k + 3)) % 1;
        const x = g.xs[i] + (hash(k + 5) - 0.5) * 0.12;
        const z = (hash(k + 7) - 0.5) * 1.2 * (0.4 + rise);
        const y = floor + ph * (0.4 - floor + 0.6);
        r.spot([x, y, z], 1.3, pal.amber, fearA * Math.sin(Math.PI * ph) * 0.9);
      }
    }
  }

  // canyon labels once the sweep has passed them
  const labA = ss(0.12, 0.17, p) * A * (1 - ss(0.24, 0.26, p));
  d.canyonMarks.forEach((m, k) => {
    const a = labA * ss(0, 4, head - m.i);
    if (a <= 0) return;
    void k; // the label layout keeps neighbours apart
    labels.push({ key: `c${m.label}`, text: `${m.label} · ${m.dd.toFixed(0)}%`, pos: [g.xs[m.i], m.dd * g.ddY - 0.16, 0], alpha: a, tone: "amber", anchor: "below", prio: 2 });
  });
  // percent gridlines: the flat line is 0%, each dashed rule a labeled depth
  const gridA = ss(0.085, 0.12, p) * A * dive;
  if (gridA > 0) {
    for (const pct of GRID_PCT) {
      dashed(r, [X0, -pct * g.ddY, 0], [X1, -pct * g.ddY, 0], 0.7, pal.dim, 0.45 * gridA, 0.07, 0.07);
    }
  }
  // scale labels belong to the flat view; they leave as the terrain rises
  const axisA = ss(0.09, 0.13, p) * A * (1 - ss(0.165, 0.195, p));
  if (axisA > 0) {
    // "0%" joins the scale column; its name sits on the line inside the plot,
    // so a late web font cannot push it from one side of the axis to the other
    // Portrait stages have no room left of the axis and the rules sit only a
    // label's height apart: all four values go inside at the left edge, where
    // the early years run flat, "0%" above its line and the depth values just
    // below theirs, so none covers a dip and none collides with the next.
    const tall = g.tall;
    labels.push({ key: "hi", text: "0%", pos: tall ? [X0 + 0.04, 0.03, 0] : [X0 - 0.06, 0, 0], alpha: axisA, tone: "dim", anchor: tall ? "aboveStart" : "left", pin: true, prio: 3, tight: true });
    labels.push({ key: "hi-t", text: "account high", short: "", pos: [X0 + 0.04, 0.03, 0], alpha: axisA, tone: "dim", anchor: "aboveStart", pin: true });
    for (const pct of GRID_PCT) {
      labels.push({ key: `g${pct}`, text: `−${pct}%`, pos: tall ? [X0 + 0.04, -pct * g.ddY - 0.02, 0] : [X0 - 0.06, -pct * g.ddY, 0], alpha: axisA, tone: "dim", anchor: tall ? "belowStart" : "left", pin: true, prio: 3, tight: true });
    }
  }
}

// ---- 2020 episode ----------------------------------------------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// world radius of a fill mark: area tracks the share of the account it moved
const fillR = (pct: number | null) => 0.02 + 0.005 * Math.sqrt(Math.max(0, pct ?? 0));
/**
 * Height of a fill mark's centre. A mark hangs a stem's length off the line,
 * measured from the highest (sells) or lowest (buys) close within the mark's
 * own width, so on a steep stretch it clears the neighbouring line and its glow.
 * The stem still starts at the mark's own close.
 */
function markY(ep: Geometry["ep"], i: number, side: "buy" | "sell", rad: number): number {
  const reach = rad + 0.1;
  let edge = ep.ys[i];
  for (let j = i - 1; j >= 0 && ep.xs[i] - ep.xs[j] <= reach; j--) edge = side === "sell" ? Math.max(edge, ep.ys[j]) : Math.min(edge, ep.ys[j]);
  for (let j = i + 1; j < ep.n && ep.xs[j] - ep.xs[i] <= reach; j++) edge = side === "sell" ? Math.max(edge, ep.ys[j]) : Math.min(edge, ep.ys[j]);
  return side === "sell" ? edge + SELL_STEM + rad : edge - STEM - rad;
}
const deepAmber = (pal: Palette): RGB => [pal.amber[0], pal.amber[1] * 0.55, pal.amber[2] * 0.3];
// fill marks sit off the price line on a short stem: buys below, sells above
const STEM = 0.16;
// sells hang higher so their hollow ring clears the line's glow and the buys below
const SELL_STEM = 0.3;

function drawEpisode(r: StoryRenderer, d: StoryData, g: Geometry, pal: Palette, p: number, time: number, A: number, labels: Label[]) {
  const { E } = g;
  const ep = g.ep;
  const days = d.episode.days;
  const cur = g.clock.cursor(p);
  const ci = Math.min(ep.n - 1, Math.round(cur));
  const base = E[1] + g.epBase, top100 = base + g.epFearH;
  let flash = 0;

  // axes: time baseline with month ticks; fear 0 and 100 guides
  r.seg([E[0] - EP_W, base, 0], [E[0] + EP_W, base, 0], 0.8, pal.dim, 0.6 * A);
  dashed(r, [E[0] - EP_W, top100, 0], [E[0] + EP_W, top100, 0], 0.6, pal.dim, 0.35 * A, 0.06, 0.08);
  const narrowStage = r.aspect() * r.cssHeight() < 600;
  let prevMonth = -1;
  days.forEach((day, i) => {
    const m = +day.d.slice(5, 7) - 1;
    if (m === prevMonth) return;
    prevMonth = m;
    const x = ep.xs[i];
    r.seg([x, base, 0], [x, base - 0.06, 0], 0.7, pal.dim, 0.7 * A);
    // names arrive with their ticks, not after the stage has finished fading in
    // (under 600 px wide: the initial only, so all twelve fit under the chart)
    labels.push({ key: `m${m}`, text: narrowStage ? MONTHS[m][0] : MONTHS[m], pos: [x, base - 0.07, 0], alpha: 0.9 * Math.min(1, A * 2.5), tone: "dim", anchor: "belowStart", prio: 0, pin: true, tight: true });
  });
  r.path(ep.ghost, 1, pal.mid, 0.14 * A);

  // fear strip up to the cursor: a dim amber field under a brighter top edge
  // While the "amber band" caption introduces the chart (p 0.30-0.345) the
  // whole year's band is shown; it then drops back so the beam can replay it.
  // (not scaled by the stage fade-in: the caption names the band from p 0.30)
  const preview = ss(0.3, 0.303, p) * (1 - ss(0.345, 0.358, p));
  for (let i = 0; i < ep.n; i++) {
    const f = (days[i].fear ?? 0) / 100;
    if (f <= 0) continue;
    const k = i <= cur ? A : preview;
    if (k <= 0) continue;
    r.seg([ep.xs[i], base, 0], [ep.xs[i], base + f * g.epFearH, 0], 1, pal.amber, k * (0.01 + 0.035 * f * f));
  }
  r.path(ep.fearTop, 1.1, pal.amber, 0.55 * A, 0, cur);
  // the whole year's fear line waits faintly ahead of the cursor, like the price ghost
  r.path(ep.fearTop, 0.9, pal.amber, Math.max(0.12 * A, 0.55 * preview), cur);

  // price, drawn by the beam up to the cursor: the brightest thing on screen
  r.path(ep.price, 1.8, pal.hot, 1.35 * A, 0, cur);
  r.path(ep.price, 6, pal.mid, 0.08 * A, 0, cur);
  const fi = Math.min(ep.n - 2, Math.floor(cur));
  const fr = cur - fi;
  const headY = lerp(ep.ys[fi], ep.ys[fi + 1] ?? ep.ys[fi], fr);
  const headX = lerp(ep.xs[fi], ep.xs[fi + 1] ?? ep.xs[fi], fr);
  if (cur > 0 && cur < ep.n - 1) {
    dashed(r, [headX, base, 0], [headX, headY - 0.05, 0], 0.6, pal.dim, 0.3 * A, 0.04, 0.05);
  }

  // the narrated event in focus (latest reached, still fresh) and its fill
  // Its window matches its caption's: from 0.6 sessions before the fill until
  // the next event's caption starts (the last one holds 26 sessions).
  const evs = d.episode.events;
  let fk = -1;
  evs.forEach((e, k) => { if (cur - e.i >= -0.6) fk = k; });
  const focus = fk >= 0 ? evs[fk] : undefined;
  const focusA = focus
    ? ss(-0.6, 0.2, cur - focus.i) * (fk === evs.length - 1 ? 1 - ss(24, 26, cur - focus.i) : 1)
    : 0;
  // the beam head's white bloom sits right under a narrated sell ring and would
  // fill it in: dim the head while a sell is narrated
  const sellFocus = focus?.side === "sell" ? focusA : 0;
  if (cur > 0 && cur < ep.n - 1) r.spot([headX, headY, 0], 2.6, pal.core, 2.6 * A * (1 - 0.85 * sellFocus));

  // simulated fills on stems off the price line: buys are filled bright dots
  // below it, sells hollow amber rings above it; area tracks share of account.
  // While an event is narrated, the other marks dim so its own mark stands out.
  const idx = new Map(days.map((x, i) => [x.d, i]));
  d.episode.fills.forEach((f, k) => {
    const i = idx.get(f.d);
    if (i == null) return;
    const age = cur - i; // in sessions
    if (age < -0.8) return;
    const px = ep.xs[i], py = ep.ys[i];
    const rad = fillR(f.pctEq);
    const isFocus = focus && focus.fill === f;
    // fresh marks glow; after ~12 sessions a mark settles dim, so only the
    // newest few (and the narrated one) stay among the bright objects on screen
    const settled = isFocus ? 0 : ss(8, 16, age);
    // un-narrated marks drop to a quiet level while a narrated one is up, and
    // lose their white core so the focus mark is the brightest mark on screen
    const quiet = isFocus ? 0 : focusA;
    const a = A * ss(-0.8, 0.3, age) * (1 - 0.78 * quiet) * (1 - 0.5 * settled);
    const dir = f.side === "buy" ? -1 : 1;
    const cy = markY(ep, i, f.side, rad);
    r.seg([px, py + dir * 0.025, 0], [px, cy - dir * rad, 0], 0.8, f.side === "buy" ? pal.hot : pal.amber, a * 0.6);
    if (f.side === "buy") disc(r, [px, cy, 0], rad, settled > 0.5 || quiet > 0.5 ? pal.hot : pal.core, a);
    else {
      // stroke only: a thick bright ring blooms into a filled disc
      // the narrated ring is brighter but in a deeper amber: bright additive
      // amber tonemaps toward yellow, so the extra light goes into red, not green
      ring(r, [px, cy, 0], rad, isFocus ? deepAmber(pal) : pal.amber, a * (isFocus ? 1.1 : 1), 1.3);
      if (age < 10 && quiet < 0.5 && !isFocus) {
        const tt = age / 10;
        for (let s2 = 0; s2 < 3 + Math.round(rad * 30); s2++) {
          const vx = (hash(k * 31 + s2) - 0.5) * 0.4;
          const vy = 0.3 + hash(k * 17 + s2) * 0.4;
          r.spot([px + vx * tt, cy + vy * tt, 0], 1.1, pal.amber, A * (1 - tt));
        }
      }
    }
    if (age < 6) {
      ring(r, [px, cy, 0], rad + age * 0.025, f.side === "buy" ? pal.hot : pal.amber, a * (1 - age / 6) * 0.6 * (1 - quiet));
      if (rad > 0.06 && !(isFocus && f.side === "sell")) flash = Math.max(flash, 0.2 * (1 - age / 3));
    }
    if (isFocus) ring(r, [px, cy, 0], rad + 0.035 + 0.01 * Math.sin(time * 4), f.side === "buy" ? pal.hot : deepAmber(pal), A * focusA * 0.6, 0.8);
  });

  // the focus label sits beside its own mark, level with it, so it never
  // reaches down under the caption block
  if (focus && focusA > 0) {
    const day = days[focus.i];
    const rad = fillR(focus.fill.pctEq);
    labels.push({
      key: `e${day.d}`,
      text: `${MONTHS[+day.d.slice(5, 7) - 1]} ${+day.d.slice(8)} · ${focus.side} ${Math.round(focus.fill.pctEq ?? 0)}%`,
      pos: [ep.xs[focus.i] + rad + 0.02, markY(ep, focus.i, focus.side, rad), 0],
      alpha: A * focusA,
      tone: focus.side === "sell" ? "amber" : "hot",
      prio: 3,
      anchor: "right",
    });
  }
  const axA = A * ss(0.3, 0.34, p);
  labels.push({ key: "ep-price", text: "SPY close", short: "", pos: [E[0] - EP_W - 0.06, ep.ys[0], 0], alpha: axA, tone: "dim", anchor: "left", pin: true });
  labels.push({ key: "ep-100", text: "fear 100", short: "100", pos: [E[0] - EP_W - 0.06, top100, 0], alpha: axA, tone: "amber", anchor: "left", pin: true });
  labels.push({ key: "ep-0", text: "0", pos: [E[0] - EP_W - 0.06, base, 0], alpha: axA, tone: "amber", anchor: "left", pin: true });

  const day = days[ci];
  const hud = {
    date: day.d,
    close: `$${day.c.toFixed(2)}`,
    fear: day.fear == null ? "·" : String(day.fear),
  };
  void time;
  return { hud: A > 0.5 ? hud : null, flash: flash * A };
}

/** a filled mark: concentric rings out to `rad` plus a hot core */
function disc(r: StoryRenderer, c: Vec3, rad: number, col: RGB, a: number) {
  for (let k = 1; k <= 3; k++) ring(r, c, (rad * k) / 3, col, a * 0.6, 1);
  r.spot(c, 1.1, col, a * 0.8);
}

function ring(r: StoryRenderer, c: Vec3, rad: number, col: RGB, a: number, w = 0.9) {
  const N = 28;
  const pts = new Float32Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    pts[i * 3] = c[0] + Math.cos(t) * rad;
    pts[i * 3 + 1] = c[1] + Math.sin(t) * rad;
    pts[i * 3 + 2] = c[2];
  }
  r.path(pts, w, col, a);
}

/** dashed straight line in world space */
function dashed(r: StoryRenderer, a: Vec3, b: Vec3, w: number, col: RGB, alpha: number, dash: number, gap: number) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  if (L <= 0) return;
  for (let t = 0; t < L; t += dash + gap) {
    r.seg(lerp3(a, b, t / L), lerp3(a, b, Math.min(1, (t + dash) / L)), w, col, alpha);
  }
}

// ---- start-year cohorts ------------------------------------------------------------------
const colH = (pct: number, vs: number) => Math.log10(1 + pct / 100) * 1.2 * vs;

const COHORT_GRID = [100, 1000];

function drawCohorts(r: StoryRenderer, d: StoryData, g: Geometry, pal: Palette, p: number, time: number, A: number, labels: Label[]) {
  const { C } = g;
  const t = beatT(p, "cohorts");
  const m = d.cohorts.length;
  // portrait stages keep a left gutter free of columns for the scale values
  const x0 = g.tall ? -2.2 : -4, x1 = g.tall ? 4.15 : 4;
  const step = (x1 - x0) / Math.max(1, m - 1);
  const xOf = (j: number) => C[0] + x0 + j * step;
  const dx = step * 0.2; // strategy right of each year's slot, buy-and-hold left
  const gm = (pal.bench[0] + pal.bench[1] + pal.bench[2]) / 3;
  // on narrow stages the strategy glow spills green onto the grey column a few
  // px away; the grey is pre-shifted away from green so the sum still reads grey
  const grey: RGB = g.tall ? [gm * 1.25, gm * 0.8, gm * 1.05] : [gm, gm, gm];

  r.seg([C[0] - 4.3, C[1], C[2]], [C[0] + 4.3, C[1], C[2]], 0.8, pal.dim, 0.6 * A);
  const gridA = A * ss(0.05, 0.25, t);
  for (const pct of COHORT_GRID) {
    const y = C[1] + colH(pct, g.vs);
    dashed(r, [C[0] - 4.3, y, C[2]], [C[0] + 4.3, y, C[2]], 0.6, pal.dim, 0.35 * gridA, 0.07, 0.08);
    // portrait stages have no room left of the axis: the value sits on its
    // gridline in the empty gutter before the first column
    labels.push(g.tall
      ? { key: `cg${pct}`, text: `+${pct.toLocaleString("en-US")}%`, pos: [C[0] - 4.3, y + 0.02, C[2]], alpha: gridA, tone: "dim", anchor: "aboveStart", pin: true, tight: true }
      : { key: `cg${pct}`, text: `+${pct.toLocaleString("en-US")}%`, pos: [C[0] - 4.38, y, C[2]], alpha: gridA, tone: "dim", anchor: "left", pin: true });
  }

  d.cohorts.forEach((c, j) => {
    // the first columns are already rising as the scene fades in
    const grow = ease(0.25 + t * 1.9 - (j / m) * 0.75);
    if (grow <= 0) return;
    const x = xOf(j);
    const hs = colH(c.s, g.vs) * grow, hb = colH(c.b, g.vs) * grow;
    // buy-and-hold: neutral grey, dashed, a flat cap and no glow
    // neutral grey (the theme's muted tone carries a green tint that reads teal
    // next to the strategy's glow), dimmer on narrow stages where columns crowd
    dashed(r, [x - dx, C[1], C[2]], [x - dx, C[1] + hb, C[2]], g.tall ? 0.6 : 1.3, grey, (g.tall ? 0.2 : 0.75) * A, 0.05, 0.04);
    r.seg([x - dx - 0.035, C[1] + hb, C[2]], [x - dx + 0.035, C[1] + hb, C[2]], g.tall ? 0.6 : 1.2, grey, (g.tall ? 0.25 : 0.9) * A);
    // strategy: solid, bright, a hot cap
    // narrow stages pack the pairs a few px apart: a thinner, dimmer strategy
    // stroke keeps its glow from washing the grey column beside it teal
    r.seg([x + dx, C[1], C[2]], [x + dx, C[1] + hs, C[2]], g.tall ? 1.4 : 2.2, pal.hot, g.tall ? 0.6 * A : A);
    r.spot([x + dx, C[1] + hs, C[2]], 2, pal.core, (1.1 + 0.3 * Math.sin(time * 2 + j)) * A * grow * (g.tall ? 0.6 : 1));
  });

  const labA = A * ss(0.35, 0.5, t);
  const pick = new Set([0, Math.floor((m - 1) / 2), m - 1]);
  d.cohorts.forEach((c, j) => {
    if (!pick.has(j)) return;
    labels.push({ key: `y${c.year}`, text: String(c.year), pos: [xOf(j), C[1] - 0.08, C[2]], alpha: labA, tone: "dim", anchor: "below", pin: true });
  });
  const first = d.cohorts[0];
  if (first) {
    labels.push({
      key: "c-first",
      text: `${first.year} start · strategy ${fmt(first.s)} · buy & hold ${fmt(first.b)}`,
      short: `${first.year}: ${fmt(first.s)} vs ${fmt(first.b)}`,
      pos: [xOf(0) - dx, C[1] + colH(first.s, g.vs) + 0.12, C[2]],
      alpha: A * ss(0.55, 0.7, t),
      tone: "hot",
      anchor: "aboveStart",
    });
  }
}
// signed: a losing cohort reads "−10%", never "+-10%"
const fmt = fmtPct;

// ---- independent calendar years ---------------------------------------------------------
function drawYears(r: StoryRenderer, d: StoryData, g: Geometry, pal: Palette, p: number, time: number, A: number, labels: Label[], capFrac: number) {
  const { G } = g;
  const t = beatT(p, "years");
  const span = Math.max(1, d.lastYear - d.firstYear);
  // Wide stages: one row per fund, years left to right. Tall (phone) stages
  // turn the grid sideways, one column per fund with years running down, so
  // cells stay wide enough to read.
  const tall = g.tall;
  // tall layout sizes itself to the visible height: the renderer keeps ~10.3
  // world units across, so height is ~10.3 / aspect. The grid fills the band
  // between the chart key and the caption; fund labels sit above each column.
  const vis = 10.3 / Math.max(0.3, r.aspect());
  // the grid runs from a fixed top (below the key and fund labels) down to just
  // above the caption, so short portrait screens shrink it instead of running under
  const topF = 0.245, botF = Math.max(topF + 0.2, Math.min(0.615, capFrac - 0.03));
  const H = (botF - topF) * vis, lift = (0.5 - (topF + botF) / 2) * vis;
  const hw = tall ? 0.62 : 0.095; // half width of a year cell
  const hh = tall ? Math.min(0.2, (0.4 * H) / span) : 0.095; // half height
  const cell = (row: number, y: number): Vec3 => tall
    ? [G[0] + 0.55 + (row - 1) * 2.6, G[1] + lift + H / 2 - (H * (y - d.firstYear)) / span, G[2]]
    : [G[0] - 4 + (8 * (y - d.firstYear)) / span, G[1] + (1 - row) * 0.5, G[2]];

  d.funds.forEach((f, row) => {
    f.years.forEach((yr) => {
      const reveal = ss(0, 0.08, 0.12 + t * 1.3 - ((yr.y - d.firstYear) / span) * 0.7 - row * 0.1);
      if (reveal <= 0) return;
      const c = cell(row, yr.y);
      const a = A * reveal;
      // brackets: short arms (28% of a side) leave a clear gap mid-edge; on wide
      // stages they are dimmer than a behind cell so the two never read alike
      if (yr.partial) corners(r, c, hw, hh, tall ? pal.mid : pal.dim, a * (tall ? 1.2 : 0.4), tall ? 2 : 1.2, tall ? 0.9 : 0.28);
      else if (yr.ahead) {
        rect(r, c, hw, hh, pal.hot, a);
        if (tall) {
          // thin cells: a stack of wide strokes fills the cell solid, so ahead
          // reads as a bright bar next to the faint outline of a year behind
          for (const k of [-0.5, 0, 0.5]) {
            r.seg([c[0] - hw, c[1] + k * hh, c[2]], [c[0] + hw, c[1] + k * hh, c[2]], 3, pal.hot, a * 0.9);
          }
        } else {
          // raster fill: scan lines read as a lit cell
          for (const k of [-0.5, 0, 0.5]) {
            r.seg([c[0] - hw * 0.8, c[1] + k * hh, c[2]], [c[0] + hw * 0.8, c[1] + k * hh, c[2]], 1.4, pal.hot, a * 0.85);
          }
          r.spot(c, 1.8, pal.core, a * (0.7 + 0.2 * Math.sin(time * 1.7 + yr.y)));
        }
      } else rect(r, c, hw, hh, pal.dim, a * (tall ? 0.45 : 0.75));
    });
    const labA = A * ss(0.15, 0.3, t);
    const countA = A * ss(0.55, 0.75, t);
    const first = cell(row, f.years[0]?.y ?? d.firstYear);
    if (tall) {
      labels.push({
        key: `f${f.sym}`, tight: true, text: countA > 0.3 ? `${f.sym} ${f.available ? `${f.ahead}/${f.total}` : "no data"}` : f.sym,
        pos: [first[0], first[1] + hh + 0.08, first[2]], alpha: labA, tone: "hot", anchor: "above", pin: true,
      });
    } else {
      labels.push({
        key: `f${f.sym}`, text: f.sym, short: countA > 0.3 ? `${f.sym} ${f.available ? `${f.ahead}/${f.total}` : "no data"}` : f.sym,
        pos: [first[0] - hw - 0.08, first[1], first[2]], alpha: labA, tone: "hot", anchor: "left", pin: true,
      });
      const last = cell(row, d.lastYear);
      labels.push({
        key: `fc${f.sym}`, text: f.available ? `${f.ahead}/${f.total} ahead` : "years unavailable", short: "",
        pos: [last[0] + hw + 0.1, last[1], last[2]], alpha: countA, tone: "hot", prio: 2, anchor: "right", pin: true,
      });
    }
  });
  const labA = A * ss(0.3, 0.45, t);
  const ticks = [d.firstYear, ...[2000, 2010, 2020].filter((y) => y > d.firstYear + 2 && y < d.lastYear - 2), d.lastYear];
  for (const y of ticks) {
    const c = cell(tall ? 0 : 2, y);
    labels.push(tall
      ? { key: `yt${y}`, text: String(y), pos: [c[0] - hw - 0.1, c[1], c[2]], alpha: labA, tone: "dim", anchor: "left", pin: true, prio: 0 }
      : { key: `yt${y}`, text: String(y), pos: [c[0], c[1] - hh - 0.06, c[2]], alpha: labA, tone: "dim", anchor: "below", pin: true, prio: 0 });
  }
}

/** a cell outline facing the camera (xy plane) */
function rect(r: StoryRenderer, c: Vec3, hw: number, hh: number, col: RGB, a: number) {
  const [x, y, z] = c;
  r.path(new Float32Array([x - hw, y - hh, z, x + hw, y - hh, z, x + hw, y + hh, z, x - hw, y + hh, z, x - hw, y - hh, z]), 1, col, a);
}

/** corner brackets only: a cell whose year is still running */
function corners(r: StoryRenderer, c: Vec3, hw: number, hh: number, col: RGB, a: number, w = 1, vArm = 0.28) {
  const [x, y, z] = c;
  // arm lengths as a fraction of each full side (2*hw, 2*hh)
  const kx = 2 * hw * 0.28, ky = 2 * hh * Math.min(0.45, vArm);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = x + sx * hw, cy = y + sy * hh;
    r.seg([cx, cy, z], [cx - sx * kx, cy, z], w, col, a);
    r.seg([cx, cy, z], [cx, cy - sy * ky, z], w, col, a);
  }
}

// ---- close: one spot, one decision per close ------------------------------------------------
function drawClose(r: StoryRenderer, g: Geometry, pal: Palette, time: number, A: number) {
  const { F } = g;
  // a session track: ticks mark closes; the spot lands on each in turn
  const N = 7, w = 3.2;
  r.seg([F[0] - w, F[1], F[2]], [F[0] + w, F[1], F[2]], 0.8, pal.dim, 0.7 * A);
  const beat = (time * 0.55) % N;
  const at = Math.floor(beat);
  for (let i = 0; i < N; i++) {
    const x = F[0] - w + ((2 * w) * (i + 0.5)) / N;
    const lit = i === at ? 1 - (beat - at) : i < at ? 0.25 : 0.12;
    r.seg([x, F[1] - 0.08, F[2]], [x, F[1] + 0.08, F[2]], 1, pal.hot, A * (0.4 + lit));
    if (i === at) {
      r.spot([x, F[1], F[2]], 2.6, pal.core, A * (1.5 + 1.5 * lit));
      ring(r, [x, F[1], F[2]], 0.05 + (beat - at) * 0.35, pal.hot, A * lit * 0.8);
    }
  }
}
