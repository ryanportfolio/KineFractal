export const ACQUISITION_FIRST_MS = 1100;
export const ACQUISITION_RETURN_MS = 650;

export function acquisitionDuration(returning: boolean): number {
  return returning ? ACQUISITION_RETURN_MS : ACQUISITION_FIRST_MS;
}

export function acquisitionProgress(elapsedMs: number, durationMs: number): number {
  const x = Math.max(0, Math.min(1, elapsedMs / Math.max(1, durationMs)));
  return x * x * (3 - 2 * x);
}
