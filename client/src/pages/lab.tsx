// /lab — THE BOARD. Every fund vs buy & hold, every window, in the scope's
// own register: darkness, hairlines, ramp-colored numerals. No cards, no
// glass — each cell is a bare block between graticule rules. Live board.json
// with the static snapshot as fallback; a stale artifact says so out loud.
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { BeamHeading } from "@/components/beam-heading";
import {
  fmtPct, fmtPp, TF_LABEL, SYM_NAME, type BoardRow,
} from "@/data/lab-data";
import { useBoard } from "@/hooks/use-fearlab-live";
import { useDocumentMeta } from "@/hooks/use-document-meta";

const SYM_ORDER = ["SPY", "QQQ", "IWM"];
const shortDate = (ymd: string) => { const p = ymd.split("-"); return `${+p[1]}/${p[0].slice(2)}`; };

export default function LabBoard() {
  // Live board via /api/fearlab/board (static /fearlab/board.json fallback
  // baked into the hook). `stale` / `age_hours` come from the API envelope.
  const { board, live, stale, age_hours } = useBoard();
  const [start, setStart] = useState("full");

  useDocumentMeta({
    title: "The board",
    description:
      "Labeled backtests for SPY, QQQ and IWM across every start-year window, strategy versus buy & hold. Educational only.",
  });

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const starts = useMemo(() => {
    if (!board) return ["full"];
    const seen = new Set<string>();
    board.combos.forEach((c) => seen.add(c.start));
    const arr = Array.from(seen);
    arr.sort((a, b) => (a === "full" ? -1 : b === "full" ? 1 : +a - +b));
    return arr;
  }, [board]);

  return (
    <>
      <Navbar />
      <main className="relative bg-background text-foreground overflow-x-clip pt-[52px]">
        <div className="absolute inset-0 graticule opacity-25 pointer-events-none" aria-hidden="true" />
        <div className="relative px-5 md:px-10 py-16 max-w-6xl mx-auto">
          <div className="etched text-beam-dim mb-2" aria-hidden="true">the board</div>
          <div className="max-w-[900px] mb-3">
            <BeamHeading text="EVERY FUND VS HOLDING" as="h1" instant />
          </div>
          <p className="etched mb-2 max-w-[70ch]">
            each block: how far the strategy beat simply owning the fund · same deposits, same
            window · open any block for the full report
          </p>
          <div className="etched text-beam-dim mb-8 tabular-nums">
            {board
              ? `EOD ${board.generated.slice(0, 10)}${live ? "" : " · static snapshot (live feed unreachable)"}`
              : "loading the board…"}
            {stale && age_hours != null && (
              <span className="text-accent"> · artifact {Math.round(age_hours)}h old · treat as history, not today</span>
            )}
          </div>

          {/* start-window selector — etched year stops on one rule */}
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-beam-ghost/60 pb-3">
            <span className="etched text-beam-dim">since</span>
            {starts.map((s) => (
              <button
                key={s}
                onClick={() => setStart(s)}
                aria-pressed={start === s}
                className={`etched transition-colors ${
                  start === s
                    ? "text-beam-hot border-b-2 border-beam-hot pb-0.5"
                    : "text-beam-dim hover:text-beam-mid"
                }`}
              >
                {s === "full" ? "all history" : s}
              </button>
            ))}
          </div>

          {!board ? (
            <p className="etched text-beam-dim mt-10">loading the board…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-10 mt-10">
              {SYM_ORDER.filter((s) => board.combos.some((c) => c.sym === s)).map((sym) => (
                <SymCol key={sym} sym={sym} rows={board.combos.filter((c) => c.sym === sym && c.start === start)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function SymCol({ sym, rows }: { sym: string; rows: BoardRow[] }) {
  const order = ["1d", "2h", "4h"];
  const sorted = rows.slice().sort((a, b) => order.indexOf(a.tf) - order.indexOf(b.tf));
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between border-b border-beam-ghost/60 pb-2">
        <span className="font-mono text-2xl font-semibold text-beam-mid tracking-tight">{sym}</span>
        <span className="etched text-beam-dim">{SYM_NAME[sym]}</span>
      </div>
      {sorted.length === 0 && (
        <div className="etched text-beam-dim py-4">no window from this start</div>
      )}
      {sorted.map((c) => <Cell key={c.key} c={c} />)}
    </div>
  );
}

function Cell({ c }: { c: BoardRow }) {
  const ahead = c.edge_pp != null && c.edge_pp >= 0;
  return (
    <Link
      href={`/lab/${c.key}`}
      className="group block py-5 border-b border-beam-ghost/40 hover:border-beam-dim transition-colors"
    >
      <div className="flex items-baseline justify-between">
        <span className="etched text-beam-mid font-semibold">{TF_LABEL[c.tf] || c.tf}</span>
        <span className="etched text-beam-dim">since {shortDate(c.window.split("..")[0])}</span>
      </div>
      <div
        className={`font-mono font-semibold tabular-nums leading-none mt-3 text-4xl ${
          ahead ? "text-beam-hot" : "text-accent"
        }`}
        style={ahead ? { textShadow: "0 0 14px hsl(var(--beam-mid) / 0.35)" } : undefined}
      >
        {fmtPp(c.edge_pp)}
        <span className="etched text-beam-dim font-normal ml-2">vs hold</span>
      </div>
      <div className="etched mt-3 tabular-nums">
        {/* board.v1 types ret/bench_ret/dd nullable — a live run can miss a metrics leg */}
        <span className={c.ret != null && c.ret < 0 ? "text-accent" : "text-beam-mid"}>{fmtPct(c.ret)}</span>
        <span className="text-beam-dim"> vs {fmtPct(c.bench_ret)}</span>
        <span className="text-beam-dim"> · dd {c.dd == null ? "n/a" : `${c.dd.toFixed(0)}%`}</span>
      </div>
      <div className="etched text-beam-dim mt-2 group-hover:text-beam-mid transition-colors">
        {c.trades.toLocaleString()} trades · open report →
      </div>
    </Link>
  );
}
