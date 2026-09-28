import { useState, useMemo, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Zap,
  Gauge,
  Info,
  Check,
  CheckSquare,
  Layers,
  RefreshCw
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";
import { Link } from "wouter";
import { PlaybookCTA } from "@/components/playbook-cta";

// --- TYPES ---

type RiskRegime = "INVEST" | "CHOP" | "WARN" | "CRASH_WARNING";

interface RiskMetrics {
  vix: number;
  vvix: number;
  skew: number;
  creditRatio: "SUPPORTIVE" | "DETERIORATING";
  trend: "UPTREND" | "DOWNTREND";
  context?: string;
}

interface CalculatedRisk {
  fragilityScore: number;
  skewScore: number;
  hedgeScore: number;
  creditScore: number;
  totalScore: number;
  label: string;
  color: string;
  regimeLabel: string;
  regimeColor: string;
  regimeBg: string;
}

// --- CONSTANTS ---

const SCENARIOS: Record<RiskRegime, RiskMetrics[]> = {
  INVEST: [
    { vix: 13.5, vvix: 85, skew: 130, creditRatio: "SUPPORTIVE", trend: "UPTREND" },
    { vix: 15.2, vvix: 88, skew: 125, creditRatio: "SUPPORTIVE", trend: "UPTREND" },
    { vix: 17.8, vvix: 92, skew: 132, creditRatio: "SUPPORTIVE", trend: "UPTREND" },
  ],
  CHOP: [
    { vix: 24.0, vvix: 110, skew: 140, creditRatio: "SUPPORTIVE", trend: "UPTREND" },
    { vix: 21.5, vvix: 105, skew: 138, creditRatio: "SUPPORTIVE", trend: "DOWNTREND" },
    { vix: 28.2, vvix: 115, skew: 142, creditRatio: "SUPPORTIVE", trend: "UPTREND" },
  ],
  WARN: [
    { 
      vix: 38.0, 
      vvix: 290, 
      skew: 160, 
      creditRatio: "DETERIORATING", 
      trend: "DOWNTREND",
      context: "Active crisis. Everything is flashing red. Stay out or short only."
    }, // Panic Selling (Crash Warning)
    { 
      vix: 35.0, 
      vvix: 150, 
      skew: 120, 
      creditRatio: "SUPPORTIVE", 
      trend: "DOWNTREND",
      context: "VIX spiked but leading indicators have reset. Smart money stopped hedging. This is often a buying opportunity despite the scary WARN regime."
    },    // Capitulation Bottom (Safe)
    { 
      vix: 32.0, 
      vvix: 250, 
      skew: 145, 
      creditRatio: "SUPPORTIVE", 
      trend: "DOWNTREND",
      context: "Event-driven spike (war, election shock, Fed surprise). Credit hasn't cracked yet, watching to see if it spreads."
    },    // Geopolitical Shock (Caution)
  ],
  CRASH_WARNING: [
    { 
      vix: 11.5, 
      vvix: 120, 
      skew: 160, 
      creditRatio: "DETERIORATING", 
      trend: "UPTREND",
      context: "The 'Silent Killer'. Market is at all-time highs (Low VIX), but credit is cracking and tail hedging is extreme. This precedes major crashes." 
    }, // Silent Killer
    { 
      vix: 65.0, 
      vvix: 200, 
      skew: 170, 
      creditRatio: "DETERIORATING", 
      trend: "DOWNTREND",
      context: "Full Meltdown. The crash has happened. Liquidity event. Cash is King." 
    }, // Full Meltdown
    { 
      vix: 10.8, 
      vvix: 125, 
      skew: 165, 
      creditRatio: "DETERIORATING", 
      trend: "UPTREND",
      context: "Extreme Fragility. Similar to 2018 Volmageddon setup. One spark will ignite the leverage pile." 
    }, // Extreme Fragility
  ]
};

const REGIMES: Record<RiskRegime, { label: string; description: string; color: string }> = {
  INVEST: {
    label: "INVEST (Trend)",
    description: "VIX < 19. Markets trending. Low volatility. Green light for steady gains.",
    color: "text-green-500"
  },
  CHOP: {
    label: "CHOP (Vol)",
    description: "VIX 19-30. Trend following fails. Mean reversion environment. Take profits early.",
    color: "text-orange-500"
  },
  WARN: {
    label: "WARN (Defensive)",
    description: "VIX > 30. Panic mode. Correlations -> 1. Cash is a position.",
    color: "text-red-500"
  },
  CRASH_WARNING: {
    label: "CRASH PROTOCOL",
    description: "Systemic Failure Imminent. 4/4 Risk Pillars Flashing Red.",
    color: "text-red-600"
  }
};

// --- LOGIC ENGINE ---

const calculateRisk = (metrics: RiskMetrics): CalculatedRisk => {
  // 1. Fragility (Low VIX = High Leverage)
  let fragilityScore = 0;
  if (metrics.vix < 12) fragilityScore = 25;
  else if (metrics.vix < 14) fragilityScore = 15;
  else if (metrics.vix < 17) fragilityScore = 5;
  else if (metrics.vix > 22) fragilityScore = 5;

  // 2. Tail Risk (SKEW)
  let skewScore = 0;
  if (metrics.skew > 155) skewScore = 25;
  else if (metrics.skew > 145) skewScore = 15;
  else if (metrics.skew > 135) skewScore = 5;

  // 3. Hedging (VVIX/VIX Ratio - Simplified logic for mock)
  // In real script: compares ratio to SMA. Here we'll approximate based on VVIX level relative to VIX
  let hedgeScore = 0;
  const ratio = metrics.vvix / metrics.vix;
  if (ratio > 7.5) hedgeScore = 25; // High demand for VIX calls
  else if (ratio > 6.5) hedgeScore = 15;
  else if (ratio > 5.5) hedgeScore = 5;

  // 4. Credit Stress
  let creditScore = metrics.creditRatio === "DETERIORATING" ? 25 : 0;

  const totalScore = Math.min(100, fragilityScore + skewScore + hedgeScore + creditScore);

  let label = "SAFE";
  let color = "text-green-500";
  if (totalScore > 75) { label = "CRASH WARNING"; color = "text-red-600"; }
  else if (totalScore > 50) { label = "FRAGILE"; color = "text-orange-500"; }
  else if (totalScore > 25) { label = "CAUTION"; color = "text-yellow-500"; }

  // Regime Logic
  let regimeLabel = "INVEST (Trend)";
  let regimeColor = "text-green-400";
  let regimeBg = "bg-green-500/20";

  if (metrics.vix > 30) {
    regimeLabel = "WARN (Defensive)";
    regimeColor = "text-red-500";
    regimeBg = "bg-red-500/20";
  } else if (metrics.vix > 19) {
    regimeLabel = "CHOP (Vol)";
    regimeColor = "text-orange-400";
    regimeBg = "bg-orange-500/20";
  }

  // Override Regime Label for specific high-risk/crash scenarios if needed
  // But usually VIX dictates the 'Trading Regime' (style) while Score dictates 'Risk'
  // However, if Total Score > 75 (CRASH WARNING), we might want to force a label?
  // For now, we keep VIX as the regime driver as per playbook, but user noted a visual glitch.
  // "Vix regime on crash protocol says the wrong regime below"
  // If we are in CRASH_WARNING simulation, and VIX is low (Silent Killer), 
  // the regime is technically INVEST (low vol) but the RISK is CRASH.
  // This is the "Complacency Trap". So the display is actually CORRECT based on logic, 
  // but maybe confusing. 
  // We will add a "Regime Mismatch" indicator if Score is High but VIX is Low.

  return {
    fragilityScore,
    skewScore,
    hedgeScore,
    creditScore,
    totalScore,
    label,
    color,
    regimeLabel,
    regimeColor,
    regimeBg
  };
};

// --- COMPONENT ---

export default function IndicatorRiskDashboard() {
  const [activeRegime, setActiveRegime] = useState<RiskRegime>("INVEST");
  const [activeTab, setActiveTab] = useState<"CHART" | "PLAYBOOK">("CHART");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  // Reset scenario when regime changes
  useEffect(() => {
    setScenarioIndex(0);
    setIsSimulating(true);
    const timer = setTimeout(() => setIsSimulating(false), 500);
    return () => clearTimeout(timer);
  }, [activeRegime]);

  // Auto-cycle scenarios to show range of possibilities
  useEffect(() => {
    if (activeTab !== "CHART") return;
    
    const interval = setInterval(() => {
      setScenarioIndex(prev => (prev + 1) % SCENARIOS[activeRegime].length);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [activeRegime, activeTab]);

  const metrics = useMemo(() => {
    return SCENARIOS[activeRegime][scenarioIndex];
  }, [activeRegime, scenarioIndex]);

  const risk = calculateRisk(metrics);

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
              <span>RISK_DASHBOARD</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/50 rounded-none font-mono">
                v2.0
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">INSTITUTIONAL_RISK</span>
            </div>
            <pre className="text-primary font-mono text-xs md:text-sm leading-tight mb-4 overflow-x-auto">
{`█████████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█▀▄░▀█▀░█▀▀░█░█░░░█▀▄░█▀▀░█▀▀░▀█▀░█▄█░█▀▀░░░░░░░░█
█░░░░░░░░█▀▄░░█░░▀▀█░█▀▄░░░█▀▄░█▀▀░█░█░░█░░█░█░█▀▀░░░░░░░░█
█░░░░░░░░▀░▀░▀▀▀░▀▀▀░▀░▀░░░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████████████████`}
            </pre>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              The "Check Engine Light" for markets. Detects hidden leverage and credit stress before price reacts.
            </p>
          </div>

          <div className="flex gap-2">
             <Button 
               variant={activeTab === "CHART" ? "default" : "outline"}
               onClick={() => setActiveTab("CHART")}
               className="font-mono text-xs h-8"
             >
               <Activity className="w-3 h-3 mr-2" />
               SIM_DATA
             </Button>
             <Button 
               variant={activeTab === "PLAYBOOK" ? "default" : "outline"}
               onClick={() => setActiveTab("PLAYBOOK")}
               className="font-mono text-xs h-8"
             >
               <Info className="w-3 h-3 mr-2" />
               PLAYBOOK
             </Button>
             <Button className="bg-primary text-black hover:bg-primary/90 font-mono text-xs h-8 font-bold">
               GET_SCRIPT
             </Button>
          </div>
        </div>

        {activeTab === "CHART" ? (
          <div className="space-y-8">
            {/* Simulation Controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(REGIMES) as RiskRegime[]).map((regime) => (
                <button
                  key={regime}
                  onClick={() => setActiveRegime(regime)}
                  className={`
                    relative px-4 py-3 text-left border transition-all duration-300 group overflow-hidden
                    ${activeRegime === regime 
                      ? `border-${REGIMES[regime].color.split('-')[1]}-500/50 text-${REGIMES[regime].color.split('-')[1]}-500` 
                      : 'bg-card/50 border-border hover:border-white/20 text-muted-foreground hover:text-foreground'}
                  `}
                >
                  <div className="relative z-20">
                    <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">Simulate</div>
                    <div className="font-bold text-xs md:text-sm">{REGIMES[regime].label}</div>
                  </div>
                  {activeRegime === regime && (
                    <motion.div 
                      layoutId="active-regime-glow"
                      className={`absolute inset-0 bg-${REGIMES[regime].color.split('-')[1]}-500 z-0`}
                      style={{ opacity: 0.1 }}
                      initial={{ opacity: 0.1 }}
                      animate={{ opacity: 0.1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* THE DASHBOARD (Visualizing the Pine Script Table) */}
              <Card className="bg-black border-border p-1 overflow-hidden relative">
                <div className="absolute inset-0 bg-grid-white/5 pointer-events-none" />
                
                <div className="p-6 relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-muted-foreground" />
                      <span className="font-mono font-bold text-lg">RISK_MONITOR</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      LIVE_FEED
                      <span className="text-muted-foreground/50 mx-2">|</span>
                      <motion.div 
                        key={scenarioIndex}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1 text-primary"
                      >
                         <RefreshCw className="w-3 h-3 animate-spin" />
                         SCENARIO_{scenarioIndex + 1}
                      </motion.div>
                    </div>
                  </div>

                  {/* Top Row: VIX Regime */}
                  <div className={`p-4 border border-white/10 flex items-center justify-between ${risk.regimeBg} transition-colors duration-500`}>
                    <div className="flex flex-col">
                       <span className="font-bold text-white">VIX REGIME:</span>
                       {risk.regimeLabel === "INVEST (Trend)" && risk.totalScore > 50 && (
                         <span className="text-[10px] font-mono text-red-400 animate-pulse">⚠ COMPLACENCY TRAP DETECTED</span>
                       )}
                       {risk.regimeLabel === "WARN (Defensive)" && risk.totalScore < 25 && (
                         <span className="text-[10px] font-mono text-green-400 animate-pulse">✓ CAPITULATION OPPORTUNITY</span>
                       )}
                    </div>
                    <motion.span 
                      key={risk.regimeLabel}
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      className={`font-mono text-xl font-bold ${risk.regimeColor} tracking-wider text-right`}
                    >
                      {risk.regimeLabel}
                    </motion.span>
                  </div>

                  {/* Risk Score Display */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">COMPOSITE RISK SCORE</div>
                      <motion.div 
                        key={risk.totalScore}
                        initial={{ scale: 0.95, opacity: 0.8 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`text-4xl font-bold ${risk.color} tracking-tighter`}
                      >
                        {risk.totalScore}/100
                      </motion.div>
                    </div>
                    <motion.div 
                      key={risk.label}
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      className={`px-4 py-2 border border-current rounded ${risk.color} font-mono font-bold text-sm`}
                    >
                      STATUS: {risk.label}
                    </motion.div>
                  </div>

                  {/* The 4 Pillars Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* 1. Fragility */}
                    <div className="bg-white/5 p-4 border border-white/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-muted-foreground">FRAGILITY</span>
                        <span className={`text-xs font-bold ${risk.fragilityScore > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          +{risk.fragilityScore} PTS
                        </span>
                      </div>
                      <div className="text-xl font-bold text-white">
                        {metrics.vix.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {metrics.vix < 12 ? "EXTREME (<12)" : metrics.vix < 14 ? "HIGH (<14)" : "NORMAL"}
                      </div>
                    </div>

                    {/* 2. Tail Risk */}
                    <div className="bg-white/5 p-4 border border-white/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-muted-foreground">TAIL RISK (SKEW)</span>
                        <span className={`text-xs font-bold ${risk.skewScore > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          +{risk.skewScore} PTS
                        </span>
                      </div>
                      <div className="text-xl font-bold text-white">
                        {metrics.skew}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {metrics.skew > 145 ? "BLACK SWAN HEDGING" : "NORMAL"}
                      </div>
                    </div>

                    {/* 3. Hedging */}
                    <div className="bg-white/5 p-4 border border-white/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-muted-foreground">HEDGING (VVIX)</span>
                        <span className={`text-xs font-bold ${risk.hedgeScore > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          +{risk.hedgeScore} PTS
                        </span>
                      </div>
                      <div className="text-xl font-bold text-white">
                        {(metrics.vvix / metrics.vix).toFixed(2)}x
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {risk.hedgeScore > 0 ? "HIGH DEMAND (RISING)" : "STABLE"}
                      </div>
                    </div>

                    {/* 4. Credit */}
                    <div className="bg-white/5 p-4 border border-white/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-muted-foreground">CREDIT STRESS</span>
                        <span className={`text-xs font-bold ${risk.creditScore > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          +{risk.creditScore} PTS
                        </span>
                      </div>
                      <div className={`text-xl font-bold ${metrics.creditRatio === "DETERIORATING" ? 'text-red-500' : 'text-green-500'}`}>
                        {metrics.creditRatio}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        HYG vs IEF Bond Ratio
                      </div>
                    </div>

                  </div>

                </div>
              </Card>

              {/* Explanation Panel */}
              <div className="space-y-6">
                <div className="border border-border bg-card p-6 h-full">
                  <div className="flex items-center gap-2 mb-6 text-primary">
                    <ShieldCheck className="w-5 h-5" />
                    <h3 className="font-bold uppercase tracking-wider">Risk Protocol</h3>
                  </div>
                  
                  <div className="space-y-6">
                    
                    <div className="flex gap-4 items-start">
                        <div className="bg-primary/20 p-2 rounded text-primary mt-1">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">Current Strategy: {risk.regimeLabel}</h4>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {REGIMES[activeRegime].description}
                          </p>
                        </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div className="space-y-4">
                      {metrics.context && (
                        <div className="bg-white/5 border border-white/10 p-3 rounded text-sm">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground mb-2">
                            <Info className="w-3 h-3" />
                            Scenario Context
                          </div>
                          <p className="text-white leading-relaxed">{metrics.context}</p>
                        </div>
                      )}

                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Why is this happening?</h4>
                      
                      {risk.fragilityScore > 0 && (
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Market is FRAGILE (VIX &lt; 14). Leverage is too high.</span>
                        </div>
                      )}
                      {risk.skewScore > 0 && (
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Smart money buying Crash Insurance (SKEW &gt; 145).</span>
                        </div>
                      )}
                      {risk.creditScore > 0 && (
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Credit Markets breaking down (Junk Bonds selling off).</span>
                        </div>
                      )}
                      {risk.totalScore === 0 && (
                        <div className="flex items-center gap-2 text-sm text-green-400">
                          <ShieldCheck className="w-4 h-4" />
                          <span>All Systems Nominal. Proceed with Trend Following.</span>
                        </div>
                      )}
                    </div>

                    <Button className="w-full mt-4 bg-primary text-black font-bold hover:bg-white">
                      ACTIVATE DASHBOARD
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // PLAYBOOK TAB
          <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Overview */}
             <section>
                <h2 className="text-3xl font-bold mb-4 text-white">Institutional Risk Dashboard · Complete Playbook</h2>
                <div className="prose prose-invert max-w-none text-muted-foreground">
                  <p className="text-lg leading-relaxed">
                    This indicator functions as an early warning system for market risk. While most indicators are lagging or coincident, this one attempts to be leading by tracking fragility, tail risk, hedging activity, and credit stress.
                  </p>
                  <p className="mt-4">
                    The philosophy: Risk happens fast, but it builds slowly. This dashboard helps you see the cracks forming before the floor gives way.
                  </p>
                </div>
             </section>

             {/* Component Breakdown */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <Activity className="w-5 h-5" /> Component Breakdown
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* 1. Fragility */}
                   <Card className="bg-white/5 border-white/10 p-6">
                      <div className="flex items-center gap-2 mb-4">
                         <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center text-red-500 font-bold text-xs">1</div>
                         <h4 className="font-bold text-white">Fragility Score (VIX)</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        VIX risk is U-shaped. Low VIX means high leverage/complacency. High VIX means active turbulence.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>&lt; 12 (EXTREME)</span>
                           <span className="text-red-500 font-bold">+25 pts</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>12-14 (High)</span>
                           <span className="text-red-400 font-bold">+15 pts</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>17-21 (Goldilocks)</span>
                           <span className="text-green-500 font-bold">0 pts</span>
                        </div>
                        <div className="flex justify-between">
                           <span>&gt; 22 (Elevated)</span>
                           <span className="text-orange-500 font-bold">+5 pts</span>
                        </div>
                      </div>
                   </Card>

                   {/* 2. Tail Risk */}
                   <Card className="bg-white/5 border-white/10 p-6">
                      <div className="flex items-center gap-2 mb-4">
                         <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center text-red-500 font-bold text-xs">2</div>
                         <h4 className="font-bold text-white">Tail Risk (SKEW)</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Measures perceived risk of "black swan" events. Higher SKEW = institutions paying up for crash protection.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>&gt; 155</span>
                           <span className="text-red-500 font-bold">+25 pts</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>145-155</span>
                           <span className="text-red-400 font-bold">+15 pts</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>135-145</span>
                           <span className="text-orange-500 font-bold">+5 pts</span>
                        </div>
                        <div className="flex justify-between">
                           <span>&lt; 135</span>
                           <span className="text-green-500 font-bold">0 pts</span>
                        </div>
                      </div>
                   </Card>

                   {/* 3. Hedging */}
                   <Card className="bg-white/5 border-white/10 p-6">
                      <div className="flex items-center gap-2 mb-4">
                         <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center text-red-500 font-bold text-xs">3</div>
                         <h4 className="font-bold text-white">Hedging (VVIX/VIX)</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        "Volatility of Volatility". Rising ratio means institutions are buying VIX options before the spike.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>Ratio Spiking</span>
                           <span className="text-red-500 font-bold">+25 pts</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>Ratio Elevated</span>
                           <span className="text-red-400 font-bold">+15 pts</span>
                        </div>
                        <div className="flex justify-between">
                           <span>Ratio Falling</span>
                           <span className="text-green-500 font-bold">0 pts</span>
                        </div>
                      </div>
                   </Card>

                   {/* 4. Credit */}
                   <Card className="bg-white/5 border-white/10 p-6">
                      <div className="flex items-center gap-2 mb-4">
                         <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center text-red-500 font-bold text-xs">4</div>
                         <h4 className="font-bold text-white">Credit Stress (HYG/IEF)</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                         Compares Junk Bonds (Risk) to Treasuries (Safety). Credit markets often lead equity markets.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-white/5 pb-1">
                           <span>DETERIORATING</span>
                           <span className="text-red-500 font-bold">+25 pts</span>
                        </div>
                        <div className="flex justify-between">
                           <span>SUPPORTIVE</span>
                           <span className="text-green-500 font-bold">0 pts</span>
                        </div>
                      </div>
                   </Card>
                </div>
             </section>

             {/* Risk Score Logic */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <Gauge className="w-5 h-5" /> Risk Score Interpretation
                </h3>
                <Card className="bg-white/5 border-white/10 overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-white/5 text-xs uppercase font-mono text-muted-foreground">
                       <tr>
                         <th className="p-4">Score</th>
                         <th className="p-4">Label</th>
                         <th className="p-4">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       <tr>
                         <td className="p-4 font-mono">0-25</td>
                         <td className="p-4 font-bold text-green-500">SAFE</td>
                         <td className="p-4 text-muted-foreground">Full risk-on. Trend-following works.</td>
                       </tr>
                       <tr>
                         <td className="p-4 font-mono">26-50</td>
                         <td className="p-4 font-bold text-yellow-500">CAUTION</td>
                         <td className="p-4 text-muted-foreground">Normal conditions. Standard position sizing.</td>
                       </tr>
                       <tr>
                         <td className="p-4 font-mono">51-75</td>
                         <td className="p-4 font-bold text-orange-500">FRAGILE</td>
                         <td className="p-4 text-muted-foreground">Reduce exposure, tighten stops, hedge.</td>
                       </tr>
                       <tr>
                         <td className="p-4 font-mono">76-100</td>
                         <td className="p-4 font-bold text-red-500">CRASH WARNING</td>
                         <td className="p-4 text-muted-foreground">Defensive mode. Cash, hedges, minimal longs.</td>
                       </tr>
                     </tbody>
                   </table>
                </Card>
             </section>

             {/* Trading Regimes */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <Layers className="w-5 h-5" /> Volatility Trading Regimes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <Card className="bg-green-500/10 border-green-500/20 p-6">
                      <h4 className="font-bold text-green-400 mb-2">INVEST (Trend)</h4>
                      <div className="text-xs font-mono text-muted-foreground mb-4">VIX ≤ 19</div>
                      <p className="text-sm text-white">Trend-following works. Buy dips, hold winners. Full position sizing.</p>
                   </Card>
                   <Card className="bg-orange-500/10 border-orange-500/20 p-6">
                      <h4 className="font-bold text-orange-400 mb-2">CHOP (Vol)</h4>
                      <div className="text-xs font-mono text-muted-foreground mb-4">VIX 19-30</div>
                      <p className="text-sm text-white">Mean-reversion environment. Take profits quickly. Reduced sizing.</p>
                   </Card>
                   <Card className="bg-red-500/10 border-red-500/20 p-6">
                      <h4 className="font-bold text-red-400 mb-2">WARN (Defensive)</h4>
                      <div className="text-xs font-mono text-muted-foreground mb-4">VIX &gt; 30</div>
                      <p className="text-sm text-white">Capital preservation mode. Cash is a position. Wide stops if trading.</p>
                   </Card>
                </div>
             </section>

             {/* Scenarios */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Scenario Analysis
                </h3>
                <div className="space-y-4">
                   <Card className="bg-white/5 border-white/10 p-4">
                      <h4 className="font-bold text-white mb-1">The "Everything Looks Fine" Trap</h4>
                      <p className="text-sm text-muted-foreground">
                        VIX is Low (INVEST), but Risk Score is High (FRAGILE). This happens when VIX &lt; 12 (Complacency) + High SKEW. <span className="text-white">Action: Add hedges despite the uptrend.</span>
                      </p>
                   </Card>
                   <Card className="bg-white/5 border-white/10 p-4">
                      <h4 className="font-bold text-white mb-1">The De-Risked Setup</h4>
                      <p className="text-sm text-muted-foreground">
                        VIX is ~21 (CHOP), but Risk Score is 0 (SAFE). Leverage has unwound, but no panic. <span className="text-white">Action: Sustainable rallies often begin here. Look for longs.</span>
                      </p>
                   </Card>
                   <Card className="bg-white/5 border-white/10 p-4">
                      <h4 className="font-bold text-white mb-1">Credit Crack</h4>
                      <p className="text-sm text-muted-foreground">
                        VIX is normal, but Credit Stress is DETERIORATING. Bond market sees trouble first. <span className="text-white">Action: Defensive posture. Equity weakness usually follows.</span>
                      </p>
                   </Card>
                </div>
             </section>

        <PlaybookCTA />

          </div>
        )}
        <LegalFooter />
      </div>
    </div>
  );
}
