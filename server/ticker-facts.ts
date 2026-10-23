// Ticker facts for /charts: trend over three windows, distance from the 6-month
// high, trailing yield and payout cadence. Every number is computed here from
// Tiingo daily closes and distributions; no model writes or rewrites them.
//
// Trend is plain price change (close vs close), not total return: payouts are
// reported separately as yield, never folded into the change.
//
// Closes and payouts are first restated on today's share basis using Tiingo's
// splitFactor, so a 2-for-1 split is not a 50% drop and pre-split payouts do
// not inflate the yield.
//
// Separate from tiingo-cache.ts on purpose: that cache holds adjusted OHLCV
// bars under the DailyBar contract, while facts need raw closes, divCash and
// splitFactor over a short window. One request per symbol per market day, cached in memory.

export type Verdict = "BULLISH" | "BEARISH" | "FLAT";
export interface TrendWindow { change: number; verdict: Verdict; startDate: string; startClose: number }
export interface TickerFacts {
  symbol: string;            // upper case
  asOf: string;              // YYYY-MM-DD of the latest bar
  close: number;             // latest close
  windows: { d21: TrendWindow | null; m3: TrendWindow | null; m6: TrendWindow | null };
  upCount: number;           // windows with change > 0
  overall: "UP" | "DOWN" | "MIXED" | null; // null if any window is null
  high6m: number;            // highest close among the last 126 bars (latest included)
  vs6mHigh: number;          // (close / high6m - 1) * 100, 1 decimal
  yield: number | null;      // trailing 12-month payouts / close * 100, 2 decimals; null if no payouts
  // Median spacing of all fetched payouts; "none" when nothing paid in the trailing 365 days.
  cadence: "weekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "irregular" | "none";
  payouts: { exDate: string; amount: number }[]; // payouts in the trailing 365 days, oldest first
  lastExDate: string | null; // most recent payout in the fetched history
  special: boolean;          // >= 3 payouts and one is > 2x their median
  source: string;
}

// splitFactor: Tiingo's split ratio on that date (2 for a 2-for-1); missing or 0 means none.
export interface TickerFactsRow { date: string; close: number; divCash: number; splitFactor?: number }

// Same shape the chart add route accepts (fearlab-charts.ts TICKER_RE), upper
// case, as in symbol-search.ts.
export const TICKER_RE = /^[A-Z0-9](?:[A-Z0-9.-]{0,10}[A-Z0-9])?$/;

export const TICKER_FACTS_SOURCE =
  "Tiingo daily closes and distributions; trend is price change, not total return";

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 400;          // covers 126 trading bars plus the 365-day payout window
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_MAX = 500;

function trendWindow(rows: TickerFactsRow[], k: number): TrendWindow | null {
  const n = rows.length;
  if (n <= k) return null;
  const start = rows[n - 1 - k];
  const change = Number(((rows[n - 1].close / start.close - 1) * 100).toFixed(1));
  const verdict: Verdict = change > 0 ? "BULLISH" : change < 0 ? "BEARISH" : "FLAT";
  return { change, verdict, startDate: start.date, startClose: start.close };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Restates each row on today's share basis: close and divCash divided by the
 * product of the split factors of all later rows. A split on a row's own date
 * is already in that row's close.
 */
function splitAdjusted(rows: TickerFactsRow[]): TickerFactsRow[] {
  const out = new Array<TickerFactsRow>(rows.length);
  let factor = 1;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    out[i] = { date: r.date, close: r.close / factor, divCash: r.divCash / factor };
    const s = r.splitFactor;
    if (typeof s === "number" && Number.isFinite(s) && s > 0) factor *= s;
  }
  return out;
}

/**
 * How often it pays, from the median gap in days between consecutive payouts
 * over the whole fetched history. trailingCount is the number of payouts in the
 * trailing 365 days: none there means "none".
 */
function cadenceFor(exDates: string[], trailingCount: number): TickerFacts["cadence"] {
  if (trailingCount === 0) return "none";
  if (exDates.length < 2) return "annual";
  const gaps = exDates.slice(1).map((d, i) => (Date.parse(d) - Date.parse(exDates[i])) / DAY_MS);
  const gap = median(gaps);
  if (gap <= 10) return "weekly";
  if (gap >= 20 && gap <= 40) return "monthly";
  if (gap >= 75 && gap <= 105) return "quarterly";
  if (gap >= 160 && gap <= 200) return "semiannual";
  if (gap >= 330 && gap <= 400) return "annual";
  return "irregular";
}

/**
 * rows: oldest first, dates YYYY-MM-DD, at least one row, raw (unadjusted)
 * closes and payouts with Tiingo's splitFactor when known.
 */
export function computeTickerFacts(symbol: string, rawRows: TickerFactsRow[]): TickerFacts {
  if (rawRows.length === 0) throw new Error("computeTickerFacts needs at least one row");
  const rows = splitAdjusted(rawRows);
  const last = rows[rows.length - 1];
  const close = last.close;
  const windows = { d21: trendWindow(rows, 21), m3: trendWindow(rows, 63), m6: trendWindow(rows, 126) };
  const all = [windows.d21, windows.m3, windows.m6];
  const upCount = all.filter((w) => w !== null && w.change > 0).length;
  const overall = all.some((w) => w === null)
    ? null
    : upCount === 3 ? "UP" : upCount === 0 ? "DOWN" : "MIXED";

  const high6m = Math.max(...rows.slice(-126).map((r) => r.close));
  const vs6mHigh = Number(((close / high6m - 1) * 100).toFixed(1));

  const cutoff = Date.parse(last.date) - 365 * DAY_MS;
  const payouts = rows
    .filter((r) => r.divCash > 0 && Date.parse(r.date) > cutoff)
    .map((r) => ({ exDate: r.date, amount: r.divCash }));
  const amounts = payouts.map((p) => p.amount);
  const sum = amounts.reduce((s, a) => s + a, 0);
  const allPayouts = rows.filter((r) => r.divCash > 0);
  const med = amounts.length ? median(amounts) : 0;

  return {
    symbol: symbol.toUpperCase(),
    asOf: last.date,
    close,
    windows,
    upCount,
    overall,
    high6m,
    vs6mHigh,
    yield: payouts.length ? Number((sum / close * 100).toFixed(2)) : null,
    cadence: cadenceFor(allPayouts.map((r) => r.date), payouts.length),
    payouts,
    lastExDate: allPayouts.length ? allPayouts[allPayouts.length - 1].date : null,
    special: payouts.length >= 3 && amounts.some((a) => a > 2 * med),
    source: TICKER_FACTS_SOURCE,
  };
}

// --- Tiingo fetch + cache ---------------------------------------------------

export class TickerFactsUnavailableError extends Error {
  constructor(readonly upstreamStatus?: number) {
    super(upstreamStatus ? `Tiingo answered ${upstreamStatus}` : "Tiingo request failed");
    this.name = "TickerFactsUnavailableError";
  }
}

function tickerFactsApiKey(): string | undefined {
  return process.env.TIINGO_API_KEY?.trim() || process.env.VITE_T?.trim();
}

const nyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// New York wall-clock time of `ms`, read back as if it were UTC.
function nyWallAsUtc(ms: number): number {
  const p = Object.fromEntries(nyParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

/**
 * The first 18:30 America/New_York strictly after `now`, in epoch ms. Tiingo's
 * end-of-day close can land after 17:00, so the facts cache refreshes at the
 * same 18:30 New York time as tiingo-cache.ts.
 */
export function nextNewYorkRefresh(now: Date): number {
  const wall = new Date(nyWallAsUtc(now.getTime()));
  // Wall time has whole seconds, so 18:30:00.x counts as "at 18:30" and moves on a day.
  const atOrPast = wall.getUTCHours() * 60 + wall.getUTCMinutes() >= 18 * 60 + 30;
  const target = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(),
    wall.getUTCDate() + (atOrPast ? 1 : 0), 18, 30);
  // target is a wall time; shift by New York's UTC offset at that moment.
  let guess = target - (nyWallAsUtc(target) - target);
  guess = target - (nyWallAsUtc(guess) - guess);
  return guess;
}

const cache = new Map<string, { facts: TickerFacts | null; expires: number }>();
const inFlight = new Map<string, Promise<TickerFacts | null>>();

export function clearTickerFactsCache(): void {
  cache.clear();
  inFlight.clear();
}

function parseRows(data: unknown): TickerFactsRow[] {
  if (!Array.isArray(data)) throw new TickerFactsUnavailableError();
  const rows: TickerFactsRow[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    if (!raw || typeof raw.date !== "string") continue;
    const close = raw.close;
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
    const div = typeof raw.divCash === "number" && Number.isFinite(raw.divCash) ? raw.divCash : 0;
    const split = typeof raw.splitFactor === "number" && Number.isFinite(raw.splitFactor) && raw.splitFactor > 0
      ? raw.splitFactor
      : 1;
    rows.push({ date: raw.date.slice(0, 10), close, divCash: div, splitFactor: split });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function loadTickerFacts(sym: string, fetchImpl: typeof fetch, now: Date): Promise<TickerFacts | null> {
  const key = tickerFactsApiKey();
  if (!key) throw new Error("Tiingo API key not configured");
  const startDate = new Date(now.getTime() - HISTORY_DAYS * DAY_MS).toISOString().slice(0, 10);
  const url = `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(sym)}/prices`
    + `?startDate=${startDate}&columns=date,close,divCash,splitFactor`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Authorization: `Token ${key}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new TickerFactsUnavailableError();
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new TickerFactsUnavailableError(res.status);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new TickerFactsUnavailableError();
  }
  const rows = parseRows(data);
  // No bars in the window (delisted or not yet trading): nothing to describe.
  return rows.length ? computeTickerFacts(sym, rows) : null;
}

/**
 * Facts for one symbol, or null when Tiingo has no such ticker (404) or no
 * bars in the window. Other failures throw TickerFactsUnavailableError, whose
 * message never contains the API key. Cached until the next 18:30 New York
 * time after the fetch; concurrent calls for one symbol share one request.
 */
export async function fetchTickerFacts(
  symbol: string,
  opts: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<TickerFacts | null> {
  const sym = symbol.trim().toUpperCase();
  const now = opts.now ?? (() => new Date());
  const hit = cache.get(sym);
  if (hit && now().getTime() < hit.expires) return hit.facts;

  const pending = inFlight.get(sym);
  if (pending) return pending;

  const fetchedAt = now();
  const request = loadTickerFacts(sym, opts.fetch ?? fetch, fetchedAt)
    .then((facts) => {
      cache.delete(sym);
      cache.set(sym, { facts, expires: nextNewYorkRefresh(fetchedAt) });
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      return facts;
    })
    .finally(() => {
      if (inFlight.get(sym) === request) inFlight.delete(sym);
    });
  inFlight.set(sym, request);
  return request;
}
