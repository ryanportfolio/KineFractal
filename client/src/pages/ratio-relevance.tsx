import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Loader2, ArrowLeft, Cpu } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { SectorToolsMenu } from '@/components/sector-tools-menu';
import { useDocumentMeta } from '@/hooks/use-document-meta';
import { RatioRelevanceTerminal, type ModuleSignals } from '@/components/ratio-relevance-terminal';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';
import type { MarketDataFreshness } from '@shared/market-data';

interface TimeSeriesPoint {
  date: string;
  value: number;
}

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
  timeSeries?: TimeSeriesPoint[];
  mean?: number;
}

interface OutlierData {
  ticker: string;
  name: string;
  todayRange: number;      // Today's daily range %
  avgRange: number;        // 20-day average daily range %
  rangeRatio: number;      // Today / Avg (e.g., 2.4 means 2.4× average)
  rangeZ: number;          // Z-score: (today - avg) / stdev
  isUnusual: boolean;      // Z >= 2
}

interface RatioData {
  success: boolean;
  asOf: string;
  tradingDays: number;
  freshness: MarketDataFreshness;
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
    gammaVol: RatioMetric;
    outlierScanner: {
      date: string;
      rollingWindow: number;
      outlier: OutlierData;
      top5ByZ: OutlierData[];        // Sorted by relative unusualness
      top5ByAbsolute: OutlierData[]; // Sorted by absolute daily range
    };
  };
}

function MomentumBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const isPositive = value > 0;
  const absValue = Math.abs(value);
  const width = Math.min(absValue * 10, 100);
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-black/50 border border-white/10 rounded-sm overflow-hidden relative">
        <div 
          className={`absolute top-0 h-full transition-all duration-500 ${
            isPositive 
              ? 'left-1/2 bg-gradient-to-r from-emerald-500/80 to-emerald-400' 
              : 'right-1/2 bg-gradient-to-l from-red-500/80 to-red-400'
          }`}
          style={{ width: `${width / 2}%` }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
      </div>
      {showLabel && (
        <span className={`font-mono text-xs w-16 text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{value.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

function FractalMomentumArray({ momentum5D, momentum21D, momentum79D }: { momentum5D: number; momentum21D: number; momentum79D: number }) {
  const periods = [
    { label: '5D', value: momentum5D },
    { label: '21D', value: momentum21D },
    { label: '79D', value: momentum79D }
  ];

  const getIntensity = (value: number): number => {
    const absValue = Math.abs(value);
    if (absValue >= 5) return 1;
    if (absValue >= 2) return 0.7;
    if (absValue >= 0.5) return 0.4;
    return 0.2;
  };

  const allPositive = periods.every(p => p.value > 0);
  const allNegative = periods.every(p => p.value < 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] text-white/40 w-20">Fractal ROC</span>
        {allPositive && (
          <span className="font-mono text-[9px] text-emerald-400 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
            ALIGNED UP
          </span>
        )}
        {allNegative && (
          <span className="font-mono text-[9px] text-red-400 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded-sm">
            ALIGNED DOWN
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {periods.map(({ label, value }) => {
          const isPositive = value > 0;
          const intensity = getIntensity(value);
          
          return (
            <div key={label} className="flex flex-col items-center">
              <div 
                className={`w-full h-6 rounded-sm border transition-all duration-300 flex items-center justify-center ${
                  isPositive 
                    ? 'border-emerald-500/40' 
                    : 'border-red-500/40'
                }`}
                style={{
                  backgroundColor: isPositive 
                    ? `rgba(16, 185, 129, ${intensity * 0.4})` 
                    : `rgba(239, 68, 68, ${intensity * 0.4})`,
                  boxShadow: intensity > 0.5 
                    ? `0 0 ${intensity * 8}px ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` 
                    : 'none'
                }}
              >
                <span className={`font-mono text-[10px] font-medium ${
                  isPositive ? 'text-emerald-300' : 'text-red-300'
                }`}>
                  {value > 0 ? '+' : ''}{value.toFixed(1)}%
                </span>
              </div>
              <span className="font-mono text-[9px] text-white/40 mt-0.5">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignalBadge({ signal }: { signal: "Trend Up" | "Trend Down" | "Neutral" }) {
  const config = {
    "Trend Up": { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: TrendingUp },
    "Trend Down": { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', icon: TrendingDown },
    "Neutral": { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: Activity }
  };
  const { bg, border, text, icon: Icon } = config[signal];
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 ${bg} ${border} border rounded-sm`}>
      <Icon className={`w-3 h-3 ${text}`} />
      <span className={`font-mono text-[10px] uppercase ${text}`}>{signal}</span>
    </div>
  );
}

function AIStressBadge({ signal, isLoading }: { signal?: 'NORMAL' | 'ELEVATED' | 'MAXIMUM_STRESS'; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-sm animate-pulse">
        <Cpu className="w-3 h-3 text-[#00ff88]" />
        <span className="font-mono text-[10px] text-[#00ff88]">ANALYZING...</span>
      </div>
    );
  }
  
  if (!signal) return null;
  
  const config = {
    NORMAL: { bg: 'bg-emerald-500/30', text: 'text-emerald-400', pulse: false },
    ELEVATED: { bg: 'bg-amber-500/30', text: 'text-amber-400', pulse: false },
    MAXIMUM_STRESS: { bg: 'bg-red-500/30', text: 'text-red-400', pulse: true }
  };
  const { bg, text, pulse } = config[signal];
  const displayText = signal === 'MAXIMUM_STRESS' ? 'MAX STRESS' : signal;
  
  return (
    <span className={`font-mono text-xs font-bold uppercase px-2 py-0.5 rounded-sm ${bg} ${text} ${pulse ? 'animate-pulse' : ''}`}>
      {displayText}
    </span>
  );
}

function AITrendBadge({ signal, isLoading, label = 'TREND' }: { signal?: 'TREND_UP' | 'TREND_DOWN' | 'NEUTRAL'; isLoading: boolean; label?: string }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-sm animate-pulse">
        <Cpu className="w-3 h-3 text-[#00ff88]" />
        <span className="font-mono text-[10px] text-[#00ff88]">ANALYZING...</span>
      </div>
    );
  }
  
  if (!signal) return null;
  
  const config = {
    TREND_UP: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: TrendingUp, displayText: `${label} UP` },
    TREND_DOWN: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', icon: TrendingDown, displayText: `${label} DOWN` },
    NEUTRAL: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: Activity, displayText: 'NEUTRAL' }
  };
  const { bg, border, text, icon: Icon, displayText } = config[signal];
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 ${bg} ${border} border rounded-sm`}>
      <Icon className={`w-3 h-3 ${text}`} />
      <span className={`font-mono text-[10px] uppercase ${text}`}>{displayText}</span>
    </div>
  );
}

function AIStyleBadge({ signal, isLoading }: { signal?: 'GROWTH_LEADS' | 'VALUE_LEADS' | 'NEUTRAL'; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-sm animate-pulse">
        <Cpu className="w-3 h-3 text-[#00ff88]" />
        <span className="font-mono text-[10px] text-[#00ff88]">ANALYZING...</span>
      </div>
    );
  }
  
  if (!signal) return null;
  
  const config = {
    GROWTH_LEADS: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', text: 'text-cyan-400', icon: TrendingUp },
    VALUE_LEADS: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: TrendingDown },
    NEUTRAL: { bg: 'bg-white/10', border: 'border-white/30', text: 'text-white/60', icon: Activity }
  };
  const { bg, border, text, icon: Icon } = config[signal];
  const displayText = signal === 'GROWTH_LEADS' ? 'GROWTH' : signal === 'VALUE_LEADS' ? 'VALUE' : 'NEUTRAL';
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 ${bg} ${border} border rounded-sm`}>
      <Icon className={`w-3 h-3 ${text}`} />
      <span className={`font-mono text-[10px] uppercase ${text}`}>{displayText}</span>
    </div>
  );
}

function AIConsumerBadge({ signal, isLoading }: { signal?: 'STRONG' | 'WEAK' | 'NEUTRAL'; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-sm animate-pulse">
        <Cpu className="w-3 h-3 text-[#00ff88]" />
        <span className="font-mono text-[10px] text-[#00ff88]">ANALYZING...</span>
      </div>
    );
  }
  
  if (!signal) return null;
  
  const config = {
    STRONG: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: TrendingUp },
    WEAK: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', icon: TrendingDown },
    NEUTRAL: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: Activity }
  };
  const { bg, border, text, icon: Icon } = config[signal];
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 ${bg} ${border} border rounded-sm`}>
      <Icon className={`w-3 h-3 ${text}`} />
      <span className={`font-mono text-[10px] uppercase ${text}`}>{signal}</span>
    </div>
  );
}

function AIInflationBadge({ signal, isLoading }: { signal?: 'INFLATIONARY' | 'DEFLATIONARY' | 'NEUTRAL'; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-sm animate-pulse">
        <Cpu className="w-3 h-3 text-[#00ff88]" />
        <span className="font-mono text-[10px] text-[#00ff88]">ANALYZING...</span>
      </div>
    );
  }
  
  if (!signal) return null;
  
  const config = {
    INFLATIONARY: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', icon: TrendingUp },
    DEFLATIONARY: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', icon: TrendingDown },
    NEUTRAL: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: Activity }
  };
  const { bg, border, text, icon: Icon } = config[signal];
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 ${bg} ${border} border rounded-sm`}>
      <Icon className={`w-3 h-3 ${text}`} />
      <span className={`font-mono text-[10px] uppercase ${text}`}>{signal}</span>
    </div>
  );
}

function AIGoldBadge({ signal, isLoading }: { signal?: 'RISK_OFF' | 'RISK_ON' | 'NEUTRAL'; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-sm animate-pulse">
        <Cpu className="w-3 h-3 text-[#00ff88]" />
        <span className="font-mono text-[10px] text-[#00ff88]">ANALYZING...</span>
      </div>
    );
  }
  
  if (!signal) return null;
  
  const config = {
    RISK_OFF: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', icon: AlertTriangle },
    RISK_ON: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: TrendingUp },
    NEUTRAL: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: Activity }
  };
  const { bg, border, text, icon: Icon } = config[signal];
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 ${bg} ${border} border rounded-sm`}>
      <Icon className={`w-3 h-3 ${text}`} />
      <span className={`font-mono text-[10px] uppercase ${text}`}>{signal}</span>
    </div>
  );
}

interface RatioWaveChartProps {
  data: TimeSeriesPoint[];
  mean: number;
  title: string;
  ratioLabel: string;
  highLabel: string;
  lowLabel: string;
  highColor: string;
  lowColor: string;
  strokeColor: string;
  highTooltip: string;
  lowTooltip: string;
  gradientId: string;
}

function RatioWaveChart({ 
  data, mean, title, ratioLabel, highLabel, lowLabel, 
  highColor, lowColor, strokeColor, highTooltip, lowTooltip, gradientId 
}: RatioWaveChartProps) {
  if (!data || data.length === 0) return null;
  
  const minValue = Math.min(...data.map(d => d.value));
  const maxValue = Math.max(...data.map(d => d.value));
  const padding = Math.max((maxValue - minValue) * 0.1, 0.001);
  
  const yMin = minValue - padding;
  const yMax = maxValue + padding;
  const meanPercent = ((yMax - mean) / (yMax - yMin)) * 100;
  const meanPercentClamped = Math.max(0, Math.min(100, meanPercent));
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  // Recharts places the tooltip from its getBoundingClientRect width, which the
  // desktop root zoom inflates (1.2x/1.4x), so it never "fits" beside the cursor
  // and gets pinned to the chart's left edge. Instead the wrapper sits exactly on
  // the cursor (see <Tooltip> below) and the box shifts itself to the free side.
  const CustomTooltip = ({ active, payload, label, coordinate, viewBox }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const isAboveMean = value > mean;
      const flip = coordinate && viewBox && coordinate.x > viewBox.x + viewBox.width / 2;
      return (
        <div
          className="bg-black/90 border border-white/20 rounded-sm px-1.5 py-1 font-mono text-[10px] leading-tight whitespace-nowrap"
          style={{ transform: flip ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}
        >
          <div className="text-white/60">{formatDate(label)}</div>
          <div style={{ color: isAboveMean ? highColor : lowColor }}>
            {ratioLabel}: {value.toFixed(4)}
          </div>
          <div className="text-white/40 text-[9px]">
            {isAboveMean ? highTooltip : lowTooltip}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-black/60 border border-white/10 rounded-sm p-2 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] text-white/40">{title}</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: highColor }} />
            <span className="font-mono text-[9px] text-white/40">{highLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lowColor }} />
            <span className="font-mono text-[9px] text-white/40">{lowLabel}</span>
          </div>
        </div>
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 5, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={highColor} />
                <stop offset={`${meanPercentClamped}%`} stopColor={highColor} />
                <stop offset={`${meanPercentClamped}%`} stopColor={lowColor} />
                <stop offset="100%" stopColor={lowColor} />
              </linearGradient>
              <linearGradient id={`${gradientId}-fill-high`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={highColor} stopOpacity={0.3} />
                <stop offset={`${meanPercentClamped}%`} stopColor={highColor} stopOpacity={0.1} />
                <stop offset={`${meanPercentClamped}%`} stopColor={lowColor} stopOpacity={0.1} />
                <stop offset="100%" stopColor={lowColor} stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              interval={Math.floor(data.length / 5)}
            />
            <YAxis 
              domain={[yMin, yMax]}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(3)}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} offset={0} position={{ y: 0 }} allowEscapeViewBox={{ x: true, y: true }} isAnimationActive={false} wrapperStyle={{ pointerEvents: 'none' }} />
            <ReferenceLine 
              y={mean} 
              stroke="rgba(255,255,255,0.4)" 
              strokeDasharray="3 3"
              label={{ 
                value: 'Mean', 
                position: 'right', 
                fill: 'rgba(255,255,255,0.4)', 
                fontSize: 9,
                fontFamily: 'monospace'
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={`url(#${gradientId}-stroke)`}
              strokeWidth={2}
              fill={`url(#${gradientId}-fill-high)`}
              dot={false}
              activeDot={{ r: 3, fill: strokeColor, stroke: '#000' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between mt-1 font-mono text-[9px] text-white/30">
        <span>3 Years Ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10 glitch-text" data-text={text}>{text}</span>
      <style>{`
        .glitch-text {
          animation: glitch 2s infinite;
        }
        .glitch-text::before,
        .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          opacity: 0.8;
        }
        .glitch-text::before {
          animation: glitch-1 0.3s infinite;
          color: #ff0080;
          z-index: -1;
        }
        .glitch-text::after {
          animation: glitch-2 0.3s infinite;
          color: #00ff88;
          z-index: -2;
        }
        @keyframes glitch {
          0%, 90%, 100% { opacity: 1; }
          91% { opacity: 0.8; }
          92% { opacity: 1; }
        }
        @keyframes glitch-1 {
          0% { clip-path: inset(40% 0 61% 0); transform: translate(-2px, -1px); }
          20% { clip-path: inset(92% 0 1% 0); transform: translate(1px, 2px); }
          40% { clip-path: inset(43% 0 1% 0); transform: translate(-1px, 1px); }
          60% { clip-path: inset(25% 0 58% 0); transform: translate(2px, -1px); }
          80% { clip-path: inset(54% 0 7% 0); transform: translate(-2px, 2px); }
          100% { clip-path: inset(58% 0 43% 0); transform: translate(1px, -2px); }
        }
        @keyframes glitch-2 {
          0% { clip-path: inset(65% 0 14% 0); transform: translate(2px, 1px); }
          20% { clip-path: inset(79% 0 14% 0); transform: translate(-2px, -1px); }
          40% { clip-path: inset(30% 0 61% 0); transform: translate(1px, 2px); }
          60% { clip-path: inset(12% 0 69% 0); transform: translate(-1px, -2px); }
          80% { clip-path: inset(89% 0 2% 0); transform: translate(2px, 1px); }
          100% { clip-path: inset(34% 0 48% 0); transform: translate(-2px, -1px); }
        }
      `}</style>
    </span>
  );
}

function ModuleCard({ 
  title, 
  children, 
  variant = 'default',
  icon
}: { 
  title: string; 
  children: React.ReactNode; 
  variant?: 'default' | 'danger' | 'success' | 'warning';
  icon?: React.ReactNode;
}) {
  const variantStyles = {
    default: 'border-[#00ff88]/30 hover:border-[#00ff88]/60',
    danger: 'border-red-500/40 hover:border-red-500/70',
    success: 'border-emerald-500/40 hover:border-emerald-500/70',
    warning: 'border-amber-500/40 hover:border-amber-500/70'
  };
  
  const headerStyles = {
    default: 'border-b-[#00ff88]/20 text-[#00ff88]',
    danger: 'border-b-red-500/30 text-red-400',
    success: 'border-b-emerald-500/30 text-emerald-400',
    warning: 'border-b-amber-500/30 text-amber-400'
  };

  return (
    <div className={`bg-black/60 border ${variantStyles[variant]} rounded-sm transition-all duration-300 backdrop-blur-sm`}>
      <div className={`px-4 py-2 border-b ${headerStyles[variant]} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-mono text-xs uppercase tracking-wider">{title}</h3>
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function RatioRow({ metric, showRegime = false, portfolioLink, aiBadge }: { metric: RatioMetric; showRegime?: boolean; portfolioLink?: string; aiBadge?: React.ReactNode }) {
  return (
    <div className="space-y-3 py-3 border-b border-white/5 last:border-b-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-sm text-white/90">{metric.name}</div>
            {portfolioLink && (
              <a href={portfolioLink} target="_blank" rel="noopener noreferrer" 
                 className="text-[10px] text-[#00ff88] hover:text-[#00ff88]/80 opacity-60 hover:opacity-100 transition-all"
                 title="View portfolio holdings">
                ↗
              </a>
            )}
          </div>
          <div className="font-mono text-[10px] font-bold text-[#ffffff]">{metric.description}</div>
        </div>
        {aiBadge || <SignalBadge signal={metric.signal} />}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-lg text-[#00ff88]">
          {metric.current.toFixed(4)}
        </div>
        {showRegime && metric.regime && (
          <div className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-sm ${
            metric.regime.includes('RISK ON') || metric.regime.includes('REFLATION') 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {metric.regime}
          </div>
        )}
      </div>
      <FractalMomentumArray 
        momentum5D={metric.momentum5D} 
        momentum21D={metric.momentum21D} 
        momentum79D={metric.momentum79D} 
      />
    </div>
  );
}

export default function RatioRelevance() {
  const [data, setData] = useState<RatioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiSignals, setAiSignals] = useState<ModuleSignals>({});
  const [aiLoading, setAiLoading] = useState(true);

  useDocumentMeta({
    title: "Sectors",
    description: "Intermarket ratio analysis: liquidity constraints and sector rotation across the market.",
  });

  const handleAISignalsReady = useCallback((signals: ModuleSignals, isLoading: boolean) => {
    setAiSignals(signals);
    setAiLoading(isLoading);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ratio-relevance');
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch data');
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('[Ratio Relevance] Error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const freshness = data?.freshness;
  const marketDataStatus = error
    ? freshness
      ? {
          text: `Market data: LAST VERIFIED • ${freshness.marketDate} • REFRESH FAILED`,
          tone: 'caution',
        }
      : { text: 'Market data: UNAVAILABLE', tone: 'caution' }
    : loading
      ? freshness
        ? {
            text: `Market data: REFRESHING • LAST VERIFIED • ${freshness.marketDate}`,
            tone: 'muted',
          }
        : { text: 'Market data: LOADING', tone: 'muted' }
      : freshness
        ? {
            text: `Market data: ${freshness.state === 'stale' ? 'STALE' : freshness.state.toUpperCase()} • ${freshness.marketDate}`,
            tone: freshness.state === 'stale' ? 'caution' : 'muted',
          }
        : { text: 'Market data: UNAVAILABLE', tone: 'caution' };

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/">
              <button className="flex items-center gap-2 text-white/50 hover:text-[#00ff88] transition-colors font-mono text-xs" data-testid="link-back-home">
                <ArrowLeft className="w-4 h-4" />
                BACK
              </button>
            </Link>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              {/* Same type as the BeamHeading page titles (alerts, lab); drawn at once, no wipe. */}
              <h1 className="beam-heading mb-2" data-drawn="1" data-testid="text-page-title">
                RATIO RELEVANCE
              </h1>
            </div>
            
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <span
                role="status"
                aria-live="polite"
                aria-label={error
                  ? data
                    ? `Market data: LAST VERIFIED • ${data.freshness.marketDate} • REFRESH FAILED`
                    : 'Market data: UNAVAILABLE'
                  : marketDataStatus.text}
                className={`font-mono text-xs ${marketDataStatus.tone === 'caution' ? 'text-amber-300' : 'text-white/70'}`}
                data-testid="text-market-data-status"
              >
                {marketDataStatus.text}
              </span>
            </div>
          </div>

          <SectorToolsMenu current="ratio-relevance" />

          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-[#00ff88] animate-spin mb-4" />
              <p className="font-mono text-sm text-white/50">Analyzing intermarket relationships...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-sm p-6 mb-8">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <div>
                  <h3 className="font-mono text-red-400 font-bold">Error Loading Data</h3>
                  <p className="font-mono text-sm text-red-400/70">{error}</p>
                </div>
              </div>
            </div>
          )}

          {data && data.modules && (
            <>
              {/* KINE AI Capital Flow Analysis Terminal */}
              <div className="mb-6">
                <RatioRelevanceTerminal
                  ratioData={{
                    asOf: data.asOf,
                    tradingDays: data.tradingDays,
                    modules: data.modules
                  }}
                  autoStart={true}
                  onSignalsReady={handleAISignalsReady}
                />
              </div>
              
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              
              <ModuleCard 
                title="01 :: THE WRECKING BALL" 
                variant={aiSignals.wreckingBallStress === 'MAXIMUM_STRESS' ? 'danger' : 'default'}
                icon={<AlertTriangle className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  <div className="bg-black/40 border border-white/10 rounded-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-white/60">Liquidity Stress Level</span>
                      <AIStressBadge signal={aiSignals.wreckingBallStress} isLoading={aiLoading} />
                    </div>
                    <div className="font-mono text-[10px] text-white/40">
                      When USD rises AND yields rise → Maximum liquidity stress
                    </div>
                  </div>
                  
                  <RatioRow 
                    metric={data.modules.wreckingBall.dollarYield}
                    aiBadge={aiLoading || aiSignals.dollarYieldTrend ? <AITrendBadge signal={aiSignals.dollarYieldTrend} isLoading={aiLoading} /> : undefined}
                  />
                  
                  {data.modules.wreckingBall.dollarYield.timeSeries && (
                    <RatioWaveChart 
                      data={data.modules.wreckingBall.dollarYield.timeSeries}
                      mean={data.modules.wreckingBall.dollarYield.mean || 0}
                      title="UUP/IEF DOLLAR-YIELD RATIO (3 YEARS)"
                      ratioLabel="UUP/IEF"
                      highLabel="Stress"
                      lowLabel="Easing"
                      highColor="#ef4444"
                      lowColor="#10b981"
                      strokeColor="#ff6b6b"
                      highTooltip="↑ Above Mean (Dollar + Yields Rising)"
                      lowTooltip="↓ Below Mean (Liquidity Easing)"
                      gradientId="dollarYieldGradient"
                    />
                  )}
                  
                  <RatioRow 
                    metric={data.modules.wreckingBall.banksVsBonds}
                    aiBadge={aiLoading || aiSignals.banksVsBondsTrend ? <AITrendBadge signal={aiSignals.banksVsBondsTrend} isLoading={aiLoading} /> : undefined}
                  />
                  
                  {data.modules.wreckingBall.banksVsBonds.timeSeries && (
                    <RatioWaveChart 
                      data={data.modules.wreckingBall.banksVsBonds.timeSeries}
                      mean={data.modules.wreckingBall.banksVsBonds.mean || 0}
                      title="KRE/TLT BANKS VS BONDS (3 YEARS)"
                      ratioLabel="KRE/TLT"
                      highLabel="Banks Lead"
                      lowLabel="Safety Bid"
                      highColor="#f59e0b"
                      lowColor="#3b82f6"
                      strokeColor="#fbbf24"
                      highTooltip="↑ Above Mean (Risk Appetite / Banks Outperforming)"
                      lowTooltip="↓ Below Mean (Flight to Safety / Bonds)"
                      gradientId="banksVsBondsGradient"
                    />
                  )}
                </div>
              </ModuleCard>

              <ModuleCard 
                title="02 :: THE ROTATION" 
                variant={aiSignals.growthVsValue === 'GROWTH_LEADS' ? 'success' : aiSignals.growthVsValue === 'VALUE_LEADS' ? 'warning' : 'default'}
                icon={<TrendingUp className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  <div className="bg-black/40 border border-white/10 rounded-sm p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white/60">Style Leadership</span>
                      <AIStyleBadge signal={aiSignals.growthVsValue} isLoading={aiLoading} />
                    </div>
                  </div>
                  
                  <RatioRow 
                    metric={data.modules.rotation.growthVsValue} 
                    showRegime
                    aiBadge={aiLoading || aiSignals.growthVsValue ? <AIStyleBadge signal={aiSignals.growthVsValue} isLoading={aiLoading} /> : undefined}
                  />
                  
                  {data.modules.rotation.growthVsValue.timeSeries && (
                    <RatioWaveChart 
                      data={data.modules.rotation.growthVsValue.timeSeries}
                      mean={data.modules.rotation.growthVsValue.mean || 0}
                      title="IVW/IVE GROWTH VS VALUE (3 YEARS)"
                      ratioLabel="IVW/IVE"
                      highLabel="Growth"
                      lowLabel="Value"
                      highColor="#8b5cf6"
                      lowColor="#f97316"
                      strokeColor="#a855f7"
                      highTooltip="↑ Above Mean (Growth Outperforming)"
                      lowTooltip="↓ Below Mean (Value Rotation)"
                      gradientId="growthValueGradient"
                    />
                  )}
                  
                  <RatioRow 
                    metric={data.modules.rotation.consumerHealth}
                    aiBadge={aiLoading || aiSignals.consumerHealth ? <AIConsumerBadge signal={aiSignals.consumerHealth} isLoading={aiLoading} /> : undefined}
                  />
                  
                  {data.modules.rotation.consumerHealth.timeSeries && (
                    <RatioWaveChart 
                      data={data.modules.rotation.consumerHealth.timeSeries}
                      mean={data.modules.rotation.consumerHealth.mean || 0}
                      title="XLY/XLP CONSUMER HEALTH (3 YEARS)"
                      ratioLabel="XLY/XLP"
                      highLabel="Discretionary"
                      lowLabel="Staples"
                      highColor="#10b981"
                      lowColor="#ef4444"
                      strokeColor="#34d399"
                      highTooltip="↑ Above Mean (Consumer Confidence)"
                      lowTooltip="↓ Below Mean (Defensive Positioning)"
                      gradientId="consumerHealthGradient"
                    />
                  )}
                </div>
              </ModuleCard>

              <ModuleCard 
                title="03 :: INFLATION VS DEFLATION" 
                variant={aiSignals.inflationDeflation === 'INFLATIONARY' ? 'warning' : 'default'}
                icon={<Activity className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  <div className="bg-black/40 border border-white/10 rounded-sm p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white/60">Current Regime</span>
                      <AIInflationBadge signal={aiSignals.inflationDeflation} isLoading={aiLoading} />
                    </div>
                  </div>
                  
                  <RatioRow 
                    metric={data.modules.inflationDeflation.thingsVsPaper} 
                    showRegime 
                    portfolioLink="https://www.invesco.com/us/en/financial-products/etfs/invesco-db-commodity-index-tracking-fund.html#Portfolio"
                    aiBadge={aiLoading || aiSignals.inflationDeflation ? <AIInflationBadge signal={aiSignals.inflationDeflation} isLoading={aiLoading} /> : undefined}
                  />
                  
                  {data.modules.inflationDeflation.thingsVsPaper.timeSeries && (
                    <RatioWaveChart 
                      data={data.modules.inflationDeflation.thingsVsPaper.timeSeries}
                      mean={data.modules.inflationDeflation.thingsVsPaper.mean || 0}
                      title="DBC/TLT RATIO CYCLE (3 YEARS)"
                      ratioLabel="DBC/TLT"
                      highLabel="Reflation"
                      lowLabel="Deflation"
                      highColor="#f59e0b"
                      lowColor="#3b82f6"
                      strokeColor="#00ff88"
                      highTooltip="↑ Above Mean (Reflation)"
                      lowTooltip="↓ Below Mean (Deflation)"
                      gradientId="inflationGradient"
                    />
                  )}
                  
                  <RatioRow 
                    metric={data.modules.inflationDeflation.ecoHealth} 
                    showRegime
                    aiBadge={aiLoading || aiSignals.inflationDeflation ? <AIInflationBadge signal={aiSignals.inflationDeflation} isLoading={aiLoading} /> : undefined}
                  />
                  
                  <RatioRow 
                    metric={data.modules.inflationDeflation.capitalFlight} 
                    showRegime
                    aiBadge={aiLoading || aiSignals.goldSpx ? <AIGoldBadge signal={aiSignals.goldSpx} isLoading={aiLoading} /> : undefined}
                  />
                </div>
              </ModuleCard>

              <ModuleCard 
                title="04 :: GAMMA/VOL REGIME PROXY" 
                variant={data.modules.gammaVol.isStressed ? 'danger' : 'success'}
                icon={<Activity className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  <div className={`p-4 rounded-sm border ${
                    data.modules.gammaVol.isStressed 
                      ? 'bg-red-500/10 border-red-500/40' 
                      : 'bg-emerald-500/10 border-emerald-500/40'
                  }`}>
                    <div className="font-mono text-xs text-white/60 mb-2">Vol Term Structure</div>
                    <div className={`font-mono text-lg font-bold uppercase ${
                      data.modules.gammaVol.isStressed ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {data.modules.gammaVol.regime}
                    </div>
                    <div className="font-mono text-[10px] text-white/40 mt-2">
                      {data.modules.gammaVol.isStressed 
                        ? 'Short-term vol > Mid-term vol → Stress/Fear' 
                        : 'Normal contango → Market stable'}
                    </div>
                  </div>
                  
                  <RatioRow metric={data.modules.gammaVol} />
                </div>
              </ModuleCard>

              <ModuleCard 
                title="05 :: PRICE OUTLIER SCANNER"
                variant="warning"
                icon={<AlertTriangle className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-red-500/10 border border-purple-500/30 rounded-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-mono text-[10px] font-bold text-[#ffffff]">WIDEST PRICE SWING (vs {data.modules.outlierScanner.rollingWindow}D AVG)</div>
                      {data.modules.outlierScanner.outlier.isUnusual && (
                        <span className="font-mono text-[9px] px-1.5 py-0.5 bg-red-500/30 border border-red-500/50 text-red-400 rounded-sm animate-pulse">
                          ⚠ UNUSUAL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <GlitchText 
                          text={data.modules.outlierScanner.outlier.ticker} 
                          className="font-mono text-2xl font-bold text-purple-400"
                        />
                        <div className="font-mono text-xs text-white/50 mt-1">
                          {data.modules.outlierScanner.outlier.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-2xl font-bold text-pink-400">
                          {data.modules.outlierScanner.outlier.rangeRatio.toFixed(1)}×
                        </div>
                        <div className="font-mono text-[10px] text-white/40">
                          {data.modules.outlierScanner.outlier.todayRange.toFixed(2)}% vs {data.modules.outlierScanner.outlier.avgRange.toFixed(2)}% avg
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-[10px] text-white/40 mt-3 pt-2 border-t border-white/10">
                      Price only, not volume. Measures how far price traveled high to low today against its {data.modules.outlierScanner.rollingWindow}-day average travel. Direction ignored.
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] text-white/40 uppercase">Top 5 by Unusual Price Swing (Z-Score)</div>
                    {data.modules.outlierScanner.top5ByZ.map((item, idx) => (
                      <div key={item.ticker} className="flex items-center justify-between py-1 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white/30">{idx + 1}.</span>
                          <span className="font-mono text-xs text-white/80">{item.ticker}</span>
                          <span className="font-mono text-[10px] text-white/40">{item.name}</span>
                          {item.isUnusual && (
                            <span className="font-mono text-[8px] px-1 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-sm">
                              UNUSUAL
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-xs ${
                            item.rangeRatio >= 1.5 ? 'text-amber-400' : 'text-white/50'
                          }`}>
                            {item.rangeRatio.toFixed(1)}× avg
                          </span>
                          <span className={`font-mono text-xs w-14 text-right ${
                            idx === 0 ? 'text-purple-400 font-bold' : 'text-white/60'
                          }`}>
                            {item.todayRange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="font-mono text-[10px] text-white/40 uppercase">Top 5 by Largest Price Range Today</div>
                    {data.modules.outlierScanner.top5ByAbsolute.slice(0, 3).map((item, idx) => (
                      <div key={`abs-${item.ticker}`} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white/30">{idx + 1}.</span>
                          <span className="font-mono text-xs text-white/60">{item.ticker}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-white/40">
                            ({item.rangeRatio.toFixed(1)}× avg)
                          </span>
                          <span className="font-mono text-xs text-white/60">
                            {item.todayRange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ModuleCard>

              <div className="lg:col-span-1 md:col-span-2 bg-black/40 border border-white/10 rounded-sm p-4">
                <h3 className="font-mono text-xs text-white/40 uppercase mb-3">Data Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <div className="text-white/40">As Of</div>
                    <div className="text-white/80">{data.asOf}</div>
                  </div>
                  <div>
                    <div className="text-white/40">Trading Days</div>
                    <div className="text-white/80">{data.tradingDays}</div>
                  </div>
                  <div>
                    <div className="text-white/40">Data Source</div>
                    <div className="text-[#00ff88]">Tiingo API</div>
                  </div>
                  <div>
                    <div className="text-white/40">Refresh Rate</div>
                    <div className="text-white/80">On Demand</div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="font-mono text-[10px] text-white/30">
                    ETF Proxies: UUP, IEF, TLT, IVW, IVE, XLY, XLP, DBC, CPER, GLD, SPY, VIXY, VXZ, KRE, VXX
                  </div>
                </div>
              </div>

            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
