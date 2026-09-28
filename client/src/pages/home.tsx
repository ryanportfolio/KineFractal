// Home — THE SIGNAL. Six movements on one storage oscilloscope.
//
//   1 IGNITION   the beam ignites, weaves the brand Lissajous from today's
//                real fear, then sweeps the SPY drawdown history
//   2 VERDICT    three scope channels: strategy trace vs benchmark ghost
//   3 STRATEGY   the SPY monthly record scanned in like television
//   4 MECHANISM  standing-wave fear gauges + the real sizing curves
//   5 REPLAY     SPY v4.6 stepped through a simulated 2020 episode
//   6 RECORD     latest EOD decisions, then recent simulated activity
//
// A scope has one beam: the scheduler guarantees only one movement animates
// at a time. No cards, no glass, no idle glow — darkness, hairlines, light.
// Every animated value comes from board.json, a report JSON, the replay cast
// or the live fear state. See DESIGN.md.
import { useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { HeroSignal } from "@/components/hero-signal";
import { VerdictChannels } from "@/components/verdict-channels";
import { SpyMonthlyRecord } from "@/components/spy-monthly-record";
import { ArmingGauges } from "@/components/arming-gauges";
import { LedgerSection } from "@/components/ledger-section";
import { Rulebook } from "@/components/rulebook";
import { Defer } from "@/components/defer";
import { type BoardRow } from "@/data/lab-data";
import { useBoard } from "@/hooks/use-fearlab-live";
import {
  DEPLOY,
  BOARD_GENERATED,
} from "@/data/fearlab-board";

// ---- Live board overlay -----------------------------------------------------
// The static snapshot renders instantly; once board.json lands, its live
// numbers replace the snapshot so the homepage stays 1-to-1 with the board.
type LiveBoard = {
  get: (key: string) => BoardRow | undefined;
  generated: string | null;
};

function useLiveBoard(): LiveBoard {
  // Live board via /api/fearlab/board (static /fearlab/board.json fallback
  // inside the hook); board undefined while loading / fully offline — the
  // static snapshot keeps rendering either way.
  const { board } = useBoard();
  const map = useMemo(() => {
    if (!board) return null;
    const m = new Map<string, BoardRow>();
    for (const c of board.combos) {
      m.set(c.key, c);
      // The live worker board carries per-cell variants (v4.6/v4.2/...) —
      // also index by the variant-less prefix so the overlay still joins
      // when a deployed variant moves ahead of this repo's snapshot keys.
      const vless = `${c.sym.toLowerCase()}-${c.tf}-${c.start}`;
      if (!m.has(vless)) m.set(vless, c);
    }
    return m;
  }, [board]);
  return {
    get: (k) => map?.get(k) ?? map?.get(k.replace(/-v[\d][\w.]*$/, "")),
    generated: board?.generated ?? null,
  };
}

// Per-fund variant (SPY v4.6, QQQ/IWM v4.2, ...) — the snapshot's key
// namespace; the variant-less index above absorbs future re-deploys.
const comboKey = (sym: string, tf: string, start: string, variant: string) =>
  `${sym.toLowerCase()}-${tf}-${start}-${variant}`;

function liveNums<T extends { ret: number; bench_ret: number; dd: number }>(
  c: T,
  key: string,
  board: LiveBoard,
): T {
  const r = board.get(key);
  if (!r) return c;
  // board.v1 types ret/bench_ret/dd as nullable (a metrics leg can be missing
  // in a live run) — this page's formatters/CountUp assume numbers, so keep
  // the static snapshot numbers when any leg is null.
  if (r.ret == null || r.bench_ret == null || r.dd == null) return c;
  const out: T = { ...c, ret: r.ret, bench_ret: r.bench_ret, dd: r.dd };
  if ("trades" in out) (out as { trades: number }).trades = r.trades;
  return out;
}

export default function Home() {
  const board = useLiveBoard();
  const deploy = DEPLOY.map((d) => ({
    ...d,
    full: liveNums(d.full, d.reportKey, board),
    years: d.years.map((y) => liveNums(y, comboKey(d.sym, d.tf, y.label, d.variant), board)),
  }));
  const generated = board.generated ?? BOARD_GENERATED;

  return (
    <>
      <Navbar />
      {/* overflow-x-CLIP, not hidden: hidden makes <main> a scroll container,
          which silently kills the sweep's position:sticky pin */}
      <main className="relative bg-background text-foreground overflow-x-clip">
        <HeroSignal />
        {/* Below-fold movements mount as they approach the viewport (Defer),
            so first paint builds only the hero. */}
        <Defer><VerdictChannels deploy={deploy} /></Defer>
        {/* StorageSweep ("33 years in 60 seconds") hidden for now per request —
            re-enable by restoring <StorageSweep /> here */}
        <Defer><SpyMonthlyRecord /></Defer>
        <Defer><ArmingGauges /></Defer>
        <Defer><Rulebook /></Defer>
        <Defer><LedgerSection generated={generated} /></Defer>
      </main>
    </>
  );
}
