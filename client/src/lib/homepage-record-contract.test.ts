import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
// the record section plus the fill timeline it renders
const recordSource = () => read("../components/ledger-section.tsx") + "\n" + read("../components/ledger-timeline.tsx");

test("homepage omits start-year cohorts and numbers six movements consecutively (record section)", () => {
  const record = read("../components/ledger-section.tsx");

  assert.match(record, /aria-hidden="true">06<\/div>/);
});

test("mechanism, replay and record use plain truthful labels (record section)", () => {
  const ledger = read("../components/ledger-section.tsx");

  assert.match(ledger, /LATEST EOD DECISION/);
  assert.match(ledger, /RECENT SIMULATED ACTIVITY/);
  assert.match(ledger, /BACKTEST · SPY DAILY · \{SPY\.variant\.toUpperCase\(\)\} · SIMULATED NEXT-OPEN FILLS/);
  assert.doesNotMatch(ledger, /V4\.\d · SIMULATED NEXT-OPEN FILLS/);
  assert.match(ledger, /account_pct/);
  assert.match(ledger, /lot_return_pct/);
  assert.match(ledger, /formatPercent\(row\.account_pct, 2\)/);
  assert.match(ledger, /overflow-x-auto/);
  assert.match(ledger, /min-w-/);
  assert.match(ledger, /<Link[\s\S]*BACKTEST · SPY DAILY · \{SPY\.variant\.toUpperCase\(\)\} · SIMULATED NEXT-OPEN FILLS[\s\S]*<\/Link>/);
  assert.match(ledger, /stale.*age_hours|age_hours.*stale/is);
});

test("record keeps account dollars out of the section and its timeline", () => {
  const record = recordSource();

  assert.doesNotMatch(record, /fmtUsd|r\.usd|row\.usd|\.usd\b|exposure_end|open_lots/);
  assert.match(read("../components/ledger-timeline.tsx"), /account_pct/);
  assert.doesNotMatch(read("../components/ledger-timeline.tsx"), /V4\.\d|v4\.\d/);
});

test("record labels the fills simulated and explains account %", () => {
  const ledger = read("../components/ledger-section.tsx");

  assert.match(ledger, />simulated<\/span>/);
  assert.match(ledger, /Account % = simulated order size as a percent of the simulated account, not a return\./);
  assert.match(ledger, /ETF quote/);
});
