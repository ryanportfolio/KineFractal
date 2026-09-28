// Kine Fractal candlestick wordmark.
//
// Technique: each letter is built as a bold solid silhouette and used as an SVG
// clip mask (this guarantees legibility). A dense, deterministic field of
// vertical candlesticks (green + cyan bodies, white-hot cores, thin wicks) is
// then clipped to the letterforms so the candles become the texture *inside*
// crisp letters. A glow halo wraps the clip from the outside so the bloom is not
// cut off. Subtle circuit/grid texture sits behind; wick "tails" dangle below.
//
// The SVG markup is generated once at module load. The RNG is seeded, so the
// output is stable across renders and builds (no hydration mismatch, no churn).
// Background is genuinely transparent (no painted rect) — verified over magenta
// and white during design.

import { useId } from "react";

type Stroke = (string | number)[];
interface Glyph {
  w: number;
  s: Stroke[];
}

interface WordmarkParts {
  clip: string;
  field: string;
  cores: string;
  tex: string;
  tails: string;
  vw: number;
  vh: number;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParts(): WordmarkParts {
  const rng = mulberry32(40191);
  const jit = (m: number) => (rng() * 2 - 1) * m;
  const capTop = 70;
  const baseline = 270;
  const HW = 19; // half stroke ribbon width
  const GAP = 30;

  // --- letter silhouettes -> clip mask ------------------------------------
  const clip: string[] = [];
  const intervals: Array<[number, number]> = [];
  const addV = (cx: number, y0: number, y1: number) =>
    clip.push(
      `<rect x="${(cx - HW).toFixed(1)}" y="${y0.toFixed(1)}" width="${2 * HW}" height="${(y1 - y0).toFixed(1)}" rx="5"/>`,
    );
  const addH = (cy: number, x0: number, x1: number) =>
    clip.push(
      `<rect x="${(x0 - 4).toFixed(1)}" y="${(cy - HW).toFixed(1)}" width="${(x1 - x0 + 8).toFixed(1)}" height="${2 * HW}" rx="5"/>`,
    );
  const addD = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * HW;
    const ny = (dx / len) * HW;
    clip.push(
      `<polygon points="${(ax + nx).toFixed(1)},${(ay + ny).toFixed(1)} ${(bx + nx).toFixed(1)},${(by + ny).toFixed(1)} ${(bx - nx).toFixed(1)},${(by - ny).toFixed(1)} ${(ax - nx).toFixed(1)},${(ay - ny).toFixed(1)}"/>`,
    );
  };

  const LET: Record<string, Glyph> = {
    K: { w: 128, s: [["V", 18, 0, 200], ["D", 30, 100, 122, 6], ["D", 30, 100, 122, 194]] },
    I: { w: 38, s: [["V", 19, 0, 200]] },
    N: { w: 132, s: [["V", 18, 0, 200], ["V", 114, 0, 200], ["D", 32, 6, 100, 194]] },
    E: { w: 120, s: [["V", 18, 0, 200], ["H", 16, 18, 116], ["H", 100, 18, 100], ["H", 184, 18, 116]] },
    F: { w: 116, s: [["V", 18, 0, 200], ["H", 16, 18, 116], ["H", 100, 18, 100]] },
    R: { w: 128, s: [["V", 18, 0, 200], ["H", 16, 18, 100], ["V", 104, 16, 104], ["H", 100, 18, 108], ["D", 56, 100, 120, 200]] },
    A: { w: 140, s: [["D", 16, 200, 70, 6], ["D", 124, 200, 70, 6], ["H", 134, 42, 98]] },
    C: { w: 120, s: [["V", 18, 16, 184], ["H", 16, 18, 112], ["H", 184, 18, 112]] },
    T: { w: 120, s: [["H", 16, 0, 120], ["V", 60, 16, 200]] },
    L: { w: 112, s: [["V", 18, 0, 200], ["H", 184, 18, 108]] },
  };

  const word = "KINE FRACTAL";
  let x = 70;
  let minX = 1e9;
  let maxX = 0;
  let spaceX = 0;
  for (const ch of word) {
    if (ch === " ") {
      spaceX = x;
      x += 88;
      continue;
    }
    const L = LET[ch];
    const xoff = x;
    for (const st of L.s) {
      const t = st[0] as string;
      if (t === "V") addV(xoff + (st[1] as number), capTop + (st[2] as number), capTop + (st[3] as number));
      else if (t === "H") addH(capTop + (st[1] as number), xoff + (st[2] as number), xoff + (st[3] as number));
      else addD(xoff + (st[1] as number), capTop + (st[2] as number), xoff + (st[3] as number), capTop + (st[4] as number));
    }
    intervals.push([xoff - HW, xoff + L.w + HW]);
    if (xoff < minX) minX = xoff;
    if (xoff + L.w > maxX) maxX = xoff + L.w;
    x += L.w + GAP;
  }
  const inside = (cx: number) => intervals.some(([a, b]) => cx >= a && cx <= b);

  // --- candle field (clipped to the letters) ------------------------------
  const colr = (): [string, string] => {
    const r = rng();
    if (r < 0.64) return ["#00ff88", "#0c5234"];
    if (r < 0.87) return ["#1cffce", "#0c5246"];
    return ["#bfffec", "#3f7163"];
  };
  const field: string[] = [];
  const cores: string[] = [];
  const bw = 9;
  for (let cx = minX - 4; cx <= maxX + 4; cx += 13) {
    if (!inside(cx)) continue;
    let y = capTop - 14;
    while (y < baseline + 14) {
      const bh = 14 + rng() * 30;
      const col = colr();
      const solid = rng() < 0.82;
      const uw = rng() < 0.72 ? 2 + rng() * 15 : 0;
      const lw = rng() < 0.72 ? 2 + rng() * 15 : 0;
      const wx = cx + jit(1.2);
      if (uw || lw)
        field.push(
          `<line x1="${wx.toFixed(1)}" y1="${(y - uw).toFixed(1)}" x2="${wx.toFixed(1)}" y2="${(y + bh + lw).toFixed(1)}" stroke="${col[0]}" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/>`,
        );
      if (solid) {
        field.push(
          `<rect x="${(wx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1" fill="${col[0]}" stroke="${col[1]}" stroke-width="0.8"/>`,
        );
        if (rng() < 0.32)
          cores.push(
            `<rect x="${(wx - bw * 0.18).toFixed(1)}" y="${(y + 1.5).toFixed(1)}" width="${(bw * 0.36).toFixed(1)}" height="${Math.max(2, bh - 3).toFixed(1)}" rx="1" fill="#e8fff8" opacity="0.55"/>`,
          );
      } else {
        field.push(
          `<rect x="${(wx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1" fill="none" stroke="${col[0]}" stroke-width="1.8"/>`,
        );
      }
      y += bh + (1 + rng() * 6);
    }
  }

  // --- secondary texture (behind) + tails (below) -------------------------
  let tex = "";
  for (let gx = minX - 6; gx <= maxX + 6; gx += 26)
    for (let gy = capTop - 4; gy <= baseline + 4; gy += 26)
      if (rng() < 0.8) tex += `<rect x="${gx}" y="${gy}" width="2" height="2" fill="#1cffce" opacity="0.5"/>`;
  for (let ct = 0; ct < 7; ct++) {
    const sx = minX + rng() * (maxX - minX - 120);
    const sy = capTop + rng() * 200;
    const ll = 40 + rng() * 80;
    const bend = 20 + rng() * 40;
    tex += `<path d="M${sx.toFixed(0)} ${sy.toFixed(0)} h${ll.toFixed(0)} v${bend.toFixed(0)}" fill="none" stroke="#1cffce" stroke-width="1" opacity="0.35"/>`;
  }
  for (let tx = minX; tx <= maxX; tx += 30) {
    const th = 8 + rng() * 7;
    tex += `<line x1="${tx.toFixed(1)}" y1="278" x2="${tx.toFixed(1)}" y2="${(278 + th).toFixed(1)}" stroke="#00ff88" stroke-width="1.2" opacity="0.7"/>`;
  }
  let tails = "";
  let placed = 0;
  let guard = 0;
  while (placed < 16 && guard < 240) {
    guard++;
    const tcx = minX + rng() * (maxX - minX);
    if (!inside(tcx)) continue;
    const tl = 24 + rng() * 60;
    tails += `<line x1="${tcx.toFixed(1)}" y1="${(baseline - 6).toFixed(1)}" x2="${tcx.toFixed(1)}" y2="${(baseline + tl).toFixed(1)}" stroke="#00ff88" stroke-width="1.4" opacity="0.5" stroke-linecap="round"/>`;
    placed++;
  }
  if (spaceX)
    tails += `<text x="${(spaceX + 30).toFixed(0)}" y="${capTop + 118}" fill="#1cffce" opacity="0.5" font-family="monospace" font-size="30">&gt;</text>`;

  return { clip: clip.join(""), field: field.join(""), cores: cores.join(""), tex, tails, vw: maxX + 72, vh: 362 };
}

// Generated once at module load (seeded RNG → identical geometry every call).
const PARTS = buildParts();

// Assemble the final <svg> for one instance, with ids namespaced by `id` so the
// mark can appear more than once on a page (hero + navbar) without id clashes.
// The candle field is defined once and reused via <use> for the glow + crisp
// layers, keeping the DOM light.
function assemble(id: string, p: WordmarkParts): string {
  return (
    `<svg viewBox="0 0 ${p.vw} ${p.vh}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;overflow:visible">` +
    `<defs>` +
    `<filter id="${id}-bloom" x="-25%" y="-55%" width="150%" height="210%">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="2" result="s"/>` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="m"/>` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="l"/>` +
    `<feMerge><feMergeNode in="l"/><feMergeNode in="m"/><feMergeNode in="s"/></feMerge>` +
    `</filter>` +
    `<clipPath id="${id}-lt">${p.clip}</clipPath>` +
    `<g id="${id}-field" clip-path="url(#${id}-lt)">${p.field}</g>` +
    `</defs>` +
    `<g opacity="0.22">${p.tex}</g>` +
    `<g filter="url(#${id}-bloom)" opacity="0.8"><use href="#${id}-field"/></g>` +
    `<use href="#${id}-field"/>` +
    `<g clip-path="url(#${id}-lt)">${p.cores}</g>` +
    `<g>${p.tails}</g>` +
    `</svg>`
  );
}

export function KineFractalWordmark({ className }: { className?: string }) {
  const id = "kf" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      className={`kf-wordmark ${className ?? ""}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: assemble(id, PARTS) }}
    />
  );
}
