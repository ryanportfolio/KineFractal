import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("homepage evidence has explicit, non-mixed bases (monthly section)", () => {
  const monthly = read("../components/spy-monthly-record.tsx");

  // Version label is DERIVED from the deploy (SPY_VARIANT), never a frozen
  // literal, so a SPY flip auto-updates the copy (2026-07-14 version-sync tail).
  assert.match(monthly, /SPY \$\{SPY_VARIANT\} Strategy/);
  assert.doesNotMatch(monthly, /SPY v4\.\d Strategy/);
  assert.doesNotMatch(monthly, /Independent years: each starts cash, with no deposits\./);
  assert.doesNotMatch(monthly, /MONTH CELLS = STRATEGY/);
  assert.doesNotMatch(monthly, /DecodeText/);
  assert.match(monthly, /same starting capital and dates/i);
});

test("homepage omits start-year cohorts and numbers six movements consecutively (monthly section)", () => {
  const monthly = read("../components/spy-monthly-record.tsx");

  assert.match(monthly, /aria-hidden="true">03<\/div>/);
});

test("monthly section states the edge basis and the simulation label", () => {
  const monthly = read("../components/spy-monthly-record.tsx");

  // Edge is a percentage-point difference, defined in the footnote, never a percent return.
  assert.match(monthly, /edge = strategy\s+minus buy &amp; hold, in percentage points \(pp\)/);
  assert.match(monthly, /EDGE <span className="font-normal">\(pp\)<\/span>/);
  assert.match(monthly, /strategy edge/);
  // Backtest output is labeled simulated next to the readout and in the footnote.
  assert.equal((monthly.match(/Simulated backtest results, not actual\s+account performance/g) ?? []).length, 2);
  // The selected-year control is a real button exposing its pressed state.
  assert.match(monthly, /<button[\s\S]*?aria-pressed=\{isSelected\}/);
});
