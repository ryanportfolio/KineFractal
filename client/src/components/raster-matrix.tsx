// RasterMatrix — movement 5: THE RASTER.
//
// The one moment the beam behaves as television: a bright scanline sweeps the
// yearly edge matrix top to bottom exactly once and every cell ignites as it
// passes. Cells are bare ramp-colored numerals (edge in percentage points) on
// dark phosphor — no boxes, no borders, graticule rules every five years.
// Closing caption: the walk-forward stress test as a row of 24 beam dots.
import { useEffect, useMemo, useState } from "react";
import { useBeam } from "@/hooks/use-beam";
import { BeamHeading } from "@/components/beam-heading";
import { DecodeText } from "@/components/decode-text";
import { fetchReportCached } from "@/data/lab-data";
import { DEPLOY } from "@/data/fearlab-board";

type YearCell = { edge: number | null; partial?: boolean };
type MatrixRow = { year: number; cells: YearCell[] };

const ROW_MS = 34;
const SYM_ORD: Record<string, number> = { SPY: 0, QQQ: 1, IWM: 2 };
const FUNDS = [...DEPLOY].sort((a, b) => (SYM_ORD[a.sym] ?? 9) - (SYM_ORD[b.sym] ?? 9));

function cellClass(edge: number | null, terciles: [number, number]): string {
  if (edge == null) return "text-beam-dim/70";
  if (edge < 0) {
    const a = Math.abs(edge);
    if (a > terciles[1]) return "text-accent";
    if (a > terciles[0]) return "text-accent/70";
    return "text-accent/45";
  }
  if (edge > terciles[1]) return "text-beam-hot";
  if (edge > terciles[0]) return "text-beam-mid";
  return "text-beam-dim";
}

export function RasterMatrix() {
  const { ref, phase } = useBeam<HTMLElement>({ releaseAfter: 3200 });
  const [rows, setRows] = useState<MatrixRow[] | null>(null);

  useEffect(() => {
    let live = true;
    Promise.allSettled(FUNDS.map((d) => fetchReportCached(d.reportKey))).then((settled) => {
      if (!live) return;
      const byYear = new Map<number, YearCell[]>();
      settled.forEach((res, ci) => {
        if (res.status !== "fulfilled") return; // one dead feed can't blank the matrix
        for (const y of res.value.yearly ?? []) {
          if (!byYear.has(y.y)) byYear.set(y.y, FUNDS.map(() => ({ edge: null })));
          byYear.get(y.y)![ci] = { edge: y.edge, partial: y.partial };
        }
      });
      const out = Array.from(byYear.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, cells]) => ({ year, cells }));
      setRows(out); // empty array -> honest offline line, not eternal loading
    });
    return () => {
      live = false;
    };
  }, []);

  const terciles = useMemo<[number, number]>(() => {
    if (!rows) return [3, 8];
    const mags = rows
      .flatMap((r) => r.cells.map((c) => (c.edge == null ? null : Math.abs(c.edge))))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (mags.length < 3) return [3, 8];
    return [mags[Math.floor(mags.length / 3)], mags[Math.floor((mags.length * 2) / 3)]];
  }, [rows]);

  const drawn = phase !== "dark";
  const instant = phase === "held";
  const n = rows?.length ?? 0;
  const scanMs = n * ROW_MS + 300;

  return (
    <section
      ref={ref}
      className="px-5 md:px-10 py-24"
      aria-label="Edge over buy and hold, by year and fund"
    >
      <div className="max-w-6xl mx-auto">
        <div className="etched text-beam-dim mb-2" aria-hidden="true">04</div>
        <div className="max-w-[480px] mb-3">
          <BeamHeading text="EVERY YEAR" as="h2" active={drawn} instant={instant} />
        </div>
        <p className="etched mb-10">
          <DecodeText
            text="edge vs buy & hold in percentage points · same dates both lines · amber = behind"
            active={drawn}
            instant={instant}
          />
        </p>

        <div
          className={`relative ${drawn ? (instant ? "raster-done" : "raster-scanning") : ""}`}
          style={{ "--raster-ms": `${scanMs}ms` } as React.CSSProperties}
        >
          <div className="raster-line" aria-hidden="true" />
          <div role="table" aria-label="Edge over buy and hold in percentage points, by year and fund">
            {/* header */}
            <div role="row" className="grid grid-cols-[4.2rem_repeat(3,1fr)] gap-x-4 pb-2 border-b border-beam-ghost/60">
              <span role="columnheader" className="etched text-beam-dim">year</span>
              {FUNDS.map((d) => (
                <span role="columnheader" key={d.sym} className="etched text-right">
                  {d.sym} <span className="text-beam-dim">· {d.tfLabel}</span>
                </span>
              ))}
            </div>
            {rows === null && (
              <div className="etched py-8 text-beam-dim">loading the record…</div>
            )}
            {rows?.length === 0 && (
              <div className="etched py-8 text-beam-dim">record feed offline</div>
            )}
            {rows?.map((r, ri) => (
              <div
                role="row"
                key={r.year}
                className={`grid grid-cols-[4.2rem_repeat(3,1fr)] gap-x-4 py-[6px] font-mono text-[15px] md:text-[17px] tabular-nums ${
                  r.year % 5 === 0 ? "border-t border-beam-ghost/50" : ""
                }`}
              >
                <span
                  role="rowheader"
                  className="raster-cell text-beam-dim"
                  style={{ transitionDelay: instant ? "0ms" : `${ri * ROW_MS}ms` }}
                >
                  {r.year}
                </span>
                {r.cells.map((c, ci) => (
                  <span
                    role="cell"
                    key={ci}
                    className={`raster-cell text-right transition-colors hover:!text-beam-core ${cellClass(c.edge, terciles)}`}
                    style={{ transitionDelay: instant ? "0ms" : `${ri * ROW_MS}ms` }}
                    title={
                      c.edge == null
                        ? `${FUNDS[ci].sym}: not yet deployed in ${r.year}`
                        : `${FUNDS[ci].sym} ${r.year}${c.partial ? " (partial year)" : ""}: ${
                            c.edge >= 0 ? "+" : ""
                          }${c.edge.toFixed(1)} pp vs buy & hold`
                    }
                  >
                    {c.edge == null ? "·" : `${c.edge >= 0 ? "+" : ""}${c.edge.toFixed(1)}`}
                    {c.partial ? <span className="text-beam-dim" aria-hidden="true">*</span> : null}
                    {c.partial ? <span className="sr-only"> (partial year)</span> : null}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="etched mt-2 text-beam-dim">* partial year</div>
        </div>

        {/* the guard, derived from the matrix itself: complete years ahead */}
        {rows && rows.length > 0 && (
          <div className="mt-12 pt-5 border-t border-beam-ghost/60 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-[5px] max-w-full" aria-hidden="true">
              {rows
                .filter((r) => !r.cells[0]?.partial && r.cells[0]?.edge != null)
                .map((r, i) => {
                  const ahead = (r.cells[0]!.edge ?? 0) >= 0;
                  return (
                    <span
                      key={r.year}
                      className="inline-block w-[7px] h-[7px]"
                      title={`SPY ${r.year}: ${ahead ? "ahead" : "behind"}`}
                      style={{
                        background: ahead ? "hsl(var(--beam-mid))" : "hsl(var(--accent) / 0.75)",
                        boxShadow: ahead ? "0 0 4px hsl(var(--beam-mid) / 0.5)" : "none",
                        opacity: drawn ? 1 : 0,
                        transition: instant
                          ? "none"
                          : `opacity 0.25s ease ${scanMs + i * 40}ms`,
                      }}
                    />
                  );
                })}
            </div>
            <span className="etched">
              the strategy beats buy &amp; hold:{" "}
              {FUNDS.map((d, ci) => {
                const done = rows.filter((r) => !r.cells[ci]?.partial && r.cells[ci]?.edge != null);
                const ahead = done.filter((r) => (r.cells[ci]!.edge ?? 0) >= 0).length;
                return (
                  <span key={d.sym}>
                    {ci > 0 && <span className="text-beam-dim"> · </span>}
                    <span className="text-beam-mid font-semibold">{d.sym}</span> {ahead}
                    <span className="text-beam-dim">/{done.length} years</span>
                  </span>
                );
              })}
              <br />
              <span className="text-beam-dim">since 2020:</span>{" "}
              {FUNDS.map((d, ci) => {
                const modern = rows.filter(
                  (r) => r.year >= 2020 && !r.cells[ci]?.partial && r.cells[ci]?.edge != null,
                );
                const ahead = modern.filter((r) => (r.cells[ci]!.edge ?? 0) >= 0).length;
                return (
                  <span key={d.sym}>
                    {ci > 0 && <span className="text-beam-dim"> · </span>}
                    <span className="text-beam-mid font-semibold">{d.sym}</span> {ahead}
                    <span className="text-beam-dim">/{modern.length}</span>
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
