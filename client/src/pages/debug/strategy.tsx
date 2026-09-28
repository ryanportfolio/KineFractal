import { Navbar } from "@/components/navbar";
import { Terminal } from "lucide-react";

export function StrategyLogic() {
  return (
    <section className="py-24 border-t border-white/10">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            <div>
                <h2 className="text-4xl font-bold uppercase mb-8 font-sans group cursor-default">
                    <span className="glitch-subtle block" data-text="EXECUTION">Execution</span>
                    <span className="glitch-subtle block text-muted-foreground group-hover:text-white transition-colors delay-75" data-text="LOGIC">Logic</span>
                </h2>
                
                <div className="space-y-8">
                    <div className="relative pl-8 border-l border-white/20">
                        <div className="absolute -left-[5px] top-0 w-[9px] h-[9px] bg-primary" />
                        <h3 className="font-mono text-xl font-bold text-primary mb-2">ACCUMULATION</h3>
                        <p className="text-muted-foreground mb-4">
                            When regime is safe, algorithm initiates a <span className="text-white font-bold">5-DAY BUY WINDOW</span>.
                        </p>
                        <div className="font-mono text-sm bg-white/5 p-3 border border-white/10">
                            &gt; POWER_BULL: BUY 5%<br/>
                            &gt; NEUTRAL: BUY 2.5%<br/>
                            &gt; CAUTION: BUY 1%<br/>
                            &gt; CRASH_MODE: BUY 0%
                        </div>
                    </div>

                    <div className="relative pl-8 border-l border-white/20">
                        <div className="absolute -left-[5px] top-0 w-[9px] h-[9px] bg-accent" />
                        <h3 className="font-mono text-xl font-bold text-accent mb-2">DISTRIBUTION</h3>
                        <p className="text-muted-foreground mb-4">
                            Dynamic selling based on market regime and gap logic.
                        </p>
                        <div className="font-mono text-sm grid gap-2">
                            <div className="flex justify-between border-b border-white/10 pb-1">
                                <span>GAP_UP_OPEN</span>
                                <span className="text-white">SELL GAP</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-1">
                                <span>CRASH_MODE</span>
                                <span className="text-red-500">DUMP 3.0%</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-1">
                                <span>BEAR_MARKET</span>
                                <span className="text-accent">SELL 1.5%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Code View */}
            <div className="font-mono text-sm bg-black border border-white/10 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-50">
                    <Terminal className="w-4 h-4" />
                </div>
                <div className="text-muted-foreground select-none mb-4">
                    // MACRO_FUSION_CORE.PINE
                </div>
                
                <div className="space-y-1">
                    <div className="text-gray-500">
                        <span className="text-primary">if</span> (is_hindenburg) {"{"}
                    </div>
                    <div className="pl-4 text-red-500">
                        regime = "CRASH_MODE";
                    </div>
                    <div className="pl-4 text-white">
                        target_buy = 0.0;
                    </div>
                    <div className="text-gray-500">
                        {"}"} <span className="text-primary">else if</span> (is_gap_up) {"{"}
                    </div>
                    <div className="pl-4 text-accent">
                        execute_sell("GAP_FADE");
                    </div>
                    <div className="text-gray-500">
                        {"}"} <span className="text-primary">else</span> {"{"}
                    </div>
                    <div className="pl-4 text-white">
                        <span className="text-gray-500">// Standard Accumulation</span>
                    </div>
                    <div className="pl-4 text-primary">
                        execute_dca(size=dynamic_size);
                    </div>
                    <div className="text-gray-500">
                        {"}"}
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/10 text-gray-600">
                    // HINDENBURG SENSORS: ACTIVE<br/>
                    // GAP PROTECTION: ON<br/>
                    // TRAP MEMORY: 30 DAYS
                </div>
            </div>

        </div>
      </div>
    </section>
  );
}

export default function DebugStrategy() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main className="pt-14">
        <StrategyLogic />
      </main>
    </div>
  );
}
