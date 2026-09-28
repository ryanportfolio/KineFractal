import assert from "node:assert/strict";
import test from "node:test";
import { clampPercent, formatPercent, signalSnapshotLabel } from "./homepage-signal-model";

test("clamps threshold markers to the visible rail", () => {
  assert.equal(clampPercent(-4), 0);
  assert.equal(clampPercent(42.5), 42.5);
  assert.equal(clampPercent(120), 100);
  assert.equal(clampPercent(Number.NaN), 0);
});

test("qualifies stale EOD signal snapshots", () => {
  assert.equal(signalSnapshotLabel("2026-07-10", false, 2), "CURRENT EOD SNAPSHOT · AS OF 2026-07-10");
  assert.equal(signalSnapshotLabel("2026-07-10", true, 50.4), "STALE SIGNAL SNAPSHOT · AS OF 2026-07-10 · UPDATED 50 HOURS AGO");
  assert.equal(signalSnapshotLabel("2026-07-10", true, null), "STALE SIGNAL SNAPSHOT · AS OF 2026-07-10 · AGE UNKNOWN");
});

test("preserves tiny account moves instead of rounding them to zero", () => {
  assert.equal(formatPercent(0.03, 2), "+0.03%");
  assert.equal(formatPercent(-0.03, 2), "-0.03%");
  assert.equal(formatPercent(null, 2), "n/a");
});
