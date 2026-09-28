// FearLab cloud artifact contracts — VENDORED TYPE MIRROR.
//
// Source of truth: the range repo's contracts/*.v1.schema.json
// (board.v1.schema.json, combo.v1.schema.json, signals.v1.schema.json,
// chart.v1.schema.json). The Railway worker publishes artifacts matching
// those schemas to the S3-compatible bucket; this file mirrors them as
// TypeScript so server routes and client consumers share one vocabulary.
// Do NOT extend these types with fields the worker does not emit — update
// the range contracts first, then re-mirror here.
//
// Contract rule (contracts README): every object is ADDITIVE-OPEN —
// producers may add fields at any time, consumers must tolerate unknown
// extras. Hence the `[extra: string]: unknown` index signatures. Fields
// typed `T | null` are nullable per schema; optional fields are additive.

// ---------------------------------------------------------------------------
// Shared envelope
// ---------------------------------------------------------------------------

/** Stamp fields present on every artifact. */
export interface FearlabEnvelope {
  /** Discriminator, e.g. "board.v1". */
  schema_version: string;
  /**
   * Production timestamp. UTC ISO-8601 ("YYYY-MM-DDTHH:MM:SSZ") on new
   * artifacts; legacy local-ET "YYYY-MM-DD HH:MM" (tz-less) accepted on old
   * ones. Staleness age must be computed from THIS field.
   */
  generated: string;
  /** Engine build identity: git short SHA or release tag of the range repo. */
  engine_tag: string;
}

/** latest.json pointer object (worker/store.py Store._pointer_meta). */
export interface LatestPointer {
  /** "YYYY-MM-DD" — the published run's trading session. */
  trading_date: string;
  /** UTC ISO-8601 publish timestamp. */
  generated: string;
  /**
   * Relative run prefix, "runs/<trading_date>". NOTE: excludes the bucket's
   * FEARLAB_S3_PREFIX env prefix — full key = env-prefix + "/" + prefix +
   * "/" + relpath.
   */
  prefix: string;
  [extra: string]: unknown;
}

// ---------------------------------------------------------------------------
// board.v1
// ---------------------------------------------------------------------------

/** One backtest cell row (board.v1 combos[] item). */
export interface BoardV1Combo {
  /** Cell key = combo file basename, e.g. "spy-1d-full-v4.6". */
  key: string;
  /** Ticker, uppercase. */
  sym: string;
  /** Bar timeframe: "1d" | "2h" | "4h" | "1h". */
  tf: string;
  /** Start-window tag: "full" or a year string ("2019"). */
  start: string;
  /** Display label ("Full", "2019"). */
  label: string;
  /** Per-cell engine variant label (cells diverge, e.g. SPY v4.6 vs QQQ v4.2). */
  variant: string;
  /** "YYYY-MM-DD..YYYY-MM-DD" simulated span. */
  window: string;
  /** Strategy net return % on money in. */
  ret: number | null;
  /** Buy-and-hold benchmark net return %. */
  bench_ret: number | null;
  /** ret - bench_ret, percentage points; null when either leg missing. */
  edge_pp: number | null;
  /** Strategy max drawdown %. */
  dd: number | null;
  /** Closed-trade count. */
  trades: number;
  /** Last simulated bar, epoch seconds UTC (optional additive). */
  last_bar?: number | null;
  [extra: string]: unknown;
}

/** Aux data-feed freshness row (board.v1 aux[] item). */
export interface BoardV1Aux {
  name: string;
  /** Last data point, epoch seconds UTC. */
  ts: number;
  /** Staleness warning threshold, days. */
  warn: number;
  /** "YYYY-MM-DD". */
  date: string;
  [extra: string]: unknown;
}

/** board.v1 — headline backtest board artifact (board/v1/board.json). */
export interface BoardV1 extends FearlabEnvelope {
  schema_version: "board.v1";
  /** OPTIONAL additive: underlying dashboard build stamp. Display-only. */
  data_generated?: string;
  /** DEPRECATED board-wide variant; read combos[].variant instead. */
  variant?: string;
  aux?: BoardV1Aux[];
  combos: BoardV1Combo[];
  [extra: string]: unknown;
}

// ---------------------------------------------------------------------------
// signals.v1
// ---------------------------------------------------------------------------

/** Regime posture enum (signals.v1 cells[].state). */
export type SignalState =
  | "long"
  | "break_pending"
  | "protect_broken"
  | "reclaim_pending"
  | "protect_off";

/** Armed buy-trigger band; an edge is null when undefined on this bar. */
export interface LevelBand {
  l: number | null;
  h: number | null;
  [extra: string]: unknown;
}

/** Next-open order intent (signals.v1 cells[].intents[] item, optional). */
export interface SignalIntent {
  signal_type: string;
  engine: string;
  side: "BUY" | "SELL";
  order_type: "MOO" | "MKT" | "LMT" | "STP";
  symbol?: string;
  trigger_px?: number | null;
  note?: string;
  [extra: string]: unknown;
}

/** One deploy cell's decision snapshot (signals.v1 cells[] item). */
export interface SignalCell {
  /** Cell name, e.g. "SPY-1d" (bear cells: preset key like "bear-spy-1d"). */
  cell_key: string;
  /** Primary traded ticker, uppercase. */
  symbol: string;
  tf: string;
  /** Deploy variant label — joins with board/combo combos[].variant. */
  variant: string;
  state: SignalState;
  /** Last cached close on the decision bar, USD. */
  price: number;
  /** Armed intraday buy-trigger bands l1..l3. */
  trigger_levels: { l1: LevelBand; l2: LevelBand; l3: LevelBand; [extra: string]: unknown };
  /** Confirmed daily signal bar, epoch seconds UTC. */
  as_of_bar: number;
  /** Absent = headline-only; empty = engine queued nothing. */
  intents?: SignalIntent[];
  [extra: string]: unknown;
}

/** signals.v1 — daily signal artifact (signals/v1/<date>.json + latest.json). */
export interface SignalsV1 extends FearlabEnvelope {
  schema_version: "signals.v1";
  /** "YYYY-MM-DD" — session the decisions were computed FROM. */
  trading_date: string;
  /** OPTIONAL additive: closed-bar gate flag; absent may be treated as true. */
  bar_closed?: boolean;
  cells: SignalCell[];
  [extra: string]: unknown;
}

// ---------------------------------------------------------------------------
// chart.v1
// ---------------------------------------------------------------------------

/** OHLCV bar, lightweight-charts item shape (chart.v1 candles[] item). */
export interface ChartCandle {
  /** Bar open, epoch seconds UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  [extra: string]: unknown;
}

/**
 * chart.v1 — per-symbol super-chart payload (charts/v1/<SYM>.json).
 * `overlays` is the fastest-evolving surface: core geometric layers
 * (trendlines/hlevels/gaps) have strict item shapes in the schema; the rest
 * are open objects — feature-detect each key, ignore unknown ones.
 */
export interface ChartV1 extends FearlabEnvelope {
  schema_version: "chart.v1";
  /** Ticker, uppercase. */
  symbol: string;
  /** Bar timeframe of the candle series (cloud v1 is 1d-only). */
  tf?: string;
  candles: ChartCandle[];
  overlays?: Record<string, unknown>;
  [extra: string]: unknown;
}

// ---------------------------------------------------------------------------
// combo.v1
// ---------------------------------------------------------------------------

/**
 * combo.v1 — trimmed per-cell site payload (combos/v1/<key>.json).
 * Field-for-field this is the client's `LabReport` (client/src/data/
 * lab-data.ts) plus the envelope stamps; typed loosely here because the
 * server only proxies it — the client keeps its own richer interface.
 */
export interface ComboV1 extends FearlabEnvelope {
  schema_version: "combo.v1";
  key: string;
  sym: string;
  tf: string;
  start: string;
  label: string;
  variant: string;
  window: { start: string; end: string; [extra: string]: unknown };
  lastBar: number | null;
  headline: Record<string, number | null>;
  fear: Record<string, unknown>;
  curve: unknown[];
  drawdown: unknown[];
  invested: unknown[];
  yearly: unknown[];
  monthly: unknown[];
  attribution: unknown[];
  trimTags: Record<string, number>;
  recent: unknown[];
  cards: [string, string][];
  [extra: string]: unknown;
}
