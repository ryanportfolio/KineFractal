import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowDown } from 'lucide-react';

export function DecisionFlow() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
      <div className="text-center mb-12">
        <h1 className="text-2xl md:text-3xl font-light tracking-[0.2em] text-white mb-2">THE 4-LAYER DECISION FLOW</h1>
        <p className="text-muted-foreground text-sm">Work top-to-bottom. Each gate must pass before proceeding.</p>
      </div>

      <div className="flex flex-col items-center gap-0 max-w-2xl mx-auto">
        <Layer
          number="1"
          title="MACRO ENVIRONMENT"
          subtitle="Scripts 2 & 3"
          color="text-indigo-500"
          borderColor="border-indigo-500/40"
          bgColor="bg-indigo-500"
          questions={[
            { q: "Risk Score?", pass: "< 50", fail: "50+" },
            { q: "Q20/M5 Trend?", pass: "Aligned", fail: "Against" },
            { q: "Credit?", pass: "Supportive", fail: "Deteriorating" }
          ]}
          passAction="PROCEED →"
          failAction="REDUCE SIZE or SKIP"
        />
        <Arrow />
        <Layer
          number="2"
          title="MARKET REGIME"
          subtitle="Script 5"
          color="text-green-500"
          borderColor="border-green-500/40"
          bgColor="bg-green-500"
          questions={[
            { q: "Physics Regime?", pass: "Power/Cruise/Trap", fail: "Liquidation" },
            { q: "Internal Health?", pass: "STABLE", fail: "CRITICAL FAIL" },
            { q: "Hindenburg?", pass: "Inactive", fail: "Active" }
          ]}
          passAction="PROCEED →"
          failAction="WAIT or REVERSE BIAS"
        />
        <Arrow />
        <Layer
          number="3"
          title="PRICE STRUCTURE"
          subtitle="Script 1"
          color="text-amber-500"
          borderColor="border-amber-500/40"
          bgColor="bg-amber-500"
          questions={[
            { q: "Zone Quality?", pass: "★★+", fail: "★ or none" },
            { q: "Zone Tags?", pass: "HTF/Sweep/POC", fail: "None" },
            { q: "Zone Fresh?", pass: "Solid fill", fail: "Mitigated/Ghost" }
          ]}
          passAction="PROCEED →"
          failAction="REDUCE SIZE or WAIT"
        />
        <Arrow />
        <Layer
          number="4"
          title="EXECUTION SIGNAL"
          subtitle="Script 4"
          color="text-red-500"
          borderColor="border-red-500/40"
          bgColor="bg-red-500"
          questions={[
            { q: "Divergence?", pass: "R or H present", fail: "None" },
            { q: "Trigger?", pass: "X fired", fail: "Waiting" },
            { q: "TSI Extreme?", pass: "At threshold", fail: "Neutral" }
          ]}
          passAction="✓ EXECUTE TRADE"
          failAction="WAIT FOR TRIGGER"
          isLast={true}
        />
      </div>

      <div className="mt-12 flex justify-center gap-8 flex-wrap">
        <LegendItem color="bg-green-500" label="Pass Criteria" />
        <LegendItem color="bg-red-500" label="Fail Criteria" />
        <LegendItem color="bg-indigo-500" label="Layer Indicator" />
      </div>
    </div>
  );
}

function Layer({ number, title, subtitle, color, borderColor, bgColor, questions, passAction, failAction, isLast }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`bg-card/30 border ${borderColor} rounded-2xl p-6 md:p-8 w-full relative backdrop-blur-sm`}
    >
      <div className={`absolute -top-3 left-6 ${bgColor} text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest shadow-lg shadow-${color}/20`}>
        LAYER {number}
      </div>
      
      <div className="mb-6 mt-2">
        <h2 className="text-xl font-bold text-white mb-0.5">{title}</h2>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{subtitle}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {questions.map((item: any, i: number) => (
          <div key={i} className="bg-black/40 rounded-lg p-3 text-center border border-white/5">
            <div className="text-[10px] uppercase text-muted-foreground mb-2">{item.q}</div>
            <div className="text-xs text-green-500 font-medium mb-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {item.pass}
            </div>
            <div className="text-xs text-red-500 font-medium flex items-center justify-center gap-1">
              <XCircle className="w-3 h-3" /> {item.fail}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className={`flex-1 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center text-sm font-bold text-green-500 flex items-center justify-center gap-2`}>
            {isLast && <CheckCircle2 className="w-4 h-4" />}
            {passAction}
        </div>
        <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center text-sm font-bold text-red-500">
            {failAction}
        </div>
      </div>
    </motion.div>
  );
}

function Arrow() {
  return (
    <div className="flex flex-col items-center py-2 opacity-50">
      <div className="w-0.5 h-8 bg-gradient-to-b from-white/20 to-white/40" />
      <ArrowDown className="w-4 h-4 text-white/40 -mt-1" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}
