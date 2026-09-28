import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, X, Diamond, AlertTriangle, Zap } from "lucide-react";

export function Legend() {
  return (
    <section className="py-6 bg-black border-b border-white/10">
      <div className="container px-4 md:px-6">
        <div className="flex items-center gap-3 mb-4">
            <div className="w-1.5 h-1.5 bg-primary animate-pulse" />
            <h2 className="font-mono font-bold text-xs uppercase tracking-widest text-muted-foreground">System_Key_Reference</h2>
        </div>
        
        {/* Compact Control Panel Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 border-t border-l border-white/10 bg-white/[0.02]">
            
            {/* Item 1: Buy */}
            <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center hover:bg-white/5 transition-colors h-20">
                <ArrowUp className="w-4 h-4 text-primary mb-1.5" />
                <div className="font-mono text-[10px] font-bold text-primary tracking-wider">VALID_BUY</div>
                <div className="text-[8px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute mt-8">ENTRY SIGNAL</div>
            </div>

            {/* Item 2: Sell */}
            <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center hover:bg-white/5 transition-colors h-20">
                <ArrowDown className="w-4 h-4 text-accent mb-1.5" />
                <div className="font-mono text-[10px] font-bold text-accent tracking-wider">SELL_SIGNAL</div>
                <div className="text-[8px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute mt-8">EXIT SIGNAL</div>
            </div>

            {/* Item 3: Trap */}
            <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center hover:bg-white/5 transition-colors h-20">
                <X className="w-4 h-4 text-muted-foreground mb-1.5" />
                <div className="font-mono text-[10px] font-bold text-muted-foreground tracking-wider">TRAP_BLOCK</div>
                <div className="text-[8px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute mt-8">IGNORED SIG</div>
            </div>

            {/* Item 4: Blow-off */}
            <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center hover:bg-white/5 transition-colors h-20">
                <Zap className="w-4 h-4 text-orange-500 mb-1.5" />
                <div className="font-mono text-[10px] font-bold text-orange-500 tracking-wider">BLOW-OFF</div>
                <div className="text-[8px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute mt-8">VOL CLIMAX</div>
            </div>

            {/* Item 5: Multi-Div */}
            <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center hover:bg-white/5 transition-colors h-20">
                <Diamond className="w-3 h-3 text-yellow-400 fill-yellow-400 mb-1.5" />
                <div className="font-mono text-[10px] font-bold text-yellow-400 tracking-wider">MULTI-DIV</div>
                <div className="text-[8px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute mt-8">x2 SIZE</div>
            </div>

            {/* Item 6: Accum Zone */}
            <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center relative overflow-hidden h-20">
                <div className="absolute inset-0 bg-[#1a2e05] group-hover:bg-[#233d07] transition-colors" />
                <div className="font-mono text-[10px] font-bold text-[#c7f545] relative z-10">ACCUM_ZONE</div>
                <div className="text-[8px] text-[#c7f545]/70 font-mono mt-1 relative z-10">BUY 5%</div>
            </div>

            {/* Item 7: Distrib Zone */}
            <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center relative overflow-hidden h-20">
                <div className="absolute inset-0 bg-[#2e1a05] group-hover:bg-[#3d2207] transition-colors" />
                <div className="font-mono text-[10px] font-bold text-orange-500 relative z-10">DISTRIB_ZONE</div>
                <div className="text-[8px] text-orange-500/70 font-mono mt-1 relative z-10">SELL 1.5%</div>
            </div>

             {/* Item 8: Caution */}
             <div className="group border-r border-b border-white/10 p-3 flex flex-col items-center justify-center relative overflow-hidden h-20">
                <div className="absolute inset-0 bg-[#2e1a05] group-hover:bg-[#3d2207] transition-colors" />
                <div className="font-mono text-[10px] font-bold text-orange-600 relative z-10">CAUTION</div>
                <div className="text-[8px] text-orange-600/70 font-mono mt-1 relative z-10">PTSD ACTIVE</div>
            </div>

        </div>
      </div>
    </section>
  );
}
