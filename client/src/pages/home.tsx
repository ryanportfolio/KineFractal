// Home — THE SIGNAL. Six movements on one storage oscilloscope.
//
//   1 IGNITION   the beam ignites, weaves the brand Lissajous from today's
//                real fear, then sweeps the SPY drawdown history
//   2 VERDICT    three scope channels: strategy trace vs benchmark ghost
//   3 STRATEGY   SPY monthly grid (faint-tint numbers), per-year strategy vs
//                dashed buy & hold bars, edge in pp, selected-year readout
//   4 MECHANISM  how it buys: shared-scale fear rails, one sizing curve at a
//                time with fund tabs; how it sells: trim / exit / watch
//                markets groups with schematic sketches
//   5 REPLAY     SPY simulated 2020 episode, then the rulebook cycle wheel
//                with a when / then / limits panel and a fund switch
//   6 RECORD     latest EOD decision beside simulated activity: a timeline
//                (tick height = % of account), single-line rows, the stamp
//
// A scope has one beam: the scheduler guarantees only one movement animates
// at a time. No cards, no glass, no idle glow — darkness, hairlines, light.
// Every animated value comes from board.json, a report JSON, the replay cast
// or the live fear state. See DESIGN.md.
import { useEffect, useMemo, useState } from "react";
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

// ---- /#rulebook ------------------------------------------------------------
// The rulebook sits behind Defer, so a link or a direct load of /#rulebook
// finds no target. When the hash names it, the sections down to it mount at
// once and the page scrolls there, re-aiming while the sections above it
// finish sizing, until the reader scrolls themselves.
function useRulebookHash(): boolean {
  const read = () => typeof window !== "undefined" && window.location.hash === "#rulebook";
  // bumps on every arrival at #rulebook, including a same-page link click
  // (wouter navigates with pushState, which fires no hashchange: it dispatches
  // its own "pushState" / "replaceState" events instead)
  const [visit, setVisit] = useState(() => (read() ? 1 : 0));
  const on = visit > 0;
  useEffect(() => {
    const onNav = () => { if (read()) setVisit((n) => n + 1); };
    const evs = ["hashchange", "popstate", "pushState", "replaceState"];
    evs.forEach((e) => window.addEventListener(e, onNav));
    return () => evs.forEach((e) => window.removeEventListener(e, onNav));
  }, []);
  useEffect(() => {
    if (!visit) return;
    let stopped = false;
    const stop = () => { stopped = true; };
    const opts = { passive: true, once: true } as const;
    window.addEventListener("wheel", stop, opts);
    window.addEventListener("touchstart", stop, opts);
    window.addEventListener("pointerdown", stop, opts);
    window.addEventListener("keydown", stop, { once: true });
    // The section's top goes 1 px above the viewport, not to its scroll margin:
    // with any sliver of the gauges above still on screen the beam scheduler
    // ties them with this tall section and the rulebook never draws. Its own
    // top padding keeps the "05" heading clear of the navbar.
    let focused = false;
    const aim = () => {
      const el = document.getElementById("rulebook");
      if (!stopped && el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 1);
      // keyboard and screen-reader users land in the rulebook too, once it exists
      if (el && !focused) {
        focused = true;
        if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
        el.focus({ preventScroll: true });
      }
    };
    // keep aiming while the sections above it load and size (a slow report
    // can swap a short placeholder for a tall table seconds later): stop only
    // when the reader takes over, the hash no longer names it (Back), or 10 s
    // have passed. aim() does nothing while the target is already in place.
    const t0 = performance.now();
    const timer = setInterval(() => {
      if (stopped || window.location.hash !== "#rulebook" || performance.now() - t0 > 10000) { clearInterval(timer); return; }
      const el = document.getElementById("rulebook");
      if (el && Math.abs(el.getBoundingClientRect().top + 1) >= 1) aim();
    }, 150);
    aim();
    const onBack = () => { if (window.location.hash !== "#rulebook") stop(); };
    window.addEventListener("popstate", onBack);
    window.addEventListener("hashchange", onBack);
    return () => {
      clearInterval(timer);
      window.removeEventListener("popstate", onBack);
      window.removeEventListener("hashchange", onBack);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [visit]);
  return on;
}

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
  const toRulebook = useRulebookHash();
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
        <Defer eager={toRulebook}><VerdictChannels deploy={deploy} /></Defer>
        {/* StorageSweep ("33 years in 60 seconds") hidden for now per request —
            re-enable by restoring <StorageSweep /> here */}
        <Defer eager={toRulebook}><SpyMonthlyRecord /></Defer>
        <Defer eager={toRulebook}><ArmingGauges /></Defer>
        <Defer eager={toRulebook}><Rulebook /></Defer>
        <Defer><LedgerSection generated={generated} /></Defer>
      </main>
    </>
  );
}
