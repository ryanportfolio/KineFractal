import assert from "node:assert/strict";
import test from "node:test";

import { GAP_DAILY_DEFAULTS, LEVELS_WEEKLY_DEFAULTS } from "@shared/alert-settings";
import {
  createDefaultAlertPrefs,
  normalizeAlertPrefsResponse,
  setAlertEnabled,
} from "./alert-control-model";

test("creates enabled preferences with full settings defaults", () => {
  assert.deepEqual(createDefaultAlertPrefs(), {
    levels_weekly: { enabled: true, settings: LEVELS_WEEKLY_DEFAULTS },
    gap_daily: { enabled: true, settings: GAP_DAILY_DEFAULTS },
  });
});

test("normalizes API preferences and tolerates legacy booleans", () => {
  const prefs = normalizeAlertPrefsResponse({
    levels_weekly: { enabled: true, settings: { minTfs: 3 } },
    gap_daily: true,
  });
  assert.equal(prefs.levels_weekly.enabled, true);
  assert.equal(prefs.levels_weekly.settings.minTfs, 3);
  assert.deepEqual(prefs.gap_daily, { enabled: true, settings: GAP_DAILY_DEFAULTS });
});

test("blocks a new enable when prerequisites are missing", () => {
  const prefs = normalizeAlertPrefsResponse({ gap_daily: false });
  assert.deepEqual(setAlertEnabled(prefs, "gap_daily", true, false), prefs);
});

test("keeps explicit opt-outs while defaulting missing enabled fields on", () => {
  const prefs = normalizeAlertPrefsResponse({
    levels_weekly: { enabled: false, settings: {} },
    gap_daily: { settings: {} },
  });
  assert.equal(prefs.levels_weekly.enabled, false);
  assert.equal(prefs.gap_daily.enabled, true);
});

test("always allows disabling", () => {
  const prefs = normalizeAlertPrefsResponse({ gap_daily: true });
  assert.equal(setAlertEnabled(prefs, "gap_daily", false, false).gap_daily.enabled, false);
});
