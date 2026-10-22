import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { groupTickers } from "../lib/ticker-groups";

const source = await readFile(new URL("./alert-control-panel.tsx", import.meta.url), "utf8");

test("weekly expert settings sit behind a closed Advanced section", () => {
  const advanced = source.indexOf('id="weekly-advanced"');
  assert.ok(advanced > 0, "advanced weekly disclosure must exist");
  for (const id of ["lookback-days", "max-below", "dedup-days", "dedup-tolerance", "gap-placement-label"]) {
    assert.ok(source.indexOf(`"${id}"`, advanced) > advanced, `${id} belongs inside Advanced weekly settings`);
  }
  assert.ok(source.indexOf('id="max-setups"') < advanced, "levels per email stays visible");
  assert.match(source, /const \[open, setOpen\] = useState\(false\)/);
});

test("each settings card shows only while that email is on", () => {
  assert.match(source, /\{weeklyOn && \(\s*<section\s+id="alert-weekly"/);
  assert.match(source, /\{dailyOn && \(\s*<section\s+id="alert-daily"/);
});

test("both email switches sit in the top block, with the weekly mornings pickable there", () => {
  const top = source.indexOf('id="emails-heading"');
  const tickers = source.indexOf('id="alert-tickers"');
  assert.ok(top > 0 && tickers > top);
  const block = source.slice(top, tickers);
  assert.equal((block.match(/<Toggle\s/g) ?? []).length, 2);
  assert.match(block, /onClick=\{\(\) => toggleCloseDay\(morning\.close\)\}/);
  // the last picked morning cannot be removed
  assert.match(source, /if \(closeDays\.length === 1\) return;/);
});

test("reset leaves the picked mornings alone", () => {
  assert.match(source, /filter\(\(\[key\]\) => key !== "closeDays"\)/);
  assert.match(source, /updateWeekly\(WEEKLY_TUNING_DEFAULTS\)/);
});

test("panel text avoids the dim afterglow tone and tiny type", () => {
  assert.doesNotMatch(source, /text-beam-dim/);
  assert.doesNotMatch(source, /text-\[(9|10|11)px\]/);
  assert.doesNotMatch(source, /"etched/);
});

test("ticker groups keep every published ticker and put unknown ones in Other", () => {
  const universe = ["AAPL", "SPY", "GLD", "ZZZZ", "SMH"];
  const groups = groupTickers(universe);
  assert.deepEqual(groups.flatMap((group) => group.symbols).sort(), [...universe].sort());
  assert.deepEqual(groups.at(-1), { id: "other", label: "Other", symbols: ["ZZZZ"] });
  assert.equal(groups.some((group) => group.symbols.length === 0), false);
});
