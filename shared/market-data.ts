export const DAILY_BAR_FIELDS = [
  "date",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "adjClose",
] as const;

export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

export type MarketDataState = "fresh" | "cache" | "stale";

export interface MarketDataFreshness {
  state: MarketDataState;
  marketDate: string;
  lastSuccessfulAt: string;
  warning?: string;
}
