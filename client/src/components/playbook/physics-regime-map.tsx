import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export function PhysicsRegimeMap() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
      <div className="text-center mb-12">
        <h1 className="text-2xl md:text-3xl font-light tracking-[0.2em] text-white mb-2">PHYSICS REGIME MAP</h1>
        <p className="text-muted-foreground text-sm">Velocity (direction) × Acceleration (momentum) = Regime</p>
      </div>

      <div className="relative max-w-2xl mx-auto aspect-[1.4] grid grid-cols-2 grid-rows-2 gap-1 md:gap-2 mb-12">
        {/* Axis Labels */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs text-muted-foreground tracking-widest">BULLISH PRESSURE (PUSHING UP) →</div>
        <div className="absolute -left-32 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground tracking-widest whitespace-nowrap">VELOCITY: RISING →</div>
        
        <div className="absolute -top-6 left-[25%] -translate-x-1/2 text-[10px] text-red-500 font-bold">BEARISH PRESSURE (PUSHING DOWN)</div>
        <div className="absolute -top-6 left-[75%] -translate-x-1/2 text-[10px] text-green-500 font-bold">VELOCITY: RISING</div>

        <QuadrantBox bg="bg-gradient-to-br from-green-900/20 to-green-950/40" border="border-green-800/30">
          <RegimeCard 
            title="CRUISE CONTROL" 
            subtitle="or BULLISH FLAGGING" 
            icon="══►" 
            color="text-lime-400" 
            action="HOLD / ADD DIP" 
            description="Rising but slowing · coast or prepare for pullback"
          />
        </QuadrantBox>
        
        <QuadrantBox bg="bg-gradient-to-br from-green-900/40 to-green-800/60" border="border-green-500" highlight={true}>
          <RegimeCard 
            title="POWER TREND" 
            subtitle="★★★ BEST FOR LONGS" 
            icon="▲▲▲" 
            color="text-green-500" 
            action="AGGRESSIVE LONG" 
            description="Rising and accelerating · maximum bullish momentum"
          />
        </QuadrantBox>
        
        <QuadrantBox bg="bg-gradient-to-br from-red-900/40 to-red-800/60" border="border-red-500" highlight={true}>
          <RegimeCard 
            title="LIQUIDATION" 
            subtitle="★★★ BEST FOR SHORTS" 
            icon="▼▼▼" 
            color="text-red-500" 
            action="HARD SHORT" 
            description="Falling and accelerating down · maximum bearish momentum"
          />
        </QuadrantBox>
        
        <QuadrantBox bg="bg-gradient-to-br from-cyan-900/20 to-cyan-950/40" border="border-cyan-500/30">
          <RegimeCard 
            title="BEAR TRAP" 
            subtitle="AQUA ZONE 🔵" 
            icon="◇◇◇" 
            color="text-cyan-400" 
            action="COVER / REVERSAL" 
            description="Falling but slowing · selling exhaustion, bounce coming"
          />
        </QuadrantBox>
      </div>

      <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SpecialCard icon="⚡" title="G-FORCE" color="text-white" description="Sudden shock in momentum · white line flash" />
        <SpecialCard icon="◆◇◆" title="ENGINE CHECK" color="text-orange-500" description="Price up, accel down · divergence warning" />
        <SpecialCard icon="⟲⟲⟲" title="VOLATILITY COIL" color="text-purple-500" description="Squeeze detected · await breakout" />
      </div>

      <div className="max-w-2xl mx-auto bg-gradient-to-br from-red-900/10 to-orange-900/10 border border-red-500/30 rounded-xl p-6">
        <div className="text-sm font-bold text-red-500 mb-4 flex items-center gap-2">
          ⚠️ HINDENBURG OVERLAY
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-500/10 rounded-lg p-4 text-center border border-red-500/20">
            <div className="text-xs text-muted-foreground mb-1">Hindenburg + Velocity NEGATIVE</div>
            <div className="text-sm text-red-500 font-bold">🔴 CRASH WARNING</div>
            <div className="text-[10px] text-muted-foreground mt-1">NO LONGS · confirmed breakdown</div>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-4 text-center border border-orange-500/20">
            <div className="text-xs text-muted-foreground mb-1">Hindenburg + Velocity POSITIVE</div>
            <div className="text-sm text-orange-500 font-bold">🟠 STRUCTURAL TRAP</div>
            <div className="text-[10px] text-muted-foreground mt-1">CAUTION · possible shakeout</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuadrantBox({ children, bg, border, highlight }: any) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`${bg} border-2 ${border} rounded-xl p-4 md:p-6 flex items-center justify-center ${highlight ? 'shadow-[0_0_30px_-5px_rgba(0,0,0,0.3)]' : ''} transition-all`}
    >
      {children}
    </motion.div>
  );
}

function RegimeCard({ title, subtitle, icon, color, action, description }: any) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl mb-2 md:mb-3">{icon}</div>
      <div className={`text-sm md:text-base font-bold ${color} mb-0.5 leading-tight`}>{title}</div>
      <div className="text-[10px] text-muted-foreground mb-3 tracking-wider uppercase">{subtitle}</div>
      <div className={`inline-block ${color.replace('text-', 'bg-')}/10 border ${color.replace('text-', 'border-')}/30 rounded px-3 py-1.5 text-[10px] font-bold ${color} mb-2 md:mb-3`}>
        {action}
      </div>
      <div className="text-[10px] text-muted-foreground leading-tight hidden md:block">{description}</div>
    </div>
  );
}

function SpecialCard({ icon, title, color, description }: any) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center hover:bg-white/10 transition-colors">
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-xs font-bold ${color} mb-1`}>{title}</div>
      <div className="text-[10px] text-muted-foreground">{description}</div>
    </div>
  );
}
