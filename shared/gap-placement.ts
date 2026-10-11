// Where a support gap's suggested buy limit sits. One choice per account,
// stored in chart_preferences.gap_limit_placement and read by the /charts
// Limit Buy dialog (server/charts-app/charts.html keeps its own copy of the
// rule, since that page is not bundled) and by the engine's weekly email
// (range worker/alerts.py). A missing or unknown value means "top".
//   top    the gap's upper edge, the first price a drop reaches
//   middle halfway between the edges
//   fill   the lower edge, where the gap is fully filled
export const GAP_PLACEMENTS = ["top", "middle", "fill"] as const;
export type GapPlacement = (typeof GAP_PLACEMENTS)[number];
export const DEFAULT_GAP_PLACEMENT: GapPlacement = "top";

export function isGapPlacement(value: unknown): value is GapPlacement {
  return typeof value === "string" && (GAP_PLACEMENTS as readonly string[]).includes(value);
}

export function normalizeGapPlacement(value: unknown): GapPlacement {
  return isGapPlacement(value) ? value : DEFAULT_GAP_PLACEMENT;
}
