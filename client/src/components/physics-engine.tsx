import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import chartImage from "@assets/image_1764039136234.webp";
import histogramImage from "@assets/image_1764040061755.webp";
import { Check, AlertTriangle, ArrowRight, XCircle, ZoomIn } from "lucide-react";
import { Link } from "wouter";

import { VectorFieldFractal } from "@/components/vector-field-fractal";
import { VooTicker } from "@/components/voo-ticker";

export function PhysicsEngine() {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="container px-4 md:px-6 space-y-24">
        
        {/* SECTION 1: PHYSICS ENGINE EXPLAINER */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          <div className="space-y-8">
            <div>
              <Link href="/indicator/context">
                <div className="cursor-pointer">
                  <h2 className="text-4xl md:text-6xl font-bold uppercase mb-6 leading-none group">
                    <span className="block text-white glitch-effect transition-transform duration-300 group-hover:translate-x-2" data-text="PHYSICS">
                      Physics
                    </span>
                    <span className="block text-stroke-primary bg-gradient-to-b from-primary to-transparent bg-clip-text text-transparent transition-all duration-300 group-hover:translate-x-2 origin-left group-hover:text-primary">
                      Engine
                    </span>
                  </h2>
                  <div className="font-mono text-sm text-primary border-l border-primary pl-4 max-w-md mb-6">
                    MARKET REGIME DETECTION SYSTEM via VELOCITY & ACCELERATION VECTORS
                  </div>
                </div>
              </Link>
              
              <VectorFieldFractal />
            </div>

            <div className="grid gap-4 font-mono text-sm">
              <div className="border border-white/10 p-4 bg-white/5">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-primary">[01] POWER_BULL</span>
                  <span className="text-sm">VEL &gt; 0 && ACC &gt; 0</span>
                </div>
                <p className="text-muted-foreground text-sm">Strong upward momentum → Max allocation permitted</p>
              </div>

              <div className="border border-orange-500/30 p-4 bg-orange-500/5">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-orange-500">[02] LIQUIDATION_MODE</span>
                  <span className="text-sm">VEL &lt; 0 && ACC &lt; 0</span>
                </div>
                <p className="text-muted-foreground text-sm">Forced selling pressure detected</p>
              </div>

              <div className="border border-red-500/30 p-4 bg-red-500/5">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-red-500">[03] HINDENBURG_CRASH</span>
                  <span className="text-sm">NYSE STRUCTURE BREAK</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Market breadth collapse <span className="text-red-500">→ PROTECT</span>
                </p>
              </div>
            </div>
          </div>

          {/* Technical Visualizer - Live Market Simulation */}
          <div className="space-y-6">
             <div className="relative border border-white/10 bg-[#0c0c0c] h-[25rem] flex flex-col overflow-hidden shadow-2xl group rounded-sm ring-1 ring-white/5">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-white/10 px-4 py-2 bg-black/80 backdrop-blur-md z-20 absolute top-0 left-0 right-0">
                   <div className="flex items-center gap-3">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                     <span className="font-mono text-xs font-bold text-white tracking-widest">VOO - Daily</span>
                   </div>
                   <div className="flex gap-4 font-mono text-[10px]">
                     <span className="text-primary animate-pulse">ACTIVE</span>
                   </div>
                </div>
                
                {/* Static Chart Image */}
                <div className="w-full h-full overflow-hidden bg-[#131722] relative">
                  <img 
                    src={chartImage} 
                    alt="KINE FRACTAL Analysis" 
                    className="w-full h-full object-cover object-left scale-105 transition-transform duration-700 group-hover:scale-110 opacity-85 hover:opacity-100 grayscale-[0.2] hover:grayscale-0"
                  />
                  {/* Vignette for blending */}
                  <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.7)] pointer-events-none" />
                </div>
                
                {/* Scanline overlay for tech feel */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 z-10" />
              </div>

              {/* NOT MACD EXPLAINER */}
              <div className="bg-black/40 border border-white/10 p-4 flex gap-6 items-center backdrop-blur-sm">
                 <motion.div 
                   layoutId="histogram-zoom"
                   className="w-32 h-16 overflow-hidden rounded border border-white/20 shrink-0 cursor-zoom-in relative group"
                   onClick={() => setIsZoomed(true)}
                 >
                    <img src={histogramImage} alt="Velocity Histogram" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-4 h-4 text-white" />
                    </div>
                 </motion.div>
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                       <h4 className="font-bold text-white text-sm">CONTEXT HISTOGRAM</h4>
                       <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/50 px-1.5 rounded font-mono">NOT MACD</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                       <strong>FORMULA:</strong> <span className="font-mono text-primary">Velocity = WMA(ROC)</span> | <span className="font-mono text-yellow-400">Acceleration = SMA(ΔVelocity)</span>
                       <br className="mb-2"/>
                       This is a kinetic physics engine, not a moving average crossover.
                       <br/>
                       <span className="text-white">Histogram (1st Deriv)</span> = Directional Speed. <span className="text-white">Line (2nd Deriv)</span> = The Force/Gas Pedal driving the move.
                    </p>
                 </div>
              </div>
              
          </div>

        </div>

        {/* FULL-WIDTH VOO TICKER WITH OUTLIERS */}
        <VooTicker />

        <AnimatePresence>
            {isZoomed && (
                <motion.div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsZoomed(false)}
                >
                    <motion.div 
                        layoutId="histogram-zoom"
                        className="relative max-w-4xl w-full bg-[#131722] border border-white/20 rounded-lg overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img src={histogramImage} alt="Velocity Histogram Full" className="w-full h-auto" />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        

      </div>
    </section>
  );
}
