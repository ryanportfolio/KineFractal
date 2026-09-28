import { useState, useEffect } from "react";
import { RefreshCw, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsightData {
  headline: string;
  dataDisconnect: string;
  marketImplication: string;
}

interface CorrelationRow {
  metric: string;
  ticker: string;
  "15D": number;
  "30D": number;
  "90D": number;
  "120D": number;
  "180D": number;
  high52W: number;
  low52W: number;
  pctPos: number;
  pctNeg: number;
}

interface CorrelationData {
  success: boolean;
  asOf: string;
  dataPoints: number;
  correlations: CorrelationRow[];
}

function formatCorr(value: number): string {
  return value.toFixed(2);
}

function getCorrStyle(value: number): React.CSSProperties {
  // Neutral zone: -0.5 to 0.5
  if (value > -0.5 && value < 0.5) {
    return { color: "#9ca3af" };
  }
  
  const magnitude = Math.abs(value);
  const opacity = 0.1 + ((magnitude - 0.5) / 0.5 * 0.4); // Scale intensity from 0.5 to 1.0
  
  if (value <= -0.5) {
    return {
      color: "#ef4444",
      backgroundColor: `rgba(239, 68, 68, ${opacity})`,
    };
  } else {
    return {
      color: "#22c55e",
      backgroundColor: `rgba(34, 197, 94, ${opacity})`,
    };
  }
}

function getHighLowStyle(value: number): React.CSSProperties {
  // Neutral zone: -0.5 to 0.5
  if (value > -0.5 && value < 0.5) {
    return { color: "#9ca3af" };
  }
  
  const magnitude = Math.abs(value);
  const opacity = 0.1 + ((magnitude - 0.5) / 0.5 * 0.4);
  
  if (value >= 0.5) {
    return {
      color: "#22c55e",
      backgroundColor: `rgba(34, 197, 94, ${opacity})`,
    };
  } else {
    return {
      color: "#ef4444",
      backgroundColor: `rgba(239, 68, 68, ${opacity})`,
    };
  }
}

export function USDCorrelationTerminal() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/correlations/usd");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchInsight = async () => {
    setInsightLoading(true);
    setInsightError(null);
    try {
      const res = await fetch("/api/correlations/usd/insight");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      if (result.insight) {
        setInsight(result.insight);
      }
    } catch (err: any) {
      setInsightError(err.message || "Failed to generate insight");
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch insight after correlation data loads with 5 second delay
  useEffect(() => {
    if (data && !insight && !insightLoading) {
      const timer = setTimeout(() => {
        fetchInsight();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [data]);

  const columns = ["15D", "30D", "90D", "120D", "180D"];

  return (
    <div className="border border-border bg-card/50 p-4 md:p-6 font-mono" data-testid="usd-correlation-terminal">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-primary tracking-wide">
            Key $USD Correlations*
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            *Days = Trading Days
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-muted-foreground">52-Wk Rolling 30D Correlation</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-7 px-2"
            data-testid="button-refresh-correlations"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 border border-red-500/30" data-testid="text-error">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-8 text-muted-foreground animate-pulse" data-testid="loading-indicator">
          Loading correlation data...
        </div>
      )}

      {data && !loading && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded text-xs text-foreground space-y-2" data-testid="correlation-legend">
          <p className="text-muted-foreground">
            Think of the US Dollar ($USD) as the gravity of the global market. This tool measures how strongly that gravity is pulling on other assets right now.
          </p>
          <div className="pt-2 border-t border-primary/10 text-muted-foreground space-y-1">
            <div><strong className="text-foreground">Red (Negative):</strong> Asset falls when USD rises · the currency is a headwind</div>
            <div><strong className="text-foreground">Green (Positive):</strong> Asset rises with USD · the currency is a tailwind</div>
            <div><strong className="text-foreground">Gray (Neutral):</strong> Asset is uncorrelated to USD movements</div>
          </div>
        </div>
      )}

      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm" data-testid="table-correlations">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">METRIC</th>
                {columns.map(col => (
                  <th key={col} className="text-center px-2 py-2 text-muted-foreground font-medium">
                    {col}
                  </th>
                ))}
                <th className="text-center px-2 py-2 text-muted-foreground font-medium border-l border-border">High</th>
                <th className="text-center px-2 py-2 text-muted-foreground font-medium">Low</th>
              </tr>
            </thead>
            <tbody>
              {data.correlations.map((row, idx) => (
                <tr 
                  key={row.ticker} 
                  className={`border-b border-border/50 hover:bg-white/5 ${idx === data.correlations.length - 1 ? "border-t-2 border-t-amber-500/50" : ""}`}
                  data-testid={`row-correlation-${row.ticker}`}
                >
                  <td className="py-2.5 pr-4 font-medium text-foreground">
                    {row.ticker}
                  </td>
                  {columns.map(col => {
                    const value = row[col as keyof CorrelationRow] as number;
                    return (
                      <td 
                        key={col} 
                        className="text-center px-2 py-2.5"
                        style={getCorrStyle(value)}
                        data-testid={`cell-${row.ticker}-${col}`}
                      >
                        {formatCorr(value)}
                      </td>
                    );
                  })}
                  <td 
                    className="text-center px-2 py-2.5 border-l border-border text-muted-foreground"
                  >
                    {formatCorr(row.high52W)}
                  </td>
                  <td 
                    className="text-center px-2 py-2.5 text-muted-foreground"
                  >
                    {formatCorr(row.low52W)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Data as of: {data.asOf} | {data.dataPoints} trading days analyzed
            </span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 inline-block"></span>
                Strong Negative (&lt;-0.5)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 inline-block"></span>
                Strong Positive (&gt;0.5)
              </span>
            </span>
          </div>

          {/* AI Insight Section */}
          <div className="mt-6 pt-4 border-t border-primary/30" data-testid="ai-insight-section">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary tracking-wide">KINE MACRO INSIGHT</span>
              {insightLoading && (
                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-2" />
              )}
            </div>

            {insightLoading && !insight && (
              <div className="bg-black/40 border border-primary/20 p-4 text-xs text-muted-foreground animate-pulse">
                Analyzing correlation matrix...
              </div>
            )}

            {insightError && (
              <div className="bg-red-950/30 border border-red-500/30 p-4 text-xs text-red-400">
                {insightError}
              </div>
            )}

            {insight && (
              <div className="bg-black/60 border border-primary/30 p-4 space-y-3 text-xs" data-testid="insight-content">
                <div>
                  <span className="text-primary font-bold">[KINE] ▶ REGIME: </span>
                  <span className="text-amber-400 font-semibold">{insight.headline}</span>
                </div>
                <div>
                  <span className="text-primary font-bold">[KINE] → SIGNAL: </span>
                  <span className="text-foreground">{insight.dataDisconnect}</span>
                </div>
                <div>
                  <span className="text-primary font-bold">[KINE] ⚠ IMPLICATION: </span>
                  <span className="text-white">{insight.marketImplication}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
