import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../server/routes.ts", import.meta.url), "utf8");
const cacheSource = await readFile(new URL("../server/tiingo-cache.ts", import.meta.url), "utf8");
const storageSource = await readFile(new URL("../server/storage.ts", import.meta.url), "utf8");
const ratioRelevancePageSource = await readFile(new URL("../client/src/pages/ratio-relevance.tsx", import.meta.url), "utf8");

function routeSource(path, method = "get") {
  const start = source.indexOf(`app.${method}("${path}"`);
  assert.notEqual(start, -1, `missing ${path} route`);
  const nextRoute = source.indexOf("\n  app.", start + 1);
  return source.slice(start, nextRoute === -1 ? source.length : nextRoute);
}

function functionSource(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const nextExport = source.indexOf("\nexport ", start + 1);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

const fundamentals = functionSource("fetchFundamentalData");
const priceDivergence = routeSource("/api/price-divergence/:ticker");
const debugFundamentals = routeSource("/api/debug/fundamentals/:ticker");
const cacheDelete = routeSource("/api/cache/:ticker?", "delete");
const cacheStatus = routeSource("/api/cache/status");
const tiingoProxy = routeSource("/api/tiingo/:ticker");
const sectorBulk = routeSource("/api/sector-rotation/bulk");
const ratioRelevance = routeSource("/api/ratio-relevance");
const marketDataFreshnessStart = source.indexOf("function aggregateMarketDataFreshness(");
assert.notEqual(marketDataFreshnessStart, -1, "missing aggregateMarketDataFreshness");
const marketDataFreshnessEndOffset = source
  .slice(marketDataFreshnessStart)
  .search(/\r?\n\r?\nexport async function registerRoutes/);
const marketDataFreshnessEnd = marketDataFreshnessEndOffset === -1
  ? -1
  : marketDataFreshnessStart + marketDataFreshnessEndOffset;
assert.notEqual(marketDataFreshnessEnd, -1, "aggregateMarketDataFreshness body is not bounded");
const marketDataFreshnessHelper = source.slice(marketDataFreshnessStart, marketDataFreshnessEnd);

test("Tiingo proxy uses the shared cache and exposes market-data freshness headers", () => {
  assert.match(
    tiingoProxy,
    /\btiingoMarketDataCache\.getOrFetch\s*\(/,
    "Tiingo proxy must use the durable shared cache",
  );
  assert.match(tiingoProxy, /res\.setHeader\(\s*["']X-Market-Data-State["']/);
  assert.match(tiingoProxy, /res\.setHeader\(\s*["']X-Market-Data-As-Of["']/);
});

test("Ratio Relevance requires a complete shared market matrix before ratio math", () => {
  assert.match(
    ratioRelevance,
    /\btiingoMarketDataCache\.getOrFetch\s*\(/,
    "Ratio Relevance must use the durable shared cache",
  );
  const matrixGuardAt = ratioRelevance.indexOf("requireCompleteMarketMatrix(");
  const commonHistoryGuardAt = ratioRelevance.indexOf("requireCommonMarketHistory(");
  const ratioMathAt = ratioRelevance.indexOf("const ratioModules");
  assert.notEqual(matrixGuardAt, -1, "Ratio Relevance must validate its market matrix");
  assert.notEqual(commonHistoryGuardAt, -1, "Ratio Relevance must validate common market history");
  assert.notEqual(ratioMathAt, -1, "Ratio Relevance ratio math marker is missing");
  assert(matrixGuardAt < ratioMathAt, "market matrix validation must precede ratio math");
  assert(commonHistoryGuardAt < ratioMathAt, "common-history validation must precede ratio math");
  assert.match(
    ratioRelevance,
    /return\s+res\.status\(\s*503\s*\)\.json\(\s*\{[\s\S]*?\bmissing\b/,
    "an incomplete matrix must return a 503 response listing missing tickers",
  );
  assert.doesNotMatch(
    ratioRelevance,
    /tickerResults\.push\(\s*\{\s*ticker\s*,\s*data:\s*\[\]\s*\}\s*\)/,
    "Ratio Relevance must not silently substitute empty ticker series",
  );
});

test("Sector bulk returns 503 with missing tickers instead of an incomplete success payload", () => {
  const keyCheckAt = sectorBulk.indexOf("tiingoApiKey()");
  const fetchLoopAt = sectorBulk.indexOf("for (let index");
  assert.notEqual(keyCheckAt, -1, "sector bulk must check the Tiingo key before warming data");
  assert.notEqual(fetchLoopAt, -1, "sector bulk fetch loop is missing");
  assert(keyCheckAt < fetchLoopAt, "sector bulk must reject a missing key before the ticker loop");
  assert.match(
    sectorBulk,
    /res\.status\(\s*503\s*\)\.json\(\s*\{[\s\S]*?\bmissing\b/,
    "sector bulk must return 503 when verified cache entries are missing",
  );
});

test("Price Divergence uses the shared market cache and returns unavailable data as 503", () => {
  assert.match(priceDivergence, /\btiingoMarketDataCache\.getOrFetch\s*\(/);
  assert.doesNotMatch(priceDivergence, /https:\/\/api\.tiingo\.com\/tiingo\/daily\//);
  assert.match(
    priceDivergence,
    /res\.status\(\s*503\s*\)\.json\(\s*\{[\s\S]*?market data/i,
  );
});

test("Price Divergence uses the latest verified bar as its 30-day cutoff and selects the final eligible daily bar", () => {
  assert.match(priceDivergence, /new Date\(latestRecord\.date\)/);
  assert.match(
    priceDivergence,
    /(?:priceData\.findLast|\[\.\.\.priceData\]\.reverse\(\)\.find)\(\s*\(price\)\s*=>\s*new Date\(price\.date\)\s*<=\s*thirtyDaysAgo\s*\)/,
  );
});

test("Ratio Relevance reports the final common date as asOf", () => {
  assert.match(
    ratioRelevance,
    /asOf:\s*recentDates\[recentDates\.length - 1\]/,
  );
});

test("aggregate market freshness retains the oldest verified success timestamp", () => {
  assert.match(
    marketDataFreshnessHelper,
    /marketDate,\s*lastSuccessfulAt,/,
    "aggregate freshness must retain a verified timestamp instead of dropping it from the route response",
  );
});

test("Ratio Relevance renders the verified market-data freshness status", () => {
  assert.match(
    ratioRelevancePageSource,
    /import\s+type\s+\{[^}]*\bMarketDataFreshness\b[^}]*\}\s+from/,
    "Ratio Relevance must use the shared market-data freshness type",
  );
  assert.match(
    ratioRelevancePageSource,
    /interface\s+RatioData\s*\{[\s\S]*?\bfreshness\s*:\s*MarketDataFreshness/,
    "RatioData must describe the API freshness payload",
  );
  assert.match(
    ratioRelevancePageSource,
    /data-testid=["']text-market-data-status["']/,
    "Ratio Relevance must expose its market-data status for UI tests",
  );
  assert.match(
    ratioRelevancePageSource,
    /data\.freshness\.marketDate/,
    "Ratio Relevance must render the verified market date",
  );

  const statusAt = ratioRelevancePageSource.indexOf('data-testid="text-market-data-status"');
  assert.notEqual(statusAt, -1, "market-data status marker is missing");
  const statusSource = ratioRelevancePageSource.slice(Math.max(0, statusAt - 2_000), statusAt + 1_500);
  const errorStateAt = statusSource.search(/\berror\s*\?|\bif\s*\(\s*error\s*\)/);
  const normalFreshnessAt = statusSource.indexOf("data.freshness");
  assert.notEqual(errorStateAt, -1, "status must branch on refresh failure");
  assert.notEqual(normalFreshnessAt, -1, "status must retain a normal freshness branch");
  assert(errorStateAt < normalFreshnessAt, "error status must take precedence over normal freshness");
  assert.match(statusSource, /UNAVAILABLE/, "a no-data refresh failure must be explicit");
  assert.match(statusSource, /REFRESH FAILED/, "a failed refresh with retained data must be explicit");
  assert.match(statusSource, /LAST VERIFIED/, "retained data must be labelled as last verified");
});

test("fundamentals use the durable Postgres storage cache and debug failures are unavailable", () => {
  assert.match(fundamentals, /storage\.getTickerCache\s*\(/);
  assert.match(fundamentals, /storage\.upsertTickerCache\s*\(/);
  assert.doesNotMatch(fundamentals, /\bgetCache\s*\(/);
  assert.doesNotMatch(fundamentals, /\bsetCache\s*\(/);
  assert.match(debugFundamentals, /res\.status\(\s*503\s*\)\.json\s*\(/);
});

test("fundamentals cache refreshes its freshness timestamp and never logs raw storage errors", () => {
  const upsertStart = storageSource.indexOf("async upsertTickerCache");
  const clearStart = storageSource.indexOf("async clearTickerCache", upsertStart);
  assert.notEqual(upsertStart, -1, "ticker-cache upsert is missing");
  const upsert = storageSource.slice(upsertStart, clearStart === -1 ? storageSource.length : clearStart);

  assert.match(
    upsert,
    /onConflictDoUpdate\(\{[\s\S]*?set:\s*\{[\s\S]*?fetchedAt:\s*new Date\(\)/,
    "a successful refresh must advance fetchedAt so the 24-hour cache can become fresh again",
  );
  assert.doesNotMatch(
    storageSource,
    /console\.error\([^)]*,\s*error\s*\)/,
    "storage logs must not include raw database error objects",
  );
  for (const category of ["Fundamentals cache read failed", "Fundamentals cache write failed"]) {
    assert.match(storageSource, new RegExp(`console\\.error\\(["']${category}["']\\)`));
  }
});

test("fundamentals invalidation is serialized and blocks stale writes", () => {
  assert.match(source, /async function withFundamentalsCacheLock\(/);
  assert.match(source, /function invalidateFundamentalsCache\(/);
  assert.match(fundamentals, /const\s+invalidationGeneration\s*=\s*captureFundamentalsInvalidationGeneration\(upperSymbol\)/);
  assert.match(fundamentals, /await\s+withFundamentalsCacheLock\(upperSymbol,/);
  assert.match(fundamentals, /isFundamentalsInvalidationCurrent\(upperSymbol,\s*invalidationGeneration\)/);
  assert.match(
    cacheDelete,
    /invalidateFundamentalsCache\(ticker\);\s*await\s+storage\.clearTickerCache\(ticker\)/,
    "ticker clear must invalidate stale fetches before deleting the durable entry",
  );
  assert.match(
    cacheDelete,
    /invalidateFundamentalsCache\(\);\s*await\s+storage\.clearTickerCache\(\)/,
    "global clear must invalidate stale fetches before deleting durable entries",
  );
});

test("cache deletion resets durable market data and status exposes cache metadata", () => {
  assert.match(cacheDelete, /await\s+clearTiingoCache\(\s*ticker\s*\)/);
  assert.match(cacheDelete, /await\s+clearTiingoCache\(\s*\)/);

  const cacheStatsStart = cacheSource.indexOf("export async function getCacheStats");
  const cacheStatsEnd = cacheSource.indexOf("export async function getBulkCachedData", cacheStatsStart);
  assert.notEqual(cacheStatsStart, -1, "getCacheStats is missing");
  const cacheStats = cacheSource.slice(cacheStatsStart, cacheStatsEnd === -1 ? cacheSource.length : cacheStatsEnd);
  for (const field of ["marketDate", "lastSuccessfulAt", "lastAttemptAt", "nextRetryAt", "lastError"]) {
    assert.match(cacheStats, new RegExp(`\\b${field}\\b`), `cache stats must include ${field}`);
    assert.match(cacheStatus, new RegExp(`\\b${field}\\b`), `cache status must expose ${field}`);
  }
});
