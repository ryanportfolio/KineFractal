import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// The envelope math exists twice: in Python in the engine repo (ryanportfolio/range) and in
// JavaScript here (server/charts-app/nwe-envelope.js). Both are checked against one file of
// expected numbers, written by the Python version: 1,200 SPY daily candles and, for nine
// settings, the centre line, the half-width of the band and the bars that get a mark.
// scripts/fixtures/nwe_expected.v1.json is a byte-for-byte copy of the engine repo's
// fearlab/vnext/fixtures/nwe_expected.v1.json. When that file changes there, copy it again
// (cp, not a re-save) and update the hash below.
const FIXTURE_SHA256 = "45139edd0bbf51a1387bfcc9825576fa97297178f06c21939fc8488fdf86d49b";

const bytes = await readFile(new URL("./fixtures/nwe_expected.v1.json", import.meta.url));
const fixture = JSON.parse(bytes.toString("utf8"));

// the module is a plain script for a <script src> tag: run it in an empty context and read
// the one global it sets
const code = await readFile(new URL("../server/charts-app/nwe-envelope.js", import.meta.url), "utf8");
const ctx = vm.createContext({});
vm.runInContext(code, ctx);
const NWE = ctx.NWEnvelope;

const cols = fixture.candles;
const candles = cols.time.map((time, i) => ({
  time, open: cols.open[i], high: cols.high[i], low: cols.low[i], close: cols.close[i],
}));

function assertClose(got, want, label) {
  assert.equal(got.length, want.length, label + " length");
  for (let i = 0; i < want.length; i++) {
    const lim = 1e-9 * Math.max(1, Math.abs(want[i]));
    assert.ok(Math.abs(got[i] - want[i]) <= lim, `${label}[${i}]: got ${got[i]}, want ${want[i]}`);
  }
}

test("the expected-numbers file is the engine repo's file, byte for byte", async () => {
  assert.equal(createHash("sha256").update(bytes).digest("hex"), FIXTURE_SHA256);
  assert.equal(fixture.schema, "nwe_expected.v1");
  // git must never convert its line endings, or a Windows checkout would change the bytes
  const attrs = await readFile(new URL("../.gitattributes", import.meta.url), "utf8");
  assert.match(attrs, /^scripts\/fixtures\/nwe_expected\.v1\.json -text\r?$/m);
});

test("the file holds real candles and bands that move with the price", () => {
  assert.equal(candles.length, 1200);
  for (const c of candles) {
    for (const k of ["time", "open", "high", "low", "close"]) assert.ok(Number.isFinite(c[k]), k);
    assert.ok(c.low <= c.open && c.low <= c.close && c.high >= c.open && c.high >= c.close, "low and high bound the bar");
  }
  assert.equal(fixture.cases.length, 9);
  // every width and every price source the math offers is covered
  assert.deepEqual([...new Set(fixture.cases.map((c) => c.width))].sort(), [...NWE.WIDTHS].sort());
  assert.deepEqual([...new Set(fixture.cases.map((c) => c.source))].sort(), [...NWE.SOURCES].sort());
  for (const c of fixture.cases) {
    const label = `${c.source} ${c.bandwidth} ${c.mult} ${c.width}`;
    assert.equal(c.centre.length, candles.length, label + " centre length");
    assert.equal(c.half.length, candles.length, label + " half length");
    // a result that repeated one number, or held no marks, would compare nothing
    assert.ok(new Set(c.centre).size > 1000, label + " centre varies");
    assert.ok(new Set(c.half).size > 1000, label + " half varies");
    assert.ok(c.half.every((v) => v >= 0) && c.half.some((v) => v > 0.5), label + " band has width");
    assert.ok(c.up.length > 0 && c.down.length > 0, label + " has marks on both sides");
  }
});

test("NWEnvelope reproduces every case in the file", () => {
  for (const c of fixture.cases) {
    const label = `${c.source} ${c.bandwidth} ${c.mult} ${c.width}`;
    const src = NWE.source(candles, c.source);
    const env = NWE.envelope(src, c.bandwidth, c.mult, c.width);
    assertClose(env.centre, c.centre, label + " centre");
    assertClose(env.half, c.half, label + " half");
    const marks = NWE.marks(src, env.centre, env.half);
    assert.deepEqual([...marks.up], c.up, label + " up marks");
    assert.deepEqual([...marks.down], c.down, label + " down marks");
  }
});
