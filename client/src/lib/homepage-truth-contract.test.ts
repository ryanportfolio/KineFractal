import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fetchBoardLive } from "../data/lab-data";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("homepage evidence has explicit, non-mixed bases", () => {
  const verdict = read("../components/verdict-channels.tsx");
  const monthly = read("../components/spy-monthly-record.tsx");

  assert.match(verdict, /yearlyBasis\s*!==\s*["']flat["']/);
  assert.match(verdict, /starts? (?:the year )?(?:all )?cash/i);
  assert.match(verdict, /no deposits/i);
  assert.doesNotMatch(verdict, /d\.full\.(?:ret|bench_ret|dd|trades)/);

  // Version label is DERIVED from the deploy (SPY_VARIANT), never a frozen
  // literal, so a SPY flip auto-updates the copy (2026-07-14 version-sync tail).
  assert.match(monthly, /SPY \$\{SPY_VARIANT\} Strategy/);
  assert.doesNotMatch(monthly, /SPY v4\.\d Strategy/);
  assert.doesNotMatch(monthly, /Independent years: each starts cash, with no deposits\./);
  assert.doesNotMatch(monthly, /MONTH CELLS = STRATEGY/);
  assert.doesNotMatch(monthly, /DecodeText/);
  assert.match(monthly, /same starting capital and dates/i);
});

test("homepage omits start-year cohorts and numbers six movements consecutively", () => {
  const home = read("../pages/home.tsx");
  const verdict = read("../components/verdict-channels.tsx");
  const monthly = read("../components/spy-monthly-record.tsx");
  const mechanism = read("../components/arming-gauges.tsx");
  const replay = read("../components/rulebook.tsx");
  const record = read("../components/ledger-section.tsx");

  assert.doesNotMatch(home, /LadderWaterfall|startCohorts/);
  assert.match(verdict, /aria-hidden="true">02<\/div>/);
  assert.match(monthly, /aria-hidden="true">03<\/div>/);
  assert.match(mechanism, /aria-hidden="true">04<\/div>/);
  assert.match(replay, /aria-hidden="true">05<\/div>/);
  assert.match(record, /aria-hidden="true">06<\/div>/);
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

test("mechanism, replay and record use plain truthful labels", () => {
  const mechanism = read("../components/arming-gauges.tsx");
  const rulebook = read("../components/rulebook.tsx");
  const ledger = read("../components/ledger-section.tsx");

  assert.match(mechanism, /HOW IT BUYS/);
  assert.match(mechanism, /HOW IT SELLS/);
  assert.match(mechanism, /text-beam-dim">minimum<\/dt>/i);
  assert.doesNotMatch(mechanism, /base order/i);
  assert.match(mechanism, /fund\.minPct\s*===\s*0\s*\?\s*["']none["']/);
  assert.doesNotMatch(mechanism, /sizing starts at 0%/i);
  assert.match(mechanism, /Crossing the line enables sizing\. A meaningful order appears only as fear approaches the extreme, up to 55%\./);
  assert.match(mechanism, /Crossing the line enables sizing\. Order size then rises gradually with fear, up to 30%\./);
  assert.match(mechanism, /cooldown.*protection.*regime.*cash/is);
  assert.doesNotMatch(mechanism, /\barmed\b|\bheadroom\b|\bfloor\b/i);
  assert.match(mechanism, /data-testid="buy-line-marker"/);
  assert.match(mechanism, /data-testid="fear-now-marker"/);
  assert.match(mechanism, /sr-only[^>]*>[^<]*buy line/is);

  assert.match(rulebook, /SPY, STEP BY STEP/);
  assert.match(rulebook, /presetVariant\(ep\.preset\)/);
  assert.match(rulebook, /SPY \$\{epVariant \? `\$\{epVariant\} ` : ""\}full-history backtest, viewed during 2020\. Simulated next-open fills\./);
  assert.doesNotMatch(rulebook, /SPY v4\.\d full-history backtest/);
  assert.doesNotMatch(rulebook, /actually placed|every real fill|one scary week cannot spend/i);
  assert.doesNotMatch(rulebook, /never sits idle/i);
  assert.match(rulebook, /raised cash pools and waits/i);
  assert.match(rulebook, /cooldown/i);

  assert.match(ledger, /LATEST EOD DECISION/);
  assert.match(ledger, /RECENT SIMULATED ACTIVITY/);
  assert.match(ledger, /BACKTEST · SPY DAILY · \{SPY\.variant\.toUpperCase\(\)\} · SIMULATED NEXT-OPEN FILLS/);
  assert.doesNotMatch(ledger, /V4\.\d · SIMULATED NEXT-OPEN FILLS/);
  assert.doesNotMatch(ledger, /fmtUsd|r\.usd|exposure_end|open_lots/);
  assert.match(ledger, /account_pct/);
  assert.match(ledger, /lot_return_pct/);
  assert.match(ledger, /formatPercent\(row\.account_pct, 2\)/);
  assert.match(ledger, /overflow-x-auto/);
  assert.match(ledger, /min-w-/);
  assert.match(ledger, /<Link[\s\S]*BACKTEST · SPY DAILY · \{SPY\.variant\.toUpperCase\(\)\} · SIMULATED NEXT-OPEN FILLS[\s\S]*<\/Link>/);
  assert.match(ledger, /stale.*age_hours|age_hours.*stale/is);
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
