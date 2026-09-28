import { motion } from "framer-motion";
import { Link } from "wouter";
import reportImage from "@assets/image_1763966098100.webp";

export function PerformanceReport() {
  return (
    <section className="border-b border-white/10 bg-black">
      <div className="container px-4 md:px-6 py-12">
         <div className="mb-6 flex items-center justify-between">
            <div className="font-mono text-sm text-primary uppercase tracking-widest">
                &gt; HISTORICAL_DATA_LOGS [2010-2025]
            </div>
            <div className="font-mono text-sm text-muted-foreground">
                SOURCE: TRADINGVIEW_BACKTESTER_V6
            </div>
         </div>
         
         <Link href="/indicator/divergence">
           <div className="cursor-pointer">
             <div className="relative border border-primary/30 bg-black p-1 md:p-2 group overflow-hidden perf-report-glow">
            <style>{`
              @keyframes perf-report-pulse {
                0%, 100% { 
                  box-shadow: 0 0 20px rgba(0, 255, 136, 0.2), inset 0 0 15px rgba(0, 255, 136, 0.05);
                  border-color: rgba(0, 255, 136, 0.3);
                }
                50% { 
                  box-shadow: 0 0 40px rgba(0, 255, 136, 0.5), 0 0 60px rgba(0, 255, 136, 0.2), inset 0 0 25px rgba(0, 255, 136, 0.15);
                  border-color: rgba(0, 255, 136, 0.7);
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
                <span className="font-mono text-xs font-bold text-primary">ASSET: VOO [2H]</span>
            </div>

            {/* Image Container with Filters */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-10" />
                <img 
                    src={reportImage} 
                    alt="TradingView Performance Report showing +551.60% return from 2010 to 2025" 
                    className="w-full h-auto opacity-90 grayscale-[30%] contrast-125 brightness-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                />
            </div>
            
            {/* Technical Overlays */}
            <div className="absolute top-4 left-4 z-30 font-mono text-[10px] text-primary/50">
                <div>&gt; SYSTEM_ANALYSIS</div>
                <div>&gt; INTEGRITY: 100%</div>
            </div>

            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/50" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/50" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/50" />
             </div>
           </div>
         </Link>
         
         <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-sm text-muted-foreground border-t border-white/10 pt-4">
            <div>
                REALIZED_RISK_VS_REWARD: <span className="text-white">-15.37% / <span className="text-primary">+68.21%</span></span>
            </div>
            <div className="text-center md:text-left">
                TOTAL_TRADES: <span className="text-white">662</span>
            </div>
            <div className="text-right">
                PROFIT_FACTOR: <span className="text-primary">57.65</span>
            </div>
         </div>
      </div>
    </section>
  );
}
