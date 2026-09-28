import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { PerformanceMetrics } from "@/components/performance-metrics";
import { PerformanceReport } from "@/components/performance-report";
import { PhysicsEngine } from "@/components/physics-engine";
import { LiveChartEvidence } from "@/components/live-chart";
import { Legend } from "@/components/legend";
import { TechnicalSpecs } from "@/components/technical-specs";
import { TradeHistory } from "@/components/trade-history";
import { PropertiesSettings } from "@/components/properties-settings";
import { ConfigurationMatrix } from "@/components/configuration-matrix";
import { BootSequence } from "@/components/boot-sequence";
import { KineFractalTerminal } from "@/components/kine-fractal-terminal";
import { WhatIsKineFractal } from "@/components/what-is-kine-fractal";

import { KnowledgeBase } from "@/components/knowledge-base";
import { PlaybookCTA } from "@/components/playbook-cta";

import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Activity, TrendingUp, ArrowRight, Diamond, TrendingDown, ArrowUpDown } from "lucide-react";

export default function Home() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [hasDeployed, setHasDeployed] = useState(false);
  const [bootComplete, setBootComplete] = useState(false);

  // Simulate boot sequence only on first mount (could use session storage to persist across reloads if desired)
  // For now, we'll show it every time the home component mounts (page refresh)
  
  const handleDeployClick = () => {
    if (hasDeployed) return; // Already open

    // Trigger violent glitch
    setIsDeploying(true);

    // Stop glitch and reveal content after 800ms
    setTimeout(() => {
      setIsDeploying(false);
      setHasDeployed(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans selection:bg-primary/20 selection:text-black">
      <AnimatePresence>
        {!bootComplete && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100]"
          >
            <BootSequence onComplete={() => setBootComplete(true)} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Cyber Nav */}
      <Navbar />
      <main className="pt-14">
        <Hero />
        
        {/* Ratio Relevance CTA */}
        <section className="py-8 px-4 md:px-6 bg-gradient-to-b from-black/60 to-transparent border-b border-[#00ff88]/20">
          <div className="container max-w-5xl mx-auto space-y-4">
            {/* Diamond Strategy CTA - New Featured */}
            <Link href="/strategy/diamond">
              <div 
                className="group relative overflow-hidden bg-black/70 border border-purple-500/40 hover:border-purple-400 rounded-sm p-6 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]"
                data-testid="cta-diamond-strategy"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 right-0 px-3 py-1 bg-red-500/20 border-l border-b border-red-500/30">
                  <span className="font-mono text-[10px] text-red-400 uppercase tracking-wider animate-pulse">NEW • SHORTS</span>
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-sm group-hover:bg-purple-500/20 transition-colors">
                      <Diamond className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-purple-400/60 uppercase tracking-wider">Strategy v6.16</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      </div>
                      <h3 className="font-mono text-lg md:text-xl font-bold text-white group-hover:text-purple-400 transition-colors">HEDGE BUILD</h3>
                      <p className="font-mono text-xs text-white/50 mt-1 max-w-lg">Regime-based sizing • Short capability enabled</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end gap-1 text-right">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4 text-purple-400" />
                        <span className="font-mono text-xs text-purple-400">Long & Short</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-3 h-3 text-red-400" />
                        <span className="font-mono text-[10px] text-red-400/70">Up to 39% Bear Short</span>
                      </div>
                    </div>
                    <div className="p-2 border border-purple-500/30 rounded-sm group-hover:bg-purple-500/10 group-hover:border-purple-400 transition-all">
                      <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
            
            {/* Ratio Relevance CTA */}
            <Link href="/ratio-relevance">
              <div 
                className="group relative overflow-hidden bg-black/70 border border-[#00ff88]/40 hover:border-[#00ff88] rounded-sm p-6 cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,136,0.2)]"
                data-testid="cta-ratio-relevance"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#00ff88]/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-sm group-hover:bg-[#00ff88]/20 transition-colors">
                      <Activity className="w-6 h-6 text-[#00ff88]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-[#00ff88]/60 uppercase tracking-wider">Powered by KINE_AI</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                      </div>
                      <h3 className="font-mono text-lg md:text-xl font-bold text-white group-hover:text-[#00ff88] transition-colors">
                        RATIO RELEVANCE
                      </h3>
                      <p className="font-mono text-xs text-white/50 mt-1 max-w-lg">Real-time intermarket analysis • Liquidity constraints • Sector rotation signals</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end gap-1 text-right">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="font-mono text-xs text-emerald-400">15 ETF Proxies</span>
                      </div>
                      <span className="font-mono text-[10px] text-white/40">Live Tiingo Data</span>
                    </div>
                    <div className="p-2 border border-[#00ff88]/30 rounded-sm group-hover:bg-[#00ff88]/10 group-hover:border-[#00ff88] transition-all">
                      <ArrowRight className="w-5 h-5 text-[#00ff88] group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
        
        <WhatIsKineFractal />
        <section className="py-12 px-4 md:px-6 bg-black/40 border-b border-white/5">
          <div className="container max-w-7xl mx-auto">
            <KineFractalTerminal />
          </div>
        </section>
        <LiveChartEvidence />
        <PerformanceMetrics />
        <PerformanceReport />
        <Legend />
        <PhysicsEngine />
        <PropertiesSettings />
        <TechnicalSpecs />
        <KnowledgeBase />
        <TradeHistory />
        <ConfigurationMatrix />
        
        {/* Industrial Footer */}
        <section className="py-24 border-t border-white/10 bg-black text-center relative overflow-hidden">
            {/* Background Energy Field */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent opacity-20 pointer-events-none" />
            
            <div className="container relative z-10 px-4 md:px-6">
                <h3 
                    className="text-4xl md:text-6xl font-bold uppercase mb-8 tracking-tighter text-white group cursor-pointer select-none relative inline-block"
                    onClick={handleDeployClick}
                >
                    <span 
                        className={`glitch-deploy ${isDeploying ? 'glitch-deploy-active' : ''} ${hasDeployed ? 'text-primary' : ''}`} 
                        data-text={hasDeployed ? "SYSTEM DEPLOYED" : "Ready to Deploy?"}
                    >
                        {hasDeployed ? "SYSTEM DEPLOYED" : "Ready to Deploy?"}
                    </span>
                </h3>
                
                <AnimatePresence>
                    {hasDeployed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            transition={{ duration: 0.5, ease: "circOut" }}
                            className="overflow-hidden"
                        >
                             <div className="max-w-3xl mx-auto bg-black/50 border border-primary/30 p-8 mb-12 backdrop-blur-sm">
                                <div className="flex items-center justify-center gap-3 mb-6 text-primary animate-pulse">
                                    <Terminal className="w-6 h-6" />
                                    <span className="font-mono font-bold">INITIALIZING SEQUENCE...</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm text-left">
                                    <div className="bg-black p-4 border border-white/10">
                                        <div className="text-muted-foreground mb-2">// STEP 01</div>
                                        <div className="text-white font-bold">CONNECT WALLET</div>
                                        <div className="text-xs text-gray-500 mt-1">Pending connection...</div>
                                    </div>
                                    <div className="bg-black p-4 border border-white/10">
                                        <div className="text-muted-foreground mb-2">// STEP 02</div>
                                        <div className="text-white font-bold">VERIFY ACCESS</div>
                                        <div className="text-xs text-gray-500 mt-1">Waiting for signature...</div>
                                    </div>
                                </div>
                             </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col sm:flex-row justify-center gap-0 max-w-md mx-auto border border-white/20 mt-12">
                    <button className="flex-1 px-8 py-4 bg-primary text-black font-mono font-bold hover:bg-white transition-colors">
                        GET_SCRIPT
                    </button>
                    <Link href="/indicator-library" className="flex-1">
                        <button className="w-full h-full px-8 py-4 bg-transparent text-white font-mono font-bold hover:bg-white/10 transition-colors border-l border-white/20">
                            DOCS
                        </button>
                    </Link>
                </div>
                
                <div className="mt-12">
                    <PlaybookCTA />
                </div>

                <div className="mt-12 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest space-y-4">
                    <p>© 2025 Kine Fractal Accumulator. All systems nominal.</p>
                    
                    <div className="max-w-2xl mx-auto leading-relaxed border-t border-white/5 pt-4 mt-4">
                      <p className="mb-2">
                        Educational content only. Not investment, financial, or trading advice. Past performance does not guarantee future results. Trading involves substantial risk of loss. Consult a licensed financial advisor.
                      </p>
                      <div className="flex justify-center gap-4 text-primary/50">
                        <Link href="/legal/disclaimer"><span className="hover:text-primary cursor-pointer transition-colors">Full Disclaimer</span></Link>
                        <span>|</span>
                        <Link href="/legal/privacy"><span className="hover:text-primary cursor-pointer transition-colors">Privacy</span></Link>
                      </div>
                    </div>
                </div>
            </div>
        </section>
      </main>
    </div>
  );
}
