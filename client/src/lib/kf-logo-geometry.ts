// Geometry for the Kine Fractal logo: the ring-and-waves mark (from kf-logo.tsx)
// beside the KINE FRACTAL wordmark, plus everything the intro morph needs.
//
// Units: the wordmark's cap height is 20 (cap top y=0, baseline y=20). The mark
// is a D=30 circle centred on the cap height, left of the text. Pure functions,
// no DOM: paths are sampled analytically so the morph keyframes are stable.

export type Pt = [number, number];

// Monoline glyphs, absolute commands only, in the order the beam writes them.
const GLYPH: Record<string, { w: number; s: string[] }> = {
  K: { w: 12.4, s: ["M0 0V20", "M12 0L0 12", "M4.6 7.4L12.4 20"] },
  I: { w: 0, s: ["M0 0V20"] },
  N: { w: 12, s: ["M0 20V0L12 20V0"] },
  E: { w: 11, s: ["M11 0H0V20H11", "M0 10H8.6"] },
  F: { w: 11, s: ["M11 0H0V20", "M0 10H8.6"] },
  R: { w: 12.4, s: ["M0 20V0H6.6C9.9 0 12 2.3 12 5.4S9.9 10.8 6.6 10.8H0", "M6.2 10.8L12.4 20"] },
  A: { w: 12.8, s: ["M0 20L6.4 0L12.8 20", "M2.3 13.2H10.5"] },
  C: { w: 12.2, s: ["M12.2 3.6C10.9 1.4 8.9 0 6.6 0C2.9 0 0 4.4 0 10S2.9 20 6.6 20C8.9 20 10.9 18.6 12.2 16.4"] },
  T: { w: 12, s: ["M0 0H12", "M6 0V20"] },
  L: { w: 10, s: ["M0 0V20H10"] },
};
const KERN: Record<string, number> = { TA: -2.4, AT: -2.4, RA: -0.6, AC: -0.4, CT: -1, AL: -0.6 };
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4 };

// The hero mark's five waves, in its 0-100 box.
const WAVES100 = [
  "M20 35C35 25 65 45 80 35",
  "M15 42.5C30 32.5 60 52.5 85 42.5",
  "M12 50C27 40 57 60 88 50",
  "M15 57.5C30 47.5 60 67.5 85 57.5",
  "M20 65C35 55 65 75 80 65",
];

/** Flatten a single-subpath path made of M/L/H/V/C/S into a dense polyline. */
function flatten(d: string, steps = 24): Pt[] {
  const toks = d.match(/[MLHVCS]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const pts: Pt[] = [];
  let cmd = "", buf: number[] = [], cur: Pt = [0, 0], lastCtrl: Pt | null = null;
  const cubic = (p1: Pt, p2: Pt, p3: Pt) => {
    const p0 = cur;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    lastCtrl = p2;
    cur = p3;
  };
  for (const t of toks) {
    if (/[A-Z]/.test(t)) { cmd = t; continue; }
    buf.push(+t);
    if (buf.length < ARITY[cmd]) continue;
    const a = buf;
    buf = [];
    if (cmd === "M") { cur = [a[0], a[1]]; pts.push(cur); cmd = "L"; lastCtrl = null; }
    else if (cmd === "L") { cur = [a[0], a[1]]; pts.push(cur); lastCtrl = null; }
    else if (cmd === "H") { cur = [a[0], cur[1]]; pts.push(cur); lastCtrl = null; }
    else if (cmd === "V") { cur = [cur[0], a[0]]; pts.push(cur); lastCtrl = null; }
    else if (cmd === "C") cubic([a[0], a[1]], [a[2], a[3]], [a[4], a[5]]);
    else if (cmd === "S") {
      const lc: Pt = lastCtrl ?? cur;
      cubic([2 * cur[0] - lc[0], 2 * cur[1] - lc[1]], [a[0], a[1]], [a[2], a[3]]);
    }
  }
  return pts;
}

/** n points evenly spaced by arc length over the [from, to] fraction of a polyline. */
export function resample(pts: Pt[], n: number, from = 0, to = 1): Pt[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = L * (from + ((to - from) * i) / (n - 1));
    while (j < cum.length - 1 && cum[j] < s) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (s - cum[j - 1]) / seg));
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f]);
  }
  return out;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Polyline path string. */
export const polyD = (pts: Pt[]) => "M" + pts.map(([x, y]) => `${r3(x)} ${r3(y)}`).join("L");

function shift(d: string, dx: number): string {
  const toks = d.match(/[MLHVCS]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  let cmd = "", buf: number[] = [], out = "";
  for (const t of toks) {
    if (/[A-Z]/.test(t)) { cmd = t; continue; }
    buf.push(+t);
    if (buf.length < ARITY[cmd]) continue;
    const a = cmd === "V" ? buf : cmd === "H" ? [buf[0] + dx] : buf.map((v, i) => (i % 2 ? v : v + dx));
    out += cmd + a.map(r3).join(" ");
    buf = [];
    if (cmd === "M") cmd = "L";
  }
  return out;
}

export const N_PTS = 26;

export interface Stroke {
  d: string;
  pts: Pt[]; // N_PTS samples
  x0: number; x1: number; y0: number; y1: number;
  /** intro: which wave it comes from and that piece's points inside the mark */
  wave: number; start: Pt[]; row: Pt[]; color: "top" | "hot"; topT: number; order: number;
}

export interface Lockup {
  large: boolean;
  vb: [number, number, number, number];
  D: number; my: number; tx: number; right: number;
  sw: number; wsw: number; rsw: number;
  ring: { cx: number; cy: number; r: number };
  strokes: Stroke[];
  waves: { d: string; pts: Pt[]; top: boolean }[];
  /** strokes whose copies rebuild the mark: one per wave, top wave first */
  bars: number[];
}

const cache = new Map<string, Lockup>();

/** Picked in the logo lab (2026-10-10): stroke weight 3.6 at nav size. */
export function lockup(large: boolean, weight = 3.6): Lockup {
  const key = `${large}:${weight}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const D = 30, my = 10 - D / 2, tx = D + 7;
  const sw = large ? weight * 0.62 : weight;
  const wsw = large ? Math.max(sw * 0.72, 1.7) : Math.max(sw * 0.6, 1.6);
  const rsw = Math.max(sw * 0.5, 1.25);
  const waveIdx = large ? [0, 1, 2, 3, 4] : [0, 2, 4]; // five 2 px lines do not fit a 24 px ring
  const W = waveIdx.length;

  // wordmark strokes
  const raw: { d: string; ch: string; si: number }[] = [];
  let x = tx, prev = "";
  for (const ch of "KINE FRACTAL") {
    if (ch === " ") { x += 11; prev = ""; continue; }
    if (prev) x += 4.6 + (KERN[prev + ch] ?? 0);
    const g = GLYPH[ch];
    g.s.forEach((s, si) => raw.push({ d: shift(s, x), ch, si }));
    x += g.w;
    prev = ch;
  }
  const right = x;

  // mark waves in units
  const toUnits = ([px, py]: Pt): Pt => [(px * D) / 100, my + (py * D) / 100];
  const waves = waveIdx.map((wi, i) => {
    const pts = resample(flatten(WAVES100[wi]).map(toUnits), 80);
    return { d: polyD(pts), pts, top: i === 0 };
  });

  // assign strokes round-robin (in x order) to waves; each wave splits into one piece per stroke
  const sampled = raw.map((s) => {
    const pts = resample(flatten(s.d), N_PTS);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { ...s, pts, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const order = sampled.map((_, i) => i).sort((a, b) => sampled[a].x0 + sampled[a].x1 - (sampled[b].x0 + sampled[b].x1));
  const perWave: number[][] = waves.map(() => []);
  order.forEach((si, k) => perWave[k % W].push(si));
  const strokes: Stroke[] = new Array(sampled.length);
  perWave.forEach((list, w) => {
    const n = list.length;
    const rowY = 2.5 + (w * 15) / (W - 1);
    list.forEach((si, j) => {
      const s = sampled[si];
      const start = resample(waves[w].pts, N_PTS, j / n + 0.012, (j + 1) / n - 0.012);
      let a = s.x0, b = s.x1;
      if (b - a < 6) { const c = (a + b) / 2; a = c - 3.2; b = c + 3.2; }
      const row = Array.from({ length: N_PTS }, (_, i): Pt => {
        const px = a + ((b - a) * i) / (N_PTS - 1);
        return [px, rowY + 1.3 * Math.sin(px * 0.32 + w * 1.7)];
      });
      strokes[si] = { d: s.d, pts: s.pts, x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1, wave: w, start, row, color: w === 0 ? "top" : "hot", topT: (j + 0.5) / n, order: j / n };
    });
  });

  // crossbars (E mid, F mid, A bar, T bar, A bar) -> mark waves
  const bars = sampled.map((s, i) => ({ s, i })).filter(({ s }) => s.y1 - s.y0 < 1 && s.x1 - s.x0 > 5 && !(s.ch === "E" && s.si === 0)).map(({ i }) => i);
  const pick = W === 5 ? bars.slice(0, 5) : [bars[0], bars[3], bars[4] ?? bars[2]];

  const pad = 6;
  const out: Lockup = {
    large, D, my, tx, right, sw, wsw, rsw,
    vb: [-pad, my - pad, right + 2 * pad, D + 2 * pad],
    ring: { cx: D / 2, cy: 10, r: D * 0.48 },
    strokes, waves, bars: pick,
  };
  cache.set(key, out);
  return out;
}

const TOP_STOPS = ["#ef4444", "#f97366", "#fb923c", "#facc15", "#84cc16", "#22c55e"];
export const TOP_GRADIENT = TOP_STOPS;
/** Colour along the top wave's red-to-green gradient, t in [0, 1]. */
export function topColor(t: number): string {
  const f = Math.min(0.9999, Math.max(0, t)) * (TOP_STOPS.length - 1);
  const i = Math.floor(f), k = f - i;
  const h = (s: string) => [1, 3, 5].map((p) => parseInt(s.slice(p, p + 2), 16));
  const a = h(TOP_STOPS[i]), b = h(TOP_STOPS[i + 1]);
  return "#" + a.map((v, n) => Math.round(v + (b[n] - v) * k).toString(16).padStart(2, "0")).join("");
}
