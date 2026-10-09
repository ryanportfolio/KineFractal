import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useBeam } from "@/hooks/use-beam";
import { BeamHeading } from "@/components/beam-heading";
import { LedgerTimeline } from "@/components/ledger-timeline";
import { engineName, fetchReportCached, trimName, type RecentRow } from "@/data/lab-data";
import { DEPLOY } from "@/data/fearlab-board";
import { useSignalsLatest, type SignalCell } from "@/hooks/use-fearlab-live";
import { formatPercent, signalSnapshotLabel } from "@/lib/homepage-signal-model";

const SPY = DEPLOY.find((entry) => entry.sym === "SPY")!;
const date = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
const quote = (value: number | null) => value == null ? "n/a" : `$${value.toFixed(2)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
/** below this order size a fill row renders dimmer */
const SMALL_ORDER_PCT = 0.1;
/** fill rows: date, side, reason, account %, ETF quote or lot return (px, so the 11px header and 13px rows align) */
const ROW_COLS = "grid-cols-[88px_40px_minmax(0,1fr)_76px_120px]";
/** latest-decision rows: fund, decision, ETF quote; the header uses the same columns. Narrower below sm so a 320px screen fits "BUY+SELL" and a seven-digit quote */
const DECISION_COLS = "grid-cols-[3rem_minmax(0,1fr)_auto] gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-3";

type SignalIntent = { side?: string; signal_type?: string; engine?: string; order_type?: string };

function actionFor(cell: SignalCell): { side: string; action: string; queued: boolean } {
  const intents = (cell.intents ?? []) as SignalIntent[];
  if (!intents.length) return { side: "HOLD", action: "No next-open order queued.", queued: false };
  const sides = Array.from(new Set(intents.map((intent) => intent.side).filter(Boolean))).join("+");
  const actions = intents.map((intent) => {
    const raw = intent.engine || intent.signal_type || intent.order_type || "order";
    return intent.side === "BUY" ? engineName(raw) : intent.side === "SELL" ? trimName(raw) : raw;
  });
  return { side: sides || "ORDER", action: `Queued for the next open: ${actions.join(", ")}. Not a broker fill.`, queued: true };
}

function LatestDecision({ drawn }: { drawn: boolean }) {
  const { signals, isLoading, stale, age_hours } = useSignalsLatest();
  const decisions = signals
    ? DEPLOY.flatMap((deploy) => {
      const cell = signals.cells.find((item) => item.symbol === deploy.sym && item.tf === deploy.tf);
      return cell ? [{ cell, decision: actionFor(cell) }] : [];
    })
    : [];
  const holds = decisions.filter((item) => item.decision.side === "HOLD").length;
  const queued = decisions.filter((item) => item.decision.queued).length;

  return (
    <div className={drawn ? "anno-in" : ""}>
      <h3 className="font-mono text-lg font-semibold tracking-[0.12em] text-beam-hot">LATEST EOD DECISION</h3>
      {!signals && <div className="etched mt-4 py-4 text-beam-dim">{isLoading ? "reading the signal feed…" : "signal feed offline"}</div>}
      {signals && (
        <>
          <div className={`mt-3 inline-block border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] ${stale ? "border-accent/70 text-accent" : "border-beam-ghost text-beam-mid"}`}>
            {signalSnapshotLabel(signals.trading_date, stale, age_hours)}
          </div>
          <p className="mt-3 font-mono text-[13px] leading-[20px] text-beam-dim">
            Closed-session signal facts, one per fund. Decisions, not broker fills. ETF quotes are market prices, not account values.
          </p>
          <div className={`mt-6 grid ${DECISION_COLS} border-b border-beam-ghost/70 pb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-beam-dim`} aria-hidden="true">
            <span>Fund</span><span>Decision</span><span className="text-right">ETF quote</span>
          </div>
          <ul>
            {decisions.map(({ cell, decision }, index) => (
              <li
                key={cell.symbol}
                className="anno border-b border-beam-ghost/40 py-3"
                style={{ "--anno-delay": `${index * 70}ms` } as React.CSSProperties}
              >
                <div className={`grid ${DECISION_COLS} items-baseline font-mono text-[15px] leading-[24px] tabular-nums sm:text-lg sm:leading-[30px]`}>
                  <span className="font-semibold text-beam-mid">{cell.symbol}</span>
                  <span className={`min-w-0 ${decision.side.includes("SELL") ? "text-accent" : "text-beam-mid"}`}>
                    {/* a combined decision may wrap after each "+" when the column is narrow */}
                    {decision.side.split("+").map((part, i) => <span key={i}>{i > 0 && <>+<wbr /></>}{part}</span>)}
                  </span>
                  <span className="text-right text-beam-mid">
                    {quote(cell.price)}<span className="sr-only"> ETF quote</span>
                  </span>
                </div>
                <p className="mt-1 font-mono text-[13px] leading-[20px] text-beam-dim">{decision.action}</p>
              </li>
            ))}
          </ul>
          {decisions.length > 0 && (
            <div className="anno mt-8" style={{ "--anno-delay": `${decisions.length * 70 + 120}ms` } as React.CSSProperties}>
              <p className="font-mono text-3xl font-semibold leading-tight tracking-[0.06em] text-beam-mid md:text-4xl">
                {holds} of {decisions.length} hold
              </p>
              <p className="mt-2 font-mono text-[13px] leading-[20px] text-beam-dim">
                {queued === 0
                  ? "No orders queued for the next open."
                  : `${queued} of ${decisions.length} queued an order for the next open.`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecentActivity({ rows, drawn, instant }: { rows: RecentRow[] | null; drawn: boolean; instant: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="font-mono text-lg font-semibold tracking-[0.12em] text-beam-hot">RECENT SIMULATED ACTIVITY</h3>
        <span className="etched border border-beam-ghost px-2 py-0.5 text-[11px] text-beam-mid">simulated</span>
      </div>
      {rows && rows.length > 0 && (
        <p className="mt-3 font-mono text-[13px] leading-[20px] text-beam-dim">
          Latest {rows.length} SPY {SPY.variant} full-history backtest fills, {month(rows[0].ts)} to {month(rows[rows.length - 1].ts)}. Hypothetical next-open fills.
        </p>
      )}
      {rows && rows.length > 0 && <LedgerTimeline rows={rows} drawn={drawn} instant={instant} />}
      <div
        className={`mt-6 overflow-x-auto overscroll-x-contain ${drawn ? "anno-in" : ""}`}
        tabIndex={0}
        aria-label="Recent simulated SPY backtest fills"
      >
        <div className="min-w-[580px]">
          <div className={`grid ${ROW_COLS} gap-3 border-b border-beam-ghost/70 pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-beam-dim`} aria-hidden="true">
            <span>Date</span><span>Side</span><span>Reason</span><span className="text-right">Account %</span><span className="text-right">ETF quote / lot</span>
          </div>
          {rows === null && <div className="etched py-8 text-beam-dim">reading the backtest log…</div>}
          {rows?.length === 0 && <div className="etched py-8 text-beam-dim">backtest activity unavailable</div>}
          {rows?.map((row, index) => {
            const sell = row.side === "sell";
            const small = row.account_pct != null && Math.abs(row.account_pct) < SMALL_ORDER_PCT;
            return (
              <div
                key={`${row.ts}-${index}`}
                className={`anno grid ${ROW_COLS} gap-3 whitespace-nowrap border-b border-beam-ghost/30 py-[5px] font-mono text-[13px] leading-[20px] tabular-nums ${small ? "opacity-55" : ""}`}
                style={{ "--anno-delay": `${index * 55}ms` } as React.CSSProperties}
              >
                <span className="text-beam-dim">{date(row.ts)}</span>
                <span className={sell ? "font-semibold text-accent" : "font-semibold text-beam-mid"}>{row.side}</span>
                <span className={`truncate ${sell ? "text-accent" : "text-beam-dim"}`}>{sell ? trimName(row.label) : engineName(row.label)}</span>
                <span className="text-right text-beam-mid">{formatPercent(row.account_pct, 2)}<span className="sr-only"> of account</span></span>
                <span className="text-right text-beam-dim">
                  {sell
                    ? <>{formatPercent(row.lot_return_pct, 1)} lot<span className="sr-only"> return</span></>
                    : <>{quote(row.price)}<span className="sr-only"> ETF quote</span></>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-4 font-mono text-[12px] leading-[20px] text-beam-dim">
        Account % = simulated order size as a percent of the simulated account, not a return.
      </p>
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
        <p className="etched mt-4 mb-12 text-beam-dim">Two kinds of evidence, kept apart: the latest EOD decision per fund, and simulated SPY backtest fills.</p>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-0">
          <div className="min-w-0 lg:pr-10">
            <LatestDecision drawn={drawn} />
          </div>

          <div className="min-w-0 border-t border-beam-ghost/60 pt-12 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <RecentActivity rows={rows} drawn={drawn} instant={instant} />

            <div className="mt-8 flex flex-col items-start gap-4">
              <Link
                href={`/lab/${SPY.reportKey}`}
                className={`kf-stamp ${drawn ? "stamped" : ""} text-[12px] transition-colors md:text-[13px] hover:border-accent hover:brightness-125`}
                style={{ animationDelay: instant ? "0ms" : "900ms" }}
                aria-label={`Open the full SPY ${SPY.variant} backtest report`}
              >
                BACKTEST · SPY DAILY · {SPY.variant.toUpperCase()} · SIMULATED NEXT-OPEN FILLS
              </Link>
              <div className="etched text-beam-dim">
                EOD {generated.slice(0, 10)} · <Link href={`/lab/${SPY.reportKey}`} className="inline-flex min-h-[44px] items-center hover:text-beam-mid sm:min-h-[24px]">full report →</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
