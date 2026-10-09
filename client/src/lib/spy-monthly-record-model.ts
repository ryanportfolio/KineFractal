import type { LabReport } from "@/data/lab-data";

export const HOMEPAGE_MONTH_START_YEAR = 2013;

export type HomepageMonthlyRow = {
  year: number;
  months: Array<number | null>;
  strategyYear: number;
  buyHoldYear: number;
  /** Strategy year minus buy & hold year, in percentage points, computed
   *  from the one-decimal values the table prints so the column adds up. */
  edge: number;
  partial: boolean;
};

export type YearBarDomain = { min: number; max: number; ticks: number[] };

/** Round to the one decimal the table prints (same rounding as toFixed(1)). */
export function roundTenth(value: number): number {
  return Number(value.toFixed(1));
}

export function yearEdge(strategyYear: number, buyHoldYear: number): number {
  return roundTenth(roundTenth(strategyYear) - roundTenth(buyHoldYear));
}

export function buildHomepageMonthlyRows(
  report: Pick<LabReport, "monthly" | "yearly">,
): HomepageMonthlyRow[] {
  const months = new Map<string, number>();
  for (const row of report.monthly) months.set(`${row.y}-${row.m}`, row.s);

  return report.yearly
    .filter((row) => row.y >= HOMEPAGE_MONTH_START_YEAR)
    .sort((a, b) => b.y - a.y)
    .map((row) => ({
      year: row.y,
      months: Array.from(
        { length: 12 },
        (_, index) => months.get(`${row.y}-${index + 1}`) ?? null,
      ),
      strategyYear: row.spct,
      buyHoldYear: row.bpct,
      edge: yearEdge(row.spct, row.bpct),
      partial: row.partial === true,
    }));
}

/** The readout opens on the most recent completed year; a partial year is
 *  only used when no completed year exists. */
export function defaultSelectedYear(rows: HomepageMonthlyRow[]): number | null {
  const completed = rows
    .filter((row) => !row.partial)
    .reduce<number | null>((best, row) => (best == null || row.year > best ? row.year : best), null);
  return completed ?? rows[0]?.year ?? null;
}

/** Shared zero-based axis for the yearly strategy and buy & hold bars,
 *  snapped outward to a round tick step that covers every year's values. */
export function yearBarDomain(rows: HomepageMonthlyRow[]): YearBarDomain {
  let low = 0;
  let high = 0;
  for (const row of rows) {
    low = Math.min(low, row.strategyYear, row.buyHoldYear);
    high = Math.max(high, row.strategyYear, row.buyHoldYear);
  }
  const range = high - low;
  const step = range <= 20 ? 5 : range <= 40 ? 10 : range <= 100 ? 20 : 50;
  const min = low < 0 ? Math.floor(low / step) * step : 0;
  const max = high > 0 ? Math.ceil(high / step) * step : 0;
  const ticks: number[] = [];
  for (let tick = min; tick <= max; tick += step) ticks.push(tick);
  if (min === max) return { min: 0, max: step, ticks: [0, step] };
  return { min, max, ticks };
}
