import { useBeam } from "@/hooks/use-beam";
import { BeamHeading } from "@/components/beam-heading";
import type { StartCohorts } from "@/data/lab-data";

const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const signedPp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)} pp`;

export function LadderWaterfall({ cohorts }: { cohorts: StartCohorts | null | undefined }) {
  const { ref, phase } = useBeam<HTMLElement>({ releaseAfter: 2400 });
  const drawn = phase !== "dark";
  const instant = phase === "held";
  const rows = cohorts?.rows ?? [];
  const endDate = rows[0]?.end;
  const max = Math.max(...rows.flatMap((row) => [Math.abs(row.strategy_pct), Math.abs(row.benchmark_pct)]), 1);

  return (
    <section ref={ref} className="px-5 py-24 md:px-10" aria-label="SPY daily backtest by starting year">
      <div className="mx-auto max-w-6xl">
        <div className="etched mb-2 text-beam-dim" aria-hidden="true">03</div>
        <BeamHeading text="START ANY YEAR" as="h2" active={drawn} instant={instant} />
        <p className="etched mt-4 max-w-[88ch] leading-relaxed text-beam-dim">
          SPY {cohorts?.preset.replace(/^fav-spy-/, "").replace(/-1d$/, "") ?? "v4.6"} · daily · contribution-free start cohorts
          {endDate ? ` · through EOD ${endDate}.` : "."}
          {endDate
            ? " Each row starts all cash on that year’s first available trading session and runs through that EOD date."
            : " Cohort end date unavailable."}
          No deposits; leverage off; equal internal starting capital; strategy and buy &amp; hold use the same dates.
        </p>
        <p className="etched mt-3 max-w-[88ch] leading-relaxed text-beam-dim">
          Different question from the section above: independent annual rows stop at year-end. These cohorts continue to the latest date.
          Pre-start history only warms indicators: no earlier capital, positions or trades carry in.
        </p>

        {cohorts === undefined && <div className="etched mt-10 border-t border-beam-ghost/60 py-8 text-beam-dim">loading start-year results…</div>}
        {cohorts === null && <div className="etched mt-10 border-t border-beam-ghost/60 py-8 text-beam-dim">start-year results unavailable</div>}
        {cohorts && rows.length === 0 && <div className="etched mt-10 py-8 text-beam-dim">no start-year results</div>}
        {rows.length > 0 && (
          <div className="mt-10 overflow-x-auto overscroll-x-contain border-t border-beam-ghost/60" tabIndex={0}>
            <div className="min-w-[690px]">
            <div className="grid grid-cols-[3.4rem_1fr_4.8rem_4.8rem_5.2rem] gap-2 border-b border-beam-ghost/50 py-2 font-mono text-[11px] text-beam-dim md:grid-cols-[4rem_1fr_6rem_6rem_6rem] md:text-xs">
              <span>START</span><span>RELATIVE SCALE</span><span className="text-right">STRATEGY</span><span className="text-right">B&amp;H</span><span className="text-right">EDGE</span>
            </div>
            {rows.map((row, index) => {
              const delay = 180 + index * 35;
              const width = (n: number) => `${Math.max(0.5, Math.abs(n) / max * 100)}%`;
              return (
                <div key={row.year} className="grid grid-cols-[3.4rem_1fr_4.8rem_4.8rem_5.2rem] items-center gap-2 border-b border-beam-ghost/35 py-2.5 font-mono text-xs tabular-nums md:grid-cols-[4rem_1fr_6rem_6rem_6rem] md:text-sm" title={`${row.start} through ${row.end}`}>
                  <span className="font-semibold text-beam-mid">{row.year}</span>
                  <div className="space-y-1">
                    {[row.strategy_pct, row.benchmark_pct].map((value, i) => (
                      <div key={i} className="h-[3px]">
                        <div className={i === 0 ? "h-full bg-beam-hot" : "h-full bg-beam-dim/60"} style={{ width: width(value), transform: drawn ? "scaleX(1)" : "scaleX(0)", transformOrigin: "left", transition: instant ? "none" : `transform .65s ease ${delay + i * 100}ms` }} />
                      </div>
                    ))}
                  </div>
                  <span className="text-right text-beam-hot">{signedPct(row.strategy_pct)}</span>
                  <span className="text-right text-beam-mid">{signedPct(row.benchmark_pct)}</span>
                  <span className="text-right font-semibold text-beam-mid">{signedPp(row.edge_pp)}</span>
                </div>
              );
            })}
            </div>
          </div>
        )}
        <div className="etched mt-5 flex flex-wrap gap-x-6 gap-y-1 text-beam-dim">
          <span><span className="mr-2 inline-block h-[3px] w-4 bg-beam-hot align-middle" />strategy return</span>
          <span><span className="mr-2 inline-block h-[3px] w-4 bg-beam-dim/60 align-middle" />buy &amp; hold return</span>
          <span>edge = percentage-point difference</span>
        </div>
      </div>
    </section>
  );
}
