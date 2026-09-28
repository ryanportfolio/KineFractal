// Types + helpers for the /lab benchmark report pages.
// Data is fetched at runtime from /fearlab/<key>.json (copied from the range
// repo's dashboard/site output). One file per fund-timeframe-window combo.

// LEGACY namespace: only the replay-cast filename (public/fearlab/casts/
// spy-1d-v3.8.json, consumed by the hidden storage-sweep + the legacy boot
// sequence) still lives on this generation. Everything current derives its
// keys from data/fearlab-board.ts DEPLOY (per-fund variants) or the LIVE
// board. Never render this as the engine version — that's useEngineLabel()
// (hooks/use-fearlab-live.ts, live board `variant`).
export const ENGINE_VARIANT = "v3.8";

export interface CurvePt { t: number; s: number; b: number }
export interface DdPt { t: number; s: number; b: number }
export interface InvPt { t: number; v: number }
export interface YearRow { y: number; partial?: boolean; spnl: number; spct: number; bpct: number; edge: number; contrib: number }
export interface MonthRow { y: number; m: number; s: number; b: number }
export interface AttribRow {
  eng: string; buys: number;
  buy_flow_pct: number; return_contrib_pp: number;
  // Retained in the artifact for internal/backward compatibility. Public lab
  // views use only the normalized fields above.
  usd_in?: number; realized?: number; open_pnl?: number; open_usd?: number;
}
export interface RecentRow {
  ts: number; side: "buy" | "sell"; label: string; n: number;
  account_pct: number | null; lot_return_pct: number | null;
  // A quoted ETF execution price is scale-independent and may be displayed.
  price: number | null;
  qty?: number; usd?: number;
}

export interface LabReport {
  key: string; sym: string; tf: string; start: string; label: string;
  variant?: string; // engine generation, e.g. "v3.8"
  window: { start: string; end: string };
  generated: string; lastBar: number;
  headline: {
    ret: number; bench_ret: number; edge_pp: number | null;
    irr: number; bench_irr: number; dd: number; bench_dd: number;
    trades: number; money_in: number; final_equity: number; net_pnl: number;
    realized_pnl: number; win_rate: number; profit_factor: number | null;
    open_lots: number; exposure_end: number; exposure_avg: number; cash_end: number;
  };
  fear: { on: boolean; floorPct: number; power: number; minPct: number; maxPct: number; confluence: boolean; nowPct: number | null };
  curve: CurvePt[]; curveBasis: "cash_flow_adjusted";
  drawdown: DdPt[]; invested: InvPt[];
  yearly: YearRow[]; monthly: MonthRow[];
  yearlyBasis: "flat" | "carried";
  attribution: AttribRow[]; trimTags: Record<string, number>;
  recent: RecentRow[]; cards: [string, string][];
}

export interface BoardRow {
  key: string; sym: string; tf: string; start: string; label: string;
  window: string; ret: number; bench_ret: number; edge_pp: number | null;
  dd: number; trades: number; last_bar: number;
}
export interface StartCohortRow {
  year: number;
  start: string;
  end: string;
  strategy_pct: number;
  benchmark_pct: number;
  edge_pp: number;
}
export interface StartCohorts {
  basis: "cohort_flat";
  symbol: "SPY";
  tf: "1d";
  preset: string;
  rows: StartCohortRow[];
}
export interface Board {
  generated: string;
  variant?: string; // engine generation the board was emitted for
  aux: { name: string; ts: number; warn: number; date: string }[];
  startCohorts: StartCohorts;
  combos: BoardRow[];
}

export const TF_LABEL: Record<string, string> = { "1d": "daily", "2h": "2-hour", "4h": "4-hour" };
export const SYM_NAME: Record<string, string> = { SPY: "S&P 500", QQQ: "Nasdaq 100", IWM: "Small caps" };

// Short marker codes used by the `recent` log and chart markers (F, RD, OP, T1…).
// These are a different vocabulary than the attribution engine names below.
const BUY_CODE: Record<string, string> = {
  F: "Fear buy (main)", RD: "Redeploy recycled cash", OP: "Opportunistic dip buy",
  SMC: "Level buy (smart money)", Z: "Z-score buy", P: "Percentile buy",
};
const SELL_CODE: Record<string, string> = {
  TR: "Trailing harvest", HO: "Breadth omen", CR: "Credit stress", PB: "Narrow leadership",
  DX: "Dollar shock", SX: "Semis-leadership fade", DJ: "Transports fade", VB: "Volume blow-off",
  TX: "Technical exit", SL: "Hard stop",
};

// Plain-language names for the buy engines — the report uses terse internal codes
// ("Opp Sniper", or short "OP"); nobody outside the lab knows what they mean.
export function engineName(eng: string): string {
  if (BUY_CODE[eng]) return BUY_CODE[eng];
  if (/^T\d$/.test(eng)) return "Fear buy (tier)";
  if (/^L\d$/.test(eng) || /^B\d$/.test(eng)) return "Level buy";
  const e = eng.toLowerCase();
  if (e.startsWith("fav")) return "Fear buy (main)";
  if (e.startsWith("fear")) return "Fear buy (legacy tier)";
  if (e.startsWith("redeploy")) return "Redeploy recycled cash";
  if (e.startsWith("opp")) return "Opportunistic dip buy";
  if (e.startsWith("smc")) return "Level buy (smart money)";
  if (/^l\d/.test(e)) return "Level buy";
  return eng;
}

// Plain-language names for the exit tags / sell codes that closed trades.
export function trimName(tag: string): string {
  if (SELL_CODE[tag]) return SELL_CODE[tag];
  if (/^G\d$/.test(tag)) return "Profit ladder";
  if (/^Z[\d.]*\*?$/.test(tag)) return "Extension ladder";
  const t = tag.toLowerCase();
  if (t.includes("protect") || t.includes("reclaim")) return "Protective exit";
  if (t.includes("sox") || t.includes("semi")) return "Semis-leadership fade";
  if (t.includes("trans") || t.includes("djt")) return "Transports fade";
  if (t.includes("part") || t.includes("rsp")) return "Narrow leadership";
  if (t.includes("cred") || t.includes("hyg")) return "Credit stress";
  if (t.includes("dollar") || t.includes("dxy")) return "Dollar shock";
  if (t.includes("ipo") || t.includes("spec")) return "Speculation cooling";
  if (t.includes("tip") || t.includes("infl")) return "Inflation jump";
  if (t.includes("hind") || t.includes("omen") || t.includes("breadth")) return "Breadth omen";
  if (t.includes("blow") || t.includes("vol")) return "Volume blow-off";
  if (t.includes("trail")) return "Trailing harvest";
  if (t.includes("greed")) return "Profit ladder";
  if (/z[\d.]/.test(t)) return "Extension ladder";
  return tag;
}

export const fmtPct = (n: number | null, d = 1) => n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
export const fmtPp = (n: number | null, d = 1) => n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}`;
export function fmtMoney(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${sign}$${a.toFixed(0)}`;
}
export const fmtMoneyFull = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

// ---- Live API (bucket-backed) with static-snapshot fallback -----------------
// The server proxies the nightly worker artifacts from the Railway bucket via
// /api/fearlab/*. Every response carries a freshness envelope {live, stale,
// age_hours}. When the API is down / env-less (dev without bucket creds) we
// fall back to the static /fearlab/*.json snapshot files, so the UI renders
// identically offline. Do NOT delete the static files — they are the fallback.
export interface LiveMeta { live: boolean; stale: boolean; age_hours: number | null }
export interface LiveResult<T> { data: T; meta: LiveMeta }

const STATIC_META: LiveMeta = { live: false, stale: true, age_hours: null };

// Unwrap the {live, stale, age_hours} envelope. Tolerates both a nested
// payload ({..., data: {...}}) and envelope fields spread alongside the data.
function unwrapEnvelope<T>(j: any, looksRight: (d: any) => boolean): LiveResult<T> | null {
  const meta: LiveMeta = {
    live: j?.live !== false,
    stale: j?.stale === true,
    age_hours: typeof j?.age_hours === "number" ? j.age_hours : null,
  };
  const data = j?.data ?? j;
  return looksRight(data) ? { data: data as T, meta } : null;
}

async function fetchLive<T>(
  apiPath: string,
  staticPath: string,
  looksRight: (d: any) => boolean,
  errMsg: string,
): Promise<LiveResult<T>> {
  try {
    const r = await fetch(apiPath);
    if (r.ok) {
      const out = unwrapEnvelope<T>(await r.json(), looksRight);
      if (out) return out;
    }
  } catch { /* API unreachable — fall through to the static snapshot */ }
  const r = await fetch(staticPath);
  if (!r.ok) throw new Error(errMsg);
  const data = await r.json();
  if (!looksRight(data)) throw new Error(errMsg);
  return { data: data as T, meta: STATIC_META };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const textValue = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const objectValue = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const finiteFields = (v: Record<string, any>, fields: readonly string[]) => fields.every((k) => finite(v[k]));
const nullableFinite = (v: unknown) => v === null || finite(v);
const points = (v: unknown, fields: readonly string[], allowEmpty = true) =>
  Array.isArray(v) && (allowEmpty || v.length > 0)
  && v.every((row) => objectValue(row) && finiteFields(row, fields));

// Reports generated before the percentage-only public contract contain raw
// account equity and dollar attribution. Reject them instead of silently
// drawing those values as percentages. fetchLive then tries the regenerated
// static snapshot; if that is old too, the page uses its controlled error UI.
function isNormalizedReport(d: any): d is LabReport {
  if (!objectValue(d)) return false;
  if (!["key", "sym", "tf", "start", "label", "generated"].every((k) => textValue(d[k]))) return false;
  if (d.variant != null && !textValue(d.variant)) return false;
  if (!finite(d.lastBar) || !objectValue(d.window)
      || !textValue(d.window.start) || !textValue(d.window.end)) return false;

  if (!objectValue(d.headline)
      || !finiteFields(d.headline, [
        "ret", "bench_ret", "irr", "bench_irr", "dd", "bench_dd", "trades",
        "money_in", "final_equity", "net_pnl", "realized_pnl", "win_rate",
        "open_lots", "exposure_end", "exposure_avg", "cash_end",
      ])
      || !nullableFinite(d.headline.edge_pp)
      || !nullableFinite(d.headline.profit_factor)) return false;

  if (!objectValue(d.fear) || typeof d.fear.on !== "boolean"
      || typeof d.fear.confluence !== "boolean"
      || !finiteFields(d.fear, ["floorPct", "power", "minPct", "maxPct"])
      || !nullableFinite(d.fear.nowPct)) return false;

  if (d.curveBasis !== "cash_flow_adjusted") return false;
  if (d.yearlyBasis !== "flat" && d.yearlyBasis !== "carried") return false;
  if (!points(d.curve, ["t", "s", "b"], false)
      || !points(d.drawdown, ["t", "s", "b"])
      || !points(d.invested, ["t", "v"])) return false;
  if (!Array.isArray(d.yearly) || !d.yearly.every((r: any) =>
    objectValue(r) && finiteFields(r, ["y", "spnl", "spct", "bpct", "edge", "contrib"])
    && (r.partial == null || typeof r.partial === "boolean"))) return false;
  if (!points(d.monthly, ["y", "m", "s", "b"])) return false;
  if (!Array.isArray(d.attribution)
      || !d.attribution.every((r: any) => objectValue(r) && textValue(r.eng)
        && finiteFields(r, ["buys", "buy_flow_pct", "return_contrib_pp"]))) return false;
  if (!objectValue(d.trimTags) || !Object.values(d.trimTags).every(finite)) return false;
  if (!Array.isArray(d.recent) || !d.recent.every((r: any) =>
    objectValue(r) && finiteFields(r, ["ts", "n"]) && textValue(r.label)
    && (r.side === "buy" || r.side === "sell")
    && nullableFinite(r.account_pct) && nullableFinite(r.lot_return_pct)
    && nullableFinite(r.price))) return false;
  if (!Array.isArray(d.cards) || !d.cards.every((r: any) =>
    Array.isArray(r) && r.length === 2 && typeof r[0] === "string" && typeof r[1] === "string")) return false;
  return true;
}

export function fetchReportLive(key: string): Promise<LiveResult<LabReport>> {
  return fetchLive<LabReport>(
    `/api/fearlab/combo/${encodeURIComponent(key)}`,
    `/fearlab/${key}.json`,
    isNormalizedReport,
    `no report for ${key}`,
  );
}
export function fetchBoardLive(): Promise<LiveResult<Board>> {
  return fetchLive<Board>(
    "/api/fearlab/board",
    "/fearlab/board.json",
    (d) => objectValue(d) && Array.isArray(d.combos) && objectValue(d.startCohorts)
      && d.startCohorts.basis === "cohort_flat"
      && d.startCohorts.symbol === "SPY" && d.startCohorts.tf === "1d"
      && textValue(d.startCohorts.preset)
      && Array.isArray(d.startCohorts.rows) && d.startCohorts.rows.length > 0
      && d.startCohorts.rows.every((row: any) => objectValue(row)
        && finiteFields(row, ["year", "strategy_pct", "benchmark_pct", "edge_pp"])
        && textValue(row.start) && textValue(row.end)),
    "no board",
  );
}

// Strip a trailing engine-version suffix ("-v4.2") off a combo key.
const keyStem = (key: string): string => key.replace(/-v[\d][\w.]*$/, "");

// A reportKey baked into the static snapshot pins a version ("iwm-1d-full-v4.2")
// that a deploy flip leaves behind (IWM -> v4.7). The live worker renames the
// combo, so /api/fearlab/combo/<stale-key> 404s and fetchLive would silently
// serve the stale static file. Resolve the baked key to the LIVE board's current
// key for the same sym/tf/window first, so a version flip auto-heals the site the
// night the worker republishes — no repo change needed. Board unreachable / no
// match -> the original key (offline still renders its last-baked snapshot).
async function resolveDeployKey(key: string): Promise<string> {
  const stem = keyStem(key);
  if (stem === key) return key; // not a version-suffixed key
  try {
    const board = await fetchBoardCached();
    const hit = board.combos.find((c) => keyStem(c.key) === stem);
    return hit?.key ?? key;
  } catch {
    return key;
  }
}

export async function fetchReport(key: string): Promise<LabReport> {
  return (await fetchReportLive(await resolveDeployKey(key))).data;
}
export async function fetchBoard(): Promise<Board> {
  return (await fetchBoardLive()).data;
}

// Cached variants — one fetch per page load, shared by the terminal, the fear
// gauge, and anything else that reads the same static EOD assets.
const reportCache = new Map<string, Promise<LabReport>>();
export function fetchReportCached(key: string): Promise<LabReport> {
  let p = reportCache.get(key);
  if (!p) {
    p = fetchReport(key).catch((e) => { reportCache.delete(key); throw e; });
    reportCache.set(key, p);
  }
  return p;
}
let boardCache: Promise<Board> | null = null;
export function fetchBoardCached(): Promise<Board> {
  boardCache ??= fetchBoard().catch((e) => { boardCache = null; throw e; });
  return boardCache;
}

// 43 -> "43rd", 60 -> "60th" — for fear percentiles.
export function ord(n: number): string {
  const v = Math.round(n), t = v % 10, h = v % 100;
  return `${v}${h >= 11 && h <= 13 ? "th" : t === 1 ? "st" : t === 2 ? "nd" : t === 3 ? "rd" : "th"}`;
}
