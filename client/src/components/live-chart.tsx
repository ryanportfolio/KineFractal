import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import vooChart from "@assets/image_1763966098100.webp";
import aaplChart from "@assets/image_1763965244432.webp";
import ibitChart from "@assets/image_1763965179679.webp";
import lbChart from "@assets/image_1763965547858.webp";
import { Maximize2 } from "lucide-react";

const tickers = [
  { symbol: "VOO", name: "S&P 500 ETF", img: vooChart, return: "+555.04%", winRate: "93.81%", drawdown: "23.17%", pf: "57.65" },
  { symbol: "AAPL", name: "APPLE INC.", img: aaplChart, return: "+506.06%", winRate: "90.81%", drawdown: "28.18%", pf: "123.69" },
  { symbol: "IBIT", name: "BITCOIN ETF", img: ibitChart, return: "+100.74%", winRate: "96.08%", drawdown: "27.91%", pf: "168.76" },
  { symbol: "LB", name: "LandBridge", img: lbChart, return: "+88.79%", winRate: "98.50%", drawdown: "27.30%", pf: "137.16" },
];

export function LiveChartEvidence() {
  return (
      <section className="py-24 bg-background border-t border-white/10">
          <div className="container px-4 md:px-6 mb-12">
              <div className="border-l-2 border-primary pl-4">
                  <h2 className="text-2xl font-bold font-mono uppercase mb-2 text-shadow-glow">
                      <span className="text-white">Multi-Asset Validation</span>
                  </h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-primary to-transparent shadow-[0_0_10px_rgba(0,255,136,0.5)] mb-4"></div>
                  <p className="text-sm text-muted-foreground font-mono max-w-2xl">
                      Find what works best for you; backtest performance usually is best on 2HR timeframe; strongly utilizes HTF 1D
                  </p>
              </div>
          </div>
          <div className="container px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {tickers.map((ticker) => (
                      <div key={ticker.symbol} className="border border-white/10 bg-black/50 p-1 group hover:border-primary/50 transition-colors">
                          <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 mb-1">
                              <div className="font-mono text-sm font-bold flex gap-2">
                                  <span className="text-primary">{ticker.symbol}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span>{ticker.name}</span>
                              </div>
                          </div>
                          
                          <Dialog>
                              <DialogTrigger asChild>
                                  <div className="w-full relative overflow-hidden aspect-video border-x border-white/5 cursor-zoom-in">
                                      {/* CRT Overlay */}
                                      <div className="absolute inset-0 pointer-events-none z-20 opacity-20 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{backgroundSize: "100% 2px, 3px 100%"}} />
                                      
                                      <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-10 pointer-events-none" />
                                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 mix-blend-overlay" />
                                      
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30">
                                          <div className="bg-black/80 text-primary px-3 py-1 rounded-full border border-primary/50 flex items-center gap-2 text-xs font-mono">
                                              <Maximize2 className="w-3 h-3" />
                                              ENHANCE
                                          </div>
                                      </div>

                                      <img 
                                          src={ticker.img} 
                                          alt={`Strategy performance on ${ticker.symbol}`} 
                                          className="w-full h-full object-cover opacity-80 grayscale-[50%] contrast-125 brightness-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                                      />
                                      
                                      {/* Corner Accents */}
                                      <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-primary/30" />
                                      <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-primary/30" />
                                      <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-primary/30" />
                                      <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-primary/30" />
                                  </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black border border-primary/20">
                                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                                      <img 
                                          src={ticker.img} 
                                          alt={`Strategy performance on ${ticker.symbol} - Full View`} 
                                          className="max-w-full max-h-[85vh] object-contain"
                                      />
                                  </div>
                              </DialogContent>
                          </Dialog>
                          
                          <div className="p-3 bg-white/5 border-t border-white/10 grid grid-cols-3 gap-2 text-xs font-mono">
                              <div>
                                  <span className="text-muted-foreground block text-[10px] mb-0.5">RETURN</span>
                                  <span className="text-primary font-bold">{ticker.return}</span>
                              </div>
                              <div className="text-center border-l border-r border-white/10">
                                  <span className="text-muted-foreground block text-[10px] mb-0.5">WIN RATE</span>
                                  <span className="font-bold flex items-center justify-center gap-1 text-[#00ff88]">
                                      {ticker.winRate}
                                  </span>
                              </div>
                              <div className="text-right">
                                  <span className="text-muted-foreground block text-[10px] mb-0.5">PROFIT FACTOR</span>
                                  <span className="text-white">{ticker.pf}</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </section>
  );
}
