import assert from "node:assert/strict";
import test from "node:test";
import { buildHomepageMonthlyRows } from "./spy-monthly-record-model";

const yearly = (y: number, spct: number, bpct: number, partial = false) => ({
  y,
  spct,
  bpct,
  partial,
  spnl: 0,
  edge: spct - bpct,
  contrib: 0,
});

test("builds newest-first homepage rows from 2013 onward", () => {
  const rows = buildHomepageMonthlyRows({
    monthly: [
      { y: 2012, m: 1, s: 9.9, b: 8.8 },
      { y: 2013, m: 1, s: -0.2, b: 0.2 },
      { y: 2025, m: 1, s: 0.9, b: 0.4 },
      { y: 2026, m: 1, s: 1.8, b: 1.1 },
      { y: 2026, m: 7, s: 1.1, b: 0.7 },
    ],
    yearly: [
      yearly(2012, 4.3, 14.4),
      yearly(2013, 29.5, 31.8),
      yearly(2025, 22, 15.7),
      yearly(2026, 22.2, 10.1, true),
    ],
  });

  assert.deepEqual(rows.map((row) => row.year), [2026, 2025, 2013]);
  assert.equal(rows[0].months[0], 1.8);
  assert.equal(rows[0].months[6], 1.1);
  assert.equal(rows[0].months[7], null);
  assert.equal(rows[0].strategyYear, 22.2);
  assert.equal(rows[0].buyHoldYear, 10.1);
  assert.equal(rows[0].partial, true);
});

test("keeps missing months blank instead of inventing zero returns", () => {
  const [row] = buildHomepageMonthlyRows({
    monthly: [{ y: 2013, m: 2, s: 0, b: 0.3 }],
    yearly: [yearly(2013, 0, 0.3)],
  });

  assert.equal(row.months[0], null);
  assert.equal(row.months[1], 0);
  assert.equal(row.months[2], null);
});
