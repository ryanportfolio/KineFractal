import { motion } from "framer-motion";
import { Link } from "wouter";
import { Activity, GitBranch, AlertTriangle, Clock, Zap, TrendingDown, ShieldCheck, Crosshair } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignalProcessorSimulation } from "@/components/signal-processor-simulation";

const TypewriterText = ({ text, delay = 0 }: { text: string, delay?: number }) => {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1, delay: delay + index * 0.03 }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
};

export function TechnicalSpecs() {
  return (
      <section className="pt-16 pb-8 bg-black border-t border-white/10">
          <div className="container px-4 md:px-6">
            <div className="flex items-end justify-between mb-16 border-b border-white/10 pb-6">
               <div>
                   <div className="text-sm font-mono text-primary mb-2">
                     <span className="animate-pulse mr-2">&gt;</span>
                     <TypewriterText text="// ENGINEERING_BLUEPRINT" />
                   </div>
                   <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter text-white group cursor-default font-display">
                       <span className="glitch-subtle block" data-text="Technical">Technical</span>
                   </h2>
               </div>
               <div className="hidden md:block font-mono text-sm text-muted-foreground text-right">
                   DOC_ID: SPEC_V6.0<br/>
                   CLASS: CLASSIFIED <span className="animate-pulse">_</span>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                
                {/* Left Column: The Math */}
                <div className="lg:col-span-7 space-y-12">
                    
                    {/* 5-REGIME MARKET DETECTION */}
                    <div>
                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            0.0 5-REGIME_DETECTION
                        </h3>
                        <div className="bg-white/5 border border-white/10 p-4 mb-6">
                            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                <span className="text-white font-mono">VIX + Breadth</span> <span className="text-white/60">&rarr;</span> <span className="text-white font-bold">Detect psychology</span> <span className="text-white/60">&rarr;</span> <span className="text-primary font-mono">Dynamic adaptation</span>
                            </p>
                            
                            <div className="space-y-3 font-mono text-sm">
                                {/* Regime 1: CRASH */}
                                <div className="flex items-center justify-between bg-black/40 p-2 border-l-2 border-red-600">
                                    <div>
                                        <span className="text-red-500 font-bold">1. VIX PANIC / CRASH</span>
                                        <span className="text-xs text-muted-foreground block">VIX &gt; 35 or Hindenburg Active</span>
                                    </div>
                                    <Badge variant="outline" className="border-red-500 text-red-500">HALT BUYS</Badge>
                                </div>

                                {/* Regime 2: CORRECTION */}
                                <div className="flex items-center justify-between bg-black/40 p-2 border-l-2 border-orange-500">
                                    <div>
                                        <span className="text-orange-500 font-bold">2. CORRECTION / FEAR</span>
                                        <span className="text-xs text-muted-foreground block">VIX 25-35, Breadth Mixed</span>
                                    </div>
                                    <Badge variant="outline" className="border-orange-500 text-orange-500">DEFENSIVE</Badge>
                                </div>

                                {/* Regime 3: CHOP */}
                                <div className="flex items-center justify-between bg-black/40 p-2 border-l-2 border-yellow-500">
                                    <div>
                                        <span className="text-yellow-500 font-bold">3. CHOP / UNCERTAINTY</span>
                                        <span className="text-xs text-muted-foreground block">VIX 20-29, No Trend</span>
                                    </div>
                                    <Badge variant="outline" className="border-yellow-500 text-yellow-500">SCALPING</Badge>
                                </div>

                                {/* Regime 4: BULL */}
                                <div className="flex items-center justify-between bg-black/40 p-2 border-l-2 border-green-500">
                                    <div>
                                        <span className="text-green-500 font-bold">4. STEADY BULL</span>
                                        <span className="text-xs text-muted-foreground block">VIX &lt; 20, Breadth Positive</span>
                                    </div>
                                    <Badge variant="outline" className="border-green-500 text-green-500">ACCUMULATE</Badge>
                                </div>

                                {/* Regime 5: MANIA */}
                                <div className="flex items-center justify-between bg-black/40 p-2 border-l-2 border-purple-500">
                                    <div>
                                        <span className="text-purple-500 font-bold">5. MANIA / EUPHORIA</span>
                                        <span className="text-xs text-muted-foreground block">VIX &lt; 12, Volume Blow-off</span>
                                    </div>
                                    <Badge variant="outline" className="border-purple-500 text-purple-500">TRIM SIZE</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Physics Math */}
                    <div>
                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            1.0 KINEMATICS_MATH
                        </h3>
                        <div className="grid gap-4">
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="font-mono text-sm text-muted-foreground">MACRO_ENGINE (Daily)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <code className="block bg-black p-3 rounded border border-white/10 text-primary font-mono text-sm mb-2">
                                        regime = hindenburg ? CRASH : (vel &lt; 0 && acc &lt; 0) ? LIQUIDATION : BULL
                                    </code>
                                    <div className="space-y-2 mt-4">
                                        <p className="text-xs font-mono text-muted-foreground">
                                            <span className="text-red-500 font-bold">HINDENBURG LOGIC:</span><br/>
                                            1. New Highs &amp; New Lows &gt; 2.2% of Total Issues<br/>
                                            2. McClellan Oscillator &lt; 0 (Negative Breadth)<br/>
                                            3. New Highs &lt; (New Lows * 2)<br/>
                                            4. Price Trend &lt; 50-Day Ago Price
                                        </p>
                                        <p className="text-xs font-mono text-muted-foreground mt-2">
                                            <span className="text-orange-400 font-bold">DECELERATION REGIME:</span><br/>
                                            Detected when Vel &gt; 0 but Accel &lt; 0. Strategy reduces position size by 50% to avoid false breakouts.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/5 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="font-mono text-sm text-muted-foreground">ACCELERATION_FORMULA (Daily)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <code className="block bg-black p-3 rounded border border-white/10 text-accent font-mono text-sm mb-2">
                                        a = ta.sma(ta.change(v, 10), 3)
                                    </code>
                                    <p className="text-sm text-muted-foreground">
                                        Measures the rate of change of Velocity over 10 days. Detects when momentum is slowing before price reverses.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Trap Logic Gate */}
                    <div>
                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <GitBranch className="w-5 h-5 text-accent" />
                            2.0 MACRO_FUSION_GATE
                        </h3>
                        <div className="bg-black border border-white/10 p-6 relative overflow-hidden mb-12">
                            <div className="absolute top-0 right-0 p-2 text-sm font-mono text-muted-foreground">BOOLEAN_CHAIN</div>
                            
                            <div className="space-y-4 font-mono text-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center text-sm">1</div>
                                    <div className="flex-1 border-b border-dashed border-white/20 pb-1">Buy Signal (RSI/PPO)</div>
                                    <span className="text-green-500">TRUE</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center text-sm">2</div>
                                    <div className="flex-1 border-b border-dashed border-white/20 pb-1">Regime != CRASH_MODE</div>
                                    <span className="text-green-500">TRUE</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center text-sm">3</div>
                                    <div className="flex-1 border-b border-dashed border-white/20 pb-1">Regime != LIQUIDATION</div>
                                    <span className="text-green-500">TRUE</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center text-sm">4</div>
                                    <div className="flex-1 border-b border-dashed border-white/20 pb-1">Trap Memory (30 Days)</div>
                                    <span className="text-red-500 font-bold">ACTIVE</span>
                                </div>
                                
                                <div className="mt-6 pt-4 border-t border-white/20 flex justify-between items-center">
                                    <span className="text-accent font-bold">RESULT:</span>
                                    <Badge variant="destructive" className="font-mono">TRADE_BLOCKED (TRAP_MEMORY)</Badge>
                                </div>
                            </div>
                        </div>
                        
                        {/* New Simulation Component */}
                        <SignalProcessorSimulation />
                    </div>

                </div>

                {/* Right Column: Nuances & Risk */}
                <div className="lg:col-span-5 space-y-12">
                    
                    {/* Fractal Lag */}
                    <div>
                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-white" />
                            3.0 FRACTAL_LAG
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">Entry delayed 2 candles (pivot confirmation)</p>
                        <div className="flex items-center justify-between text-sm font-mono border border-white/10 p-4 bg-white/5 mb-8">
                            <div className="text-center">
                                <div className="w-2 h-2 bg-white rounded-full mx-auto mb-2" />
                                <div>MON<br/>(Low)</div>
                            </div>
                            <div className="h-px w-8 bg-white/20" />
                            <div className="text-center">
                                <div className="w-2 h-2 bg-white/50 rounded-full mx-auto mb-2" />
                                <div>TUE<br/>(Wait)</div>
                            </div>
                            <div className="h-px w-8 bg-white/20" />
                            <div className="text-center">
                                <div className="w-2 h-2 bg-primary rounded-full mx-auto mb-2 animate-pulse" />
                                <div>WED<br/><span className="text-primary">SIGNAL</span></div>
                            </div>
                        </div>

                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            3.1 SPLIT_RSI_LOGIC + PPO
                        </h3>
                         <div className="grid gap-4">
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="font-mono text-sm text-muted-foreground">BULLISH CONFLUENCE</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <code className="block bg-black p-3 rounded border border-white/10 text-primary font-mono text-sm mb-2">
                                        signal = (RSI_DIV_HID || RSI_DIV_REG || PPO_BULL)
                                    </code>
                                    <p className="text-sm text-muted-foreground">
                                        Triple-threat detection: Uses Hidden Bull Divs (Trend), Regular Bull Divs (Reversal), and PPO momentum shifts
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="font-mono text-sm text-muted-foreground">BEARISH DIVERGENCE</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <code className="block bg-black p-3 rounded border border-white/10 text-accent font-mono text-sm mb-2">
                                        src = RSI(High) // NOT Close
                                    </code>
                                    <p className="text-sm text-muted-foreground">
                                        Uses the RSI of the candle's <span className="text-white">High</span> to detect euphoria wicks at tops
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    
                     {/* Timeframe Optimization */}
                    <div>
                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <Crosshair className="w-5 h-5 text-primary" />
                            3.2 2H_OPTIMIZATION
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            While the Macro Engine runs on Daily data for stability, the strategy executes on the <span className="text-white font-bold">2-Hour Chart</span> to capture intraday precision entries.
                        </p>
                        <div className="bg-white/5 border border-white/10 p-3 text-sm font-mono text-center">
                            LONG_ONLY: ENABLED | TIMEFRAME: 120MIN
                        </div>
                    </div>

                    {/* Position Sizing */}
                    <div>
                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-400" />
                            4.0 DYNAMIC_SIZING & CONFLUENCE
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white/5 p-4 border border-white/10">
                                <div className="text-sm font-mono text-muted-foreground mb-2">REGIME: POWER</div>
                                <div className="text-sm font-bold text-white mb-1">Aggressive (5%+)</div>
                                <p className="text-sm text-muted-foreground">
                                    Institutional Confluence triggers heavy accumulation.
                                </p>
                            </div>
                            <div className="bg-white/5 p-4 border border-white/10">
                                <div className="text-sm font-mono text-muted-foreground mb-2">DIVERGENCE SCORING</div>
                                <div className="text-sm font-bold text-white mb-1">+0.25% per Signal</div>
                                <p className="text-sm text-muted-foreground">
                                    Incremental sizing adds to base for every confirmed divergence (RSI Hid, RSI Reg, PPO).
                                </p>
                            </div>
                        </div>

                        {/* Volume Confluence */}
                        <div className="bg-white/5 border border-white/10 p-4">
                             <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4 text-orange-400" />
                                <span className="font-mono font-bold text-white text-sm">VOLUME CONFLUENCE SYSTEM</span>
                             </div>
                             <div className="grid grid-cols-3 gap-2 text-xs font-mono text-muted-foreground mb-3">
                                <div className="bg-black/50 p-2 border border-white/5">1. Z-SCORE</div>
                                <div className="bg-black/50 p-2 border border-white/5">2. PERCENTILE</div>
                                <div className="bg-black/50 p-2 border border-white/5">3. PEAK RATIO</div>
                             </div>
                             <p className="text-sm text-muted-foreground">Blow-off detection <span className="text-white/60">&rarr;</span> &gt;4 triggers 1% exits</p>
                        </div>
                    </div>

                    {/* Failure Modes */}
                    <div>
                        <h3 className="text-xl font-mono font-bold text-white mb-6 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            5.0 FAIL_SAFES
                        </h3>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm text-white">Hindenburg Omen</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        If NYSE market breadth breaks down, the strategy enters CRASH_MODE and halts all buying regardless of signals.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <Zap className="w-5 h-5 text-red-500 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm text-white">Gap Protection</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Strict 2.6% threshold ignores noise. Only sells on euphoric gap ups that remain unfilled during the session.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* ASCII Art Terminal Banner - Full Width - Clickable */}
            <Link href="/indicator/playbook">
              <div className="flex justify-center my-12">
                <div className="group cursor-pointer bg-black border-2 border-green-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all duration-300 hover:border-green-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] hover:scale-105">
                  <pre className="font-mono text-base text-green-500/90 leading-tight whitespace-pre transition-colors duration-300 group-hover:text-green-400">
{`██████████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█░█░▀█▀░█▀█░█▀▀░░░█▀▀░█▀▄░█▀█░█▀▀░▀█▀░█▀█░█░░░░░░░░░█
█░░░░░░░░█▀▄░░█░░█░█░█▀▀░░░█▀▀░█▀▄░█▀█░█░░░░█░░█▀█░█░░░░░░░░░█
█░░░░░░░░▀░▀░▀▀▀░▀░▀░▀▀▀░░░▀░░░▀░▀░▀░▀░▀▀▀░░▀░░▀░▀░▀▀▀░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
██████████████████████████████████████████████████████████████████`}
                  </pre>
                </div>
              </div>
            </Link>

          </div>
      </section>
  );
}
