// FearLab board data — offline fallback for the DEPLOYED engine cells (all
// daily, per-cell variants). The live worker board at /api/fearlab/* overlays
// these at runtime, so this snapshot only has to be right, not fresh.
//
// The per-fund DATA (variant, reportKey, featured window, recent years) is
// MACHINE-GENERATED into ./fearlab-snapshot.generated.json by
// scripts/regen_fearlab_snapshot.py — never hand-edit it, and never hardcode a
// version literal in this file (that is how the site stranded on IWM v4.2 after
// the v4.7 flip). Regen derives everything from the live board + the engine's
// bridge/cells.py DEPLOY_CELLS, so a deploy flip flows through automatically.
// Editorial labels (fund name, timeframe label) stay hand-authored via
// SYM_NAME / TF_LABEL. The fearlab-snapshot-sync test fails if a version here
// drifts from cells.py.
//
// User-facing edge = strat return minus buy-and-hold return, in percentage
// points (ret - bench_ret). The internal wealth-ratio `edge` field is
// intentionally NOT shown.
import snapshot from "./fearlab-snapshot.generated.json";
import { SYM_NAME, TF_LABEL } from "./lab-data";

export const BOARD_GENERATED: string = snapshot.generated;

export type BoardCombo = {
  sym: string;
  tf: string;
  label: string; // window label: "Full", "2024", ...
  window: string; // ISO date range
  ret: number; // strategy total return %, money-weighted on contributions
  bench_ret: number; // same-flow buy-and-hold total return %
  irr: number; // strategy XIRR %
  bench_irr: number; // buy-and-hold XIRR %
  dd: number; // strategy max drawdown %
  trades: number;
};

// Each symbol's deployed cell. All three funds deploy on the DAILY timeframe
// (the 2h/4h cells were archived to charts-only in the v4 era); `variant` is
// that fund's shipped engine generation and suffixes every artifact key.
export type DeploySymbol = {
  sym: string;
  name: string;
  variant: string; // deployed engine generation for this fund, e.g. "v4.6"
  reportKey: string; // /lab/<key> report for the featured (full) window
  tf: string; // deploy timeframe
  tfLabel: string; // human label
  sinceYear: string; // start of the featured window
  full: BoardCombo; // featured-window deploy combo
  years: BoardCombo[]; // recent per-year rows (deploy TF)
};

// Helper: user-facing edge in pp.
export const edgePp = (c: { ret: number; bench_ret: number }) =>
  c.ret - c.bench_ret;

// Shape of each fund row in fearlab-snapshot.generated.json (regen output).
type SnapshotFund = {
  sym: string;
  variant: string;
  reportKey: string;
  tf: string;
  sinceYear: string;
  full: BoardCombo;
  years: BoardCombo[];
};

// DEPLOY = generated data + hand-authored editorial labels. A deploy flip only
// requires re-running regen (which rewrites the JSON); nothing here changes.
export const DEPLOY: DeploySymbol[] = (snapshot.funds as SnapshotFund[]).map((f) => ({
  sym: f.sym,
  name: SYM_NAME[f.sym] ?? f.sym,
  variant: f.variant,
  reportKey: f.reportKey,
  tf: f.tf,
  tfLabel: TF_LABEL[f.tf] ?? f.tf,
  sinceYear: f.sinceYear,
  full: f.full,
  years: f.years,
}));

// ---- The algorithm ---------------------------------------------------------
// Core engine: buy when the Williams VIX Fix (fear read from price, no VIX
// feed) crosses a per-fund floor, sized up the fund's policy curve. The LIVE
// parameters (floor, curve shape, size caps) ship inside each report JSON's
// `fear` block and are consumed at runtime via useFearState — nothing here
// hardcodes them, so a re-tuned deploy can't go stale on this page.
//
// Trim battery: independent macro-stress gauges; each fires only while the
// fund is still above its 50-day-ago price (trims into strength, not panic).
// The rows below are the plain-language descriptions of WHAT each gauge
// watches — which gauges actually fired, and how often, is read live from
// each report's trimTags at runtime.
export type TrimInfo = { name: string; watches: string };
export const TRIM_INFO: TrimInfo[] = [
  { name: "Extension ladder", watches: "price stretches far above its volatility band, tier by tier" },
  { name: "Trailing harvest", watches: "a profitable lot's trailing stop locks in the gain" },
  { name: "Protective exit", watches: "price breaks its long-term protection line; lots step aside until it reclaims" },
  { name: "Profit ladder", watches: "gains reach set rungs; each rung sells a slice" },
  { name: "Breadth omen", watches: "new highs and new lows both spike while breadth turns negative" },
  { name: "Credit stress", watches: "high-yield bonds (HYG) fall against treasuries" },
  { name: "Dollar shock", watches: "the dollar index (DXY) jumps to an extreme" },
  { name: "Narrow leadership", watches: "the equal-weight S&P (RSP) lags the index" },
  { name: "Semis-leadership fade", watches: "semiconductors (SOX) stop leading the market" },
  { name: "Transports fade", watches: "transports (DJT) stop leading the market" },
  { name: "Inflation jump", watches: "inflation-protected bonds (TIP) fall against treasuries" },
  { name: "Speculation cooling", watches: "the IPO index rolls over against the S&P" },
  { name: "Volume blow-off", watches: "a climactic volume spike into new highs" },
];
