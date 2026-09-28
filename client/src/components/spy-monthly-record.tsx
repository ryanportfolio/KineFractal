import { useEffect, useMemo, useState } from "react";
import { BeamHeading } from "@/components/beam-heading";
import { DEPLOY } from "@/data/fearlab-board";
import { fetchReportCached, type LabReport } from "@/data/lab-data";
import { useBeam } from "@/hooks/use-beam";
import { buildHomepageMonthlyRows } from "@/lib/spy-monthly-record-model";

// Name the deployed strategy directly; the table labels explain the monthly view.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SPY_DEPLOY = DEPLOY.find((entry) => entry.sym === "SPY");
// Version label tracks the deploy (regen keeps DEPLOY in step with cells.py);
// a SPY flip auto-updates the copy. Fallback only if the snapshot is absent.
const SPY_VARIANT = SPY_DEPLOY?.variant ?? "v4.6";
const ROW_MS = 55;

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function heatStyle(value: number, quieter = false): React.CSSProperties {
  const energy = Math.min(Math.abs(value) / 8, 1);
  const alpha = (energy * (quieter ? 0.28 : 0.46) + (quieter ? 0.04 : 0.07)).toFixed(2);
  return {
    background: value >= 0
      ? `hsl(var(--beam-mid) / ${alpha})`
      : `hsl(var(--accent) / ${alpha})`,
  };
}

export function SpyMonthlyRecord() {
  const { ref, phase } = useBeam<HTMLElement>({ releaseAfter: 2600 });
  const [report, setReport] = useState<LabReport | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let live = true;
    if (!SPY_DEPLOY) {
      setOffline(true);
      return () => {
        live = false;
      };
    }

    fetchReportCached(SPY_DEPLOY.reportKey)
      .then((value) => {
        if (live) setReport(value);
      })
      .catch(() => {
        if (live) setOffline(true);
      });

    return () => {
      live = false;
    };
  }, []);

  const rows = useMemo(() => (report ? buildHomepageMonthlyRows(report) : []), [report]);
  const drawn = phase !== "dark";
  const instant = phase === "held";
  const scanMs = rows.length * ROW_MS + 300;

  return (
    <section
      ref={ref}
      className="px-5 py-24 md:px-10"
      aria-label={`SPY ${SPY_VARIANT} monthly strategy returns with yearly buy-and-hold comparison`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="etched mb-2 text-beam-dim" aria-hidden="true">03</div>
        <div className="mb-3 max-w-[620px]">
          <BeamHeading text={`SPY ${SPY_VARIANT} Strategy`} as="h2" active={drawn} instant={instant} />
        </div>
        <p className="etched mb-10 max-w-[86ch] leading-relaxed text-beam-dim">
          Strategy and buy &amp; hold use the same starting capital and dates.
          Cells and year totals are percentages; * marks the partial current year.
        </p>

        {!report && !offline && (
          <div className="etched py-8 text-beam-dim">loading the monthly record…</div>
        )}
        {offline && (
          <div className="etched py-8 text-beam-dim">monthly record feed offline</div>
        )}
        {report && rows.length === 0 && (
          <div className="etched py-8 text-beam-dim">monthly record unavailable</div>
        )}

        {rows.length > 0 && (
          <div
            className={`relative ${drawn ? (instant ? "raster-done" : "raster-scanning") : ""}`}
            style={{ "--raster-ms": `${scanMs}ms` } as React.CSSProperties}
          >
            <div className="raster-line" aria-hidden="true" />
            <div className="overflow-x-auto overscroll-x-contain pb-2" tabIndex={0}>
              <table className="min-w-[1040px] w-full border-collapse font-mono text-[11px] lg:text-xs">
              <caption className="sr-only">
                SPY {SPY_VARIANT} monthly strategy returns from 2026 through 2013,
                with yearly strategy and buy-and-hold returns
              </caption>
              <thead>
                <tr className="border-b border-beam-ghost/60 text-beam-dim">
                  <th className="sticky left-0 z-10 bg-background px-2 py-2 text-left font-semibold">YEAR</th>
                  {MONTHS.map((month) => (
                    <th key={month} className="px-1.5 py-2 text-center font-semibold">{month}</th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold text-beam-mid">STRATEGY YEAR</th>
                  <th className="px-2 py-2 text-center font-semibold">B&amp;H YEAR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={row.year} className="border-b border-beam-ghost/35">
                    <th
                      scope="row"
                      className="raster-cell sticky left-0 z-10 bg-background px-2 py-2 text-left font-medium tabular-nums text-beam-mid"
                      style={{ transitionDelay: instant ? "0ms" : `${rowIndex * ROW_MS}ms` }}
                    >
                      {row.year}
                      {row.partial ? <span aria-hidden="true">*</span> : null}
                      {row.partial ? <span className="sr-only"> partial year</span> : null}
                    </th>
                    {row.months.map((value, monthIndex) => (
                      <td
                        key={`${row.year}-${monthIndex}`}
                        className="raster-cell px-1.5 py-2 text-center tabular-nums text-foreground"
                        style={{
                          ...(value == null ? undefined : heatStyle(value)),
                          transitionDelay: instant ? "0ms" : `${rowIndex * ROW_MS}ms`,
                        }}
                        aria-label={value == null ? `${MONTHS[monthIndex]}: no result yet` : undefined}
                        title={value == null ? undefined : `${MONTHS[monthIndex]} ${row.year}: ${signed(value)}%`}
                      >
                        {value == null ? "" : signed(value)}
                      </td>
                    ))}
                    <td
                      className="raster-cell px-2 py-2 text-center font-semibold tabular-nums text-beam-hot"
                      style={{
                        ...heatStyle(row.strategyYear),
                        transitionDelay: instant ? "0ms" : `${rowIndex * ROW_MS}ms`,
                      }}
                      title={`Strategy ${row.year}: ${signed(row.strategyYear)}%`}
                    >
                      {signed(row.strategyYear)}
                    </td>
                    <td
                      className="raster-cell px-2 py-2 text-center tabular-nums text-beam-mid"
                      style={{
                        ...heatStyle(row.buyHoldYear, true),
                        transitionDelay: instant ? "0ms" : `${rowIndex * ROW_MS}ms`,
                      }}
                      title={`Buy and hold ${row.year}: ${signed(row.buyHoldYear)}%`}
                    >
                      {signed(row.buyHoldYear)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="etched mt-3 text-beam-dim">
          * partial year · returns in percent
          <span className="md:hidden" aria-hidden="true"> · swipe the table →</span>
        </div>
      </div>
    </section>
  );
}
