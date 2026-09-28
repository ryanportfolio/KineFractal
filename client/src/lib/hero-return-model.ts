/** Convert two cumulative percentage-return points into one interval return.
 *  A cumulative percentage is not a price: rebuild each point's wealth index
 *  before taking the ratio. Invalid/non-positive wealth has no valid return. */
export function intervalReturnFromCumulativePct(
  previousPct: number,
  currentPct: number,
): number | null {
  if (!Number.isFinite(previousPct) || !Number.isFinite(currentPct)) return null;
  const previousWealth = 1 + previousPct / 100;
  const currentWealth = 1 + currentPct / 100;
  if (previousWealth <= 0 || currentWealth <= 0) return null;
  const value = currentWealth / previousWealth - 1;
  return Number.isFinite(value) ? value : null;
}
