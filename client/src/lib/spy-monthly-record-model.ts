import type { LabReport } from "@/data/lab-data";

export const HOMEPAGE_MONTH_START_YEAR = 2013;

export type HomepageMonthlyRow = {
  year: number;
  months: Array<number | null>;
  strategyYear: number;
  buyHoldYear: number;
  partial: boolean;
};

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
      partial: row.partial === true,
    }));
}
