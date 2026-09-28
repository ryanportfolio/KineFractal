import React from 'react';

export function QuickReference() {
  const statusColors: any = {
    green: { bg: '#22c55e', glow: 'rgba(34,197,94,0.3)' },
    yellow: { bg: '#eab308', glow: 'rgba(234,179,8,0.3)' },
    orange: { bg: '#f97316', glow: 'rgba(249,115,22,0.3)' },
    red: { bg: '#ef4444', glow: 'rgba(239,68,68,0.3)' },
    cyan: { bg: '#06b6d4', glow: 'rgba(6,182,212,0.3)' }
  };

  const TrafficLightCard = ({ title, subtitle, items }: any) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-5 overflow-hidden hover:border-white/20 transition-colors">
      <div className="flex justify-between items-baseline mb-4">
        <h3 className="m-0 text-xs font-bold text-white tracking-widest uppercase">{title}</h3>
        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item: any, i: number) => {
          const color = statusColors[item.status];
          return (
            <div key={i} className="grid grid-cols-[12px_80px_60px_1fr] items-center gap-3 p-2 bg-black/20 rounded-lg">
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px]"
                style={{ backgroundColor: color.bg, boxShadow: `0 0 8px ${color.glow}` }} 
              />
              <div className="text-[10px] font-bold" style={{ color: color.bg }}>{item.label}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{item.value}</div>
              <div className="text-[10px] text-muted-foreground/80 text-right">{item.action}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <TrafficLightCard title="RISK SCORE" subtitle="Script 3" items={[
          { status: 'green', label: 'SAFE', value: '0-25', action: '100% size' },
          { status: 'yellow', label: 'CAUTION', value: '26-50', action: '50-75% size' },
          { status: 'orange', label: 'FRAGILE', value: '51-75', action: '25-50% size' },
          { status: 'red', label: 'CRASH', value: '76-100', action: 'No longs' }
        ]} />
        <TrafficLightCard title="VIX REGIME" subtitle="Script 3" items={[
          { status: 'green', label: 'INVEST', value: '≤19', action: 'Trend-follow' },
          { status: 'orange', label: 'CHOP', value: '19-30', action: 'Mean-revert' },
          { status: 'red', label: 'WARN', value: '≥30', action: 'Defensive' }
        ]} />
        <TrafficLightCard title="FRAGILITY" subtitle="U-shaped" items={[
          { status: 'red', label: 'EXTREME', value: '<12', action: 'Crash risk' },
          { status: 'orange', label: 'HIGH', value: '12-14', action: 'Elevated risk' },
          { status: 'yellow', label: 'MODERATE', value: '14-17', action: 'Caution' },
          { status: 'green', label: 'NORMAL', value: '17-21', action: 'Sweet spot' },
          { status: 'green', label: 'DE-RISKED', value: '21-22', action: 'Clean' },
          { status: 'yellow', label: 'ELEVATED', value: '>22', action: 'Active vol' }
        ]} />
        <TrafficLightCard title="ZONE QUALITY" subtitle="Script 1" items={[
          { status: 'green', label: '★★★', value: '8+ pts', action: 'Full size' },
          { status: 'yellow', label: '★★', value: '6-8 pts', action: 'Standard' },
          { status: 'orange', label: '★', value: '4-6 pts', action: 'Reduced' },
          { status: 'red', label: 'No stars', value: '2-4 pts', action: 'Skip/scalp' }
        ]} />
        <TrafficLightCard title="PHYSICS (Longs)" subtitle="Script 5" items={[
          { status: 'green', label: 'POWER TREND', value: 'V+ A+', action: 'Aggressive' },
          { status: 'green', label: 'CRUISE', value: 'V+ A−', action: 'Hold' },
          { status: 'cyan', label: 'BEAR TRAP', value: 'V− A+', action: 'Reversal' },
          { status: 'red', label: 'LIQUIDATION', value: 'V− A−', action: 'No longs' }
        ]} />
        <TrafficLightCard title="INTERNAL HEALTH" subtitle="Script 5" items={[
          { status: 'green', label: 'STABLE', value: 'Inactive', action: 'Proceed' },
          { status: 'orange', label: 'TRAP', value: 'H + V+', action: 'Caution' },
          { status: 'red', label: 'CRASH', value: 'H + V−', action: 'No longs' }
        ]} />
        <TrafficLightCard title="LUMINA SIGNAL" subtitle="Script 4" items={[
          { status: 'green', label: 'R + X', value: '<10 bars', action: 'Execute' },
          { status: 'yellow', label: 'R + X', value: '10-40 bars', action: 'Good' },
          { status: 'orange', label: 'H + X', value: 'Hidden', action: 'Continuation' },
          { status: 'red', label: 'X only', value: 'No div', action: 'Needs confluence' }
        ]} />
        <TrafficLightCard title="MACRO TREND" subtitle="Script 2" items={[
          { status: 'green', label: 'Q20 + M5', value: 'Above both', action: 'Full bull' },
          { status: 'yellow', label: 'Q20 only', value: 'Above Q20', action: 'Pullback' },
          { status: 'orange', label: 'M5 only', value: 'Above M5', action: 'Bear rally' },
          { status: 'red', label: 'Neither', value: 'Below both', action: 'Full bear' }
        ]} />
      </div>

      <div className="max-w-4xl mx-auto mt-12 bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
        <h2 className="text-xs font-bold text-muted-foreground mb-6 text-center tracking-widest uppercase">
          30-SECOND DECISION TREE
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {[
            { text: "Risk < 50?", yes: "→", no: "REDUCE" },
            { text: "Internals OK?", yes: "→", no: "WAIT" },
            { text: "At zone?", yes: "→", no: "WAIT" },
            { text: "Trigger fired?", yes: "✓ TRADE", no: "WAIT", isLast: true }
          ].map((node: any, i) => (
            <React.Fragment key={i}>
              <div className="bg-indigo-500/20 border border-indigo-500/40 rounded-lg p-3 md:p-4 text-center min-w-[140px]">
                <div className="text-xs text-white mb-2 font-medium">{node.text}</div>
                <div className="flex justify-center gap-4 text-[10px]">
                  <span className="text-green-500 font-bold">Y: {node.yes}</span>
                  <span className="text-red-500 font-bold">N: {node.no}</span>
                </div>
              </div>
              {!node.isLast && <span className="text-muted-foreground text-xl">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}