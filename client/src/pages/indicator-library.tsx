import { Navbar } from "@/components/navbar";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, LayoutGrid, Activity, BarChart3, Layers, Zap, ShieldAlert, Wind, BookOpen } from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";

const INDICATORS = [
  {
    name: "Context Smart",
    path: "/indicator/context",
    description: "Market operating system providing high-level view of market health, momentum physics, and structural crash warnings.",
    icon: <Activity className="w-6 h-6 text-primary" />,
    version: "v6.0"
  },
  {
    name: "Fractal Accumulator",
    path: "/indicator/divergence",
    description: "Automated accumulation system using physics-based regime detection and multi-signal confluence.",
    icon: <Wind className="w-6 h-6 text-blue-400" />,
    version: "v6.0"
  },
  {
    name: "Macro Data",
    path: "/indicator/macro-data",
    description: "Long-term trend analysis tool filtering out noise to reveal the underlying market direction.",
    icon: <BarChart3 className="w-6 h-6 text-green-400" />,
    version: "v3.1"
  },
  {
    name: "Risk Dashboard",
    path: "/indicator/risk-dashboard",
    description: "Comprehensive risk assessment panel tracking volatility, liquidation levels, and market stress.",
    icon: <ShieldAlert className="w-6 h-6 text-red-400" />,
    version: "v2.0"
  },
  {
    name: "Market Structure",
    path: "/indicator/structure",
    description: "Identifies key support/resistance levels, order blocks, and structural pivots.",
    icon: <Layers className="w-6 h-6 text-purple-400" />,
    version: "v5.5"
  },
  {
    name: "Lumina",
    path: "/indicator/lumina",
    description: "Advanced volume analysis highlighting institutional activity and hidden liquidity.",
    icon: <Zap className="w-6 h-6 text-yellow-400" />,
    version: "v1.0"
  }
];

export default function IndicatorLibrary() {
  return (
    <div className="min-h-screen bg-background pt-20 pb-24">
      <Navbar />
      <div className="container px-4 md:px-6">
        
        {/* Header */}
        <div className="mb-12 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-full mb-6 border border-white/10">
            <LayoutGrid className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter mb-4">
            Indicator <span className="text-primary">Library</span>
          </h1>
          
          {/* Immersive Chart Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="relative w-full mt-8 mb-12 group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 opacity-50 blur-lg group-hover:opacity-75 transition-opacity duration-1000" />
            <div className="relative border border-white/10 bg-black/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-2xl shadow-black/50">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent z-10" />
              
              <img 
                src="/assets/full-system-chart.png" 
                alt="Full Trading System Chart" 
                className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity duration-700"
              />
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-black/80 border border-primary/30 rounded-full backdrop-blur-md flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-mono tracking-widest text-primary uppercase">Live System Preview</span>
              </div>
            </div>
          </motion.div>

          {/* The Playbook CTA */}
          <Link href="/indicator/playbook">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="group mt-12 mb-16 bg-gradient-to-br from-black/60 to-black/30 border border-white/10 hover:border-primary/50 p-8 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden relative max-w-3xl mx-auto"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
              
              <div className="relative flex items-start gap-8">
                <div className="flex-shrink-0">
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 group-hover:border-primary/30 transition-colors">
                    <BookOpen className="w-8 h-8 text-primary" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-3xl font-bold group-hover:text-primary transition-colors">The Playbook</h2>
                    <span className="text-xs font-mono text-white/60 border border-white/20 px-3 py-1 rounded-full">MASTER</span>
                  </div>
                  
                  <span className="inline-block mb-4 text-xs font-mono text-primary/80 border border-primary/30 bg-primary/5 px-3 py-1.5 rounded">
                    THE_COMPLETE_SYSTEM
                  </span>
                  
                  <p className="text-base text-white/70 leading-relaxed mb-6 max-w-2xl">
                    A unified framework connecting all 5 indicators into a single decision engine.
                  </p>
                  
                  <div className="flex items-center gap-2 text-sm font-mono text-primary group-hover:gap-3 transition-all">
                    <span>VIEW_DOCUMENTATION</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>
          </Link>

          </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {INDICATORS.map((indicator, i) => (
            <Link key={indicator.name} href={indicator.path}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group h-full bg-black border border-white/10 p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5 text-primary -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                </div>
                
                <div className="mb-6 p-3 bg-white/5 w-fit rounded-lg border border-white/10 group-hover:border-primary/20 transition-colors">
                  {indicator.icon}
                </div>
                
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold font-mono group-hover:text-primary transition-colors">
                    {indicator.name}
                  </h3>
                  <span className="text-xs font-mono text-muted-foreground border border-white/10 px-2 py-0.5 rounded">
                    {indicator.version}
                  </span>
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {indicator.description}
                </p>
                
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center text-xs font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  VIEW_DOCUMENTATION
                </div>
              </motion.div>
            </Link>
          ))}
        </div>

        <LegalFooter />
      </div>
    </div>
  );
}
