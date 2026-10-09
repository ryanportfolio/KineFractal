import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHomepageMonthlyRows,
  defaultSelectedYear,
  roundTenth,
  yearBarDomain,
  yearEdge,
} from "./spy-monthly-record-model";

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

test("edge is strategy year minus buy & hold year in pp, from the printed one-decimal values", () => {
  const rows = buildHomepageMonthlyRows({
    monthly: [],
    yearly: [
      yearly(2015, 14.93, -1.22),
      yearly(2022, 5.2, -19.71),
      yearly(2013, 19.88, 27.28),
      yearly(2026, 23.05, 12.49, true),
    ],
  });
  const byYear = new Map(rows.map((row) => [row.year, row]));

  // 14.9 - (-1.2) = 16.1, matching the printed cells
  assert.equal(byYear.get(2015)?.edge, 16.1);
  assert.equal(byYear.get(2022)?.edge, 24.9);
  assert.equal(byYear.get(2013)?.edge, -7.4);
  // partial years still get an edge over the same dates; the row stays flagged partial
  assert.equal(byYear.get(2026)?.edge, 10.6); // prints +23.1 vs +12.5
  assert.equal(byYear.get(2026)?.partial, true);
  assert.equal(yearEdge(-5.44, -6.69), 1.3); // -5.4 vs -6.7
  assert.equal(roundTenth(0.05), 0.1);
});

test("default selected year is the most recent completed year, never the partial year", () => {
  const rows = buildHomepageMonthlyRows({
    monthly: [],
    yearly: [yearly(2024, 1, 1), yearly(2026, 3, 2, true), yearly(2025, 2, 1)],
  });
  assert.equal(defaultSelectedYear(rows), 2025);

  const onlyPartial = buildHomepageMonthlyRows({
    monthly: [],
    yearly: [yearly(2026, 3, 2, true)],
  });
  assert.equal(defaultSelectedYear(onlyPartial), 2026);
  assert.equal(defaultSelectedYear([]), null);
});

test("year bars share one zero axis covering every strategy and buy & hold value", () => {
  const rows = buildHomepageMonthlyRows({
    monthly: [],
    yearly: [yearly(2020, 45.07, 15.56), yearly(2022, 5.2, -19.71), yearly(2018, -5.44, -6.69)],
  });
  const domain = yearBarDomain(rows);

  assert.ok(domain.min <= -19.71 && domain.max >= 45.07);
  assert.ok(domain.ticks.includes(0));
  assert.equal(domain.ticks[0], domain.min);
  assert.equal(domain.ticks.at(-1), domain.max);
  assert.deepEqual(domain.ticks, [-20, 0, 20, 40, 60]);

  const allGains = yearBarDomain(
    buildHomepageMonthlyRows({ monthly: [], yearly: [yearly(2021, 12, 8)] }),
  );
  assert.equal(allGains.min, 0);
  assert.ok(allGains.max >= 12);

  const flat = yearBarDomain(
    buildHomepageMonthlyRows({ monthly: [], yearly: [yearly(2021, 0, 0)] }),
  );
  assert.ok(flat.max > flat.min);
});
