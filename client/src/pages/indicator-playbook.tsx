import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { PlaybookCTA } from "@/components/playbook-cta";
import { 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Target, 
  ShieldCheck, 
  Activity, 
  BarChart3, 
  Layers, 
  Zap, 
  ShieldAlert,
  BookOpen
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DecisionFlow } from "@/components/playbook/decision-flow";
import { PhysicsRegimeMap } from "@/components/playbook/physics-regime-map";
import { QuickReference } from "@/components/playbook/quick-reference";
import { ZoneAnatomy } from "@/components/playbook/zone-anatomy";

export default function IndicatorPlaybook() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Navbar />
      <div className="container px-4 md:px-6 mx-auto space-y-12 pt-20 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-4">
              <Link href="/indicator-library">
                <span className="text-primary hover:underline cursor-pointer">INDICATOR_LIBRARY</span>
              </Link>
              <span>/</span>
              <span>SYSTEM_PLAYBOOK</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/50 rounded-none font-mono">
                MASTER_GUIDE
              </Badge>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase text-white">
              The Complete <span className="text-stroke-primary">System</span>
            </h1>
            <p className="text-muted-foreground mt-2 max-w-3xl text-lg">
              Unified Indicator Playbook. A layered decision framework moving from macro context down to precise execution.
            </p>
          </div>
        </div>

        {/* CTA Buttons Grid - Top Navigation */}
        <div className="space-y-4">
          {/* MORE Indicator */}
          <div className="flex justify-center">
            <div className="font-mono text-xs text-muted-foreground/60 flex items-center gap-2 animate-pulse">
              <span>MORE</span>
              <span>↓</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Sector Rotation Button */}
            <Link href="/sector-rotation">
              <div className="group cursor-pointer bg-black border-2 border-blue-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300 hover:border-blue-500 hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:scale-105 h-full">
                <div className="font-mono text-xs text-blue-500/90 leading-tight transition-colors duration-300 group-hover:text-blue-400 space-y-2">
                  <div className="text-center font-bold">→ $ SECTOR_ROTATION</div>
                  <div className="text-blue-400/70 text-center text-xs">Macro rotation analysis</div>
                  <div className="text-blue-500/50 text-center">[ENTER]</div>
                </div>
              </div>
            </Link>

            {/* Divergence Dashboard Button */}
            <Link href="/divergence-dashboard">
              <div className="group cursor-pointer bg-black border-2 border-purple-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all duration-300 hover:border-purple-500 hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] hover:scale-105 h-full">
                <div className="font-mono text-xs text-purple-500/90 leading-tight transition-colors duration-300 group-hover:text-purple-400 space-y-2">
                  <div className="text-center font-bold">→ ◊ MOMENTUM_TERMINAL</div>
                  <div className="text-purple-400/70 text-center text-xs">Company regime analysis</div>
                  <div className="text-purple-500/50 text-center">[ENTER]</div>
                </div>
              </div>
            </Link>

            {/* Ratio Relevance Button */}
            <Link href="/ratio-relevance">
              <div className="group cursor-pointer bg-black border-2 border-cyan-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all duration-300 hover:border-cyan-500 hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] hover:scale-105 h-full">
                <div className="font-mono text-xs text-cyan-500/90 leading-tight transition-colors duration-300 group-hover:text-cyan-400 space-y-2">
                  <div className="text-center font-bold">→ ◊ RATIO_RELEVANCE</div>
                  <div className="text-cyan-400/70 text-center text-xs">Capital flow analysis</div>
                  <div className="text-cyan-500/50 text-center">[ENTER]</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* VISUAL DECISION FLOW */}
        <section className="space-y-8">
          <div className="group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-all duration-300">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">System Architecture</h2>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent rounded-full"></div>
          </div>
          
          {/* Using new Visual Component */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <DecisionFlow />
          </div>

          {/* Original Text Content for Detail/Nuance Preservation */}
          <div className="grid gap-4 max-w-4xl mx-auto relative mt-12 opacity-80">
            <div className="flex items-center gap-2 mb-4">
               <Badge variant="outline">DETAILED BREAKDOWN</Badge>
               <span className="text-xs text-muted-foreground uppercase tracking-widest">Key Components per Layer</span>
            </div>
            
            {/* Connecting Line */}
            <div className="absolute left-8 top-12 bottom-8 w-0.5 bg-gradient-to-b from-primary/50 to-primary/10 hidden md:block" />

            {/* Layer 1 */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative md:pl-20"
            >
              <div className="hidden md:flex absolute left-6 top-8 w-4 h-4 bg-primary rounded-full items-center justify-center z-10 ring-4 ring-background">
                <div className="w-2 h-2 bg-black rounded-full" />
              </div>
              <Card className="p-6 bg-black border-primary/30 hover:border-primary/60 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-primary">LAYER 1: MACRO ENVIRONMENT</h3>
                    <p className="text-sm text-muted-foreground">"Should I be trading at all? Which direction?"</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Macro Data</Badge>
                    <Badge variant="secondary">Risk Dashboard</Badge>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Q20/M5 Trend</li>
                    <li>Quarterly Fibs</li>
                    <li>VIX Velocity</li>
                    <li>Breadth (Net H/L)</li>
                  </ul>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Risk Score (0-100)</li>
                    <li>Fragility (VIX)</li>
                    <li>Tail Risk (SKEW)</li>
                    <li>VIX Regime</li>
                  </ul>
                </div>
              </Card>
            </motion.div>

            {/* Layer 2 */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative md:pl-20"
            >
              <div className="hidden md:flex absolute left-6 top-8 w-4 h-4 bg-blue-500 rounded-full items-center justify-center z-10 ring-4 ring-background">
                <div className="w-2 h-2 bg-black rounded-full" />
              </div>
              <Card className="p-6 bg-black border-blue-500/30 hover:border-blue-500/60 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-blue-500">LAYER 2: MARKET REGIME & INTERNALS</h3>
                    <p className="text-sm text-muted-foreground">"What mode is the market in? Are internals healthy?"</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Context Dashboard</Badge>
                  </div>
                </div>
                <div className="grid md:grid-cols-1 gap-4 text-sm text-muted-foreground">
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Physics Regime (Velocity + Acceleration)</li>
                    <li>Internal Health (Hindenburg Omen)</li>
                    <li>G-Force / Squeeze Detection</li>
                  </ul>
                </div>
              </Card>
            </motion.div>

            {/* Layer 3 */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative md:pl-20"
            >
              <div className="hidden md:flex absolute left-6 top-8 w-4 h-4 bg-purple-500 rounded-full items-center justify-center z-10 ring-4 ring-background">
                <div className="w-2 h-2 bg-black rounded-full" />
              </div>
              <Card className="p-6 bg-black border-purple-500/30 hover:border-purple-500/60 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-purple-500">LAYER 3: STRUCTURE & LEVELS</h3>
                    <p className="text-sm text-muted-foreground">"Where are the high-probability levels?"</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Institutional S/D</Badge>
                  </div>
                </div>
                <div className="grid md:grid-cols-1 gap-4 text-sm text-muted-foreground">
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Supply/Demand Zones (Quality Scored)</li>
                    <li>HTF Confluence & Liquidity Sweeps</li>
                    <li>Volume Profile Integration</li>
                  </ul>
                </div>
              </Card>
            </motion.div>

            {/* Layer 4 */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="relative md:pl-20"
            >
              <div className="hidden md:flex absolute left-6 top-8 w-4 h-4 bg-yellow-500 rounded-full items-center justify-center z-10 ring-4 ring-background">
                <div className="w-2 h-2 bg-black rounded-full" />
              </div>
              <Card className="p-6 bg-black border-yellow-500/30 hover:border-yellow-500/60 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-yellow-500">LAYER 4: EXECUTION SIGNALS</h3>
                    <p className="text-sm text-muted-foreground">"When exactly do I pull the trigger?"</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Lumina Signals</Badge>
                  </div>
                </div>
                <div className="grid md:grid-cols-1 gap-4 text-sm text-muted-foreground">
                  <ul className="list-disc pl-4 space-y-1">
                    <li>RSI/PPO/TSI Divergence (Setup)</li>
                    <li>TSI Trigger (Execution)</li>
                    <li>Validity Window</li>
                  </ul>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-center max-w-2xl mx-auto mt-8">
             <p className="text-red-400 font-bold flex items-center justify-center gap-2">
               <AlertTriangle className="w-5 h-5" />
               CRITICAL RULE: Never skip layers.
             </p>
             <p className="text-sm text-muted-foreground mt-1">
               A perfect Lumina signal in a CRASH WARNING regime is a trap.
             </p>
          </div>
        </section>

        <Separator className="bg-white/10" />

        {/* PHYSICS REGIME MAP */}
        <section className="space-y-8">
          <div className="group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-all duration-300">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">Physics Regime Map</h2>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent rounded-full"></div>
          </div>
          
          {/* New Visual Component */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <PhysicsRegimeMap />
          </div>
        </section>

        <Separator className="bg-white/10" />

        {/* ZONE ANATOMY */}
        <section className="space-y-8">
          <div className="group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-all duration-300">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">Quality</h2>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent rounded-full"></div>
          </div>
          
          {/* New Visual Component */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <ZoneAnatomy />
          </div>
        </section>

        <Separator className="bg-white/10" />

        {/* PRE-TRADE CHECKLIST / QUICK REFERENCE */}
        <section className="space-y-8">
          <div className="group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-all duration-300">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">Quick Reference & Checklists</h2>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent rounded-full"></div>
          </div>

          {/* New Visual Component */}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <QuickReference />
          </div>
        </section>

        {/* FINAL PRINCIPLES */}
        <section className="bg-card border border-white/10 p-8 rounded-xl mt-12">
           <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
             <BookOpen className="w-6 h-6 text-primary" /> Final Principles
           </h2>
           <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground leading-relaxed">
              <ul className="space-y-4 list-disc pl-4">
                <li><strong>Layers {`>`} signals.</strong> A perfect Lumina trigger in CRASH WARNING regime is not a trade.</li>
                <li><strong>Macro filters everything.</strong> If Risk Score is FRAGILE+, reduce all position sizes by at least 50%.</li>
                <li><strong>Internals don't lie.</strong> Hindenburg + Credit Deteriorating is a serious warning regardless of price action.</li>
                <li><strong>Wait for confluence.</strong> The best trades have 3+ layers confirming. Marginal setups lose over time.</li>
                <li><strong>Physics context matters.</strong> POWER TREND vs BEAR TRAP vs LIQUIDATION tells you how to manage, not just whether to enter.</li>
              </ul>
              <ul className="space-y-4 list-disc pl-4">
                <li><strong>Zones are probabilities, not guarantees.</strong> Higher-rated zones fail less often, but they still fail.</li>
                <li><strong>Divergence is setup, trigger is action.</strong> Don't front-run divergence. Wait for the X.</li>
                <li><strong>The Goldilocks VIX zone.</strong> When fragility is Normal/De-Risked, you have the cleanest risk environment.</li>
                <li><strong>Credit leads equity.</strong> When HYG/IEF deteriorates, equity weakness typically follows.</li>
                <li><strong>When in doubt, sit out.</strong> The market will always offer another setup. Protecting capital is the first job.</li>
              </ul>
           </div>
        </section>

        <PlaybookCTA />

        <LegalFooter />
      </div>
    </div>
  );
}