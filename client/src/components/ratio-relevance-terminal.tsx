import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Cpu, Zap } from 'lucide-react';

interface RatioMetric {
  name: string;
  description: string;
  current: number;
  momentum: number;
  momentum5D: number;
  momentum21D: number;
  momentum79D: number;
  signal: "Trend Up" | "Trend Down" | "Neutral";
  stress?: string;
  riskMode?: string;
  regime?: string;
  isStressed?: boolean;
  mean?: number;
}

interface RatioRelevanceData {
  asOf: string;
  tradingDays: number;
  modules: {
    wreckingBall: {
      dollarYield: RatioMetric;
      banksVsBonds: RatioMetric;
    };
    rotation: {
      growthVsValue: RatioMetric;
      consumerHealth: RatioMetric;
    };
    inflationDeflation: {
      thingsVsPaper: RatioMetric;
      ecoHealth: RatioMetric;
      capitalFlight: RatioMetric;
    };
    gammaVol?: RatioMetric;
  };
}

interface LogEntry {
  id: number;
  text: string;
}

interface ModuleSignals {
  wreckingBallStress?: 'NORMAL' | 'ELEVATED' | 'MAXIMUM_STRESS';
  dollarYieldTrend?: 'TREND_UP' | 'TREND_DOWN' | 'NEUTRAL';
  banksVsBondsTrend?: 'TREND_UP' | 'TREND_DOWN' | 'NEUTRAL';
  growthVsValue?: 'GROWTH_LEADS' | 'VALUE_LEADS' | 'NEUTRAL';
  consumerHealth?: 'STRONG' | 'WEAK' | 'NEUTRAL';
  inflationDeflation?: 'INFLATIONARY' | 'DEFLATIONARY' | 'NEUTRAL';
  goldSpx?: 'RISK_OFF' | 'RISK_ON' | 'NEUTRAL';
}

interface AIResult {
  regime?: string;
  signal?: string;
  confidence?: number;
  moduleSignals?: ModuleSignals;
}

type AnalysisState = 'idle' | 'waiting' | 'analyzing' | 'complete' | 'error';

function getLineStyle(text: string): string {
  if (text.includes("[KINE] ▶")) return "text-[#00ffff] font-bold";
  if (text.includes("✓")) return "text-[#00ff88]";
  if (text.includes("✗")) return "text-[#ff3333]";
  if (text.includes("⚠")) return "text-[#ff9900]";
  if (text.includes("[KINE] →")) return "text-[#aaaaaa]";
  return "text-[#888888]";
}

function parseResults(logs: string[]): AIResult {
  let regime: string | undefined;
  let signal: string | undefined;
  let confidence: number | undefined;
  const moduleSignals: ModuleSignals = {};

  for (const line of logs) {
    const regimeMatch = line.match(/\bREGIME:\s*([\w_]+)/i);
    if (regimeMatch && !line.includes('MODULE_')) regime = regimeMatch[1].toUpperCase();

    const signalMatch = line.match(/\bSIGNAL:\s*([\w_\s]+?)(?:\s*$|\s*\[)/i);
    if (signalMatch && !line.includes('MODULE_')) signal = signalMatch[1].trim().toUpperCase();

    const confMatch = line.match(/CONFIDENCE:\s*(\d+)/i);
    if (confMatch) confidence = parseInt(confMatch[1], 10);

    // Parse module signals
    const wbStressMatch = line.match(/MODULE_WRECKING_BALL_STRESS:\s*(NORMAL|ELEVATED|MAXIMUM_STRESS)/i);
    if (wbStressMatch) moduleSignals.wreckingBallStress = wbStressMatch[1].toUpperCase() as ModuleSignals['wreckingBallStress'];

    const dyTrendMatch = line.match(/MODULE_DOLLAR_YIELD_TREND:\s*(TREND_UP|TREND_DOWN|NEUTRAL)/i);
    if (dyTrendMatch) moduleSignals.dollarYieldTrend = dyTrendMatch[1].toUpperCase() as ModuleSignals['dollarYieldTrend'];

    const bbTrendMatch = line.match(/MODULE_BANKS_VS_BONDS_TREND:\s*(TREND_UP|TREND_DOWN|NEUTRAL)/i);
    if (bbTrendMatch) moduleSignals.banksVsBondsTrend = bbTrendMatch[1].toUpperCase() as ModuleSignals['banksVsBondsTrend'];

    const gvMatch = line.match(/MODULE_GROWTH_VS_VALUE:\s*(GROWTH_LEADS|VALUE_LEADS|NEUTRAL)/i);
    if (gvMatch) moduleSignals.growthVsValue = gvMatch[1].toUpperCase() as ModuleSignals['growthVsValue'];

    const chMatch = line.match(/MODULE_CONSUMER_HEALTH:\s*(STRONG|WEAK|NEUTRAL)/i);
    if (chMatch) moduleSignals.consumerHealth = chMatch[1].toUpperCase() as ModuleSignals['consumerHealth'];

    const idMatch = line.match(/MODULE_INFLATION_DEFLATION:\s*(INFLATIONARY|DEFLATIONARY|NEUTRAL)/i);
    if (idMatch) moduleSignals.inflationDeflation = idMatch[1].toUpperCase() as ModuleSignals['inflationDeflation'];

    const gsMatch = line.match(/MODULE_GOLD_SPX:\s*(RISK_OFF|RISK_ON|NEUTRAL)/i);
    if (gsMatch) moduleSignals.goldSpx = gsMatch[1].toUpperCase() as ModuleSignals['goldSpx'];
  }

  return { regime, signal, confidence, moduleSignals };
}

interface RatioRelevanceTerminalProps {
  ratioData: RatioRelevanceData | null;
  autoStart?: boolean;
  onSignalsReady?: (signals: ModuleSignals, isLoading: boolean) => void;
}

export type { ModuleSignals };

export function RatioRelevanceTerminal({ ratioData, autoStart = true, onSignalsReady }: RatioRelevanceTerminalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [gated, setGated] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const logIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);

  const addLog = useCallback((text: string) => {
    setLogs(prev => [...prev, { id: logIdRef.current++, text }]);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const runAnalysis = useCallback(async () => {
    if (!ratioData || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setAnalysisState('analyzing');
    setGated(false);
    setLogs([]);
    setAiResult(null);
    logIdRef.current = 0;

    const collectedLogs: string[] = [];

    try {
      const response = await fetch("/api/gemini/analyze/ratio-relevance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratioData),
        signal: abortControllerRef.current.signal,
      });

      // Signed-out visitors hit the auth gate on this endpoint. That is not an
      // error state — the live feed simply awaits credentials. Render the
      // register CTA instead of a harsh red failure line.
      if (response.status === 401) {
        setGated(true);
        setAnalysisState('idle');
        return;
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Analysis failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.line) {
                addLog(data.line);
                collectedLogs.push(data.line);
                await new Promise(r => setTimeout(r, 30));
              }
              if (data.done) {
                const result = parseResults(collectedLogs);
                setAiResult(result);
                setAnalysisState('complete');
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      const result = parseResults(collectedLogs);
      setAiResult(result);
      setAnalysisState('complete');
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        addLog("[KINE] → Analysis cancelled");
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        addLog(`[KINE] ✗ Error: ${message}`);
        setAnalysisState('error');
      }
    }
  }, [ratioData, addLog]);

  const handleRerun = useCallback(() => {
    hasFetchedRef.current = false;
    runAnalysis();
  }, [runAnalysis]);

  useEffect(() => {
    if (ratioData && autoStart && !hasFetchedRef.current) {
      const timer = setTimeout(() => {
        runAnalysis();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ratioData, autoStart, runAnalysis]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Notify parent of signal changes
  useEffect(() => {
    if (onSignalsReady) {
      const isLoading = analysisState === 'analyzing' || analysisState === 'waiting';
      onSignalsReady(aiResult?.moduleSignals || {}, isLoading);
    }
  }, [aiResult, analysisState, onSignalsReady]);

  const getSignalColor = (signal?: string) => {
    if (!signal) return 'text-white/60';
    if (signal.includes('RISK_ON') || signal.includes('GROWTH') || signal.includes('STAY_LONG')) return 'text-emerald-400';
    if (signal.includes('RISK_OFF') || signal.includes('REDUCE') || signal.includes('DEFENSIVE')) return 'text-red-400';
    if (signal.includes('ROTATE') || signal.includes('NEUTRAL')) return 'text-amber-400';
    return 'text-white/60';
  };

  const getRegimeColor = (regime?: string) => {
    if (!regime) return 'text-white/60';
    if (regime === 'RISK_ON' || regime === 'REFLATION') return 'text-emerald-400';
    if (regime === 'RISK_OFF' || regime === 'STRESS') return 'text-red-400';
    if (regime === 'ROTATION' || regime === 'STAGFLATION') return 'text-amber-400';
    return 'text-[#00ffff]';
  };

  return (
    <div className="bg-[#0a0e27] border border-[#00ff88]/50 rounded-sm overflow-hidden font-mono text-xs relative" data-testid="ratio-relevance-terminal">
      {/* CRT Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-50 z-10"></div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#00ff88]/30 bg-[#0a0e27]/80 relative z-20">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-[#00ff88]" />
          <span className="text-[#00ff88] font-bold tracking-wider">KINE CAPITAL FLOW ANALYSIS</span>
          {analysisState === 'analyzing' && (
            <span className="text-[#00ff88]/60 animate-pulse">PROCESSING...</span>
          )}
          {analysisState === 'complete' && (
            <span className="text-emerald-400">✓ COMPLETE</span>
          )}
          {gated && (
            <span className="text-[#00ffff]/70 tracking-wider">◐ LOCKED FEED</span>
          )}
        </div>
        {!gated && (
          <button
            onClick={handleRerun}
            disabled={analysisState === 'analyzing'}
            className="flex items-center gap-2 px-3 py-1 border border-[#00ff88]/40 text-[#00ff88] hover:bg-[#00ff88]/10 transition-colors disabled:opacity-50"
            data-testid="button-rerun-analysis"
          >
            <RefreshCw className={`w-3 h-3 ${analysisState === 'analyzing' ? 'animate-spin' : ''}`} />
            {analysisState === 'analyzing' ? 'ANALYZING' : 'RE-ANALYZE'}
          </button>
        )}
      </div>

      {/* AI Result Summary */}
      {aiResult && aiResult.regime && (
        <div className="px-4 py-3 bg-[#00ff88]/5 border-b border-[#00ff88]/20 relative z-20">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-white/50">REGIME:</span>
              <span className={`font-bold ${getRegimeColor(aiResult.regime)}`}>{aiResult.regime}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/50">SIGNAL:</span>
              <span className={`font-bold ${getSignalColor(aiResult.signal)}`}>{aiResult.signal}</span>
            </div>
            {aiResult.confidence && (
              <div className="flex items-center gap-2">
                <span className="text-white/50">CONFIDENCE:</span>
                <span className="text-[#00ffff] font-bold">{aiResult.confidence}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gated feed — signed-out visitors get a register CTA in-chrome, no red error */}
      {gated && (
        <div className="relative z-20 p-4" data-testid="ratio-relevance-gate">
          <div className="space-y-1 leading-relaxed">
            <div className="text-[#00ffff] font-bold">[KINE] ▶ CAPITAL FLOW ENGINE ONLINE</div>
            <div className="text-[#aaaaaa]">[KINE] → module 01 :: THE WRECKING BALL &nbsp;&nbsp;[ready]</div>
            <div className="text-[#aaaaaa]">[KINE] → module 02 :: ROTATION &nbsp;&nbsp;[ready]</div>
            <div className="text-[#aaaaaa]">[KINE] → module 03 :: INFLATION / DEFLATION &nbsp;&nbsp;[ready]</div>
            <div className="text-[#aaaaaa]">[KINE] → live AI read requires an authenticated session</div>
            <div className="text-[#00ff88]">
              [KINE] → AWAITING CREDENTIALS
              <span className="inline-block w-2 h-3 ml-1 bg-[#00ff88] align-middle animate-pulse" />
            </div>
          </div>

          <div className="mt-5 border-t border-[#00ff88]/20 pt-5">
            <div className="text-[#00ff88] font-bold tracking-wider text-sm">UNLOCK KINE AI INSIGHTS</div>
            <p className="mt-1 text-white/50 leading-relaxed max-w-md">
              Create a free account to stream the live capital-flow read: regime call, module
              signals, and confidence, refreshed every session. Free to start, no card.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a
                href="/account?mode=signup"
                className="px-4 py-2 bg-[#00ff88]/15 border border-[#00ff88]/60 text-[#00ff88] font-bold tracking-wider hover:bg-[#00ff88]/25 transition-colors"
                data-testid="link-register-gate"
              >
                &gt; CREATE FREE ACCOUNT
              </a>
              <a
                href="/account"
                className="px-4 py-2 border border-white/20 text-white/70 hover:border-[#00ffff]/50 hover:text-[#00ffff] transition-colors"
                data-testid="link-signin-gate"
              >
                Sign in
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Log Output */}
      {!gated && (
      <div
        ref={logContainerRef}
        className="h-64 overflow-y-auto p-4 space-y-1 relative z-20 scrollbar-thin scrollbar-thumb-[#00ff88]/30 scrollbar-track-transparent"
        style={{ scrollBehavior: 'smooth' }}
      >
        {logs.length === 0 && analysisState === 'idle' && (
          <div className="text-white/30 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Waiting for ratio data...
          </div>
        )}
        {logs.length === 0 && analysisState === 'analyzing' && (
          <div className="text-[#00ff88] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Initializing capital flow analysis...
          </div>
        )}
        {logs.map((entry) => (
          <div key={entry.id} className={`${getLineStyle(entry.text)} leading-relaxed`}>
            {entry.text}
          </div>
        ))}
      </div>
      )}

      {/* Footer Status */}
      <div className="px-4 py-2 border-t border-[#00ff88]/20 bg-[#0a0e27]/80 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <span className={`w-2 h-2 rounded-full ${
            gated ? 'bg-[#00ffff] animate-pulse' :
            analysisState === 'analyzing' ? 'bg-amber-400 animate-pulse' :
            analysisState === 'complete' ? 'bg-emerald-400' :
            analysisState === 'error' ? 'bg-red-400' :
            'bg-white/30'
          }`}></span>
          <span>
            {gated ? 'AWAITING CREDENTIALS' :
             analysisState === 'analyzing' ? 'PROCESSING' :
             analysisState === 'complete' ? 'ANALYSIS COMPLETE' :
             analysisState === 'error' ? 'ERROR' :
             'STANDBY'}
          </span>
        </div>
        <div className="text-[10px] text-white/30">
          {ratioData ? `${ratioData.tradingDays} trading days analyzed` : 'No data'}
        </div>
      </div>
    </div>
  );
}