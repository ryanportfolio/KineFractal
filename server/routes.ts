import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import axios from "axios";
import { clearCache } from "./cache";
import { storage } from "./storage";
import {
  clearCache as clearTiingoCache,
  getCacheStats,
  MarketDataUnavailableError,
  tiingoMarketDataCache,
  type DailyBar,
  type MarketDataFreshness,
  type MarketDataResult,
} from "./tiingo-cache";
import {
  MarketMatrixUnavailableError,
  requireCommonMarketHistory,
  requireCompleteMarketMatrix,
} from "./market-data-contract";
import { CompanyDivergenceEngine, type CompanyAnalysis } from "../client/src/lib/divergence-engine";
import { analyzeWithGemini, streamAnalyzeWithGemini, analyzeUSDCorrelations, streamAnalyzeRatioZScores, streamAnalyzeRatioRelevance, type AnalysisData, type RatioData, type RatioRelevanceData } from "./gemini-analyzer";
import { getRunArtifact, getDatedRunArtifact, getLatestPointer, isConfigured as fearlabLiveConfigured, ageHours, STALE_AFTER_HOURS, type FetchResult as LiveFetchResult } from "./fearlab-live";
import { registerFearlabChartsRoutes } from "./fearlab-charts";
import { registerAccountRoutes, requireUser } from "./account-routes";
import { registerAlertsRoutes } from "./alerts-routes";
import type { BoardV1, ComboV1, SignalsV1, ChartV1 } from "@shared/fearlab-contracts";
// Static board snapshot fallback: the same board.json the client falls back
// to, bundled into the server build. `npm run sync:snapshot` rewrites it, so a
// version flip reaches this fallback without a separate copy step.
import fearlabBoardSnapshot from "../client/public/fearlab/board.json";

interface QuarterData {
  date: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  freeCashFlow: number | null;
  operatingIncome: number | null;
  grossProfit: number | null;
  // Balance Sheet fields for Capital Allocation (optional - may not always be available)
  sharesOutstanding?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  cashAndEquivalents?: number | null;
  // Debt fields (specific debt instead of total liabilities for solvency analysis)
  totalDebt?: number | null;
  shortTermDebt?: number | null;
  longTermDebt?: number | null;
  // Marketable securities + pre-computed net debt (consumed by the divergence engine)
  investmentsCurrent?: number | null;
  netDebt?: number | null;
}


function parseVal(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "None" || value === "") {
    return null;
  }
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function generateMockData(): QuarterData[] {
  const baseDate = new Date();
  const mockQuarters: QuarterData[] = [];
  
  for (let i = 0; i < 12; i++) {
    const quarterDate = new Date(baseDate);
    quarterDate.setMonth(quarterDate.getMonth() - (i * 3));
    const lastDayOfQuarter = new Date(quarterDate.getFullYear(), quarterDate.getMonth() + 1, 0);
    
    const baseRevenue = 100000000000 * (1 + (12 - i) * 0.02);
    const baseNetIncome = baseRevenue * 0.25;
    
    const mockRevenue = Math.round(baseRevenue * (0.95 + Math.random() * 0.1));
    const mockTotalAssets = Math.round(mockRevenue * 1.5);
    const mockCash = Math.round(mockRevenue * 0.15);
    mockQuarters.push({
      date: lastDayOfQuarter.toISOString().split('T')[0],
      revenue: mockRevenue,
      netIncome: Math.round(baseNetIncome * (0.9 + Math.random() * 0.2)),
      eps: parseFloat((2.0 + (12 - i) * 0.05 + (Math.random() - 0.5) * 0.3).toFixed(2)),
      freeCashFlow: Math.round(baseNetIncome * 0.8 * (0.85 + Math.random() * 0.3)),
      operatingIncome: Math.round(mockRevenue * 0.3 * (0.9 + Math.random() * 0.2)),
      grossProfit: Math.round(mockRevenue * 0.45 * (0.9 + Math.random() * 0.1)),
      sharesOutstanding: Math.round(15000000000 * (1 - i * 0.005)), // Simulating buybacks
      totalAssets: mockTotalAssets,
      totalLiabilities: Math.round(mockTotalAssets * 0.6),
      cashAndEquivalents: mockCash,
      totalDebt: Math.round(mockTotalAssets * 0.4), // True debt (80% of mock liabilities)
      shortTermDebt: Math.round(mockTotalAssets * 0.1),
      longTermDebt: Math.round(mockTotalAssets * 0.3)
    });
  }
  
  return mockQuarters;
}

// Collection wrapper for detailed logging
interface FetchResult {
  data: QuarterData[];
  logs: string[];
}

const logs: string[] = [];
function addLog(msg: string) {
  logs.push(msg);
  console.log(msg);
}

class FundamentalsUnavailableError extends Error {
  constructor() {
    super("Fundamentals unavailable");
    this.name = "FundamentalsUnavailableError";
  }
}

const FUNDAMENTALS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isQuarterData(value: unknown): value is QuarterData[] {
  return Array.isArray(value) && value.every((quarter) => (
    typeof quarter === "object" && quarter !== null && typeof (quarter as { date?: unknown }).date === "string"
  ));
}

let fundamentalsGlobalInvalidationGeneration = 0;
const fundamentalsTickerInvalidationGenerations = new Map<string, number>();
let fundamentalsCacheMutationFence: Promise<void> = Promise.resolve();

function captureFundamentalsInvalidationGeneration(ticker: string): { global: number; ticker: number } {
  return {
    global: fundamentalsGlobalInvalidationGeneration,
    ticker: fundamentalsTickerInvalidationGenerations.get(ticker) ?? 0,
  };
}

function isFundamentalsInvalidationCurrent(
  ticker: string,
  generation: { global: number; ticker: number },
): boolean {
  return generation.global === fundamentalsGlobalInvalidationGeneration
    && generation.ticker === (fundamentalsTickerInvalidationGenerations.get(ticker) ?? 0);
}

function invalidateFundamentalsCache(ticker?: string): void {
  if (ticker) {
    const normalizedTicker = ticker.toUpperCase();
    fundamentalsTickerInvalidationGenerations.set(
      normalizedTicker,
      (fundamentalsTickerInvalidationGenerations.get(normalizedTicker) ?? 0) + 1,
    );
    return;
  }
  fundamentalsGlobalInvalidationGeneration += 1;
  fundamentalsTickerInvalidationGenerations.clear();
}

async function withFundamentalsCacheLock(
  ticker: string | undefined,
  operation: () => Promise<void>,
): Promise<void> {
  void ticker;
  const previous = fundamentalsCacheMutationFence;
  let release!: () => void;
  fundamentalsCacheMutationFence = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    await operation();
  } finally {
    release();
  }
}

async function fetchFundamentalData(symbol: string): Promise<FetchResult> {
  const upperSymbol = symbol.toUpperCase();
  const invalidationGeneration = captureFundamentalsInvalidationGeneration(upperSymbol);
  
  // Clear logs for new request
  logs.length = 0;
  
  if (upperSymbol === "TEST") {
    addLog(`[Tiingo Fundamentals] Returning MOCK data for TEST symbol`);
    return { data: generateMockData(), logs };
  }

  const cachedEntry = await storage.getTickerCache(upperSymbol);
  const cachedData = isQuarterData(cachedEntry?.fundamentals) ? cachedEntry.fundamentals : undefined;
  const fetchedAt = cachedEntry?.fetchedAt ? new Date(cachedEntry.fetchedAt).getTime() : 0;
  if (cachedData && Number.isFinite(fetchedAt) && Date.now() - fetchedAt < FUNDAMENTALS_CACHE_TTL_MS) {
    addLog(`[Tiingo Fundamentals] Returning verified cache for ${upperSymbol}`);
    return { data: cachedData, logs };
  }

  addLog(`[Tiingo Fundamentals] Fetching fresh data for ${upperSymbol}...`);
  
  try {
    const apiKey = tiingoApiKey();
    if (!apiKey) throw new FundamentalsUnavailableError();

    // CORRECT ENDPOINT: /tiingo/fundamentals/{ticker}/statements
    // This returns the actual financial statements with revenue data
    const statementsUrl = `https://api.tiingo.com/tiingo/fundamentals/${upperSymbol}/statements?token=${apiKey}`;
    
    addLog(`[Tiingo] Fetching statements for ${upperSymbol}`);
    const response = await axios.get(statementsUrl, { timeout: 15000 });
    addLog(`[Tiingo] Statements endpoint success`);
    
    const statementsData = response.data;
    
    addLog(`[Tiingo API] Response received - type: ${Array.isArray(statementsData) ? `Array[${statementsData.length}]` : typeof statementsData}`);
    
    // Log raw response structure details
    if (statementsData.length > 0) {
      const firstItem = statementsData[0];
      addLog(`[Tiingo RAW] First record date: ${firstItem.date}, quarter: ${firstItem.quarter}`);
      addLog(`[Tiingo RAW] Available statement types: ${Object.keys(firstItem.statementData || {}).join(', ')}`);
      
    }

    if (!statementsData || !Array.isArray(statementsData)) {
      throw new Error(`Invalid response format from Tiingo Statements API for ${upperSymbol}`);
    }

    if (statementsData.length === 0) {
      throw new Error(`No statement data available for ${upperSymbol}. This ticker may not be covered by Tiingo fundamentals.`);
    }

    // CRITICAL: Filter out future dates BEFORE processing
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    addLog(`[Tiingo] Today's date for filtering: ${today.toISOString().split('T')[0]}`);
    
    // SMART HELPER: Extract value whether source is Array or Object
    // Tiingo returns data as Array [{dataCode: '...', value: ...}] OR flat Object
    function getTiingoValue(source: any, keys: string[]): number | null {
      if (!source) return null;
      
      // Case A: Source is an Array (Tiingo Standardized format)
      if (Array.isArray(source)) {
        const found = source.find((item: any) => keys.includes(item.dataCode));
        if (found && found.value != null) {
          return parseVal(found.value);
        }
        return null;
      }
      
      // Case B: Source is a flat Object (Standard format)
      for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null) {
          return parseVal(source[key]);
        }
      }
      return null;
    }
    
    // Legacy helper for backward compatibility
    function extractValue(arr: any[], ...codes: string[]): number | null {
      return getTiingoValue(arr, codes);
    }

    function firstKnown(...values: Array<number | null>): number | null {
      return values.find((value): value is number => value !== null) ?? null;
    }
    
    // Filter and transform Tiingo statements data
    // incomeStatement is an ARRAY with {dataCode, value} objects
    // quarter=0 means annual data, quarter=1-4 means quarterly data
    const filtered = statementsData
      .filter((item: any) => {
        // Filter out annual figures (quarter=0)
        if (item.quarter === 0) {
          addLog(`[Tiingo] SKIPPING annual data for ${item.date}`);
          return false;
        }
        
        // Filter out future dates
        const itemDate = new Date(item.date);
        const isFuture = itemDate > today;
        if (isFuture) {
          addLog(`[Tiingo] SKIPPING future date: ${item.date}`);
        }
        return !isFuture;
      });
    
    // DEBUG: Log available balance sheet field names (from first item only)
    if (filtered.length > 0) {
      const firstBS = filtered[0].statementData?.balanceSheet || [];
      const bsFieldNames = Array.isArray(firstBS) 
        ? firstBS.map((x: any) => x.dataCode).join(', ')
        : Object.keys(firstBS).join(', ');
      addLog(`[DEBUG-BS-FIELDS] ${upperSymbol} Balance Sheet available codes: ${bsFieldNames.substring(0, 300)}`);
    }
    
    const quarters: QuarterData[] = filtered
      .map((item: any) => {
        const date = item.date;
        const incomeStatement = item.statementData?.incomeStatement || [];
        const cashFlow = item.statementData?.cashFlow || [];
        const balanceSheet = item.statementData?.balanceSheet || [];
        const overview = item.statementData?.overview || [];  // Some data lives in overview
        
        // Extract revenue (try multiple dataCode names)
        const revenue = extractValue(incomeStatement, 'revenue', 'totalRevenue', 'netRevenue');
        
        // Extract net income
        const netIncome = extractValue(incomeStatement, 'netinc', 'netIncome', 'netIncComStock', 'consolidatedIncome');
        
        // Extract operating income
        const operatingIncome = extractValue(incomeStatement, 'opinc', 'operatingIncome', 'ebit');
        
        // Extract gross profit for margin calculation
        const grossProfit = extractValue(incomeStatement, 'grossProfit', 'grossmargin');
        
        // Extract EPS (try multiple dataCode names)
        const eps = extractValue(incomeStatement, 'eps', 'epsDil', 'epsBasic');
        
        // Extract free cash flow
        const fcf = extractValue(cashFlow, 'freeCashFlow', 'fcf', 'fcff');
        
        // SMART PARSING: Extract Balance Sheet fields for Capital Allocation analysis
        // SHARES: Check Income Statement first (most common), then Overview, then Balance Sheet
        const sharesOutstanding = firstKnown(
          getTiingoValue(incomeStatement, ['weightedAverageShsOut', 'weightedAverageShsOutDil', 'weightedAveBasicSharesos', 'weightedAveDilutedSharesos', 'shareswa', 'sharesbas']),
          getTiingoValue(overview, ['shareCount', 'sharesOutstanding', 'shares']),
          getTiingoValue(balanceSheet, ['shareCount', 'sharesOutstanding', 'commonStock', 'shares']),
        );
        
        // ASSETS & LIABILITIES: Check Balance Sheet
        const totalAssets = getTiingoValue(balanceSheet, ['totalAssets', 'assets', 'assetsTotal']);
        const totalLiabilities = getTiingoValue(balanceSheet, ['totalLiabilities', 'liabilities', 'totalLiab', 'liabilitiesTotal']);
        
        // DEBT FIELDS: Capture specific debt types for solvency analysis (true debt, not all liabilities)
        // Tiingo field names: debtNonCurrent, debtCurrent (or similar variants)
        const longTermDebt = getTiingoValue(balanceSheet, ['debtNonCurrent', 'longTermDebt', 'nonCurrentDebt']);
        const shortTermDebt = getTiingoValue(balanceSheet, ['debtCurrent', 'shortTermDebt', 'currentDebt', 'currentPortionLongTermDebt']);
        const totalDebt = 
          (longTermDebt !== null && shortTermDebt !== null)
            ? longTermDebt + shortTermDebt 
            : firstKnown(longTermDebt, shortTermDebt);
        
        // CASH: Check Balance Sheet with multiple variations
        const cashAndEquivalents = getTiingoValue(balanceSheet, ['cashAndCashEquivalents', 'cashAndEquivalents', 'cashAndEq', 'cash', 'cashnequsd', 'cashneq']);
        
        // MARKETABLE SECURITIES: Investments (Current) - part of cash & investments
        const investmentsCurrent = getTiingoValue(balanceSheet, ['investmentsCurrent', 'shortTermInvestments', 'marketableSecurities']);
        
        // NET DEBT = Total Debt - (Cash + Marketable Securities)
        const totalCashAndInvestments = cashAndEquivalents !== null && investmentsCurrent !== null
          ? cashAndEquivalents + investmentsCurrent
          : null;
        const netDebt = totalDebt !== null && totalCashAndInvestments !== null
          ? totalDebt - totalCashAndInvestments
          : null;
        
        // DEBUG: Log what we're extracting for each quarter
        addLog(`[DEBUG] ${upperSymbol} Q${item.quarter} ${date}: Shares=${sharesOutstanding}, Assets=${totalAssets}, Debt=${totalDebt}, STDebt=${shortTermDebt}, LTDebt=${longTermDebt}, Cash=${cashAndEquivalents}, Investments=${investmentsCurrent}, NetDebt=${netDebt}`);
        
        return {
          date,
          revenue,
          netIncome,
          eps,
          freeCashFlow: fcf,
          operatingIncome,
          grossProfit,
          sharesOutstanding,
          totalAssets,
          totalLiabilities,
          cashAndEquivalents,
          investmentsCurrent,
          netDebt,
          totalDebt,
          shortTermDebt,
          longTermDebt
        };
      })
      .filter((q: QuarterData) => q.revenue !== null && q.revenue > 0); // Only keep records with valid revenue

    if (quarters.length === 0) {
      throw new Error(`No valid quarterly data for ${upperSymbol} after filtering. All records either have future dates or missing revenue.`);
    }

    // Sort by date DESCENDING (newest first)
    quarters.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Take last 12 quarters
    const last12Quarters = quarters.slice(0, 12);
    
    addLog(`[Tiingo] SUCCESS: ${last12Quarters.length} completed quarters for ${upperSymbol}`);
    addLog(`[Tiingo] Date range: ${last12Quarters[last12Quarters.length - 1]?.date} to ${last12Quarters[0]?.date}`);
    addLog(`[Tiingo] Latest quarter: ${JSON.stringify(last12Quarters[0]).substring(0, 200)}`);
    
    await withFundamentalsCacheLock(upperSymbol, async () => {
      if (!isFundamentalsInvalidationCurrent(upperSymbol, invalidationGeneration)) return;
      await storage.upsertTickerCache({ ticker: upperSymbol, fundamentals: last12Quarters });
    });
    
    return { data: last12Quarters, logs };
    
  } catch {
    if (cachedData) {
      addLog(`[Tiingo Fundamentals] Serving stale verified cache for ${upperSymbol}`);
      return { data: cachedData, logs };
    }
    addLog(`[Tiingo Fundamentals] Data unavailable for ${upperSymbol}`);
    throw new FundamentalsUnavailableError();
  }
}

const TIINGO_DAILY_COLUMNS = "date,open,high,low,close,volume,adjClose";

function tiingoApiKey(): string | undefined {
  return process.env.TIINGO_API_KEY?.trim() || process.env.VITE_T?.trim();
}

async function fetchTiingoDailyBars(ticker: string): Promise<DailyBar[]> {
  const apiKey = tiingoApiKey();
  if (!apiKey) throw new Error("Tiingo API key not configured");

  const startDate = "2019-01-01";
  const endDate = new Date().toISOString().split("T")[0];
  const url = `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker)}/prices?startDate=${startDate}&endDate=${endDate}&columns=${TIINGO_DAILY_COLUMNS}&token=${apiKey}`;
  const response = await axios.get(url, { timeout: 30000 });
  if (!Array.isArray(response.data)) throw new Error("Tiingo returned an invalid daily-bar response");

  // Canonical cache validation owns the numeric and completeness checks.
  return response.data
    .map((candidate: Record<string, unknown>) => ({
      date: typeof candidate.date === "string" ? candidate.date.split("T")[0] : candidate.date,
      open: candidate.open,
      high: candidate.high,
      low: candidate.low,
      close: candidate.close,
      volume: candidate.volume,
      adjClose: candidate.adjClose,
    }) as unknown as DailyBar)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function aggregateMarketDataFreshness(
  results: readonly MarketDataResult[],
  marketDateBoundary: "latest" | "earliest" = "latest",
): MarketDataFreshness {
  let marketDate = "";
  let lastSuccessfulAt = "";
  for (const result of results) {
    const actualMarketDate = result.bars[result.bars.length - 1]?.date ?? result.freshness.marketDate;
    if (!marketDate
      || (marketDateBoundary === "latest" && actualMarketDate > marketDate)
      || (marketDateBoundary === "earliest" && actualMarketDate < marketDate)) {
      marketDate = actualMarketDate;
    }
    if (!lastSuccessfulAt || result.freshness.lastSuccessfulAt < lastSuccessfulAt) {
      lastSuccessfulAt = result.freshness.lastSuccessfulAt;
    }
  }

  return {
    state: results.some((result) => result.freshness.state === "stale")
      ? "stale"
      : results.some((result) => result.freshness.state === "fresh")
        ? "fresh"
        : "cache",
    marketDate,
    lastSuccessfulAt,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Legacy Replit-era user/playbook/settings/session routes removed 2026-07-11:
  // unauthenticated raw-:userId access over tables that included a plaintext
  // password column. Zero client references since the redesign (PR #27).
  // Accounts return via Better Auth in P2 (platform/PLAN.md).

  app.get("/api/tiingo/fundamentals/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const upperTicker = ticker.toUpperCase();
      
      console.log(`[Fundamentals API] Request for ${upperTicker}`);
      const result = await fetchFundamentalData(upperTicker);
      
      const transformedData = result.data.map(q => ({
        date: q.date,
        revenue: q.revenue,
        operatingIncome: q.operatingIncome,
        netIncome: q.netIncome,
        eps: q.eps,
        fcf: q.freeCashFlow,
        grossProfit: q.grossProfit,
        sharesOutstanding: q.sharesOutstanding,
        totalAssets: q.totalAssets,
        totalLiabilities: q.totalLiabilities,
        cashAndEquivalents: q.cashAndEquivalents,
        investmentsCurrent: q.investmentsCurrent,
        netDebt: q.netDebt,
        totalDebt: q.totalDebt,
        shortTermDebt: q.shortTermDebt,
        longTermDebt: q.longTermDebt
      }));
      
      console.log(`[Fundamentals API] Returning ${transformedData.length} quarters for ${upperTicker}`);
      res.json({ data: transformedData, logs: result.logs });
      
    } catch (error) {
      const unavailable = error instanceof FundamentalsUnavailableError;
      console.error(`[Fundamentals API] ${unavailable ? "Unavailable" : "Error"} for ${req.params.ticker}`);
      res.status(unavailable ? 503 : 500).json({
        error: unavailable ? "Fundamentals unavailable" : "Failed to fetch fundamentals",
        logs,
      });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/debug/fundamentals/:ticker", requireUser, async (req, res) => {
    const { ticker } = req.params;
    try {
      console.log(`[DEBUG] Fetching Tiingo Fundamentals data for ${ticker}...`);
      const result = await fetchFundamentalData(ticker.toUpperCase());
      res.json({ 
        success: true, 
        ticker: ticker.toUpperCase(),
        quarters: result.data.length, 
        data: result.data,
        logs: result.logs 
      });
    } catch (error) {
      console.error(`[DEBUG] Tiingo Fundamentals fetch failed`);
      res.status(503).json({
        success: false, 
        error: "Fundamentals unavailable"
      });
    }
  });
  
  app.get("/api/price-divergence/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const upperTicker = ticker.toUpperCase();
      
      // Log analysis start
      const analysisStartTime = Date.now();
      console.log(`[Price Divergence] Starting analysis for ${upperTicker}`);
      
      // Get fundamentals
      const result = await fetchFundamentalData(upperTicker);
      result.logs.unshift(`[Analysis] Starting full analysis for ${upperTicker}`);
      result.logs.push(`[Analysis] Fundamental data loaded: ${result.data.length} quarters available`);
      const quarterDataArray = result.data;
      if (quarterDataArray.length < 3) {
        return res.json({ error: "Insufficient data", logs: result.logs });
      }
      
      // Convert to FundamentalData format for the engine
      const fundamentals = quarterDataArray.map(q => ({
        date: q.date,
        revenue: q.revenue,
        operatingIncome: q.operatingIncome,
        netIncome: q.netIncome,
        eps: q.eps,
        fcf: q.freeCashFlow,
        grossProfit: q.grossProfit,
        // QuarterData's balance-sheet fields are optional (number | null | undefined);
        // FundamentalData wants number | null, so coerce undefined -> null
        sharesOutstanding: q.sharesOutstanding ?? null,
        totalAssets: q.totalAssets ?? null,
        totalLiabilities: q.totalLiabilities ?? null,
        cashAndEquivalents: q.cashAndEquivalents ?? null,
        investmentsCurrent: q.investmentsCurrent ?? null,
        totalDebt: q.totalDebt ?? null,
        shortTermDebt: q.shortTermDebt ?? null,
        longTermDebt: q.longTermDebt ?? null,
        netDebt: q.netDebt ?? null
      }));

      // Run company analysis using the engine (includes margin acceleration with absolute deltas)
      result.logs.push(`[Engine] Running divergence engine analysis...`);
      const analysis = CompanyDivergenceEngine.analyzeCompany(upperTicker, fundamentals);
      result.logs.push(`[Engine] Analysis complete`);
      
      if ("error" in analysis) {
        return res.json({ error: analysis.error });
      }
      
      // Get price data for divergence
      let priceData: DailyBar[];
      let marketDataFreshness: MarketDataFreshness;
      try {
        const marketData = await tiingoMarketDataCache.getOrFetch(
          upperTicker,
          () => fetchTiingoDailyBars(upperTicker),
        );
        priceData = marketData.bars;
        marketDataFreshness = marketData.freshness;
      } catch {
        result.logs.push("[Tiingo Price] Required market data is unavailable");
        return res.status(503).json({ error: "Required market data is unavailable", logs: result.logs });
      }

      result.logs.push(`[Tiingo Price] Using ${priceData.length} verified daily bars`);
      let priceChange3m: number | null = null;
      const latestRecord = priceData[priceData.length - 1];
      if (latestRecord) {
        result.logs.push(`[Tiingo Price] Latest: ${latestRecord.date} - O:${latestRecord.open} H:${latestRecord.high} L:${latestRecord.low} C:${latestRecord.close} V:${latestRecord.volume}`);

        // Calculate 30-day price change
        const thirtyDaysAgo = new Date(latestRecord.date);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recent = latestRecord;
        const oldData = [...priceData].reverse().find((price) => new Date(price.date) <= thirtyDaysAgo);

        if (recent && oldData) {
          priceChange3m = ((recent.close - oldData.close) / oldData.close) * 100;
          result.logs.push(`[Tiingo Price] 30d comparison: ${oldData.date} ($${oldData.close}) → ${recent.date} ($${recent.close}) = ${priceChange3m.toFixed(2)}%`);
        } else {
          result.logs.push(`[Tiingo Price] Could not calculate 30d change - insufficient history`);
        }
      }
      
      // Calculate divergence strength and type for frontend compatibility
      const revenueAccel = analysis.revenueAcceleration?.qoq ?? null;
      let divergenceType: "BULLISH" | "BEARISH" | "ALIGNED" | "UNKNOWN" = "UNKNOWN";
      let description = "Insufficient data";
      let strength = 0;
      
      if (revenueAccel !== null && priceChange3m !== null) {
        const expectedPriceChange = revenueAccel * 0.7;
        const divergence = Math.abs(priceChange3m - expectedPriceChange);
        strength = Math.min(100, (divergence / 15) * 100);
        
        const fundamentalsAccelerating = revenueAccel > 0;
        const priceRising = priceChange3m > 0;
        
        if (fundamentalsAccelerating === priceRising) {
          divergenceType = "ALIGNED";
          description = "Business fundamentals and stock price moving in sync";
        } else if (priceRising && !fundamentalsAccelerating) {
          divergenceType = "BULLISH";
          description = "Business accelerating but stock falling - Market ignoring the turnaround";
        } else if (!priceRising && fundamentalsAccelerating) {
          divergenceType = "BEARISH";
          description = "Business slowing but stock rising - Market in denial about slowdown";
        } else {
          divergenceType = "ALIGNED";
          description = "Business fundamentals and stock price moving in sync";
        }
      }
      
      // Log analysis results
      result.logs.push(`[Analysis] Divergence type: ${divergenceType}, strength: ${strength.toFixed(1)}%`);
      result.logs.push(`[Analysis] Description: ${description}`);
      if (revenueAccel !== null) {
        result.logs.push(`[Analysis] Revenue acceleration (QoQ): ${revenueAccel.toFixed(2)}%`);
      }
      if (priceChange3m !== null) {
        result.logs.push(`[Analysis] Price change (30d): ${priceChange3m.toFixed(2)}%`);
      }
      
      // Include raw quarterly fundamentals for KINE AI to analyze independently
      // KINE will calculate accelerations from this raw data
      const rawFundamentals = quarterDataArray.slice(0, 8).map(q => ({
        date: q.date,
        revenue: q.revenue,
        operatingIncome: q.operatingIncome,
        netIncome: q.netIncome,
        eps: q.eps,
        freeCashFlow: q.freeCashFlow,
        grossProfit: q.grossProfit,
        sharesOutstanding: q.sharesOutstanding,
        totalAssets: q.totalAssets,
        totalLiabilities: q.totalLiabilities,
        cashAndEquivalents: q.cashAndEquivalents,
        totalDebt: q.totalDebt,
        shortTermDebt: q.shortTermDebt,
        longTermDebt: q.longTermDebt
      }));
      
      // Log KINE raw fundamentals summary
      result.logs.push(`[KINE Input] Sending ${rawFundamentals.length} quarters of raw fundamentals`);
      if (rawFundamentals.length > 0) {
        const latest = rawFundamentals[0];
        result.logs.push(`[KINE Input] Latest Q (${latest.date}): Rev=${latest.revenue === null ? "unavailable" : `$${(latest.revenue / 1e9).toFixed(2)}B`}, NetInc=${latest.netIncome === null ? "unavailable" : `$${(latest.netIncome / 1e9).toFixed(2)}B`}, EPS=${latest.eps?.toFixed(2) ?? "unavailable"}`);
        if (rawFundamentals.length > 1) {
          const prev = rawFundamentals[1];
          result.logs.push(`[KINE Input] Prev Q (${prev.date}): Rev=${prev.revenue === null ? "unavailable" : `$${(prev.revenue / 1e9).toFixed(2)}B`}, NetInc=${prev.netIncome === null ? "unavailable" : `$${(prev.netIncome / 1e9).toFixed(2)}B`}, EPS=${prev.eps?.toFixed(2) ?? "unavailable"}`);
        }
        result.logs.push(`[KINE Input] KINE will calculate QoQ/YoY growth and acceleration from this raw data`);
      }
      
      // Final timing log
      const analysisTime = Date.now() - analysisStartTime;
      result.logs.push(`[Analysis] ✓ Complete in ${analysisTime}ms - ${result.logs.length} log entries`);
      
      // Attach logs and raw fundamentals to analysis response
      return res.json({ 
        ...analysis, 
        priceChange3m, 
        strength, 
        divergenceType, 
        description, 
        logs: result.logs,
        rawFundamentals,
        marketDataFreshness,
      });
    } catch (error) {
      if (error instanceof FundamentalsUnavailableError) {
        return res.status(503).json({ error: "Fundamentals unavailable" });
      }
      console.error("[Price Divergence] Error:", error);
      res.status(500).json({ error: "Failed to calculate analysis" });
    }
  });

  app.delete("/api/cache/:ticker?", requireUser, async (req, res) => {
    try {
      const { ticker } = req.params;
      if (ticker) {
        await clearCache(ticker);
        await clearTiingoCache(ticker);
        await withFundamentalsCacheLock(ticker, async () => {
          invalidateFundamentalsCache(ticker);
          await storage.clearTickerCache(ticker);
        });
        res.json({ success: true, message: `Playbook cache cleared for ${ticker}` });
      } else {
        await clearCache();
        await clearTiingoCache();
        await withFundamentalsCacheLock(undefined, async () => {
          invalidateFundamentalsCache();
          await storage.clearTickerCache();
        });
        res.json({ success: true, message: "All caches cleared" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  // Cache status endpoint - shows what's in the global cache
  // This helps debug cache hit/miss issues
  app.get("/api/cache/status", async (req, res) => {
    try {
      const stats = await getCacheStats();
      const tickers = Object.fromEntries(Object.entries(stats.tickers).map(([ticker, entry]) => [ticker, {
        ...entry,
        marketDate: entry.marketDate,
        lastSuccessfulAt: entry.lastSuccessfulAt,
        lastAttemptAt: entry.lastAttemptAt,
        nextRetryAt: entry.nextRetryAt,
        lastError: entry.lastError,
      }]));
      res.json({
        message: "Global Tiingo cache status (shared across all users)",
        lastUpdated: stats.lastUpdated,
        tickerCount: Object.keys(tickers).length,
        tickers,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get cache status" });
    }
  });

  // --- FEARLAB LIVE BUCKET API -------------------------------------------
  // Public, all-free (no auth), covered by the global generalLimiter +
  // apiLimiter on /api/ (server/security.ts); GET = CSRF-exempt by method.
  // Serves the nightly artifacts the Railway worker publishes to the
  // S3-compatible bucket (see server/fearlab-live.ts for the layout).
  // Bucket credentials stay server-side only — nothing here is VITE_-inlined.
  //
  // Status mapping: bucket disabled/unreachable => 503, missing object => 404
  // — the client falls back to the static /fearlab/*.json snapshot on !ok.
  // Exception: /api/fearlab/board falls back SERVER-side to the vendored
  // snapshot (live:false) so the board always answers 200.

  const FEARLAB_DATA_CACHE = "public, max-age=300"; // worker publishes 1x/night

  const sendFearlabResult = <T>(res: Response, result: LiveFetchResult<T>): void => {
    if (!result.ok) {
      if (result.reason === "not_found") {
        res.status(404).json({ error: "artifact not found" });
      } else {
        res.status(503).json({ error: "live data unavailable" });
      }
      return;
    }
    res.set("Cache-Control", FEARLAB_DATA_CACHE);
    res.json(result.data);
  };

  // Board: live board.v1 with {live, stale, age_hours} envelope fields;
  // falls back to the static snapshot (live:false) when the bucket is out.
  app.get("/api/fearlab/board", async (_req, res) => {
    try {
      const result = await getRunArtifact<BoardV1>("board/v1/board.json");
      if (result.ok) {
        const age = ageHours(result.data.generated);
        res.set("Cache-Control", FEARLAB_DATA_CACHE);
        return res.json({
          ...result.data,
          live: true,
          age_hours: age,
          stale: age == null ? true : age > STALE_AFTER_HOURS,
        });
      }
      // Fallback: vendored static snapshot (see import comment). Its age says
      // nothing about the live feed -> stale:true.
      res.set("Cache-Control", FEARLAB_DATA_CACHE);
      res.json({ ...(fearlabBoardSnapshot as object), live: false, age_hours: null, stale: true });
    } catch (error: any) {
      console.error("[FearLab] board route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load board" });
    }
  });

  // Per-combo payload (combo.v1). Key = board combos[].key, e.g.
  // "spy-1d-full-v4.6". Strict pattern blocks key/path traversal.
  app.get("/api/fearlab/combo/:key", async (req, res) => {
    try {
      const key = String(req.params.key);
      if (!/^[a-z0-9][a-z0-9.-]*$/.test(key) || key.length > 80) {
        return res.status(400).json({ error: "invalid combo key" });
      }
      sendFearlabResult(res, await getRunArtifact<ComboV1>(`combos/v1/${key}.json`));
    } catch (error: any) {
      console.error("[FearLab] combo route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load combo" });
    }
  });

  // Daily signals (signals.v1): latest + by trading date.
  app.get("/api/fearlab/signals/latest", async (_req, res) => {
    try {
      sendFearlabResult(res, await getRunArtifact<SignalsV1>("signals/v1/latest.json"));
    } catch (error: any) {
      console.error("[FearLab] signals route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load signals" });
    }
  });

  app.get("/api/fearlab/signals/:date", async (req, res) => {
    try {
      const date = String(req.params.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "invalid date (expected YYYY-MM-DD)" });
      }
      // History read: each run dir carries only ITS OWN dated signals file
      // (runs/<td>/signals/v1/<td>.json), so resolve runs/<date>/ directly
      // instead of through the latest pointer (which would 404 for any date
      // other than the latest trading date).
      sendFearlabResult(res, await getDatedRunArtifact<SignalsV1>(date, `signals/v1/${date}.json`));
    } catch (error: any) {
      console.error("[FearLab] signals route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load signals" });
    }
  });

  // Per-symbol chart payload (chart.v1). Uppercase key in the bucket.
  app.get("/api/fearlab/charts/:sym", async (req, res) => {
    try {
      const sym = String(req.params.sym).toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(sym)) {
        return res.status(400).json({ error: "invalid symbol" });
      }
      sendFearlabResult(res, await getRunArtifact<ChartV1>(`charts/v1/${sym}.json`));
    } catch (error: any) {
      console.error("[FearLab] charts route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load chart" });
    }
  });

  // Health: pointer freshness (never 503s — {live:false} when bucket is out).
  app.get("/api/fearlab/health", async (_req, res) => {
    try {
      const pointer = fearlabLiveConfigured() ? await getLatestPointer() : null;
      if (!pointer) {
        return res.json({ live: false, trading_date: null, generated: null, age_hours: null });
      }
      const age = ageHours(pointer.generated);
      res.json({
        live: true,
        trading_date: pointer.trading_date,
        generated: pointer.generated,
        age_hours: age,
        stale: age == null ? true : age > STALE_AFTER_HOURS,
      });
    } catch (error: any) {
      console.error("[FearLab] health route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to read health" });
    }
  });

  // --- SEO: dynamic sitemap.xml ------------------------------------------
  // Served dynamically (not a static public/ file) because the per-report
  // /lab/<key> URLs are engine-version-stamped (spy-1d-full-v4.6, qqq-1d-
  // full-v4.2, …) and change on every version bump — a hand-kept list drifts.
  // Report keys come from the live board (server-side fallback to the vendored
  // snapshot, so the sitemap answers even when the bucket is out). robots.txt
  // is the static public/robots.txt and points here. /account is intentionally
  // absent (auth-gated, nothing to index; also disallowed in robots.txt).
  const SITE_ORIGIN = "https://kinefractal.com";
  const SITEMAP_STATIC: { path: string; changefreq: string; priority: string }[] = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/lab", changefreq: "daily", priority: "0.9" },
    { path: "/charts/", changefreq: "daily", priority: "0.8" },
    { path: "/alerts", changefreq: "weekly", priority: "0.7" },
    { path: "/about", changefreq: "monthly", priority: "0.7" },
    { path: "/ratio-relevance", changefreq: "weekly", priority: "0.6" },
    { path: "/sector-rotation", changefreq: "weekly", priority: "0.6" },
    { path: "/legal/disclaimer", changefreq: "yearly", priority: "0.2" },
    { path: "/legal/privacy", changefreq: "yearly", priority: "0.2" },
  ];

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      // Live board -> vendored snapshot fallback (same source the board route uses).
      let combos: BoardV1["combos"] = [];
      try {
        const live = await getRunArtifact<BoardV1>("board/v1/board.json");
        const board = live.ok ? live.data : (fearlabBoardSnapshot as unknown as BoardV1);
        combos = board.combos ?? [];
      } catch {
        combos = ((fearlabBoardSnapshot as unknown as BoardV1).combos) ?? [];
      }
      const reportKeys = Array.from(
        new Set(
          combos
            .map((c) => c.key)
            .filter((k): k is string => typeof k === "string" && /^[a-z0-9][a-z0-9.-]*$/.test(k)),
        ),
      ).sort();

      const entries = [
        ...SITEMAP_STATIC.map((r) => ({ loc: `${SITE_ORIGIN}${r.path}`, changefreq: r.changefreq, priority: r.priority })),
        ...reportKeys.map((k) => ({ loc: `${SITE_ORIGIN}/lab/${k}`, changefreq: "daily", priority: "0.5" })),
      ];

      const body =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        entries
          .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
          .join("\n") +
        `\n</urlset>\n`;

      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(body);
    } catch (error: any) {
      console.error("[sitemap] route error:", error?.message ?? error);
      res.status(500).send("sitemap unavailable");
    }
  });

  // /charts/: the page document is this repo's server/charts-app/charts.html;
  // its data sidecars proxy the bucket's charts-app/ run prefix (see
  // server/fearlab-charts.ts for layout, CSP override, and per-account routes).
  registerFearlabChartsRoutes(app);
  registerAccountRoutes(app);
  registerAlertsRoutes(app);

  // Tiingo API Proxy Route with Daily Caching
  // Server-side cache is shared across ALL users globally
  // Once any user fetches a ticker, all subsequent users get cached data
  app.get("/api/tiingo/:ticker", async (req, res) => {
    try {
      const { ticker } = req.params;
      const upperTicker = ticker.toUpperCase();
      const marketData = await tiingoMarketDataCache.getOrFetch(
        upperTicker,
        () => fetchTiingoDailyBars(upperTicker),
      );
      res.setHeader("X-Market-Data-State", marketData.freshness.state);
      res.setHeader("X-Market-Data-As-Of", marketData.freshness.marketDate);
      return res.json(marketData.bars);
    } catch (error) {
      console.error("[Tiingo Proxy] Market data unavailable");
      if (!tiingoApiKey()) {
        return res.status(401).json({ error: "Tiingo API key not configured on server" });
      }
      if (error instanceof MarketDataUnavailableError) {
        return res.status(error.upstreamStatus ?? 503).json({ error: "Market data is unavailable" });
      }
      return res.status(503).json({ error: "Market data is unavailable" });
    }
  });

  // --- SECTOR ROTATION BULK ENDPOINT ---
  // Returns all cached data for sector rotation tickers in one request
  // If cache is complete, Person B gets instant data without hitting API
  app.get("/api/sector-rotation/bulk", async (req, res) => {
    try {
      if (!tiingoApiKey()) {
        return res.status(401).json({ error: "Tiingo API key not configured" });
      }
      const SECTOR_TICKERS = ['SPY', 'XLK', 'XLF', 'XLV', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLRE', 'XLU', 'XLC'];
      const MACRO_TICKERS = ['SPY', 'XLE', 'GLD', 'IWM', 'IVW', 'IVE', 'DBC', 'UUP', 'IEF', 'VXX'];
      
      const allTickers = Array.from(new Set([...SECTOR_TICKERS, ...MACRO_TICKERS]));
      const data: Record<string, DailyBar[]> = {};
      const results: MarketDataResult[] = [];
      const missing: string[] = [];

      for (let index = 0; index < allTickers.length; index += 1) {
        const ticker = allTickers[index]!;
        try {
          const marketData = await tiingoMarketDataCache.getOrFetch(
            ticker,
            () => fetchTiingoDailyBars(ticker),
          );
          data[ticker] = marketData.bars;
          results.push(marketData);
        } catch {
          missing.push(ticker);
        }

        // Intentionally sequential: this endpoint may warm several cold tickers.
        if (index < allTickers.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (missing.length > 0) {
        console.error(`[Sector Rotation] Required market data unavailable: ${missing.join(", ")}`);
        return res.status(503).json({ error: "Required market data is unavailable", missing });
      }

      const freshness = aggregateMarketDataFreshness(results);
      return res.json({
        status: 'complete',
        cacheDate: freshness.marketDate,
        tickerCount: Object.keys(data).length,
        data,
        freshness,
      });
    } catch (error: any) {
      console.error("[Sector Rotation] Bulk endpoint failed");
      res.status(503).json({ error: "Required market data is unavailable", missing: [] });
    }
  });

  // /api/save-sector-data removed 2026-07-11: unauthenticated write endpoint
  // (container FS is ephemeral anyway); the sector page reads the committed
  // client/public/sector-data.json.

  // --- GEMINI AI ANALYSIS ---
  // Non-streaming endpoint for simple analysis
  app.post("/api/gemini/analyze", requireUser, async (req, res) => {
    try {
      const analysisData: AnalysisData = req.body;
      
      if (!analysisData.ticker) {
        return res.status(400).json({ error: "Missing ticker in analysis data" });
      }
      
      console.log(`[Gemini] Analyzing ${analysisData.ticker}...`);
      const lines = await analyzeWithGemini(analysisData);
      
      res.json({ lines });
    } catch (error: any) {
      console.error("[Gemini] Analysis error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Streaming endpoint for real-time terminal output
  app.post("/api/gemini/analyze/stream", requireUser, async (req, res) => {
    try {
      const analysisData: AnalysisData = req.body;
      
      if (!analysisData.ticker) {
        return res.status(400).json({ error: "Missing ticker in analysis data" });
      }
      
      console.log(`[Gemini] Streaming analysis for ${analysisData.ticker}...`);
      
      // Set up Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      
      const generator = streamAnalyzeWithGemini(analysisData);
      
      for await (const line of generator) {
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
      }
      
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      
    } catch (error: any) {
      console.error("[Gemini] Streaming error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // Streaming endpoint for ratio Z-score analysis (KINE AI on homepage terminal)
  app.post("/api/gemini/analyze/ratios", requireUser, async (req, res) => {
    try {
      const ratios: RatioData[] = req.body.ratios;
      
      if (!ratios || !Array.isArray(ratios) || ratios.length === 0) {
        return res.status(400).json({ error: "Missing or invalid ratios data" });
      }
      
      console.log(`[Gemini] Streaming ratio Z-score analysis...`);
      
      // Set up Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      
      const generator = streamAnalyzeRatioZScores(ratios);
      
      for await (const line of generator) {
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
      }
      
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      
    } catch (error: any) {
      console.error("[Gemini] Ratio analysis streaming error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // Streaming endpoint for Ratio Relevance analysis (KINE AI capital flow expert)
  app.post("/api/gemini/analyze/ratio-relevance", requireUser, async (req, res) => {
    try {
      const ratioData: RatioRelevanceData = req.body;
      
      if (!ratioData || !ratioData.modules) {
        return res.status(400).json({ error: "Missing or invalid ratio relevance data" });
      }
      
      console.log(`[Gemini] Streaming Ratio Relevance analysis...`);
      
      // Set up Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      
      const generator = streamAnalyzeRatioRelevance(ratioData);
      
      for await (const line of generator) {
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
      }
      
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      
    } catch (error: any) {
      console.error("[Gemini] Ratio Relevance streaming error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // --- USD CORRELATION ANALYSIS ---
  // Calculate rolling PRICE correlations (not returns) of various assets vs USD (UUP)
  // Uses Python script with yfinance for accurate calculations
  // No caching - always fetch fresh data from yfinance (no rate limit concerns like Tiingo)
  app.get("/api/correlations/usd", async (req, res) => {
    try {
      console.log("[USD Correlation] Running Python yfinance calculation (no cache)...");

      // Spawn Python script
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['-u', 'server/python/usd_correlations.py']);
      
      let stdout = '';
      let stderr = '';
      
      // Set timeout (25 seconds)
      const timeout = setTimeout(() => {
        pythonProcess.kill();
      }, 25000);
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Wait for process to complete
      const exitCode = await new Promise<number>((resolve) => {
        pythonProcess.on('close', (code) => {
          clearTimeout(timeout);
          resolve(code || 0);
        });
        pythonProcess.on('error', (err) => {
          clearTimeout(timeout);
          console.error("[USD Correlation] Python process error:", err.message);
          resolve(1);
        });
      });
      
      if (exitCode !== 0) {
        console.error("[USD Correlation] Python script failed:", stderr);
        return res.status(500).json({ 
          error: "Python correlation calculation failed",
          details: stderr || "Unknown error"
        });
      }
      
      // Parse JSON output
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (parseErr) {
        console.error("[USD Correlation] Failed to parse Python output:", stdout.slice(0, 500));
        return res.status(500).json({ 
          error: "Failed to parse correlation results",
          details: "Invalid JSON from Python script"
        });
      }
      
      if (!result.success) {
        console.error("[USD Correlation] Python script returned error:", result.error);
        return res.status(500).json({ error: result.error || "Calculation failed" });
      }
      
      console.log(`[USD Correlation] Fresh calculation complete. ${result.correlations?.length || 0} assets analyzed.`);
      
      res.json(result);

    } catch (error: any) {
      console.error("[USD Correlation] Error:", error.message);
      res.status(500).json({ error: error.message || "Failed to calculate correlations" });
    }
  });

  // --- RATIO RELEVANCE (Macro-Flows) ---
  // Calculate intermarket ratios, momentum (5-day ROC), and trend signals (20-day SMA)
  app.get("/api/ratio-relevance", async (req, res) => {
    try {
      if (!tiingoApiKey()) {
        return res.status(401).json({ error: "Tiingo API key not configured" });
      }

      console.log("[Ratio Relevance] Starting intermarket analysis...");

      // All ETF proxies needed for the analysis
      const tickers = [
        "UUP",   // Dollar
        "IEF",   // 10Y Yield Proxy (inverse)
        "TLT",   // Treasury Bonds
        "IVW",   // Growth
        "IVE",   // Value
        "XLY",   // Consumer Discretionary
        "XLP",   // Consumer Staples
        "DBC",   // Commodities
        "CPER",  // Copper
        "GLD",   // Gold
        "SPY",   // S&P 500
        "VIXY",  // Short Term Vol
        "VXZ",   // Mid Term Vol
        "KRE",   // Regional Banks
        "VXX"    // Volatility
      ];

      // Fetch sequentially: a cold matrix can otherwise breach the Tiingo free-tier limit.
      const marketMatrix = new Map<string, DailyBar[]>();
      const marketDataResults: MarketDataResult[] = [];
      const missing: string[] = [];
      for (let index = 0; index < tickers.length; index += 1) {
        const ticker = tickers[index]!;
        try {
          const marketData = await tiingoMarketDataCache.getOrFetch(
            ticker,
            () => fetchTiingoDailyBars(ticker),
          );
          marketMatrix.set(ticker, marketData.bars);
          marketDataResults.push(marketData);
        } catch {
          missing.push(ticker);
        }

        if (index < tickers.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (missing.length > 0) {
        return res.status(503).json({ error: "Required market data is unavailable", missing });
      }
      let commonDates: string[];
      try {
        requireCompleteMarketMatrix(tickers, marketMatrix);
        commonDates = requireCommonMarketHistory(tickers, marketMatrix, 756);
      } catch (error) {
        if (error instanceof MarketMatrixUnavailableError) {
          return res.status(503).json({ error: "Required market data is unavailable", missing: error.missing });
        }
        throw error;
      }

      const tickerMap = Object.fromEntries(marketMatrix.entries()) as Record<string, DailyBar[]>;
      
      // Get last 756 trading days for fractal momentum analysis (3 years)
      const recentDates = commonDates.slice(-756);
      const freshness = {
        ...aggregateMarketDataFreshness(marketDataResults, "earliest"),
        marketDate: recentDates[recentDates.length - 1],
      };

      // Helper: Get price for ticker on date (uses adjusted close to handle stock splits)
      const getPrice = (ticker: string, date: string): number | null => {
        const data = tickerMap[ticker];
        if (!data) return null;
        const record = data.find((d: any) => d.date === date);
        return record ? (record.adjClose || record.close) : null;
      };

      // Helper: Get OHLC for ticker on date (for volatility calculation)
      const getOHLC = (ticker: string, date: string): { open: number; high: number; low: number; close: number } | null => {
        const data = tickerMap[ticker];
        if (!data) return null;
        const record = data.find((d: any) => d.date === date);
        return record ? { open: record.open, high: record.high, low: record.low, close: record.close } : null;
      };

      // Helper: Calculate ratio time series
      const calculateRatioSeries = (tickerA: string, tickerB: string): { date: string; ratio: number }[] => {
        const series: { date: string; ratio: number }[] = [];
        for (const date of recentDates) {
          const priceA = getPrice(tickerA, date);
          const priceB = getPrice(tickerB, date);
          if (priceA && priceB && priceB !== 0) {
            series.push({ date, ratio: priceA / priceB });
          }
        }
        return series;
      };

      // Helper: Calculate ROC (Rate of Change) as percentage for a specific lookback
      const calculateROC = (series: { date: string; ratio: number }[], days: number = 5): number => {
        if (series.length < days + 1) return 0;
        const current = series[series.length - 1].ratio;
        const past = series[series.length - 1 - days].ratio;
        if (past === 0) return 0;
        return ((current - past) / past) * 100;
      };

      // Helper: Calculate Fractal ROC for multiple timeframes (5D, 21D, 79D)
      // Formula: (Price / Price N days ago) - 1, expressed as percentage
      const calculateFractalROC = (series: { date: string; ratio: number }[]): { momentum5D: number; momentum21D: number; momentum79D: number } => {
        const calcMomentum = (days: number): number => {
          if (series.length < days + 1) return 0;
          const current = series[series.length - 1].ratio;
          const past = series[series.length - 1 - days].ratio;
          if (past === 0) return 0;
          return ((current / past) - 1) * 100;
        };
        return {
          momentum5D: calcMomentum(5),   // 1 Week
          momentum21D: calcMomentum(21), // 1 Month
          momentum79D: calcMomentum(79)  // 1 Quarter
        };
      };

      // Helper: Calculate SMA
      const calculateSMA = (series: { date: string; ratio: number }[], period: number = 20): number => {
        if (series.length < period) return series.length > 0 ? series[series.length - 1].ratio : 0;
        const slice = series.slice(-period);
        const sum = slice.reduce((acc, item) => acc + item.ratio, 0);
        return sum / period;
      };

      // Helper: Determine trend signal
      const getTrendSignal = (series: { date: string; ratio: number }[]): "Trend Up" | "Trend Down" | "Neutral" => {
        if (series.length === 0) return "Neutral";
        const current = series[series.length - 1].ratio;
        const sma20 = calculateSMA(series, 20);
        if (current > sma20 * 1.001) return "Trend Up";  // Small buffer for noise
        if (current < sma20 * 0.999) return "Trend Down";
        return "Neutral";
      };

      // Calculate Dollar-Yield ratio (UUP / IEF) for Wrecking Ball
      // Note: IEF drops when yields rise, so UUP rising + IEF dropping = ratio spikes UP = Maximum Stress
      const dollarYieldSeries: { date: string; ratio: number }[] = [];
      for (const date of recentDates) {
        const uup = getPrice("UUP", date);
        const ief = getPrice("IEF", date);
        if (uup && ief && ief !== 0) {
          dollarYieldSeries.push({ date, ratio: uup / ief });
        }
      }

      // Calculate all ratio modules
      const ratioModules = {
        // 1. WRECKING BALL (Liquidity Constraints)
        wreckingBall: {
          dollarYield: (() => {
            const mean = dollarYieldSeries.length > 0 ? dollarYieldSeries.reduce((sum, d) => sum + d.ratio, 0) / dollarYieldSeries.length : 0;
            return {
              name: "Dollar / Yield Proxy",
              description: "UUP / IEF (Inverse Yield)",
              current: dollarYieldSeries.length > 0 ? dollarYieldSeries[dollarYieldSeries.length - 1].ratio : 0,
              momentum: calculateROC(dollarYieldSeries),
              ...calculateFractalROC(dollarYieldSeries),
              signal: getTrendSignal(dollarYieldSeries),
              stress: (() => {
                // Check if both UUP rising AND IEF falling (yields rising)
                const uupData = tickerMap["UUP"] || [];
                const iefData = tickerMap["IEF"] || [];
                if (uupData.length < 5 || iefData.length < 5) return "UNKNOWN";
                const uupChange = ((uupData[uupData.length - 1].close - uupData[uupData.length - 5].close) / uupData[uupData.length - 5].close) * 100;
                const iefChange = ((iefData[iefData.length - 1].close - iefData[iefData.length - 5].close) / iefData[iefData.length - 5].close) * 100;
                if (uupChange > 0.5 && iefChange < -0.5) return "MAXIMUM STRESS";
                if (uupChange > 0.2 || iefChange < -0.2) return "ELEVATED";
                return "NORMAL";
              })(),
              timeSeries: dollarYieldSeries.map(d => ({ date: d.date, value: d.ratio })),
              mean
            };
          })(),
          banksVsBonds: (() => {
            const series = calculateRatioSeries("KRE", "TLT");
            const mean = series.length > 0 ? series.reduce((sum, d) => sum + d.ratio, 0) / series.length : 0;
            return {
              name: "Banks vs Bonds",
              description: "KRE / TLT",
              current: series.length > 0 ? series[series.length - 1].ratio : 0,
              momentum: calculateROC(series),
              ...calculateFractalROC(series),
              signal: getTrendSignal(series),
              timeSeries: series.map(d => ({ date: d.date, value: d.ratio })),
              mean
            };
          })()
        },

        // 2. ROTATION (Growth & Consumer)
        rotation: {
          growthVsValue: (() => {
            const series = calculateRatioSeries("IVW", "IVE");
            const momentum = calculateROC(series);
            const fractal = calculateFractalROC(series);
            const mean = series.length > 0 ? series.reduce((sum, d) => sum + d.ratio, 0) / series.length : 0;
            return {
              name: "Growth vs Value",
              description: "IVW / IVE",
              current: series.length > 0 ? series[series.length - 1].ratio : 0,
              momentum,
              ...fractal,
              signal: getTrendSignal(series),
              riskMode: fractal.momentum5D > 0 ? "RISK ON" : "RISK OFF",
              timeSeries: series.map(d => ({ date: d.date, value: d.ratio })),
              mean
            };
          })(),
          consumerHealth: (() => {
            const series = calculateRatioSeries("XLY", "XLP");
            const fractal = calculateFractalROC(series);
            const mean = series.length > 0 ? series.reduce((sum, d) => sum + d.ratio, 0) / series.length : 0;
            return {
              name: "Consumer Health",
              description: "XLY / XLP",
              current: series.length > 0 ? series[series.length - 1].ratio : 0,
              momentum: calculateROC(series),
              ...fractal,
              signal: getTrendSignal(series),
              timeSeries: series.map(d => ({ date: d.date, value: d.ratio })),
              mean
            };
          })()
        },

        // 3. INFLATION VS DEFLATION
        inflationDeflation: {
          thingsVsPaper: (() => {
            const series = calculateRatioSeries("DBC", "TLT");
            const fractal = calculateFractalROC(series);
            const mean = series.length > 0 ? series.reduce((sum, d) => sum + d.ratio, 0) / series.length : 0;
            return {
              name: "Commodity Strength",
              description: "DBC / TLT",
              current: series.length > 0 ? series[series.length - 1].ratio : 0,
              momentum: calculateROC(series),
              ...fractal,
              signal: getTrendSignal(series),
              regime: fractal.momentum5D > 0 ? "REFLATION" : "DEFLATION",
              timeSeries: series.map(d => ({ date: d.date, value: d.ratio })),
              mean
            };
          })(),
          ecoHealth: (() => {
            const series = calculateRatioSeries("CPER", "GLD");
            const fractal = calculateFractalROC(series);
            const mean = series.length > 0 ? series.reduce((sum, d) => sum + d.ratio, 0) / series.length : 0;
            return {
              name: "Eco Health",
              description: "CPER / GLD (Copper / Gold)",
              current: series.length > 0 ? series[series.length - 1].ratio : 0,
              momentum: calculateROC(series),
              ...fractal,
              signal: getTrendSignal(series),
              regime: fractal.momentum5D > 0 ? "REFLATION" : "STAGNATION/FEAR",
              timeSeries: series.map(d => ({ date: d.date, value: d.ratio })),
              mean
            };
          })(),
          capitalFlight: (() => {
            const series = calculateRatioSeries("GLD", "SPY");
            const fractal = calculateFractalROC(series);
            const mean = series.length > 0 ? series.reduce((sum, d) => sum + d.ratio, 0) / series.length : 0;
            return {
              name: "Capital Flight",
              description: "GLD / SPY",
              current: series.length > 0 ? series[series.length - 1].ratio : 0,
              momentum: calculateROC(series),
              ...fractal,
              signal: getTrendSignal(series),
              regime: fractal.momentum5D > 0 ? "RISK-OFF" : "RISK-ON",
              timeSeries: series.map(d => ({ date: d.date, value: d.ratio })),
              mean
            };
          })()
        },

        // 4. GAMMA/VOL REGIME (Term Structure Proxy)
        gammaVol: (() => {
          const series = calculateRatioSeries("VIXY", "VXZ");
          const current = series.length > 0 ? series[series.length - 1].ratio : 0;
          const fractal = calculateFractalROC(series);
          const mean = series.length > 0 ? series.reduce((sum, d) => sum + d.ratio, 0) / series.length : 0;
          // VIXY > VXZ means short-term vol > mid-term vol = Backwardation
          const isBackwardation = current > 1;
          return {
            name: "Vol Term Structure",
            description: "VIXY / VXZ",
            current,
            momentum: calculateROC(series),
            ...fractal,
            signal: getTrendSignal(series),
            regime: isBackwardation ? "BACKWARDATION / HIGH STRESS" : "CONTANGO / STABLE",
            isStressed: isBackwardation,
            timeSeries: series.map(d => ({ date: d.date, value: d.ratio })),
            mean
          };
        })(),

        // 5. OUTLIER SCANNER - Now with relative volatility analysis
        outlierScanner: (() => {
          const ROLLING_WINDOW = 20; // 20-day rolling average
          const lastDate = recentDates[recentDates.length - 1];
          const lastDateIdx = recentDates.length - 1;
          
          const tickerNames: Record<string, string> = {
            "UUP": "Dollar",
            "IEF": "10Y Yield Proxy",
            "TLT": "Treasury Bonds",
            "IVW": "Growth",
            "IVE": "Value",
            "XLY": "Discretionary",
            "XLP": "Staples",
            "DBC": "Commodities",
            "CPER": "Copper",
            "GLD": "Gold",
            "SPY": "S&P 500",
            "VIXY": "Short Term Vol",
            "VXZ": "Mid Term Vol",
            "KRE": "Regional Banks",
            "VXX": "Volatility"
          };

          // Calculate daily range for each ticker over rolling window
          const volatilities: { 
            ticker: string; 
            name: string;
            todayRange: number;      // Today's daily range %
            avgRange: number;        // 20-day average daily range %
            rangeRatio: number;      // Today / Avg (e.g., 2.4 means 2.4× average)
            rangeZ: number;          // Z-score: (today - avg) / stdev
            isUnusual: boolean;      // Z >= 2
          }[] = [];

          for (const ticker of tickers) {
            // Get today's OHLC
            const todayOHLC = getOHLC(ticker, lastDate);
            if (!todayOHLC || todayOHLC.open <= 0) continue;
            
            const todayRange = Math.abs(todayOHLC.high - todayOHLC.low) / todayOHLC.open * 100;
            
            // Calculate historical daily ranges for rolling window
            const historicalRanges: number[] = [];
            const windowStart = Math.max(0, lastDateIdx - ROLLING_WINDOW);
            
            for (let i = windowStart; i < lastDateIdx; i++) {
              const date = recentDates[i];
              const ohlc = getOHLC(ticker, date);
              if (ohlc && ohlc.open > 0) {
                const range = Math.abs(ohlc.high - ohlc.low) / ohlc.open * 100;
                historicalRanges.push(range);
              }
            }
            
            // Calculate average and standard deviation
            let avgRange = 0;
            let stdev = 0;
            
            if (historicalRanges.length > 0) {
              avgRange = historicalRanges.reduce((sum, r) => sum + r, 0) / historicalRanges.length;
              
              if (historicalRanges.length > 1) {
                const variance = historicalRanges.reduce((sum, r) => sum + Math.pow(r - avgRange, 2), 0) / historicalRanges.length;
                stdev = Math.sqrt(variance);
              }
            }
            
            // Calculate relative metrics
            const rangeRatio = avgRange > 0 ? todayRange / avgRange : 1;
            const rangeZ = stdev > 0 ? (todayRange - avgRange) / stdev : 0;
            const isUnusual = rangeZ >= 2;
            
            volatilities.push({
              ticker,
              name: tickerNames[ticker] || ticker,
              todayRange,
              avgRange,
              rangeRatio,
              rangeZ,
              isUnusual
            });
          }

          // Sort by Z-score descending (most unusual relative to self)
          volatilities.sort((a, b) => b.rangeZ - a.rangeZ);
          
          // Also create a list sorted by absolute range for reference
          const byAbsoluteRange = [...volatilities].sort((a, b) => b.todayRange - a.todayRange);
          
          return {
            date: lastDate,
            rollingWindow: ROLLING_WINDOW,
            // Primary outlier: most unusual relative to itself
            outlier: volatilities[0] || { 
              ticker: "N/A", name: "N/A", todayRange: 0, avgRange: 0, 
              rangeRatio: 0, rangeZ: 0, isUnusual: false 
            },
            // Top 5 by relative unusualness (Z-score)
            top5ByZ: volatilities.slice(0, 5),
            // Top 5 by absolute daily range (for context)
            top5ByAbsolute: byAbsoluteRange.slice(0, 5)
          };
        })()
      };

      console.log(`[Ratio Relevance] Analysis complete. Tickers loaded: ${Object.keys(tickerMap).length}`);

      res.json({
        success: true,
        asOf: recentDates[recentDates.length - 1],
        tradingDays: recentDates.length,
        modules: ratioModules,
        freshness,
      });

    } catch {
      console.error("[Ratio Relevance] Calculation failed");
      res.status(503).json({ error: "Required market data is unavailable", missing: [] });
    }
  });

  // USD Correlation AI Insight endpoint
  app.get("/api/correlations/usd/insight", async (req, res) => {
    try {
      // First, fetch the correlation data internally
      const apiKey = process.env.TIINGO_API_KEY || process.env.VITE_T;
      if (!apiKey) {
        return res.status(401).json({ error: "Tiingo API key not configured" });
      }

      // Make internal request to get correlation data
      const protocol = req.protocol;
      const host = req.get('host');
      const correlationRes = await axios.get(`${protocol}://${host}/api/correlations/usd`);
      const correlationData = correlationRes.data;

      if (!correlationData.success || !correlationData.correlations) {
        return res.status(500).json({ error: "Failed to fetch correlation data" });
      }

      // Format the correlation data as a text table for the AI
      const formatCorr = (v: number) => v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
      
      let tableText = "USD CORRELATION MATRIX\n";
      tableText += "=====================\n\n";
      tableText += "ASSET        | 15D    | 30D    | 90D    | 120D   | 180D   | 52W-Hi | 52W-Lo | %Pos | %Neg\n";
      tableText += "-------------|--------|--------|--------|--------|--------|--------|--------|------|-----\n";
      
      for (const row of correlationData.correlations) {
        tableText += `${row.metric.padEnd(12)} | ${formatCorr(row["15D"]).padStart(6)} | ${formatCorr(row["30D"]).padStart(6)} | ${formatCorr(row["90D"]).padStart(6)} | ${formatCorr(row["120D"]).padStart(6)} | ${formatCorr(row["180D"]).padStart(6)} | ${formatCorr(row.high52W).padStart(6)} | ${formatCorr(row.low52W).padStart(6)} | ${String(row.pctPos).padStart(4)}% | ${String(row.pctNeg).padStart(4)}%\n`;
      }
      
      tableText += `\nData as of: ${correlationData.asOf} | ${correlationData.dataPoints} trading days analyzed`;

      console.log("[USD Insight] Sending correlation table to Gemini for analysis...");
      
      // Get AI analysis
      const insight = await analyzeUSDCorrelations(tableText);

      console.log("[USD Insight] Analysis complete:", insight.headline);

      res.json({
        success: true,
        asOf: correlationData.asOf,
        insight
      });

    } catch (error: any) {
      console.error("[USD Insight] Error:", error.message);
      res.status(500).json({ error: error.message || "Failed to generate insight" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
