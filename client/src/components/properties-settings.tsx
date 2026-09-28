import { motion } from "framer-motion";
import { Settings, Zap, Layers, BarChart2, Percent, AlertTriangle, ArrowUpRight, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import propertiesImage from "@assets/image_1763960442293.png";

export function PropertiesSettings() {
  return (
      <section className="py-24 bg-black border-t border-white/10">
          <div className="container px-4 md:px-6">
            <div className="flex items-center gap-4 mb-12">
                <Settings className="w-6 h-6 text-primary animate-spin-slow" />
                <h2 className="text-2xl font-mono font-bold uppercase tracking-widest text-white">
                    Critical_Configuration
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                
                {/* Left: Screenshot */}
                <div className="md:col-span-5">
                     <div className="sticky top-24">
                         <div className="border border-white/10 bg-black p-6 relative overflow-hidden mb-6">
                            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <span className="font-mono text-sm font-bold tracking-widest">EQUITY_MONITOR</span>
                                </div>
                                <div className="font-mono text-sm text-muted-foreground">
                                    ALLOCATION
                                </div>
                            </div>
                            <div className="crt-screen rounded-none">
                                <div className="crt-content">
                                    <div className="crt-label">DEFAULT_ORDER_TYPE</div>
                                    <div className="crt-value">% OF EQUITY</div>
                                </div>
                                <div className="crt-scanlines" />
                                <div className="crt-glow" />
                            </div>
                        </div>

                         {/* Execution Logic Matrix */}
                         <div className="mt-8 pt-8 border-t border-white/10">
                            <div className="flex items-center gap-2 mb-6">
                                <Shield className="w-5 h-5 text-primary" />
                                <h3 className="font-mono font-bold text-white text-lg uppercase">Execution_Logic_Core</h3>
                            </div>
                            
                            <div className="space-y-8 font-mono text-sm">
                                
                                {/* Buy Protocols */}
                                <div>
                                    <div className="text-muted-foreground mb-3 border-l-2 border-primary pl-3 text-base font-bold">ACCUMULATION_PROTOCOLS (BUY)</div>
                                    <div className="grid gap-3">
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">AGGRESSIVE</span>
                                            <div className="text-right">
                                                <span className="text-primary font-bold block text-lg">&lt;= 15%</span>
                                                <span className="text-muted-foreground text-xs">High Conviction / Power Regime</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">CAUTION</span>
                                            <div className="text-right">
                                                <span className="text-yellow-500 font-bold block text-lg">3.5%</span>
                                                <span className="text-muted-foreground text-xs">Defensive Accumulation</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">STANDARD</span>
                                            <div className="text-right">
                                                <span className="text-white font-bold block text-lg">1.5%</span>
                                                <span className="text-muted-foreground text-xs">Normal Operations</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sell Protocols */}
                                <div>
                                    <div className="text-muted-foreground mb-3 border-l-2 border-red-500 pl-3 text-base font-bold">DISTRIBUTION_PROTOCOLS (SELL)</div>
                                    <div className="grid gap-3">
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">BEAR_MARKET</span>
                                            <div className="text-right">
                                                <span className="text-red-500 font-bold block text-lg">9.5%</span>
                                                <span className="text-muted-foreground text-xs">Aggressive Risk Reduction</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">CRASH_MODE</span>
                                            <div className="text-right">
                                                <span className="text-red-500 font-bold block text-lg">9.0%</span>
                                                <span className="text-muted-foreground text-xs">Emergency Liquidation</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">HINDENBURG</span>
                                            <div className="text-right">
                                                <span className="text-orange-500 font-bold block text-lg">7.0%</span>
                                                <span className="text-muted-foreground text-xs">Breadth Failure Protection</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">NEUTRAL</span>
                                            <div className="text-right">
                                                <span className="text-white font-bold block text-lg">1.0%</span>
                                                <span className="text-muted-foreground text-xs">Standard Trimming</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 p-3 border border-white/5">
                                            <span className="font-semibold">BULL_MARKET</span>
                                            <div className="text-right">
                                                <span className="text-green-500 font-bold block text-lg">0.5%</span>
                                                <span className="text-muted-foreground text-xs">Scaling Into Strength</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                         </div>
                     </div>
                </div>

                {/* Right: Settings Cards */}
                <div className="md:col-span-7 grid grid-cols-1 gap-4">
                    
                    {/* Card 2: Order Size */}
                    <div className="bg-white/5 border border-white/10 p-6 hover:border-primary/50 transition-colors group">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <div className="text-base font-mono text-muted-foreground mb-2 font-semibold">EXECUTION_LOGIC</div>
                                <h3 className="text-3xl font-mono font-bold text-white">PYRAMIDING: 250</h3>
                            </div>
                            <Layers className="w-6 h-6 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-base font-mono">
                            <div>
                                <span className="text-white block mb-2 font-bold text-lg">WHAT IS THIS?</span>
                                <p className="text-muted-foreground leading-relaxed text-base">
                                    <span className="text-white">250 micro-positions</span> (long only)
                                </p>
                            </div>
                            <div>
                                <span className="text-white block mb-2 font-bold text-lg">WHY IT MATTERS</span>
                                <p className="text-muted-foreground leading-relaxed text-base">Institutional-style scaling → Validates before full position</p>
                            </div>
                            <div className="md:col-span-2 pt-4 border-t border-white/5">
                                <span className="text-accent block mb-2 font-bold text-lg">IMPACT OF CHANGE</span>
                                <p className="text-muted-foreground text-base">
                                    &lt;100 caps upside | Raising blocked by max equity
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Volume Confluence */}
                    <div className="bg-white/5 border border-white/10 p-6 hover:border-primary/50 transition-colors group">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <div className="text-base font-mono text-muted-foreground mb-2 font-semibold">BLOW-OFF DETECTION</div>
                                <h3 className="text-3xl font-mono font-bold text-white">VOLUME CONFLUENCE</h3>
                            </div>
                            <BarChart2 className="w-6 h-6 text-orange-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-base font-mono">
                            <div>
                                <span className="text-white block mb-2 font-bold text-lg">WHAT IS THIS?</span>
                                <p className="text-muted-foreground leading-relaxed text-base">
                                    Z-Score + Percentile → Panic/Mania detection
                                </p>
                            </div>
                            <div>
                                <span className="text-white block mb-2 font-bold text-lg">WHY IT MATTERS</span>
                                <p className="text-muted-foreground leading-relaxed text-base">
                                    Volume leads → Detect exhaustion
                                </p>
                            </div>
                            <div className="md:col-span-2 pt-4 border-t border-white/5">
                                <span className="text-accent block mb-2 font-bold text-lg">IMPACT OF CHANGE</span>
                                <p className="text-muted-foreground text-base">
                                    Disabled → Round trip (hold through drop)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Divergence Scoring */}
                    <div className="bg-white/5 border border-white/10 p-6 hover:border-primary/50 transition-colors group">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <div className="text-base font-mono text-muted-foreground mb-2 font-semibold">INCREMENTAL SIZING</div>
                                <h3 className="text-3xl font-mono font-bold text-white">+0.25% PER DIV</h3>
                            </div>
                            <Percent className="w-6 h-6 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-base font-mono">
                            <div>
                                <span className="text-white block mb-2 font-bold text-lg">WHAT IS THIS?</span>
                                <p className="text-muted-foreground leading-relaxed text-base">Base size per confirmed divergence</p>
                            </div>
                            <div>
                                <span className="text-white block mb-2 font-bold text-lg">WHY IT MATTERS</span>
                                <p className="text-muted-foreground leading-relaxed text-base">Solo divergences often fail → Cluster confidence</p>
                            </div>
                            <div className="md:col-span-2 pt-4 border-t border-white/5">
                                <span className="text-accent block mb-2 font-bold text-lg">IMPACT OF CHANGE</span>
                                <p className="text-muted-foreground text-base">1%: volatility spike | &lt;0.1%: returns negligible</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
          </div>
      </section>
  );
}
