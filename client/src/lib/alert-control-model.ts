import {
  GAP_DAILY_DEFAULTS,
  LEVELS_WEEKLY_DEFAULTS,
  normalizeAlertSettings,
  type AlertKind,
  type GapDailySettings,
  type LevelsWeeklySettings,
} from "@shared/alert-settings";

export type AlertPrefsState = {
  levels_weekly: { enabled: boolean; settings: LevelsWeeklySettings };
  gap_daily: { enabled: boolean; settings: GapDailySettings };
};

export function createDefaultAlertPrefs(): AlertPrefsState {
  return {
    levels_weekly: {
      enabled: true,
      settings: { ...LEVELS_WEEKLY_DEFAULTS },
    },
    gap_daily: {
      enabled: true,
      settings: {
        ...GAP_DAILY_DEFAULTS,
        eventTypes: { ...GAP_DAILY_DEFAULTS.eventTypes },
        gapDirections: { ...GAP_DAILY_DEFAULTS.gapDirections },
      },
    },
  };
}

export function normalizeAlertPrefsResponse(raw: unknown): AlertPrefsState {
  const defaults = createDefaultAlertPrefs();
  if (!raw || typeof raw !== "object") return defaults;
  const source = raw as Record<string, unknown>;

  for (const kind of ["levels_weekly", "gap_daily"] as const) {
    const value = source[kind];
    if (typeof value === "boolean") {
      defaults[kind].enabled = value;
      continue;
    }
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const enabled = typeof record.enabled === "boolean" ? record.enabled : defaults[kind].enabled;
    if (kind === "levels_weekly") {
      defaults.levels_weekly = {
        enabled,
        settings: normalizeAlertSettings("levels_weekly", record.settings),
      };
    } else {
      defaults.gap_daily = {
        enabled,
        settings: normalizeAlertSettings("gap_daily", record.settings),
      };
    }
  }
  return defaults;
}

export function setAlertEnabled(
  prefs: AlertPrefsState,
  kind: AlertKind,
  enabled: boolean,
  canEnable: boolean,
): AlertPrefsState {
  if (enabled && !canEnable) return prefs;
  return {
    ...prefs,
    [kind]: { ...prefs[kind], enabled },
  };
}
