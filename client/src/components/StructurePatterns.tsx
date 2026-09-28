import React from 'react';

// ============ REALISTIC CANDLE COMPONENT ============
// Mimics TradingView candle style with proper proportions
interface CandleProps {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
  baseY?: number;
  scale?: number;
  width?: number;
}

function Candle({ x, o, h, l, c, baseY = 300, scale = 1.5, width = 9 }: CandleProps) {
  const isBull = c > o;
  const bullColor = '#089981';  // TradingView green
  const bearColor = '#f23645';  // TradingView red
  const color = isBull ? bullColor : bearColor;
  
  // Convert prices to Y coordinates (inverted - higher price = lower Y)
  const toY = (price: number) => baseY - (price * scale);
  
  const highY = toY(h);
  const lowY = toY(l);
  const openY = toY(o);
  const closeY = toY(c);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
  
  return (
    <g>
      {/* Upper wick */}
      <line 
        x1={x + width/2} y1={highY} 
        x2={x + width/2} y2={bodyTop}
        stroke={color} strokeWidth="1"
      />
      {/* Lower wick */}
      <line 
        x1={x + width/2} y1={Math.max(openY, closeY)} 
        x2={x + width/2} y2={lowY}
        stroke={color} strokeWidth="1"
      />
      {/* Body */}
      <rect 
        x={x} y={bodyTop} 
        width={width} height={bodyHeight}
        fill={color}
        stroke={color} strokeWidth="0.5"
      />
    </g>
  );
}

// ============ ZONE BOX COMPONENT ============
interface ZoneBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  type?: 'demand' | 'supply';
  label?: string;
  stars?: number;
  tags?: string[];
  mitigated?: boolean;
}

function ZoneBox({ x, y, width, height, type = 'demand', label, stars = 2, tags = [], mitigated = false }: ZoneBoxProps) {
  const demandColor = '#26a69a';
  const supplyColor = '#ef5350';
  const color = type === 'demand' ? demandColor : supplyColor;
  const opacity = mitigated ? 0.15 : 0.25;
  
  // Build label text like indicator does: "D★★ HTF (Sweep)"
  const typeChar = type === 'demand' ? 'D' : 'S';
  const starStr = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3-stars));
  const tagStr = tags.length > 0 ? ' ' + tags.join(' ') : '';
  const fullLabel = label || `${typeChar}${starStr}${tagStr}`;
  
  return (
    <g>
      {/* Zone fill */}
      <rect 
        x={x} y={y} width={width} height={height}
        fill={color} fillOpacity={opacity}
        stroke={color} strokeWidth={mitigated ? 1 : 1.5}
        strokeDasharray={mitigated ? "4,3" : "none"}
      />
      {/* Zone label - top right like indicator */}
      <text 
        x={x + width - 4} y={y + 12} 
        fill={color} fontSize="10" fontWeight="500" 
        textAnchor="end" fontFamily="monospace"
      >
        {fullLabel}
      </text>
    </g>
  );
}

// ============ PRICE LEVEL LINE ============
interface PriceLineProps {
  y: number;
  x1: number;
  x2: number;
  color?: string;
  dashed?: boolean;
  label?: string;
}

function PriceLine({ y, x1, x2, color = '#363a45', dashed = true, label = '' }: PriceLineProps) {
  return (
    <g>
      <line 
        x1={x1} y1={y} x2={x2} y2={y} 
        stroke={color} strokeWidth="1" 
        strokeDasharray={dashed ? "2,2" : "none"} 
        opacity="0.6"
      />
      {label && (
        <text x={x2 + 4} y={y + 3} fill={color} fontSize="9" opacity="0.8">
          {label}
        </text>
      )}
    </g>
  );
}

// ============ ANNOTATION ARROW ============
interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  label?: string;
  labelPos?: 'start' | 'end' | 'middle';
}

function Arrow({ x1, y1, x2, y2, color = '#787b86', label = '', labelPos = 'end' }: ArrowProps) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 6;
  
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" />
      <polygon 
        points={`${x2},${y2} ${x2-headLen*Math.cos(angle-0.5)},${y2-headLen*Math.sin(angle-0.5)} ${x2-headLen*Math.cos(angle+0.5)},${y2-headLen*Math.sin(angle+0.5)}`}
        fill={color}
      />
      {label && (
        <text 
          x={labelPos === 'end' ? x2 + 8 : (x1+x2)/2} 
          y={labelPos === 'end' ? y2 + 4 : y1 - 8} 
          fill={color} fontSize="10" fontWeight="500"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ============ LIQUIDITY DOTS (stop losses) ============
interface LiquidityDotsProps {
  x: number;
  y: number;
  count?: number;
  color?: string;
}

function LiquidityDots({ x, y, count = 5, color = '#ef5350' }: LiquidityDotsProps) {
  return (
    <g>
      {[...Array(count)].map((_, i) => (
        <circle 
          key={i} 
          cx={x + i * 8} cy={y} r="2" 
          fill={color} opacity="0.6"
        />
      ))}
      <text x={x + count * 8 + 4} y={y + 3} fill={color} fontSize="8" opacity="0.7">
        stops
      </text>
    </g>
  );
}

// ============ DBR PATTERN (Drop-Base-Rally) - Demand Zone ============
export function DBRPattern() {
  const baseY = 280;
  const scale = 2.2;
  const candleW = 11;
  const gap = 14;
  const svgWidth = 380;
  
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39] h-full flex flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#26a69a] text-[#131722] px-2 py-0.5 rounded text-[11px] font-bold">DEMAND</span>
          <span className="text-[#d1d4dc] text-sm font-bold">Drop-Base-Rally (DBR)</span>
          <span className="text-[#787b86] text-[11px] ml-auto">Reversal</span>
        </div>
        <p className="text-[#787b86] text-[11px] leading-tight">Price drops → consolidates (base) → rallies explosively. Strong reversal signal.</p>
      </div>
      
      <div className="flex-1 min-h-[260px] relative">
      <svg width="100%" height="100%" viewBox="0 0 380 260" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        <PriceLine y={60} x1={10} x2={370} />
        <PriceLine y={120} x1={10} x2={370} />
        <PriceLine y={180} x1={10} x2={370} />
        
        {/* ZONE BOX - Extended to full width */}
        <ZoneBox x={20+gap*4-3} y={baseY - 66*scale} width={svgWidth - (20+gap*4-3)} height={19*scale} type="demand" stars={3} tags={['']} />
        
        {/* DROP phase - bearish candles coming down */}
        <Candle x={20} o={110} h={115} l={100} c={102} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap} o={102} h={105} l={88} c={90} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*2} o={90} h={92} l={72} c={75} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*3} o={75} h={78} l={58} c={60} baseY={baseY} scale={scale} width={candleW} />
        
        {/* BASE phase - small body candles with wicks (indecision) */}
        <Candle x={20+gap*4} o={60} h={66} l={52} c={58} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*5} o={58} h={65} l={50} c={55} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*6} o={55} h={62} l={48} c={52} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*7} o={52} h={60} l={47} c={57} baseY={baseY} scale={scale} width={candleW} />
        
        
        {/* RALLY phase - strong bullish leg out */}
        <Candle x={20+gap*8} o={57} h={80} l={55} c={78} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*9} o={78} h={95} l={76} c={93} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*10} o={93} h={108} l={90} c={105} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*11} o={105} h={120} l={102} c={118} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Retest candles */}
        <Candle x={20+gap*12} o={118} h={122} l={108} c={110} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*13} o={110} h={112} l={95} c={98} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*14} o={98} h={100} l={80} c={82} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*15} o={82} h={88} l={62} c={65} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Bounce from zone */}
        <Candle x={20+gap*16} o={65} h={85} l={58} c={82} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*17} o={82} h={100} l={80} c={98} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Annotations */}
        <text x={35} y={25} fill="#ef5350" fontSize="10" fontWeight="500">DROP</text>
        <text x={92} y={245} fill="#787b86" fontSize="10" fontWeight="500">BASE</text>
        <text x={160} y={25} fill="#26a69a" fontSize="10" fontWeight="500">RALLY</text>
        <text x={250} y={105} fill="#787b86" fontSize="9">Retest</text>
        <Arrow x1={270} y1={110} x2={250} y2={140} color="#787b86" />
        
        {/* Entry arrow */}
        <Arrow x1={256} y1={205} x2={256} y2={175} color="#26a69a" label="Entry" />
      </svg>
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#26a69a] font-bold mb-1">✓ Zone Criteria</div>
          <div className="text-[#787b86]">• Strong leg-out</div>
          <div className="text-[#787b86]">• Base: 1-4 candles</div>
        </div>
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#d1d4dc] font-bold mb-1">Trade Setup</div>
          <div className="text-[#787b86]">• Entry: Zone top</div>
          <div className="text-[#787b86]">• Stop: Below low</div>
        </div>
      </div>
    </div>
  );
}

// ============ RBD PATTERN (Rally-Base-Drop) - Supply Zone ============
export function RBDPattern() {
  const baseY = 280;
  const scale = 2.2;
  const candleW = 11;
  const gap = 14;
  const svgWidth = 380;
  
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39] h-full flex flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#ef5350] text-white px-2 py-0.5 rounded text-[11px] font-bold">SUPPLY</span>
          <span className="text-[#d1d4dc] text-sm font-bold">Rally-Base-Drop (RBD)</span>
          <span className="text-[#787b86] text-[11px] ml-auto">Reversal</span>
        </div>
        <p className="text-[#787b86] text-[11px] leading-tight">Price rallies → consolidates (base) → drops sharply. Indicates distribution/reversal.</p>
      </div>
      
      <div className="flex-1 min-h-[260px] relative">
      <svg width="100%" height="100%" viewBox="0 0 380 260" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        <PriceLine y={60} x1={10} x2={370} />
        <PriceLine y={120} x1={10} x2={370} />
        <PriceLine y={180} x1={10} x2={370} />
        
        {/* RALLY phase - bullish candles going up */}
        <Candle x={20} o={50} h={60} l={48} c={58} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap} o={58} h={72} l={56} c={70} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*2} o={70} h={88} l={68} c={85} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*3} o={85} h={102} l={83} c={100} baseY={baseY} scale={scale} width={candleW} />
        
        {/* BASE phase - small body candles at top */}
        <Candle x={20+gap*4} o={100} h={108} l={95} c={98} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*5} o={98} h={110} l={94} c={105} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*6} o={105} h={112} l={98} c={100} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*7} o={100} h={107} l={95} c={97} baseY={baseY} scale={scale} width={candleW} />
        
        {/* ZONE BOX - Extended */}
        <ZoneBox x={20+gap*4-3} y={baseY - 112*scale} width={svgWidth - (20+gap*4-3)} height={18*scale} type="supply" stars={3} tags={['']} />
        
        {/* DROP phase - strong bearish leg out */}
        <Candle x={20+gap*8} o={97} h={100} l={78} c={80} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*9} o={80} h={82} l={62} c={65} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*10} o={65} h={68} l={48} c={50} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*11} o={50} h={55} l={38} c={40} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Retest candles */}
        <Candle x={20+gap*12} o={40} h={52} l={38} c={50} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*13} o={50} h={65} l={48} c={63} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*14} o={63} h={82} l={60} c={80} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*15} o={80} h={98} l={78} c={95} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Rejection from zone */}
        <Candle x={20+gap*16} o={95} h={105} l={75} c={78} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*17} o={78} h={80} l={58} c={60} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Annotations */}
        <text x={35} y={225} fill="#26a69a" fontSize="10" fontWeight="500">RALLY</text>
        <text x={92} y={25} fill="#787b86" fontSize="10" fontWeight="500">BASE</text>
        <text x={160} y={225} fill="#ef5350" fontSize="10" fontWeight="500">DROP</text>
        <text x={250} y={150} fill="#787b86" fontSize="9">Retest</text>
        <Arrow x1={270} y1={145} x2={250} y2={115} color="#787b86" />
        
        {/* Entry arrow */}
        <Arrow x1={256} y1={55} x2={256} y2={85} color="#ef5350" label="Entry" />
      </svg>
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#ef5350] font-bold mb-1">✓ Zone Criteria</div>
          <div className="text-[#787b86]">• Strong leg-out</div>
          <div className="text-[#787b86]">• Base: small candles</div>
        </div>
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#d1d4dc] font-bold mb-1">Trade Setup</div>
          <div className="text-[#787b86]">• Entry: Zone low</div>
          <div className="text-[#787b86]">• Stop: Above high</div>
        </div>
      </div>
    </div>
  );
}

// ============ RBR PATTERN (Rally-Base-Rally) - Continuation Demand ============
export function RBRPattern() {
  const baseY = 280;
  const scale = 2.2;
  const candleW = 11;
  const gap = 14;
  
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39] h-full flex flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#26a69a] text-[#131722] px-2 py-0.5 rounded text-[11px] font-bold">DEMAND</span>
          <span className="text-[#d1d4dc] text-sm font-bold">Rally-Base-Rally (RBR)</span>
          <span className="text-[#2962ff] text-[11px] ml-auto">Continuation</span>
        </div>
        <p className="text-[#787b86] text-[11px] leading-tight">Uptrend pauses briefly → continues higher. Zone forms at pause point for pullback entries.</p>
      </div>
      
      <div className="flex-1 min-h-[260px] relative">
      <svg width="100%" height="100%" viewBox="0 0 380 260" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        <PriceLine y={60} x1={10} x2={370} />
        <PriceLine y={120} x1={10} x2={370} />
        <PriceLine y={180} x1={10} x2={370} />
        
        {/* First RALLY phase */}
        <Candle x={20} o={40} h={52} l={38} c={50} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap} o={50} h={65} l={48} c={62} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*2} o={62} h={78} l={60} c={75} baseY={baseY} scale={scale} width={candleW} />
        
        {/* BASE phase - brief pause */}
        <Candle x={20+gap*3} o={75} h={82} l={70} c={72} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*4} o={72} h={80} l={68} c={77} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*5} o={77} h={82} l={72} c={74} baseY={baseY} scale={scale} width={candleW} />
        
        {/* ZONE BOX */}
        <ZoneBox x={20+gap*3-3} y={baseY - 82*scale} width={gap*3+candleW+6} height={14*scale} type="demand" stars={2} tags={['HTF']} />
        
        {/* Second RALLY phase - continuation */}
        <Candle x={20+gap*6} o={74} h={90} l={72} c={88} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*7} o={88} h={102} l={86} c={100} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*8} o={100} h={115} l={98} c={112} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*9} o={112} h={125} l={110} c={122} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Pullback to zone */}
        <Candle x={20+gap*10} o={122} h={125} l={115} c={118} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*11} o={118} h={120} l={105} c={108} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*12} o={108} h={110} l={92} c={95} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*13} o={95} h={98} l={78} c={80} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Bounce */}
        <Candle x={20+gap*14} o={80} h={95} l={75} c={92} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*15} o={92} h={108} l={90} c={105} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Trend line */}
        <line x1={25} y1={baseY-35*scale} x2={250} y2={baseY-120*scale} stroke="#2962ff" strokeWidth="1" strokeDasharray="4,2" opacity="0.5" />
        
        {/* Annotations */}
        <text x={30} y={205} fill="#26a69a" fontSize="10" fontWeight="500">RALLY</text>
        <text x={72} y={145} fill="#787b86" fontSize="10" fontWeight="500">BASE</text>
        <text x={120} y={25} fill="#26a69a" fontSize="10" fontWeight="500">RALLY</text>
        
        <text x={195} y={90} fill="#787b86" fontSize="9">Pullback</text>
        <Arrow x1={223} y1={140} x2={210} y2={115} color="#26a69a" label="Entry" />
      </svg>
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#2962ff] font-bold mb-1">⚡ Continuation</div>
          <div className="text-[#787b86]">• Forms IN uptrend</div>
          <div className="text-[#787b86]">• Weaker than DBR</div>
        </div>
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#d1d4dc] font-bold mb-1">Trade Setup</div>
          <div className="text-[#787b86]">• Entry: On pullback</div>
          <div className="text-[#787b86]">• Stop: Below zone</div>
        </div>
      </div>
    </div>
  );
}

// ============ DBD PATTERN (Drop-Base-Drop) - Continuation Supply ============
export function DBDPattern() {
  const baseY = 280;
  const scale = 2.2;
  const candleW = 11;
  const gap = 14;
  
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39] h-full flex flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#ef5350] text-white px-2 py-0.5 rounded text-[11px] font-bold">SUPPLY</span>
          <span className="text-[#d1d4dc] text-sm font-bold">Drop-Base-Drop (DBD)</span>
          <span className="text-[#2962ff] text-[11px] ml-auto">Continuation</span>
        </div>
        <p className="text-[#787b86] text-[11px] leading-tight">Downtrend pauses briefly → continues lower. Zone marks resistance for shorting rallies.</p>
      </div>
      
      <div className="flex-1 min-h-[260px] relative">
      <svg width="100%" height="100%" viewBox="0 0 380 260" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        <PriceLine y={60} x1={10} x2={370} />
        <PriceLine y={120} x1={10} x2={370} />
        <PriceLine y={180} x1={10} x2={370} />
        
        {/* First DROP phase */}
        <Candle x={20} o={115} h={120} l={105} c={108} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap} o={108} h={110} l={92} c={95} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*2} o={95} h={98} l={78} c={80} baseY={baseY} scale={scale} width={candleW} />
        
        {/* BASE phase */}
        <Candle x={20+gap*3} o={80} h={88} l={75} c={85} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*4} o={85} h={90} l={78} c={80} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*5} o={80} h={87} l={76} c={82} baseY={baseY} scale={scale} width={candleW} />
        
        {/* ZONE BOX */}
        <ZoneBox x={20+gap*3-3} y={baseY - 90*scale} width={gap*3+candleW+6} height={15*scale} type="supply" stars={2} tags={['HTF']} />
        
        {/* Second DROP phase */}
        <Candle x={20+gap*6} o={82} h={85} l={70} c={72} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*7} o={72} h={75} l={60} c={65} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*8} o={65} h={68} l={45} c={48} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*9} o={48} h={52} l={30} c={35} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Rally to zone */}
        <Candle x={20+gap*10} o={35} h={45} l={32} c={42} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*11} o={42} h={55} l={40} c={52} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*12} o={52} h={68} l={50} c={65} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*13} o={65} h={82} l={62} c={80} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Rejection */}
        <Candle x={20+gap*14} o={80} h={85} l={65} c={68} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*15} o={68} h={72} l={50} c={55} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Trend line */}
        <line x1={25} y1={baseY-110*scale} x2={250} y2={baseY-20*scale} stroke="#2962ff" strokeWidth="1" strokeDasharray="4,2" opacity="0.5" />

        {/* Annotations */}
        <text x={35} y={85} fill="#ef5350" fontSize="10" fontWeight="500">DROP</text>
        <text x={88} y={125} fill="#787b86" fontSize="10" fontWeight="500">BASE</text>
        <text x={160} y={200} fill="#ef5350" fontSize="10" fontWeight="500">DROP</text>
        
        <text x={195} y={115} fill="#787b86" fontSize="9">Pullback</text>
        <Arrow x1={223} y1={60} x2={210} y2={95} color="#ef5350" label="Entry" />
      </svg>
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#2962ff] font-bold mb-1">⚡ Continuation</div>
          <div className="text-[#787b86]">• Forms IN downtrend</div>
          <div className="text-[#787b86]">• Weaker than RBD</div>
        </div>
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#d1d4dc] font-bold mb-1">Trade Setup</div>
          <div className="text-[#787b86]">• Entry: On pullback</div>
          <div className="text-[#787b86]">• Stop: Above zone</div>
        </div>
      </div>
    </div>
  );
}

// ============ SWEEP SETUP - Liquidity Grab ============
export function SweepPattern() {
  const baseY = 290;
  const scale = 2.0;
  const candleW = 11;
  const gap = 14;
  
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#f7931a40] h-full flex flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#f7931a] text-[#131722] px-2 py-0.5 rounded text-[11px] font-bold">SWEEP</span>
          <span className="text-[#d1d4dc] text-sm font-bold">Liquidity Sweep + Zone</span>
          <span className="text-[#f7931a] text-[11px] ml-auto">★★★ Highest Probability</span>
        </div>
        <p className="text-[#787b86] text-[11px] leading-tight">Price sweeps below prior lows (taking stops) → creates demand zone → sharp reversal. Gets (Sweep) tag.</p>
      </div>
      
      <div className="flex-1 min-h-[280px] relative">
      <svg width="100%" height="100%" viewBox="0 0 420 280" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        <PriceLine y={70} x1={10} x2={410} />
        <PriceLine y={140} x1={10} x2={410} />
        <PriceLine y={210} x1={10} x2={410} />
        
        {/* Prior swing lows level */}
        <line x1={20} y1={185} x2={220} y2={185} stroke="#ef5350" strokeWidth="1.5" strokeDasharray="6,3" />
        <text x={225} y={188} fill="#ef5350" fontSize="9">Prior Lows (Liquidity)</text>
        
        {/* Stop loss cluster visualization */}
        <LiquidityDots x={60} y={195} count={8} color="#ef5350" />
        
        {/* Building up to sweep */}
        <Candle x={20} o={80} h={88} l={70} c={72} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap} o={72} h={78} l={62} c={65} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*2} o={65} h={72} l={55} c={58} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*3} o={58} h={65} l={48} c={52} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*4} o={52} h={60} l={45} c={55} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*5} o={55} h={62} l={48} c={50} baseY={baseY} scale={scale} width={candleW} />
        
        {/* THE SWEEP CANDLE - goes below prior lows with long wick */}
        <Candle x={20+gap*6} o={50} h={55} l={30} c={48} baseY={baseY} scale={scale} width={candleW} />
        
        {/* ZONE at sweep low */}
        <ZoneBox x={20+gap*6-3} y={baseY - 55*scale} width={candleW+6} height={25*scale} type="demand" label="D★★★ (Sweep)" mitigated={false} />
        
        {/* Reversal candles */}
        <Candle x={20+gap*7} o={48} h={75} l={45} c={72} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*8} o={72} h={92} l={70} c={90} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*9} o={90} h={105} l={88} c={102} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*10} o={102} h={118} l={100} c={115} baseY={baseY} scale={scale} width={candleW} />
        <Candle x={20+gap*11} o={115} h={128} l={112} c={125} baseY={baseY} scale={scale} width={candleW} />
        
        {/* Annotations */}
        <text x={115} y={265} fill="#ef5350" fontSize="10" fontWeight="600">SWEEP</text>
        <Arrow x1={115} y1={255} x2={115} y2={235} color="#ef5350" />
        
        <text x={145} y={45} fill="#26a69a" fontSize="10" fontWeight="600">REVERSAL</text>
        <Arrow x1={165} y1={55} x2={165} y2={75} color="#26a69a" />
        
        {/* Trapped traders annotation */}
        <rect x={25} y={200} width={95} height={22} fill="rgba(239,83,80,0.1)" stroke="#ef5350" strokeWidth="1" rx="3" strokeDasharray="3,2" />
        <text x={32} y={214} fill="#ef5350" fontSize="9">Stop losses triggered</text>
      </svg>
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[#262931] p-2 rounded border border-[#f7931a30]">
          <div className="text-[#f7931a] font-bold mb-1">✓ Sweep Confirmation</div>
          <div className="text-[#787b86]">• Breaks clear support</div>
          <div className="text-[#787b86]">• Long lower wick</div>
          <div className="text-[#787b86]">• Zone gets <span className="text-[#26a69a]">(Sweep)</span> tag</div>
        </div>
        <div className="bg-[#262931] p-2 rounded">
          <div className="text-[#d1d4dc] font-bold mb-1">Why It Works</div>
          <div className="text-[#787b86]">• Institutions take liquidity</div>
          <div className="text-[#787b86]">• Weak hands flushed out</div>
          <div className="text-[#787b86]">• <span className="text-[#f7931a]">+2 points</span> to score</div>
        </div>
      </div>
    </div>
  );
}

// ============ SUPPLY SIDE SWEEP ============
export function SupplySweepPattern() {
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#ef535040] h-full flex flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#ef5350] text-white px-2 py-0.5 rounded text-[11px] font-bold">SWEEP</span>
          <span className="text-[#d1d4dc] text-sm font-bold">Supply Sweep (Mirror)</span>
        </div>
        <p className="text-[#787b86] text-[11px] leading-tight">Same concept inverted: price sweeps above prior highs → creates supply zone → reversal down.</p>
      </div>
      
      <div className="flex-1 min-h-[200px] relative">
      <svg width="100%" height="100%" viewBox="0 0 420 200" preserveAspectRatio="xMidYMid meet">
        <PriceLine y={70} x1={10} x2={410} />
        <PriceLine y={120} x1={10} x2={410} />
        
        {/* Prior highs line */}
        <line x1={20} y1={85} x2={220} y2={85} stroke="#26a69a" strokeWidth="1.5" strokeDasharray="6,3" />
        <text x={225} y={88} fill="#26a69a" fontSize="9">Prior Highs (Liquidity)</text>
        
        {/* Stop loss cluster */}
        <LiquidityDots x={60} y={75} count={8} color="#26a69a" />
        
        {/* Candles building up */}
        <Candle x={20} o={60} h={72} l={58} c={70} baseY={200} scale={1.5} width={10} />
        <Candle x={33} o={70} h={82} l={68} c={80} baseY={200} scale={1.5} width={10} />
        <Candle x={46} o={80} h={95} l={78} c={92} baseY={200} scale={1.5} width={10} />
        <Candle x={59} o={92} h={100} l={88} c={95} baseY={200} scale={1.5} width={10} />
        
        {/* Sweep candle */}
        <Candle x={72} o={95} h={120} l={92} c={98} baseY={200} scale={1.5} width={10} />
        
        {/* Zone */}
        <ZoneBox x={69} y={15} width={16} height={32} type="supply" label="S★★★ (Sweep)" />
        
        {/* Reversal */}
        <Candle x={85} o={98} h={100} l={70} c={72} baseY={200} scale={1.5} width={10} />
        <Candle x={98} o={72} h={75} l={55} c={58} baseY={200} scale={1.5} width={10} />
        <Candle x={111} o={58} h={62} l={42} c={45} baseY={200} scale={1.5} width={10} />
        <Candle x={124} o={45} h={50} l={32} c={35} baseY={200} scale={1.5} width={10} />
        
        <text x={78} y={185} fill="#26a69a" fontSize="9" fontWeight="600">SWEEP</text>
        <text x={100} y={165} fill="#ef5350" fontSize="9" fontWeight="600">REVERSAL</text>
      </svg>
      </div>
    </div>
  );
}

// ============ ZONE LIFECYCLE ============
export function ZoneLifecycle() {
  const baseY = 200;
  const scale = 1.8;
  const candleW = 8;
  const gap = 11;
  
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39]">
      <div className="mb-3">
        <span className="text-[#d1d4dc] text-sm font-bold">Zone Lifecycle & Visual Indicators</span>
        <p className="text-[#787b86] text-[11px] mt-1">Fresh zones have higher probability. Zones weaken after touches and eventually break.</p>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {/* FRESH */}
        <div className="bg-[#262931] rounded-md p-2">
          <div className="text-[#26a69a] text-[11px] font-bold mb-2 text-center">FRESH</div>
          <div className="h-[120px] w-full relative">
            <svg width="100%" height="100%" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
              <ZoneBox x={10} y={50} width={100} height={30} type="demand" stars={3} tags={[]} />
              <Candle x={25} o={65} h={75} l={60} c={72} baseY={110} scale={scale} width={candleW} />
              <Candle x={25+gap} o={72} h={82} l={68} c={80} baseY={110} scale={scale} width={candleW} />
              <Candle x={25+gap*2} o={80} h={92} l={78} c={90} baseY={110} scale={scale} width={candleW} />
              <Candle x={25+gap*3} o={90} h={100} l={88} c={98} baseY={110} scale={scale} width={candleW} />
              <Candle x={25+gap*4} o={98} h={110} l={96} c={108} baseY={110} scale={scale} width={candleW} />
            </svg>
          </div>
          <div className="text-center text-[9px] text-[#787b86]">Solid border, full opacity</div>
          <div className="text-center text-[10px] text-[#26a69a] font-bold mt-1">FULL SIZE ✓</div>
        </div>
        
        {/* MITIGATED */}
        <div className="bg-[#262931] rounded-md p-2">
          <div className="text-[#f7931a] text-[11px] font-bold mb-2 text-center">MITIGATED</div>
          <div className="h-[120px] w-full relative">
            <svg width="100%" height="100%" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
              <ZoneBox x={10} y={50} width={100} height={30} type="demand" stars={1} mitigated={true} />
              <Candle x={15} o={65} h={75} l={60} c={72} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap} o={72} h={82} l={55} c={58} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap*2} o={58} h={70} l={52} c={68} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap*3} o={68} h={80} l={65} c={78} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap*4} o={78} h={88} l={75} c={85} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap*5} o={85} h={95} l={82} c={92} baseY={110} scale={scale} width={candleW} />
            </svg>
          </div>
          <div className="text-center text-[9px] text-[#787b86]">Dashed border, faded</div>
          <div className="text-center text-[10px] text-[#f7931a] font-bold mt-1">CAUTION ⚠</div>
        </div>

        {/* BROKEN */}
        <div className="bg-[#262931] rounded-md p-2">
          <div className="text-[#ef5350] text-[11px] font-bold mb-2 text-center">BROKEN</div>
          <div className="h-[120px] w-full relative">
            <svg width="100%" height="100%" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
              <ZoneBox x={10} y={50} width={100} height={30} type="demand" stars={0} mitigated={true} />
              <line x1={10} y1={50} x2={110} y2={80} stroke="#ef5350" strokeWidth="2" />
              <line x1={10} y1={80} x2={110} y2={50} stroke="#ef5350" strokeWidth="2" />
              <Candle x={15} o={65} h={75} l={60} c={72} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap} o={72} h={75} l={50} c={52} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap*2} o={52} h={55} l={35} c={38} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap*3} o={38} h={42} l={25} c={28} baseY={110} scale={scale} width={candleW} />
              <Candle x={15+gap*4} o={28} h={32} l={18} c={20} baseY={110} scale={scale} width={candleW} />
            </svg>
          </div>
          <div className="text-center text-[9px] text-[#787b86]">Candle closes through</div>
          <div className="text-center text-[10px] text-[#ef5350] font-bold mt-1">INVALIDATED</div>
        </div>
      </div>
    </div>
  );
}

// ============ ZONE TAGS REFERENCE ============
export function ZoneTagsReference() {
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39]">
      <div className="mb-3">
        <span className="text-[#d1d4dc] text-sm font-bold">Zone Quality Tags & Scoring</span>
        <p className="text-[#787b86] text-[11px] mt-1">Tags added by the indicator reflect zone quality factors. Higher score = higher probability.</p>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-[#262931] p-2 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#26a69a] text-[#131722] px-1.5 py-0.5 rounded text-[10px] font-mono">HTF</span>
            <span className="text-[#26a69a] font-bold">+1.0 pts</span>
          </div>
          <div className="text-[#787b86]">Higher timeframe trend alignment. Zone direction matches 4H+ trend.</div>
        </div>
        
        <div className="bg-[#262931] p-2 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#f7931a] text-[#131722] px-1.5 py-0.5 rounded text-[10px] font-mono">(Sweep)</span>
            <span className="text-[#f7931a] font-bold">+2.0 pts</span>
          </div>
          <div className="text-[#787b86]">Liquidity taken before zone formed. Prior highs/lows were swept.</div>
        </div>
        
        <div className="bg-[#262931] p-2 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#9c27b0] text-white px-1.5 py-0.5 rounded text-[10px] font-mono">(POC)</span>
            <span className="text-[#9c27b0] font-bold">+2.0 pts</span>
          </div>
          <div className="text-[#787b86]">Point of Control nearby. High volume node within zone area.</div>
        </div>
        
        <div className="bg-[#262931] p-2 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#2962ff] text-white px-1.5 py-0.5 rounded text-[10px] font-mono">(Vol+)</span>
            <span className="text-[#2962ff] font-bold">+1.0 pts</span>
          </div>
          <div className="text-[#787b86]">Above-average volume concentration in zone price range.</div>
        </div>
        
        <div className="bg-[#262931] p-2 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#455a64] text-white px-1.5 py-0.5 rounded text-[10px] font-mono">(Vol-)</span>
            <span className="text-[#ef5350] font-bold">-0.5 pts</span>
          </div>
          <div className="text-[#787b86]">Below-average volume. Zone formed with weak institutional participation.</div>
        </div>
        
        <div className="bg-[#262931] p-2 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#00bcd4] text-[#131722] px-1.5 py-0.5 rounded text-[10px] font-mono">(N)</span>
            <span className="text-[#00bcd4] font-bold">+0.1 per merge</span>
          </div>
          <div className="text-[#787b86]">Cluster count. Shows how many zones merged at this level (N = count).</div>
        </div>
      </div>
      
      {/* Star ratings */}
      <div className="mt-3 p-2 bg-[#262931] rounded-md">
        <div className="text-[#d1d4dc] font-bold mb-2 text-xs">Star Rating Thresholds</div>
        <div className="flex gap-4 text-[11px]">
          <div>
            <span className="text-[#ffd700]">★★★</span>
            <span className="text-[#787b86]"> ≥ 8.0 pts</span>
          </div>
          <div>
            <span className="text-[#ffd700]">★★☆</span>
            <span className="text-[#787b86]"> ≥ 6.0 pts</span>
          </div>
          <div>
            <span className="text-[#ffd700]">★☆☆</span>
            <span className="text-[#787b86]"> ≥ 4.0 pts</span>
          </div>
          <div>
            <span className="text-[#787b86]">Min score: 2.0 pts</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PATTERN HIERARCHY ============
export function PatternHierarchy() {
  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39]">
      <div className="mb-3">
        <span className="text-[#d1d4dc] text-sm font-bold">Pattern Hierarchy (Probability Ranking)</span>
      </div>
      
      <div className="flex flex-col gap-2">
        {[
          { name: 'Sweep + Fresh DBR/RBD', type: 'reversal', rating: '★★★', prob: '85%+', color: '#26a69a', desc: 'Liquidity taken + reversal pattern' },
          { name: 'Fresh DBR/RBD', type: 'reversal', rating: '★★★', prob: '75-85%', color: '#26a69a', desc: 'Reversal at extreme, untouched' },
          { name: 'Fresh RBR/DBD with HTF', type: 'continuation', rating: '★★☆', prob: '65-75%', color: '#2962ff', desc: 'Trend continuation, aligned' },
          { name: 'First retest of any zone', type: 'retest', rating: '★★☆', prob: '60-70%', color: '#f7931a', desc: 'Zone tested once before' },
          { name: 'Fresh RBR/DBD alone', type: 'continuation', rating: '★☆☆', prob: '55-65%', color: '#787b86', desc: 'Continuation without HTF' },
          { name: 'Second+ retest', type: 'weak', rating: '☆☆☆', prob: '<50%', color: '#ef5350', desc: 'Zone weakening, skip or reduce' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-2 bg-[#262931] rounded-md border-l-[3px]" style={{ borderLeftColor: item.color }}>
            <span className="text-[#ffd700] text-xs w-12">{item.rating}</span>
            <span className="text-[#d1d4dc] text-xs font-medium w-44">{item.name}</span>
            <span 
              className="text-[9px] px-1.5 py-0.5 rounded w-20 text-center font-bold uppercase"
              style={{ 
                background: item.type === 'reversal' ? '#26a69a20' : item.type === 'continuation' ? '#2962ff20' : item.type === 'retest' ? '#f7931a20' : '#ef535020',
                color: item.type === 'reversal' ? '#26a69a' : item.type === 'continuation' ? '#2962ff' : item.type === 'retest' ? '#f7931a' : '#ef5350',
              }}
            >
              {item.type}
            </span>
            <span className="text-[11px] font-bold w-12" style={{ color: item.color }}>{item.prob}</span>
            <span className="text-[#787b86] text-[10px]">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
