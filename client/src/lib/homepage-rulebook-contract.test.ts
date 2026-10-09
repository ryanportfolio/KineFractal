import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("homepage omits start-year cohorts and numbers six movements consecutively (rulebook section)", () => {
  const replay = read("../components/rulebook.tsx");

  assert.match(replay, /aria-hidden="true">05<\/div>/);
});

test("mechanism, replay and record use plain truthful labels (rulebook section)", () => {
  const rulebook = read("../components/rulebook.tsx");
  // the rule copy moved into the cycle wheel; copy invariants cover both files
  const copy = rulebook + read("../components/rulebook-cycle.tsx");

  assert.match(rulebook, /SPY, STEP BY STEP/);
  assert.match(rulebook, /presetVariant\(ep\.preset\)/);
  assert.match(rulebook, /SPY \$\{epVariant \? `\$\{epVariant\} ` : ""\}full-history backtest, viewed during 2020\. Simulated next-open fills\./);
  assert.doesNotMatch(copy, /SPY v4\.\d full-history backtest/);
  assert.doesNotMatch(copy, /actually placed|every real fill|one scary week cannot spend/i);
  assert.doesNotMatch(copy, /never sits idle/i);
  assert.match(copy, /raised cash pools and waits/i);
  assert.match(copy, /cooldown/i);
});

test("rulebook steps are a five-station cycle wheel with a detail panel and a fund switch", () => {
  const rulebook = read("../components/rulebook.tsx");
  const cycle = read("../components/rulebook-cycle.tsx");

  assert.match(rulebook, /<RulebookCycle funds=\{funds\} drawn=\{drawn\} instant=\{instant\} \/>/);

  // five stations, in cycle order, each a real button with its selected state exposed
  const names = [...cycle.matchAll(/\{ n: "(0\d)", name: "([A-Z ]+)"/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(names, ["01 THE GAUGE", "02 THE BUY", "03 THE TRIM", "04 THE EXIT", "05 THE RECYCLE"]);
  assert.match(cycle, /<button[^>]*?data-station=\{s\.n\}[^>]*?aria-pressed=\{on\}[^>]*?aria-controls="rulebook-step-panel"/);
  assert.equal(cycle.match(/data-station=/g)?.length, 1, "one station button per station, not a duplicate phone list");
  assert.match(cycle, /id="rulebook-step-panel"/);
  assert.match(cycle, /\["when", d\.when\], \["then", d\.then\], \["limits", d\.limits\]/);

  // fund switch: SPY / QQQ / IWM buttons with aria-pressed
  assert.match(cycle, /\{ sym: "SPY", nick: "eager" \},\s*\{ sym: "QQQ", nick: "patient" \},\s*\{ sym: "IWM", nick: "cautious" \}/);
  assert.match(cycle, /<button[^>]*?data-fund=\{fd\.sym\}[^>]*?aria-pressed=\{sym === fd\.sym\}/);

  // buy line and order size stay live, never hardcoded per fund
  assert.match(cycle, /ord\(f\.floorPct\)/);
  assert.match(cycle, /f\.maxPct/);
  assert.match(cycle, /f\.minPct/);
});

test("rulebook drops the temperaments block, the old rule boxes and the empty ambient cell", () => {
  const rulebook = read("../components/rulebook.tsx");
  const cycle = read("../components/rulebook-cycle.tsx");

  assert.doesNotMatch(rulebook, /three temperaments/i);
  assert.doesNotMatch(rulebook, /function (contrast|ruleCards|buyRule)\b/);
  assert.doesNotMatch(rulebook, /LazyAmbientWave|ambient-wave/);
  // vocabulary: no retired labels in the new copy
  assert.doesNotMatch(cycle, /fear score|headroom|\barmed\b|threshold|\bfloor\b/i);
  assert.doesNotMatch(cycle, /—/);
});
