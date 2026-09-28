export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function signalSnapshotLabel(
  tradingDate: string,
  stale: boolean,
  ageHours: number | null,
): string {
  if (!stale) return `CURRENT EOD SNAPSHOT · AS OF ${tradingDate}`;
  const age = ageHours == null || !Number.isFinite(ageHours)
    ? "AGE UNKNOWN"
    : `UPDATED ${Math.max(0, Math.round(ageHours))} HOURS AGO`;
  return `STALE SIGNAL SNAPSHOT · AS OF ${tradingDate} · ${age}`;
}
