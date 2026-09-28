import { Navbar } from "@/components/navbar";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlaybookCTA } from "@/components/playbook-cta";
import { LegalFooter } from "@/components/legal-footer";
import { 
  Activity, 
  AlertTriangle, 
  Zap, 
  ShieldAlert, 
  Layers, 
  TrendingUp, 
  TrendingDown,
  Target,
  BookOpen,
  Code2,
  Gauge,
  PlayCircle,
  Ban,
  ArrowRight,
  ArrowDown
} from "lucide-react";

// Playbook Content from Markdown
const PLAYBOOK = {
  regimes: [
    {
      name: "POWER TREND",
      condition: "Velocity (+) & Acceleration (+)",
      behavior: "Aggressive Buying (15%)",
      description: "Strong uptrend, gaining momentum. Best time for accumulation.",
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/20"
    },
    {
      name: "DECELERATING",
      condition: "Velocity (+) & Acceleration (-)",
      behavior: "Reduced Buy Size (0.75%)",
      description: "Uptrend losing steam. Be cautious with new entries.",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      border: "border-yellow-400/20"
    },
    {
      name: "NEUTRAL",
      condition: "Mixed Signals",
      behavior: "Standard Sizing (1.5%)",
      description: "No clear direction. Standard accumulation rules apply.",
      color: "text-gray-400",
      bg: "bg-gray-400/10",
      border: "border-white/10"
    },
    {
      name: "BEARISH",
      condition: "Velocity (-)",
      behavior: "Cautious. High Trap Filters.",
      description: "Downtrend. Only buying deep value with strict filters.",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    },
    {
      name: "LIQUIDATION",
      condition: "Velocity (-) & Acceleration (-)",
      behavior: "NO BUYING. Distribution Only.",
      description: "Downtrend with volume spike. Capital preservation mode.",
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    {
      name: "CRASH",
      condition: "Hindenburg Confirmed",
      behavior: "NO BUYING. Max Distribution.",
      description: "Breadth collapse. Survival is the only goal.",
      color: "text-red-600",
      bg: "bg-red-600/20",
      border: "border-red-600/30"
    }
  ],
  signals: [
    {
      title: "RSI Hidden Bullish Div",
      type: "BUY",
      icon: <TrendingUp className="w-4 h-4" />,
      logic: "Price Higher Low + RSI Lower Low",
      desc: "Signals trend continuation. Momentum coiling for next leg up.",
      marker: "🔼 Green Triangle"
    },
    {
      title: "RSI Regular Bullish Div",
      type: "BUY",
      icon: <TrendingUp className="w-4 h-4" />,
      logic: "Price Lower Low + RSI Higher Low",
      desc: "Classic reversal signal. Selling pressure exhausting.",
      marker: "🔼 Green Triangle"
    },
    {
      title: "PPO Bullish Div",
      type: "BUY",
      icon: <TrendingUp className="w-4 h-4" />,
      logic: "Price Lower Low + PPO Higher Low",
      desc: "Independent confirmation from MACD-like oscillator.",
      marker: "🔼 Green Triangle"
    },
    {
      title: "HTF Divergence (Lumina)",
      type: "SELL",
      icon: <TrendingDown className="w-4 h-4" />,
      logic: "Daily/Weekly TSI Bearish Div",
      desc: "Higher timeframe warning. Major headwinds.",
      marker: "🔻 Purple Triangle"
    },
    {
      title: "Blow-Off Top",
      type: "SELL",
      icon: <Zap className="w-4 h-4" />,
      logic: "Volume Score ≥ 4 + High Momentum",
      desc: "Climax volume on sharp advance. Often precedes reversal.",
      marker: "❌ Orange X"
    }
  ]
};

// Mock Source Code
const SOURCE_CODE = `//@version=6
strategy("Divergence Accumulator [USER OPTIMIZED + DIV CONFLUENCE]", "DIV_STRAT_V6", overlay=true, pyramiding=1000, initial_capital=100000, default_qty_type=strategy.cash, default_qty_value=5000, max_boxes_count=500, currency=currency.USD)

// ==========================================
// ─── SETTINGS: PHYSICS ENGINE ───
// ==========================================
grp_phys = "Physics Engine"
len_vel  = input.int(18, "Velocity Lookback", group=grp_phys)
len_acc  = input.int(15, "Acceleration Lookback", group=grp_phys)
smooth   = input.int(3,  "Smoothing", group=grp_phys)

// ==========================================
// ─── REGIME DETECTION ───
// ==========================================
// Calculate Velocity (First Derivative)
velocity = ta.roc(close, len_vel)

// Calculate Acceleration (Second Derivative)
acceleration = ta.roc(velocity, len_acc)

// Define Regimes
is_power       = velocity > 0 and acceleration > 0
is_decel       = velocity > 0 and acceleration < 0
is_bear        = velocity < 0
is_liquidation = velocity < 0 and acceleration < 0
is_crash       = hindenburg_confirmed // From Macro Engine

// ... (Full logic for sizing and signals)
`;

// New Component: Confluence Simulator
const ConfluenceSimulator = () => {
  const [activeRSI, setActiveRSI] = useState(false);
  const [activePPO, setActivePPO] = useState(false);
  const [activeZone, setActiveZone] = useState(false);
  const [simRegime, setSimRegime] = useState<"POWER" | "NEUTRAL" | "BEAR" | "CRASH">("NEUTRAL");
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-Sequence Logic
  useEffect(() => {
    if (!isAutoPlaying) return;

    const sequence = [
      () => { setActiveRSI(true); setActivePPO(false); setActiveZone(false); setSimRegime("NEUTRAL"); },
      () => { setActivePPO(true); },
      () => { setActiveZone(true); },
      () => { setSimRegime("POWER"); },
      () => { setSimRegime("CRASH"); },
      () => { setActiveRSI(false); setActivePPO(false); setActiveZone(false); setSimRegime("NEUTRAL"); }
    ];

    let step = 0;
    const interval = setInterval(() => {
      sequence[step % sequence.length]();
      step++;
    }, 2000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const signalCount = (activeRSI ? 1 : 0) + (activePPO ? 1 : 0) + (activeZone ? 1 : 0);
  
  // Calculate Probability & Size
  const getStats = () => {
    if (simRegime === "CRASH") return { prob: 0, size: "0%", status: "BLOCKED", color: "text-red-500" };
    
    let prob = 50;
    if (activeRSI) prob += 5;
    if (activePPO) prob += 10;
    if (activeZone) prob += 10;
    
    if (simRegime === "POWER") prob += 15;
    if (simRegime === "BEAR") prob -= 10;

    let size = "0%";
    if (prob > 80) size = "MAX (15%)";
    else if (prob > 70) size = "HIGH (5%)";
    else if (prob > 60) size = "STD (1.5%)";
    else if (prob > 50) size = "SMALL (0.5%)";
    
    return { 
      prob, 
      size, 
      status: prob > 75 ? "LOCKED" : (prob > 60 ? "ACQUIRING" : "SEARCHING"),
      color: prob > 75 ? "text-green-500" : (prob > 60 ? "text-yellow-400" : "text-muted-foreground")
    };
  };

  const stats = getStats();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      {/* Main Visualizer - Targeting System */}
      <Card className="lg:col-span-2 bg-black border-white/10 p-0 relative overflow-hidden min-h-[500px] flex flex-col">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff0012_1px,transparent_1px),linear-gradient(to_bottom,#00ff0012_1px,transparent_1px)] bg-[size:40px_40px] opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />

        {/* HUD Overlay */}
        <div className="absolute inset-4 border border-white/10 rounded-lg pointer-events-none">
           <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/50" />
           <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/50" />
           <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/50" />
           <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/50" />
        </div>

        {/* Center Reticle */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
           <div className="relative w-96 h-96 flex items-center justify-center">
              
              {/* Outer Ring (RSI) */}
              <motion.div 
                className={`absolute inset-0 rounded-full border-2 border-dashed ${activeRSI ? "border-primary shadow-[0_0_20px_rgba(34,197,94,0.3)]" : "border-white/10"}`}
                animate={{ rotate: activeRSI ? 0 : 360, scale: activeRSI ? 1 : 1.1 }}
                transition={{ duration: activeRSI ? 0.5 : 20, ease: "linear", repeat: activeRSI ? 0 : Infinity }}
              >
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black px-2 text-[10px] font-mono text-primary">RSI_SENSOR</div>
              </motion.div>

              {/* Middle Ring (PPO) */}
              <motion.div 
                className={`absolute inset-16 rounded-full border-2 ${activePPO ? "border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.3)]" : "border-white/10 border-dotted"}`}
                animate={{ rotate: activePPO ? 0 : -180, scale: activePPO ? 1 : 0.9 }}
                transition={{ duration: activePPO ? 0.5 : 15, ease: "linear", repeat: activePPO ? 0 : Infinity }}
              >
                 <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black px-2 text-[10px] font-mono text-blue-400">PPO_CONFIRM</div>
              </motion.div>

              {/* Inner Ring (Zone) */}
              <motion.div 
                className={`absolute inset-32 rounded-full border-4 ${activeZone ? "border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.4)]" : "border-white/5"}`}
                animate={{ scale: activeZone ? [1, 1.05, 1] : 1 }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                 {activeZone && (
                   <div className="absolute inset-0 bg-yellow-400/10 rounded-full animate-pulse" />
                 )}
              </motion.div>

              {/* Center Status */}
              <div className="text-center z-20">
                 {simRegime === "CRASH" ? (
                   <div className="text-red-500 font-bold text-2xl animate-pulse border-2 border-red-500 px-4 py-2 bg-red-500/10">
                     BLOCKED
                   </div>
                 ) : (
                   <>
                     <div className={`text-3xl font-bold font-mono tracking-tighter ${stats.color}`}>
                       {stats.status}
                     </div>
                     <div className="text-xs text-muted-foreground mt-1 font-mono">
                       PROB: {stats.prob}%
                     </div>
                   </>
                 )}
              </div>
           </div>
        </div>

        {/* Bottom Stats Bar */}
        <div className="relative z-10 grid grid-cols-3 border-t border-white/10 bg-black/80 backdrop-blur">
           <div className="p-4 text-center border-r border-white/10">
              <div className="text-[10px] text-muted-foreground mb-1">ACTIVE_SIGNALS</div>
              <div className="text-xl font-bold text-white">{signalCount}/3</div>
           </div>
           <div className="p-4 text-center border-r border-white/10">
              <div className="text-[10px] text-muted-foreground mb-1">REGIME_MODIFIER</div>
              <div className={`text-xl font-bold ${simRegime === "POWER" ? "text-green-400" : (simRegime === "CRASH" ? "text-red-500" : "text-gray-400")}`}>
                 {simRegime}
              </div>
           </div>
           <div className="p-4 text-center">
              <div className="text-[10px] text-muted-foreground mb-1">TARGET_SIZE</div>
              <div className={`text-xl font-bold ${stats.color}`}>{stats.size}</div>
           </div>
        </div>
      </Card>

      {/* Controls Panel */}
      <div className="space-y-6">
         <div className="bg-card border border-white/10 p-6 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                 <Target className="w-4 h-4 text-primary" /> Signal Inputs
              </h3>
              <button 
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className={`text-xs font-mono flex items-center gap-1 px-2 py-1 rounded border ${isAutoPlaying ? "bg-white/10 border-white/20 text-muted-foreground" : "bg-primary/20 border-primary text-primary hover:bg-primary/30"}`}
              >
                {isAutoPlaying ? <Ban className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                {isAutoPlaying ? "PAUSE_DEMO" : "RESUME_DEMO"}
              </button>
            </div>
            <div className="space-y-3">
               <button 
                 onClick={() => setActiveRSI(!activeRSI)}
                 className={`w-full flex justify-between items-center p-3 rounded border transition-all ${activeRSI ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"}`}
               >
                  <span className="font-mono text-xs font-bold">RSI_DIVERGENCE</span>
                  {activeRSI && <Zap className="w-3 h-3" />}
               </button>
               <button 
                 onClick={() => setActivePPO(!activePPO)}
                 className={`w-full flex justify-between items-center p-3 rounded border transition-all ${activePPO ? "bg-blue-500/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"}`}
               >
                  <span className="font-mono text-xs font-bold">PPO_CONFIRMATION</span>
                  {activePPO && <Activity className="w-3 h-3" />}
               </button>
               <button 
                 onClick={() => setActiveZone(!activeZone)}
                 className={`w-full flex justify-between items-center p-3 rounded border transition-all ${activeZone ? "bg-yellow-500/20 border-yellow-500 text-yellow-400" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"}`}
               >
                  <span className="font-mono text-xs font-bold">INSTITUTIONAL_ZONE</span>
                  {activeZone && <Layers className="w-3 h-3" />}
               </button>
            </div>
         </div>

         <div className="bg-card border border-white/10 p-6 rounded-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
               <Gauge className="w-4 h-4 text-primary" /> Regime Context
            </h3>
            <div className="grid grid-cols-2 gap-2">
               {["POWER", "NEUTRAL", "BEAR", "CRASH"].map((r) => (
                 <button
                   key={r}
                   onClick={() => setSimRegime(r as any)}
                   className={`p-2 text-xs font-bold border transition-all rounded ${simRegime === r ? "bg-white text-black border-white" : "bg-transparent text-muted-foreground border-white/10 hover:border-white/30"}`}
                 >
                    {r}
                 </button>
               ))}
            </div>
         </div>

         <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
            <div className="text-xs text-blue-200 leading-relaxed">
               <strong className="text-white">Visual Logic:</strong> Observe how adding signals increases the probability "Lock-On", but a bad Regime (like CRASH) instantly blocks the trade regardless of signals.
            </div>
         </div>
      </div>
    </div>
  );
};

export default function IndicatorFractalAccumulator() {
  const [activeTab, setActiveTab] = useState<"engine" | "sim" | "playbook" | "code">("sim");
  const [simStep, setSimStep] = useState(0);

  // Simulation State
  const [regime, setRegime] = useState(PLAYBOOK.regimes[2]); // Start Neutral
  const [velocity, setVelocity] = useState(0.5);
  const [acceleration, setAcceleration] = useState(-0.2);
  const [hindenburg, setHindenburg] = useState(false);
  
  // Auto-cycle simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setSimStep((prev) => (prev + 1) % 6);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update simulation values based on step
  useEffect(() => {
    switch(simStep) {
      case 0: // POWER
        setRegime(PLAYBOOK.regimes[0]);
        setVelocity(12.5);
        setAcceleration(2.1);
        setHindenburg(false);
        break;
      case 1: // DECELERATING
        setRegime(PLAYBOOK.regimes[1]);
        setVelocity(4.2);
        setAcceleration(-1.5);
        setHindenburg(false);
        break;
      case 2: // NEUTRAL
        setRegime(PLAYBOOK.regimes[2]);
        setVelocity(0.5);
        setAcceleration(0.2);
        setHindenburg(false);
        break;
      case 3: // BEAR
        setRegime(PLAYBOOK.regimes[3]);
        setVelocity(-5.2);
        setAcceleration(0.1);
        setHindenburg(false);
        break;
      case 4: // LIQUIDATION
        setRegime(PLAYBOOK.regimes[4]);
        setVelocity(-15.4);
        setAcceleration(-4.5);
        setHindenburg(false);
        break;
      case 5: // CRASH
        setRegime(PLAYBOOK.regimes[5]);
        setVelocity(-25.0);
        setAcceleration(-8.0);
        setHindenburg(true);
        break;
    }
  }, [simStep]);

  return (
    <div className="min-h-screen bg-background pt-20 pb-24 font-sans">
      <Navbar />
      <div className="container px-4 md:px-6">
        
        {/* Header */}
        <div className="mb-12 border-b border-white/10 pb-8 relative overflow-hidden">
          {/* Special Background Effect for Flagship Page */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-4">
              <Link href="/indicator-library">
                <span className="text-primary hover:underline cursor-pointer">INDICATOR_LIBRARY</span>
              </Link>
              <span>/</span>
              <span>KINE_FRACTAL_ACCUMULATOR</span>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/50 rounded-none font-mono px-3 py-1">
                    ★ FLAGSHIP_STRATEGY
                  </Badge>
                </div>
                <h1 className="text-4xl md:text-7xl font-bold uppercase tracking-tighter text-white mb-4">
                  Kine<span className="text-primary">Fractal</span> <span className="text-white/50">Accumulator</span>
                </h1>
                <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed border-l-2 border-primary/50 pl-4">Long-only automated system governed by physics-based regime detection that preserves capital during crashes and compounds aggressively during power trends.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-8 mb-12 overflow-x-auto">
          <button 
            onClick={() => setActiveTab("engine")}
            className={`pb-2 font-mono text-sm font-bold transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === "engine" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-white"}`}
          >
            <Gauge className="w-4 h-4" />
            REGIME_ENGINE
          </button>
          <button 
            onClick={() => setActiveTab("sim")}
            className={`pb-2 font-mono text-sm font-bold transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === "sim" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-white"}`}
          >
            <Target className="w-4 h-4" />
            CONFLUENCE_SIM
          </button>
          <button 
            onClick={() => setActiveTab("playbook")}
            className={`pb-2 font-mono text-sm font-bold transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === "playbook" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-white"}`}
          >
            <BookOpen className="w-4 h-4" />
            STRATEGY_PLAYBOOK
          </button>
          <button 
            onClick={() => setActiveTab("code")}
            className={`pb-2 font-mono text-sm font-bold transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === "code" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-white"}`}
          >
            <Code2 className="w-4 h-4" />
            SOURCE_CODE
          </button>
        </div>

        {/* CONTENT AREAS */}
        
        {/* 1. REGIME ENGINE (VISUALIZER) */}
        {activeTab === "engine" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            {/* Main Engine Visualizer */}
            <Card className="lg:col-span-2 bg-black border-white/10 p-0 relative overflow-hidden min-h-[500px] flex flex-col">
              {/* Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#202020_1px,transparent_1px),linear-gradient(to_bottom,#202020_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />
              
              {/* Header Telemetry */}
              <div className="relative z-10 p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
                <div>
                  <div className="text-xs font-mono text-muted-foreground mb-1 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${regime.name === "CRASH" ? "bg-red-500" : "bg-green-500"}`} />
                    SYSTEM_STATUS: ONLINE
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-muted-foreground mb-1">CURRENT_REGIME</div>
                  <div className={`text-4xl font-bold tracking-tighter ${regime.color} transition-colors duration-500`}>
                    {regime.name}
                  </div>
                </div>
              </div>

              {/* Central Physics Gauge */}
              <div className="relative z-10 flex-1 flex items-center justify-center py-8">
                <div className="relative w-72 h-72 flex items-center justify-center">
                   {/* Outer Ring - Static */}
                   <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                   <div className="absolute inset-4 rounded-full border border-white/5 border-dashed" />
                   
                   {/* Velocity Ring - Dynamic */}
                   <motion.div 
                     className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
                     animate={{ rotate: velocity * 15 }}
                     transition={{ type: "spring", stiffness: 40, damping: 15 }}
                   />
                   
                   {/* Acceleration Ring - Dynamic */}
                   <motion.div 
                     className="absolute inset-8 rounded-full border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent opacity-50"
                     animate={{ rotate: acceleration * 30 }}
                     transition={{ type: "spring", stiffness: 30, damping: 20 }}
                   />

                   {/* Center Data */}
                   <div className="text-center relative z-20 bg-black/50 backdrop-blur-sm p-4 rounded-full">
                      <div className={`text-5xl font-bold font-mono mb-1 ${velocity > 0 ? "text-white" : "text-red-400"}`}>
                        {velocity.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Velocity</div>
                      <div className={`text-sm font-mono font-bold ${acceleration > 0 ? "text-blue-400" : "text-orange-400"}`}>
                        {acceleration > 0 ? "+" : ""}{acceleration.toFixed(2)} Accel
                      </div>
                   </div>
                </div>
              </div>

              {/* Bottom Telemetry Grid */}
              <div className="relative z-10 grid grid-cols-4 gap-px bg-white/10">
                <div className="bg-black/80 backdrop-blur p-4 text-center border-r border-white/5">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">HINDENBURG</div>
                  <div className={`text-lg font-bold font-mono ${hindenburg ? "text-red-500 animate-pulse" : "text-green-500"}`}>
                    {hindenburg ? "OMEN!" : "SAFE"}
                  </div>
                </div>
                <div className="bg-black/80 backdrop-blur p-4 text-center border-r border-white/5">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">BUY_SIZE</div>
                  <div className="text-lg font-bold font-mono text-white">
                     {regime.behavior.match(/\((.*?)\)/)?.[1] || "0%"}
                  </div>
                </div>
                <div className="bg-black/80 backdrop-blur p-4 text-center border-r border-white/5">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">VIX_STATE</div>
                  <div className="text-lg font-bold font-mono text-white">
                     14.2
                  </div>
                </div>
                <div className="bg-black/80 backdrop-blur p-4 text-center">
                   <div className="text-[10px] font-mono text-muted-foreground mb-1">ACTION</div>
                   <div className={`text-lg font-bold font-mono ${regime.color}`}>
                      {regime.name === "CRASH" || regime.name === "LIQUIDATION" ? "HALT" : "ACTIVE"}
                   </div>
                </div>
              </div>
            </Card>

            {/* Logic Matrix Side Panel */}
            <div className="space-y-4 h-[500px] overflow-y-auto pr-2 custom-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="font-bold font-mono text-sm uppercase tracking-wider">Logic Matrix</h3>
              </div>
              
              {PLAYBOOK.regimes.map((r) => (
                <motion.div 
                  key={r.name}
                  initial={false}
                  animate={{ 
                    opacity: regime.name === r.name ? 1 : 0.4,
                    scale: regime.name === r.name ? 1.02 : 1
                  }}
                  className={`p-4 rounded-lg border transition-all duration-300 ${regime.name === r.name ? r.bg + " " + r.border : "bg-card border-white/5"}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className={`font-bold font-mono text-sm ${r.color}`}>{r.name}</div>
                    {regime.name === r.name && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mb-2">{r.condition}</div>
                  <div className="text-sm text-white font-medium">{r.behavior}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 2. CONFLUENCE SIMULATOR */}
        {activeTab === "sim" && <ConfluenceSimulator />}

        {/* 3. PLAYBOOK */}
        {activeTab === "playbook" && (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Philosophy Section */}
            <section className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-6 text-white">Protective by Design</h2>
                  <div className="prose prose-invert">
                    <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                      Single indicators lie. Multiple uncorrelated signals agreeing is where edge lives. 
                      The Kine Fractal system uses physics-based regime detection to contextualize every signal.
                    </p>
                    <div className="pl-4 border-l-2 border-primary">
                      <p className="text-white italic">
                        "The goal isn't to catch every move; it's to preserve and compound."
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <Card className="p-6 bg-white/5 border-white/10 hover:border-primary/50 transition-colors">
                      <ShieldAlert className="w-8 h-8 text-primary mb-4" />
                      <h3 className="font-bold text-white mb-2">Trap Detection</h3>
                      <p className="text-xs text-muted-foreground">Flags signals during crashes as traps. Enters "Caution Mode" automatically.</p>
                   </Card>
                   <Card className="p-6 bg-white/5 border-white/10 hover:border-primary/50 transition-colors">
                      <Layers className="w-8 h-8 text-primary mb-4" />
                      <h3 className="font-bold text-white mb-2">Confluence</h3>
                      <p className="text-xs text-muted-foreground">Requires multiple independent domains (RSI + PPO + Structure) to agree.</p>
                   </Card>
                   <Card className="p-6 bg-white/5 border-white/10 hover:border-primary/50 transition-colors">
                      <Activity className="w-8 h-8 text-primary mb-4" />
                      <h3 className="font-bold text-white mb-2">Physics Engine</h3>
                      <p className="text-xs text-muted-foreground">Uses Velocity and Acceleration to classify market regimes dynamically.</p>
                   </Card>
                   <Card className="p-6 bg-white/5 border-white/10 hover:border-primary/50 transition-colors">
                      <Zap className="w-8 h-8 text-primary mb-4" />
                      <h3 className="font-bold text-white mb-2">Automated</h3>
                      <p className="text-xs text-muted-foreground">Outputs JSON alerts for IBKR/Alpaca/TradingView execution.</p>
                   </Card>
                </div>
              </div>
            </section>

            {/* Signals Section */}
            <section className="mb-16">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Signal Catalog
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {PLAYBOOK.signals.map((sig, i) => (
                   <Card key={i} className="bg-card border-white/10 overflow-hidden group hover:border-white/20 transition-colors">
                      <div className={`h-1 w-full ${sig.type === "BUY" ? "bg-green-500" : "bg-red-500"}`} />
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                           <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                             {sig.icon}
                           </div>
                           <Badge variant="secondary" className={sig.type === "BUY" ? "text-green-400" : "text-red-400"}>
                             {sig.type}
                           </Badge>
                        </div>
                        <h4 className="font-bold text-white text-lg mb-2">{sig.title}</h4>
                        <div className="text-xs font-mono text-muted-foreground bg-black/30 p-2 rounded mb-4 border border-white/5">
                          {sig.logic}
                        </div>
                        <p className="text-sm text-gray-400 mb-4">{sig.desc}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-white/5 pt-4">
                           <span>Marker:</span>
                           <span className="text-white font-bold">{sig.marker}</span>
                        </div>
                      </div>
                   </Card>
                 ))}
              </div>
            </section>

            {/* Institutional Zones */}
            <section className="mb-16">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Institutional Zones
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-white/5 border-white/10 p-6 border-l-4 border-l-teal-500">
                  <h4 className="font-bold text-white text-lg mb-2">Demand Zones (Accumulation)</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    High-volume pivot lows where large players accumulated. Price returning here often finds support.
                  </p>
                  <div className="bg-black/30 p-3 rounded border border-white/5 text-xs font-mono text-teal-400">
                    IF Buy Signal inside Zone → SIZE = AGGRESSIVE
                  </div>
                </Card>
                <Card className="bg-white/5 border-white/10 p-6 border-l-4 border-l-red-900">
                  <h4 className="font-bold text-white text-lg mb-2">Supply Zones (Distribution)</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    High-volume pivot highs where large players distributed. Price returning here often faces resistance.
                  </p>
                  <div className="bg-black/30 p-3 rounded border border-white/5 text-xs font-mono text-red-400">
                    IF Price hits Supply Zone → BOOST SELL SIZE
                  </div>
                </Card>
              </div>
            </section>

            {/* Probability & Sizing Section */}
            <section className="mb-16">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary" />
                Probability-Weighted Decision Making
              </h3>

              {/* Conviction Stack Visualization */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                 <div className="lg:col-span-2">
                    <h4 className="text-lg font-bold text-white mb-4">The Conviction Stack</h4>
                    <p className="text-muted-foreground mb-6">
                      The system doesn't just predict; it stacks probabilities. Every decision passes through a conviction engine that weights signals against the current regime.
                    </p>
                    
                    <div className="space-y-2">
                       {/* Layer 1 */}
                       <div className="bg-black/40 border border-white/10 p-4 flex justify-between items-center">
                          <div>
                            <div className="text-xs font-mono text-muted-foreground uppercase">Layer 1: Signal</div>
                            <div className="font-bold text-white">What fires?</div>
                          </div>
                          <div className="text-right text-sm text-gray-400">
                             RSI, PPO, Zones (+1 Vote each)
                          </div>
                       </div>
                       
                       {/* Arrow */}
                       <div className="flex justify-center">
                          <ArrowDown className="w-4 h-4 text-white/20" />
                       </div>

                       {/* Layer 2 */}
                       <div className="bg-black/40 border border-white/10 p-4 flex justify-between items-center">
                          <div>
                            <div className="text-xs font-mono text-muted-foreground uppercase">Layer 2: Regime</div>
                            <div className="font-bold text-white">How are votes weighted?</div>
                          </div>
                          <div className="text-right text-sm text-gray-400">
                             Power (10x), Neutral (1x), Bear (0.5x)
                          </div>
                       </div>

                       {/* Arrow */}
                       <div className="flex justify-center">
                          <ArrowDown className="w-4 h-4 text-white/20" />
                       </div>

                       {/* Layer 3 */}
                       <div className="bg-primary/10 border border-primary/30 p-4 flex justify-between items-center">
                          <div>
                            <div className="text-xs font-mono text-primary uppercase">Layer 3: Output</div>
                            <div className="font-bold text-white">Position Size</div>
                          </div>
                          <div className="text-right text-sm text-primary font-bold">
                             Proportional to Conviction
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 {/* Dynamic Sizing Logic - UPDATED FROM IMAGE */}
                 <div className="lg:col-span-3 mb-12">
                    <h4 className="text-lg font-bold text-white mb-4">Dynamic Sizing: Computed, Not Looked Up</h4>
                    <p className="text-muted-foreground mb-4">
                       Position size is an <strong className="text-white">output</strong> of the conviction engine, not an input you configure per trade.
                    </p>
                    <div className="bg-white/5 p-4 rounded-lg border border-white/10 font-mono text-xs md:text-sm text-gray-300 mb-6">
                       FINAL SIZE = f(regime, signal_count, institutional_confluence, caution_state, div_scoring)
                    </div>
                    
                    <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                       <table className="w-full text-sm text-left">
                          <thead className="bg-white/5 text-muted-foreground font-mono text-xs uppercase border-b border-white/10">
                             <tr>
                                <th className="p-4 font-medium">Scenario</th>
                                <th className="p-4 font-medium">Calculation</th>
                                <th className="p-4 font-medium">Final Size</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                             <tr className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white">1 RSI div, Power regime, no inst. zone</td>
                                <td className="p-4 text-muted-foreground">Base 15%</td>
                                <td className="p-4 font-bold text-white">15%</td>
                             </tr>
                             <tr className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white">2 divs (RSI + PPO), Neutral regime</td>
                                <td className="p-4 text-muted-foreground">Base 1.5% × 1.3 multi-div bonus</td>
                                <td className="p-4 font-bold text-white">~2%</td>
                             </tr>
                             <tr className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white">1 div, Neutral, inside institutional zone</td>
                                <td className="p-4 text-muted-foreground">Base → Aggressive 15%</td>
                                <td className="p-4 font-bold text-white">15%</td>
                             </tr>
                             <tr className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white">1 div, Power regime, but caution mode active</td>
                                <td className="p-4 text-muted-foreground">15% capped to 3.5%</td>
                                <td className="p-4 font-bold text-white">3.5%</td>
                             </tr>
                             <tr className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white">3 divs, Decel regime, div scoring enabled</td>
                                <td className="p-4 text-muted-foreground">0.75% base + (3 × 0.25%)</td>
                                <td className="p-4 font-bold text-white">1.5%</td>
                             </tr>
                             <tr className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white">Any signal, Crash regime</td>
                                <td className="p-4 text-muted-foreground">Blocked</td>
                                <td className="p-4 font-bold text-white">0%</td>
                             </tr>
                          </tbody>
                       </table>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground italic">
                       The system sizes up when conviction is high. It sizes down, or refuses entirely, when conviction is low.
                    </p>
                 </div>
              </div>

              {/* Distribution Section - ADDED FROM IMAGE */}
              <div className="mb-12">
                 <h4 className="text-lg font-bold text-white mb-2">Distribution: The Same Logic, Inverted</h4>
                 <p className="text-muted-foreground mb-6">
                    Sell signals follow the same probability-weighted approach:
                 </p>
                 <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-white/5 text-muted-foreground font-mono text-xs uppercase border-b border-white/10">
                          <tr>
                             <th className="p-4 font-medium">Trigger</th>
                             <th className="p-4 font-medium">Regime Context</th>
                             <th className="p-4 font-medium">Size</th>
                             <th className="p-4 font-medium">Reasoning</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                          <tr className="hover:bg-white/5 transition-colors">
                             <td className="p-4 text-white font-bold">HTF Divergence</td>
                             <td className="p-4 text-white">Any</td>
                             <td className="p-4 font-mono text-red-400">9.5%</td>
                             <td className="p-4 text-muted-foreground">Higher timeframe warning. Significant.</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                             <td className="p-4 text-white font-bold">Blow-off (vol score 8+)</td>
                             <td className="p-4 text-white">Power</td>
                             <td className="p-4 font-mono text-red-400">1%</td>
                             <td className="p-4 text-muted-foreground">Even strong trends can have climax reversals</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                             <td className="p-4 text-white font-bold">Blow-off (vol score 6+)</td>
                             <td className="p-4 text-white">Decel/Bear</td>
                             <td className="p-4 font-mono text-red-400">1%</td>
                             <td className="p-4 text-muted-foreground">Late-cycle exhaustion more likely</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                             <td className="p-4 text-white font-bold">Gap-up {">"} 2.6%</td>
                             <td className="p-4 text-white">Non-bear</td>
                             <td className="p-4 font-mono text-red-400">2%</td>
                             <td className="p-4 text-muted-foreground">Take profits into euphoria</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                             <td className="p-4 text-white font-bold">Hindenburg Omen</td>
                             <td className="p-4 text-white">·</td>
                             <td className="p-4 font-mono text-red-400">7%</td>
                             <td className="p-4 text-muted-foreground">Breadth collapse. De-risk immediately.</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                             <td className="p-4 text-white font-bold">Regime = Crash</td>
                             <td className="p-4 text-white">·</td>
                             <td className="p-4 font-mono text-red-400">9%</td>
                             <td className="p-4 text-muted-foreground">Maximum distribution. Survival mode.</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                             <td className="p-4 text-white font-bold">Regime = Power</td>
                             <td className="p-4 text-white">·</td>
                             <td className="p-4 font-mono text-red-400">0.5%</td>
                             <td className="p-4 text-muted-foreground">Minimal. Don't fight the trend.</td>
                          </tr>
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* The Takeaway - ADDED FROM IMAGE */}
              <div className="mb-12">
                 <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                    The Takeaway
                 </h3>
                 
                 <div className="bg-white/5 border border-white/10 p-6 rounded-xl space-y-6">
                    <div>
                       <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                          Traditional approach:
                       </h4>
                       <div className="font-mono text-sm text-muted-foreground bg-black/30 p-3 rounded">
                          Signal fires → Fixed position size → Hope it works
                       </div>
                    </div>
                    
                    <div>
                       <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                          <span className="text-primary">Kine Fractal approach:</span>
                       </h4>
                       <div className="font-mono text-sm text-primary bg-primary/10 p-3 rounded border border-primary/30">
                          Signal fires → Weight by regime → Multiply by confluence → Filter through safety layer → Compute position size proportional to expected value
                       </div>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5 text-muted-foreground text-sm leading-relaxed space-y-4">
                       <p>
                          Every entry is a probability-weighted bet. Size reflects conviction. Conviction reflects the number of independent factors agreeing.
                       </p>
                       <p>
                          When everything aligns (multiple divergences, favorable regime, institutional zone, no caution flags), the system speaks loudly.
                       </p>
                       <p>
                          When signals conflict or danger is present, the system whispers. Or stays silent.
                       </p>
                       <p className="text-lg font-bold text-white italic border-l-4 border-primary pl-4 py-2 bg-black/20">
                          Confluence is relevance. Size follows conviction.
                       </p>
                    </div>
                 </div>
              </div>

              {/* Signal x Regime Matrix */}
              <h4 className="text-lg font-bold text-white mb-6">Signal × Regime Matrix</h4>
              <div className="bg-card border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-white/5 text-muted-foreground font-mono text-xs uppercase">
                    <tr>
                      <th className="p-4 font-medium">When Signal Fires →</th>
                      <th className="p-4 font-medium text-green-500">POWER</th>
                      <th className="p-4 font-medium text-yellow-500">DECEL</th>
                      <th className="p-4 font-medium text-gray-400">NEUTRAL</th>
                      <th className="p-4 font-medium text-orange-500">BEAR</th>
                      <th className="p-4 font-medium text-red-500">CRASH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">RSI Hidden Bull</td>
                      <td className="p-4 font-mono text-green-400">✅ &lt;=15%</td>
                      <td className="p-4 font-mono text-yellow-400">✅ 0.75%</td>
                      <td className="p-4 font-mono text-white">✅ 1.5%</td>
                      <td className="p-4 font-mono text-orange-400">⚠️ Filtered</td>
                      <td className="p-4 font-mono text-red-500 opacity-50">❌ Blocked</td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">RSI Regular Bull</td>
                      <td className="p-4 font-mono text-green-400">✅ 15%</td>
                      <td className="p-4 font-mono text-yellow-400">✅ 0.75%</td>
                      <td className="p-4 font-mono text-white">✅ 1.5%</td>
                      <td className="p-4 font-mono text-orange-400">⚠️ Filtered</td>
                      <td className="p-4 font-mono text-red-500 opacity-50">❌ Blocked</td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">PPO Bullish</td>
                      <td className="p-4 font-mono text-green-400">✅ 15%</td>
                      <td className="p-4 font-mono text-yellow-400">✅ 0.75%</td>
                      <td className="p-4 font-mono text-white">✅ 1.5%</td>
                      <td className="p-4 font-mono text-orange-400">⚠️ Filtered</td>
                      <td className="p-4 font-mono text-red-500 opacity-50">❌ Blocked</td>
                    </tr>
                     <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">Multi-Div (2+)</td>
                      <td className="p-4 font-mono text-green-400">✅ &gt;15%</td>
                      <td className="p-4 font-mono text-yellow-400">✅ ~1%</td>
                      <td className="p-4 font-mono text-white">✅ ~2%</td>
                      <td className="p-4 font-mono text-orange-400">⚠️ Filtered</td>
                      <td className="p-4 font-mono text-red-500 opacity-50">❌ Blocked</td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors bg-teal-900/10">
                      <td className="p-4 font-bold text-teal-400">+ Inst. Zone</td>
                      <td className="p-4 font-mono text-green-400">→ &lt;=15%</td>
                      <td className="p-4 font-mono text-muted-foreground">·</td>
                      <td className="p-4 font-mono text-green-400">→ 15%</td>
                      <td className="p-4 font-mono text-muted-foreground">·</td>
                      <td className="p-4 font-mono text-muted-foreground">·</td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors bg-yellow-900/10">
                      <td className="p-4 font-bold text-yellow-400">+ Caution Mode</td>
                      <td className="p-4 font-mono text-yellow-400">↓ 3.5% cap</td>
                      <td className="p-4 font-mono text-yellow-400">↓ 3.5% cap</td>
                      <td className="p-4 font-mono text-yellow-400">↓ 3.5% cap</td>
                      <td className="p-4 font-mono text-yellow-400">↓ 3.5% cap</td>
                      <td className="p-4 font-mono text-muted-foreground">·</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Legend & Explanation */}
              <div className="mb-12">
                 <div className="flex flex-wrap gap-4 text-xs font-mono text-muted-foreground mb-8 p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center gap-2">
                       <span className="text-lg">✅</span>
                       <span>= Entry allowed at shown size</span>
                    </div>
                    <div className="w-px h-4 bg-white/20 hidden md:block" />
                    <div className="flex items-center gap-2">
                       <span className="text-lg">⚠️</span>
                       <span>= Trap filter active (RSI must be {"<"} 45)</span>
                    </div>
                    <div className="w-px h-4 bg-white/20 hidden md:block" />
                    <div className="flex items-center gap-2">
                       <span className="text-lg">❌</span>
                       <span>= No entries permitted</span>
                    </div>
                 </div>

                 <h4 className="text-lg font-bold text-white mb-4">Why Signals Get Blocked</h4>
                 <p className="text-muted-foreground mb-4">
                    Not all divergences are created equal. The system actively rejects signals with negative expected value.
                 </p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                       <h5 className="font-bold text-white mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-orange-500" /> Trap Detection
                       </h5>
                       <p className="text-sm text-muted-foreground mb-4">
                          A "trap" is a buy signal that fires when historical data shows it's more likely to fail than succeed.
                       </p>
                       <ul className="space-y-2 text-xs font-mono text-gray-400">
                          <li className="flex items-center gap-2">
                             <span className="text-red-500">●</span>
                             Div in Crash Regime → ALWAYS TRAPPED
                          </li>
                          <li className="flex items-center gap-2">
                             <span className="text-red-500">●</span>
                             Div in Liquidation Regime → ALWAYS TRAPPED
                          </li>
                          <li className="flex items-center gap-2">
                             <span className="text-orange-500">●</span>
                             Div in Bear Regime with RSI {">"} 45 → TRAPPED
                          </li>
                       </ul>
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                       <h5 className="font-bold text-white mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" /> Caution Mode
                       </h5>
                       <p className="text-sm text-muted-foreground mb-4">
                          After a trap or panic event, the system downgrades all sizes. This isn't fear: it's Bayesian updating.
                       </p>
                       <div className="bg-black/30 p-3 rounded border border-white/5 text-xs font-mono text-yellow-400">EFFECT: All buy sizes capped at 3.5% for 30 bars (customizable)</div>
                    </div>
                 </div>
              </div>
            </section>

          </div>
        )}

        {/* 3. CODE */}
        {activeTab === "code" && (
          <div className="relative animate-in fade-in duration-500">
            <div className="absolute top-0 right-0 p-4">
              <button className="bg-primary text-black px-4 py-2 font-mono text-xs font-bold hover:bg-white transition-colors rounded">
                COPY_TO_CLIPBOARD
              </button>
            </div>
            <pre className="bg-black border border-white/10 p-6 rounded-xl overflow-x-auto font-mono text-xs leading-relaxed text-gray-300 min-h-[600px]">
              <code>{SOURCE_CODE}</code>
            </pre>
          </div>
        )}

        <PlaybookCTA />

        <LegalFooter />
      </div>
    </div>
  );
}