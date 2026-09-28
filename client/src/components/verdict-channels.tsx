import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useBeam } from "@/hooks/use-beam";
import { BeamHeading } from "@/components/beam-heading";
import { fetchReportCached } from "@/data/lab-data";
import type { DeploySymbol } from "@/data/fearlab-board";

type YearRecord = { ahead: number; total: number };

function Channel({ d, delayMs, phase }: {
  d: DeploySymbol;
  delayMs: number;
  phase: "dark" | "drawing" | "held";
}) {
  const [record, setRecord] = useState<YearRecord | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let live = true;
    fetchReportCached(d.reportKey).then((report) => {
      if (!live) return;
      if (report.yearlyBasis !== "flat") {
        setUnavailable(true);
        return;
      }
      const completed = report.yearly.filter((year) => !year.partial);
      setRecord({
        ahead: completed.filter((year) => year.edge > 0).length,
        total: completed.length,
      });
    }).catch(() => live && setUnavailable(true));
    return () => { live = false; };
  }, [d.reportKey]);

  const shown = phase !== "dark";
  return (
    <Link
      href={`/lab/${d.reportKey}`}
      className="group flex min-h-64 flex-col border border-beam-ghost/70 p-6 transition-colors hover:border-beam-dim/90 hover:bg-[hsl(var(--beam-ghost)/0.14)] md:p-7"
      style={{
        opacity: shown ? 1 : 0,
        transition: phase === "held" ? undefined : `opacity 0.7s ease ${delayMs}ms`,
      }}
    >
      <div className="etched text-beam-dim">{d.sym} · {d.name}</div>
      <div className="etched mt-1 text-beam-dim">{d.tfLabel} · deployed {d.variant} backtest</div>
      {record ? (
        <>
          <div className="mt-8 font-mono text-5xl font-semibold tabular-nums text-beam-hot">
            {record.ahead}/{record.total}
          </div>
          <div className="mt-2 font-mono text-base text-beam-mid">completed years ahead of buy &amp; hold</div>
        </>
      ) : (
        <div className="etched mt-8 text-beam-dim">
          {unavailable ? "independent-year record unavailable" : "reading independent years…"}
        </div>
      )}
      <div className="etched mt-auto pt-8 text-beam-dim group-hover:text-beam-hot">
        open the full report →
      </div>
    </Link>
  );
}

export function VerdictChannels({ deploy: incoming }: { deploy: DeploySymbol[] }) {
  const { ref, phase } = useBeam<HTMLElement>({ releaseAfter: 3600 });
  const order: Record<string, number> = { SPY: 0, QQQ: 1, IWM: 2 };
  const deploy = [...incoming].sort((a, b) => order[a.sym] - order[b.sym]);
  return (
    <section ref={ref} id="verdict" className="scroll-mt-16 px-5 py-24 md:px-10" aria-label="Independent annual backtest results">
      <div className="mx-auto max-w-6xl">
        <div className="etched mb-2 text-beam-dim" aria-hidden="true">02</div>
        <BeamHeading text="YEAR BY YEAR" as="h2" active={phase !== "dark"} instant={phase === "held"} />
        <p className="etched mt-4 max-w-[78ch] leading-relaxed text-beam-dim">
          Simulated independent calendar years. Each completed year starts all cash, with no deposits.
          Strategy and buy &amp; hold use the same starting capital and the same dates. The current partial year is excluded.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {deploy.map((d, index) => <Channel key={d.sym} d={d} phase={phase} delayMs={300 + index * 220} />)}
        </div>
      </div>
    </section>
  );
}
