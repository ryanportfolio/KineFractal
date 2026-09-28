import React, { useState } from 'react';
import { Check, RefreshCcw } from 'lucide-react';

export function ConfluenceScorer() {
  const [scores, setScores] = useState<any>({
    trendAligned: false, fibFavorable: false, vixVelocity: false, breadthConfirm: false, riskSafe: false, creditSupport: false,
    physicsAligned: false, internalsStable: false, noHindenburg: false,
    threeStars: false, twoStars: false, sweepTag: false, htfTag: false, pocTag: false,
    regularDiv: false, triggerFresh: false, triggerValid: false, tsiExtreme: false
  });

  const calculateTotal = () => {
    let total = 0;
    if (scores.trendAligned) total += 5;
    if (scores.fibFavorable) total += 5;
    if (scores.vixVelocity) total += 5;
    if (scores.breadthConfirm) total += 5;
    if (scores.riskSafe) total += 5;
    if (scores.creditSupport) total += 5;
    if (scores.physicsAligned) total += 10;
    if (scores.internalsStable) total += 10;
    if (scores.noHindenburg) total += 5;
    if (scores.threeStars) total += 10;
    else if (scores.twoStars) total += 5;
    if (scores.sweepTag) total += 5;
    if (scores.htfTag) total += 5;
    if (scores.pocTag) total += 5;
    if (scores.regularDiv) total += 10;
    if (scores.triggerFresh) total += 5;
    else if (scores.triggerValid) total += 3;
    if (scores.tsiExtreme) total += 5;
    return total;
  };

  const total = calculateTotal();
  const grade = total >= 80 ? 'A+' : total >= 65 ? 'A' : total >= 50 ? 'B' : total >= 35 ? 'C' : 'F';
  const gradeColor = total >= 80 ? '#22c55e' : total >= 65 ? '#a3e635' : total >= 50 ? '#eab308' : total >= 35 ? '#f97316' : '#ef4444';
  const sizeRec = total >= 80 ? '100%' : total >= 65 ? '75-100%' : total >= 50 ? '50-75%' : total >= 35 ? '25-50%' : 'SKIP';

  const toggle = (key: string) => setScores((prev: any) => ({ ...prev, [key]: !prev[key] }));

  const ChecklistSection = ({ title, subtitle, maxPoints, color, items, onToggle }: any) => {
    const currentPoints = items.reduce((sum: number, item: any) => sum + (item.checked ? item.points : 0), 0);
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 overflow-hidden hover:border-white/20 transition-colors">
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{title}</div>
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          </div>
          <div className="text-sm font-bold" style={{ color: currentPoints > 0 ? color : '#444' }}>{currentPoints}/{maxPoints}</div>
        </div>
        <div className="space-y-1">
          {items.map((item: any, i: number) => (
            <div key={i} onClick={() => onToggle(item.key)} className={`
              flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200
              ${item.checked ? 'bg-' + color.replace('#', '') + '/10' : 'bg-black/20 hover:bg-black/40'}
            `} style={{ backgroundColor: item.checked ? `${color}15` : undefined }}>
              <div className={`
                w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors
              `} style={{ 
                borderColor: item.checked ? color : '#444',
                backgroundColor: item.checked ? color : 'transparent'
              }}>
                {item.checked && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className={`flex-1 text-xs ${item.checked ? 'text-white' : 'text-muted-foreground'}`}>{item.label}</div>
              <div className="text-[10px] font-bold" style={{ color: item.checked ? color : '#555' }}>+{item.points}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
      <div className="text-center mb-12">
        <h1 className="text-2xl md:text-3xl font-light tracking-[0.2em] text-white mb-2">CONFLUENCE SCORER</h1>
        <p className="text-muted-foreground text-xs">Click items to toggle. Maximum 100 points.</p>
      </div>

      <div 
        className="max-w-3xl mx-auto mb-8 flex justify-center gap-8 md:gap-12 p-6 bg-white/5 rounded-2xl border-2 transition-colors duration-500"
        style={{ borderColor: `${gradeColor}40` }}
      >
        <div className="text-center">
          <div className="text-4xl md:text-5xl font-bold transition-colors duration-300" style={{ color: gradeColor }}>{total}</div>
          <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-1">/ 100 POINTS</div>
        </div>
        <div className="w-px bg-white/10" />
        <div className="text-center">
          <div className="text-4xl md:text-5xl font-bold transition-colors duration-300" style={{ color: gradeColor }}>{grade}</div>
          <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-1">GRADE</div>
        </div>
        <div className="w-px bg-white/10" />
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold transition-colors duration-300 mt-2" style={{ color: gradeColor }}>{sizeRec}</div>
          <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-2">POSITION SIZE</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <ChecklistSection title="LAYER 1: MACRO" subtitle="Scripts 2 & 3" maxPoints={30} color="#6366f1" items={[
          { key: 'trendAligned', label: 'Q20/M5 trend aligned', points: 5, checked: scores.trendAligned },
          { key: 'fibFavorable', label: 'Q-Fib favorable zone', points: 5, checked: scores.fibFavorable },
          { key: 'vixVelocity', label: 'VIX velocity favorable', points: 5, checked: scores.vixVelocity },
          { key: 'breadthConfirm', label: 'Breadth confirms', points: 5, checked: scores.breadthConfirm },
          { key: 'riskSafe', label: 'Risk Score SAFE (<25)', points: 5, checked: scores.riskSafe },
          { key: 'creditSupport', label: 'Credit supportive', points: 5, checked: scores.creditSupport }
        ]} onToggle={toggle} />
        <ChecklistSection title="LAYER 2: REGIME" subtitle="Script 5" maxPoints={25} color="#22c55e" items={[
          { key: 'physicsAligned', label: 'Physics regime aligned', points: 10, checked: scores.physicsAligned },
          { key: 'internalsStable', label: 'Internal health STABLE', points: 10, checked: scores.internalsStable },
          { key: 'noHindenburg', label: 'No Hindenburg active', points: 5, checked: scores.noHindenburg }
        ]} onToggle={toggle} />
        <ChecklistSection title="LAYER 3: STRUCTURE" subtitle="Script 1" maxPoints={25} color="#f59e0b" items={[
          { key: 'threeStars', label: 'Zone ★★★ (8+ pts)', points: 10, checked: scores.threeStars },
          { key: 'twoStars', label: 'Zone ★★ (6-8 pts)', points: 5, checked: scores.twoStars },
          { key: 'sweepTag', label: '(Sweep) tag present', points: 5, checked: scores.sweepTag },
          { key: 'htfTag', label: 'HTF tag present', points: 5, checked: scores.htfTag },
          { key: 'pocTag', label: '(POC) or (Vol+) tag', points: 5, checked: scores.pocTag }
        ]} onToggle={toggle} />
        <ChecklistSection title="LAYER 4: SIGNAL" subtitle="Script 4" maxPoints={20} color="#ef4444" items={[
          { key: 'regularDiv', label: 'Regular divergence (R)', points: 10, checked: scores.regularDiv },
          { key: 'triggerFresh', label: 'Trigger <10 bars', points: 5, checked: scores.triggerFresh },
          { key: 'triggerValid', label: 'Trigger 10-40 bars', points: 3, checked: scores.triggerValid },
          { key: 'tsiExtreme', label: 'TSI at extreme', points: 5, checked: scores.tsiExtreme }
        ]} onToggle={toggle} />
      </div>

      <div className="text-center mt-12">
        <button 
          onClick={() => setScores(Object.fromEntries(Object.keys(scores).map(k => [k, false])))} 
          className="group inline-flex items-center gap-2 px-6 py-2.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 rounded-lg text-red-500 text-xs font-bold tracking-wider transition-all"
        >
          <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          RESET ALL SCORES
        </button>
      </div>
    </div>
  );
}