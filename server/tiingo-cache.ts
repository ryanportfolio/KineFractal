import { eq } from "drizzle-orm";
import { db } from "./db";
import { marketDataCache } from "@shared/schema";
import {
  DAILY_BAR_FIELDS,
  type DailyBar,
  type MarketDataFreshness,
} from "@shared/market-data";

export type { DailyBar, MarketDataFreshness } from "@shared/market-data";

// Kept while older routes are migrated to the canonical DailyBar contract.
export interface DailyRecord {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  adjClose?: number;
}

export interface MarketDataCacheEntry {
  ticker: string;
  bars: DailyBar[];
  marketDate: string;
  lastSuccessfulAt: Date;
  lastAttemptAt: Date;
  nextRetryAt: Date | null;
  lastError: string | null;
}

export interface MarketDataCacheStore {
  get(ticker: string): Promise<MarketDataCacheEntry | undefined>;
  put(entry: MarketDataCacheEntry): Promise<void>;
  recordFailure(ticker: string, error: string, nextRetryAt: Date, attemptedAt: Date): Promise<void>;
  clear?(ticker?: string): Promise<void>;
}

export interface MarketDataResult {
  bars: DailyBar[];
  freshness: MarketDataFreshness;
}

export type MarketDataErrorCategory = "rate_limited" | "upstream_error" | "unavailable";

export class MarketDataUnavailableError extends Error {
  constructor(
    readonly ticker: string,
    readonly causeMessage: string,
    readonly category: MarketDataErrorCategory = "unavailable",
    readonly upstreamStatus?: number,
  ) {
    super(`Market data unavailable for ${ticker}: ${causeMessage}`);
    this.name = "MarketDataUnavailableError";
  }
}

const LOCAL_CACHE_LIMIT = 200;
const RETRY_DELAY_MS = 15 * 60 * 1000;
const POSTGRES_RETRY_COOLDOWN_MS = 60 * 1000;
const SAFE_REFRESH_ERROR = "Tiingo refresh failed";
const localEntries = new Map<string, MarketDataCacheEntry>();
const inFlightRefreshes = new Map<string, Promise<MarketDataResult>>();

const newYorkPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type CacheOutcome = "hit" | "refresh" | "stale-fallback" | "failure";

interface UpstreamFailure {
  category: Exclude<MarketDataErrorCategory, "unavailable">;
  message: typeof SAFE_REFRESH_ERROR;
  upstreamStatus?: number;
}

function cloneBars(bars: DailyBar[]): DailyBar[] {
  return bars.map((bar) => ({ ...bar }));
}

function cloneEntry(entry: MarketDataCacheEntry): MarketDataCacheEntry {
  return {
    ...entry,
    bars: cloneBars(entry.bars),
    lastSuccessfulAt: new Date(entry.lastSuccessfulAt.getTime()),
    lastAttemptAt: new Date(entry.lastAttemptAt.getTime()),
    nextRetryAt: entry.nextRetryAt ? new Date(entry.nextRetryAt.getTime()) : null,
  };
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function isDailyBar(value: unknown): value is DailyBar {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.date !== "string" || record.date.trim().length === 0) return false;
  return DAILY_BAR_FIELDS.slice(1).every((field) => (
    typeof record[field] === "number" && Number.isFinite(record[field])
  ));
}

function normalizeBars(value: unknown): DailyBar[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const normalized: DailyBar[] = [];
  let previousDate = "";
  for (const candidate of value) {
    if (!isDailyBar(candidate)) return undefined;
    const bar = { ...candidate, date: candidate.date.trim() };
    if (bar.date <= previousDate) return undefined;
    normalized.push(bar);
    previousDate = bar.date;
  }
  return normalized;
}

function validEntry(entry: MarketDataCacheEntry | undefined): MarketDataCacheEntry | undefined {
  if (!entry || !isValidDate(entry.lastSuccessfulAt) || !isValidDate(entry.lastAttemptAt)) return undefined;
  if (entry.nextRetryAt !== null && !isValidDate(entry.nextRetryAt)) return undefined;
  if (typeof entry.marketDate !== "string" || entry.marketDate.trim().length === 0) return undefined;
  const bars = normalizeBars(entry.bars);
  if (!bars || bars[bars.length - 1]?.date !== entry.marketDate) return undefined;
  return {
    ...entry,
    ticker: normalizeTicker(entry.ticker),
    bars,
    marketDate: entry.marketDate,
    lastSuccessfulAt: new Date(entry.lastSuccessfulAt.getTime()),
    lastAttemptAt: new Date(entry.lastAttemptAt.getTime()),
    nextRetryAt: entry.nextRetryAt ? new Date(entry.nextRetryAt.getTime()) : null,
  };
}

function refreshWindowDate(now: Date): string | null {
  const parts = newYorkPartsFormatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value
  );
  const weekday = value("weekday");
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  if (!weekday || weekday === "Sat" || weekday === "Sun" || hour < 18 || (hour === 18 && minute < 30)) {
    return null;
  }
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function attemptedInWindow(lastAttemptAt: Date, windowDate: string | null): boolean {
  return windowDate === null || refreshWindowDate(lastAttemptAt) === windowDate;
}

function classifyUpstreamFailure(error: unknown): UpstreamFailure {
  const candidate = error as { response?: { status?: unknown }; status?: unknown } | null;
  const responseStatus = candidate?.response?.status ?? candidate?.status;
  const upstreamStatus = typeof responseStatus === "number" && Number.isInteger(responseStatus)
    ? responseStatus
    : undefined;
  return {
    message: SAFE_REFRESH_ERROR,
    category: upstreamStatus === 429 ? "rate_limited" : "upstream_error",
    ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
  };
}

function freshness(state: MarketDataFreshness["state"], entry: MarketDataCacheEntry, warning?: string): MarketDataFreshness {
  return {
    state,
    marketDate: entry.marketDate,
    lastSuccessfulAt: entry.lastSuccessfulAt.toISOString(),
    ...(warning ? { warning } : {}),
  };
}

function logCacheEvent(
  outcome: CacheOutcome,
  entry: Pick<MarketDataCacheEntry, "ticker" | "marketDate" | "lastSuccessfulAt">,
  detail?: Record<string, string>,
): void {
  console.log(JSON.stringify({
    event: "market-data-cache",
    outcome,
    ticker: entry.ticker,
    marketDate: entry.marketDate,
    lastSuccessfulAt: entry.lastSuccessfulAt.toISOString(),
    ...detail,
  }));
}

class LocalMarketDataStore implements MarketDataCacheStore {
  async get(ticker: string): Promise<MarketDataCacheEntry | undefined> {
    const entry = localEntries.get(normalizeTicker(ticker));
    if (!entry) return undefined;
    // Map iteration order is the LRU ordering; a read makes this most-recent.
    localEntries.delete(entry.ticker);
    localEntries.set(entry.ticker, entry);
    return cloneEntry(entry);
  }

  async put(entry: MarketDataCacheEntry): Promise<void> {
    const ticker = normalizeTicker(entry.ticker);
    if (!localEntries.has(ticker) && localEntries.size >= LOCAL_CACHE_LIMIT) {
      const oldest = localEntries.keys().next().value;
      if (oldest) localEntries.delete(oldest);
    }
    localEntries.delete(ticker);
    localEntries.set(ticker, cloneEntry({ ...entry, ticker }));
  }

  async recordFailure(ticker: string, error: string, nextRetryAt: Date, attemptedAt: Date): Promise<void> {
    const normalizedTicker = normalizeTicker(ticker);
    const entry = localEntries.get(normalizedTicker);
    if (!entry) return;
    await this.put({
      ...entry,
      lastAttemptAt: new Date(attemptedAt.getTime()),
      lastError: error,
      nextRetryAt: new Date(nextRetryAt.getTime()),
    });
  }

  async clear(ticker?: string): Promise<void> {
    if (ticker) localEntries.delete(normalizeTicker(ticker));
    else localEntries.clear();
  }

  async all(): Promise<MarketDataCacheEntry[]> {
    return Array.from(localEntries.values(), cloneEntry);
  }
}

const localStore = new LocalMarketDataStore();

function compareVerifiedSeries(left: MarketDataCacheEntry, right: MarketDataCacheEntry): number {
  const marketDateDifference = left.marketDate.localeCompare(right.marketDate);
  if (marketDateDifference !== 0) return marketDateDifference;
  return left.lastSuccessfulAt.getTime() - right.lastSuccessfulAt.getTime();
}

function hasSamePersistedState(left: MarketDataCacheEntry, right: MarketDataCacheEntry): boolean {
  return left.ticker === right.ticker
    && left.marketDate === right.marketDate
    && left.lastSuccessfulAt.getTime() === right.lastSuccessfulAt.getTime()
    && left.lastAttemptAt.getTime() === right.lastAttemptAt.getTime()
    && left.nextRetryAt?.getTime() === right.nextRetryAt?.getTime()
    && left.lastError === right.lastError
    && JSON.stringify(left.bars) === JSON.stringify(right.bars);
}

export function choosePreferredCacheEntry(
  local: MarketDataCacheEntry,
  remote: MarketDataCacheEntry,
): MarketDataCacheEntry {
  const preferredSeries = compareVerifiedSeries(local, remote) >= 0 ? local : remote;
  const newerAttempt = local.lastAttemptAt.getTime() > remote.lastAttemptAt.getTime() ? local : remote;

  return cloneEntry({
    ...preferredSeries,
    lastAttemptAt: newerAttempt.lastAttemptAt,
    nextRetryAt: newerAttempt.nextRetryAt,
    lastError: newerAttempt.lastError,
  });
}

class PostgresMarketDataStore implements MarketDataCacheStore {
  private postgresRetryAt = 0;

  private canUsePostgres(): boolean {
    return Boolean(db) && Date.now() >= this.postgresRetryAt;
  }

  private deferPostgres(): void {
    this.postgresRetryAt = Date.now() + POSTGRES_RETRY_COOLDOWN_MS;
  }

  private async writeToPostgres(
    database: NonNullable<typeof db>,
    entry: MarketDataCacheEntry,
  ): Promise<void> {
    await database.insert(marketDataCache).values({
      ...entry,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: marketDataCache.ticker,
      set: {
        bars: entry.bars,
        marketDate: entry.marketDate,
        lastSuccessfulAt: entry.lastSuccessfulAt,
        lastAttemptAt: entry.lastAttemptAt,
        nextRetryAt: entry.nextRetryAt,
        lastError: entry.lastError,
        updatedAt: new Date(),
      },
    });
  }

  async get(ticker: string): Promise<MarketDataCacheEntry | undefined> {
    const normalizedTicker = normalizeTicker(ticker);
    const local = validEntry(await localStore.get(normalizedTicker));
    const database = db;
    if (!database || !this.canUsePostgres()) return local;
    let fallback = local;
    try {
      const row = (await database
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.ticker, normalizedTicker))
        .limit(1))[0];
      this.postgresRetryAt = 0;
      const remote = row ? validEntry({
        ticker: row.ticker,
        bars: row.bars,
        marketDate: row.marketDate,
        lastSuccessfulAt: row.lastSuccessfulAt,
        lastAttemptAt: row.lastAttemptAt,
        nextRetryAt: row.nextRetryAt,
        lastError: row.lastError,
      }) : undefined;

      const preferred = local && remote
        ? choosePreferredCacheEntry(local, remote)
        : local ?? remote;
      if (!preferred) return undefined;

      fallback = preferred;
      await localStore.put(preferred);
      if (!remote || !hasSamePersistedState(preferred, remote)) {
        await this.writeToPostgres(database, preferred);
      }
      return cloneEntry(preferred);
    } catch {
      this.deferPostgres();
      console.error("[market-data-cache] Postgres cache unavailable; using local fallback");
      return fallback;
    }
  }

  async put(entry: MarketDataCacheEntry): Promise<void> {
    const normalized = cloneEntry({ ...entry, ticker: normalizeTicker(entry.ticker) });
    await localStore.put(normalized);
    const database = db;
    if (!database || !this.canUsePostgres()) return;
    try {
      await this.writeToPostgres(database, normalized);
      this.postgresRetryAt = 0;
    } catch {
      this.deferPostgres();
      console.error("[market-data-cache] Postgres cache unavailable; using local fallback");
    }
  }

  async recordFailure(ticker: string, error: string, nextRetryAt: Date, attemptedAt: Date): Promise<void> {
    const normalizedTicker = normalizeTicker(ticker);
    await localStore.recordFailure(normalizedTicker, error, nextRetryAt, attemptedAt);
    const database = db;
    if (!database || !this.canUsePostgres()) return;
    try {
      await database.update(marketDataCache).set({
        lastError: error,
        lastAttemptAt: attemptedAt,
        nextRetryAt,
        updatedAt: new Date(),
      }).where(eq(marketDataCache.ticker, normalizedTicker));
      this.postgresRetryAt = 0;
    } catch {
      this.deferPostgres();
      console.error("[market-data-cache] Postgres cache unavailable; using local fallback");
    }
  }

  async clear(ticker?: string): Promise<void> {
    await localStore.clear(ticker);
    const database = db;
    if (!database || !this.canUsePostgres()) return;
    try {
      if (ticker) {
        await database.delete(marketDataCache).where(eq(marketDataCache.ticker, normalizeTicker(ticker)));
      } else {
        await database.delete(marketDataCache);
      }
      this.postgresRetryAt = 0;
    } catch {
      this.deferPostgres();
      console.error("[market-data-cache] Postgres cache unavailable; using local fallback");
    }
  }

  async all(): Promise<MarketDataCacheEntry[]> {
    const database = db;
    if (!database || !this.canUsePostgres()) return localStore.all();
    try {
      const rows = await database.select().from(marketDataCache);
      this.postgresRetryAt = 0;
      return rows.map((row) => ({
        ticker: row.ticker,
        bars: cloneBars(row.bars),
        marketDate: row.marketDate,
        lastSuccessfulAt: new Date(row.lastSuccessfulAt.getTime()),
        lastAttemptAt: new Date(row.lastAttemptAt.getTime()),
        nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAt.getTime()) : null,
        lastError: row.lastError,
      }));
    } catch {
      this.deferPostgres();
      console.error("[market-data-cache] Postgres cache unavailable; using local fallback");
      return localStore.all();
    }
  }
}

const defaultStore = new PostgresMarketDataStore();

if (!db) {
  console.log("[market-data-cache] DATABASE_URL unset; using non-durable local fallback");
}

export function createTiingoCache(options: {
  store: MarketDataCacheStore;
  now?: () => Date;
}): {
  getOrFetch(ticker: string, fetcher: () => Promise<DailyBar[]>): Promise<MarketDataResult>;
  clear(ticker?: string): Promise<void>;
} {
  const now = options.now ?? (() => new Date());
  // Cold misses need a process-local backoff because a store cannot persist a
  // failure row without verified bars. A deployed cache factory is long-lived.
  const coldRetryAt = new Map<string, Date>();
  let globalInvalidationGeneration = 0;
  const tickerInvalidationGenerations = new Map<string, number>();
  let mutationFence: Promise<void> = Promise.resolve();

  async function withMutationFence<T>(operation: () => Promise<T>): Promise<T> {
    const previous = mutationFence;
    let release!: () => void;
    mutationFence = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  function captureInvalidationGeneration(ticker: string): { global: number; ticker: number } {
    return {
      global: globalInvalidationGeneration,
      ticker: tickerInvalidationGenerations.get(ticker) ?? 0,
    };
  }

  function generationIsCurrent(ticker: string, generation: { global: number; ticker: number }): boolean {
    return generation.global === globalInvalidationGeneration
      && generation.ticker === (tickerInvalidationGenerations.get(ticker) ?? 0);
  }

  function pruneColdRetries(currentTime: Date): void {
    for (const [ticker, retryAt] of coldRetryAt) {
      if (!isValidDate(retryAt) || retryAt.getTime() <= currentTime.getTime()) {
        coldRetryAt.delete(ticker);
      }
    }
  }

  function setColdRetry(ticker: string, retryAt: Date, currentTime: Date): void {
    pruneColdRetries(currentTime);
    coldRetryAt.delete(ticker);
    while (coldRetryAt.size >= LOCAL_CACHE_LIMIT) {
      const oldest = coldRetryAt.keys().next().value;
      if (!oldest) break;
      coldRetryAt.delete(oldest);
    }
    coldRetryAt.set(ticker, retryAt);
  }

  async function resolve(ticker: string, fetcher: () => Promise<DailyBar[]>): Promise<MarketDataResult> {
    const invalidationGeneration = captureInvalidationGeneration(ticker);
    const currentTime = now();
    pruneColdRetries(currentTime);
    const existing = await options.store.get(ticker);
    const verified = validEntry(existing);
    const retryAt = (existing?.nextRetryAt && isValidDate(existing.nextRetryAt)
      ? existing.nextRetryAt
      : coldRetryAt.get(ticker));
    const retryDue = Boolean(retryAt && currentTime.getTime() >= retryAt.getTime());

    if (retryAt && currentTime.getTime() < retryAt.getTime()) {
      const warning = existing?.lastError ? SAFE_REFRESH_ERROR : "refresh retry backoff";
      if (verified) {
        logCacheEvent("stale-fallback", verified, { category: "unavailable" });
        return { bars: cloneBars(verified.bars), freshness: freshness("stale", verified, warning) };
      }
      throw new MarketDataUnavailableError(ticker, warning, "unavailable");
    }

    const windowDate = refreshWindowDate(currentTime);
    if (verified && !retryDue && attemptedInWindow(verified.lastAttemptAt, windowDate)) {
      logCacheEvent("hit", verified);
      return { bars: cloneBars(verified.bars), freshness: freshness("cache", verified) };
    }

    try {
      const fetched = normalizeBars(await fetcher());
      if (!fetched) throw new Error("Tiingo returned incomplete daily bars");

      const refreshed: MarketDataCacheEntry = {
        ticker,
        bars: fetched,
        marketDate: fetched[fetched.length - 1]!.date,
        lastSuccessfulAt: currentTime,
        lastAttemptAt: currentTime,
        nextRetryAt: null,
        lastError: null,
      };
      await withMutationFence(async () => {
        if (!generationIsCurrent(ticker, invalidationGeneration)) return;
        await options.store.put(refreshed);
        coldRetryAt.delete(ticker);
      });
      logCacheEvent("refresh", refreshed);
      return { bars: cloneBars(refreshed.bars), freshness: freshness("fresh", refreshed) };
    } catch (error) {
      const upstreamFailure = classifyUpstreamFailure(error);
      const { category, message, upstreamStatus } = upstreamFailure;
      const nextRetryAt = new Date(currentTime.getTime() + RETRY_DELAY_MS);
      await withMutationFence(async () => {
        if (!generationIsCurrent(ticker, invalidationGeneration)) return;
        setColdRetry(ticker, nextRetryAt, currentTime);
        if (!existing || !generationIsCurrent(ticker, invalidationGeneration)) return;
        await options.store.recordFailure(ticker, message, nextRetryAt, currentTime);
        // Keep this state durable for compatible stores which have not yet
        // adopted the attemptedAt recordFailure argument.
        if (!generationIsCurrent(ticker, invalidationGeneration)) return;
        await options.store.put({
          ...existing,
          lastAttemptAt: currentTime,
          nextRetryAt,
          lastError: message,
        });
      });
      const failureEntry = verified ?? {
        ticker,
        marketDate: existing?.marketDate ?? "",
        lastSuccessfulAt: isValidDate(existing?.lastSuccessfulAt) ? existing.lastSuccessfulAt : currentTime,
      };
      logCacheEvent("failure", failureEntry, {
        category,
        ...(upstreamStatus === undefined ? {} : { upstreamStatus: String(upstreamStatus) }),
      });

      if (verified) {
        logCacheEvent("stale-fallback", verified, {
          category,
          ...(upstreamStatus === undefined ? {} : { upstreamStatus: String(upstreamStatus) }),
        });
        return { bars: cloneBars(verified.bars), freshness: freshness("stale", verified, message) };
      }
      throw new MarketDataUnavailableError(ticker, message, category, upstreamStatus);
    }
  }

  return {
    getOrFetch(ticker: string, fetcher: () => Promise<DailyBar[]>): Promise<MarketDataResult> {
      const normalizedTicker = normalizeTicker(ticker);
      if (!normalizedTicker) {
        return Promise.reject(new MarketDataUnavailableError(ticker, "ticker is required"));
      }
      const inFlight = inFlightRefreshes.get(normalizedTicker);
      if (inFlight) return inFlight;

      const refresh = resolve(normalizedTicker, fetcher);
      inFlightRefreshes.set(normalizedTicker, refresh);
      void refresh.then(() => {
        if (inFlightRefreshes.get(normalizedTicker) === refresh) {
          inFlightRefreshes.delete(normalizedTicker);
        }
      }, () => {
        if (inFlightRefreshes.get(normalizedTicker) === refresh) {
          inFlightRefreshes.delete(normalizedTicker);
        }
      });
      return refresh;
    },
    async clear(ticker?: string): Promise<void> {
      await withMutationFence(async () => {
        if (ticker) {
          const normalizedTicker = normalizeTicker(ticker);
          tickerInvalidationGenerations.set(
            normalizedTicker,
            (tickerInvalidationGenerations.get(normalizedTicker) ?? 0) + 1,
          );
          coldRetryAt.delete(normalizedTicker);
          inFlightRefreshes.delete(normalizedTicker);
          await options.store.clear?.(normalizedTicker);
          return;
        }
        globalInvalidationGeneration += 1;
        tickerInvalidationGenerations.clear();
        coldRetryAt.clear();
        inFlightRefreshes.clear();
        await options.store.clear?.();
      });
    },
  };
}

export const tiingoMarketDataCache = createTiingoCache({ store: defaultStore });

// Legacy route compatibility. New routes should inject their upstream fetcher
// through createTiingoCache so stale/failure states are explicit.
export async function getCachedData(ticker: string, requiredFields?: string[]): Promise<DailyRecord[] | null> {
  const entry = validEntry(await defaultStore.get(normalizeTicker(ticker)));
  if (!entry) return null;
  if (requiredFields?.some((field) => entry.bars.some((bar) => bar[field as keyof DailyBar] === undefined))) {
    return null;
  }
  return cloneBars(entry.bars);
}

export async function setCachedData(ticker: string, data: DailyRecord[]): Promise<void> {
  const bars = normalizeBars(data);
  if (!bars) return;
  const timestamp = new Date();
  await defaultStore.put({
    ticker: normalizeTicker(ticker),
    bars,
    marketDate: bars[bars.length - 1]!.date,
    lastSuccessfulAt: timestamp,
    lastAttemptAt: timestamp,
    nextRetryAt: null,
    lastError: null,
  });
}

export async function clearCache(ticker?: string): Promise<void> {
  await tiingoMarketDataCache.clear(ticker);
}

export async function getCacheStats(): Promise<{
  lastUpdated: string;
  tickers: Record<string, {
    records: number;
    fields: string[];
    marketDate: string;
    lastSuccessfulAt: string;
    lastAttemptAt: string;
    nextRetryAt: string | null;
    lastError: string | null;
  }>;
}> {
  const entries = await defaultStore.all();
  const tickers: Record<string, {
    records: number;
    fields: string[];
    marketDate: string;
    lastSuccessfulAt: string;
    lastAttemptAt: string;
    nextRetryAt: string | null;
    lastError: string | null;
  }> = {};
  let latest = "";
  for (const entry of entries) {
    const verified = validEntry(entry);
    if (!verified) continue;
    tickers[verified.ticker] = {
      records: verified.bars.length,
      fields: [...DAILY_BAR_FIELDS],
      marketDate: verified.marketDate,
      lastSuccessfulAt: verified.lastSuccessfulAt.toISOString(),
      lastAttemptAt: verified.lastAttemptAt.toISOString(),
      nextRetryAt: verified.nextRetryAt?.toISOString() ?? null,
      lastError: verified.lastError === SAFE_REFRESH_ERROR ? verified.lastError : null,
    };
    if (verified.lastSuccessfulAt.toISOString() > latest) latest = verified.lastSuccessfulAt.toISOString();
  }
  return { lastUpdated: latest, tickers };
}

export async function getBulkCachedData(
  tickers: string[],
  requiredFields?: string[],
): Promise<{ complete: boolean; data: Record<string, DailyRecord[]>; missing: string[]; cacheDate: string }> {
  const records = await Promise.all(tickers.map(async (ticker) => [ticker, await getCachedData(ticker, requiredFields)] as const));
  const data: Record<string, DailyRecord[]> = {};
  const missing: string[] = [];
  for (const [ticker, bars] of records) {
    if (bars) data[ticker] = bars;
    else missing.push(ticker);
  }
  const stats = await getCacheStats();
  return {
    complete: missing.length === 0,
    data,
    missing,
    cacheDate: stats.lastUpdated.slice(0, 10),
  };
}
