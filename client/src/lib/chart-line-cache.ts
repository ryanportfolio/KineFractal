// The /charts/ page caches drawn lines per chart in localStorage under this
// prefix (LS_HAND in server/charts-app/charts.html). The cache is not scoped to
// an account, so it is cleared whenever the signed-in account changes; the
// account's own copy stays on the server.
export const CHART_LINE_CACHE_PREFIX = "fearlab_hand_";

/** Remove every cached drawn-line entry from `storage`. */
export function clearChartLineCache(storage: Storage | undefined = globalThis.localStorage): void {
  if (!storage) return;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key && key.startsWith(CHART_LINE_CACHE_PREFIX)) storage.removeItem(key);
    }
  } catch {
    // storage unavailable (privacy mode): nothing cached to clear
  }
}
