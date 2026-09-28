import React from 'react';

export function ZoneAnatomy() {
  const ZoneExample = ({ title, rating, score, borderWidth, tags, features, action, actionColor }: any) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 md:p-6 overflow-hidden hover:border-white/20 transition-colors">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-[10px] text-muted-foreground">Score: {score}</div>
        </div>
        <div className="text-lg text-yellow-500 tracking-widest">{rating}</div>
      </div>
      <div 
        className="h-16 rounded-lg flex items-center justify-end px-3 mb-4 relative"
        style={{
          border: `${borderWidth}px ${title.includes('Mitigated') ? 'dashed' : 'solid'} ${title.includes('Mitigated') ? '#888' : '#22c55e'}`,
          backgroundColor: `rgba(34, 197, 94, ${title.includes('Mitigated') ? 0.1 : 0.35})`
        }}
      >
        <div className="absolute left-2 top-2 text-[10px] text-white/80">D{rating}</div>
        <div className="flex gap-1">
          {tags.map((tag: string, i: number) => (
            <span key={i} className="text-[9px] bg-black/50 px-1.5 py-0.5 rounded text-white">{tag}</span>
          ))}
        </div>
      </div>
      <div className="mb-4 space-y-1">
        {features.map((f: string, i: number) => (
          <div key={i} className="text-[10px] text-muted-foreground border-b border-white/5 pb-1">• {f}</div>
        ))}
      </div>
      <div 
        className="text-center py-2 rounded-md text-[10px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: `${actionColor}20`, color: actionColor }}
      >
        {action}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
      <div className="text-center mb-12">
        <div className="inline-block">
          <h1 className="font-mono text-sm md:text-base leading-none text-white/90 tracking-tight mb-4 whitespace-pre">
{`░▀▀█░█▀█░█▀█░█▀▀░░░█▀█░█▀█░█▀█░▀█▀░█▀█░█▄█░█░█
░▄▀░░█░█░█░█░█▀▀░░░█▀█░█░█░█▀█░░█░░█░█░█░█░░█░
░▀▀▀░▀▀▀░▀░▀░▀▀▀░░░▀░▀░▀░▀░▀░▀░░▀░░▀▀▀░▀░▀░░▀░`}
          </h1>
          <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent rounded-full mt-2"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
        <ZoneExample title="ELITE ZONE" rating="★★★" score="8+" borderWidth={3} tags={['HTF', '(Sweep)', '(POC)']}
          features={['Thick border (high quality)', 'Solid fill (untouched)', 'Multiple tags present', 'Cluster count (3+)']}
          action="FULL SIZE" actionColor="#22c55e" />
        <ZoneExample title="STRONG ZONE" rating="★★" score="6-8" borderWidth={2} tags={['HTF']}
          features={['Normal border', 'Solid fill (untouched)', '1-2 tags present', 'Good institutional footprint']}
          action="STANDARD SIZE" actionColor="#a3e635" />
        <ZoneExample title="WEAK ZONE" rating="★" score="4-6" borderWidth={1} tags={[]}
          features={['Thin border', 'No special tags', 'Single cluster count', 'Minimum threshold only']}
          action="REDUCED SIZE" actionColor="#eab308" />
        <ZoneExample title="MITIGATED ZONE" rating="·" score="Touched" borderWidth={1} tags={[]}
          features={['Dashed border', 'Faded fill (ghostly)', 'Price has touched it', 'May fail on retest']}
          action="SKIP OR SCALP" actionColor="#ef4444" />
      </div>

      <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-xl p-6 md:p-8 mb-12">
        <h2 className="text-xs font-bold text-muted-foreground mb-6 tracking-widest uppercase">TAG MEANINGS</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { tag: 'HTF', meaning: 'Higher Timeframe Aligned', description: 'Zone confirmed on 4H+ timeframe', points: '+1' },
            { tag: '(Sweep)', meaning: 'Liquidity Sweep', description: 'Zone formed after stop hunt', points: '+2' },
            { tag: '(POC)', meaning: 'Point of Control', description: 'Zone contains highest volume price', points: '+2' },
            { tag: '(Vol+)', meaning: 'High Volume Node', description: 'Zone in high-volume area', points: '+1' },
            { tag: '(Vol-)', meaning: 'Low Volume Node', description: 'Zone in thin liquidity area', points: '-0.5' },
            { tag: '(N)', meaning: 'Cluster Count', description: 'N zones merged together', points: '+0.1 each' }
          ].map((item, i) => (
            <div key={i} className="bg-black/30 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-green-500 font-mono">{item.tag}</span>
                <span className={`text-[10px] ${item.points.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>{item.points}</span>
              </div>
              <div className="text-[10px] text-white mb-1 font-medium">{item.meaning}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{item.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">▬▲▬</div>
          <div className="text-base font-bold text-teal-500">DEMAND ZONE</div>
          <div className="text-xs text-muted-foreground mt-2">Look for LONGS</div>
          <div className="text-[10px] text-teal-400 mt-3 p-2 bg-teal-500/10 rounded">
            Entry: Price taps zone from above<br/>Stop: Below zone low
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">▬▼▬</div>
          <div className="text-base font-bold text-red-500">SUPPLY ZONE</div>
          <div className="text-xs text-muted-foreground mt-2">Look for SHORTS</div>
          <div className="text-[10px] text-red-400 mt-3 p-2 bg-red-500/10 rounded">
            Entry: Price taps zone from below<br/>Stop: Above zone high
          </div>
        </div>
      </div>
    </div>
  );
}