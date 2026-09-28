import { motion } from "framer-motion";

const stats = [
  { 
    label: "TOTAL_VOO_RETURN", 
    value: "+555.04%", 
    color: "text-primary",
    sub: "SINCE SEP 9, 2010"
  },
  { 
    label: "MAX_DD (UNREALIZED)", 
    value: "23.17%", 
    color: "text-accent",
    sub: "LOW VOLATILITY" 
  },
  { 
    label: "WIN_RATE", 
    value: "93.81%", 
    color: "text-white",
    sub: "HIGH PRECISION" 
  },
];

export function PerformanceMetrics() {
  return (
    <section className="border-b border-white/10 bg-black">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10 border-x border-white/10">
          {stats.map((stat, idx) => (
            <div key={idx} className="p-6 group hover:bg-white/5 transition-colors">
              <div className="font-mono text-sm text-muted-foreground mb-2 uppercase tracking-widest flex justify-between">
                <span>{stat.label}</span>
              </div>
              <div className={`text-3xl md:text-4xl font-bold font-mono ${stat.color} tracking-tighter mb-2`}>
                {stat.value}
              </div>
              <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider border-l border-white/20 pl-2 flex justify-between items-center">
                <span>{stat.sub}</span>
                <span className="text-[8px] opacity-50">[//////..]</span>
              </div>
              
              {/* ASCII Border Bottom */}
              <div className="text-[8px] text-white/10 font-mono mt-2 select-none pointer-events-none opacity-50">
                └────────────────────────────┘
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
