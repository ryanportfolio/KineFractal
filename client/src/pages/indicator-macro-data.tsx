import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Shield, 
  Layers,
  Maximize2,
  BarChart3,
  Info,
  Check,
  CheckSquare,
  RefreshCw
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaybookCTA } from "@/components/playbook-cta";
import {
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine
} from "recharts";

import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";
import { Link } from "wouter";
import { FinancialMath, type DailyData } from "@/lib/financial-math";
import { USDCorrelationTerminal } from "@/components/usd-correlation-terminal";

// Tiingo access goes through the backend (/api/tiingo/:ticker) — the API key
// lives server-side only (TIINGO_API_KEY). No VITE_-inlined secrets.

// --- TYPES ---
type MarketCondition = "BULL_RUN" | "GOLDEN_ZONE" | "FEAR_SPIKE" | "BEAR_BREAKDOWN" | "RECOVERY";

interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  price: number;
  q20: number; // Quarterly 20 MA
  m5: number;  // Monthly 5 MA
  vix: number; // VIX value
  breadthSpread: number; // HIGN - LOWN
  breadthRatio: number; // HIGN / (HIGN + LOWN)
  breadthCumulative: number; // Cumulative sum of breadth spread
}

interface SimulationState {
  currentCondition: MarketCondition;
  price: number;
  vixRoc: number;
  netHighs: number;
  netHighsChange: number;
  qHigh: number;
  qLow: number;
  breadthRatio: number;
  breadthCumulative: number;
}

// --- CONSTANTS ---
const CONDITIONS: Record<MarketCondition, { label: string; color: string; borderColor: string; description: string }> = {
  BULL_RUN: { 
    label: "SECULAR BULL", 
    color: "text-green-500",
    borderColor: "border-green-500/50",
    description: "Price > Q20 & M5. VIX Crushing. Breadth Expanding."
  },
  GOLDEN_ZONE: { 
    label: "GOLDEN ZONE", 
    color: "text-yellow-500", 
    borderColor: "border-yellow-500/50",
    description: "Retracement to 61.8-78.6%. Smart Money Accumulation."
  },
  FEAR_SPIKE: { 
    label: "FEAR SPIKE", 
    color: "text-red-500", 
    borderColor: "border-red-500/50",
    description: "VIX ROC > 10%. Panic Selling. Do Not Buy."
  },
  BEAR_BREAKDOWN: { 
    label: "BEAR BREAKDOWN", 
    color: "text-red-700", 
    borderColor: "border-red-700/50",
    description: "Price < Q20. Structure Failed. Cash is King."
  },
  RECOVERY: { 
    label: "EARLY RECOVERY", 
    color: "text-blue-400", 
    borderColor: "border-blue-400/50",
    description: "Reclaiming M5. VIX Stabilizing."
  }
};

const TICKER_OPTIONS = [
  { symbol: 'SPY', name: 'S&P 500 (SPY)' },
  { symbol: 'QQQ', name: 'Nasdaq 100 (QQQ)' },
  { symbol: 'GLD', name: 'Gold (GLD)' },
  { symbol: 'IWM', name: 'Russell 2000 (IWM)' },
];


export default function IndicatorMacroData() {
  const [activeTab, setActiveTab] = useState<"CHART" | "PLAYBOOK">("CHART");
  const [selectedTicker, setSelectedTicker] = useState<string>("SPY");
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"CACHE" | "LIVE" | "MOCK">("MOCK");
  const [activeCondition, setActiveCondition] = useState<MarketCondition>("BULL_RUN"); // Kept for UI compatibility but derived from data

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // --- DATA FETCHING & PROCESSING ---
  useEffect(() => {
    const init = async () => {
        setLoading(true);
        setLogs([]);
        addLog(`> INIT: Starting Macro Data sequence (${selectedTicker})...`);
        
        try {
            let tickerData: DailyData[] = [];
            let vxxData: DailyData[] = [];
            let spyData: DailyData[] = [];
            let rspData: DailyData[] = [];

            addLog("☁ NETWORK: Fetching live data from Tiingo API (backend cache handles daily caching)...");
            try {
                // Fetch main ticker first
                const fetchedTicker = await fetchTiingoData(selectedTicker);
                
                // Fetch VXX first, fall back to VIXY if VXX fails (common Tiingo free tier issue)
                let fetchedVxx: DailyData[] = [];
                try {
                    fetchedVxx = await fetchTiingoData('VXX');
                    addLog(`✓ VXX: Retrieved ${fetchedVxx.length} days of volatility data`);
                } catch (vxxErr) {
                    addLog(`⚠ VXX fetch failed, attempting VIXY fallback...`);
                    try {
                        fetchedVxx = await fetchTiingoData('VIXY');
                        addLog(`✓ VIXY: Retrieved ${fetchedVxx.length} days of volatility data (fallback)`);
                    } catch (viyxErr) {
                        throw new Error("Both VXX and VIXY failed. No volatility data available.");
                    }
                }
                
                // Fetch breadth health data (SPY vs RSP for market breadth)
                try {
                    spyData = await fetchTiingoData('SPY');
                    addLog(`✓ SPY: Retrieved ${spyData.length} days of data`);
                } catch (e) {
                    addLog(`⚠ BREADTH: Could not fetch SPY data (${(e as Error).message}). Continuing without it.`);
                }
                try {
                    rspData = await fetchTiingoData('RSP');
                    addLog(`✓ RSP: Retrieved ${rspData.length} days of data`);
                } catch (e) {
                    addLog(`⚠ BREADTH: Could not fetch RSP data (${(e as Error).message}). Continuing without it.`);
                }
                
                if (!fetchedTicker || fetchedTicker.length === 0) {
                    throw new Error(`No data returned for ticker ${selectedTicker}`);
                }
                
                if (!fetchedVxx || fetchedVxx.length === 0) {
                    throw new Error("No VXX volatility data available");
                }
                
                tickerData = fetchedTicker;
                vxxData = fetchedVxx;

                setDataSource("LIVE");
                addLog(`✓ NETWORK: Successfully retrieved ${tickerData.length} bars (served from daily cache on backend).`);

            } catch (err: any) {
                const errorMsg = `❌ DATA FETCH ERROR: ${err.message}`;
                addLog(errorMsg);
                throw new Error(errorMsg);
            }

            processMarketData(tickerData, vxxData, spyData, rspData);

        } catch (e: any) {
            addLog(`❌ ERROR: ${e.message}`);
            setError(e.message);
            setLoading(false);
        }
    };

    init();
  }, [selectedTicker]);

  const fetchTiingoData = async (ticker: string): Promise<DailyData[]> => {
      const res = await fetch(`/api/tiingo/${ticker}`);
      
      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch ${ticker}`);
      }
      
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(`Invalid format received for ${ticker}`);
      if (data.length === 0) throw new Error(`No data returned for ${ticker}`);
      
      return data;
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- PROCESSOR ---
  const processMarketData = async (priceData: DailyData[], vxxData: DailyData[], spyBreadthData: DailyData[] = [], rspBreadthData: DailyData[] = []) => {
      addLog("↓ COMPUTE: Resampling data to Higher Timeframes...");
      
      if (!priceData || priceData.length === 0) {
           addLog("❌ ERROR: No Data to process");
           return;
      }

      // 1. Resample
      const monthlyData = FinancialMath.resample(priceData, 'M');
      const quarterlyData = FinancialMath.resample(priceData, 'Q');
      
      addLog(`✓ COMPUTE: Generated ${monthlyData.length} Monthly & ${quarterlyData.length} Quarterly bars`);

      // 2. Calculate SMAs
      addLog("↓ ANALYZE: Calculating Q20 (Secular Trend) & M5 (Tactical)...");
      const m5Series = FinancialMath.calculateSMA(monthlyData, 5);
      
      // Q20 requires 20 quarters (5 years) of data. If insufficient, use daily 200-SMA as secular trend proxy
      let q20Series = FinancialMath.calculateSMA(quarterlyData, 20);
      const hasValidQ20 = q20Series.some(v => !isNaN(v) && v > 0);
      
      // Calculate daily 200-SMA as fallback (common institutional secular trend indicator)
      const daily200SMA = FinancialMath.calculateSMA(priceData, 200);
      
      if (!hasValidQ20) {
          addLog(`⚠ Q20: Only ${quarterlyData.length} quarters available (need 20). Using 200-day SMA as proxy.`);
      } else {
          addLog(`✓ Q20: Using quarterly 20-period SMA (${quarterlyData.length} quarters available)`);
      }
      
      // 3. Calculate VIX ROC (5-period Rate of Change)
      // Note: VXX/VIXY represent volatility. High values = High Fear.
      // Formula: ((Price_Today - Price_5_Days_Ago) / Price_5_Days_Ago) * 100
      addLog("↓ MONITOR: Analyzing Volatility Kinetics (5-period ROC)...");
      
      // Ensure at least 20 days of data for reliable 5-period calculation
      if (vxxData.length < 20) {
          addLog(`⚠ VIX Velocity: Only ${vxxData.length} days available (need 20+). Using available data.`);
      }
      
      const vxxRoc = vxxData.length > 5 ? (FinancialMath.calculateROC(vxxData, 5) || 0) : 0;
      addLog(`✓ VIX Velocity: ROC(5) = ${vxxRoc.toFixed(2)}%${vxxRoc > 10 ? ' [FEAR SPIKE ALERT]' : vxxRoc < -10 ? ' [Volatility Crush]' : ' [Normal]'}`);

      // 4. Calculate Breadth Health (SPY vs RSP 20-day performance)
      addLog("↓ ANALYZE: Calculating Breadth Health (RSP vs SPY)...");
      let breadthSpread = 0;
      
      if (spyBreadthData.length >= 20 && rspBreadthData.length >= 20) {
          const spyOld = spyBreadthData[spyBreadthData.length - 20];
          const spyNew = spyBreadthData[spyBreadthData.length - 1];
          const rspOld = rspBreadthData[rspBreadthData.length - 20];
          const rspNew = rspBreadthData[rspBreadthData.length - 1];
          
          const spyReturn = ((spyNew.close - spyOld.close) / spyOld.close) * 100;
          const rspReturn = ((rspNew.close - rspOld.close) / rspOld.close) * 100;
          
          breadthSpread = rspReturn - spyReturn;
          addLog(`✓ BREADTH HEALTH: SPY 20d Return=${spyReturn.toFixed(2)}%, RSP 20d Return=${rspReturn.toFixed(2)}%, Spread=${breadthSpread > 0 ? '+' : ''}${breadthSpread.toFixed(2)}%`);
          if (breadthSpread > 0) {
              addLog(`  ✓ BROAD PARTICIPATION: Average stocks outperforming Mega Caps (Healthy Market)`);
          } else {
              addLog(`  ⚠ NARROW LEADERSHIP: Mega Caps outperforming average stocks (Warning Sign)`);
          }
      } else {
          addLog(`⚠ BREADTH: Insufficient SPY/RSP data (${spyBreadthData.length} SPY, ${rspBreadthData.length} RSP bars). Spread will be 0.`);
      }

      // 5. Build Daily Chart Data (Last 252 days = 1 Year)
      addLog("↓ SYNTHESIS: Merging Multi-Timeframe Data...");
      
      const lookback = 252; 
      const recentData = priceData.slice(-lookback);
      
      // Maps for O(1) lookup of HTF values based on date
      // Logic: For a daily date, find the Monthly/Quarterly bar it belongs to
      const getMonthKey = (d: string) => {
          const date = new Date(d);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      };
      
      const getQuarterKey = (d: string) => {
           const date = new Date(d);
           const q = Math.floor(date.getMonth() / 3) + 1;
           return `${date.getFullYear()}-Q${q}`;
      };

      // Map Month Key -> SMA Value
      const m5Map = new Map<string, number>();
      monthlyData.forEach((d, i) => m5Map.set(getMonthKey(d.date), m5Series[i]));

      // Map Quarter Key -> SMA Value
      const q20Map = new Map<string, number>();
      quarterlyData.forEach((d, i) => q20Map.set(getQuarterKey(d.date), q20Series[i]));
      
      // Map Date -> Daily 200-SMA Value (for fallback)
      const daily200Map = new Map<string, number>();
      priceData.forEach((d, i) => daily200Map.set(d.date, daily200SMA[i]));
      
      // Map Quarter Key -> High/Low (for Fibs)
      const qHighLowMap = new Map<string, {h: number, l: number}>();
      quarterlyData.forEach((d) => qHighLowMap.set(getQuarterKey(d.date), { h: d.high || d.close, l: d.low || d.close }));

      const finalChartData: ChartDataPoint[] = [];
      let cumulativeBreadth = 0;
      
      recentData.forEach(day => {
          const mKey = getMonthKey(day.date);
          const qKey = getQuarterKey(day.date);
          
          const m5 = m5Map.get(mKey) || 0;
          
          // Use quarterly Q20 if available, otherwise fallback to daily 200-SMA
          let q20 = q20Map.get(qKey);
          if (!q20 || isNaN(q20) || q20 === 0) {
              q20 = daily200Map.get(day.date) || 0;
          }
          
          // Find matching VXX
          const vxxDay = vxxData.find(v => v.date === day.date);
          const vixVal = vxxDay ? vxxDay.close : 0;
          
          // Use static breadth spread (calculated once for the period)
          const ratio = breadthSpread > 0 ? 0.55 : 0.45; // Simplified display
          
          cumulativeBreadth += breadthSpread;

          finalChartData.push({
              date: day.date,
              open: day.open || day.close,
              high: day.high || day.close,
              low: day.low || day.close,
              price: day.close,
              m5,
              q20,
              vix: vixVal,
              breadthSpread,
              breadthRatio: ratio,
              breadthCumulative: cumulativeBreadth
          });
      });

      setChartData(finalChartData);

      // 6. Determine Current State
      const lastPt = finalChartData[finalChartData.length - 1];
      if (!lastPt) return;
      
      addLog(`✓ CHART: Generated ${finalChartData.length} daily bars for display`);

      const lastQ = qHighLowMap.get(getQuarterKey(lastPt.date));
      
      const qHigh = lastQ?.h || lastPt.price * 1.1;
      const qLow = lastQ?.l || lastPt.price * 0.9;
      
      // Breadth Health Calculation (RSP vs SPY spread)
      const netHighs = Math.round(breadthSpread * 100) / 100; // The actual spread value
      const netHighsChange = breadthSpread; // The spread itself represents the health indicator

      // Determine Condition
      let condition: MarketCondition = "RECOVERY";
      if (lastPt.price > lastPt.q20 && lastPt.price > lastPt.m5) condition = "BULL_RUN";
      else if (lastPt.price < lastPt.q20 && lastPt.price < lastPt.m5) condition = "BEAR_BREAKDOWN";
      else if (vxxRoc > 10) condition = "FEAR_SPIKE";
      else if (lastPt.price > lastPt.q20 && lastPt.price < lastPt.m5) condition = "GOLDEN_ZONE"; // Approx logic
      
      setSimState({
          currentCondition: condition,
          price: lastPt.price,
          vixRoc: vxxRoc,
          netHighs,
          netHighsChange,
          qHigh,
          qLow,
          breadthRatio: lastPt.breadthRatio,
          breadthCumulative: lastPt.breadthCumulative
      });
      setActiveCondition(condition);
      
      addLog(`✓ READY: System Online. Regime: ${condition}`);
      setLoading(false);
  };

  // --- MOCK GENERATOR (Fallback) ---
  const generateMockData = () => {
      const spy: DailyData[] = [];
      const vxx: DailyData[] = [];
      
      let price = 400;
      
      // Set starting price based on ticker
      if (selectedTicker === 'SPY') price = 450;
      else if (selectedTicker === 'QQQ') price = 380;
      else if (selectedTicker === 'IWM') price = 190;
      else if (selectedTicker === 'GLD') price = 180;
      else price = 200;

      let vol = 20;
      const now = new Date();
      
      // Generate 5 years of data
      for (let i = 1260; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          // Random Walk with slight upward bias for realistic looking stock charts
          price = price * (1 + (Math.random() - 0.45) * 0.02); 
          
          // Keep price positive
          if (price < 10) price = 10;

          vol = 20 + Math.sin(i/50) * 10 + (Math.random() * 5);
          
          spy.push({ date: dateStr, close: price, high: price * 1.01, low: price * 0.99, open: price });
          vxx.push({ date: dateStr, close: vol });
      }
      return { spy, vxx };
  };

  // --- RENDERING HELPERS ---
  // Calculate Fib Levels
  const range = simState ? simState.qHigh - simState.qLow : 10;
  const fib50 = simState ? simState.qHigh - (range * 0.5) : 0;
  const fib618 = simState ? simState.qHigh - (range * 0.618) : 0;
  const fib786 = simState ? simState.qHigh - (range * 0.786) : 0;

  const vixState = simState ? (simState.vixRoc > 10 ? "⚠️ FEAR SPIKE" : simState.vixRoc < -10 ? "Crushing" : "Stable") : "...";
  const vixColor = simState ? (simState.vixRoc > 10 ? "text-red-500 animate-pulse" : simState.vixRoc < -10 ? "text-green-500" : "text-muted-foreground") : "";
  
  const q20Trend = chartData.length > 0 && simState ? (simState.price > chartData[chartData.length - 1].q20 ? "ABOVE" : "BELOW") : "...";
  const m5Trend = chartData.length > 0 && simState ? (simState.price > chartData[chartData.length - 1].m5 ? "ABOVE" : "BELOW") : "...";

  let fibStatus = "Neutral";
  let fibColor = "text-muted-foreground";
  
  if (simState) {
      if (simState.price > fib50) { fibStatus = "Upper Half"; fibColor = "text-green-500"; }
      else if (simState.price <= fib50 && simState.price > fib618) { fibStatus = "Retracement"; fibColor = "text-white"; }
      else if (simState.price <= fib618 && simState.price > fib786) { fibStatus = "GOLDEN ZONE"; fibColor = "text-yellow-400 font-bold tracking-wider"; }
      else { fibStatus = "Deep / Bear"; fibColor = "text-red-500"; }
  }

  // Scroll to top when chart data loads
  useEffect(() => {
    if (chartData.length > 0) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [chartData]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedTicker]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden" style={{ scrollBehavior: 'auto' }}>
      <Navbar />
      <div className="container px-4 md:px-6 mx-auto space-y-8 pt-20 pb-20" style={{ minHeight: '100vh' }}>
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-4">
              <Link href="/indicator-library">
                <span className="text-primary hover:underline cursor-pointer">INDICATOR_LIBRARY</span>
              </Link>
              <span>/</span>
              <span>MACRO_DATA</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/50 rounded-none font-mono">
                v3.2
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">LIVE_DATA_ENABLED</span>
              {dataSource === "CACHE" && <Badge variant="secondary" className="text-[10px] bg-emerald-950 text-emerald-400 border-emerald-800">CACHE_HIT</Badge>}
              {dataSource === "MOCK" && <Badge variant="destructive" className="text-[10px]">SIMULATION</Badge>}
              {dataSource === "LIVE" && <Badge className="text-[10px] bg-blue-900 text-blue-200">LIVE API</Badge>}
            </div>
            <pre className="text-primary font-mono text-xs md:text-sm leading-tight mb-4 overflow-x-auto">
{`█████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█▄█░█▀█░█▀▀░█▀▄░█▀█░░░█▀▄░█▀█░▀█▀░█▀█░░░░░░░░░█
█░░░░░░░░█░█░█▀█░█░░░█▀▄░█░█░░░█░█░█▀█░░█░░█▀█░░░░░░░░░█
█░░░░░░░░▀░▀░▀░▀░▀▀▀░▀░▀░▀▀▀░░░▀▀░░▀░▀░░▀░░▀░▀░░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████████████`}
            </pre>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              The "Governor" of the system. Forces adherence to Higher Timeframe trends and institutional risk environments.
            </p>
            
            {/* Ticker Selector */}
            <div className="mt-4 flex gap-2">
              {TICKER_OPTIONS.map(option => (
                <Button
                  key={option.symbol}
                  onClick={() => setSelectedTicker(option.symbol)}
                  variant={selectedTicker === option.symbol ? "default" : "outline"}
                  size="sm"
                  className="font-mono text-xs h-7"
                >
                  {option.symbol}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2">
             <Button 
               variant={activeTab === "CHART" ? "default" : "outline"}
               onClick={() => setActiveTab("CHART")}
               className="font-mono text-xs h-8"
             >
               <Activity className="w-3 h-3 mr-2" />
               LIVE_CHART
             </Button>
             <Button 
               variant={activeTab === "PLAYBOOK" ? "default" : "outline"}
               onClick={() => setActiveTab("PLAYBOOK")}
               className="font-mono text-xs h-8"
             >
               <Info className="w-3 h-3 mr-2" />
               PLAYBOOK
             </Button>
          </div>
        </div>

        {activeTab === "CHART" ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Main Chart Area */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-1 bg-black/40 border-border relative overflow-hidden group h-[500px]">
                  {/* Chart Header Overlay */}
                  <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 pointer-events-none">
                    <span className="text-xs font-mono text-muted-foreground">TICKER: {selectedTicker} (Prev Close)</span>
                    <span className="text-4xl font-black text-white">{simState?.price.toFixed(2) || "---"}</span>
                  </div>

                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 60, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      
                      {/* Fib Lines (Background) */}
                      <ReferenceLine y={fib50} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 2" label={{ position: 'right', value: '50%', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                      <ReferenceLine y={fib618} stroke="rgba(255, 215, 0, 0.3)" strokeDasharray="4 4" label={{ position: 'right', value: '61.8%', fill: '#FFD700', fontSize: 10 }} />
                      <ReferenceLine y={fib786} stroke="rgba(255, 215, 0, 0.3)" strokeDasharray="4 4" label={{ position: 'right', value: '78.6%', fill: '#FFD700', fontSize: 10 }} />
                      
                      {/* Zone Fill */}
                      <ReferenceArea y1={fib618} y2={fib786} fill="rgba(255, 215, 0, 0.05)" />

                      <XAxis 
                        dataKey="date" 
                        stroke="#666" 
                        fontSize={10}
                        tickFormatter={(val) => val.slice(2)} 
                      />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000', borderColor: '#333', fontSize: '12px' }}
                        itemStyle={{ padding: 0 }}
                        labelFormatter={(label) => `Date: ${label}`}
                        content={({ active, payload }) => {
                          if (active && payload && payload[0]) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ backgroundColor: '#000', border: '1px solid #333', padding: '8px', fontSize: '12px' }}>
                                <p style={{ margin: 0, color: '#fff' }}>{data.date}</p>
                                <p style={{ margin: 0, color: '#22c55e' }}>O: {data.open?.toFixed(2)} H: {data.high?.toFixed(2)}</p>
                                <p style={{ margin: 0, color: '#ef4444' }}>L: {data.low?.toFixed(2)} C: {data.price?.toFixed(2)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {/* Q20 MA - Purple */}
                      <Line 
                        type="step" 
                        dataKey="q20" 
                        stroke="#a855f7" 
                        strokeWidth={2} 
                        dot={false} 
                        strokeOpacity={0.8}
                      />
                      
                      {/* M5 MA - Blue */}
                      <Line 
                        type="step" 
                        dataKey="m5" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        dot={false} 
                        strokeOpacity={0.9}
                      />

                      {/* Price - White Line */}
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#fff" 
                        strokeWidth={3} 
                        dot={false} 
                        activeDot={{ r: 4, fill: 'white' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>

                <div className="flex gap-4 text-sm text-muted-foreground font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-purple-500" /> Q20 SMA (Trend Guardrail)
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-blue-500" /> M5 SMA (Tactical Momentum)
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-[#FFD700]" /> Golden Zone (61.8-78.6%)
                  </div>
                </div>
              </div>

              {/* Sidebar / Dashboard + Logs */}
              <div className="space-y-4">
                {/* Macro Dashboard */}
                {simState && (
                <Card className="bg-black/40 border-border p-4">
                  <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Layers className="w-3 h-3" /> MACRO_DASHBOARD
                    </span>
                    <div className="flex gap-1">
                      <div className={`w-2 h-2 rounded-full ${simState.vixRoc > 10 ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
                    </div>
                  </div>
                  
                  <div className="space-y-2 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <span className="text-muted-foreground">VIX Velocity:</span>
                      <span className="text-[#ffffff]">See TradingView</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <span className="text-muted-foreground">Vol Signal:</span>
                      <span className={vixColor}>{vixState}</span>
                    </div>

                    <div className="h-px bg-white/10 my-2" />

                    <div className="grid grid-cols-2 gap-4">
                      <span className="text-muted-foreground">Breadth Health:</span>
                      <span className="text-[#ffffff]">See TradingView</span>
                    </div>
                    
                    <div className="h-px bg-white/10 my-2" />

                    <div className="grid grid-cols-2 gap-4">
                      <span className="text-muted-foreground">Q20 Trend:</span>
                      <span className={q20Trend === "ABOVE" ? "text-purple-400" : "text-orange-500"}>{q20Trend}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <span className="text-muted-foreground">M5 Trend:</span>
                      <span className={m5Trend === "ABOVE" ? "text-blue-400" : "text-orange-500"}>{m5Trend}</span>
                    </div>

                    <div className="h-px bg-white/10 my-2" />

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="text-muted-foreground">Q-Fib Status:</span>
                      <span className={fibColor}>{fibStatus}</span>
                    </div>
                  </div>
                </Card>
                )}

                <Card className="bg-black/20 border-border p-4 h-[500px] flex flex-col">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">SYSTEM_LOGS</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 pr-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {logs.map((log, i) => (
                      <div key={i} className="text-muted-foreground break-words">
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </Card>
              </div>

            </div>

            {/* USD Correlation Terminal */}
            <div className="mt-8">
              <USDCorrelationTerminal />
            </div>
          </div>
        ) : (
          <PlaybookCTA />
        )}
        <LegalFooter />
      </div>
    </div>
  );
}
