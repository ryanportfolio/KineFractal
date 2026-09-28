import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LegalFooter } from "@/components/legal-footer";
import strategyChartBg from "@assets/tradingview_chart.png";
import { 
  Activity, 
  AlertTriangle, 
  Zap, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown,
  Target,
  Gauge,
  ArrowUpDown,
  Flame,
  Shield,
  BarChart3,
  Terminal,
  Crosshair,
  Eye,
  Diamond,
  Clock,
  XCircle,
  CheckCircle,
  Info,
  Settings,
  Cpu,
  Database,
  AlertOctagon
} from "lucide-react";

const REGIMES = [
  {
    name: "POWER_TREND",
    condition: "VEL > 0 AND ACC > 0",
    dashboardColor: "bg-lime-500",
    colorLabel: "Lime",
    buyBehavior: "Max Aggression. Buys dips heavily.",
    sellBehavior: "Shorts are limited to scalps (0.5%).",
    description: "The market is accelerating upward. Maximum accumulation mode.",
    velColor: "text-lime-400",
    accColor: "text-lime-400",
    status: "LONG_BIAS"
  },
  {
    name: "DECELERATION",
    condition: "VEL > 0 BUT ACC < 0",
    dashboardColor: "bg-orange-500",
    colorLabel: "Orange",
    buyBehavior: "Standard position sizing.",
    sellBehavior: "Caution. The car is moving forward but coasting.",
    description: "Uptrend losing momentum. Reduce exposure, standard sizing.",
    velColor: "text-lime-400",
    accColor: "text-orange-500",
    status: "CAUTION"
  },
  {
    name: "BEARISH",
    condition: "VEL < 0",
    dashboardColor: "bg-red-500",
    colorLabel: "Red",
    buyBehavior: "Longs are reduced or filtered.",
    sellBehavior: "Shorts are prioritized.",
    description: "Defensive. Downtrend active with negative velocity.",
    velColor: "text-red-500",
    accColor: "text-muted-foreground",
    status: "SHORT_BIAS"
  },
  {
    name: "LIQUIDATION",
    condition: "VEL < 0 AND ACC < 0 + High Vol",
    dashboardColor: "bg-orange-700",
    colorLabel: "Dark Orange",
    buyBehavior: "No Longs. This is a falling knife.",
    sellBehavior: "Only 'Gap Cover' logic is active.",
    description: "Panic selling with accelerating decline. Stay defensive.",
    velColor: "text-red-500",
    accColor: "text-red-500",
    status: "MAX_SHORT"
  },
  {
    name: "CRASH (OMEN)",
    condition: "Hindenburg Signal + VEL < 0",
    dashboardColor: "bg-red-900",
    colorLabel: "Dark Red",
    buyBehavior: "Short Only.",
    sellBehavior: "Aggressive short sizing (Hindenburg allocation).",
    description: "Breadth collapse detected. Aggressive short positioning.",
    velColor: "text-red-700",
    accColor: "text-red-700",
    status: "SURVIVAL"
  }
];

const LONG_SIGNALS = [
  { icon: "▲", color: "text-lime-400", label: "Standard Divergence", description: "Price made a lower low, but RSI/PPO made a higher low." },
  { icon: "▲", color: "text-teal-400", label: "DEMAND Zone", description: "Price touched a memory-stored Demand Zone and reacted." },
  { icon: "◆", color: "text-yellow-400", label: "Confluence (×2)", description: "Multiple signals fired on same bar. Size boosted by 1.3x." },
  { icon: "●", color: "text-blue-400", label: "Trap Recovery", description: "Previously flagged trap reclaimed within recovery window." }
];

const SHORT_SIGNALS = [
  { icon: "▼", color: "text-red-500", label: "Bearish Divergence", description: "Standard bearish divergence or trend breakdown." },
  { icon: "▼", color: "text-purple-500", label: "HTF Lumina", description: "Divergence on Daily/Weekly timeframe. Major resistance." },
  { icon: "⬇", color: "text-orange-500", label: "GAP Extension", description: "Gap up, waited, rallied further, now fading. High probability." },
  { icon: "❌", color: "text-orange-500", label: "Blow-Off Top", description: "Volume is 3-sigma event while price extended. Climax top." }
];

const DEFENSIVE_MARKERS = [
  { icon: "❌", color: "text-slate-400", label: "Bull Trap", description: "Buy signal blocked by Regime Filter (Liquidation/Crash mode)." },
  { icon: "⚠️", color: "text-orange-400", label: "Short Entry", description: "Alerts that the strategy has flipped net short." }
];

const DASHBOARD_ROWS = [
  { label: "Market Regime", example: "LIQUIDATION (Vol)", interpretation: "Volatility is > 2 standard deviations above mean. Do not buy breakouts." },
  { label: "Action", example: "SELLING 7.0% (OMEN)", interpretation: "Strategy is actively shorting 7% of equity due to Hindenburg signal." },
  { label: "Win Rate", example: "62.5%", interpretation: "High win rate implies mean reversion is working." },
  { label: "Vol Confluence", example: "8/9 (Extreme)", interpretation: "Climax Alert. Price is likely at a local top/bottom. 9/9 is a 'Blow-off'." }
];

const RISK_PROFILES = [
  {
    name: "Steamroller Risk",
    scenario: "A powerful news-driven rally (e.g., Fed announcement) ignores technicals.",
    defense: "Strategy uses allow_power_blowoff = false. It will NOT short a Blow-off top if Regime is 'Power Trend', preventing shorting strong momentum."
  },
  {
    name: "Gap Fill Failure",
    scenario: "Price Gaps up and just keeps going (Trend Day).",
    defense: "Strategy waits for trig_gap_extension. It does not short the open immediately unless trig_gap_immediate is enabled. Requires price to stall."
  },
  {
    name: "Data Latency",
    scenario: "Hindenburg Omen relies on Daily data (request.security(..., 'D')).",
    defense: "On a 2H chart, data updates once per day. 'Crash' regime might lag by one session but protects against multi-week bear markets."
  }
];

const CONFIG_GUIDE = {
  keyInputs: [
    { key: "Buy: Aggressive (%)", value: "25%", description: "Max conviction size. Used only when 'Institutional Confluence' is present." },
    { key: "Max Total Short Alloc (%)", value: "95%", description: "Safety valve. If long-only fund, set this to 0%." },
    { key: "Filter Traps?", value: "ON", description: "Keep ON. Filters out 'oversold' signals during crashes." },
    { key: "Min Order Value ($)", value: "$50", description: "Set slightly above broker's minimum order size." }
  ]
};

export default function StrategyDiamond() {
  const [activeRegime, setActiveRegime] = useState(0);
  const [scanlinePos, setScanlinePos] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setScanlinePos(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const regimeInterval = setInterval(() => {
      setActiveRegime(prev => (prev + 1) % REGIMES.length);
    }, 4000);
    return () => clearInterval(regimeInterval);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff0008_1px,transparent_1px),linear-gradient(to_bottom,#00ff0008_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />
        
        <div className="matrix-scan-line" style={{ top: `${scanlinePos}%` }} />
        
        <div className="container relative z-10 pt-24 pb-16 px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4 font-mono flex-wrap">
              <span className="text-[12px] text-primary/60 uppercase tracking-widest">VERSION</span>
              <span className="text-[12px] text-primary font-bold">6.0 (Hardened)</span>
              <span className="text-[12px] text-white/20">|</span>
              <span className="text-[12px] text-blue-400 uppercase tracking-widest">2H PRIMARY</span>
              <span className="text-[12px] text-white/20">|</span>
              <span className="text-[12px] text-accent uppercase tracking-widest">HIGH ALPHA</span>
            </div>

            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 font-display leading-[0.85]">
              <span className="diamond-crystallize" data-text="DIVERGENCE">DIVERGENCE</span>
              <span className="block text-stroke-primary">ACCUMULATOR</span>
            </h1>

            <div className="border-l-2 border-primary pl-4 mb-8 max-w-3xl">
              <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-2">
                <span className="text-primary">{"//"}</span> THE INSTITUTIONAL ARCHITECT'S GUIDE
              </p>
              <p className="font-mono text-base text-white/80 leading-relaxed">
                <span className="text-blue-400">Architecture:</span> Hybrid Mean-Reversion / Regime-Filtered Trend Following<br/>
                <span className="text-blue-400">Timeframe:</span> 2H (Primary) with Daily/Weekly Overlay
              </p>
            </div>

            <div className="flex flex-wrap gap-3 font-mono text-sm">
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 px-3 py-2">
                <Cpu className="w-3 h-3 text-primary" />
                <span className="text-primary">STATE_MACHINE</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 px-3 py-2">
                <Activity className="w-3 h-3 text-blue-400" />
                <span className="text-blue-400">PHYSICS_ENGINE</span>
              </div>
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-2">
                <ShieldAlert className="w-3 h-3 text-red-500" />
                <span className="text-red-400">SHORTING_ACTIVE</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <div className="container px-4 md:px-6 py-12 space-y-16">
        
        <section className="border-b border-white/10 bg-black py-0">
          <div className="container px-4 md:px-6 py-0">
            <div className="mb-1 flex items-center justify-between">
              <div className="font-mono text-sm text-primary uppercase tracking-widest">
                &gt; HISTORICAL_DATA_LOGS [2010-2025]
              </div>
              <div className="font-mono text-sm text-muted-foreground">
                SOURCE: TRADINGVIEW_BACKTEST_V6
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="mb-0"
            >
              <div className="relative border border-primary/30 bg-black p-0 group overflow-hidden perf-report-glow">
                <style>{`
                  @keyframes perf-report-pulse {
                    0%, 100% {
                      box-shadow: 0 0 20px hsl(var(--primary) / 0.2), inset 0 0 15px hsl(var(--primary) / 0.05);
                      border-color: hsl(var(--primary) / 0.3);
                    }
                    50% {
                      box-shadow: 0 0 40px hsl(var(--primary) / 0.5), 0 0 60px hsl(var(--primary) / 0.2), inset 0 0 25px hsl(var(--primary) / 0.15);
                      border-color: hsl(var(--primary) / 0.7);
                    }
                  }
                  .perf-report-glow {
                    animation: perf-report-pulse 3s ease-in-out infinite;
                  }
                `}</style>

                {/* CRT Screen Effects */}
                <div className="absolute inset-0 pointer-events-none z-20 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)]" />
                <div className="absolute inset-0 pointer-events-none z-20 opacity-10 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{backgroundSize: "100% 2px, 3px 100%"}} />

                {/* Asset Label */}
                <div className="absolute top-4 right-4 z-30 bg-black/80 backdrop-blur border border-primary/50 px-3 py-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-xs font-bold text-primary">DIVERGENCE ACCUMULATOR</span>
                </div>

                {/* Image Container with Filters */}
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-10" />
                  <img 
                    src={strategyChartBg} 
                    alt="Strategy execution showing institutional confluence signals and regime-based positioning"
                    className="w-full h-auto opacity-90 grayscale-[30%] contrast-125 brightness-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                    data-testid="image-strategy-chart"
                  />
                </div>

                {/* Technical Overlays */}
                <div className="absolute top-4 left-4 z-30 font-mono text-[10px] text-primary/50">
                  <div>&gt; SIGNAL_ANALYSIS</div>
                  <div>&gt; INTEGRITY: 100%</div>
                </div>

                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/50" />
                <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/50" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/50" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/50" />
              </div>
            </motion.div>
          </div>
        </section>
        
        <section className="bg-black/50 border border-white/10 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6 font-mono">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary uppercase tracking-widest">EXECUTIVE_SUMMARY</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-l-2 border-primary pl-4">
              <h3 className="font-mono text-lg font-bold text-primary mb-3">LONG THESIS</h3>
              <p className="text-white/70 font-mono text-sm leading-relaxed">
                Markets are mean-reverting in the short term but trend-following in the long term. 
                We accumulate size when momentum diverges from price (RSI/PPO) + at 
                institutional <span className="text-teal-400">Demand Zones</span>.
              </p>
            </div>
            <div className="border-l-2 border-red-500 pl-4">
              <h3 className="font-mono text-lg font-bold text-red-400 mb-3">SHORT THESIS</h3>
              <p className="text-white/70 font-mono text-sm leading-relaxed">
                Strategy sells and can short structural breakdowns identified by internal market breadth (ADVN/DECL) and volatility (VIX), and has customizeable "Fade" inputs for <span className="text-orange-400">Gap Ups/Blow-off Tops</span>.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="font-mono text-sm text-white/50">
              <span className="text-accent">{"// "}</span>
              This is a state-machine based algorithm that adjusts behavior based on Velocity, Acceleration and Macro Breadth.
            </p>
          </div>
        </section>

        <section className="relative">
          <div className="absolute inset-0 border border-white/5" />
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary/50" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary/50" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary/50" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary/50" />
          
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 font-mono">
              <Gauge className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary uppercase tracking-widest">THE_PHYSICS_ENGINE</span>
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-white/60">[REGIME_FILTER]</span>
            </div>

            <p className="font-mono text-sm text-white/60 mb-6 border-l border-white/20 pl-3">
              The strategy runs a background calculation (f_calc_context) that acts as a filter for all trade signals. 
              It treats price action like a physical object moving through space.
            </p>

            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-2">
                {REGIMES.map((regime, idx) => (
                  <motion.div
                    key={regime.name}
                    onClick={() => setActiveRegime(idx)}
                    className={`relative p-4 border cursor-pointer transition-all duration-300 ${
                      activeRegime === idx 
                        ? 'bg-black border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.1)]'
                        : 'bg-black/50 border-white/10 hover:border-white/20'
                    }`}
                    data-testid={`regime-card-${idx}`}
                  >
                    {activeRegime === idx && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${regime.dashboardColor}`} />
                        <span className={`font-mono text-base font-bold ${activeRegime === idx ? 'text-primary' : 'text-white'}`}>
                          {regime.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-white/50">{regime.colorLabel}</span>
                    </div>
                    <div className="font-mono text-[12px] text-white/70">{regime.condition}</div>
                  </motion.div>
                ))}
              </div>

              <div className="lg:col-span-7">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeRegime}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    <div className="bg-black border border-white/10 h-full relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff0008_1px,transparent_1px),linear-gradient(to_bottom,#00ff0008_1px,transparent_1px)] bg-[size:20px_20px] opacity-50" />
                      <div className="crt-scanlines opacity-30" />
                      
                      <div className="relative z-10 p-6">
                        <div className="font-mono text-[12px] text-white/70 mb-4 flex justify-between">
                          <span>REGIME_DETAIL</span>
                          <span className={REGIMES[activeRegime].status === "LONG_BIAS" ? "text-lime-400" : 
                                           REGIMES[activeRegime].status === "SHORT_BIAS" || REGIMES[activeRegime].status === "MAX_SHORT" ? "text-red-400" : 
                                           REGIMES[activeRegime].status === "SURVIVAL" ? "text-red-600" : "text-orange-400"}>
                            [{REGIMES[activeRegime].status}]
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-4 h-4 rounded-sm ${REGIMES[activeRegime].dashboardColor}`} />
                          <div className="text-3xl font-bold font-mono text-primary tracking-tighter">
                            {REGIMES[activeRegime].name}
                          </div>
                        </div>

                        <p className="font-mono text-sm text-white/60 mb-6 border-l border-white/20 pl-3">
                          {REGIMES[activeRegime].description}
                        </p>

                        <div className="space-y-4">
                          <div className="bg-primary/5 border border-primary/20 p-4">
                            <div className="font-mono text-[12px] text-primary/60 mb-2">ACCUMULATION_BEHAVIOR</div>
                            <div className="font-mono text-sm text-white/80">{REGIMES[activeRegime].buyBehavior}</div>
                          </div>
                          <div className="bg-red-500/5 border border-red-500/20 p-4">
                            <div className="font-mono text-[12px] text-red-400/60 mb-2">DISTRIBUTION_BEHAVIOR</div>
                            <div className="font-mono text-sm text-white/80">{REGIMES[activeRegime].sellBehavior}</div>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/10">
                          <div className="grid grid-cols-2 gap-4 font-mono text-[12px]">
                            <div className="flex items-center justify-between">
                              <span className="text-white/70">VELOCITY</span>
                              <span className={REGIMES[activeRegime].velColor}>
                                {REGIMES[activeRegime].condition.includes("VEL > 0") ? "POSITIVE" : "NEGATIVE"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-white/70">ACCELERATION</span>
                              <span className={REGIMES[activeRegime].accColor}>
                                {REGIMES[activeRegime].condition.includes("ACC > 0") ? "POSITIVE" : 
                                 REGIMES[activeRegime].condition.includes("ACC < 0") ? "NEGATIVE" : "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6 font-mono">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary uppercase tracking-widest">SIGNAL_LEGEND</span>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/60">[VISUAL_TELEMETRY]</span>
          </div>

          <p className="font-mono text-sm text-white/60 mb-6 border-l border-white/20 pl-3">The chart plots specific icons based on the logic trigger:</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-black border border-primary/20 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="font-mono text-base font-bold text-primary uppercase tracking-wider">LONG_SIGNALS</span>
              </div>
              <div className="space-y-4">
                {LONG_SIGNALS.map((signal, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className={`text-xl ${signal.color}`}>{signal.icon}</span>
                    <div>
                      <div className={`font-mono text-sm font-bold ${signal.color}`}>{signal.label}</div>
                      <div className="font-mono text-[11px] text-white/60">{signal.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black border border-red-500/20 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <span className="font-mono text-base font-bold text-red-400 uppercase tracking-wider">SELL/SHORT_SIGNALS</span>
              </div>
              <div className="space-y-4">
                {SHORT_SIGNALS.map((signal, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className={`text-xl ${signal.color}`}>{signal.icon}</span>
                    <div>
                      <div className={`font-mono text-sm font-bold ${signal.color}`}>{signal.label}</div>
                      <div className="font-mono text-[11px] text-white/60">{signal.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black border border-white/10 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-gray-400" />
                <span className="font-mono text-base font-bold text-gray-400 uppercase tracking-wider">DEFENSIVE</span>
              </div>
              <div className="space-y-4">
                {DEFENSIVE_MARKERS.map((marker, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    {idx === 0 ? (
                      <XCircle className={`w-5 h-5 flex-shrink-0 mt-1 ${marker.color}`} />
                    ) : (
                      <span className={`text-xl ${marker.color}`}>{marker.icon}</span>
                    )}
                    <div>
                      <div className={`font-mono text-sm font-bold ${marker.color}`}>{marker.label}</div>
                      <div className="font-mono text-[11px] text-white/60">{marker.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="font-mono text-[11px] text-white/50">
                  {"// "} Trap filter separates this algo from basic RSI strategies
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border border-primary/30 bg-black p-8 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff0005_1px,transparent_1px),linear-gradient(to_bottom,#00ff0005_1px,transparent_1px)] bg-[size:20px_20px]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 font-mono">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary uppercase tracking-widest">DEPLOYMENT_READY</span>
              </div>
              <p className="text-base text-white/60 max-w-lg font-mono">
                Review full playbook before enabling shorts. Understand bi-directional risks and regime filtering.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/indicator/divergence">
                <button 
                  className="px-6 py-3 bg-primary text-black font-mono font-bold text-sm uppercase tracking-wider hover:bg-primary/90 transition-colors"
                  data-testid="button-view-playbook"
                >
                  &gt; VIEW_PLAYBOOK
                </button>
              </Link>
              <Link href="/indicator-library">
                <button 
                  className="px-6 py-3 border border-white/20 font-mono font-bold text-sm uppercase tracking-wider hover:bg-white/5 transition-colors"
                  data-testid="button-indicator-library"
                >
                  &gt; INDICATORS
                </button>
              </Link>
            </div>
          </div>
        </section>

      </div>
      <LegalFooter />
    </div>
  );
}
