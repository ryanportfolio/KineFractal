import { Navbar } from "@/components/navbar";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useState, useEffect, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaybookCTA } from "@/components/playbook-cta";
import { LegalFooter } from "@/components/legal-footer";
import { 
    Activity, 
    AlertTriangle, 
    ArrowDown, 
    ArrowUp, 
    BarChart3, 
    Code2, 
    FileText, 
    Gauge, 
    Zap, 
    ShieldAlert, 
    Layers,
    Wind,
    GaugeCircle
} from "lucide-react";

// Playbook Content
const PLAYBOOK = {
  regimes: [
    {
      name: "POWER TREND",
      condition: "Velocity > 0, Accel > 0, Vol High",
      behavior: "Strongest bullish state. Full gas, high speed. BUY/HOLD.",
      color: "text-green-500",
      borderColor: "border-green-500",
      stars: "★★★"
    },
    {
      name: "CRUISE CONTROL",
      condition: "Velocity > Threshold, Accel < 0",
      behavior: "Momentum flat but trend stable. HOLD.",
      color: "text-green-400",
      borderColor: "border-green-400",
      stars: "★★☆"
    },
    {
      name: "BULLISH FLAGGING",
      condition: "Velocity > 0, Accel < 0",
      behavior: "Drifting down but structurally bullish. ADD ON DIPS.",
      color: "text-yellow-400",
      borderColor: "border-yellow-400",
      stars: "★★☆"
    },
    {
      name: "LIQUIDATION",
      condition: "Velocity < 0, Accel < 0, Vol High",
      behavior: "Panic selling. Waterfall price action. SHORT/CASH.",
      color: "text-red-500",
      borderColor: "border-red-500",
      stars: "★★★"
    },
    {
      name: "BEAR TRAP",
      condition: "Velocity < 0, Accel > 0",
      behavior: "Bears exhausted. Accel turning up. COVER SHORTS.",
      color: "text-cyan-400",
      borderColor: "border-cyan-400",
      stars: "★★☆"
    }
  ],
  visuals: [
    {
      title: "The Histogram (Velocity)",
      desc: "Vertical bars representing raw speed. Green = Strengthening, Red = Weakening.",
      icon: <BarChart3 className="w-4 h-4 text-primary" />
    },
    {
      title: "The Main Line (Acceleration)",
      desc: "The 'Gas Pedal'. Measures how fast velocity is changing. Can be negative even if velocity is positive (coasting).",
      icon: <Activity className="w-4 h-4 text-accent" />
    },
    {
      title: "Hindenburg Zones",
      desc: "Red Background = Crash Warning. Orange Background = Bear Trap (Shakeout).",
      icon: <ShieldAlert className="w-4 h-4 text-red-500" />
    }
  ]
};

const SOURCE_CODE = `//@version=6
indicator("Context Dashboard + Hindenburg [Smart]", shorttitle="Context [Smart]", overlay=false)

// =============================================================================
// 1. SETTINGS
// =============================================================================

// --- PHYSICS SETTINGS ---
grp_phy = "Context: Physics & Trend"
len_vel = input.int(20, "Velocity Lookback", group=grp_phy)
len_acc = input.int(10, "Acceleration Lookback", group=grp_phy)
smooth_acc = input.int(3, "Acceleration Smoothing", minval=1, group=grp_phy)
sqz_len = input.int(20, "Squeeze Lookback", group=grp_phy)

// ... (Full code available in repository)`;

export default function IndicatorContext() {
  const [activeTab, setActiveTab] = useState<"simulation" | "code" | "playbook">("simulation");
  const [simStep, setSimStep] = useState(0);

  // Simulation State
  const [regime, setRegime] = useState("NEUTRAL");
  const [velocity, setVelocity] = useState(0);
  const [acceleration, setAcceleration] = useState(0);
  const [hindenburg, setHindenburg] = useState(false);
  const [volatility, setVolatility] = useState("NORMAL");
  
  // Auto-cycle simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setSimStep((prev) => (prev + 1) % 5);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update simulation values based on step
  useEffect(() => {
    switch(simStep) {
      case 0: // POWER TREND
        setRegime("POWER TREND");
        setVelocity(25.5);
        setAcceleration(4.2);
        setHindenburg(false);
        setVolatility("HIGH");
        break;
      case 1: // CRUISE CONTROL
        setRegime("CRUISE CONTROL");
        setVelocity(15.0);
        setAcceleration(-0.5);
        setHindenburg(false);
        setVolatility("NORMAL");
        break;
      case 2: // BULLISH FLAGGING
        setRegime("BULLISH FLAGGING");
        setVelocity(5.2);
        setAcceleration(-1.2);
        setHindenburg(false);
        setVolatility("LOW");
        break;
      case 3: // LIQUIDATION
        setRegime("LIQUIDATION");
        setVelocity(-35.0);
        setAcceleration(-8.5);
        setHindenburg(true);
        setVolatility("EXTREME");
        break;
      case 4: // BEAR TRAP
        setRegime("BEAR TRAP");
        setVelocity(-10.0);
        setAcceleration(2.5);
        setHindenburg(false);
        setVolatility("HIGH");
        break;
    }
  }, [simStep]);

  const getRegimeColor = (r: string) => {
    switch(r) {
      case "POWER TREND": return "text-green-500";
      case "CRUISE CONTROL": return "text-green-400";
      case "BULLISH FLAGGING": return "text-yellow-400";
      case "LIQUIDATION": return "text-red-500";
      case "BEAR TRAP": return "text-cyan-400";
      default: return "text-white";
    }
  };

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background pt-20 pb-24 overflow-x-hidden">
      <Navbar />
      <div className="container px-4 md:px-6">
        
        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-4">
              <Link href="/indicator-library">
                <span className="text-primary hover:underline cursor-pointer">INDICATOR_LIBRARY</span>
              </Link>
              <span>/</span>
              <span>CONTEXT_DASHBOARD</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/50 rounded-none font-mono">
                v6.0
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">PHYSICS_ENGINE + HINDENBURG</span>
            </div>
            <pre className="text-primary font-mono text-xs md:text-sm leading-tight mb-4 overflow-x-auto">
{`█████████████████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█▀▀░█▀█░█▀█░▀█▀░█▀▀░█░█░▀█▀░░░█▀▀░█▄█░█▀█░█▀▄░▀█▀░░░░░░░░░█
█░░░░░░░░█░░░█░█░█░█░░█░░█▀▀░▄▀▄░░█░░░░▀▀█░█░█░█▀█░█▀▄░░█░░░░░░░░░░█
█░░░░░░░░▀▀▀░▀▀▀░▀░▀░░▀░░▀▀▀░▀░▀░░▀░░░░▀▀▀░▀░▀░▀░▀░▀░▀░░▀░░░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████████████████████████`}
            </pre>
            <p className="text-muted-foreground max-w-2xl">A physics engine for price action combined with a custom Hindenburg Omen to detect structural market fractures.</p>
          </div>
          
          {/* Navigation Buttons */}
          <div className="flex flex-wrap gap-2">
             <Button
               variant={activeTab === "simulation" ? "default" : "outline"}
               onClick={() => setActiveTab("simulation")}
               className="font-mono text-xs h-8"
             >
               <Activity className="w-3 h-3 mr-2" />
               SIM_DASHBOARD
             </Button>
             <Button
               variant={activeTab === "playbook" ? "default" : "outline"}
               onClick={() => setActiveTab("playbook")}
               className="font-mono text-xs h-8"
             >
               <FileText className="w-3 h-3 mr-2" />
               PLAYBOOK
             </Button>
             <Button
               variant={activeTab === "code" ? "default" : "outline"}
               onClick={() => setActiveTab("code")}
               className="font-mono text-xs h-8 whitespace-nowrap"
             >
               <Code2 className="w-3 h-3 mr-2" />
               SOURCE_CODE
             </Button>
             <Button className="bg-primary text-black hover:bg-primary/90 font-mono text-xs h-8 font-bold">
               GET_SCRIPT
             </Button>
          </div>
        </div>

        {/* CONTENT AREAS */}
        
        {/* 1. SIMULATION */}
        {activeTab === "simulation" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Visualizer */}
            <div className={`lg:col-span-2 bg-black border border-white/10 p-8 relative overflow-hidden min-h-[500px] flex flex-col justify-between transition-colors duration-500 ${regime === 'LIQUIDATION' ? 'bg-red-950/10' : ''}`}>
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
              
              {/* Top Bar */}
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="text-xs font-mono text-muted-foreground mb-1">HINDENBURG_STATUS</div>
                  <div className={`text-xl font-bold flex items-center gap-2 ${hindenburg ? "text-red-500 animate-pulse" : "text-green-500"}`}>
                    {hindenburg ? <ShieldAlert className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5 opacity-20" />}
                    {hindenburg ? "CRITICAL FAIL" : "STABLE"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-muted-foreground mb-1">MARKET_REGIME</div>
                  <div className={`text-4xl font-bold tracking-tighter ${getRegimeColor(regime)} transition-colors duration-500`}>
                    {regime}
                  </div>
                </div>
              </div>

              {/* Central Physics Visualization */}
              <div className="relative z-10 flex-1 flex items-center justify-center py-12 gap-12">
                {/* Velocity Gauge */}
                <div className="text-center">
                   <div className="relative w-40 h-40 border-4 border-white/10 rounded-full flex items-center justify-center mb-4">
                      <motion.div 
                        className={`absolute inset-0 rounded-full border-4 border-t-current border-r-transparent border-b-transparent border-l-transparent ${velocity > 0 ? "text-green-500" : "text-red-500"}`}
                        animate={{ rotate: velocity * 5 }}
                        transition={{ type: "spring", stiffness: 40 }}
                      />
                      <div className="text-3xl font-bold font-mono">{velocity.toFixed(1)}</div>
                   </div>
                   <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Velocity</div>
                </div>

                {/* Acceleration Gauge */}
                <div className="text-center">
                   <div className="relative w-40 h-40 border-4 border-white/10 rounded-full flex items-center justify-center mb-4">
                      <motion.div 
                        className={`absolute inset-0 rounded-full border-4 border-t-current border-r-transparent border-b-transparent border-l-transparent ${acceleration > 0 ? "text-cyan-400" : "text-yellow-500"}`}
                        animate={{ rotate: acceleration * 15 }}
                        transition={{ type: "spring", stiffness: 40 }}
                      />
                      <div className="text-3xl font-bold font-mono">{acceleration > 0 ? "+" : ""}{acceleration.toFixed(1)}</div>
                   </div>
                   <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Accel (Force)</div>
                </div>
              </div>

              {/* Action Banner */}
              <div className="relative z-10 border-t border-white/10 pt-6">
                 <div className="flex justify-between items-center">
                    <div>
                        <div className="text-xs font-mono text-muted-foreground mb-1">RECOMMENDED_ACTION</div>
                        <div className={`text-2xl font-bold font-mono ${getRegimeColor(regime)}`}>
                            {regime === "POWER TREND" && "AGGRESSIVE LONG"}
                            {regime === "CRUISE CONTROL" && "HOLD POSITIONS"}
                            {regime === "BULLISH FLAGGING" && "ADD ON DIPS"}
                            {regime === "LIQUIDATION" && "HARD SHORT / CASH"}
                            {regime === "BEAR TRAP" && "COVER SHORTS / LONG"}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono text-muted-foreground mb-1">CONVICTION</div>
                        <div className="text-yellow-400 tracking-widest">
                            {regime === "POWER TREND" && "★★★"}
                            {regime === "CRUISE CONTROL" && "★★☆"}
                            {regime === "BULLISH FLAGGING" && "★★☆"}
                            {regime === "LIQUIDATION" && "★★★"}
                            {regime === "BEAR TRAP" && "★★☆"}
                        </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Logic Legend */}
            <div className="space-y-4">
              <h3 className="font-bold font-mono text-lg mb-4">LOGIC_MATRIX</h3>
              {PLAYBOOK.regimes.map((r) => (
                <div 
                  key={r.name}
                  className={`p-4 border ${regime === r.name ? r.borderColor + " bg-white/5" : "border-white/5"} transition-all duration-300`}
                >
                  <div className="flex justify-between items-start mb-1">
                      <div className={`font-bold font-mono ${r.color}`}>{r.name}</div>
                      <div className="text-[10px] text-yellow-500">{r.stars}</div>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-2">{r.condition}</div>
                  <div className="text-sm text-white leading-tight">{r.behavior}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. PLAYBOOK */}
        {activeTab === "playbook" && (
          <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Overview */}
             <section>
                <h2 className="text-3xl font-bold mb-4 text-white">Context Dashboard + Hindenburg [Smart] · Complete Playbook</h2>
                <div className="prose prose-invert max-w-none text-muted-foreground">
                  <p className="text-lg leading-relaxed">
                    This indicator answers: "What is the market actually doing, and is it internally healthy?" It combines two powerful systems: a Physics Engine that treats price like a moving object, and the Hindenburg Omen for detecting internal market fractures.
                  </p>
                  <p className="mt-4">
                    The philosophy: Price can lie, but internals don't. A market making new highs while internally fracturing is a crash waiting to happen. This dashboard exposes that divergence.
                  </p>
                </div>
             </section>

             {/* Part 1: Physics Engine */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <Wind className="w-5 h-5" /> Part 1: The Physics Engine
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                   <div className="bg-white/5 border border-white/10 p-6">
                      <h4 className="font-bold text-white mb-2">Velocity</h4>
                      <p className="text-sm text-muted-foreground">Rate of price change. Like a speedometer. Positive = Rising, Negative = Falling.</p>
                   </div>
                   <div className="bg-white/5 border border-white/10 p-6">
                      <h4 className="font-bold text-white mb-2">Acceleration</h4>
                      <p className="text-sm text-muted-foreground">Change in velocity. The "Gas Pedal". Can be negative even if velocity is positive (coasting).</p>
                   </div>
                   <div className="bg-white/5 border border-white/10 p-6">
                      <h4 className="font-bold text-white mb-2">Jerk (G-Force)</h4>
                      <p className="text-sm text-muted-foreground">Sudden shock/jerk in momentum. Detects violent shifts before price fully reacts.</p>
                   </div>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-white/5 text-xs uppercase font-mono text-muted-foreground">
                       <tr>
                         <th className="p-4">Velocity</th>
                         <th className="p-4">Acceleration</th>
                         <th className="p-4">Regime</th>
                         <th className="p-4">Meaning</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5 text-white">
                       <tr>
                         <td className="p-4 text-green-500">+ Rising</td>
                         <td className="p-4 text-green-500">+ Speeding Up</td>
                         <td className="p-4 font-bold text-green-500">POWER TREND</td>
                         <td className="p-4 text-muted-foreground">Strong bullish momentum · ride it</td>
                       </tr>
                       <tr>
                         <td className="p-4 text-green-500">+ Rising</td>
                         <td className="p-4 text-red-500">- Slowing</td>
                         <td className="p-4 font-bold text-green-400">CRUISE CONTROL</td>
                         <td className="p-4 text-muted-foreground">Still up, but decelerating · hold, don't add</td>
                       </tr>
                       <tr>
                         <td className="p-4 text-red-500">- Falling</td>
                         <td className="p-4 text-red-500">- Speeding Down</td>
                         <td className="p-4 font-bold text-red-500">LIQUIDATION</td>
                         <td className="p-4 text-muted-foreground">Bearish momentum · avoid longs</td>
                       </tr>
                       <tr>
                         <td className="p-4 text-red-500">- Falling</td>
                         <td className="p-4 text-green-500">+ Slowing Fall</td>
                         <td className="p-4 font-bold text-cyan-400">BEAR TRAP</td>
                         <td className="p-4 text-muted-foreground">Selling exhaustion · reversal zone</td>
                       </tr>
                     </tbody>
                   </table>
                </div>
             </section>

             {/* Part 2: Hindenburg Omen */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" /> Part 2: Hindenburg Omen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="prose prose-invert text-sm text-muted-foreground">
                      <p className="mb-4">
                        The Hindenburg Omen is a market breadth indicator that detects internal stress before corrections. It triggers when the market is confused: New Highs and New Lows are BOTH expanding simultaneously.
                      </p>
                      <h4 className="text-white font-bold mb-2">Smart Logic Integration</h4>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>
                          <span className="text-orange-400 font-bold">STRUCTURAL TRAP:</span> Hindenburg Active + Positive Velocity. Market is fracturing but momentum is still up. Caution.
                        </li>
                        <li>
                          <span className="text-red-500 font-bold">CRASH WARNING:</span> Hindenburg Active + Negative Velocity. Internals broken AND momentum confirms. Defensive posture.
                        </li>
                      </ul>
                   </div>
                   <div className="bg-white/5 border border-white/10 p-6">
                      <h4 className="font-bold text-white mb-4">The 4 Conditions (All Must Be True)</h4>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-muted-foreground">McClellan Oscillator &lt; 0 (Negative Breadth)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-muted-foreground">New Highs ≥ 2.2% AND New Lows ≥ 2.2% (Confusion)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-muted-foreground">New Highs &lt; 2x New Lows (Bearish Skew)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-muted-foreground">Price &gt; Price 50 days ago (Uptrend)</span>
                        </li>
                      </ul>
                   </div>
                </div>
             </section>

             {/* Integration Scenarios */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <Layers className="w-5 h-5" /> Integration with Other Indicators
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-white/5 border border-white/10 p-4">
                      <div className="text-xs font-mono text-muted-foreground mb-2">WITH S/D ZONES</div>
                      <div className="font-bold text-white mb-1">POWER TREND + Demand Zone</div>
                      <div className="text-sm text-green-400">Maximum conviction long.</div>
                   </div>
                   <div className="bg-white/5 border border-white/10 p-4">
                      <div className="text-xs font-mono text-muted-foreground mb-2">WITH MACRO TRUTH</div>
                      <div className="font-bold text-white mb-1">CRASH WARNING + Below M5</div>
                      <div className="text-sm text-red-500">Avoid · trend and internals both broken</div>
                   </div>
                   <div className="bg-white/5 border border-white/10 p-4">
                      <div className="text-xs font-mono text-muted-foreground mb-2">WITH LUMINA</div>
                      <div className="font-bold text-white mb-1">BEAR TRAP + Bull Trigger</div>
                      <div className="text-sm text-cyan-400">Highest conviction reversal long.</div>
                   </div>
                </div>
             </section>

             {/* Key Takeaways */}
             <section>
                <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                  <GaugeCircle className="w-5 h-5" /> Key Takeaways
                </h3>
                <ul className="space-y-3 text-muted-foreground list-disc pl-5">
                   <li>Velocity tells you direction; Acceleration tells you conviction. Both matter.</li>
                   <li>Aqua Zone (Bear Trap) is a reversal signal. Velocity negative + Acceleration positive = selling exhaustion.</li>
                   <li>CRASH WARNING is the highest alert. Both internals AND momentum confirm: respect it.</li>
                   <li>Smart context matters. Hindenburg + positive velocity = potential trap, not confirmed crash.</li>
                   <li>Internal Health is binary. STABLE means proceed normally. CRITICAL FAIL means all bets have elevated risk.</li>
                </ul>
             </section>

          </div>
        )}

        {/* 3. CODE */}
        {activeTab === "code" && (
          <div className="relative">
            <div className="absolute top-0 right-0 p-4">
              <button className="bg-primary text-black px-4 py-2 font-mono text-xs font-bold hover:bg-white transition-colors">
                COPY_TO_CLIPBOARD
              </button>
            </div>
            <pre className="bg-black border border-white/10 p-6 overflow-x-auto font-mono text-xs leading-relaxed text-gray-300">
              <code>{SOURCE_CODE}</code>
            </pre>
            <div className="mt-4 text-center">
               <p className="text-muted-foreground text-sm">
                 * Full source code is available in the repository or via the "Get Script" button.
               </p>
            </div>
          </div>
        )}

        <PlaybookCTA />

        <LegalFooter />
      </div>
    </div>
  );
}