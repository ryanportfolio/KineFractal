import assert from "node:assert/strict";
import test from "node:test";

import {
  GAP_DAILY_DEFAULTS,
  LEVELS_WEEKLY_DEFAULTS,
  normalizeAlertSettings,
  parseAlertSettings,
} from "./alert-settings";

test("normalizes empty weekly settings to compatibility defaults", () => {
  assert.deepEqual(normalizeAlertSettings("levels_weekly", {}), LEVELS_WEEKLY_DEFAULTS);
});

test("normalizes empty daily settings to compatibility defaults", () => {
  assert.deepEqual(normalizeAlertSettings("gap_daily", {}), GAP_DAILY_DEFAULTS);
});

test("merges a valid partial weekly profile over defaults", () => {
  assert.deepEqual(normalizeAlertSettings("levels_weekly", { minTfs: 3, maxSetups: 4 }), {
    ...LEVELS_WEEKLY_DEFAULTS,
    minTfs: 3,
    maxSetups: 4,
  });
});

test("merges a valid partial daily profile over defaults", () => {
  assert.deepEqual(
    normalizeAlertSettings("gap_daily", {
      eventTypes: { gaps: false },
      gapDirections: { resistance: false },
      minGapStage: "filled",
    }),
    {
      ...GAP_DAILY_DEFAULTS,
      eventTypes: { ...GAP_DAILY_DEFAULTS.eventTypes, gaps: false },
      gapDirections: { ...GAP_DAILY_DEFAULTS.gapDirections, resistance: false },
      minGapStage: "filled",
    },
  );
});

test("rejects out-of-range numeric settings", () => {
  assert.throws(
    () => parseAlertSettings("levels_weekly", { minTfs: 4 }),
    /invalid alert settings/i,
  );
  assert.throws(
    () => parseAlertSettings("levels_weekly", { confluencePct: 0 }),
    /invalid alert settings/i,
  );
});

test("rejects unknown settings instead of silently storing them", () => {
  assert.throws(
    () => parseAlertSettings("gap_daily", { eventTypes: { gaps: true, tweets: true } }),
    /invalid alert settings/i,
  );
  assert.throws(
    () => parseAlertSettings("levels_weekly", { secretThreshold: 12 }),
    /invalid alert settings/i,
  );
});

test("rejects an unknown alert kind", () => {
  assert.throws(
    () => normalizeAlertSettings("unknown" as never, {}),
    /unknown alert kind/i,
  );
});
