import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Cpu } from 'lucide-react';
import { Link } from 'wouter';

interface RatioData {
  symbol: string;
  value: number;
  zScore200D: number;
  zScore1Y: number;
  zScore3Y: number;
}

interface LogEntry {
  id: number;
  text: string;
}

type AnalysisState = 'idle' | 'waiting' | 'analyzing' | 'complete' | 'error';

const RATIOS: RatioData[] = [
  {
    symbol: 'XLE/SPY',
    value: 0.1214,
    zScore200D: -1.04,
    zScore1Y: 1.31,
    zScore3Y: 0.87
  },
  {
    symbol: 'GLD/SPY',
    value: 0.5637,
    zScore200D: 1.31,
    zScore1Y: -0.82,
    zScore3Y: 0.45
  },
  {
    symbol: 'IVW/IVE',
    value: 0.3940,
    zScore200D: 0.96,
    zScore1Y: 0.73,
    zScore3Y: -1.15
  }
];

function getLineStyle(text: string): string {
  if (text.includes("[KINE] ▶")) return "text-[#00ffff] font-bold";
  if (text.includes("✓")) return "text-[#00ff88]";
  if (text.includes("✗")) return "text-[#ff3333]";
  if (text.includes("⚠")) return "text-[#ff9900]";
  if (text.includes("[KINE] →")) return "text-[#aaaaaa]";
  return "text-[#888888]";
}

const scrollbarHideStyles = `
  & ::-webkit-scrollbar {
    display: none;
  }
`;

export function KineFractalTerminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const logIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setAnalysisState('analyzing');
    setLogs([]);
    logIdRef.current = 0;

    try {
      const response = await fetch("/api/gemini/analyze/ratios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratios: RATIOS }),
        signal: abortControllerRef.current.signal,
      });

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
                await new Promise(r => setTimeout(r, 30));
              }
              if (data.done) {
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
  }, [addLog]);

  useEffect(() => {
    setAnalysisState('waiting');

    delayTimerRef.current = setTimeout(() => {
      runAnalysis();
    }, 1000);

    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [runAnalysis]);

  const getZScoreColor = (zScore: number) => {
    if (zScore < -1.5) return 'text-[#ff3333]';
    if (zScore < -0.5) return 'text-[#ff9900]';
    if (zScore < 0.5) return 'text-[#ffff00]';
    if (zScore < 1.5) return 'text-[#00ff88]';
    return 'text-[#00ffff]';
  };

  return (
    <div className="w-full bg-card border border-primary p-6 font-mono text-xs relative overflow-hidden group shadow-[0_0_30px_hsl(var(--primary)/0.3)]" style={{ scrollBehavior: 'auto' }}>
      {/* CRT Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-100 z-10"></div>

      {/* ASCII Art Header with TERMINAL */}
      <Link href="/sector-rotation">
        <div className="mb-6 border-b border-primary/30 pb-4 relative z-20 group/header hover:border-primary/60 transition-colors duration-300">
          <pre className="font-mono text-[8px] text-primary text-shadow-[0_0_10px_hsl(var(--primary)/0.5)] whitespace-pre overflow-x-auto leading-tight mb-3 text-pulse-glow cursor-pointer group-hover/header:text-shadow-[0_0_20px_hsl(var(--primary)/0.8)] transition-all duration-300 hover:drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]">
{`███████████████████████████████████████████████████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░█░█░▀█▀░█▀█░█▀▀░░░█▀▀░█▀▄░█▀█░█▀▀░▀█▀░█▀█░█░░░█░░█▀▄░█▀█░▀█▀░▀█▀░█▀█░░░▀█▀░█▀▀░█▀▄░█▄█░▀█▀░█▀█░█▀█░█░░░█
█░░█▀▄░░█░░█░█░█▀▀░░░█▀▀░█▀▄░█▀█░█░░░░█░░█▀█░█░░░█░░█▀▄░█▀█░░█░░░█░░█░█░░░░█░░█▀▀░█▀▄░█░█░░█░░█░█░█▀█░█░░░█
█░░▀░▀░▀▀▀░▀░▀░▀▀▀░░░▀░░░▀░▀░▀░▀░▀▀▀░░▀░░▀░▀░▀▀▀░█░░▀░▀░▀░▀░░▀░░▀▀▀░▀▀▀░░░░▀░░▀▀▀░▀░▀░▀░▀░▀▀▀░▀░▀░▀░▀░▀▀▀░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
███████████████████████████████████████████████████████████████████████████████████████████████████████████`}
          </pre>
          <div className="text-[10px] text-primary/60 tracking-[0.15em] flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-primary animate-pulse"></span>
            <span className="text-shadow-[0_0_10px_hsl(var(--primary)/0.3)]">TERMINAL_ACTIVE</span>
          </div>
        </div>
      </Link>

      {/* Macro Ratios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-20">
        {RATIOS.map((ratio, idx) => (
          <Link href="/sector-rotation" key={idx}>
            <div
              className="border border-primary/40 bg-card/60 p-4 backdrop-blur-sm hover:border-primary/80 transition-colors cursor-pointer"
            >
            {/* Ratio Symbol & Value */}
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-primary/20">
              <div className="text-primary font-bold text-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                {ratio.symbol}
              </div>
              <div className="text-foreground font-bold text-shadow-[0_0_10px_hsl(var(--primary)/0.3)]">
                {ratio.value.toFixed(4)}
              </div>
            </div>

            {/* Z-Score Levels */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {/* 200D Z-Score */}
                <div className="text-center">
                  <div className="text-primary/50 text-[9px] mb-1 font-bold">200D</div>
                  <div className={`font-bold text-shadow-[0_0_5px_hsl(var(--primary)/0.3)] ${getZScoreColor(ratio.zScore200D)}`}>
                    {ratio.zScore200D > 0 ? '+' : ''}{ratio.zScore200D.toFixed(2)}σ
                  </div>
                </div>

                {/* 1Y Z-Score */}
                <div className="text-center">
                  <div className="text-primary/50 text-[9px] mb-1 font-bold">1Y</div>
                  <div className={`font-bold text-shadow-[0_0_5px_hsl(var(--primary)/0.3)] ${getZScoreColor(ratio.zScore1Y)}`}>
                    {ratio.zScore1Y > 0 ? '+' : ''}{ratio.zScore1Y.toFixed(2)}σ
                  </div>
                </div>

                {/* 3Y Z-Score */}
                <div className="text-center">
                  <div className="text-primary/50 text-[9px] mb-1 font-bold">3Y</div>
                  <div className={`font-bold text-shadow-[0_0_5px_hsl(var(--primary)/0.3)] ${getZScoreColor(ratio.zScore3Y)}`}>
                    {ratio.zScore3Y > 0 ? '+' : ''}{ratio.zScore3Y.toFixed(2)}σ
                  </div>
                </div>
              </div>

              {/* Z-Score Label */}
              <div className="text-primary/40 text-[8px] text-center pt-1 border-t border-primary/20">
                Z-SCORE ANALYSIS
              </div>
            </div>
            </div>
          </Link>
        ))}
      </div>

      {/* KINE AI Analysis Section */}
      <div className="mt-6 pt-4 border-t border-primary/30 relative z-20" data-testid="kine-ai-analysis">
        {/* KINE Header */}
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-3 h-3 text-primary" />
          <span className="text-primary text-[10px] font-bold tracking-wider">KINE_AI_ANALYSIS</span>
          {analysisState === 'waiting' && (
            <span className="text-[#ffff00]/60 text-[9px] ml-2">
              [INITIALIZING...]
            </span>
          )}
          {analysisState === 'analyzing' && (
            <span className="text-primary text-[9px] ml-2 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              PROCESSING
            </span>
          )}
          {analysisState === 'complete' && (
            <span className="text-primary/60 text-[9px] ml-2">
              [COMPLETE]
            </span>
          )}
        </div>

        {/* Terminal Log Output */}
        <div ref={logContainerRef} className="bg-black/60 border border-primary/20 p-3 h-64 overflow-y-auto scrollbar-hide">
          {analysisState === 'waiting' && (
            <div className="text-primary/40 text-[13px]">
              <span className="animate-pulse">█</span> Awaiting system initialization...
            </div>
          )}
          
          {analysisState === 'idle' && logs.length === 0 && (
            <div className="text-primary/40 text-[13px]">
              {`> KINE analysis module standby...`}
            </div>
          )}

          {logs.map((log) => (
            <div
              key={log.id}
              className={`text-[13px] leading-relaxed ${getLineStyle(log.text)}`}
            >
              {log.text}
            </div>
          ))}

          {analysisState === 'analyzing' && (
            <div className="text-primary text-[13px] mt-1">
              <span className="animate-pulse">█</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Status */}
      <div className="flex items-center justify-between pt-4 border-t border-primary/30 text-primary/60 text-[9px] relative z-20 mt-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-primary animate-pulse"></span>
          <span className="font-bold">MACRO_REGIME_DETECTOR</span>
        </div>
        <button className="hover:text-primary transition-colors flex items-center gap-1 text-shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
          <RefreshCw className="w-3 h-3" />
          <span>SYNC</span>
        </button>
      </div>

      {/* Timestamp */}
      <div className="mt-3 text-right text-primary/40 text-[9px] relative z-20">
        LAST_UPDATE: {new Date().toISOString().split('T')[0]} 16:00:00 UTC
      </div>
    </div>
  );
}
