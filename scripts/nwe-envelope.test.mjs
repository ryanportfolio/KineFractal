import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// the module is a plain script for a <script src> tag: run it in an empty context, with no
// window or document, and read the one global it sets
const code = await readFile(new URL("../server/charts-app/nwe-envelope.js", import.meta.url), "utf8");
const ctx = vm.createContext({});
vm.runInContext(code, ctx);
const NWE = ctx.NWEnvelope;

const N = 500;

// a repeatable price-like series: a seeded random walk
function walk(n, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    p *= 1 + (rnd() - 0.5) * 0.03;
    out.push(p);
  }
  return out;
}

// the definition at the top of nwe-envelope.js, written the slow way: every value summed
// from scratch
function slowEnvelope(x, bw, mult, width) {
  const coef = (k) => Math.exp(-(k * k) / (2 * bw * bw));
  const n = x.length;
  const centre = [], half = [];
  for (let t = 0; t < n; t++) {
    const K = Math.min(N - 1, t);
    let num = 0, den = 0;
    for (let k = 0; k <= K; k++) { num += x[t - k] * coef(k); den += coef(k); }
    centre.push(num / den);
  }
  for (let t = 0; t < n; t++) {
    if (width === "alert") {
      const L = Math.min(N - 1, t + 1);
      let sum = 0;
      for (let i = t - L + 1; i <= t; i++) sum += Math.abs(x[i] - centre[i]);
      half.push(mult * sum / L);
    } else {
      const W = Math.min(N, t + 1), a = t - W + 1;
      let sum = 0;
      for (let i = a; i <= t; i++) {
        let num = 0, den = 0;
        for (let j = a; j <= t; j++) { const w = coef(Math.abs(i - j)); num += x[j] * w; den += w; }
        sum += Math.abs(x[i] - num / den);
      }
      half.push(mult * sum / Math.max(W - 1, 1));
    }
  }
  return { centre, half };
}

function assertClose(got, want, label) {
  assert.equal(got.length, want.length, label + " length");
  for (let i = 0; i < want.length; i++) {
    const lim = 1e-9 * Math.max(1, Math.abs(want[i]));
    assert.ok(Math.abs(got[i] - want[i]) <= lim, `${label}[${i}]: got ${got[i]}, want ${want[i]}`);
  }
}

test("the script sets NWEnvelope with its option lists and defaults", () => {
  assert.equal(typeof NWE.source, "function");
  assert.equal(typeof NWE.envelope, "function");
  assert.equal(typeof NWE.marks, "function");
  assert.deepEqual([...NWE.SOURCES], ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"]);
  assert.deepEqual([...NWE.WIDTHS], ["edge", "alert"]);
  assert.deepEqual({ ...NWE.DEFAULTS }, { bandwidth: 17, mult: 2.4, source: "low", width: "edge" });
  // it leaves nothing else behind on the global object
  assert.deepEqual(Object.keys(ctx), ["NWEnvelope"]);
});

test("source picks one price or averages several, one value per candle", () => {
  const candles = [
    { time: 1, open: 10, high: 14, low: 8, close: 12 },
    { time: 2, open: 12, high: 13, low: 11, close: 11.5 },
  ];
  const want = {
    open: [10, 12], high: [14, 13], low: [8, 11], close: [12, 11.5],
    hl2: [11, 12], hlc3: [34 / 3, 35.5 / 3], ohlc4: [11, 11.875],
  };
  for (const kind of NWE.SOURCES) assert.deepEqual([...NWE.source(candles, kind)], want[kind], kind);
  assert.equal(NWE.source([], "low").length, 0);
  assert.throws(() => NWE.source(candles, "volume"), { name: "RangeError" });
});

test("a flat series gives a centre on the price and a band of zero width", () => {
  const flat = new Array(700).fill(42.5);
  for (const width of NWE.WIDTHS) {
    const env = NWE.envelope(flat, 17, 2.4, width);
    assert.equal(env.centre.length, 700);
    assert.equal(env.half.length, 700);
    for (let t = 0; t < 700; t++) {
      assert.ok(Math.abs(env.centre[t] - 42.5) < 1e-12, `${width} centre[${t}] = ${env.centre[t]}`);
      assert.ok(Math.abs(env.half[t]) < 1e-12, `${width} half[${t}] = ${env.half[t]}`);
    }
  }
});

test("three bars match the sums worked out by hand", () => {
  // bandwidth 1: bars one apart weigh e^-0.5, bars two apart e^-2
  const x = [1, 2, 4], mult = 2;
  const c1 = Math.exp(-0.5), c2 = Math.exp(-2);
  const centre = [1, (2 + 1 * c1) / (1 + c1), (4 + 2 * c1 + 1 * c2) / (1 + c1 + c2)];

  const alert = NWE.envelope(x, 1, mult, "alert");
  const err = x.map((v, i) => Math.abs(v - centre[i]));
  assertClose(alert.centre, centre, "alert centre");
  assertClose(alert.half, [mult * err[0], mult * (err[0] + err[1]) / 2, mult * (err[0] + err[1] + err[2]) / 3], "alert half");

  const edge = NWE.envelope(x, 1, mult, "edge");
  // window 0..1: each bar is averaged with its one neighbour
  const two = Math.abs(1 - (1 + 2 * c1) / (1 + c1)) + Math.abs(2 - (2 + 1 * c1) / (1 + c1));
  // window 0..2: the middle bar has a neighbour on each side
  const three = Math.abs(1 - (1 + 2 * c1 + 4 * c2) / (1 + c1 + c2))
    + Math.abs(2 - (1 * c1 + 2 + 4 * c1) / (1 + 2 * c1))
    + Math.abs(4 - (1 * c2 + 2 * c1 + 4) / (1 + c1 + c2));
  assertClose(edge.centre, centre, "edge centre");
  assertClose(edge.half, [0, mult * two / 1, mult * three / 2], "edge half");
  assert.ok(edge.half[2] > 0.5, "the band has real width");
});

test("both widths match the definition summed the slow way, past the 500-bar window", () => {
  const x = walk(560, 7);
  for (const [bw, mult] of [[3, 0.5], [17, 2.4], [60, 1], [400, 3]]) {
    for (const width of NWE.WIDTHS) {
      const got = NWE.envelope(x, bw, mult, width);
      const want = slowEnvelope(x, bw, mult, width);
      assertClose(got.centre, want.centre, `bw ${bw} ${width} centre`);
      assertClose(got.half, want.half, `bw ${bw} ${width} half`);
    }
  }
});

test("later bars never change earlier values", () => {
  const x = walk(1300, 99);
  for (const width of NWE.WIDTHS) {
    const full = NWE.envelope(x, 17, 2.4, width);
    for (const len of [1, 2, 37, 499, 500, 501, 1000]) {
      const cut = NWE.envelope(x.slice(0, len), 17, 2.4, width);
      assert.equal(cut.centre.length, len);
      assertClose(cut.centre, Array.from(full.centre).slice(0, len), `${width} centre cut at ${len}`);
      assertClose(cut.half, Array.from(full.half).slice(0, len), `${width} half cut at ${len}`);
    }
    // and the band moves with the price: it is not one repeated value
    assert.ok(new Set(full.centre).size > 1000, width + " centre varies");
    assert.ok(new Set(full.half).size > 1000, width + " half varies");
  }
});

test("the multiplier scales the band and leaves the centre alone", () => {
  const x = walk(300, 3);
  for (const width of NWE.WIDTHS) {
    const one = NWE.envelope(x, 8, 1, width);
    const three = NWE.envelope(x, 8, 3, width);
    assertClose(three.centre, Array.from(one.centre), width + " centre");
    assertClose(three.half, Array.from(one.half, (v) => v * 3), width + " half");
    assert.ok(NWE.envelope(x, 8, 0, width).half.every((v) => v === 0), width + " half at mult 0");
  }
});

test("marks fall on the bar that crosses out of the band, not on the bars that stay out", () => {
  // lower band 3, upper band 5 throughout
  const src = [4, 2, 2, 4, 6, 6, 4, 2];
  const centre = src.map(() => 4), half = src.map(() => 1);
  const m = NWE.marks(src, centre, half);
  assert.deepEqual([...m.up], [1, 7]);
  assert.deepEqual([...m.down], [4]);
  // a bar sitting exactly on a band is still inside it
  const edge = NWE.marks([3, 2, 3, 5, 6, 5], [4, 4, 4, 4, 4, 4], [1, 1, 1, 1, 1, 1]);
  assert.deepEqual([...edge.up], [1]);
  assert.deepEqual([...edge.down], [4]);
  const none = NWE.marks([4, 3, 5, 4], [4, 4, 4, 4], [1, 1, 1, 1]);
  assert.deepEqual([...none.up], []);
  assert.deepEqual([...none.down], []);
});

test("an empty series gives empty results, and bad settings are refused", () => {
  for (const width of NWE.WIDTHS) {
    const env = NWE.envelope([], 17, 2.4, width);
    assert.equal(env.centre.length, 0);
    assert.equal(env.half.length, 0);
  }
  const m = NWE.marks([], [], []);
  assert.equal(m.up.length, 0);
  assert.equal(m.down.length, 0);

  const x = [1, 2, 3];
  const refused = { name: "RangeError" };
  assert.throws(() => NWE.envelope(x, 17, 2.4, "wide"), refused);
  assert.throws(() => NWE.envelope(x, 17, 2.4), refused);
  for (const bw of [0, -1, NaN, Infinity]) assert.throws(() => NWE.envelope(x, bw, 2.4, "edge"), refused, "bandwidth " + bw);
  for (const mult of [-0.1, NaN, Infinity]) assert.throws(() => NWE.envelope(x, 17, mult, "alert"), refused, "mult " + mult);
});
