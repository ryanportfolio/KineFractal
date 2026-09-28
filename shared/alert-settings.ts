import { z } from "zod";

export const ALERT_KINDS = ["levels_weekly", "gap_daily"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const LEVELS_WEEKLY_DEFAULTS = {
  minTfs: 2,
  lookbackDays: 90,
  maxBelowPct: 25,
  maxSetups: 0,
  confluenceEnabled: true,
  confluencePct: 5,
  triplePct: 3,
  dedupDays: 30,
  dedupPct: 0.5,
} as const;

export const GAP_DAILY_DEFAULTS = {
  eventTypes: {
    gaps: true,
    orderBlocks: true,
    equilibrium: true,
  },
  gapDirections: {
    support: true,
    resistance: true,
  },
  minGapStage: "approaching",
} as const;

export type LevelsWeeklySettings = {
  minTfs: number;
  lookbackDays: number;
  maxBelowPct: number;
  maxSetups: number;
  confluenceEnabled: boolean;
  confluencePct: number;
  triplePct: number;
  dedupDays: number;
  dedupPct: number;
};

export type GapDailySettings = {
  eventTypes: {
    gaps: boolean;
    orderBlocks: boolean;
    equilibrium: boolean;
  };
  gapDirections: {
    support: boolean;
    resistance: boolean;
  };
  minGapStage: "approaching" | "tagged" | "about" | "filled";
};

export type AlertSettingsByKind = {
  levels_weekly: LevelsWeeklySettings;
  gap_daily: GapDailySettings;
};

const levelsPatchSchema = z
  .object({
    minTfs: z.number().int().min(1).max(3),
    lookbackDays: z.number().int().min(1).max(3650),
    maxBelowPct: z.number().min(0).max(100),
    maxSetups: z.number().int().min(0).max(1000),
    confluenceEnabled: z.boolean(),
    confluencePct: z.number().min(0.1).max(50),
    triplePct: z.number().min(0.1).max(50),
    dedupDays: z.number().int().min(0).max(3650),
    dedupPct: z.number().min(0).max(10),
  })
  .strict()
  .partial();

const eventTypesPatchSchema = z
  .object({
    gaps: z.boolean(),
    orderBlocks: z.boolean(),
    equilibrium: z.boolean(),
  })
  .strict()
  .partial();

const gapDirectionsPatchSchema = z
  .object({
    support: z.boolean(),
    resistance: z.boolean(),
  })
  .strict()
  .partial();

const dailyPatchSchema = z
  .object({
    eventTypes: eventTypesPatchSchema,
    gapDirections: gapDirectionsPatchSchema,
    minGapStage: z.enum(["approaching", "tagged", "about", "filled"]),
  })
  .strict()
  .partial();

function assertKind(kind: string): asserts kind is AlertKind {
  if (!ALERT_KINDS.includes(kind as AlertKind)) {
    throw new Error(`unknown alert kind: ${kind}`);
  }
}

function parsePatch(kind: AlertKind, raw: unknown): Record<string, unknown> {
  const schema = kind === "levels_weekly" ? levelsPatchSchema : dailyPatchSchema;
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new Error(`invalid alert settings: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return parsed.data;
}

export function parseAlertSettings<K extends AlertKind>(
  kind: K,
  raw: unknown,
): AlertSettingsByKind[K] {
  assertKind(kind);
  const patch = parsePatch(kind, raw);
  if (kind === "levels_weekly") {
    return { ...LEVELS_WEEKLY_DEFAULTS, ...patch } as AlertSettingsByKind[K];
  }
  const daily = patch as Partial<GapDailySettings>;
  return {
    ...GAP_DAILY_DEFAULTS,
    ...daily,
    eventTypes: { ...GAP_DAILY_DEFAULTS.eventTypes, ...(daily.eventTypes ?? {}) },
    gapDirections: { ...GAP_DAILY_DEFAULTS.gapDirections, ...(daily.gapDirections ?? {}) },
  } as AlertSettingsByKind[K];
}

export function normalizeAlertSettings<K extends AlertKind>(
  kind: K,
  raw: unknown,
): AlertSettingsByKind[K] {
  assertKind(kind);
  try {
    return parseAlertSettings(kind, raw);
  } catch {
    return (kind === "levels_weekly"
      ? { ...LEVELS_WEEKLY_DEFAULTS }
      : {
          ...GAP_DAILY_DEFAULTS,
          eventTypes: { ...GAP_DAILY_DEFAULTS.eventTypes },
          gapDirections: { ...GAP_DAILY_DEFAULTS.gapDirections },
        }) as AlertSettingsByKind[K];
  }
}
