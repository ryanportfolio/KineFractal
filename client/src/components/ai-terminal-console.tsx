import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RawFundamental {
  date: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  freeCashFlow: number | null;
  grossProfit: number | null;
  sharesOutstanding: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  cashAndEquivalents: number | null;
  totalDebt: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
}

interface AnalysisData {
  ticker: string;
  type: "COMPANY" | "ETF";
  revenueAcceleration?: { qoq: number | null; yoy: number | null };
  marginAcceleration?: { qoq: number | null; yoy: number | null };
  ebitMarginAcceleration?: { qoq: number | null; yoy: number | null };
  capitalAllocation?: {
    shareCountChangeYoY: number | null;
    roicTrendYoY: number | null;
    netDebtChangeYoY: number | null;
    verdict: string;
  };
  priceDivergence?: {
    type: string;
    description: string;
    revenueAccel: number | null;
    priceChange3m: number | null;
    strength: number | null;
  };
  latestPrice?: number;
  rawFundamentals?: RawFundamental[];
}

interface AITerminalConsoleProps {
  analysisData: AnalysisData | null;
  autoStart?: boolean;
  onAnalysisComplete?: (result: { regime?: string; signal?: string; confidence?: number }) => void;
}

interface LogEntry {
  id: number;
  text: string;
  timestamp: Date;
}

function getLineStyle(text: string): string {
  // KINE prefix styles
  if (text.includes("[KINE] ▶")) {
    return "text-primary font-bold";
  }
  if (text.includes("✓")) {
    return "text-primary";
  }
  if (text.includes("✗")) {
    return "text-red-400";
  }
  if (text.includes("⚠")) {
    return "text-amber-400";
  }
  if (text.includes("[KINE] →")) {
    return "text-slate-300";
  }
  return "text-slate-400";
}

function formatPrefix(text: string): { prefix: string; content: string } {
  const prefixMatch = text.match(/^\[KINE\]/);
  if (prefixMatch) {
    const prefix = prefixMatch[0];
    const content = text.slice(prefix.length).trim();
    return { prefix, content };
  }
  return { prefix: "", content: text };
}

export function AITerminalConsole({ analysisData, autoStart = false, onAnalysisComplete }: AITerminalConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ regime?: string; signal?: string; confidence?: number } | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((text: string) => {
    setLogs(prev => [...prev, {
      id: logIdRef.current++,
      text,
      timestamp: new Date()
    }]);
  }, []);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const parseResults = useCallback((allLogs: string[]) => {
    let regime: string | undefined;
    let signal: string | undefined;
    let confidence: number | undefined;

    for (const line of allLogs) {
      // Match regime - capture word characters and underscores (e.g., INFLECTION_UP)
      const regimeMatch = line.match(/REGIME:\s*([\w_]+)/i);
      if (regimeMatch) regime = regimeMatch[1].toUpperCase();

      // Match signal - capture letters and spaces (e.g., STRONG BUY)
      const signalMatch = line.match(/SIGNAL:\s*([A-Z\s]+)/i);
      if (signalMatch) signal = signalMatch[1].trim().toUpperCase();

      // Match confidence - handle decimals and % sign (e.g., 78%, 78.5%)
      const confMatch = line.match(/CONFIDENCE:\s*(\d+(?:\.\d+)?)\s*%?/i);
      if (confMatch) confidence = Math.round(parseFloat(confMatch[1]));
    }

    return { regime, signal, confidence };
  }, []);

  const runAnalysis = async () => {
    if (!analysisData || isAnalyzing) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsAnalyzing(true);
    setError(null);
    setLogs([]);
    setAiResult(null);
    logIdRef.current = 0;

    const collectedLogs: string[] = [];

    try {
      const response = await fetch("/api/gemini/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisData),
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
                collectedLogs.push(data.line);
                addLog(data.line);
                await new Promise(r => setTimeout(r, 40));
              }
              if (data.done) {
                setHasAnalyzed(true);
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

      // Parse the results from collected logs
      const result = parseResults(collectedLogs);
      setAiResult(result);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }

      setHasAnalyzed(true);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        addLog("[KINE] → Analysis cancelled");
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        addLog(`[KINE] ✗ Error: ${message}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-start analysis when data changes
  useEffect(() => {
    if (autoStart && analysisData && !isAnalyzing) {
      runAnalysis();
    }
  }, [analysisData?.ticker, autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!analysisData) {
    return (
      <div className="p-4 border-2 rounded-sm bg-slate-950/30 border-slate-500">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-slate-500" />
          <span className="font-mono text-xs text-slate-500 uppercase">
            KINE Analysis Terminal
          </span>
        </div>
        <div className="font-mono text-sm text-muted-foreground">
          Awaiting analysis data...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-2 rounded-sm bg-black/80 border-primary/50" data-testid="ai-terminal-console">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs text-primary uppercase tracking-wider">
            KINE Momentum Analyst
          </span>
          {isAnalyzing && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Processing
            </span>
          )}
        </div>
        <Button
          onClick={runAnalysis}
          disabled={isAnalyzing}
          size="sm"
          variant="ghost"
          className="font-mono text-xs h-7 px-2"
          data-testid="button-run-analysis"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Analyzing...
            </>
          ) : hasAnalyzed ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1" />
              Re-analyze
            </>
          ) : (
            <>
              <Cpu className="w-3 h-3 mr-1" />
              Analyze
            </>
          )}
        </Button>
      </div>

      {/* AI Result Summary (if available) */}
      {aiResult && aiResult.regime && (
        <div className="mb-3 p-2 bg-primary/10 border border-primary/30 rounded-sm">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">REGIME:</span>
              <span className="text-primary font-bold">{aiResult.regime}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">SIGNAL:</span>
              <span className={`font-bold ${
                aiResult.signal?.includes("BUY") ? "text-primary" :
                aiResult.signal?.includes("SELL") || aiResult.signal?.includes("AVOID") ? "text-red-400" :
                aiResult.signal?.includes("REDUCE") ? "text-amber-400" :
                "text-slate-300"
              }`}>{aiResult.signal}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">CONF:</span>
              <span className="text-primary">{aiResult.confidence}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Output */}
      <div 
        className="bg-black/60 border border-primary/20 rounded-sm p-3 h-64 overflow-y-auto font-mono text-xs leading-relaxed"
        data-testid="terminal-output"
      >
        {logs.length === 0 && !isAnalyzing && (
          <div className="text-muted-foreground opacity-50">
            {`> Click "Analyze" to run KINE momentum analysis on ${analysisData.ticker}...`}
          </div>
        )}
        
        <AnimatePresence mode="popLayout">
          {logs.map((log) => {
            const { prefix, content } = formatPrefix(log.text);
            const lineStyle = getLineStyle(log.text);
            
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={`${lineStyle} mb-1`}
              >
                {prefix && (
                  <span className="text-slate-600 mr-1">{prefix}</span>
                )}
                <span>{content}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-primary"
          >
            <span className="animate-pulse">█</span>
          </motion.div>
        )}
        
        <div ref={logsEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-2 p-2 bg-red-950/30 border border-red-500/50 rounded-sm">
          <span className="font-mono text-xs text-red-400">
            Error: {error}
          </span>
        </div>
      )}
    </div>
  );
}
