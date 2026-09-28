import { useState, useMemo, useEffect, useRef } from "react";
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
  RefreshCw,
  Settings
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaybookCTA } from "@/components/playbook-cta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
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

// --- CONFIGURATION ---
const SECTOR_CACHE_KEY = 'SECTOR_ROTATION_TIINGO_V2'; // Reuse cache if available
const MACRO_CACHE_KEY = 'MACRO_REGIME_CACHE_V2'; // Reuse VXX/Macro cache
const API_KEY_STORAGE_KEY = 'TIINGO_API_KEY'; // Local storage key for API Key

// --- TYPES ---
type MarketCondition = "BULL_RUN" | "GOLDEN_ZONE" | "FEAR_SPIKE" | "BEAR_BREAKDOWN" | "RECOVERY";

interface ChartDataPoint {
  date: string;
  price: number;
  q20: number; // Quarterly 20 MA
  m5: number;  // Monthly 5 MA
  vix: number; // VIX value
}

interface SimulationState {
  currentCondition: MarketCondition;
  price: number;
  vixRoc: number;
  netHighs: number;
  netHighsChange: number;
  qHigh: number;
  qLow: number;
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

// --- STORAGE HELPER ---
const safeStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('LocalStorage access blocked:', e);
            return null;
        }
    },
    setItem: (key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('LocalStorage save blocked:', e);
        }
    }
};

export default function IndicatorMacroTruth() {
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
  
  // Settings State
  const [apiKey, setApiKey] = useState<string>(() => safeStorage.getItem(API_KEY_STORAGE_KEY) || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const saveSettings = () => {
    safeStorage.setItem(API_KEY_STORAGE_KEY, tempApiKey);
    setApiKey(tempApiKey);
    setIsSettingsOpen(false);
    addLog("⚙ SETTINGS: API Key updated. Reloading data...");
    window.location.reload(); // Simple reload to re-init with new key
  };

  // --- DATA FETCHING & PROCESSING ---
  useEffect(() => {
    const init = async () => {
        setLoading(true);
        setLogs([]);
        addLog(`> INIT: Starting Macro Truth-Teller sequence (${selectedTicker})...`);
        
        try {
            let tickerData: DailyData[] = [];
            let vxxData: DailyData[] = [];
            
            // 1. Try loading from Sector Rotation Cache first
            addLog("↓ CACHE: Checking local storage for shared market data...");
            const sectorCache = safeStorage.getItem(SECTOR_CACHE_KEY);
            const macroCache = safeStorage.getItem(MACRO_CACHE_KEY);
            
            let cacheHit = false;

            // Basic check to see if we have today's data in cache
            const today = new Date().toISOString().split('T')[0];
            
            if (sectorCache) {
                const parsed = JSON.parse(sectorCache);
                // Check if cache is stale (optional, but good practice)
                // For now, just check if data exists
                if (parsed.data && parsed.data[selectedTicker]) {
                    tickerData = parsed.data[selectedTicker];
                    addLog(`✓ CACHE: Found ${selectedTicker} data (${tickerData.length} bars)`);
                    cacheHit = true;
                }
            }

            if (macroCache) {
                const parsed = JSON.parse(macroCache);
                if (parsed.data && parsed.data['VXX']) {
                    vxxData = parsed.data['VXX'];
                    addLog(`✓ CACHE: Found VXX (Vol Proxy) data (${vxxData.length} bars)`);
                    // cacheHit = true; // Don't set cacheHit just for VXX, need main ticker
                }
            }

            // 2. If no cache or incomplete, fetch live (if API key exists) or fallback to mock
            if (!cacheHit || tickerData.length === 0 || vxxData.length === 0) {
                 if (!apiKey) {
                    addLog("⚠ API: Key missing. Switching to SIMULATION mode.");
                    // Generate Mock Data (Fallback)
                    const mock = generateMockData();
                    tickerData = mock.spy;
                    vxxData = mock.vxx;
                    setDataSource("MOCK");
                 } else {
                    addLog("☁ NETWORK: Fetching live data from Tiingo API...");
                    try {
                        const fetchedTicker = await fetchTiingoData(selectedTicker, apiKey);
                        const fetchedVxx = await fetchTiingoData('VXX', apiKey); // Using VXX as VIX proxy for tradable history
                        
                        if (fetchedTicker && fetchedTicker.length > 0) {
                            tickerData = fetchedTicker;
                            // Update Cache
                            const newSectorCache = sectorCache ? JSON.parse(sectorCache) : { data: {} };
                            newSectorCache.data[selectedTicker] = tickerData;
                            safeStorage.setItem(SECTOR_CACHE_KEY, JSON.stringify(newSectorCache));
                        }
                        
                        if (fetchedVxx && fetchedVxx.length > 0) {
                            vxxData = fetchedVxx;
                            const newMacroCache = macroCache ? JSON.parse(macroCache) : { data: {} };
                            newMacroCache.data['VXX'] = vxxData;
                            safeStorage.setItem(MACRO_CACHE_KEY, JSON.stringify(newMacroCache));
                        }

                        setDataSource("LIVE");
                        addLog(`✓ NETWORK: Successfully retrieved ${tickerData.length} bars.`);

                    } catch (err: any) {
                        addLog(`❌ API ERROR: ${err.message}. Reverting to MOCK.`);
                         const mock = generateMockData();
                        tickerData = mock.spy;
                        vxxData = mock.vxx;
                        setDataSource("MOCK");
                    }
                 }
            } else {
                setDataSource("CACHE");
            }

            // 3. Process Data
            processMarketData(tickerData, vxxData);

        } catch (e: any) {
            addLog(`❌ ERROR: ${e.message}`);
            setError(e.message);
            setLoading(false);
        }
    };

    init();
  }, [selectedTicker, apiKey]);

  const fetchTiingoData = async (ticker: string, token: string): Promise<DailyData[]> => {
      const startDate = '2019-01-01'; // 5 Years of data
      const url = `https://cors-anywhere.herokuapp.com/https://api.tiingo.com/tiingo/daily/${ticker}/prices?startDate=${startDate}&token=${token}`;
      
      // Note: using a CORS proxy is often needed for client-side fetches to external APIs
      // However, Tiingo supports CORS if headers are set correctly. 
      // Let's try direct first, if fail, we might need a proxy or backend.
      // Tiingo requires strict Content-Type.
      
      // For this mockup environment, we'll try a direct fetch. 
      // If CORS fails, the user will see the error log.
      
      const directUrl = `https://api.tiingo.com/tiingo/daily/${ticker}/prices?startDate=${startDate}&token=${token}`;
      
      const res = await fetch(directUrl, {
          headers: {
              'Content-Type': 'application/json'
          }
      });
      
      if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
              throw new Error("Invalid API Key or Permissions");
          }
          throw new Error(`Tiingo API Error: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.map((d: any) => ({
          date: d.date.split('T')[0],
          close: d.close,
          high: d.high,
          low: d.low,
          open: d.open,
          volume: d.volume
      }));
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // --- PROCESSOR ---
  const processMarketData = async (spyData: DailyData[], vxxData: DailyData[]) => {
      addLog("↓ COMPUTE: Resampling data to Higher Timeframes...");
      
      if (!spyData || spyData.length === 0) {
           addLog("❌ ERROR: No Data to process");
           return;
      }

      // 1. Resample
      const monthlyData = FinancialMath.resample(spyData, 'M');
      const quarterlyData = FinancialMath.resample(spyData, 'Q');
      
      addLog(`✓ COMPUTE: Generated ${monthlyData.length} Monthly & ${quarterlyData.length} Quarterly bars`);

      // 2. Calculate SMAs
      addLog("↓ ANALYZE: Calculating Q20 (Secular Trend) & M5 (Tactical)...");
      const q20Series = FinancialMath.calculateSMA(quarterlyData, 20);
      const m5Series = FinancialMath.calculateSMA(monthlyData, 5);
      
      // 3. Calculate VIX ROC
      // Note: VXX is inverse/proxy. High VXX = High Fear.
      // We'll calculate ROC on VXX directly.
      addLog("↓ MONITOR: Analyzing Volatility Kinetics...");
      const vxxRoc = vxxData.length > 5 ? (FinancialMath.calculateROC(vxxData, 5) || 0) : 0;

      // 4. Build Daily Chart Data (Last 252 days = 1 Year)
      addLog("↓ SYNTHESIS: Merging Multi-Timeframe Data...");
      
      const lookback = 252; 
      const recentSpy = spyData.slice(-lookback);
      
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
      
      // Map Quarter Key -> High/Low (for Fibs)
      const qHighLowMap = new Map<string, {h: number, l: number}>();
      quarterlyData.forEach((d) => qHighLowMap.set(getQuarterKey(d.date), { h: d.high || d.close, l: d.low || d.close }));

      const finalChartData: ChartDataPoint[] = [];
      
      recentSpy.forEach(day => {
          const mKey = getMonthKey(day.date);
          const qKey = getQuarterKey(day.date);
          
          // Use previous month/quarter close if current not available (or use developing)
          // For simplicity, we use the value mapped to the current period (Developing)
          const m5 = m5Map.get(mKey) || 0;
          const q20 = q20Map.get(qKey) || 0;
          
          // Find matching VXX
          const vxxDay = vxxData.find(v => v.date === day.date);
          const vixVal = vxxDay ? vxxDay.close : 0;

          finalChartData.push({
              date: day.date,
              price: day.close,
              m5,
              q20,
              vix: vixVal
          });
      });

      setChartData(finalChartData);

      // 5. Determine Current State
      const lastPt = finalChartData[finalChartData.length - 1];
      if (!lastPt) return;

      const lastQ = qHighLowMap.get(getQuarterKey(lastPt.date));
      
      const qHigh = lastQ?.h || lastPt.price * 1.1;
      const qLow = lastQ?.l || lastPt.price * 0.9;
      
      // Breadth Simulation (Random walk for now as we lack data)
      const netHighs = Math.floor(Math.random() * 300) - 100;
      const netHighsChange = (Math.random() * 10) - 5;

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
          qLow
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

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Navbar />
      
      <div className="container px-4 md:px-6 mx-auto space-y-8 pt-20 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-4">
              <Link href="/indicator-library">
                <span className="text-primary hover:underline cursor-pointer">INDICATOR_LIBRARY</span>
              </Link>
              <span>/</span>
              <span>MACRO_TRUTH</span>
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
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-white mb-2">
              Macro <span className="text-stroke-primary">Truth-Teller</span>
            </h1>
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
              
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                        <Settings className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Configuration</DialogTitle>
                        <DialogDescription>
                            Enter your Tiingo API Token to enable live data.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="api-key" className="text-right">
                                API Token
                            </Label>
                            <Input
                                id="api-key"
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
                                className="col-span-3"
                                placeholder="Tiingo API Token..."
                                type="password"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={saveSettings}>Save Configuration</Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

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
                    <span className="text-xs font-mono text-muted-foreground">TICKER: {selectedTicker} ({dataSource})</span>
                    <span className="text-2xl font-bold text-white">{simState?.price.toFixed(2) || "---"}</span>
                  </div>

                  {/* The Dashboard Overlay */}
                  {simState && (
                  <div className="absolute top-4 right-4 z-20 bg-black/80 backdrop-blur-md border border-white/20 p-4 min-w-[240px] shadow-2xl">
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
                        <span className={`${simState.vixRoc > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                          {simState.vixRoc > 0 ? '+' : ''}{simState.vixRoc.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-muted-foreground">Vol Signal:</span>
                        <span className={vixColor}>{vixState}</span>
                      </div>

                      <div className="h-px bg-white/10 my-2" />

                      <div className="grid grid-cols-2 gap-4">
                        <span className="text-muted-foreground">Breadth (Net):</span>
                        <span className={simState.netHighs > 0 ? "text-green-400" : "text-red-400"}>
                          {simState.netHighs} ({simState.netHighsChange > 0 ? "+" : ""}{simState.netHighsChange.toFixed(1)}%)
                        </span>
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
                  </div>
                  )}

                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 60, right: 20, left: 0, bottom: 20 }}>
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

                      {/* Price */}
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#fff" 
                        strokeWidth={1} 
                        dot={false} 
                        activeDot={{ r: 4, fill: 'white' }}
                      />
                    </LineChart>
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

              {/* Sidebar / Logs */}
              <div className="space-y-4">
                <Card className="bg-black/20 border-border p-4 h-[500px] flex flex-col">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">SYSTEM_LOGS</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 pr-2 scrollbar-thin scrollbar-thumb-white/10">
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
          </div>
        ) : (
          <PlaybookCTA />
        )}
        <LegalFooter />
      </div>
    </div>
  );
}
