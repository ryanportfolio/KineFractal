import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fetchBoardLive } from "../data/lab-data";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("homepage evidence has explicit, non-mixed bases (verdict section)", () => {
  const verdict = read("../components/verdict-channels.tsx");

  assert.match(verdict, /yearlyBasis\s*!==\s*["']flat["']/);
  assert.match(verdict, /starts? (?:the year )?(?:all )?cash/i);
  assert.match(verdict, /no deposits/i);
  assert.doesNotMatch(verdict, /d\.full\.(?:ret|bench_ret|dd|trades)/);
});

test("homepage omits start-year cohorts and numbers six movements consecutively (home and verdict section)", () => {
  const home = read("../pages/home.tsx");
  const verdict = read("../components/verdict-channels.tsx");

  assert.doesNotMatch(home, /LadderWaterfall|startCohorts/);
  assert.match(verdict, /aria-hidden="true">02<\/div>/);
});

test("terminal provenance distinguishes signals from backtests", () => {
  const terminal = read("../components/command-line.tsx");
  assert.doesNotMatch(terminal, /every number on this site comes from the EOD board/i);
  assert.match(terminal, /numbers come from labeled EOD signal and backtest artifacts/i);
});

test("homepage metadata describes signals and labeled backtests", () => {
  const index = read("../../index.html");
  assert.doesNotMatch(index, /Every trade shown/i);
  assert.equal((index.match(/EOD signals and labeled backtests for SPY, QQQ and IWM\./g) ?? []).length, 3);
  assert.match(index, /buys fear in SPY, QQQ and IWM and trims into strength/i);
});

const validBoard = {
  generated: "2026-07-12T00:00:00Z",
  aux: [],
  combos: [],
  startCohorts: {
    basis: "cohort_flat",
    symbol: "SPY",
    tf: "1d",
    preset: "fav-spy-v4.6-1d",
    rows: [{
      year: 1993,
      start: "1993-01-29",
      end: "2026-07-10",
      strategy_pct: 100,
      benchmark_pct: 80,
      edge_pp: 20,
    }],
  },
};

test("an old live board falls back to a cohort-normalized static board", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return { ok: true, json: async () => calls === 1 ? { combos: [] } : validBoard } as Response;
  }) as typeof fetch;
  try {
    const result = await fetchBoardLive();
    assert.equal(calls, 2);
    assert.equal(result.meta.live, false);
    assert.equal(result.data.startCohorts.basis, "cohort_flat");
  } finally {
    globalThis.fetch = previous;
  }
});

test("old live and static boards fail closed instead of using the legacy ladder", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ combos: [] }) } as Response)) as typeof fetch;
  try {
    await assert.rejects(fetchBoardLive(), /no board/);
  } finally {
    globalThis.fetch = previous;
  }
});
