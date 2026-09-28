import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea } from "recharts";

const data = Array.from({ length: 50 }, (_, i) => {
  const trend = i * 1.5;
  const noise = Math.sin(i * 0.5) * 10;
  const isTrap = i >= 15 && i <= 25;
  const price = 100 + trend + noise;
  
  return {
    name: i,
    price: price,
    velocity: isTrap ? -5 : 5,
    signal: isTrap ? "TRAP" : (i % 8 === 0 ? "BUY" : null)
  };
});

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-black border border-white/20 p-2 font-mono text-sm uppercase">
        <div className="mb-1 text-muted-foreground">T-{d.name}</div>
        <div className="text-white">PRC: {d.price.toFixed(2)}</div>
        <div className={`${d.velocity > 0 ? 'text-primary' : 'text-accent'}`}>
          VEL: {d.velocity}
        </div>
        {d.signal && (
          <div className={`mt-1 font-bold ${d.signal === "TRAP" ? "text-accent" : "text-primary"}`}>
            [{d.signal === "TRAP" ? "TRAP" : "EXEC"}]
          </div>
        )}
      </div>
    );
  }
  return null;
};

export function SimulationChart() {
  return (
    <section className="py-24 bg-background">
        <div className="container px-4 md:px-6 mb-8">
            <div className="border-l-2 border-primary pl-4">
                <h2 className="text-2xl font-bold font-mono uppercase mb-2">Simulation // Trap_Filter</h2>
                <p className="text-sm text-muted-foreground font-mono">
                    REAL-TIME VISUALIZATION OF SIGNAL REJECTION DURING NEGATIVE VELOCITY EVENTS.
                </p>
            </div>
        </div>

        <div className="container px-4 md:px-6">
            <div className="border border-white/10 bg-black/50 p-1">
                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 mb-1">
                    <div className="font-mono text-sm font-bold">BTC-USD [D]</div>
                    <div className="flex items-center gap-4 font-mono text-sm">
                        <span className="text-accent">TRAP_ZONE_ACTIVE</span>
                        <span className="text-primary">LIVE_FEED</span>
                    </div>
                </div>
                
                <div className="h-[25rem] w-full relative">
                    {/* Grid Overlay Effect */}
                    <div className="absolute inset-0 pointer-events-none opacity-10"  
                         style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px'}} 
                    />
                    
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" tick={{fontSize: 10, fontFamily: 'monospace'}} tickLine={false} axisLine={false} />
                            <YAxis stroke="rgba(255,255,255,0.2)" tick={{fontSize: 10, fontFamily: 'monospace'}} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} cursor={{stroke: 'white', strokeWidth: 1, strokeDasharray: '4 4'}} />
                            
                            <ReferenceArea 
                                x1={15} 
                                x2={25} 
                                strokeOpacity={0}
                                fill="hsl(var(--accent))" 
                                fillOpacity={0.15}
                            />
                            
                            <Area 
                                type="step" 
                                dataKey="price" 
                                stroke="hsl(var(--primary))" 
                                fill="url(#colorPrice)" 
                                strokeWidth={2}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </section>
  );
}
