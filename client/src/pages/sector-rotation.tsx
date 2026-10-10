import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, Play, Clock, RefreshCw, Menu, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FinancialMath, type DailyData } from '@/lib/financial-math';
import { Navbar } from '@/components/navbar';
import { useDocumentMeta } from '@/hooks/use-document-meta';
import { PlaybookCTA } from '@/components/playbook-cta';
import { SectorToolsMenu } from '@/components/sector-tools-menu';

// --- CONFIGURATION ---
// Server-side cache handles daily caching automatically via /api/tiingo/:ticker
// No client-side caching needed - server returns cached data for same-day requests

const TICKERS = [
  { symbol: 'SPY', name: 'S&P 500 (Benchmark)' },
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLV', name: 'Health Care' },
  { symbol: 'XLY', name: 'Cons. Discretionary' },
  { symbol: 'XLP', name: 'Cons. Staples' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLC', name: 'Communication Svcs' }
];

const MACRO_TICKERS = ['SPY', 'XLE', 'GLD', 'IWM', 'IVW', 'IVE', 'DBC', 'UUP', 'IEF', 'VXX'];

interface SectorData {
  symbol: string;
  data: DailyData[];
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

interface PerformanceMetrics {
  symbol: string;
  price: number;
  oneDay: number;
  mtd: number;
  qtd: number;
  ytd: number;
}

interface MacroRatioStats {
  pair: string;
  zScore: number;
  velocity: string;
  isReversing: boolean;
  price: number;
}

export default function SectorRotation() {
  const [status, setStatus] = useState<'IDLE' | 'FETCHING' | 'COMPLETE' | 'ERROR'>('FETCHING');
  const [progress, setProgress] = useState(0);
  const [currentTicker, setCurrentTicker] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics[]>([]);
  const [macroStats, setMacroStats] = useState<MacroRatioStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastCacheDate, setLastCacheDate] = useState<string | null>(null);
  const [cacheStale, setCacheStale] = useState(false);
  const [cacheState, setCacheState] = useState<string | null>(null);

  useDocumentMeta({
    title: "Sector rotation",
    description: "Macro sector rotation analysis across the market's major groups.",
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCancelledRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // --- HELPER: ADD LOG ---
  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // --- HELPER: FIND CLOSEST DATE ---
  const findClosestPrice = (data: DailyData[], targetDateStr: string): number | null => {
      // Data is sorted ascending. Find the last date <= targetDateStr
      let closestPrice = null;
      // Iterate backwards to find first date <= target
      for (let i = data.length - 1; i >= 0; i--) {
          if (data[i].date <= targetDateStr) {
              closestPrice = data[i].close;
              break;
          }
      }
      return closestPrice;
  };

  // --- HELPER: CALCULATE METRICS (RELATIVE TO SPY) ---
  const calculatePerformance = (rawData: Record<string, DailyData[]>) => {
      const metrics: PerformanceMetrics[] = [];
      const today = new Date();
      
      // Calculate Reference Dates
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      const prevMonthStr = prevMonth.toISOString().split('T')[0];

      const quarterMonth = Math.floor((today.getMonth() + 3) / 3) - 1;
      const prevQuarter = new Date(today.getFullYear(), quarterMonth * 3, 0);
      const prevQuarterStr = prevQuarter.toISOString().split('T')[0];

      const prevYear = new Date(today.getFullYear() - 1, 11, 31);
      const prevYearStr = prevYear.toISOString().split('T')[0];

      // 1. Calculate SPY Benchmark Performance First
      const spyData = rawData['SPY'];
      if (!spyData || spyData.length === 0) return;

      const spyCurrent = spyData[spyData.length - 1].close;
      const spyYesterday = spyData.length > 1 ? spyData[spyData.length - 2].close : spyCurrent;
      const spyMTD = findClosestPrice(spyData, prevMonthStr) || spyData[0].close;
      const spyQTD = findClosestPrice(spyData, prevQuarterStr) || spyData[0].close;
      const spyYTD = findClosestPrice(spyData, prevYearStr) || spyData[0].close;

      const spyPerf = {
          oneDay: (spyCurrent / spyYesterday) - 1,
          mtd: (spyCurrent / spyMTD) - 1,
          qtd: (spyCurrent / spyQTD) - 1,
          ytd: (spyCurrent / spyYTD) - 1
      };

      // 2. Calculate Sector Relative Performance (Alpha)
      TICKERS.forEach(ticker => {
          if (ticker.symbol === 'SPY') return; // Skip SPY in the list (it's the baseline)

          const data = rawData[ticker.symbol];
          if (!data || data.length === 0) return;

          const currentPrice = data[data.length - 1].close;
          const priceYesterday = data.length > 1 ? data[data.length - 2].close : currentPrice;
          const priceMTD = findClosestPrice(data, prevMonthStr) || data[0].close;
          const priceQTD = findClosestPrice(data, prevQuarterStr) || data[0].close;
          const priceYTD = findClosestPrice(data, prevYearStr) || data[0].close;

          // Absolute Returns
          const absOneDay = (currentPrice / priceYesterday) - 1;
          const absMTD = (currentPrice / priceMTD) - 1;
          const absQTD = (currentPrice / priceQTD) - 1;
          const absYTD = (currentPrice / priceYTD) - 1;

          metrics.push({
              symbol: ticker.symbol,
              price: currentPrice,
              oneDay: absOneDay - spyPerf.oneDay, // Relative Alpha
              mtd: absMTD - spyPerf.mtd,
              qtd: absQTD - spyPerf.qtd,
              ytd: absYTD - spyPerf.ytd
          });
      });

      setPerformanceData(metrics);
  };

  // --- MACRO STATS CALCULATION ---
  const calculateMacroStats = (rawData: Record<string, DailyData[]>) => {
    const PAIRS = [
       { num: 'XLE', den: 'SPY' },
       { num: 'GLD', den: 'SPY' },
       { num: 'IVW', den: 'IVE' },
       { num: 'IWM', den: 'SPY' },
       { num: 'DBC', den: 'SPY' }
    ];
    
    const stats: MacroRatioStats[] = [];
    
    PAIRS.forEach(pair => {
        const ratioData = FinancialMath.buildRatio(pair.num, pair.den, rawData);
        if (ratioData.length < 200) return;
        
        const basicStats = FinancialMath.calculateStats(ratioData, 200);
        const macdStats = FinancialMath.calculateMACD(ratioData);
        
        if (basicStats && macdStats) {
            stats.push({
                pair: `${pair.num}/${pair.den}`,
                zScore: basicStats.zScore,
                velocity: macdStats.velocityDirection,
                isReversing: macdStats.isReversing,
                price: basicStats.currentPrice
            });
        }
    });
    
    setMacroStats(stats);
  };

  // --- HELPER: DELAY ---
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Auto-start data loading on mount
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    addLog("Checking server cache...");
    loadData();
  }, []);

  // --- MAIN DATA LOADING FUNCTION ---
  // First tries bulk endpoint - if cache is complete, data loads instantly
  // Falls back to sequential fetch only if cache is incomplete (first visitor of day)
  const loadData = async () => {
    setStatus('FETCHING');
    setError(null);
    setProgress(0);
    setLogs([]); // Clear previous logs
    isCancelledRef.current = false;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate start dates
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    const startDateMacro = new Date();
    startDateMacro.setFullYear(startDateMacro.getFullYear() - 2);
    const startDateMacroStr = startDateMacro.toISOString().split('T')[0];

    try {
      // --- TRY BULK CACHE FIRST ---
      addLog("Checking server cache for today's data...");
      const bulkResponse = await fetch('/api/sector-rotation/bulk');
      const bulkData = await bulkResponse.json();
      
      if (bulkData.status === 'complete') {
        // CACHE HIT - All data available instantly!
        addLog("✓ Server cache HIT - loading data instantly!");
        setProgress(100);
        
        const rawData: Record<string, DailyData[]> = {};
        const macroData: Record<string, DailyData[]> = {};
        
        // Process sector tickers
        for (const ticker of TICKERS) {
          const data = bulkData.data[ticker.symbol];
          if (data) {
            rawData[ticker.symbol] = data
              .filter((item: any) => item.date >= startDateStr)
              .map((item: any) => ({ date: item.date, close: item.adjClose }))
              .sort((a: any, b: any) => a.date.localeCompare(b.date));
          }
        }
        
        // Process macro tickers
        for (const symbol of MACRO_TICKERS) {
          const data = bulkData.data[symbol];
          if (data) {
            macroData[symbol] = data
              .filter((item: any) => item.date >= startDateMacroStr)
              .map((item: any) => ({ date: item.date, close: item.adjClose }))
              .sort((a: any, b: any) => a.date.localeCompare(b.date));
          }
        }
        
        setLastCacheDate(bulkData.cacheDate);
        setCacheStale(bulkData.freshness?.state === 'stale');
        setCacheState(bulkData.freshness?.state ?? null);
        processDataForChart(rawData);
        calculatePerformance(rawData);
        calculateMacroStats(macroData);
        
        setStatus('COMPLETE');
        addLog(`✓ Analysis complete. Served from cache (${bulkData.tickerCount} tickers).`);
        return;
      }
      
      // --- CACHE MISS - Fall back to sequential fetch ---
      addLog(`Cache incomplete - fetching ${bulkData.missing?.length || 'all'} missing tickers...`);
      addLog(`Target: ${TICKERS.length + MACRO_TICKERS.length} tickers.`);
      
      const rawData: Record<string, DailyData[]> = {};
      const macroData: Record<string, DailyData[]> = {};
      
      const states: string[] = [];

      // Use any cached data we already have
      if (bulkData.data) {
        for (const ticker of TICKERS) {
          const data = bulkData.data[ticker.symbol];
          if (data) {
            rawData[ticker.symbol] = data
              .filter((item: any) => item.date >= startDateStr)
              .map((item: any) => ({ date: item.date, close: item.adjClose }))
              .sort((a: any, b: any) => a.date.localeCompare(b.date));
          }
        }
        for (const symbol of MACRO_TICKERS) {
          const data = bulkData.data[symbol];
          if (data) {
            macroData[symbol] = data
              .filter((item: any) => item.date >= startDateMacroStr)
              .map((item: any) => ({ date: item.date, close: item.adjClose }))
              .sort((a: any, b: any) => a.date.localeCompare(b.date));
          }
        }
      }

      // --- PHASE 1: SECTOR TICKERS ---
      for (let i = 0; i < TICKERS.length; i++) {
        if (isCancelledRef.current) {
          addLog("⚠ Fetch cancelled by user.");
          setStatus('IDLE');
          return;
        }
        
        const ticker = TICKERS[i];
        
        // Skip if already have data from bulk cache
        if (rawData[ticker.symbol]) {
          addLog(`✔ ${ticker.symbol} (from cache)`);
          continue;
        }
        
        setCurrentTicker(ticker.symbol);
        const percent = Math.round(((i) / (TICKERS.length + MACRO_TICKERS.length)) * 100);
        setProgress(percent);

        addLog(`Fetching ${ticker.symbol}...`);
        const data = await fetchTiingoData(ticker.symbol, startDateStr, states);
        rawData[ticker.symbol] = data;
        addLog(`✔ ${ticker.symbol} acquired (${data.length} days).`);

        if (i < TICKERS.length - 1) await delay(100); 
      }

      // --- PHASE 2: MACRO TICKERS ---
      addLog("Starting Phase 2: Macro Data...");
      for (let i = 0; i < MACRO_TICKERS.length; i++) {
        if (isCancelledRef.current) {
          addLog("⚠ Fetch cancelled by user.");
          setStatus('IDLE');
          return;
        }
        
        const symbol = MACRO_TICKERS[i];
        
        // Skip if already have data from bulk cache
        if (macroData[symbol]) {
          addLog(`✔ ${symbol} [MACRO] (from cache)`);
          continue;
        }
        
        setCurrentTicker(symbol);
        const percent = Math.round(((TICKERS.length + i) / (TICKERS.length + MACRO_TICKERS.length)) * 100);
        setProgress(percent);
        
        addLog(`Fetching [MACRO] ${symbol}...`);
        const data = await fetchTiingoData(symbol, startDateMacroStr, states);
        macroData[symbol] = data;
        addLog(`✔ ${symbol} acquired (${data.length} days).`);
        
        if (i < MACRO_TICKERS.length - 1) await delay(100);
      }

      // --- ALL DONE ---
      setProgress(100);
      addLog("All data acquired. Processing...");
      
      // Label the set the way the bulk route does: the oldest final bar across
      // every series, and stale if any series came back stale.
      if (bulkData.freshness && bulkData.data && Object.keys(bulkData.data).length) states.push(bulkData.freshness.state);
      const asOf = [...Object.values(rawData), ...Object.values(macroData)].reduce((oldest, series) => {
        const last = series[series.length - 1]?.date?.slice(0, 10) ?? '';
        return !oldest || (last && last < oldest) ? last : oldest;
      }, '');
      const seriesState = states.includes('stale') ? 'stale' : states.includes('fresh') ? 'fresh' : 'cache';
      setLastCacheDate(asOf || today);
      setCacheStale(seriesState === 'stale');
      setCacheState(seriesState);

      processDataForChart(rawData);
      calculatePerformance(rawData);
      calculateMacroStats(macroData);
      
      setStatus('COMPLETE');
      addLog("✓ Analysis complete. Cache populated for other visitors.");

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setStatus('ERROR');
      addLog(`CRITICAL FAILURE: ${err.message}`);
    }
  };
  
  const fetchTiingoData = async (symbol: string, startDate: string, states?: string[]): Promise<DailyData[]> => {
        // Use server-side Tiingo proxy for reliable data fetching
        const response = await fetch(`/api/tiingo/${symbol}`);
        
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData.error || `API Error (${response.status})`);
        }
        
        // fresh / cache / stale for this series (a stale cache entry still answers 200)
        const state = response.headers.get('X-Market-Data-State');
        if (state && states) states.push(state);

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error(`Invalid format received for ${symbol}`);
        if (data.length === 0) throw new Error(`No data returned for ${symbol}`);

        // Filter by startDate and map adjClose to close
        return data
            .filter((item: any) => item.date >= startDate)
            .map((item: any) => ({
                date: item.date,
                close: item.adjClose
            }))
            .sort((a: any, b: any) => a.date.localeCompare(b.date));
  };

  // --- 3. PROCESS DATA (RELATIVE STRENGTH) ---
  const processDataForChart = (rawData: Record<string, DailyData[]>) => {
    try {
        const spyData = rawData['SPY'];
        if (!spyData) throw new Error("SPY data missing for calculation.");

        // Create a map of Date -> SPY Close
        const spyMap = new Map(spyData.map(d => [d.date, d.close]));
        
        // Slice data for CHART visualization only (Last 100 days)
        // We use the full dataset for YTD calcs, but chart is 100 days as requested originally.
        const recentSpyData = spyData.slice(-100);

        // We need to align dates. We'll use SPY's dates as the master list.
        const chartDataPoints: ChartDataPoint[] = recentSpyData.map(day => {
            const point: ChartDataPoint = { date: day.date };
            
            // For each sector, find matching date and calc ratio
            TICKERS.forEach(t => {
                if (t.symbol === 'SPY') return; // Skip benchmark itself

                const sectorDays = rawData[t.symbol];
                const sectorDay = sectorDays?.find(d => d.date === day.date);

                if (sectorDay && spyMap.get(day.date)) {
                    const spyClose = spyMap.get(day.date)!;
                    const ratio = sectorDay.close / spyClose;
                    point[t.symbol] = ratio; 
                }
            });
            return point;
        });
        
        setChartData(chartDataPoints);

    } catch (e: any) {
        setError("Calculation Error: " + e.message);
    }
  };

  // --- COLORS FOR SECTORS ---
  const COLORS: Record<string, string> = {
    'XLK': '#00f2ff', // Tech - Cyan
    'XLF': '#00ff00', // Fin - Green
    'XLV': '#ff00ff', // Health - Magenta
    'XLY': '#ffaa00', // Disc - Orange
    'XLP': '#aaaaaa', // Staples - Grey
    'XLE': '#ff0000', // Energy - Red
    'XLI': '#ffff00', // Ind - Yellow
    'XLB': '#aa00ff', // Mat - Purple
    'XLRE': '#0000aa', // RE - Dark Blue
    'XLU': '#00aaaa', // Util - Teal
    'XLC': '#aa0000', // Comm - Dark Red
  };

  const marketDataStatus: { text: string; tone: 'caution' | 'muted' } =
    status === 'ERROR'
      ? { text: 'Market data: UNAVAILABLE', tone: 'caution' }
      : status === 'FETCHING'
        ? currentTicker
          ? { text: `Market data: FETCHING ${currentTicker} • ${progress}%`, tone: 'muted' }
          : { text: 'Market data: LOADING', tone: 'muted' }
        : status === 'COMPLETE' && lastCacheDate
          ? { text: `Market data: ${(cacheState ?? 'fresh').toUpperCase()} • ${lastCacheDate}`, tone: cacheStale ? 'caution' : 'muted' }
          : { text: 'Market data: FETCH CANCELLED', tone: 'caution' };

  return (
      <>
          <Navbar />
          <div className="min-h-screen bg-background text-white font-mono px-4 md:px-6 pt-24 pb-12">
            <div className="max-w-7xl mx-auto space-y-8">
            
            {/* HEADER: same layout as /ratio-relevance */}
            <div>
              <div className="flex items-center gap-4 mb-2">
                <Link href="/">
                  <button className="flex items-center gap-2 text-white/50 hover:text-[#00ff88] transition-colors font-mono text-xs" data-testid="link-back-home">
                    <ArrowLeft className="w-4 h-4" />
                    BACK
                  </button>
                </Link>
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between">
                {/* Same type as the BeamHeading page titles (alerts, lab); drawn at once, no wipe. */}
                <h1 className="beam-heading mb-2" data-drawn="1" data-testid="text-page-title">
                  SECTOR ROTATION
                </h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 md:mt-0 md:flex-nowrap">
                  <span
                    role="status"
                    aria-live="polite"
                    className={`min-w-0 font-mono text-xs md:whitespace-nowrap ${marketDataStatus.tone === 'caution' ? 'text-amber-300' : 'text-white/70'}`}
                    data-testid="text-market-data-status"
                  >
                    {marketDataStatus.text}
                  </span>
                  {status === 'FETCHING' && currentTicker && (
                    <button
                      onClick={() => { isCancelledRef.current = true; }}
                      className="px-3 py-1.5 border border-[#ff3333]/50 text-[#ff3333] font-mono text-xs hover:bg-[#ff3333]/10 transition-colors"
                      data-testid="button-cancel-fetch"
                    >
                      CANCEL FETCH
                    </button>
                  )}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 hover:bg-primary/10 border border-primary/30 rounded text-primary"
                    aria-label={mobileMenuOpen ? "Close operation log" : "Open operation log"}
                    data-testid="button-mobile-menu"
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <SectorToolsMenu current="sector-rotation" />

            {status === 'ERROR' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-sm p-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <div>
                    <h3 className="font-mono text-red-400 font-bold">Error Loading Data</h3>
                    <p className="font-mono text-sm text-red-400/70">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* LOG TERMINAL - DESKTOP */}
            <Card className="bg-black border-primary/30 text-primary font-mono text-xs hidden md:block">
               <CardHeader className="py-2 border-b border-primary/10">
                  <CardTitle className="text-xs flex items-center gap-2">
                      <Clock className="w-3 h-3" /> OPERATION LOG
                  </CardTitle>
               </CardHeader>
               <CardContent className="h-[120px] overflow-y-auto p-2 space-y-0 scrollbar-thin scrollbar-thumb-primary/20">
                  {logs.length === 0 && <div className="opacity-30 italic">Waiting for command...</div>}
                  {logs.map((log, i) => (
                      <div key={i} className="border-l-2 border-primary/20 pl-2 hover:bg-primary/5">
                          {log}
                      </div>
                  ))}
               </CardContent>
            </Card>

            {/* MOBILE TERMINAL MENU */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
                <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-primary/30 max-h-[60vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <Card className="bg-black border-primary/30 text-primary font-mono text-[11px] rounded-none border-0 border-t border-t-primary/30">
                    <CardHeader className="py-2 border-b border-primary/10">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] flex items-center gap-2">
                          <Clock className="w-3 h-3" /> OPERATION LOG
                        </CardTitle>
                        <button
                          onClick={() => setMobileMenuOpen(false)}
                          className="p-1 hover:bg-primary/10 rounded text-primary"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="h-[50vh] overflow-y-auto p-2 space-y-0 scrollbar-thin scrollbar-thumb-primary/20">
                      {logs.length === 0 && <div className="opacity-30 italic text-[11px]">Waiting for command...</div>}
                      {logs.map((log, i) => (
                        <div key={i} className="border-l-2 border-primary/20 pl-2 hover:bg-primary/5 text-[11px] leading-tight">
                          {log}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* HEATMAP SECTION */}
            {performanceData.length > 0 && (
                <div className="relative w-full bg-card border border-primary p-6 font-mono text-xs shadow-[0_0_20px_hsl(var(--primary)/0.2)] overflow-hidden group">
                    {/* CRT Overlay Effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-100 z-10"></div>
                    
                    <div className="relative z-20">
                        <div className="flex justify-between items-end mb-6 border-b border-primary/30 pb-2">
                            <div>
                                <h2 className="beam-heading" data-drawn="1">
                                    SECTOR PERFORMANCE MATRIX
                                </h2>
                                <p className="text-primary/60 mt-1 text-[15px] font-normal bg-[transparent]">
                                    RELATIVE_RETURN_MATRIX (ALPHA) // BENCHMARK: SPY
                                </p>
                            </div>
                            <div className="text-primary/40 text-[9px] animate-pulse">
                                LIVE_FEED_ACTIVE
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm font-mono border-collapse">
                                <thead>
                                    <tr className="text-primary border-b border-primary/30">
                                        <th className="p-3 text-left w-[100px] text-[10px] tracking-widest opacity-70">SYM</th>
                                        <th className="p-3 text-right w-[100px] text-[10px] tracking-widest opacity-70">LAST_PX</th>
                                        <th className="p-3 text-center text-[10px] tracking-widest opacity-70">1D_RELATIVE_RETURN</th>
                                        <th className="p-3 text-center text-[10px] tracking-widest opacity-70">MTD %</th>
                                        <th className="p-3 text-center text-[10px] tracking-widest opacity-70">QTD %</th>
                                        <th className="p-3 text-center text-[10px] tracking-widest opacity-70">YTD %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-primary/10">
                                    {performanceData.map((metric) => {
                                        const formatPercent = (val: number) => {
                                            const isPos = val > 0;
                                            const isNeg = val < 0;
                                            // Neon styling for pills
                                            const bgClass = isPos 
                                                ? 'bg-primary/10 text-primary border border-primary/50 shadow-[0_0_8px_hsl(var(--primary)/0.3)]' 
                                                : isNeg 
                                                    ? 'bg-[#ff3333]/10 text-[#ff3333] border border-[#ff3333]/50 shadow-[0_0_8px_rgba(255,51,51,0.3)]' 
                                                    : 'bg-gray-800/50 text-gray-400 border border-gray-600';
                                            
                                            return (
                                                <div className={`px-3 py-1 rounded-sm ${bgClass} font-bold text-[11px] inline-block min-w-[70px] text-center backdrop-blur-sm`}>
                                                    {val > 0 ? '+' : ''}{(val * 100).toFixed(2)}%
                                                </div>
                                            );
                                        };

                                        return (
                                            <tr key={metric.symbol} className="hover:bg-primary/5 transition-colors group/row">
                                                <td className="p-3 font-bold text-primary group-hover/row:text-white transition-colors flex items-center gap-2">
                                                    <span className="opacity-50 text-[9px] group-hover/row:opacity-100">::</span>
                                                    {metric.symbol}
                                                </td>
                                                <td className="p-3 text-right text-white font-mono text-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
                                                    ${metric.price.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-center">{formatPercent(metric.oneDay)}</td>
                                                <td className="p-3 text-center">{formatPercent(metric.mtd)}</td>
                                                <td className="p-3 text-center">{formatPercent(metric.qtd)}</td>
                                                <td className="p-3 text-center">{formatPercent(metric.ytd)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MACRO REGIME DASHBOARD */}
            {macroStats.length > 0 && (
                <div className="relative w-full bg-card border border-primary p-6 font-mono text-xs shadow-[0_0_20px_hsl(var(--primary)/0.2)] overflow-hidden group hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)] hover:border-primary/100 transition-all duration-300">
                    {/* CRT Overlay Effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-100 z-10"></div>
                    
                    <div className="relative z-20">
                        <div className="flex justify-between items-end mb-6 border-b border-primary/30 pb-2">
                            <div>
                                <h2 className="beam-heading" data-drawn="1">
                                    MACRO REGIME DASHBOARD
                                </h2>
                                <p className="text-primary/60 mt-1 text-[15px]">
                                    RATIO_ANALYSIS // Z-SCORE_MEAN_REVERSION // MOMENTUM_VECTORS
                                </p>
                            </div>
                            <div className="text-primary/40 text-[9px] animate-pulse">
                                ALGO_STATUS: ONLINE
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {macroStats.map((stat) => {
                                // Determine Card Style based on Setup Logic
                                let cardBg = 'bg-black/40 border-primary/30';
                                let textColor = 'text-primary';
                                let setupBadge = null;
                                
                                const isOversold = stat.zScore < -2.0;
                                const isOverbought = stat.zScore > 2.0;
                                const isSetup = Math.abs(stat.zScore) > 2.0 && stat.isReversing;

                                if (isOversold && stat.velocity === 'UP') {
                                    cardBg = 'bg-[#00b050]/20 border-[#00b050] shadow-[0_0_15px_rgba(0,176,80,0.3)]';
                                    textColor = 'text-[#00b050]';
                                } else if (isOverbought && stat.velocity === 'DOWN') {
                                    cardBg = 'bg-[#ff0000]/20 border-[#ff0000] shadow-[0_0_15px_rgba(255,0,0,0.3)]';
                                    textColor = 'text-[#ff0000]';
                                }

                                if (isSetup) {
                                    setupBadge = (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[9px] font-bold px-2 py-0.5 rounded animate-pulse shadow-[0_0_10px_rgba(255,200,0,0.5)] whitespace-nowrap z-30 border border-yellow-600">
                                            HIGH CONVICTION SETUP
                                        </div>
                                    );
                                }

                                return (
                                    <div key={stat.pair} className={`relative border p-4 rounded-sm flex flex-col gap-2 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)] hover:border-opacity-100 ${cardBg}`}>
                                        {setupBadge}
                                        
                                        <div className="flex justify-between items-center">
                                            <div className={`font-bold text-sm tracking-wider ${textColor}`}>{stat.pair}</div>
                                            <div className="text-[10px] opacity-50 text-white">{stat.price.toFixed(4)}</div>
                                        </div>
                                        
                                        <div className="flex justify-between items-end mt-2">
                                            <div>
                                                <div className="text-[9px] opacity-60 text-white mb-1">Z-SCORE (200D)</div>
                                                <div className={`text-lg font-bold ${stat.zScore > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {stat.zScore.toFixed(2)}σ
                                                </div>
                                            </div>
                                            
                                            <div className="text-right">
                                                <div className="text-[9px] opacity-60 text-white mb-1"><span className="font-bold">3Day</span> VELOCITY</div>
                                                <div className={`text-xs font-bold flex items-center justify-end gap-1 ${stat.velocity.includes('UP') ? 'text-primary' : stat.velocity.includes('DOWN') ? 'text-[#ff3333]' : 'text-gray-400'}`}>
                                                    {stat.velocity.includes('UP') ? '▲' : stat.velocity.includes('DOWN') ? '▼' : '■'} 
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {stat.isReversing && (
                                            <div className="mt-2 pt-2 border-t border-white/10 text-center">
                                                <span className="text-[9px] text-yellow-400 font-bold tracking-widest animate-pulse">
                                                    ⚠ MOMENTUM REVERSAL
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* VELOCITY LOGIC REFERENCE */}
            <div className="relative w-full bg-card border border-primary/50 p-6 font-mono text-[11px] shadow-[0_0_20px_hsl(var(--primary)/0.2)] overflow-hidden">
                {/* CRT Overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-100 z-10"></div>
                
                <div className="relative z-20">
                    <div className="mb-4 border-b border-primary/30 pb-3">
                        <h3 className="beam-heading mb-1" data-drawn="1">SIMPLE 3D DECISION ENGINE</h3>
                        <p className="text-primary/50 text-[15px]">MACD_HISTOGRAM_REVERSAL_DETECTOR // 3-DAY_LOGIC</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LEFT SIDE: Reversing Conditions */}
                        <div className="space-y-4">
                            <div className="border-2 border-white bg-blue-900/20 p-4 rounded-sm">
                                <div className="text-blue-300 font-bold mb-3 flex items-center gap-2">
                                    <span>▲</span> UP (Reversing - Bullish)
                                </div>
                                <div className="space-y-2 text-blue-200/70">
                                    <div className="font-mono text-[10px] bg-black/50 p-2 border-l-2 border-white">
                                        <div>H[today] &gt; H[yesterday]</div>
                                        <div className="text-blue-300/50">AND</div>
                                        <div>H[yesterday] ≤ H[2-days-ago]</div>
                                    </div>
                                    <div className="text-[9px] text-blue-300">✓ Hit bottom yesterday → Now bouncing</div>
                                </div>
                            </div>

                            <div className="border border-[#ff3333]/40 bg-[#ff3333]/5 p-4 rounded-sm">
                                <div className="text-[#ff3333] font-bold mb-3 flex items-center gap-2">
                                    <span>▼</span> DOWN (Reversing - Bearish)
                                </div>
                                <div className="space-y-2 text-[#ff3333]/70">
                                    <div className="font-mono text-[10px] bg-black/50 p-2 border-l-2 border-[#ff3333]">
                                        <div>H[today] &lt; H[yesterday]</div>
                                        <div className="text-[#ff3333]/50">AND</div>
                                        <div>H[yesterday] ≥ H[2-days-ago]</div>
                                    </div>
                                    <div className="text-[9px] text-[#ff3333]">✓ Hit top yesterday → Now rolling over</div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDE: Trending Conditions */}
                        <div className="space-y-4">
                            <div className="border border-primary/40 bg-primary/5 p-4 rounded-sm">
                                <div className="text-primary font-bold mb-3 flex items-center gap-2">
                                    <span>▲</span> UP_TREND (Momentum Continuing)
                                </div>
                                <div className="space-y-2 text-primary/70">
                                    <div className="font-mono text-[10px] bg-black/50 p-2 border-l-2 border-primary">
                                        <div>H[today] &gt; H[yesterday]</div>
                                        <div className="text-primary/50">AND</div>
                                        <div>(other cases)</div>
                                    </div>
                                    <div className="text-[9px] text-primary">✓ Still accelerating upward</div>
                                </div>
                            </div>

                            <div className="border border-[#aaaaaa]/40 bg-[#aaaaaa]/5 p-4 rounded-sm">
                                <div className="text-[#aaaaaa] font-bold mb-3 flex items-center gap-2">
                                    <span>▼</span> DOWN_TREND (Momentum Continuing)
                                </div>
                                <div className="space-y-2 text-[#aaaaaa]/70">
                                    <div className="font-mono text-[10px] bg-black/50 p-2 border-l-2 border-[#aaaaaa]">
                                        <div>H[today] ≤ H[yesterday]</div>
                                        <div className="text-[#aaaaaa]/50">OR</div>
                                        <div>(all other cases)</div>
                                    </div>
                                    <div className="text-[9px] text-[#aaaaaa]">✓ Still accelerating downward</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Formula Reference */}
                    <div className="mt-6 pt-4 border-t border-primary/30">
                        <div className="text-primary/60 text-[10px] mb-3">COMPONENT_FORMULAS:</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-black/40 border border-primary/20 p-3 rounded-sm">
                                <div className="text-primary text-[9px] font-bold mb-2">MACD_LINE</div>
                                <div className="text-primary/60 text-[9px] font-mono">EMA(12) - EMA(26)</div>
                            </div>
                            <div className="bg-black/40 border border-primary/20 p-3 rounded-sm">
                                <div className="text-primary text-[9px] font-bold mb-2">SIGNAL_LINE</div>
                                <div className="text-primary/60 text-[9px] font-mono">EMA(9) of MACD</div>
                            </div>
                            <div className="bg-black/40 border border-primary/20 p-3 rounded-sm">
                                <div className="text-primary text-[9px] font-bold mb-2">HISTOGRAM</div>
                                <div className="text-primary/60 text-[9px] font-mono">MACD - Signal</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CHART SECTION */}
            {chartData.length > 0 && (
                <Card className="bg-black/40 border-primary/30 text-primary">
                    <CardHeader>
                        <CardTitle>RELATIVE STRENGTH PERFORMANCE (100 DAYS)</CardTitle>
                        <CardDescription className="text-primary/50">
                            Ratio = Sector Close / SPY Close
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[500px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#666" 
                                    fontSize={10} 
                                    tickFormatter={(val) => val.slice(5)} // Show MM-DD
                                />
                                <YAxis stroke="#666" fontSize={10} domain={['auto', 'auto']} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid hsl(var(--primary))' }}
                                    itemStyle={{ fontSize: '11px' }}
                                    labelStyle={{ color: 'hsl(var(--primary))', marginBottom: '5px' }}
                                />
                                <Legend />
                                {TICKERS.map(ticker => {
                                    if (ticker.symbol === 'SPY') return null;
                                    return (
                                        <Line 
                                            key={ticker.symbol}
                                            type="monotone" 
                                            dataKey={ticker.symbol} 
                                            stroke={COLORS[ticker.symbol] || '#fff'} 
                                            strokeWidth={1.5}
                                            dot={false}
                                        />
                                    );
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Navigation Buttons */}
            <style>{`
              @keyframes pulse-glow-subtle {
                0%, 100% {
                  box-shadow: 0 0 20px rgba(168, 85, 247, 0.3), inset 0 0 20px rgba(168, 85, 247, 0.1);
                }
                50% {
                  box-shadow: 0 0 40px rgba(168, 85, 247, 0.5), inset 0 0 20px rgba(168, 85, 247, 0.2);
                }
              }
              @keyframes pulse-glow-subtle-blue {
                0%, 100% {
                  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.1);
                }
                50% {
                  box-shadow: 0 0 40px rgba(59, 130, 246, 0.5), inset 0 0 20px rgba(59, 130, 246, 0.2);
                }
              }
              @keyframes pulse-glow-subtle-emerald {
                0%, 100% {
                  box-shadow: 0 0 20px rgba(16, 185, 129, 0.3), inset 0 0 20px rgba(16, 185, 129, 0.1);
                }
                50% {
                  box-shadow: 0 0 40px rgba(16, 185, 129, 0.5), inset 0 0 20px rgba(16, 185, 129, 0.2);
                }
              }
              @keyframes pulse-glow-subtle-cyan {
                0%, 100% {
                  box-shadow: 0 0 20px rgba(34, 211, 238, 0.3), inset 0 0 20px rgba(34, 211, 238, 0.1);
                }
                50% {
                  box-shadow: 0 0 40px rgba(34, 211, 238, 0.5), inset 0 0 20px rgba(34, 211, 238, 0.2);
                }
              }
              .pulse-glow-purple {
                animation: pulse-glow-subtle 4s ease-in-out infinite;
              }
              .pulse-glow-blue {
                animation: pulse-glow-subtle-blue 4s ease-in-out infinite;
              }
              .pulse-glow-cyan {
                animation: pulse-glow-subtle-cyan 4s ease-in-out infinite;
              }
              .pulse-glow-emerald {
                animation: pulse-glow-subtle-emerald 4s ease-in-out infinite;
              }
            `}</style>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Alerts Button */}
              <Link href="/alerts" className="w-full">
                <div className="group cursor-pointer bg-black border-2 border-emerald-500/50 p-4 overflow-hidden transition-all duration-300 hover:border-emerald-500 hover:scale-105 pulse-glow-emerald h-full">
                  <div className="font-mono text-xs text-emerald-500/90 leading-tight transition-colors duration-300 group-hover:text-emerald-400 space-y-2">
                    <div className="text-center font-bold">→ ◊ ALERT_TERMINAL</div>
                    <div className="text-emerald-400/70 text-center text-xs">Free custom email alerts</div>
                    <div className="text-emerald-500/50 text-center">[ENTER]</div>
                  </div>
                </div>
              </Link>
              
              {/* Sector Rotation Button */}
              <Link href="/sector-rotation" className="w-full">
                <div className="group cursor-pointer bg-black border-2 border-blue-500/50 p-4 overflow-hidden transition-all duration-300 hover:border-blue-500 hover:scale-105 pulse-glow-blue h-full">
                  <div className="font-mono text-xs text-blue-500/90 leading-tight transition-colors duration-300 group-hover:text-blue-400 space-y-2">
                    <div className="text-center font-bold">→ ◊ SECTOR_ROTATION</div>
                    <div className="text-blue-400/70 text-center text-xs">Market sector analysis</div>
                    <div className="text-blue-500/50 text-center">[CURRENT]</div>
                  </div>
                </div>
              </Link>

              {/* Ratio Relevance Button */}
              <Link href="/ratio-relevance" className="w-full">
                <div className="group cursor-pointer bg-black border-2 border-cyan-500/50 p-4 overflow-hidden transition-all duration-300 hover:border-cyan-500 hover:scale-105 pulse-glow-cyan h-full">
                  <div className="font-mono text-xs text-cyan-500/90 leading-tight transition-colors duration-300 group-hover:text-cyan-400 space-y-2">
                    <div className="text-center font-bold">→ ◊ RATIO_RELEVANCE</div>
                    <div className="text-cyan-400/70 text-center text-xs">Capital flow analysis</div>
                    <div className="text-cyan-500/50 text-center">[ENTER]</div>
                  </div>
                </div>
              </Link>
            </div>

            <PlaybookCTA />

            </div>
          </div>
      </>
  );
}
