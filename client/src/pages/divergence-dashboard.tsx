import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Search, TrendingUp, TrendingDown, Zap, AlertCircle, RefreshCw, Cpu, Zap as Spark, X, Plus, Rocket, AlertTriangle, Eye, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";
import { CompanyDivergenceEngine, ETFDivergenceEngine, PriceDivergenceEngine, isLikelyETF, type CompanyAnalysis, type ETFAnalysis, type DivergenceAnalysis, type FundamentalData, type CapitalAllocation } from "@/lib/divergence-engine";
import { AITerminalConsole } from "@/components/ai-terminal-console";

// Storage keys
const PULL_HISTORY_KEY = 'DIVERGENCE_PULL_HISTORY_V1';
const WATCHLIST_KEY = 'DIVERGENCE_WATCHLIST_V1';
const RECENTLY_VIEWED_KEY = 'DIVERGENCE_RECENTLY_VIEWED_V1';
const ANALYSIS_CACHE_KEY = 'DIVERGENCE_ANALYSIS_CACHE_V2'; // Bumped to invalidate old cached data
const MAX_LOG_ENTRIES = 50;
const MAX_RECENTLY_VIEWED = 5;

// Fallback in-memory storage when localStorage is blocked
const memoryStorage: Record<string, string> = {};

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStorage[key] = value;
    }
  },
};

// Info Tooltip Component
const InfoTooltip = ({ label, formula }: { label: string; formula: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center gap-1 group"
      >
        <Info className="w-3 h-3 text-primary/60 hover:text-primary transition-colors" />
      </button>
      {show && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-black border border-primary/50 rounded p-3 text-xs font-mono text-muted-foreground z-50 shadow-lg">
          <div className="text-primary font-bold mb-2">{label}</div>
          <div className="whitespace-pre-wrap text-xs leading-relaxed">{formula}</div>
        </div>
      )}
    </div>
  );
};

interface TiingoDailyData {
  date: string;
  close: number;
  open?: number;
  volume?: number;
}

// Fetch financial fundamentals from FMP API (with activity logging)
const fetchFinancialData = async (ticker: string, onLog?: (msg: string) => void): Promise<FundamentalData[]> => {
  try {
    const response = await fetch(`/api/tiingo/fundamentals/${ticker}`);
    if (!response.ok) {
      console.log(`Fundamentals API returned ${response.status} for ${ticker}`);
      onLog?.(`✗ API Error: ${response.status} for ${ticker}`);
      return [];
    }
    
    const result = await response.json();
    
    // Display ALL logs from the API response
    if (result.logs && Array.isArray(result.logs)) {
      result.logs.forEach((log: string) => onLog?.(log));
    }
    
    return result.data || [];
  } catch (e) {
    console.error(`Error fetching fundamentals for ${ticker}:`, e);
    onLog?.(`✗ Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return [];
  }
};

// Fetch daily close data from backend (which uses Tiingo API)
const fetchTiingoData = async (ticker: string): Promise<TiingoDailyData[]> => {
  try {
    const response = await fetch(`/api/tiingo/${ticker}`);
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data;
  } catch (e) {
    return [];
  }
};

// Calculate acceleration from daily price data
const calculateRealAcceleration = (dailyData: TiingoDailyData[], days: number) => {
  if (dailyData.length < days * 2) return 0;
  
  const recent = dailyData.slice(-days);
  const previous = dailyData.slice(-days * 2, -days);
  
  const recentReturn = ((recent[recent.length - 1]?.close || 0) - (recent[0]?.close || 1)) / (recent[0]?.close || 1) * 100;
  const previousReturn = ((previous[previous.length - 1]?.close || 0) - (previous[0]?.close || 1)) / (previous[0]?.close || 1) * 100;
  
  return recentReturn - previousReturn;
};

// Fetch price-fundamental divergence with logs
const fetchPriceDivergence = async (ticker: string): Promise<{ data: any; logs: string[] } | null> => {
  try {
    const response = await fetch(`/api/price-divergence/${ticker}`);
    if (!response.ok) return null;
    const result = await response.json();
    // Extract logs from response and return separately
    const logs = result.logs || [];
    const { logs: _, ...data } = result;
    return { data, logs };
  } catch (e) {
    return null;
  }
};

type RegimeAnalysis = CompanyAnalysis | ETFAnalysis;

const getRegimeColor = (analysis: DivergenceAnalysis) => {
  if (analysis.type === "COMPANY") {
    const regime = analysis.regime;
    const colors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
      POWER: { bg: "bg-emerald-950", text: "text-emerald-400", border: "border-emerald-500/50", glow: "rgba(16, 185, 129, 0.3)" },
      TREND: { bg: "bg-blue-950", text: "text-blue-400", border: "border-blue-500/50", glow: "rgba(59, 130, 246, 0.3)" },
      WARN: { bg: "bg-red-950", text: "text-red-400", border: "border-red-500/50", glow: "rgba(239, 68, 68, 0.3)" },
      WATCH: { bg: "bg-amber-950", text: "text-amber-400", border: "border-amber-500/50", glow: "rgba(245, 158, 11, 0.3)" },
    };
    return colors[regime] || colors.POWER;
  } else {
    // ETF analysis
    const colors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
      BULLISH: { bg: "bg-emerald-950", text: "text-emerald-400", border: "border-emerald-500/50", glow: "rgba(16, 185, 129, 0.3)" },
      BEARISH: { bg: "bg-red-950", text: "text-red-400", border: "border-red-500/50", glow: "rgba(239, 68, 68, 0.3)" },
      NEUTRAL: { bg: "bg-slate-950", text: "text-slate-400", border: "border-slate-500/50", glow: "rgba(100, 116, 139, 0.3)" },
    };
    return colors[analysis.sectorTrend] || colors.NEUTRAL;
  }
};

const getRegimeColorByName = (regimeName: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    POWER: { bg: "bg-emerald-950", text: "text-emerald-400", border: "border-emerald-500/50" },
    TREND: { bg: "bg-blue-950", text: "text-blue-400", border: "border-blue-500/50" },
    WARN_MILD: { bg: "bg-orange-950", text: "text-orange-400", border: "border-orange-500/50" },
    WARN: { bg: "bg-red-950", text: "text-red-400", border: "border-red-500/50" },
    WARN_SEVERE: { bg: "bg-red-950", text: "text-red-200", border: "border-red-500/70" },
    WATCH: { bg: "bg-amber-950", text: "text-amber-400", border: "border-amber-500/50" },
  };
  return colors[regimeName] || colors.POWER;
};

// Determine severity of acceleration/deceleration
const getAccelerationSeverity = (value: number): "MILD" | "MODERATE" | "SEVERE" => {
  const abs = Math.abs(value);
  if (abs < 5) return 'MILD';
  if (abs < 15) return 'MODERATE';
  return 'SEVERE';
};

// Enhanced regime classification with severity levels
const classifyRegimeEnhanced = (revAccel: number | null, margAccel: number | null): "POWER" | "TREND" | "WARN_MILD" | "WARN" | "WARN_SEVERE" | "WATCH" => {
  if (revAccel === null || margAccel === null) {
    return "WATCH";
  }

  const revenueAccelerating = revAccel > 0;
  const marginsExpanding = margAccel > 0;

  // POWER - Accelerating revenue + Expanding margins
  if (revenueAccelerating && marginsExpanding) {
    return 'POWER';
  }

  // TREND - Decelerating revenue + Expanding margins
  if (!revenueAccelerating && marginsExpanding) {
    return 'TREND';
  }

  // WARN - Decelerating revenue + Contracting margins (with severity)
  if (!revenueAccelerating && !marginsExpanding) {
    const maxSeverity = Math.max(Math.abs(revAccel), Math.abs(margAccel));
    if (maxSeverity < 10) {
      return 'WARN_MILD';
    } else if (maxSeverity < 20) {
      return 'WARN';
    } else {
      return 'WARN_SEVERE';
    }
  }

  // WATCH - Accelerating revenue + Contracting margins
  if (revenueAccelerating && !marginsExpanding) {
    return 'WATCH';
  }

  return 'WATCH';
};

// Debug helper - traces a regime classification
const debugClassifyRegime = (label: string, revAccel: number | null, margAccel: number | null) => {
  const result = classifyRegimeEnhanced(revAccel, margAccel);
  console.log(`[CLASSIFY] ${label}: Rev=${revAccel}, Margin=${margAccel} → ${result}`);
  return result;
};

// Legacy function - maps enhanced regimes back to original format
const classifyRegime = (revAccel: number | null, margAccel: number | null): "POWER" | "TREND" | "WARN" | "WATCH" => {
  const enhanced = classifyRegimeEnhanced(revAccel, margAccel);
  if (enhanced === 'WARN_MILD' || enhanced === 'WARN_SEVERE') {
    return 'WARN';
  }
  return enhanced as "POWER" | "TREND" | "WATCH";
};

// Regime Combination Matrix - 36 combinations with severity levels
interface RegimeCombination {
  overall: string;
  signal: string;
  confidence: number;
  emoji: string;
  description: string;
}

const REGIME_COMBINATION_MATRIX: Record<string, RegimeCombination> = {
  // POWER Combinations
  'POWER_POWER': { overall: 'POWER', signal: 'STRONG BUY', confidence: 0.95, emoji: '🚀', description: 'Firing on all cylinders' },
  'POWER_TREND': { overall: 'INFLECTION_UP', signal: 'BUY', confidence: 0.80, emoji: '📈', description: 'Recent inflection to upside' },
  'POWER_WARN_MILD': { overall: 'EARLY_RECOVERY', signal: 'ACCUMULATE', confidence: 0.70, emoji: '🌱', description: 'Early stage recovery from mild weakness' },
  'POWER_WARN': { overall: 'EARLY_RECOVERY', signal: 'ACCUMULATE', confidence: 0.65, emoji: '🌱', description: 'Turnaround attempt in progress' },
  'POWER_WARN_SEVERE': { overall: 'SPECULATIVE_RECOVERY', signal: 'SMALL POSITION', confidence: 0.45, emoji: '⚠️', description: 'High risk turnaround attempt' },
  'POWER_WATCH': { overall: 'IMPROVING', signal: 'BUY', confidence: 0.70, emoji: '⚡', description: 'Margin pressure easing' },
  // TREND Combinations
  'TREND_POWER': { overall: 'MATURING', signal: 'HOLD', confidence: 0.75, emoji: '📊', description: 'Natural deceleration after strong run' },
  'TREND_TREND': { overall: 'TREND', signal: 'HOLD', confidence: 0.70, emoji: '➡️', description: 'Stable, mature business' },
  'TREND_WARN_MILD': { overall: 'SOFTENING', signal: 'HOLD', confidence: 0.60, emoji: '⚠️', description: 'Minor weakness emerging' },
  'TREND_WARN': { overall: 'DETERIORATING', signal: 'REDUCE', confidence: 0.75, emoji: '⚠️', description: 'Transitioning to bearish' },
  'TREND_WARN_SEVERE': { overall: 'DETERIORATING', signal: 'REDUCE', confidence: 0.80, emoji: '📉', description: 'Significant deterioration underway' },
  'TREND_WATCH': { overall: 'MIXED', signal: 'HOLD', confidence: 0.50, emoji: '🤷', description: 'Unclear direction' },
  // WARN_MILD Combinations
  'WARN_MILD_POWER': { overall: 'COOLING_OFF', signal: 'HOLD', confidence: 0.70, emoji: '🎯', description: 'Minor pullback from strength' },
  'WARN_MILD_TREND': { overall: 'SOFTENING', signal: 'HOLD', confidence: 0.60, emoji: '➡️', description: 'Modest weakness developing' },
  'WARN_MILD_WARN_MILD': { overall: 'WEAKENING', signal: 'REDUCE', confidence: 0.70, emoji: '⚠️', description: 'Gradual deterioration' },
  'WARN_MILD_WARN': { overall: 'WEAKENING', signal: 'REDUCE', confidence: 0.75, emoji: '📉', description: 'Short-term weakness, long-term trouble' },
  'WARN_MILD_WARN_SEVERE': { overall: 'DETERIORATING', signal: 'REDUCE', confidence: 0.80, emoji: '🔴', description: 'Recent weakness in troubled business' },
  'WARN_MILD_WATCH': { overall: 'MIXED', signal: 'HOLD', confidence: 0.50, emoji: '🤷', description: 'Mixed signals, unclear trend' },
  // WARN Combinations
  'WARN_POWER': { overall: 'PEAKING', signal: 'TAKE PROFITS', confidence: 0.85, emoji: '🎯', description: 'Normalization after explosive growth' },
  'WARN_TREND': { overall: 'WEAKENING', signal: 'REDUCE', confidence: 0.80, emoji: '📉', description: 'Business momentum fading' },
  'WARN_WARN_MILD': { overall: 'WEAKENING', signal: 'REDUCE', confidence: 0.75, emoji: '📉', description: 'Short-term trouble, long-term softness' },
  'WARN_WARN': { overall: 'WARN', signal: 'SELL', confidence: 0.90, emoji: '🔴', description: 'Business in trouble' },
  'WARN_WARN_SEVERE': { overall: 'DISTRESSED', signal: 'SELL', confidence: 0.95, emoji: '💀', description: 'Severe structural problems' },
  'WARN_WATCH': { overall: 'WARN', signal: 'SELL', confidence: 0.85, emoji: '🚨', description: 'Multiple headwinds' },
  // WARN_SEVERE Combinations
  'WARN_SEVERE_POWER': { overall: 'SHARP_REVERSAL', signal: 'REDUCE', confidence: 0.75, emoji: '⚠️', description: 'Severe short-term breakdown despite strength' },
  'WARN_SEVERE_TREND': { overall: 'COLLAPSING', signal: 'SELL', confidence: 0.85, emoji: '🔴', description: 'Rapid deterioration' },
  'WARN_SEVERE_WARN_MILD': { overall: 'COLLAPSING', signal: 'SELL', confidence: 0.85, emoji: '🔴', description: 'Severe recent collapse' },
  'WARN_SEVERE_WARN': { overall: 'DISTRESSED', signal: 'SELL', confidence: 0.95, emoji: '💀', description: 'Accelerating collapse' },
  'WARN_SEVERE_WARN_SEVERE': { overall: 'CRITICAL', signal: 'AVOID', confidence: 0.98, emoji: '☠️', description: 'Catastrophic failure' },
  'WARN_SEVERE_WATCH': { overall: 'DISTRESSED', signal: 'SELL', confidence: 0.90, emoji: '💀', description: 'Severe problems across metrics' },
  // WATCH Combinations
  'WATCH_POWER': { overall: 'INVESTING_FOR_GROWTH', signal: 'HOLD', confidence: 0.70, emoji: '🏗️', description: 'Heavy investment cycle' },
  'WATCH_TREND': { overall: 'PRESSURED', signal: 'REDUCE', confidence: 0.75, emoji: '⚡', description: 'Margin pressure emerging' },
  'WATCH_WARN_MILD': { overall: 'PRESSURED', signal: 'REDUCE', confidence: 0.65, emoji: '⚠️', description: 'Margin pressure with mild weakness' },
  'WATCH_WARN': { overall: 'DISTRESSED', signal: 'AVOID', confidence: 0.85, emoji: '💀', description: 'Structural challenges' },
  'WATCH_WARN_SEVERE': { overall: 'CRITICAL', signal: 'AVOID', confidence: 0.90, emoji: '☠️', description: 'Severe structural breakdown' },
  'WATCH_WATCH': { overall: 'WATCH', signal: 'HOLD', confidence: 0.60, emoji: '👀', description: 'Trading margins for growth' }
};

const analyzeRegimeCombination = (qoqRegime: string, yoyRegime: string): RegimeCombination => {
  const key = `${qoqRegime}_${yoyRegime}`;
  const result = REGIME_COMBINATION_MATRIX[key];
  console.log(`[COMBINE] QoQ=${qoqRegime}, YoY=${yoyRegime} → Key: ${key} → Overall: ${result?.overall || 'NOT FOUND'}, Signal: ${result?.signal || 'N/A'}`);
  if (!result) {
    console.warn(`❌ Matrix key not found: ${key}`);
  }
  return result || { overall: 'UNKNOWN', signal: 'HOLD', confidence: 0, emoji: '❓', description: 'Invalid combination' };
};

const getRegimeEmoji = (regime: string): string => {
  const emojis: Record<string, string> = {
    'POWER': '🟢',
    'TREND': '🔵',
    'WARN_MILD': '🟠',
    'WARN': '🔴',
    'WARN_SEVERE': '🔴',
    'WATCH': '🟡'
  };
  return emojis[regime] || '⚪';
};

const getRegimeLabel = (regime: string): string => {
  const labels: Record<string, string> = {
    'POWER': 'POWER',
    'TREND': 'TREND',
    'WARN_MILD': 'WARN (Mild)',
    'WARN': 'WARN',
    'WARN_SEVERE': 'WARN (Severe)',
    'WATCH': 'WATCH'
  };
  return labels[regime] || regime;
};

const getSignalClass = (signal: string): string => {
  const classes: Record<string, string> = {
    'STRONG BUY': 'text-[#00ff00]',
    'BUY': 'text-emerald-400',
    'ACCUMULATE': 'text-blue-400',
    'HOLD': 'text-slate-400',
    'TAKE PROFITS': 'text-orange-400',
    'REDUCE': 'text-amber-400',
    'SELL': 'text-red-400',
    'AVOID': 'text-red-600'
  };
  return classes[signal] || 'text-slate-400';
};

// Calculate combined regime analysis from QoQ and YoY data with severity levels
const getFullRegimeAnalysis = (analysis: CompanyAnalysis) => {
  // Use enhanced classification to get severity levels (WARN_MILD, WARN, WARN_SEVERE)
  console.log(`\n=== REGIME ANALYSIS: ${analysis.ticker} ===`);
  const qoqRegime = debugClassifyRegime('QoQ', analysis.revenueAcceleration.qoq, analysis.marginAcceleration.qoq);
  const yoyRegime = debugClassifyRegime('YoY', analysis.revenueAcceleration.yoy, analysis.marginAcceleration.yoy);
  const combined = analyzeRegimeCombination(qoqRegime, yoyRegime);
  console.log(`✓ FINAL: Overall=${combined.overall}, Signal=${combined.signal}, Confidence=${combined.confidence}\n`);
  
  return {
    qoqRegime,
    yoyRegime,
    ...combined
  };
};

// Helper to get the CORRECT regime from a company analysis by recalculating from acceleration values
// This fixes any cached data that had the wrong regime classification
const getCorrectRegime = (analysis: CompanyAnalysis): "POWER" | "TREND" | "WARN_MILD" | "WARN" | "WARN_SEVERE" | "WATCH" => {
  return classifyRegimeEnhanced(analysis.revenueAcceleration.qoq, analysis.marginAcceleration.qoq);
};

const generateMockCompanyAnalysis = (ticker: string): CompanyAnalysis => {
  // Generate correlated acceleration values so regime matches metrics
  const revAccel = (Math.random() - 0.5) * 20;
  const margAccel = (Math.random() - 0.5) * 10;
  const regime = classifyRegime(revAccel, margAccel);
  
  const verdicts: CapitalAllocation["verdict"][] = ["Aggressive Buyback", "Dilutive", "High Efficiency", "Capital Destroyer", "Neutral"];
  return {
    type: "COMPANY",
    ticker: ticker.toUpperCase(),
    regime,
    inflectionScore: Math.floor(50 + revAccel * 2),
    revenueAcceleration: { qoq: revAccel, yoy: (Math.random() - 0.5) * 15 },
    marginAcceleration: { qoq: margAccel, yoy: (Math.random() - 0.5) * 8 },
    earningsAcceleration: { qoq: revAccel * 1.2, yoy: (Math.random() - 0.5) * 20 },
    capitalAllocation: {
      shareCountChangeYoY: (Math.random() - 0.6) * 8, // Slightly biased towards buybacks
      roicTrendYoY: (Math.random() - 0.5) * 4,
      netDebtChangeYoY: (Math.random() - 0.5) * 20,
      verdict: verdicts[Math.floor(Math.random() * verdicts.length)]
    },
    confidence: Math.random() * 0.4 + 0.6,
    isMock: true,
  };
};

const generateMockETFAnalysis = (ticker: string): ETFAnalysis => {
  const trends: ("BULLISH" | "BEARISH" | "NEUTRAL")[] = ["BULLISH", "BEARISH", "NEUTRAL"];
  const sectorTrend = trends[Math.floor(Math.random() * trends.length)];
  const rvolValue = Math.random() * 2;
  const isBullish = Math.random() > 0.5;
  let volumeConviction: "HIGH CONVICTION BUY" | "HIGH CONVICTION SELL" | "NORMAL" | "LOW INTEREST" = "NORMAL";
  if (rvolValue > 1.5) {
    volumeConviction = isBullish ? "HIGH CONVICTION BUY" : "HIGH CONVICTION SELL";
  } else if (rvolValue < 0.8) {
    volumeConviction = "LOW INTEREST";
  }
  
  return {
    type: "ETF",
    ticker: ticker.toUpperCase(),
    priceVsSectorMomentum: (Math.random() - 0.5) * 20,
    sectorTrend,
    divergenceStrength: Math.random() * 50,
    priceAcceleration: (Math.random() - 0.5) * 15,
    volumeTrend: rvolValue,
    volumeConviction,
    latestPrice: Math.random() * 500 + 50,
    confidence: Math.random() * 0.4 + 0.5,
    isMock: true,
  };
};

export default function DivergenceDashboard() {
  const [ticker, setTicker] = useState("");
  const [watchlistTicker, setWatchlistTicker] = useState("");
  const [analysis, setAnalysis] = useState<RegimeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisTab, setAnalysisTab] = useState<"playbook" | "company" | "etf" | "formulas">("playbook");
  const [logs, setLogs] = useState<string[]>([]);
  const [pullHistory, setPullHistory] = useState<Record<string, number>>({});
  const [watchlist, setWatchlist] = useState<string[]>(["AAPL", "MSFT", "NVDA"]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [playbookIndex, setPlaybookIndex] = useState(0);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{ regime?: string; signal?: string; confidence?: number } | null>(null);

  // Helper: Get today's date in YYYY-MM-DD format
  const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // Auto-cycle through playbook entries
  useEffect(() => {
    if (analysisTab === "playbook") {
      const timer = setInterval(() => {
        setPlaybookIndex(prev => (prev + 1) % 36);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [analysisTab]);

  // Load watchlist and pull history on mount
  useEffect(() => {
    const savedWatchlist = safeStorage.getItem(WATCHLIST_KEY);
    if (savedWatchlist) {
      try {
        const tickers = JSON.parse(savedWatchlist);
        if (Array.isArray(tickers)) {
          setWatchlist(tickers);
        }
      } catch {
        // Silently ignore parsing errors
      }
    }
    
    const historyStr = safeStorage.getItem(PULL_HISTORY_KEY);
    if (historyStr) {
      try {
        const parsed = JSON.parse(historyStr);
        const today = getTodayDate();
        const todayCount = parsed[today] || 0;
        setPullHistory({ [today]: todayCount });
        if (todayCount > 0) {
          addLog(`> SYSTEM_INITIALIZED: ${todayCount} analysis pulls today`);
        }
      } catch {
        // Silently ignore parsing errors
      }
    }

    const recentStr = safeStorage.getItem(RECENTLY_VIEWED_KEY);
    if (recentStr) {
      try {
        const recent = JSON.parse(recentStr);
        if (Array.isArray(recent)) {
          setRecentlyViewed(recent);
        }
      } catch {
        // Silently ignore parsing errors
      }
    }
  }, []);

  // Watchlist management functions
  const addToWatchlist = () => {
    const upperTicker = watchlistTicker.toUpperCase().trim();
    if (!upperTicker || watchlist.includes(upperTicker)) return;
    
    const newWatchlist = [...watchlist, upperTicker];
    setWatchlist(newWatchlist);
    safeStorage.setItem(WATCHLIST_KEY, JSON.stringify(newWatchlist));
    setWatchlistTicker("");
    addLog(`★ WATCHLIST_ADD: ${upperTicker}`);
  };

  const removeFromWatchlist = (tickerToRemove: string) => {
    const newWatchlist = watchlist.filter(t => t !== tickerToRemove);
    setWatchlist(newWatchlist);
    safeStorage.setItem(WATCHLIST_KEY, JSON.stringify(newWatchlist));
    addLog(`✗ WATCHLIST_REMOVE: ${tickerToRemove}`);
  };

  // Helper: Add log entry
  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, MAX_LOG_ENTRIES));
  };

  // Helper: Record successful pull
  const recordPull = () => {
    const today = getTodayDate();
    const historyStr = safeStorage.getItem(PULL_HISTORY_KEY);
    try {
      const history = historyStr ? JSON.parse(historyStr) : {};
      history[today] = (history[today] || 0) + 1;
      safeStorage.setItem(PULL_HISTORY_KEY, JSON.stringify(history));
      setPullHistory({ [today]: history[today] });
    } catch {
      // Silently ignore
    }
  };

  // Helper: Add to recently viewed (max 5)
  const addToRecentlyViewed = (tickerToAdd: string) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(t => t !== tickerToAdd);
      const updated = [tickerToAdd, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
      safeStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Fetch or get cached analysis - caches results per ticker per day
  const getOrCreateAnalysis = async (upperTicker: string): Promise<RegimeAnalysis> => {
    try {
      const today = getTodayDate();
      const cacheKey = `${upperTicker}:${today}`;
      
      // Check cache first
      const cacheStr = safeStorage.getItem(ANALYSIS_CACHE_KEY);
      let cache: Record<string, RegimeAnalysis> = {};
      if (cacheStr) {
        try {
          cache = JSON.parse(cacheStr);
        } catch {
          cache = {};
        }
      }
      
      if (cache[cacheKey]) {
        addLog(`→ CACHE_HIT: ${upperTicker} (same-day cached result)`);
        recordPull();
        return cache[cacheKey];
      }
      
      addLog(`→ FETCHING: ${upperTicker} (no cache - fetching fresh data)`);
      
      // CRITICAL: Only use mock data for "TEST" ticker - all other tickers use real API data
      if (upperTicker === "TEST") {
        addLog(`→ TEST_MODE: Generating mock data for demonstration`);
        const isETF = isLikelyETF(upperTicker);
        const analysis = isETF ? generateMockETFAnalysis(upperTicker) : generateMockCompanyAnalysis(upperTicker);
        recordPull();
        return analysis;
      }
      
      // Fetch real Tiingo data and generate analysis for all non-TEST tickers
      let analysis: RegimeAnalysis;
      const isETF = isLikelyETF(upperTicker);
      
      const dailyData = await fetchTiingoData(upperTicker);
      
      if (isETF) {
        // Use real volume data from Tiingo API (no more mock volume!)
        const priceDataWithVolume = dailyData.map((d) => ({
          date: d.date,
          close: d.close,
          open: d.open,
          volume: d.volume || 0 // Use real Tiingo volume data
        }));
        
        // Log volume data integrity check
        const hasRealVolume = priceDataWithVolume.some(d => d.volume > 0);
        if (!hasRealVolume) {
          addLog(`⚠️ WARNING: No volume data from Tiingo for ${upperTicker}`);
        } else {
          const last3Vols = priceDataWithVolume.slice(-3).map(d => d.volume);
          addLog(`📊 VOLUME_CHECK: Last 3 days = [${last3Vols.join(', ')}]`);
        }
        
        // Use proper ETF divergence engine with real data
        analysis = ETFDivergenceEngine.analyzeETF(upperTicker, priceDataWithVolume);
      } else {
        const financials = await fetchFinancialData(upperTicker, addLog);
        addLog(`📊 FUNDAMENTALS: ${upperTicker} - ${financials.length} quarters received`);
        
        const result = CompanyDivergenceEngine.analyzeCompany(upperTicker, financials);
        
        // Check if result is an error
        if ('error' in result) {
          addLog(`✗ ERROR: ${result.error}`);
          throw new Error(result.error);
        }
        
        analysis = result;
        
        // Fetch price divergence signal with Tiingo logs and raw fundamentals
        const priceDivergenceResult = await fetchPriceDivergence(upperTicker);
        if (priceDivergenceResult) {
          // Display ALL Tiingo API logs from the server
          priceDivergenceResult.logs.forEach(log => addLog(log));
          
          const priceDivergence = priceDivergenceResult.data;
          analysis.priceDivergence = priceDivergence;
          if (priceDivergence.latestPrice) {
            analysis.latestPrice = priceDivergence.latestPrice;
          }
          // Attach raw fundamentals for KINE AI analysis
          if (priceDivergence.rawFundamentals) {
            (analysis as any).rawFundamentals = priceDivergence.rawFundamentals;
            addLog(`📊 RAW_FUNDAMENTALS: ${priceDivergence.rawFundamentals.length} quarters for KINE`);
          }
          addLog(`💹 PRICE_DIVERGENCE: ${priceDivergence.type}`);
        }
        
        addLog(`✓ REAL_ANALYSIS: ${upperTicker} - regime: ${analysis.regime}`);
      }
      
      addLog(`→ ANALYSIS_COMPLETE: ${upperTicker} [${analysis.type}] (${dailyData.length} days)`);
      
      // Store in cache
      cache[cacheKey] = analysis;
      try {
        safeStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(cache));
      } catch {
        // Silently fail if storage is full
      }
      
      recordPull();
      
      return analysis;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addLog(`✗ ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  };

  const handleAnalyze = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setAiAnalysisResult(null);
    
    try {
      const upperTicker = ticker.toUpperCase();
      const analysis = await getOrCreateAnalysis(upperTicker);
      setAnalysis(analysis);
      addToRecentlyViewed(upperTicker);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : `Failed to analyze ${ticker.toUpperCase()}`;
      setError(errorMsg);
    }
    
    setLoading(false);
  };

  const handleWatchlistClick = async (watchlistTicker: string) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setAiAnalysisResult(null);
    
    try {
      const analysis = await getOrCreateAnalysis(watchlistTicker);
      setAnalysis(analysis);
      addToRecentlyViewed(watchlistTicker);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : `Failed to analyze ${watchlistTicker}`;
      setError(errorMsg);
    }
    
    setLoading(false);
  };

  const handleRecentlyViewedClick = async (recentTicker: string) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setAiAnalysisResult(null);
    
    try {
      const analysis = await getOrCreateAnalysis(recentTicker);
      setAnalysis(analysis);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : `Failed to analyze ${recentTicker}`;
      setError(errorMsg);
    }
    
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <style>{`
        @keyframes scanline-drift {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes terminal-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(0, 255, 136, 0.2), inset 0 0 10px rgba(0, 255, 136, 0.05); }
          50% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.4), inset 0 0 20px rgba(0, 255, 136, 0.1); }
        }
        @keyframes cursor-type {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes regime-glow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 255, 136, 0.4)); }
          50% { filter: drop-shadow(0 0 16px rgba(0, 255, 136, 0.8)); }
        }
        .terminal-bg {
          background: 
            repeating-linear-gradient(
              0deg,
              rgba(0, 255, 136, 0.03),
              rgba(0, 255, 136, 0.03) 1px,
              transparent 1px,
              transparent 2px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(0, 255, 136, 0.01),
              rgba(0, 255, 136, 0.01) 2px,
              transparent 2px,
              transparent 4px
            ),
            linear-gradient(135deg, rgba(0, 255, 136, 0.02) 0%, rgba(0, 0, 0, 0.8) 100%);
          animation: scanline-drift 8s linear infinite;
        }
        .terminal-card {
          border: 1px solid rgba(0, 255, 136, 0.3);
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.02) 0%, rgba(0, 0, 0, 0.4) 100%);
          box-shadow: 0 0 15px rgba(0, 255, 136, 0.1) inset;
          animation: terminal-pulse 3s ease-in-out infinite;
        }
        .regime-badge {
          animation: regime-glow 2s ease-in-out infinite;
        }
        .cursor-active {
          animation: cursor-type 1s ease-in-out infinite;
        }
        .text-terminal {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          letter-spacing: 0.05em;
        }
      `}</style>
      <div className="container px-4 md:px-6 mx-auto py-20">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="text-primary text-xl">▌</div>
            <span className="font-mono text-sm text-muted-foreground uppercase tracking-widest">{`> MOMENTUM_ENGINE`}</span>
          </div>
          <pre className="text-primary font-mono text-xs md:text-sm leading-tight mb-4 overflow-x-auto">
{`█████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█▄█░█▀█░█▄█░█▀▀░█▀█░▀█▀░█░█░█▄█░░░░░░░█
█░░░░░░░░█░█░█░█░█░█░█▀▀░█░█░░█░░█░█░█░█░░░░░░░█
█░░░░░░░░▀░▀░▀▀▀░▀░▀░▀▀▀░▀░▀░░▀░░▀▀▀░▀░▀░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████`}
          </pre>
          <p className="text-lg text-muted-foreground max-w-2xl font-mono">
            Identify momentum shifts before the market. Track acceleration in revenue, margins, and earnings across multiple timeframes.
          </p>
        </motion.div>

        {/* Search & Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          
          {/* Search Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="lg:col-span-1"
          >
            <Card className="terminal-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-4 h-4 text-primary" />
                <span className="font-mono text-xs text-primary uppercase">ANALYSIS_ENGINE</span>
              </div>

              <div className="space-y-3">
                <label className="block font-mono text-xs text-muted-foreground uppercase">
                  &gt; TICKER_INPUT
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-primary/50" />
                  <Input
                    type="text"
                    placeholder="AAPL"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 font-mono text-sm bg-black/40 border-primary/30 text-white placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={!ticker.trim() || loading}
                className="w-full bg-primary/20 hover:bg-primary/40 text-primary border border-primary/50 font-mono uppercase tracking-wider text-xs h-10"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    ANALYZING...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3" />
                    EXECUTE_ANALYSIS
                  </div>
                )}
              </Button>

              {/* Watchlist */}
              <div className="pt-6 border-t border-primary/20">
                <div className="font-mono text-xs text-primary uppercase mb-3">
                  WATCHLIST [<span className="text-white">{watchlist.length}</span>]
                </div>
                
                {/* Add to Watchlist */}
                <div className="space-y-2 mb-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Add ticker..."
                      value={watchlistTicker}
                      onChange={(e) => setWatchlistTicker(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === "Enter" && addToWatchlist()}
                      className="flex-1 pl-3 font-mono text-xs bg-black/40 border-primary/30 text-white placeholder:text-muted-foreground"
                    />
                    <Button
                      onClick={addToWatchlist}
                      disabled={!watchlistTicker.trim()}
                      className="bg-primary/20 hover:bg-primary/40 text-primary border border-primary/50 font-mono text-xs h-10 px-3"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Watchlist Grid */}
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {watchlist.map(ticker => (
                    <div
                      key={ticker}
                      onClick={() => handleWatchlistClick(ticker)}
                      className="p-2 bg-black/60 border border-primary/20 rounded-sm cursor-pointer hover:border-primary/40 transition-colors font-mono text-xs group relative"
                    >
                      <div className="flex justify-between items-center gap-1">
                        <span className="text-white font-bold flex-1">{ticker}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromWatchlist(ticker);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recently Viewed */}
              {recentlyViewed.length > 0 && (
                <div className="pt-6 border-t border-primary/20">
                  <div className="font-mono text-xs text-primary uppercase mb-3">
                    RECENTLY_VIEWED [<span className="text-white">{recentlyViewed.length}</span>]
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {recentlyViewed.map(ticker => (
                      <div
                        key={ticker}
                        onClick={() => handleRecentlyViewedClick(ticker)}
                        className="p-2 bg-black/60 border border-primary/20 rounded-sm cursor-pointer hover:border-primary/40 transition-colors font-mono text-xs"
                      >
                        <span className="text-white font-bold">{ticker}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Terminal Logs */}
            <div className="pt-6 border-t border-primary/20">
              <div className="font-mono text-xs text-primary uppercase mb-3">
                ACTIVITY_LOGS [{logs.length}]
              </div>
              <div 
                className="bg-black/80 border border-primary/20 rounded-sm p-3 h-40 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1 [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {logs.length === 0 ? (
                  <div className="text-muted-foreground">AWAITING_ACTIVITY...</div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="text-emerald-400">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
            </Card>
          </motion.div>

          {/* Analysis Display */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="lg:col-span-2"
          >
            {error ? (
              <Card className="terminal-card p-8 border-red-500/50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-mono text-sm text-red-400 mb-1">ERROR</div>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
              </Card>
            ) : analysis && analysis.type === "COMPANY" ? (
              (() => {
                return (
              <Card className="terminal-card p-8 space-y-6">
                {/* Company Analysis */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="font-mono text-sm text-muted-foreground mb-2">
                      {`> COMPANY_ANALYSIS`}
                    </div>
                    <div className="flex items-baseline gap-4">
                      <h2 className="text-5xl font-bold text-white">{analysis.ticker}</h2>
                      {analysis.latestPrice && (
                        <span className="text-2xl font-mono text-emerald-400">
                          ${analysis.latestPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 border-primary/50">
                    SCORE: {analysis.inflectionScore}
                  </Badge>
                </div>

                {/* KINE Regime Analysis - All verdicts come from AI */}
                <div className="bg-black/40 border border-primary/30 rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-primary uppercase tracking-wider">KINE Momentum Analysis</span>
                    {!aiAnalysisResult?.regime && (
                      <span className="text-xs text-amber-400 animate-pulse">Processing...</span>
                    )}
                  </div>

                  {/* Overall Assessment */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground min-w-[120px]">Regime:</span>
                    {aiAnalysisResult?.regime ? (
                      <span className="font-mono font-bold text-lg text-primary flex items-center gap-2">
                        {aiAnalysisResult.regime}
                        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">AI</span>
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-lg text-muted-foreground/50 flex items-center gap-2">
                        <span className="animate-pulse">Analyzing...</span>
                      </span>
                    )}
                  </div>

                  {/* Signal */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground min-w-[120px]">Signal:</span>
                    {aiAnalysisResult?.signal ? (
                      <span className={`font-mono font-bold text-lg ${getSignalClass(aiAnalysisResult.signal)} flex items-center gap-2`}>
                        {aiAnalysisResult.signal}
                        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">AI</span>
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-lg text-muted-foreground/50 flex items-center gap-2">
                        <span className="animate-pulse">Pending...</span>
                      </span>
                    )}
                  </div>

                  {/* Confidence Bar */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground min-w-[120px]">Confidence:</span>
                    {aiAnalysisResult?.confidence !== undefined ? (
                      <>
                        <span className="font-mono text-sm text-primary">{aiAnalysisResult.confidence}%</span>
                        <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-red-500 via-amber-500 via-blue-500 to-emerald-500 transition-all duration-300"
                            style={{ width: `${aiAnalysisResult.confidence}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-sm text-muted-foreground/50 animate-pulse">--</span>
                        <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden">
                          <div className="h-full bg-muted-foreground/20 animate-pulse" style={{ width: '50%' }} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Description */}
                  <div className="mt-3 p-3 bg-emerald-500/10 border-l-2 border-emerald-500 rounded-r">
                    <span className="font-mono text-sm text-muted-foreground">
                      {aiAnalysisResult?.regime 
                        ? `${aiAnalysisResult.regime} regime with ${aiAnalysisResult.signal} signal at ${aiAnalysisResult.confidence}% confidence`
                        : "KINE is analyzing fundamental momentum data..."
                      }
                    </span>
                  </div>
                </div>

                {/* AI Momentum Analysis Terminal - Sends pre-calculated accelerations + raw Tiingo data for context */}
                <AITerminalConsole 
                  analysisData={{
                    ticker: analysis.ticker,
                    type: analysis.type,
                    revenueAcceleration: analysis.revenueAcceleration,
                    marginAcceleration: analysis.marginAcceleration,
                    ebitMarginAcceleration: analysis.earningsAcceleration,
                    capitalAllocation: analysis.capitalAllocation,
                    priceDivergence: analysis.priceDivergence,
                    latestPrice: analysis.latestPrice,
                    rawFundamentals: (analysis as any).rawFundamentals
                  }}
                  autoStart={true}
                  onAnalysisComplete={(result) => setAiAnalysisResult(result)}
                />

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Revenue Accel (QoQ)", value: analysis.revenueAcceleration.qoq },
                    { label: "Revenue Accel (YoY)", value: analysis.revenueAcceleration.yoy },
                    { label: "Margin Accel (QoQ)", value: analysis.marginAcceleration.qoq },
                    { label: "Margin Accel (YoY)", value: analysis.marginAcceleration.yoy },
                    { label: "EBIT Margin Accel (QoQ)", value: analysis.earningsAcceleration.qoq },
                    { label: "EBIT Margin Accel (YoY)", value: analysis.earningsAcceleration.yoy },
                  ].map((metric, idx) => (
                    <div key={idx} className="p-3 bg-black/60 border border-primary/20 rounded-sm">
                      <div className="font-mono text-xs text-muted-foreground mb-1">
                        {metric.label}
                      </div>
                      <div className="flex items-center gap-1">
                        {metric.value == null ? (
                          <span className="text-lg font-bold font-mono text-muted-foreground">N/A</span>
                        ) : (
                          <>
                            {metric.value > 0 ? (
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            )}
                            <span className={`text-lg font-bold font-mono ${
                              metric.value > 0 ? "text-emerald-400" : "text-red-400"
                            }`}>
                              {metric.value > 0 ? "+" : ""}{metric.value.toFixed(2)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Capital Allocation Section */}
                <div className="mt-4 p-4 bg-black/60 border border-primary/30 rounded-sm">
                  <div className="font-mono text-sm text-primary mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    CAPITAL ALLOCATION
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                      <div className="font-mono text-xs text-muted-foreground mb-1">Share Count (YoY)</div>
                      <div className={`font-mono font-bold text-lg ${
                        analysis.capitalAllocation.shareCountChangeYoY == null ? "text-muted-foreground" :
                        analysis.capitalAllocation.shareCountChangeYoY < 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {analysis.capitalAllocation.shareCountChangeYoY == null ? "N/A" :
                          `${analysis.capitalAllocation.shareCountChangeYoY > 0 ? "+" : ""}${analysis.capitalAllocation.shareCountChangeYoY.toFixed(2)}%`}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-1">
                        {analysis.capitalAllocation.shareCountChangeYoY == null ? "" :
                          analysis.capitalAllocation.shareCountChangeYoY < 0 ? "Buybacks" : "Dilution"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-muted-foreground mb-1">ROIC Trend (YoY)</div>
                      <div className={`font-mono font-bold text-lg ${
                        analysis.capitalAllocation.roicTrendYoY == null ? "text-muted-foreground" :
                        analysis.capitalAllocation.roicTrendYoY > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {analysis.capitalAllocation.roicTrendYoY == null ? "N/A" :
                          `${analysis.capitalAllocation.roicTrendYoY > 0 ? "+" : ""}${analysis.capitalAllocation.roicTrendYoY.toFixed(2)}%`}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-1">
                        {analysis.capitalAllocation.roicTrendYoY == null ? "" :
                          analysis.capitalAllocation.roicTrendYoY > 0 ? "Improving" : "Declining"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-muted-foreground mb-1">Net Debt (YoY)</div>
                      <div className={`font-mono font-bold text-lg ${
                        analysis.capitalAllocation.netDebtChangeYoY == null ? "text-muted-foreground" :
                        analysis.capitalAllocation.netDebtChangeYoY < 0 ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {analysis.capitalAllocation.netDebtChangeYoY == null ? "N/A" :
                          `${analysis.capitalAllocation.netDebtChangeYoY > 0 ? "+" : ""}${analysis.capitalAllocation.netDebtChangeYoY.toFixed(2)}%`}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-1">
                        {analysis.capitalAllocation.netDebtChangeYoY == null ? "" :
                          analysis.capitalAllocation.netDebtChangeYoY < 0 ? "Deleveraging" : "Leveraging"}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-primary/20 pt-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">Verdict:</span>
                      <Badge className={`font-mono ${
                        analysis.capitalAllocation.verdict === "Aggressive Buyback" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" :
                        analysis.capitalAllocation.verdict === "High Efficiency" ? "bg-blue-500/20 text-blue-400 border-blue-500/50" :
                        analysis.capitalAllocation.verdict === "Dilutive" ? "bg-amber-500/20 text-amber-400 border-amber-500/50" :
                        analysis.capitalAllocation.verdict === "Capital Destroyer" ? "bg-red-500/20 text-red-400 border-red-500/50" :
                        analysis.capitalAllocation.verdict === "Insufficient Data" ? "bg-gray-500/20 text-gray-400 border-gray-500/50" :
                        "bg-primary/20 text-primary border-primary/50"
                      }`}>
                        {analysis.capitalAllocation.verdict}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
                );
              })()
            ) : analysis && analysis.type === "ETF" ? (
              <Card className="terminal-card p-8 space-y-6">
                {/* ETF Analysis */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="font-mono text-sm text-muted-foreground mb-2">
                      &gt; ETF_ANALYSIS
                    </div>
                    <div className="flex items-baseline gap-4">
                      <h2 className="text-5xl font-bold text-white">{analysis.ticker}</h2>
                      {analysis.latestPrice && (
                        <span className="text-2xl font-mono text-emerald-400">
                          ${analysis.latestPrice.toFixed(2)}
                        </span>
                      )}
                      <div className={`text-lg font-mono font-bold regime-badge ${getRegimeColor(analysis).text}`}>
                        {analysis.sectorTrend}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 border-primary/50">
                    STRENGTH: {analysis.divergenceStrength?.toFixed(0) ?? 'N/A'}
                  </Badge>
                </div>

                {/* ETF Signal */}
                <div className="p-3 bg-black/80 border border-primary/20 rounded-sm">
                  <span className="font-mono text-sm text-muted-foreground">
                    &gt; SECTOR_SIGNAL:&nbsp;
                  </span>
                  <span className={`font-mono text-sm font-bold ${getRegimeColor(analysis).text}`}>
                    {analysis.sectorTrend === "BULLISH" && "Price momentum strong, volume expanding"}
                    {analysis.sectorTrend === "BEARISH" && "Price momentum weak, volume declining"}
                    {analysis.sectorTrend === "NEUTRAL" && "No clear momentum direction"}
                  </span>
                </div>

                {/* Momentum Acceleration Gauge */}
                <div className="p-6 bg-black/60 border border-primary/20 rounded-sm font-mono">
                  <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wide">Momentum Acceleration Gauge</div>
                  
                  <div className="flex flex-col gap-6">
                    {/* Visual Gauge */}
                    <div className="flex flex-col items-center gap-3">
                      {/* Status and Value */}
                      <div className="text-center">
                        <div className={`text-sm font-bold ${(analysis.divergenceStrength ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(analysis.divergenceStrength ?? 0) > 0 ? "ACCELERATING ▲" : (analysis.divergenceStrength ?? 0) < 0 ? "DECELERATING ▼" : "NEUTRAL"}
                        </div>
                        <div className={`text-3xl font-bold font-mono ${(analysis.divergenceStrength ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {analysis.divergenceStrength?.toFixed(1) ?? 'N/A'}
                        </div>
                      </div>

                      {/* SVG Gauge */}
                      <svg width="360" height="160" viewBox="0 0 360 160" className="mx-auto">
                        {/* Scale background */}
                        <rect x="50" y="50" width="240" height="8" fill="#1a1a1a" stroke="#333" strokeWidth="1" rx="4" />
                        
                        {/* Negative zone (red) */}
                        <rect x="50" y="50" width="120" height="8" fill="#7f0000" opacity="0.3" rx="4" />
                        {/* Positive zone (green) */}
                        <rect x="170" y="50" width="120" height="8" fill="#006400" opacity="0.3" rx="4" />
                        
                        {/* Center line (zero) */}
                        <line x1="170" y1="45" x2="170" y2="63" stroke="#666" strokeWidth="2" />
                        
                        {/* Tick marks */}
                        <line x1="80" y1="52" x2="80" y2="56" stroke="#666" strokeWidth="1" />
                        <line x1="260" y1="52" x2="260" y2="56" stroke="#666" strokeWidth="1" />
                        
                        {/* Value indicator */}
                        {analysis.divergenceStrength != null && (
                          <>
                            {/* Calculate position: value is -100 to +100, map to 50-290 (50 + 240 = 290) */}
                            {(() => {
                              const normalized = Math.max(-100, Math.min(100, analysis.divergenceStrength));
                              const position = 170 + (normalized / 100) * 120;
                              return (
                                <>
                                  {/* Pointer */}
                                  <polygon
                                    points={`${position},45 ${position - 4},58 ${position + 4},58`}
                                    fill={analysis.divergenceStrength > 0 ? "#10b981" : analysis.divergenceStrength < 0 ? "#ef4444" : "#999"}
                                  />
                                </>
                              );
                            })()}
                          </>
                        )}
                        
                        {/* Number Labels */}
                        <text x="50" y="85" textAnchor="middle" className="fill-red-400 text-xs" fontSize="11">
                          -100
                        </text>
                        <text x="170" y="85" textAnchor="middle" className="fill-slate-400 text-xs" fontSize="11">
                          0
                        </text>
                        <text x="290" y="85" textAnchor="middle" className="fill-emerald-400 text-xs" fontSize="11">
                          +100
                        </text>
                        
                        {/* Description Labels */}
                        <text x="50" y="110" textAnchor="middle" className="fill-slate-500 text-xs" fontSize="11">
                          Slowing
                        </text>
                        <text x="170" y="110" textAnchor="middle" className="fill-slate-500 text-xs" fontSize="11">
                          Neutral
                        </text>
                        <text x="290" y="110" textAnchor="middle" className="fill-slate-500 text-xs" fontSize="11">
                          Speeding
                        </text>
                      </svg>
                    </div>

                    {/* ROC Details */}
                    <div className="space-y-1 text-xs border-t border-primary/20 pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">20-Day ROC:</span>
                        <span className={`font-bold ${analysis.roc20 && analysis.roc20 > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {analysis.roc20 != null ? `${analysis.roc20 > 0 ? "+" : ""}${analysis.roc20.toFixed(2)}%` : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">60-Day ROC:</span>
                        <span className={`font-bold ${analysis.roc60 && analysis.roc60 > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {analysis.roc60 != null ? `${analysis.roc60 > 0 ? "+" : ""}${analysis.roc60.toFixed(2)}%` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ETF Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Momentum Spread", value: analysis.priceVsSectorMomentum, unit: "%", formula: "TIME-NORMALIZED MOMENTUM:\n\nNorm_ROC10 = (Price / Price_10d_ago - 1) / sqrt(10)\nNorm_ROC60 = (Price / Price_60d_ago - 1) / sqrt(60)\n\nMomentum Spread = (Norm_ROC10 - Norm_ROC60) × 100\n\nPOSITIVE: Accelerating Velocity\nNEGATIVE: Decelerating Trend" },
                    { label: "Price Acceleration", value: analysis.priceAcceleration, unit: "%", formula: "SMOOTHED ACCELERATION:\n\n1. Calculate ROC for periods 10-20\n2. Apply 3-day SMA to ROC values\n3. Price Accel = Latest SMA - Previous SMA\n\nReduces noise for cleaner signals" },
                    { label: "Relative Volume Intensity", value: analysis.volumeTrend, unit: "x", isRVOL: true, conviction: (analysis as any).volumeConviction, formula: "RELATIVE VOLUME INTENSITY (RVOL):\n\nRVOL = 3-Day Avg Volume / 20-Day Avg Volume\n\nColor Logic:\n• > 1.5x + Close > Open: HIGH CONVICTION BUY (Green)\n• > 1.5x + Close < Open: HIGH CONVICTION SELL (Red)\n• 0.8x - 1.5x: NORMAL (Grey)\n• < 0.8x: LOW INTEREST (Yellow)" },
                    { label: "LinReg Deviation (20d)", value: analysis.linRegDeviation?.value ?? null, unit: "σ", formula: "Z-SCORE (STANDARD DEVIATIONS):\n\n1. Calculate 20-day Linear Regression\n2. Compute residuals (price - trendline)\n3. Calculate StdDev of residuals\n4. Z-Score = (Current Price - Predicted) / StdDev\n\n> +2.0σ: OVEREXTENDED (Reversion Risk)\n< -2.0σ: OVERSOLD (Bounce Potential)\n-2.0 to +2.0σ: NEUTRAL" },
                    { label: "Momentum Acceleration", value: analysis.divergenceStrength, unit: "", formula: "MOMENTUM DIVERGENCE (ROC):\nROC-20 = (Price_today - Price_20d_ago)\n         / Price_20d_ago × 100\n\nROC-60 = (Price_today - Price_60d_ago)\n         / Price_60d_ago × 100\n\nDivergence = ROC-20 - ROC-60\n(0-100 scale: ±20% = ±100)\n\nPOSITIVE: Accelerating momentum\nNEGATIVE: Decelerating momentum" },
                  ].map((metric, idx) => (
                    <div key={idx} className={`p-4 border rounded-sm ${metric.label === "LinReg Deviation (20d)" ? (
                      metric.value == null ? "bg-black/60 border-primary/20" :
                      metric.value > 2.0 ? "bg-red-950/30 border-red-500" :
                      metric.value < -2.0 ? "bg-emerald-950/30 border-emerald-500" :
                      "bg-black/60 border-slate-500"
                    ) : metric.label === "Relative Volume Intensity" ? (
                      metric.value == null ? "bg-black/60 border-primary/20" :
                      metric.conviction === "HIGH CONVICTION BUY" ? "bg-emerald-950/30 border-emerald-500" :
                      metric.conviction === "HIGH CONVICTION SELL" ? "bg-red-950/30 border-red-500" :
                      metric.conviction === "LOW INTEREST" ? "bg-yellow-950/30 border-yellow-500" :
                      "bg-black/60 border-slate-500"
                    ) : "bg-black/60 border-primary/20"}`}>
                      <div className="font-mono text-xs text-muted-foreground mb-2 flex items-center justify-between">
                        <span>{metric.label}</span>
                        <InfoTooltip label={metric.label} formula={metric.formula} />
                      </div>
                      <div className="flex items-center gap-2">
                        {metric.value == null ? (
                          <span className="text-2xl font-bold font-mono text-muted-foreground">N/A</span>
                        ) : metric.isRVOL ? (
                          <div className="flex flex-col gap-1">
                            <span className={`text-2xl font-bold font-mono ${metric.conviction === "HIGH CONVICTION BUY" ? "text-emerald-400" : metric.conviction === "HIGH CONVICTION SELL" ? "text-red-400" : metric.conviction === "LOW INTEREST" ? "text-yellow-400" : "text-slate-400"}`}>
                              {metric.value.toFixed(2)}{metric.unit}
                            </span>
                            <span className={`text-xs font-bold ${metric.conviction === "HIGH CONVICTION BUY" ? "text-emerald-400" : metric.conviction === "HIGH CONVICTION SELL" ? "text-red-400" : metric.conviction === "LOW INTEREST" ? "text-yellow-400" : "text-slate-400"}`}>
                              {metric.conviction}
                            </span>
                          </div>
                        ) : (
                          <>
                            {metric.label === "LinReg Deviation (20d)" ? (
                              metric.value > 0 ? <TrendingUp className="w-4 h-4 text-red-400" /> : <TrendingDown className="w-4 h-4 text-emerald-400" />
                            ) : (
                              metric.value > 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                            <span className={`text-2xl font-bold font-mono ${
                              metric.label === "LinReg Deviation (20d)" ? (
                                metric.value > 2.0 ? "text-red-400" : metric.value < -2.0 ? "text-emerald-400" : "text-slate-400"
                              ) : (metric.value > 0 ? "text-emerald-400" : "text-red-400")
                            }`}>
                              {metric.value > 0 ? "+" : ""}{metric.value.toFixed(1)}{metric.unit}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="terminal-card p-12 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <div className="font-mono text-muted-foreground">
                    {`> AWAITING_INPUT`}...
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Enter a company ticker or ETF symbol to analyze divergence patterns
                  </p>
                </div>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Explanation Section with Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="space-y-6"
        >
          {/* Tab Toggle */}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              onClick={() => setAnalysisTab("company")}
              variant={analysisTab === "company" ? "default" : "outline"}
              className="font-mono text-xs uppercase tracking-wider"
            >
              COMPANY ANALYSIS
            </Button>
            <Button
              onClick={() => setAnalysisTab("etf")}
              variant={analysisTab === "etf" ? "default" : "outline"}
              className="font-mono text-xs uppercase tracking-wider"
            >
              ETF ANALYSIS
            </Button>
            <Button
              onClick={() => setAnalysisTab("formulas")}
              variant={analysisTab === "formulas" ? "default" : "outline"}
              className="font-mono text-xs uppercase tracking-wider"
            >
              {`</> MATH`} ENGINE
            </Button>
          </div>

          {/* Company Cards */}
          {analysisTab === "company" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  regime: "POWER",
                  title: "Accelerating + Expanding",
                  desc: "Revenue growing faster, margins widening. Best risk/reward setup.",
                  icon: Rocket,
                },
                {
                  regime: "TREND",
                  title: "Decelerating + Expanding",
                  desc: "Slowing growth but margin expansion. Transitional phase.",
                  icon: TrendingUp,
                },
                {
                  regime: "WARN",
                  title: "Decelerating + Contracting",
                  desc: "Revenue declining, margins compressing. Bearish signal.",
                  icon: AlertTriangle,
                },
                {
                  regime: "WATCH",
                  title: "Accelerating + Contracting",
                  desc: "Fast growth but margin pressure. Turnaround candidate.",
                  icon: Eye,
                },
              ].map((regime) => (
                <Card
                  key={regime.regime}
                  className={`terminal-card p-6 border-2 ${getRegimeColorByName(regime.regime).border}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-sm ${getRegimeColorByName(regime.regime).bg}`}>
                      <regime.icon className={`w-6 h-6 ${getRegimeColorByName(regime.regime).text}`} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-mono font-bold text-lg mb-1 ${getRegimeColorByName(regime.regime).text}`}>
                        {regime.regime}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mb-2">
                        {regime.title}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {regime.desc}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ETF Cards */}
          {analysisTab === "etf" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  trend: "BULLISH",
                  title: "Strong Momentum",
                  metrics: [
                    "Price Acceleration > +5%",
                    "Volume Trend Expanding",
                    "Price vs Sector: Outperforming",
                  ],
                  icon: TrendingUp,
                  color: "emerald",
                },
                {
                  trend: "BEARISH",
                  title: "Weak Momentum",
                  metrics: [
                    "Price Acceleration < -5%",
                    "Volume Trend Declining",
                    "Price vs Sector: Underperforming",
                  ],
                  icon: TrendingDown,
                  color: "red",
                },
                {
                  trend: "NEUTRAL",
                  title: "Consolidation",
                  metrics: [
                    "Price Acceleration Near 0%",
                    "Volume Trend Stable",
                    "Price vs Sector: In Line",
                  ],
                  icon: AlertCircle,
                  color: "slate",
                },
                {
                  trend: "DIVERGENCE",
                  title: "Price/Sector Mismatch",
                  metrics: [
                    "High Divergence Strength",
                    "Price Decoupling from Sector",
                    "Potential Reversal Signal",
                  ],
                  icon: Zap,
                  color: "amber",
                },
              ].map((etfCard) => {
                const colorMap: Record<string, string> = {
                  emerald: "emerald-950",
                  red: "red-950",
                  slate: "slate-950",
                  amber: "amber-950",
                };
                const textColorMap: Record<string, string> = {
                  emerald: "text-emerald-400",
                  red: "text-red-400",
                  slate: "text-slate-400",
                  amber: "text-amber-400",
                };
                const borderColorMap: Record<string, string> = {
                  emerald: "border-emerald-500/50",
                  red: "border-red-500/50",
                  slate: "border-slate-500/50",
                  amber: "border-amber-500/50",
                };

                return (
                  <Card
                    key={etfCard.trend}
                    className={`terminal-card p-6 border-2 ${borderColorMap[etfCard.color]}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-sm bg-${colorMap[etfCard.color]}`}>
                        <etfCard.icon className={`w-6 h-6 ${textColorMap[etfCard.color]}`} />
                      </div>
                      <div className="flex-1">
                        <div className={`font-mono font-bold text-lg mb-1 ${textColorMap[etfCard.color]}`}>
                          {etfCard.trend}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mb-3">
                          {etfCard.title}
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1 font-mono">
                          {etfCard.metrics.map((metric, idx) => (
                            <li key={idx}>• {metric}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Formulas Section - Math Engine */}
          {analysisTab === "formulas" && (
            <div className="space-y-4">
              <Card className="terminal-card p-6 border-2 border-slate-500/50 bg-slate-950">
                <div className="space-y-6 font-mono text-xs">
                  {/* Acceleration Formula */}
                  <div className="space-y-2">
                    <div className="text-slate-400 font-bold">→ ACCELERATION (Change in Growth Rate)</div>
                    <div className="bg-black/50 p-4 rounded-sm border border-slate-700 overflow-x-auto">
                      <div className="text-emerald-400">
                        <div>// QoQ Acceleration = Current Growth - Previous Growth</div>
                        <div className="mt-2">currentQoQ = (current - previous) / |previous| × 100</div>
                        <div>previousQoQ = (previous - 2QAgo) / |2QAgo| × 100</div>
                        <div className="mt-2 text-amber-300">qoqAccel = currentQoQ - previousQoQ</div>
                        <div className="mt-3 text-emerald-400">// YoY uses 4-quarter lookback (same formula structure)</div>
                      </div>
                    </div>
                  </div>

                  {/* Regime Classification */}
                  <div className="space-y-2 border-t border-slate-700 pt-4">
                    <div className="text-slate-400 font-bold">→ REGIME CLASSIFICATION (2×2 Matrix)</div>
                    <div className="bg-black/50 p-4 rounded-sm border border-slate-700 overflow-x-auto">
                      <div className="text-blue-400">
                        <div>{`if (revAccel.qoq > 0 && margAccel.qoq > 0) → POWER`}</div>
                        <div className="text-emerald-400">// Revenue accelerating + Margins expanding</div>
                        <div className="mt-2 text-blue-400">{`if (revAccel.qoq < 0 && margAccel.qoq > 0) → TREND`}</div>
                        <div className="text-emerald-400">// Revenue decelerating + Margins expanding</div>
                        <div className="mt-2 text-red-400">{`if (revAccel.qoq < 0 && margAccel.qoq < 0) → WARN`}</div>
                        <div className="text-emerald-400">// Revenue declining + Margins compressing</div>
                        <div className="mt-2 text-amber-400">{`if (revAccel.qoq > 0 && margAccel.qoq < 0) → WATCH`}</div>
                        <div className="text-emerald-400">// Revenue accelerating + Margin pressure</div>
                      </div>
                    </div>
                  </div>

                  {/* Confidence Formula */}
                  <div className="space-y-2 border-t border-slate-700 pt-4">
                    <div className="text-slate-400 font-bold">→ CONFIDENCE SCORES</div>
                    <div className="bg-black/50 p-4 rounded-sm border border-slate-700 overflow-x-auto">
                      <div className="text-purple-400">
                        <div className="mb-3">// COMPANY: Based on Acceleration Magnitude</div>
                        <div className="text-cyan-300">metrics = [revAccel, margAccel, ebitMarginAccel, capitalAlloc]</div>
                        <div className="text-cyan-300">avgMagnitude = sum(|metric.qoq|) / metrics.length</div>
                        <div className="text-amber-300 mt-2">confidence = Math.min(0.95, avgMagnitude / 100)</div>
                        <div className="mt-4 text-purple-400">// ETF: Based on Volume Consistency</div>
                        <div className="text-cyan-300">volumeConsistency = Math.min(1, (latestVol / prevVol) × 0.9)</div>
                        <div className="text-amber-300">confidence = volumeConsistency × 0.8  // Max 80%</div>
                      </div>
                    </div>
                  </div>

                  {/* 16 Regime Combinations */}
                  <div className="space-y-2 border-t border-slate-700 pt-4">
                    <div className="text-slate-400 font-bold">→ ALL 16 QoQ × YoY COMBINATIONS</div>
                    <div className="bg-black/50 p-4 rounded-sm border border-slate-700 text-xs leading-relaxed">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-emerald-400">POWER_POWER → STRONG BUY</div>
                        <div className="text-blue-400">POWER_TREND → BUY</div>
                        <div className="text-yellow-400">POWER_WARN → ACCUMULATE</div>
                        <div className="text-yellow-400">POWER_WATCH → BUY</div>
                        <div className="text-cyan-400">TREND_POWER → HOLD</div>
                        <div className="text-cyan-400">TREND_TREND → HOLD</div>
                        <div className="text-orange-400">TREND_WARN → REDUCE</div>
                        <div className="text-cyan-400">TREND_WATCH → HOLD</div>
                        <div className="text-orange-400">WARN_POWER → TAKE PROFITS</div>
                        <div className="text-orange-400">WARN_TREND → REDUCE</div>
                        <div className="text-red-400">WARN_WARN → SELL</div>
                        <div className="text-red-400">WARN_WATCH → SELL</div>
                        <div className="text-cyan-400">WATCH_POWER → HOLD</div>
                        <div className="text-orange-400">WATCH_TREND → REDUCE</div>
                        <div className="text-red-600">WATCH_WARN → AVOID</div>
                        <div className="text-cyan-400">WATCH_WATCH → HOLD</div>
                      </div>
                    </div>
                  </div>

                  {/* Key Insights */}
                  <div className="space-y-2 border-t border-slate-700 pt-4">
                    <div className="text-slate-400 font-bold">→ KEY METRICS DEFINITIONS</div>
                    <div className="bg-black/50 p-4 rounded-sm border border-slate-700 text-xs leading-relaxed space-y-1">
                      <div><span className="text-green-400">Operating Margin</span> = (Operating Income / Revenue) × 100</div>
                      <div><span className="text-green-400">Inflection Score</span> = Base(50) + Regime(±15) + Consistency(±20) + Recent(±15)</div>
                      <div><span className="text-green-400">Divergence Strength</span> = |Price - Expected Trend| (for ETFs)</div>
                      <div><span className="text-green-400">Volume Trend</span> = ((Latest Avg - Prev Avg) / Prev Avg) × 100</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </motion.div>

        {/* ACTIVITY LOGS PANEL */}
        {logs.length > 0 && (
          <div className="mt-8 bg-black/60 border border-primary/30 rounded-sm overflow-hidden" data-testid="activity-logs">
            <div className="bg-black/80 border-b border-primary/20 p-3">
              <h3 className="font-mono text-sm text-primary">→ ACTIVITY_LOGS</h3>
            </div>
            <div className="max-h-48 overflow-y-auto scrollbar-hide bg-black/40 p-3">
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`${
                      log.includes('[DEBUG]') ? 'text-cyan-400' :
                      log.includes('✓') ? 'text-emerald-400' :
                      log.includes('✗') ? 'text-red-400' :
                      log.includes('★') ? 'text-yellow-400' :
                      log.includes('⚠️') ? 'text-orange-400' :
                      log.includes('📊') ? 'text-blue-400' :
                      'text-slate-400'
                    }`}
                    data-testid={`activity-log-${idx}`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
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
        `}</style>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-4">
          {/* Divergence Dashboard Button */}
          <Link href="/divergence-dashboard" className="w-full">
            <div className="group cursor-pointer bg-black border-2 border-purple-500/50 p-4 overflow-hidden transition-all duration-300 hover:border-purple-500 hover:scale-105 pulse-glow-purple h-full">
              <div className="font-mono text-xs text-purple-500/90 leading-tight transition-colors duration-300 group-hover:text-purple-400 space-y-2">
                <div className="text-center font-bold">→ ◊ MOMENTUM_TERMINAL</div>
                <div className="text-purple-400/70 text-center text-xs">Company regime analysis</div>
                <div className="text-purple-500/50 text-center">[CURRENT]</div>
              </div>
            </div>
          </Link>
          
          {/* Sector Rotation Button */}
          <Link href="/sector-rotation" className="w-full">
            <div className="group cursor-pointer bg-black border-2 border-blue-500/50 p-4 overflow-hidden transition-all duration-300 hover:border-blue-500 hover:scale-105 pulse-glow-blue h-full">
              <div className="font-mono text-xs text-blue-500/90 leading-tight transition-colors duration-300 group-hover:text-blue-400 space-y-2">
                <div className="text-center font-bold">→ ◊ SECTOR_ROTATION</div>
                <div className="text-blue-400/70 text-center text-xs">Market sector analysis</div>
                <div className="text-blue-500/50 text-center">[ENTER]</div>
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

        <LegalFooter />
      </div>
    </div>
  );
}
