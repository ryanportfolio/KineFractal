import type { DailyBar } from "@shared/market-data";

export class MarketMatrixUnavailableError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Market data unavailable for: ${missing.join(", ")}`);
    this.name = "MarketMatrixUnavailableError";
    this.missing = [...missing];
  }
}

export function requireCompleteMarketMatrix(
  tickers: readonly string[],
  data: ReadonlyMap<string, DailyBar[]>,
): void {
  const missing = tickers.filter((ticker) => {
    const bars = data.get(ticker);
    return !bars || bars.length === 0;
  });

  if (missing.length > 0) {
    throw new MarketMatrixUnavailableError(missing);
  }
}

export function requireCommonMarketHistory(
  tickers: readonly string[],
  data: ReadonlyMap<string, DailyBar[]>,
  minimumDays: number,
): string[] {
  requireCompleteMarketMatrix(tickers, data);

  const [firstTicker, ...remainingTickers] = tickers;
  const commonDates = new Set(data.get(firstTicker!)!.map((bar) => bar.date));
  for (const ticker of remainingTickers) {
    const dates = new Set(data.get(ticker)!.map((bar) => bar.date));
    for (const date of commonDates) {
      if (!dates.has(date)) commonDates.delete(date);
    }
  }

  const sortedDates = [...commonDates].sort();
  if (sortedDates.length < minimumDays) {
    throw new MarketMatrixUnavailableError([...tickers]);
  }
  return sortedDates;
}
