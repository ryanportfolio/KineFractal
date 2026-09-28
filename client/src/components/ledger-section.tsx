import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useBeam } from "@/hooks/use-beam";
import { BeamHeading } from "@/components/beam-heading";
import { engineName, fetchReportCached, trimName, type RecentRow } from "@/data/lab-data";
import { DEPLOY } from "@/data/fearlab-board";
import { useSignalsLatest, type SignalCell } from "@/hooks/use-fearlab-live";
import { formatPercent, signalSnapshotLabel } from "@/lib/homepage-signal-model";

const SPY = DEPLOY.find((entry) => entry.sym === "SPY")!;
const date = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
const quote = (value: number | null) => value == null ? "n/a" : `$${value.toFixed(2)}`;

type SignalIntent = { side?: string; signal_type?: string; engine?: string; order_type?: string };

function actionFor(cell: SignalCell): { side: string; action: string } {
  const intents = (cell.intents ?? []) as SignalIntent[];
  if (!intents.length) return { side: "HOLD", action: "no next-open order queued" };
  const sides = Array.from(new Set(intents.map((intent) => intent.side).filter(Boolean))).join("+");
  const actions = intents.map((intent) => {
    const raw = intent.engine || intent.signal_type || intent.order_type || "order";
    return intent.side === "BUY" ? engineName(raw) : intent.side === "SELL" ? trimName(raw) : raw;
  });
  return { side: sides || "ORDER", action: actions.join(" · ") };
}

function LatestDecision({ drawn }: { drawn: boolean }) {
  const { signals, isLoading, stale, age_hours } = useSignalsLatest();
  return (
    <div className={drawn ? "anno-in" : ""}>
      <h3 className="font-mono text-lg font-semibold tracking-[0.12em] text-beam-hot">LATEST EOD DECISION</h3>
      <p className="etched mt-2 text-beam-dim">Closed-session signal facts. ETF values below are market quotes, not account values.</p>
      {!signals && <div className="etched mt-4 py-4 text-beam-dim">{isLoading ? "reading the signal feed…" : "signal feed offline"}</div>}
      {signals && (
        <>
        <div className={`etched mt-3 font-semibold ${stale ? "text-accent" : "text-beam-dim"}`}>
          {signalSnapshotLabel(signals.trading_date, stale, age_hours)}
        </div>
        <div className="mt-4 overflow-x-auto overscroll-x-contain border-t border-beam-ghost/60" tabIndex={0}>
          <div className="min-w-[650px]">
          {DEPLOY.map((deploy, index) => {
            const cell = signals.cells.find((item) => item.symbol === deploy.sym && item.tf === deploy.tf);
            if (!cell) return null;
            const decision = actionFor(cell);
            return (
              <div key={deploy.sym} className="anno grid grid-cols-[5.2rem_3.3rem_3.5rem_1fr_5.4rem] gap-2 border-b border-beam-ghost/40 py-2.5 font-mono text-xs tabular-nums md:grid-cols-[7rem_4rem_4.5rem_1fr_7rem] md:text-sm" style={{ "--anno-delay": `${index * 70}ms` } as React.CSSProperties}>
                <span className="text-beam-dim">{signals.trading_date}</span>
                <span className="font-semibold text-beam-mid">{cell.symbol}</span>
                <span className={decision.side.includes("SELL") ? "text-accent" : "text-beam-mid"}>{decision.side}</span>
                <span className="truncate text-beam-dim" title={decision.action}>{decision.action}</span>
                <span className="text-right text-beam-mid">{quote(cell.price)}</span>
              </div>
            );
          })}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

export function LedgerSection({ generated }: { generated: string }) {
  const { ref, phase } = useBeam<HTMLElement>({ releaseAfter: 2200 });
  const [rows, setRows] = useState<RecentRow[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchReportCached(SPY.reportKey)
      .then((report) => live && setRows((report.recent ?? []).slice(0, 12)))
      .catch(() => live && setRows([]));
    return () => { live = false; };
  }, []);
  const drawn = phase !== "dark";
  const instant = phase === "held";

  return (
    <section ref={ref} id="ledger" className="scroll-mt-16 px-5 py-24 md:px-10" aria-label="Latest EOD decisions and recent simulated SPY activity">
      <div className="mx-auto max-w-6xl">
        <div className="etched mb-2 text-beam-dim" aria-hidden="true">06</div>
        <BeamHeading text="THE RECORD" as="h2" active={drawn} instant={instant} />
        <p className="etched mt-4 mb-10 text-beam-dim">EOD signals and labeled backtests for SPY, QQQ and IWM.</p>

        <LatestDecision drawn={drawn} />

        <div className="mt-16">
          <h3 className="font-mono text-lg font-semibold tracking-[0.12em] text-beam-hot">RECENT SIMULATED ACTIVITY</h3>
          <p className="etched mt-2 text-beam-dim">Latest 12 SPY {SPY.variant} full-history backtest fills. Account move shows the simulated order as a percent of account.</p>
          <div className={`mt-4 overflow-x-auto overscroll-x-contain border-t border-beam-ghost/60 ${drawn ? "anno-in" : ""}`} tabIndex={0}>
            <div className="min-w-[680px]">
            {rows === null && <div className="etched py-8 text-beam-dim">reading the backtest log…</div>}
            {rows?.length === 0 && <div className="etched py-8 text-beam-dim">backtest activity unavailable</div>}
            {rows?.map((row, index) => (
              <div key={`${row.ts}-${index}`} className="anno grid grid-cols-[7rem_4rem_1fr_7rem_7rem] gap-2 border-b border-beam-ghost/40 py-2.5 font-mono text-xs tabular-nums md:text-sm" style={{ "--anno-delay": `${index * 55}ms` } as React.CSSProperties}>
                <span className="text-beam-dim">{date(row.ts)}</span>
                <span className={row.side === "sell" ? "font-semibold text-accent" : "font-semibold text-beam-mid"}>{row.side}</span>
                <span className="truncate text-beam-dim">{row.side === "buy" ? engineName(row.label) : trimName(row.label)}</span>
                <span className="text-right text-beam-mid">{formatPercent(row.account_pct, 2)} <span className="sr-only">of account</span></span>
                <span className="text-right text-beam-dim">
                  {row.side === "sell" ? `${formatPercent(row.lot_return_pct, 1)} lot` : `${quote(row.price)} ETF quote`}
                </span>
              </div>
            ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
          <Link
            href={`/lab/${SPY.reportKey}`}
            className={`kf-stamp ${drawn ? "stamped" : ""} transition-colors hover:border-accent hover:brightness-125`}
            style={{ animationDelay: instant ? "0ms" : "900ms" }}
            aria-label={`Open the full SPY ${SPY.variant} backtest report`}
          >
            BACKTEST · SPY DAILY · {SPY.variant.toUpperCase()} · SIMULATED NEXT-OPEN FILLS
          </Link>
          <div className="etched text-right text-beam-dim">
            EOD {generated.slice(0, 10)} · <Link href={`/lab/${SPY.reportKey}`} className="hover:text-beam-mid">full report →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
