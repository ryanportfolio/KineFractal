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
import { beatT, clamp01, episodeClock, type EpisodeClock } from "@/lib/about-story-model";
import type { Camera, RGB, StoryRenderer, Vec3 } from "./story-renderer";

export interface Palette { core: RGB; hot: RGB; mid: RGB; dim: RGB; ghost: RGB; amber: RGB }

export interface Label {
  key: string;
  text: string;
  pos: Vec3;
  alpha: number;
  tone: "hot" | "dim" | "amber";
  anchor?: "above" | "aboveStart" | "below" | "left" | "right";
}
export interface FrameOut {
  labels: Label[];
  hud: { date: string; close: string; fear: string } | null;
  flash: number;
}

const X0 = -4, X1 = 4;
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
  n: number;
  xs: Float32Array;
  rows: { k: number; f: number; pts: Float32Array }[];
  deep: number[];
  x2020: number;
  y2020: number;
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
  };
  keys: Key[];
  clock: EpisodeClock;
}

const EP_W = 3.2, EP_BASE = -1.35, EP_FEAR_H = 0.95;

export function buildGeometry(d: StoryData): Geometry {
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
  const y2020 = d.canyon[i20].dd * DD_Y;

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
  for (let i = 0; i < en; i++) {
    const x = E[0] - EP_W + (2 * EP_W * i) / (en - 1);
    const y = E[1] - 0.1 + ((days[i].c - lo) / (hi - lo || 1)) * 1.7;
    exs[i] = x; eys[i] = y;
    price.set([x, y, E[2]], i * 3);
    ghost.set([x, y, E[2] - 0.02], i * 3);
    fearTop.set([x, E[1] + EP_BASE + ((days[i].fear ?? 0) / 100) * EP_FEAR_H, E[2]], i * 3);
  }

  const g = { n, xs, rows, deep, x2020, y2020, E, C, G, F, ep: { n: en, xs: exs, ys: eys, price, ghost, fearTop }, keys: [] as Key[], clock: episodeClock(en, d.episode.events.map((e) => e.i)) };
  g.keys = cameraKeys(g);
  return g;
}

// ---- camera path ----------------------------------------------------------------
type Key = { p: number; eye: Vec3; target: Vec3; fov: number };
function cameraKeys(g: Omit<Geometry, "keys" | "clock">): Key[] {
  const { E, C, G, F, x2020, y2020 } = g;
  return [
    { p: 0, eye: [0, 0, 11.5], target: [0, 0, 0], fov: 36 },
    { p: 0.07, eye: [0, -0.2, 11], target: [0, -0.35, 0], fov: 35 },
    { p: 0.155, eye: [0, -0.35, 10.2], target: [0, -0.5, 0], fov: 34 },
    { p: 0.215, eye: [-3.8, 2.7, 7.6], target: [0.4, -0.6, 0], fov: 40 },
    { p: 0.25, eye: [x2020 - 3.2, 1.3, 4.6], target: [x2020, -0.7, 0], fov: 42 },
    { p: 0.295, eye: [x2020 - 0.7, y2020 + 0.45, 1.3], target: [x2020 + 0.4, y2020 - 0.05, 0], fov: 56 },
    { p: 0.335, eye: [E[0] - 1.3, E[1] + 0.2, 8.0], target: [E[0], E[1] - 0.2, 0], fov: 38 },
    { p: 0.62, eye: [E[0] + 1.0, E[1] + 0.1, 7.7], target: [E[0] + 0.25, E[1] - 0.2, 0], fov: 38 },
    { p: 0.665, eye: [E[0] * 0.4, 2.0, C[2] + 10.2], target: [0, C[1] + 0.7, C[2]], fov: 42 },
    { p: 0.72, eye: [-2.4, 1.0, C[2] + 9.6], target: [0.3, C[1] + 0.75, C[2]], fov: 40 },
    { p: 0.77, eye: [-0.6, 1.8, C[2] + 9.8], target: [0, C[1] + 0.75, C[2]], fov: 40 },
    { p: 0.815, eye: [-0.3, G[1] + 5.0, G[2] + 8.6], target: [0.2, G[1] - 0.3, G[2]], fov: 40 },
    { p: 0.9, eye: [0.6, G[1] + 4.4, G[2] + 8.4], target: [0.3, G[1] - 0.3, G[2]], fov: 40 },
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
): FrameOut {
  r.begin(cameraAt(g.keys, p, time));
  const labels: Label[] = [];
  let hud: FrameOut["hud"] = null;
  let flash = 0;

  // stage visibilities
  const canyonA = 1 - ss(0.27, 0.31, p);
  const episodeA = ss(0.275, 0.33, p) * (1 - ss(0.63, 0.67, p));
  const cohortA = ss(0.64, 0.685, p) * (1 - ss(0.775, 0.805, p));
  const yearsA = ss(0.78, 0.82, p) * (1 - ss(0.9, 0.935, p));
  const closeA = ss(0.905, 0.95, p);

  if (canyonA > 0) drawCanyon(r, d, g, pal, p, time, canyonA, labels);
  if (episodeA > 0) {
    const out = drawEpisode(r, d, g, pal, p, time, episodeA, labels);
    hud = out.hud;
    flash = out.flash;
  }
  if (cohortA > 0) drawCohorts(r, d, g, pal, p, time, cohortA, labels);
  if (yearsA > 0) drawYears(r, d, g, pal, p, time, yearsA, labels);
  if (closeA > 0) drawClose(r, g, pal, time, closeA);

  return { labels, hud, flash };
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
    r.spot([0, 0, 0], 3.2, pal.core, (2.4 + pulse) * A * (1 - ss(0.02, 0.05, tc)));
  }

  // sweep head carves the drawdown into the flat line (first ~55% of the beat)
  const head = ease(tc / 0.55) * (n - 1);
  const carve = (i: number) => ss(0, 6, head - i);
  const halfOpen = open * (X1 - X0) * 0.5;

  // centre trench + terrain rows
  const rise = ss(0.155, 0.21, p); // terrain reveal as the camera lifts
  for (const row of g.rows) {
    const centre = row.k === 0;
    const rowA = centre ? 1 : rise * (0.18 + 0.55 * row.f) * (1 - Math.abs(row.k) / (ROWS + 2));
    if (rowA <= 0.004) continue;
    const pts = row.pts;
    const z = row.k * ROW_DZ;
    for (let i = 0; i < n; i++) {
      const x = g.xs[i];
      const y = d.canyon[i].dd * DD_Y * row.f * carve(i);
      pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z;
    }
    // only the opened span of the line exists during ignition
    const from = Math.max(0, ((-halfOpen - X0) / (X1 - X0)) * (n - 1));
    const to = Math.min(n - 1, ((halfOpen - X0) / (X1 - X0)) * (n - 1));
    if (to <= from) continue;
    const col = centre ? pal.hot : pal.mid;
    r.path(pts, centre ? 1.7 : 0.9, col, (centre ? 1.25 : rowA) * A, from, to);
    if (centre) r.path(pts, 5, pal.mid, 0.12 * A, from, to); // soft sheath
  }

  // cross-hatching along z every 8 months turns the rows into a surface
  if (rise > 0) {
    const col = new Float32Array((ROWS * 2 + 1) * 3);
    for (let i = 0; i < n; i += 8) {
      let m = 0;
      for (const row of g.rows) {
        col[m++] = g.xs[i];
        col[m++] = d.canyon[i].dd * DD_Y * row.f * carve(i);
        col[m++] = row.k * ROW_DZ;
      }
      r.path(col, 0.7, pal.dim, 0.35 * rise * A);
    }
  }

  // the sweep head: electron spot on the trench
  if (tc > 0 && tc < 0.6) {
    const hi = Math.min(n - 1, Math.floor(head));
    r.spot([g.xs[hi], d.canyon[hi].dd * DD_Y, 0], 2.4, pal.core, 2.6 * A);
  }

  // fear light pools in the canyons
  const fearA = ss(0.14, 0.2, p) * A;
  if (fearA > 0) {
    for (let i = 0; i < n; i += 2) {
      const dd = d.canyon[i].dd * carve(i);
      if (dd > -7) continue;
      const depth = -dd / 55;
      const y = dd * DD_Y;
      r.spot([g.xs[i], y + 0.08, 0], 10 + depth * 26, pal.amber, fearA * 0.07 * depth ** 1.3);
      r.seg([g.xs[i], y, 0], [g.xs[i], 0, 0], 3.5, pal.amber, fearA * 0.05 * depth);
    }
    // embers rising out of the deep canyons (decoration)
    if (g.deep.length) {
      for (let k = 0; k < 150; k++) {
        const i = g.deep[Math.floor(hash(k) * g.deep.length)];
        const floor = d.canyon[i].dd * DD_Y * carve(i);
        const ph = (time * (0.05 + hash(k + 9) * 0.07) + hash(k + 3)) % 1;
        const x = g.xs[i] + (hash(k + 5) - 0.5) * 0.12;
        const z = (hash(k + 7) - 0.5) * 1.2 * (0.4 + rise);
        const y = floor + ph * (0.4 - floor + 0.6);
        r.spot([x, y, z], 1.3, pal.amber, fearA * Math.sin(Math.PI * ph) * 0.9);
      }
    }
  }

  // canyon labels once the sweep has passed them
  const labA = ss(0.12, 0.17, p) * A * (1 - ss(0.245, 0.27, p));
  d.canyonMarks.forEach((m, k) => {
    const a = labA * ss(0, 4, head - m.i);
    if (a <= 0) return;
    // neighbours less than a world unit apart stack instead of overlapping
    const prev = d.canyonMarks[k - 1];
    const stack = prev && Math.abs(g.xs[m.i] - g.xs[prev.i]) < 1;
    const y = (stack ? Math.min(m.dd, prev.dd) : m.dd) * DD_Y - 0.12 - (stack ? 0.24 : 0);
    labels.push({ key: `c${m.label}`, text: `${m.label} · ${m.dd.toFixed(0)}%`, pos: [g.xs[m.i], y, 0], alpha: a, tone: "amber", anchor: "below" });
  });
  const axisA = ss(0.09, 0.13, p) * A * (1 - ss(0.2, 0.24, p));
  if (axisA > 0) {
    labels.push({ key: "hi", text: "all-time high", pos: [X0, 0.08, 0], alpha: axisA, tone: "dim", anchor: "aboveStart" });
  }
}

// ---- 2020 episode ----------------------------------------------------------------------
function drawEpisode(r: StoryRenderer, d: StoryData, g: Geometry, pal: Palette, p: number, time: number, A: number, labels: Label[]) {
  const { E } = g;
  const ep = g.ep;
  const days = d.episode.days;
  const cur = g.clock.cursor(p);
  const ci = Math.min(ep.n - 1, Math.round(cur));
  let flash = 0;

  // baselines
  r.seg([E[0] - EP_W, E[1] + EP_BASE, 0], [E[0] + EP_W, E[1] + EP_BASE, 0], 0.8, pal.dim, 0.5 * A);
  r.path(ep.ghost, 1, pal.mid, 0.16 * A);

  // fear columns up to the cursor, echoed behind for depth
  for (let i = 0; i <= Math.min(ep.n - 1, Math.floor(cur)); i++) {
    const f = (days[i].fear ?? 0) / 100;
    if (f <= 0) continue;
    const x = ep.xs[i];
    const top = E[1] + EP_BASE + f * EP_FEAR_H;
    const a = A * (0.025 + 0.15 * f ** 2);
    r.seg([x, E[1] + EP_BASE, 0], [x, top, 0], 1.1, pal.amber, a);
    r.seg([x, E[1] + EP_BASE, -0.35], [x, top, -0.35], 1.4, pal.amber, a * 0.3);
    if (f > 0.9) r.spot([x, top, 0], 3, pal.amber, A * 0.45 * (f - 0.9) * 10);
  }
  r.path(ep.fearTop, 1, pal.amber, 0.7 * A, 0, cur);

  // price, drawn by the beam up to the cursor
  r.path(ep.price, 1.8, pal.hot, 1.3 * A, 0, cur);
  r.path(ep.price, 6, pal.mid, 0.1 * A, 0, cur);
  const fi = Math.min(ep.n - 2, Math.floor(cur));
  const fr = cur - fi;
  const headY = lerp(ep.ys[fi], ep.ys[fi + 1] ?? ep.ys[fi], fr);
  const headX = lerp(ep.xs[fi], ep.xs[fi + 1] ?? ep.xs[fi], fr);
  if (cur > 0 && cur < ep.n - 1) {
    r.spot([headX, headY, 0], 2.6, pal.core, 2.8 * A);
    r.seg([headX, E[1] + EP_BASE, 0], [headX, headY, 0], 0.6, pal.dim, 0.35 * A);
  }

  // simulated fills
  const idx = new Map(days.map((x, i) => [x.d, i]));
  d.episode.fills.forEach((f, k) => {
    const i = idx.get(f.d);
    if (i == null) return;
    const age = cur - i; // in sessions
    if (age < -5) return;
    const px = ep.xs[i], py = ep.ys[i];
    const size = Math.sqrt(Math.max(0.1, f.pctEq ?? 1));
    if (f.side === "buy") {
      if (age < 0) {
        const y = py + (-age / 5) * 1.5;
        r.spot([px, y, 0], 1.4 + size * 0.2, pal.core, A * 1.6 * (1 + age / 5));
        r.seg([px, y, 0], [px, y + 0.25, 0], 1, pal.hot, A * 0.5 * (1 + age / 5));
      } else {
        if (age < 8) {
          const rad = 0.04 + age * 0.045 * (0.5 + size / 10);
          ring(r, [px, py, 0], rad, pal.hot, A * (1 - age / 8) * 0.9);
          if (size > 5) flash = Math.max(flash, 0.3 * (1 - age / 3));
        }
        r.spot([px, py, 0], 1.6 + size * 0.28, pal.hot, A * 1.1);
      }
    } else if (age >= 0) {
      if (age < 12) {
        for (let s = 0; s < 3 + Math.round(size / 2); s++) {
          const h = hash(k * 31 + s);
          const vx = (h - 0.5) * 0.5;
          const vy = 0.6 + hash(k * 17 + s) * 0.8;
          const tt = age / 12;
          r.spot([px + vx * tt, py + vy * tt, (hash(s + k) - 0.5) * 0.3 * tt], 1.2, pal.amber, A * (1 - tt) * 1.6);
        }
        if (size > 5) flash = Math.max(flash, 0.22 * (1 - age / 3));
      }
      r.spot([px, py, 0], 1.6 + size * 0.28, pal.amber, A * 1.1);
      r.seg([px, py, 0], [px, py + 0.1 + size * 0.02, 0], 1, pal.amber, A * 0.7);
    }
  });

  // narrated events: label only the latest one reached, while it is fresh
  const reached = d.episode.events.filter((e) => cur - e.i >= -0.5);
  for (const e of reached.slice(-1)) {
    const age = cur - e.i;
    const a = A * ss(-0.5, 1, age) * (1 - ss(22, 30, age));
    if (a <= 0) continue;
    const day = days[e.i];
    labels.push({
      key: `e${day.d}`,
      text: `${day.d.slice(5)} · ${e.side === "buy" ? "buy" : "sell"} ${Math.round(e.fill.pctEq ?? 0)}%`,
      pos: [ep.xs[e.i], ep.ys[e.i] + (e.side === "sell" ? 0.22 : -0.2), 0],
      alpha: a,
      tone: e.side === "sell" ? "amber" : "hot",
      anchor: e.side === "sell" ? "above" : "below",
    });
  }
  const axA = A * ss(0.3, 0.34, p);
  labels.push({ key: "ep-fear", text: "fear reading", pos: [E[0] - EP_W - 0.05, E[1] + EP_BASE + EP_FEAR_H * 0.5, 0], alpha: axA, tone: "amber", anchor: "left" });
  labels.push({ key: "ep-price", text: "SPY close", pos: [E[0] - EP_W - 0.05, ep.ys[0], 0], alpha: axA, tone: "dim", anchor: "left" });

  const day = days[ci];
  const hud = {
    date: day.d,
    close: `$${day.c.toFixed(2)}`,
    fear: day.fear == null ? "·" : String(day.fear),
  };
  void time;
  return { hud: A > 0.5 ? hud : null, flash: flash * A };
}

function ring(r: StoryRenderer, c: Vec3, rad: number, col: RGB, a: number) {
  const N = 28;
  const pts = new Float32Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    pts[i * 3] = c[0] + Math.cos(t) * rad;
    pts[i * 3 + 1] = c[1] + Math.sin(t) * rad;
    pts[i * 3 + 2] = c[2];
  }
  r.path(pts, 0.9, col, a);
}

// ---- start-year cohorts ------------------------------------------------------------------
const colH = (pct: number) => Math.log10(1 + pct / 100) * 1.2;

function drawCohorts(r: StoryRenderer, d: StoryData, g: Geometry, pal: Palette, p: number, time: number, A: number, labels: Label[]) {
  const { C } = g;
  const t = beatT(p, "cohorts");
  const m = d.cohorts.length;
  const xOf = (j: number) => C[0] - 4 + (8 * j) / Math.max(1, m - 1);

  r.seg([C[0] - 4.3, C[1], C[2]], [C[0] + 4.3, C[1], C[2]], 0.8, pal.dim, 0.6 * A);
  r.seg([C[0] - 4.3, C[1], C[2] - 0.35], [C[0] + 4.3, C[1], C[2] - 0.35], 0.6, pal.ghost, 0.8 * A);

  d.cohorts.forEach((c, j) => {
    const grow = ease(t * 1.9 - (j / m) * 0.75);
    if (grow <= 0) return;
    const x = xOf(j);
    const hs = colH(c.s) * grow, hb = colH(c.b) * grow;
    // buy-and-hold: dim, set back
    r.seg([x, C[1], C[2] - 0.35], [x, C[1] + hb, C[2] - 0.35], 2.2, pal.dim, 0.55 * A);
    r.spot([x, C[1] + hb, C[2] - 0.35], 1.8, pal.dim, 0.8 * A);
    // strategy: hot, in front
    r.seg([x, C[1], C[2]], [x, C[1] + hs, C[2]], 2.4, pal.hot, 0.95 * A);
    r.seg([x, C[1], C[2]], [x, C[1] + hs, C[2]], 7, pal.mid, 0.08 * A);
    r.spot([x, C[1] + hs, C[2]], 2.2, pal.core, (1.2 + 0.4 * Math.sin(time * 2 + j)) * A * grow);
    // reflection in the glass floor
    r.seg([x, C[1], C[2]], [x, C[1] - hs * 0.45, C[2]], 2.4, pal.mid, 0.12 * A);
  });

  const labA = A * ss(0.35, 0.5, t);
  const pick = new Set([0, Math.floor((m - 1) / 2), m - 1]);
  d.cohorts.forEach((c, j) => {
    if (!pick.has(j)) return;
    labels.push({ key: `y${c.year}`, text: String(c.year), pos: [xOf(j), C[1] - 0.12, C[2]], alpha: labA, tone: "dim", anchor: "below" });
  });
  const first = d.cohorts[0];
  if (first) {
    labels.push({
      key: "c-first",
      text: `${first.year} start · strategy ${fmt(first.s)} · buy & hold ${fmt(first.b)}`,
      pos: [xOf(0) - 0.05, C[1] + colH(first.s) + 0.14, C[2]],
      alpha: A * ss(0.55, 0.7, t),
      tone: "hot",
      anchor: "aboveStart",
    });
  }
}
const fmt = (v: number) => `+${Math.round(v).toLocaleString("en-US")}%`;

// ---- independent calendar years ---------------------------------------------------------
function drawYears(r: StoryRenderer, d: StoryData, g: Geometry, pal: Palette, p: number, time: number, A: number, labels: Label[]) {
  const { G } = g;
  const t = beatT(p, "years");
  const span = Math.max(1, d.lastYear - d.firstYear);
  const xOf = (y: number) => G[0] - 4 + (8 * (y - d.firstYear)) / span;
  const s = 0.09;

  d.funds.forEach((f, row) => {
    const z = G[2] + (row - 1) * 0.75;
    const y0 = G[1];
    r.seg([xOf(d.firstYear) - 0.25, y0, z], [xOf(d.lastYear) + 0.25, y0, z], 0.6, pal.ghost, A);
    f.years.forEach((yr) => {
      const reveal = ss(0, 0.08, t * 1.3 - ((yr.y - d.firstYear) / span) * 0.7 - row * 0.1);
      if (reveal <= 0) return;
      const x = xOf(yr.y);
      const c: RGB = yr.partial ? pal.ghost : yr.ahead ? pal.hot : pal.dim;
      const a = A * reveal * (yr.partial ? 0.8 : 1);
      square(r, [x, y0, z], s, c, a * (yr.ahead ? 1 : 0.8));
      if (yr.ahead && !yr.partial) {
        square(r, [x, y0, z], s * 0.55, pal.hot, a * 0.8);
        r.spot([x, y0, z], 2, pal.core, a * (1 + 0.3 * Math.sin(time * 1.7 + yr.y)));
        r.seg([x, y0, z], [x, y0 + 0.28 * reveal, z], 1.2, pal.hot, a * 0.5);
      }
    });
    const labA = A * ss(0.15, 0.3, t);
    labels.push({ key: `f${f.sym}`, text: f.sym, pos: [xOf(d.firstYear) - 0.3, y0, z], alpha: labA, tone: "hot", anchor: "left" });
    labels.push({
      key: `fc${f.sym}`,
      text: `${f.ahead}/${f.total} years ahead`,
      pos: [xOf(d.lastYear) + 0.3, y0, z],
      alpha: A * ss(0.55, 0.75, t),
      tone: "hot",
      anchor: "right",
    });
  });
  const labA = A * ss(0.3, 0.45, t);
  labels.push({ key: "yf", text: String(d.firstYear), pos: [xOf(d.firstYear), G[1], G[2] + 1.2], alpha: labA, tone: "dim", anchor: "below" });
  labels.push({ key: "yl", text: String(d.lastYear), pos: [xOf(d.lastYear), G[1], G[2] + 1.2], alpha: labA, tone: "dim", anchor: "below" });
}

function square(r: StoryRenderer, c: Vec3, s: number, col: RGB, a: number) {
  const [x, y, z] = c;
  r.path(new Float32Array([x - s, y, z - s, x + s, y, z - s, x + s, y, z + s, x - s, y, z + s, x - s, y, z - s]), 0.9, col, a);
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
