import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Crosshair, 
  Zap, 
  Activity, 
  Target, 
  MousePointerClick, 
  Settings2, 
  Timer,
  Eye,
  EyeOff,
  Info,
  CheckSquare
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";
import { Link } from "wouter";
import { PlaybookCTA } from "@/components/playbook-cta";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot
} from "recharts";

// --- TYPES ---

type SignalType = "REGULAR_BEAR" | "REGULAR_BULL" | "HIDDEN_BEAR" | "HIDDEN_BULL" | "NONE";
type TriggerState = "WAITING" | "WINDOW_OPEN" | "FIRED";

interface DataPoint {
  index: number;
  price: number;
  tsi: number; // Momentum Value
  signal: number; // Momentum Signal Line
  divergence: SignalType;
  isTrigger: boolean;
  validityWindowOpen: boolean;
}

// --- CONSTANTS ---

const VALIDITY_WINDOW = 40; // bars

// --- MOCK DATA GENERATOR ---

const generateData = (scenario: "BULL_SETUP" | "BEAR_SETUP" | "TREND_CONTINUATION"): DataPoint[] => {
  const points = 100;
  const data: DataPoint[] = [];
  
  let price = 100;
  let tsi = 0;
  let signal = 0;
  
  for (let i = 0; i < points; i++) {
    const progress = i / points;
    let divType: SignalType = "NONE";
    let isTrigger = false;
    let validityOpen = false;

    // Scenario Logic
    if (scenario === "BULL_SETUP") {
      // Price making lower lows, Momentum making higher lows
      if (i < 40) { price -= 1; tsi -= 1.5; } // Initial drop
      else if (i < 60) { price += 0.5; tsi += 2; } // Small bounce
      else if (i < 80) { 
        price -= 1.2; // LOWER LOW in Price
        tsi -= 0.5;   // HIGHER LOW in Momentum (Divergence)
        if (i === 80 - 1) divType = "REGULAR_BULL"; 
      } 
      else { 
        price += 2; 
        tsi += 3; 
        // Trigger happens after div
        if (i === 85) isTrigger = true;
      }
      
      // Validity Window Logic (simplified for mock)
      if (i >= 80 && i < 80 + VALIDITY_WINDOW) validityOpen = true;
    } 
    else if (scenario === "BEAR_SETUP") {
      // Price higher highs, Momentum lower highs
      if (i < 40) { price += 1; tsi += 1.5; }
      else if (i < 60) { price -= 0.5; tsi -= 2; }
      else if (i < 80) { 
        price += 1.2; // HIGHER HIGH
        tsi += 0.5;   // LOWER HIGH (Div)
        if (i === 80 - 1) divType = "REGULAR_BEAR";
      }
      else {
        price -= 2;
        tsi -= 3;
        if (i === 85) isTrigger = true;
      }
      if (i >= 80 && i < 80 + VALIDITY_WINDOW) validityOpen = true;
    }
    else if (scenario === "TREND_CONTINUATION") {
      // Hidden Bull: Price Higher Low, Momentum Lower Low
      if (i < 30) { price += 1; tsi += 1; } // Strong trend up
      else if (i < 60) { 
        price -= 0.3; // Shallow pullback (Higher Low)
        tsi -= 2;     // Deep momentum reset (Lower Low)
        if (i === 60 - 1) divType = "HIDDEN_BULL";
      }
      else {
        price += 2;
        tsi += 4;
        if (i === 65) isTrigger = true;
      }
      if (i >= 60 && i < 60 + VALIDITY_WINDOW) validityOpen = true;
    }

    // Smoothing signal line
    signal = tsi * 0.8; 

    data.push({
      index: i,
      price,
      tsi,
      signal,
      divergence: divType,
      isTrigger,
      validityWindowOpen: validityOpen
    });
  }
  return data;
};

// --- COMPONENT ---

import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function IndicatorLumina() {
  const [activeScenario, setActiveScenario] = useState<"BULL_SETUP" | "BEAR_SETUP" | "TREND_CONTINUATION">("BULL_SETUP");
  const [strictMode, setStrictMode] = useState(true);
  const [activeTab, setActiveTab] = useState<"CHART" | "PLAYBOOK">("CHART");

  const data = useMemo(() => generateData(activeScenario), [activeScenario]);

  // Find key points for annotations
  const divPoint = data.find(d => d.divergence !== "NONE");
  const triggerPoint = data.find(d => d.isTrigger);

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
              <span>LUMINA_SIGNALS</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/50 rounded-none font-mono">
                v9.0
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">FLEXIBLE_CONFLUENCE</span>
            </div>
            <pre className="font-mono text-sm text-primary/90 leading-tight whitespace-pre mb-4 overflow-x-auto">
{`███████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█░░░█░█░█▄█░▀█▀░█▀█░█▀█░░░░░░░░░░░█
█░░░░░░░░█░░░█░█░█░█░░█░░█░█░█▀█░░░░░░░░░░░█
█░░░░░░░░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀░▀░▀░░░░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
███████████████████████████████████████████████`}
            </pre>
            <p className="text-muted-foreground mt-2 max-w-2xl">Uses a probability stack of Divergence + Validity Window + Momentum Cross to execute precise entries.</p>
          </div>
          
          <div className="flex gap-2">
             <Button 
               variant={activeTab === "CHART" ? "default" : "outline"}
               onClick={() => setActiveTab("CHART")}
               className="font-mono text-xs h-8"
             >
               <Activity className="w-3 h-3 mr-2" />
               SIM_SIGNALS
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
          <>
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-6">
              
              {/* Scenarios */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                 <button 
                   onClick={() => setActiveScenario("BULL_SETUP")}
                   className={`p-4 border text-left transition-all ${activeScenario === "BULL_SETUP" ? "border-green-500 bg-green-500/10" : "border-border bg-card/50 opacity-50 hover:opacity-100"}`}
                 >
                   <div className="text-xs font-mono text-muted-foreground mb-1">SCENARIO 1</div>
                   <div className="font-bold text-sm md:text-base text-white">Reversal Long</div>
                   <div className="text-[10px] text-green-400 mt-1">Reg Bull Div + Trigger</div>
                 </button>
                 
                 <button 
                   onClick={() => setActiveScenario("BEAR_SETUP")}
                   className={`p-4 border text-left transition-all ${activeScenario === "BEAR_SETUP" ? "border-red-500 bg-red-500/10" : "border-border bg-card/50 opacity-50 hover:opacity-100"}`}
                 >
                   <div className="text-xs font-mono text-muted-foreground mb-1">SCENARIO 2</div>
                   <div className="font-bold text-sm md:text-base text-white">Reversal Short</div>
                   <div className="text-[10px] text-red-400 mt-1">Reg Bear Div + Trigger</div>
                 </button>
    
                 <button 
                   onClick={() => setActiveScenario("TREND_CONTINUATION")}
                   className={`p-4 border text-left transition-all ${activeScenario === "TREND_CONTINUATION" ? "border-blue-500 bg-blue-500/10" : "border-border bg-card/50 opacity-50 hover:opacity-100"}`}
                 >
                   <div className="text-xs font-mono text-muted-foreground mb-1">SCENARIO 3</div>
                   <div className="font-bold text-sm md:text-base text-white">Trend Continuation</div>
                   <div className="text-[10px] text-blue-400 mt-1">Hidden Div + Trigger</div>
                 </button>
              </div>
    
              {/* Settings Toggles */}
              <div className="w-full md:w-64 space-y-4 p-4 border border-border bg-card/30">
                <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                   <Settings2 className="w-4 h-4" /> SIGNAL LOGIC
                </div>
                
                <div className="flex items-center justify-between">
                   <span className="text-xs text-muted-foreground">Strict Mode</span>
                   <Switch checked={strictMode} onCheckedChange={setStrictMode} />
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Only fires if Divergence exists within window.
                </div>
    
                <div className="pt-4 border-t border-white/10">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="validity-window" className="border-b-0">
                      <AccordionTrigger className="text-xs text-muted-foreground py-2 hover:no-underline hover:text-white">
                        What is "Validity Window"?
                      </AccordionTrigger>
                      <AccordionContent className="text-[10px] text-muted-foreground leading-relaxed">
                        <p className="mb-2">
                          <strong className="text-white">The "Kill Zone" for trades.</strong>
                        </p>
                        A divergence signal is not a buy signal immediately. It opens a 40-bar "Window of Opportunity". We only enter if momentum crosses the signal line *while* this window is open. If the window closes without a trigger, the setup is invalidated.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </div>
    
            {/* CHART SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-1 bg-black border-border relative h-[400px] overflow-hidden">
                   <div className="absolute top-4 left-4 z-10">
                     <Badge variant="outline" className="bg-black/50 backdrop-blur text-white border-white/20">PRICE ACTION</Badge>
                   </div>
    
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                       
                       {/* Trigger Background Flash - Strict Mode (Before R) */}
                       {triggerPoint && strictMode && divPoint && (
                         <ReferenceArea 
                           x1={divPoint.index - 8} 
                           x2={divPoint.index - 2} 
                           fill={activeScenario.includes("BULL") || activeScenario.includes("CONTINUATION") ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)"} 
                           label={{ value: "❌", position: "center", fill: "white", fontSize: 14 }}
                         />
                       )}
    
                       <Line 
                         type="monotone" 
                         dataKey="price" 
                         stroke="#fff" 
                         strokeWidth={2} 
                         dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.divergence === "REGULAR_BULL") return <text x={cx} y={cy + 20} fill="#4ade80" fontSize={12} fontWeight="bold" textAnchor="middle">R</text>;
                            if (payload.divergence === "REGULAR_BEAR") return <text x={cx} y={cy - 10} fill="#f87171" fontSize={12} fontWeight="bold" textAnchor="middle">R</text>;
                            if (payload.divergence === "HIDDEN_BULL") return <text x={cx} y={cy + 20} fill="#60a5fa" fontSize={12} fontWeight="bold" textAnchor="middle">H</text>;
                            return <circle cx={cx} cy={cy} r={0} />;
                         }}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                </Card>
    
                {/* MOMENTUM OSCILLATOR CHART */}
                <Card className="p-1 bg-black border-border relative h-[200px] overflow-hidden">
                   <div className="absolute top-2 left-4 z-10">
                     <Badge variant="outline" className="bg-black/50 backdrop-blur text-muted-foreground border-white/10 text-[10px]">MOMENTUM ENGINE (TSI)</Badge>
                   </div>
                   
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={data} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
    
                        <Line type="monotone" dataKey="tsi" stroke="#fff" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="signal" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="3 3" />
    
                     </LineChart>
                   </ResponsiveContainer>
                </Card>
              </div>
    
              {/* EXPLANATION PANEL */}
              <div className="space-y-6">
                 <div className="bg-card border border-border p-6 h-full">
                    <div className="flex items-center gap-2 mb-6 text-primary">
                      <Target className="w-5 h-5" />
                      <h3 className="font-bold uppercase tracking-wider">The Probability Stack</h3>
                    </div>
    
                    <div className="space-y-6 relative">
                      {/* Connecting Line */}
                      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10 -z-10" />
    
                      {/* Step 1: Divergence */}
                      <div className={`flex gap-4 items-start transition-opacity ${divPoint ? 'opacity-100' : 'opacity-30'}`}>
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${divPoint ? 'bg-primary text-black' : 'bg-muted text-muted-foreground'}`}>1</div>
                         <div>
                           <h4 className="text-sm font-bold text-white">Divergence Detected</h4>
                           <p className="text-xs text-muted-foreground mt-1">
                             {activeScenario === "BULL_SETUP" && "Price Lower Low vs Momentum Higher Low (Reversal)."}
                             {activeScenario === "BEAR_SETUP" && "Price Higher High vs Momentum Lower High (Reversal)."}
                             {activeScenario === "TREND_CONTINUATION" && "Price Higher Low vs Momentum Lower Low (Continuation)."}
                           </p>
                         </div>
                      </div>
    
                      {/* Step 2: Validity Window */}
                      <div className={`flex gap-4 items-start transition-opacity ${divPoint ? 'opacity-100' : 'opacity-30'}`}>
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${divPoint ? 'bg-blue-500 text-black' : 'bg-muted text-muted-foreground'}`}>2</div>
                         <div>
                           <h4 className="text-sm font-bold text-white">Validity Window Open</h4>
                           <p className="text-xs text-muted-foreground mt-1">
                             Wait for confirmation. Do not enter yet. The signal is valid for 40 bars.
                           </p>
                         </div>
                      </div>
    
                      {/* Step 3: Trigger */}
                      <div className={`flex gap-4 items-start transition-opacity ${triggerPoint ? 'opacity-100' : 'opacity-30'}`}>
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${triggerPoint ? 'bg-green-500 text-black' : 'bg-muted text-muted-foreground'}`}>3</div>
                         <div>
                           <h4 className="text-sm font-bold text-white">Momentum Trigger</h4>
                           <p className="text-xs text-muted-foreground mt-1">
                             TSI Crosses Signal Line. Divergence confirmed.
                           </p>
                           {triggerPoint && (
                             <Badge variant="default" className="bg-green-500 text-black hover:bg-white mt-2">
                               EXECUTE TRADE
                             </Badge>
                           )}
                         </div>
                      </div>
    
                    </div>
                 </div>
              </div>
    
            </div>
          </>
        ) : (
          // PLAYBOOK TAB
          (<div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Overview */}
            <section>
               <h2 className="text-3xl font-bold mb-4 text-white">Lumina V9: Flexible Confluence · Complete Playbook</h2>
               <div className="prose prose-invert max-w-none text-muted-foreground">
                 <p className="text-lg leading-relaxed">
                   This indicator is a momentum-based signal generator that fires high-probability triggers by combining TSI (True Strength Index), Divergence Detection, Validity Windows, and Money Flow filters.
                 </p>
                 <p className="mt-4">
                   The philosophy: Divergence alone isn't a signal, it's a setup. This indicator waits for momentum confirmation (TSI cross) after divergence appears, creating a two-stage trigger system that filters out noise.
                 </p>
               </div>
            </section>
            {/* Core Concept */}
            <section>
               <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                 <Zap className="w-5 h-5" /> Core Concept: The Two-Stage System
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="bg-white/5 border-white/10 p-6">
                   <h4 className="font-bold text-white mb-2">Stage 1: Setup</h4>
                   <p className="text-sm text-muted-foreground">
                     Divergence detected (R or H label). This is the "Get Ready" signal. Do not enter yet.
                   </p>
                   <div className="mt-4 flex gap-2">
                     <Badge variant="outline" className="text-green-400 border-green-400/30">R (Bull Div)</Badge>
                     <Badge variant="outline" className="text-red-400 border-red-400/30">R (Bear Div)</Badge>
                   </div>
                 </Card>
                 <Card className="bg-white/5 border-white/10 p-6">
                   <h4 className="font-bold text-white mb-2">Stage 2: Trigger</h4>
                   <p className="text-sm text-muted-foreground">
                     TSI crosses signal line from extreme zone. This is the "Go" signal. Only fires if a divergence happened recently (within Validity Window).
                   </p>
                   <div className="mt-4 flex gap-2">
                     <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-400/30">X MARKER (ENTRY)</Badge>
                   </div>
                 </Card>
               </div>
            </section>
            {/* Component Breakdown */}
            <section>
               <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                 <Activity className="w-5 h-5" /> Component Breakdown
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 1. TSI */}
                  <Card className="bg-white/5 border-white/10 p-6">
                     <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">1</div>
                        <h4 className="font-bold text-white">TSI Engine</h4>
                     </div>
                     <p className="text-sm text-muted-foreground mb-4">
                       Double-smoothed momentum oscillator.
                     </p>
                     <div className="space-y-2 text-sm">
                       <div className="flex justify-between border-b border-white/5 pb-1">
                          <span>Overbought</span>
                          <span className="text-red-500 font-bold">&gt; +25</span>
                       </div>
                       <div className="flex justify-between border-b border-white/5 pb-1">
                          <span>Oversold</span>
                          <span className="text-green-500 font-bold">&lt; -15</span>
                       </div>
                     </div>
                  </Card>

                  {/* 2. Divergence */}
                  <Card className="bg-white/5 border-white/10 p-6">
                     <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">2</div>
                        <h4 className="font-bold text-white">Divergence</h4>
                     </div>
                     <p className="text-sm text-muted-foreground mb-4">
                       Scans for disconnects between price and momentum.
                     </p>
                     <div className="space-y-2 text-sm">
                       <div className="flex justify-between border-b border-white/5 pb-1">
                          <span>Regular (R)</span>
                          <span className="text-white font-bold">Reversal</span>
                       </div>
                       <div className="flex justify-between border-b border-white/5 pb-1">
                          <span>Hidden (H)</span>
                          <span className="text-white font-bold">Continuation</span>
                       </div>
                     </div>
                  </Card>

                  {/* 3. Validity Window */}
                  <Card className="bg-white/5 border-white/10 p-6">
                     <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">3</div>
                        <h4 className="font-bold text-white">Validity Window</h4>
                     </div>
                     <p className="text-sm text-muted-foreground mb-4">
                       Links cause (divergence) to effect (trigger).
                     </p>
                     <div className="space-y-2 text-sm">
                       <div className="flex justify-between border-b border-white/5 pb-1">
                          <span>Default</span>
                          <span className="text-white font-bold">40 Bars</span>
                       </div>
                       <div className="flex justify-between">
                          <span>Strict Mode</span>
                          <span className="text-white font-bold">ON</span>
                       </div>
                     </div>
                  </Card>
               </div>
            </section>
            {/* Practical Application */}
            <section>
               <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                 <Target className="w-5 h-5" /> Practical Application
               </h3>
               <div className="space-y-4">
                  <Card className="bg-white/5 border-white/10 p-4">
                     <h4 className="font-bold text-white mb-1">Signal Quality Matrix</h4>
                     <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left mt-2">
                         <thead className="text-xs uppercase text-muted-foreground bg-white/5">
                           <tr>
                             <th className="p-2">Setup</th>
                             <th className="p-2">Trigger</th>
                             <th className="p-2">Quality</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-white/5">
                           <tr>
                             <td className="p-2">Regular Div</td>
                             <td className="p-2">Within 10 bars</td>
                             <td className="p-2 text-green-400 font-bold">★★★ Highest Conviction</td>
                           </tr>
                           <tr>
                             <td className="p-2">Regular Div</td>
                             <td className="p-2">Within 20-40 bars</td>
                             <td className="p-2 text-yellow-400 font-bold">★★ Good</td>
                           </tr>
                           <tr>
                             <td className="p-2">Hidden Div</td>
                             <td className="p-2">Anytime</td>
                             <td className="p-2 text-blue-400 font-bold">★★ Trend Continuation</td>
                           </tr>
                           <tr>
                             <td className="p-2">No Div (Strict OFF)</td>
                             <td className="p-2">Anytime</td>
                             <td className="p-2 text-muted-foreground">★ Momentum Only</td>
                           </tr>
                         </tbody>
                       </table>
                     </div>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-green-500/10 border-green-500/20 p-4">
                       <h4 className="font-bold text-green-400 mb-2">Bull Trigger Entry</h4>
                       <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
                         <li><strong className="text-white">Aggressive:</strong> Enter on trigger bar close.</li>
                         <li><strong className="text-white">Conservative:</strong> Wait for next candle to close above trigger bar high.</li>
                         <li><strong className="text-white">Stop Loss:</strong> Below the divergence low (R label bar).</li>
                       </ul>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/20 p-4">
                       <h4 className="font-bold text-red-400 mb-2">Bear Trigger Entry</h4>
                       <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
                         <li><strong className="text-white">Aggressive:</strong> Enter on trigger bar close.</li>
                         <li><strong className="text-white">Conservative:</strong> Wait for next candle to close below trigger bar low.</li>
                         <li><strong className="text-white">Stop Loss:</strong> Above the divergence high (R label bar).</li>
                       </ul>
                    </Card>
                  </div>
               </div>
            </section>
            {/* Key Takeaways */}
            <section>
               <h3 className="text-xl font-bold mb-4 text-primary flex items-center gap-2">
                 <CheckSquare className="w-5 h-5" /> Key Takeaways
               </h3>
               <ul className="space-y-3 text-muted-foreground list-disc pl-5">
                  <li>Divergence = Setup, Trigger = Action. Don't act on divergence alone.</li>
                  <li>The Validity Window is crucial. Too short and you miss valid setups. Too long and you act on stale divergences.</li>
                  <li>-15 oversold is bull-market tuned. In bear markets, consider lowering to -25 for more extreme readings.</li>
                  <li>Hidden divergences are continuation signals. Use them to add to winning positions, not counter-trend.</li>
               </ul>
            </section>
            <PlaybookCTA />
          </div>)
        )}

        <LegalFooter />
      </div>
    </div>
  );
}
