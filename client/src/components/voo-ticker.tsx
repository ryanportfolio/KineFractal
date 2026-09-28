import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DailyData {
  date: string;
  close: number;
  volume: number;
}

interface VooQuote {
  price: string;
  change: string;
  changePercent: string;
  volume: number;
  date: string; // YYYY-MM-DD
}

interface VolumeAnalysis {
  priorDayDiff: string;
  avg1MDiff: string;
  avg3MDiff: string;
  avg1M: number;
  avg3M: number;
}

interface TickerMover {
  symbol: string;
  priorDayDiff: number;
  avg1MDiff: number;
  maxDeviation: number;
  isExtreme: boolean;
}

interface CachedTickerData {
  date: string;
  data: Record<string, DailyData[]>;
}

const CACHE_KEY_PREFIX = 'kine-ticker-cache-';
const TICKERS = ['GLD', 'SPY', 'XLE', 'DBC', 'IWM', 'IVW', 'IVE', 'UUP', 'IEF', 'VXX'];

function getTodayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getCacheKey(): string {
  return `${CACHE_KEY_PREFIX}${getTodayDateKey()}`;
}

function loadCachedData(): CachedTickerData | null {
  try {
    const cached = localStorage.getItem(getCacheKey());
    if (cached) {
      const parsed = JSON.parse(cached) as CachedTickerData;
      if (parsed.date === getTodayDateKey() && Object.keys(parsed.data).length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[TICKER] Cache load error:', e);
  }
  return null;
}

function saveCachedData(data: Record<string, DailyData[]>): void {
  try {
    // Clean up old cache keys first
    const todayKey = getCacheKey();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX) && key !== todayKey) {
        localStorage.removeItem(key);
      }
    }
    
    const cacheData: CachedTickerData = {
      date: getTodayDateKey(),
      data
    };
    localStorage.setItem(todayKey, JSON.stringify(cacheData));
  } catch (e) {
    console.error('[TICKER] Cache save error:', e);
  }
}

export function VooTicker() {
  const [selectedSymbol, setSelectedSymbol] = useState('GLD');
  const [cachedData, setCachedData] = useState<Record<string, DailyData[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pulse animations
  const pulseStyle = `
    @keyframes pulse-glow-intense {
      0%, 100% { text-shadow: 0 0 10px rgba(0, 255, 136, 0.5), 0 0 20px rgba(0, 255, 136, 0.3); }
      50% { text-shadow: 0 0 20px rgba(0, 255, 136, 0.8), 0 0 40px rgba(0, 255, 136, 0.6); }
    }
    @keyframes pulse-glow-border {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.3); }
      50% { box-shadow: 0 0 0 6px rgba(0, 255, 136, 0.1), 0 0 15px rgba(0, 255, 136, 0.6); }
    }
    @keyframes pulse-icon {
      0%, 100% { transform: translateY(0px) scale(1); opacity: 0.7; }
      50% { transform: translateY(-2px) scale(1.1); opacity: 1; }
    }
    .ticker-button-pulse {
      animation: pulse-glow-intense 2s ease-in-out infinite;
    }
    .ticker-button-glow {
      animation: pulse-glow-border 2s ease-in-out infinite;
    }
    .ticker-chevron-pulse {
      animation: pulse-icon 1.5s ease-in-out infinite;
    }
  `;

  // Fetch data from API (only called if no cache exists for today)
  const fetchTickerData = useCallback(async () => {
    try {
      setLoading(true);
      const data: Record<string, DailyData[]> = {};
      
      for (const ticker of TICKERS) {
        try {
          const tickerResponse = await fetch(`/api/tiingo/${ticker}`);
          if (tickerResponse.ok) {
            const tickerData = await tickerResponse.json();
            data[ticker] = tickerData.map((d: any) => ({
              date: d.date,
              close: d.adjClose || d.close,
              volume: d.volume || 0
            }));
          }
        } catch (e) {
          // Silently skip if individual ticker fails
        }
      }
      
      if (Object.keys(data).length === 0) {
        throw new Error("No ticker data available from API");
      }
      
      // Save to cache and state
      saveCachedData(data);
      setCachedData(data);
      setError(null);
    } catch (err: any) {
      console.error("[TICKER] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: check cache first, only fetch if no cache for today
  useEffect(() => {
    const cached = loadCachedData();
    if (cached) {
      console.log('[TICKER] Using cached data from', cached.date);
      setCachedData(cached.data);
      setLoading(false);
    } else {
      console.log('[TICKER] No cache for today, fetching fresh data...');
      fetchTickerData();
    }
  }, [fetchTickerData]);

  // Compute available tickers from cached data
  const availableTickers = useMemo(() => {
    if (!cachedData) return [];
    return Object.keys(cachedData).sort();
  }, [cachedData]);

  // Sync selectedSymbol if it's not available in cache
  useEffect(() => {
    if (!cachedData) return;
    
    const available = Object.keys(cachedData).sort();
    if (available.length === 0) return;
    
    // If selected symbol is not in cache, switch to first available
    if (!cachedData[selectedSymbol] || cachedData[selectedSymbol].length < 2) {
      console.log(`[TICKER] ${selectedSymbol} not in cache, switching to ${available[0]}`);
      setSelectedSymbol(available[0]);
    }
  }, [cachedData, selectedSymbol]);

  // Compute biggest movers from cached data (runs once when data loads)
  const biggestMovers = useMemo(() => {
    if (!cachedData) return [];
    
    const movers: TickerMover[] = [];
    for (const ticker of Object.keys(cachedData)) {
      const tickerData = cachedData[ticker];
      if (tickerData && tickerData.length >= 20) {
        const lastDay = tickerData[tickerData.length - 1];
        const prevDay = tickerData[tickerData.length - 2];
        const last20Days = tickerData.slice(-20);
        const avg1M = last20Days.reduce((sum, d) => sum + d.volume, 0) / 20;
        
        const priorDayDiff = ((lastDay.volume - prevDay.volume) / prevDay.volume) * 100;
        const avg1MDiff = ((lastDay.volume - avg1M) / avg1M) * 100;
        const maxDeviation = Math.max(Math.abs(priorDayDiff), Math.abs(avg1MDiff));
        
        movers.push({
          symbol: ticker,
          priorDayDiff,
          avg1MDiff,
          maxDeviation,
          isExtreme: maxDeviation > 100
        });
      }
    }
    movers.sort((a, b) => b.maxDeviation - a.maxDeviation);
    return movers.slice(0, 8);
  }, [cachedData]);

  // Compute quote for selected symbol (INSTANT - no API call)
  const quote = useMemo((): VooQuote | null => {
    if (!cachedData) return null;
    
    let symbolData = cachedData[selectedSymbol];
    
    // Fallback to first available if selected has no data
    if (!symbolData || symbolData.length < 2) {
      const firstAvailable = Object.keys(cachedData).sort()[0];
      if (firstAvailable) {
        symbolData = cachedData[firstAvailable];
      }
    }
    
    if (!symbolData || symbolData.length < 2) return null;
    
    const lastIndex = symbolData.length - 1;
    const currentDay = symbolData[lastIndex];
    const prevDay = symbolData[lastIndex - 1];
    
    const price = currentDay.close;
    const prevPrice = prevDay.close;
    const change = price - prevPrice;
    const changePercent = (change / prevPrice) * 100;
    
    return {
      price: price.toFixed(2),
      change: change.toFixed(2),
      changePercent: `${changePercent.toFixed(2)}%`,
      volume: currentDay.volume,
      date: currentDay.date
    };
  }, [cachedData, selectedSymbol]);

  // Compute volume analysis for selected symbol (INSTANT - no API call)
  const volumeAnalysis = useMemo((): VolumeAnalysis | null => {
    if (!cachedData) return null;
    
    let symbolData = cachedData[selectedSymbol];
    
    // Fallback to first available if selected has no data
    if (!symbolData || symbolData.length < 2) {
      const firstAvailable = Object.keys(cachedData).sort()[0];
      if (firstAvailable) {
        symbolData = cachedData[firstAvailable];
      }
    }
    
    if (!symbolData || symbolData.length < 60) return null;
    
    const lastIndex = symbolData.length - 1;
    const currentDay = symbolData[lastIndex];
    const prevDay = symbolData[lastIndex - 1];
    
    // 1M Average = last 20 trading days
    const last20Days = symbolData.slice(-20);
    const avg1M = last20Days.reduce((sum, day) => sum + day.volume, 0) / 20;
    
    // 3M Average = last 60 trading days
    const last60Days = symbolData.slice(-60);
    const avg3M = last60Days.reduce((sum, day) => sum + day.volume, 0) / 60;
    
    // Current volume and prior day
    const currentVolume = currentDay.volume;
    const priorDayVolume = prevDay.volume;
    
    // Calculate percentage differences
    const priorDayDiff = ((currentVolume - priorDayVolume) / priorDayVolume * 100).toFixed(1);
    const avg1MDiff = ((currentVolume - avg1M) / avg1M * 100).toFixed(1);
    const avg3MDiff = ((currentVolume - avg3M) / avg3M * 100).toFixed(1);
    
    return { priorDayDiff, avg1MDiff, avg3MDiff, avg1M, avg3M };
  }, [cachedData, selectedSymbol]);

  if (loading && !cachedData) {
    return (
      <div className="w-full h-full min-h-[120px] bg-[#0a0e27] border border-[#00ff88] p-4 font-mono text-xs text-[#00ff88] flex items-center justify-center shadow-[0_0_10px_rgba(0,255,136,0.2)]">
        INITIALIZING TERMINAL LINK...
      </div>
    );
  }

  const isPositive = quote ? parseFloat(quote.change) >= 0 : true;
  const colorClass = isPositive ? 'text-[#00ff88]' : 'text-[#ff3333] text-shadow-[0_0_10px_rgba(255,51,51,0.5)]';
  const arrow = isPositive ? '▲' : '▼';
  const sign = isPositive ? '+' : '';

  return (
    <div className="w-full bg-[#0a0e27] border border-[#00ff88] p-4 font-mono text-xs relative overflow-hidden group shadow-[0_0_20px_rgba(0,255,136,0.2)]">
      <style>{pulseStyle}</style>
      {/* CRT Overlay Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-100 z-10"></div>
      {/* ASCII Art Header */}
      <div className="mb-4 border-b border-[#00ff88]/30 pb-2 relative z-20 flex justify-center">
         <pre className="font-mono text-[11px] text-[#00ff88] text-shadow-[0_0_10px_rgba(0,255,136,0.5)] whitespace-pre overflow-x-auto leading-tight text-pulse-glow">
{`█████████████████████████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░█░█░▀█▀░█▀█░█▀▀░░░█▀▀░█▀▄░█▀█░█▀▀░▀█▀░█▀█░█░░░█░█░█▀█░█░░░█░█░█▄█░█▀▀░░░░░░░░█
█░░█▀▄░░█░░█░█░█▀▀░░░█▀▀░█▀▄░█▀█░█░░░░█░░█▀█░█░░░█░█░█░█░█░░░█░█░█░█░█▀▀░░░░░░░░█
█░░▀░▀░▀▀▀░▀░▀░▀▀▀░░░▀░░░▀░▀░▀░▀░▀▀▀░░▀░░▀░▀░▀▀▀░░▀░░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████████████████████████████████`}
         </pre>
      </div>
      {/* BIGGEST MOVERS - FRONT AND CENTER */}
      {biggestMovers.length > 0 && (
        <div className="mb-6 pb-4 border-b border-[#ff00ff]/30 relative z-20">
          <div className="text-[#ff00ff]/60 mb-3 font-bold text-[16px]">▸▸ OUTLIERS: BIGGEST VOL DIVERGENCE ▸▸</div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {biggestMovers.map((mover) => {
              const isExtremePriorDay = Math.abs(mover.priorDayDiff) > 100;
              const isExtreme1M = Math.abs(mover.avg1MDiff) > 100;
              const color = mover.maxDeviation > 150 ? '#ff00ff' : mover.maxDeviation > 75 ? '#ffff00' : '#00ff88';
              
              return (
                <div key={mover.symbol} className="p-4 border border-[#ff00ff]/40 bg-[#ff00ff]/15 rounded text-[14px]">
                  <div style={{ color }} className="font-bold text-[22px] mb-2">{mover.symbol}</div>
                  <div className={`text-[16px] ${mover.priorDayDiff > 0 ? 'text-[#00ff88]' : 'text-[#ff3333]'}`}>D: {mover.priorDayDiff > 0 ? '+' : ''}{mover.priorDayDiff.toFixed(0)}%</div>
                  <div className={`text-[16px] ${mover.avg1MDiff > 0 ? 'text-[#00ff88]' : 'text-[#ff3333]'}`}>1M: {mover.avg1MDiff > 0 ? '+' : ''}{mover.avg1MDiff.toFixed(0)}%</div>
                  {(isExtremePriorDay || isExtreme1M) && <div className="text-[#ffff00] text-[13px] mt-2 font-bold">⚡ EXTREME</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Ticker Content */}
      {quote ? (
        <div className="grid grid-cols-3 gap-4 relative z-20">
           <div>
              <div className="text-[#00ff88]/50 mb-1 text-[12px] text-pulse-glow">SYMBOL</div>
              <div className="text-2xl font-bold text-[#00ff88] flex items-center gap-2 text-shadow-[0_0_10px_rgba(0,255,136,0.5)]">
                 <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                   <SelectTrigger 
                     className="w-auto min-w-[100px] bg-transparent border-[#00ff88] text-[#00ff88] font-mono text-2xl font-bold h-auto py-1 px-3 shadow-[0_0_10px_rgba(0,255,136,0.3)] hover:shadow-[0_0_20px_rgba(0,255,136,0.5)] transition-shadow ticker-button-glow [&>svg]:text-[#00ff88] [&>svg]:ticker-chevron-pulse"
                     data-testid="button-select-ticker"
                   >
                     <span className="text-[#00ff88]/50 mr-1">&gt;_</span>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent 
                     className="bg-[#0a0e27] border-[#00ff88] shadow-[0_0_30px_rgba(0,255,136,0.4)] font-mono"
                   >
                     {availableTickers.map(ticker => (
                       <SelectItem 
                         key={ticker} 
                         value={ticker}
                         className="text-[#00ff88] hover:bg-[#00ff88]/10 focus:bg-[#00ff88]/20 focus:text-[#00ff88] cursor-pointer text-base"
                         data-testid={`option-ticker-${ticker}`}
                       >
                         {ticker}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
              </div>
              <div className="mt-4">
                 <div className="text-[#00ff88]/50 mb-1 text-[12px] font-mono">VOLUME</div>
                 <div className="text-[#00ff88] text-[18px]">
                    VOL: {quote.volume.toLocaleString()}
                 </div>
              </div>
           </div>

           {/* Volume Analysis Section */}
           {volumeAnalysis && (
              <div className="pt-0 border-l border-[#00ff88]/20 pl-4">
                 <div className="text-[#00ff88]/50 mb-2 font-bold text-[22px]">VOL_ANALYSIS</div>
                 
                 {/* Headers */}
                 <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="text-[16px] text-[#00ff88]/60 font-bold text-center">Prior Day</div>
                    <div className="text-[16px] text-[#00ff88]/60 font-bold text-center">1M Avg</div>
                    <div className="text-[16px] text-[#00ff88]/60 font-bold text-center">3M Avg</div>
                 </div>
                 
                 {/* Values */}
                 <div className="grid grid-cols-3 gap-2">
                    <div className={`font-bold text-center text-[22px] ${parseFloat(volumeAnalysis.priorDayDiff) > 0 ? 'text-[#00ff88]' : 'text-[#ff3333]'}`}>
                       {parseFloat(volumeAnalysis.priorDayDiff) > 0 ? '+' : ''}{volumeAnalysis.priorDayDiff}%
                    </div>
                    <div className={`font-bold text-center text-[22px] ${parseFloat(volumeAnalysis.avg1MDiff) > 0 ? 'text-[#00ff88]' : 'text-[#ff3333]'}`}>
                       {parseFloat(volumeAnalysis.avg1MDiff) > 0 ? '+' : ''}{volumeAnalysis.avg1MDiff}%
                    </div>
                    <div className={`font-bold text-center text-[22px] ${parseFloat(volumeAnalysis.avg3MDiff) > 0 ? 'text-[#00ff88]' : 'text-[#ff3333]'}`}>
                       {parseFloat(volumeAnalysis.avg3MDiff) > 0 ? '+' : ''}{volumeAnalysis.avg3MDiff}%
                    </div>
                 </div>
              </div>
           )}

           <div className="text-right">
              <div className="text-[#00ff88]/50 mb-1 text-[12px] text-pulse-glow">PRICE</div>
              <div className="text-2xl font-bold text-white text-shadow-[0_0_10px_rgba(0,255,136,0.5)]">
                 ${quote.price}
              </div>
              <div className="mt-4">
                 <div className="text-[#00ff88]/50 mb-1 text-[12px]">CHANGE</div>
                 <div className={`font-bold text-[18px] ${colorClass} flex items-center justify-end gap-1`}>
                    <span>{arrow} {sign}{quote.change}</span>
                    <span>({quote.changePercent})</span>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="text-center py-4 text-[#ff3333] relative z-20 border border-[#ff3333]/30 bg-[#ff3333]/5 rounded">
           <AlertTriangle className="w-6 h-6 mx-auto mb-2 animate-pulse" />
           <div className="font-bold tracking-wider text-shadow-[0_0_10px_rgba(255,51,51,0.5)]">DATA LINK FAILED</div>
           <div className="text-[10px] mt-1 opacity-70">{error || "Unknown Error"}</div>
           <div className="mt-2 text-[9px] border-t border-[#ff3333]/20 pt-1 opacity-50">Retrying cache...</div>
        </div>
      )}
      {/* Footer Timestamp */}
      <div className="mt-4 pt-2 border-t border-[#00ff88]/30 text-[14px] text-[#00ff88] text-shadow-[0_0_10px_rgba(0,255,136,0.3)] text-right relative z-20 font-bold text-pulse-glow">
         LAST_SYNC: {quote?.date || 'N/A'}
      </div>
    </div>
  );
}
