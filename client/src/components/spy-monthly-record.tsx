import { useEffect, useMemo, useState } from "react";
import { BeamHeading } from "@/components/beam-heading";
import { DEPLOY } from "@/data/fearlab-board";
import { fetchReportCached, type LabReport } from "@/data/lab-data";
import { useBeam } from "@/hooks/use-beam";
import {
  buildHomepageMonthlyRows,
  defaultSelectedYear,
  yearBarDomain,
  type HomepageMonthlyRow,
  type YearBarDomain,
} from "@/lib/spy-monthly-record-model";

// Name the deployed strategy directly; the table labels explain the monthly view.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SPY_DEPLOY = DEPLOY.find((entry) => entry.sym === "SPY");
// Version label tracks the deploy (regen keeps DEPLOY in step with cells.py);
// a SPY flip auto-updates the copy. Fallback only if the snapshot is absent.
const SPY_VARIANT = SPY_DEPLOY?.variant ?? "v4.6";
const ROW_MS = 55;
const BAR_MS = 420;

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

// Faint tint only: the number carries the reading, the wash just hints at sign
// and size (green gain, amber loss).
function tintStyle(value: number): React.CSSProperties {
  const energy = Math.min(Math.abs(value) / 10, 1);
  const alpha = (energy * 0.06 + 0.02).toFixed(3);
  return {
    background: value >= 0
      ? `hsl(var(--beam-mid) / ${alpha})`
      : `hsl(var(--accent) / ${alpha})`,
  };
}

// Selected row: a thin beam-mid frame drawn on the cells (an outline on the
// row would sit under the sticky year cell).
const FRAME = "hsl(var(--beam-mid) / 0.7)";
function frame(side: "first" | "middle" | "last"): React.CSSProperties {
  const edges = [`inset 0 1px 0 ${FRAME}`, `inset 0 -1px 0 ${FRAME}`];
  if (side === "first") edges.push(`inset 1px 0 0 ${FRAME}`);
  if (side === "last") edges.push(`inset -1px 0 0 ${FRAME}`);
  return { boxShadow: edges.join(", ") };
}

function pct(domain: YearBarDomain, value: number): number {
  return ((value - domain.min) / (domain.max - domain.min)) * 100;
}

function YearBars({
  row,
  domain,
  drawn,
  instant,
  delayMs,
}: {
  row: HomepageMonthlyRow;
  domain: YearBarDomain;
  drawn: boolean;
  instant: boolean;
  delayMs: number;
}) {
  const zero = pct(domain, 0);
  const bar = (value: number) => {
    const end = pct(domain, value);
    return {
      left: `${Math.min(zero, end)}%`,
      width: `${Math.abs(end - zero)}%`,
      transformOrigin: value >= 0 ? "left center" : "right center",
      transform: drawn ? "scaleX(1)" : "scaleX(0)",
      transition: instant ? "none" : `transform ${BAR_MS}ms var(--ease-out-expo) ${delayMs}ms`,
    } satisfies React.CSSProperties;
  };

  return (
    <div className="relative h-[17px]" aria-hidden="true">
      <div className="absolute inset-y-[-6px] w-px bg-beam-dim/50" style={{ left: `${zero}%` }} />
      <div
        className={`absolute top-[2px] h-[6px] ${row.strategyYear < 0 ? "bg-accent/85" : "bg-beam-mid"}`}
        style={bar(row.strategyYear)}
      />
      <div
        className={`absolute top-[10px] h-[6px] border border-dashed ${row.buyHoldYear < 0 ? "border-accent/60" : "border-beam-dim/80"}`}
        style={bar(row.buyHoldYear)}
      />
    </div>
  );
}

export function SpyMonthlyRecord() {
  const { ref, phase } = useBeam<HTMLElement>({ releaseAfter: 2600 });
  const [report, setReport] = useState<LabReport | null>(null);
  const [offline, setOffline] = useState(false);
  const [pickedYear, setPickedYear] = useState<number | null>(null);

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
  const domain = useMemo(() => yearBarDomain(rows), [rows]);
  const selectedYear = rows.some((row) => row.year === pickedYear) ? pickedYear : defaultSelectedYear(rows);
  const selected = rows.find((row) => row.year === selectedYear) ?? null;
  const partialRow = rows.find((row) => row.partial) ?? null;
  const drawn = phase !== "dark";
  const instant = phase === "held";
  const scanMs = rows.length * ROW_MS + 300;
  const firstYear = rows.at(-1)?.year;
  const lastYear = rows[0]?.year;

  return (
    <section
      ref={ref}
      className="px-5 py-24 md:px-10"
      aria-label={`SPY ${SPY_VARIANT} monthly strategy returns with yearly buy-and-hold comparison`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,470px)] lg:items-end">
          <div>
            <div className="etched mb-2 text-beam-dim" aria-hidden="true">03</div>
            <div className="mb-3 max-w-[620px]">
              <BeamHeading text={`SPY ${SPY_VARIANT} Strategy`} as="h2" active={drawn} instant={instant} />
            </div>
            <p className="etched max-w-[72ch] leading-relaxed text-beam-dim">
              Strategy and buy &amp; hold use the same starting capital and dates.
              Monthly cells are strategy returns in percent; each year then sets the strategy
              against buy &amp; hold. * marks the partial current year.
            </p>
          </div>

          {selected && (
            <div className="border-l border-beam-ghost pl-5 md:pl-6" aria-live="polite">
              <div className="etched text-beam-dim">
                {selected.year} strategy edge{selected.partial ? ", partial year" : ""}
              </div>
              <div
                className={`mt-1 font-mono text-4xl font-semibold tabular-nums leading-none md:text-5xl ${selected.edge >= 0 ? "text-beam-hot" : "text-beam-mid"}`}
              >
                {signed(selected.edge)}
                <span className="text-2xl md:text-3xl"> pp</span>
              </div>
              <div className="mt-3 font-mono text-sm tabular-nums text-beam-mid">
                <span className={selected.strategyYear < 0 ? "text-accent" : "text-beam-hot"}>
                  {signed(selected.strategyYear)}%
                </span>{" "}
                strategy vs{" "}
                <span className={selected.buyHoldYear < 0 ? "text-accent/80" : "text-beam-mid"}>
                  {signed(selected.buyHoldYear)}%
                </span>{" "}
                buy &amp; hold
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-beam-dim">
                One calendar year, not an average. Simulated backtest results, not actual
                account performance. Select a year in the table to compare.
              </p>
            </div>
          )}
        </div>

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
            <div
              className="overflow-x-auto overscroll-x-contain pb-2"
              tabIndex={0}
              role="region"
              aria-label="SPY monthly and yearly returns table, scrolls sideways"
            >
              <table className="w-full min-w-[1000px] border-collapse font-mono text-[11px] lg:text-[13px]">
                <caption className="sr-only">
                  SPY {SPY_VARIANT} monthly strategy returns from {lastYear} through {firstYear},
                  with yearly strategy and buy-and-hold returns in percent and the strategy edge
                  in percentage points. Select a year to show it in the readout.
                </caption>
                <thead>
                  <tr className="border-b border-beam-ghost/60 align-bottom text-beam-dim">
                    <th className="sticky left-0 z-10 bg-background px-[6px] py-2 text-left font-semibold">YEAR</th>
                    {MONTHS.map((month) => (
                      <th key={month} className="px-[3px] py-2 text-center font-semibold">{month}</th>
                    ))}
                    <th className="w-[180px] border-l border-beam-ghost/60 px-[10px] py-2 font-normal">
                      <span className="sr-only">Strategy and buy &amp; hold year bars, percent</span>
                      <div className="mb-2 flex justify-center gap-[10px] whitespace-nowrap text-[10px] text-beam-dim" aria-hidden="true">
                        <span className="inline-flex items-center gap-[5px]">
                          <span className="inline-block h-[5px] w-[14px] bg-beam-mid" />
                          Strategy
                        </span>
                        <span className="inline-flex items-center gap-[5px]">
                          <span className="inline-block h-[5px] w-[14px] border border-dashed border-beam-dim" />
                          Buy &amp; hold
                        </span>
                      </div>
                      <div className="relative h-4" aria-hidden="true">
                        {domain.ticks.map((tick) => (
                          <span
                            key={tick}
                            className="absolute top-0 -translate-x-1/2 text-[10px] font-normal tabular-nums text-beam-dim"
                            style={{ left: `${pct(domain, tick)}%` }}
                          >
                            {tick > 0 ? `+${tick}` : tick}
                          </span>
                        ))}
                      </div>
                    </th>
                    <th className="border-l border-beam-ghost/60 px-[6px] py-2 text-right font-semibold text-beam-mid">STRATEGY</th>
                    <th className="px-[6px] py-2 text-right font-semibold">B&amp;H</th>
                    <th className="border-l border-beam-ghost/60 px-[6px] py-2 text-right font-semibold">
                      EDGE <span className="font-normal">(pp)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const isSelected = row.year === selectedYear;
                    const delay = instant ? "0ms" : `${rowIndex * ROW_MS}ms`;
                    const framed = (side: "first" | "middle" | "last") => (isSelected ? frame(side) : undefined);
                    return (
                      <tr
                        key={row.year}
                        onClick={() => setPickedYear(row.year)}
                        className="cursor-pointer border-b border-beam-ghost/35 hover:bg-beam-ghost/25"
                      >
                        <th
                          scope="row"
                          className="raster-cell sticky left-0 z-10 bg-background p-0 text-left font-medium"
                          style={{ ...framed("first"), transitionDelay: delay }}
                        >
                          <button
                            type="button"
                            onClick={() => setPickedYear(row.year)}
                            aria-pressed={isSelected}
                            aria-label={`${row.year}${row.partial ? ", partial year" : ""}: show strategy edge`}
                            className={`flex min-h-[44px] w-full items-center px-[8px] tabular-nums sm:min-h-[30px] ${isSelected ? "text-beam-hot" : "text-beam-mid hover:text-beam-hot"}`}
                          >
                            {row.year}
                            {row.partial ? <span aria-hidden="true">*</span> : null}
                          </button>
                        </th>
                        {row.months.map((value, monthIndex) => (
                          <td
                            key={`${row.year}-${monthIndex}`}
                            className={`raster-cell px-[3px] py-1.5 text-center tabular-nums ${value != null && value < 0 ? "text-accent/90" : "text-foreground/85"}`}
                            style={{
                              ...(value == null ? undefined : tintStyle(value)),
                              ...framed("middle"),
                              transitionDelay: delay,
                            }}
                            aria-label={value == null ? `${MONTHS[monthIndex]}: no result yet` : undefined}
                            title={value == null ? undefined : `${MONTHS[monthIndex]} ${row.year}: ${signed(value)}%`}
                          >
                            {value == null ? "" : signed(value)}
                          </td>
                        ))}
                        <td
                          className="raster-cell border-l border-beam-ghost/60 px-[10px] py-1.5"
                          style={{ ...framed("middle"), transitionDelay: delay }}
                        >
                          <YearBars
                            row={row}
                            domain={domain}
                            drawn={drawn}
                            instant={instant}
                            delayMs={rowIndex * ROW_MS}
                          />
                        </td>
                        <td
                          className={`raster-cell border-l border-beam-ghost/60 px-[6px] py-1.5 text-right font-semibold tabular-nums ${row.strategyYear < 0 ? "text-accent" : "text-beam-hot"}`}
                          style={{ ...framed("middle"), transitionDelay: delay }}
                          title={`Strategy ${row.year}: ${signed(row.strategyYear)}%`}
                        >
                          {signed(row.strategyYear)}
                        </td>
                        <td
                          className={`raster-cell px-[6px] py-1.5 text-right tabular-nums ${row.buyHoldYear < 0 ? "text-accent/75" : "text-beam-dim"}`}
                          style={{ ...framed("middle"), transitionDelay: delay }}
                          title={`Buy and hold ${row.year}: ${signed(row.buyHoldYear)}%`}
                        >
                          {signed(row.buyHoldYear)}
                        </td>
                        <td
                          className={`raster-cell border-l border-beam-ghost/60 px-[6px] py-1.5 text-right tabular-nums ${row.edge >= 0 ? "text-beam-hot" : "text-beam-dim"}`}
                          style={{ ...framed("last"), transitionDelay: delay }}
                          title={`Edge ${row.year}: ${signed(row.edge)} percentage points`}
                        >
                          {signed(row.edge)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="etched mt-4 max-w-[110ch] leading-relaxed text-beam-dim">
          * {partialRow ? `${partialRow.year} ` : ""}partial year · returns in percent · edge = strategy
          minus buy &amp; hold, in percentage points (pp). Strategy and buy &amp; hold use the same
          starting capital and dates. Simulated backtest results, not actual account performance.
          <span className="md:hidden" aria-hidden="true"> · swipe the table →</span>
        </p>
      </div>
    </section>
  );
}
