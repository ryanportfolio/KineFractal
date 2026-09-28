import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Layers, 
  Activity, 
  Info,
  Box,
  Zap,
  Play,
  Pause,
  RefreshCw,
  ShieldCheck,
  Target,
  Eye,
  CheckSquare,
  Check
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";
import { Link } from "wouter";
import { PlaybookCTA } from "@/components/playbook-cta";
import { ResponsiveContainer } from "recharts";

// --- TYPES ---

interface Zone {
  id: string;
  type: "SUPPLY" | "DEMAND";
  priceHigh: number;
  priceLow: number;
  startIdx: number;
  endIdx: number;
  score: number;
  clusterCount: number;
  isSweep: boolean;
  isHTF: boolean;
  isMitigated: boolean;
  age: number; // 0 to 1, 1 is oldest
  volumeTag: "POC" | "Vol+" | "Vol-" | "";
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isR_Div?: boolean; // RSI Divergence (Red R)
  isP_Div?: boolean; // PPO Divergence (Red P)
}

interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  zones: Zone[];
  chartPattern: "TREND" | "RANGE" | "SWEEP";
  metrics: {
    vix: number;
    structure: "NORMAL" | "INVERTED";
    regime: "LOW" | "NORMAL" | "HIGH";
  }
}

// --- SCENARIOS ---

// --- SCENARIOS REMOVED ---

import { DBRPattern, RBDPattern, RBRPattern, DBDPattern, SweepPattern, SupplySweepPattern, ZoneLifecycle, ZoneTagsReference, PatternHierarchy } from "@/components/StructurePatterns";

// --- COMPONENT ---

export default function IndicatorStructure() {
  const [activeTab, setActiveTab] = useState<"PATTERNS" | "SWEEP" | "REFERENCE" | "PLAYBOOK">("PATTERNS");

  // Mock scenarios for Playbook
  const scenarios: SimulationScenario[] = [
    {
      id: "1",
      title: "Liquidity Sweep & Reversal",
      description: "Classic stop hunt below equal lows followed by displacement. High probability setup when aligned with HTF demand.",
      zones: [],
      chartPattern: "SWEEP",
      metrics: { vix: 15.2, structure: "NORMAL", regime: "NORMAL" }
    },
    {
      id: "2",
      title: "Trend Continuation (RBR)",
      description: "Strong uptrend with clear re-accumulation ranges. Look for RBR patterns holding the 50% equilibrium of the impulse leg.",
      zones: [],
      chartPattern: "TREND",
      metrics: { vix: 18.5, structure: "NORMAL", regime: "HIGH" }
    },
    {
      id: "3",
      title: "Range Bound Rotation",
      description: "Premium/Discount equilibrium plays in low volatility. Fade the extremes of the range until displacement occurs.",
      zones: [],
      chartPattern: "RANGE",
      metrics: { vix: 12.1, structure: "INVERTED", regime: "LOW" }
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Navbar />
      
      <div className="container px-4 md:px-6 mx-auto space-y-6 pt-20 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-4">
              <Link href="/indicator-library">
                <span className="text-primary hover:underline cursor-pointer">INDICATOR_LIBRARY</span>
              </Link>
              <span>/</span>
              <span>STRUCTURE_ANALYSIS</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/50 rounded-none font-mono">
                v5.5
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">INSTITUTIONAL_S/D</span>
            </div>
            <pre className="text-primary font-mono text-xs md:text-sm leading-tight mb-2 overflow-x-auto">
{`█████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░█▀▀░▀█▀░█▀▄░█░█░█▀▀░▀█▀░█░█░█▀▄░█▀▀░░░░░░░░█
█░░░░░░░░▀▀█░░█░░█▀▄░█░█░█░░░░█░░█░█░█▀▄░█▀▀░░░░░░░░█
█░░░░░░░░▀▀▀░░▀░░▀░▀░▀▀▀░▀▀▀░░▀░░▀▀▀░▀░▀░▀▀▀░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████████`}
            </pre>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Automated detection of Supply/Demand zones with institutional filters.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
             <Button 
               variant={activeTab === "PATTERNS" ? "default" : "outline"}
               onClick={() => setActiveTab("PATTERNS")}
               className="font-mono text-xs whitespace-nowrap"
             >
               <Activity className="w-4 h-4 mr-2" />
               CORE PATTERNS
             </Button>
             <Button 
               variant={activeTab === "SWEEP" ? "default" : "outline"}
               onClick={() => setActiveTab("SWEEP")}
               className="font-mono text-xs whitespace-nowrap"
             >
               <Zap className="w-4 h-4 mr-2" />
               SWEEP SETUP
             </Button>
             <Button 
               variant={activeTab === "REFERENCE" ? "default" : "outline"}
               onClick={() => setActiveTab("REFERENCE")}
               className="font-mono text-xs whitespace-nowrap"
             >
               <Info className="w-4 h-4 mr-2" />
               TAGS & SCORING
             </Button>
             <Button 
               variant={activeTab === "PLAYBOOK" ? "default" : "outline"}
               onClick={() => setActiveTab("PLAYBOOK")}
               className="font-mono text-xs whitespace-nowrap"
             >
               <Layers className="w-4 h-4 mr-2" />
               PLAYBOOK
             </Button>
          </div>
        </div>

        {activeTab === "PATTERNS" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DBRPattern />
              <RBDPattern />
              <RBRPattern />
              <DBDPattern />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ZoneLifecycle />
              <PatternHierarchy />
            </div>
          </div>
        )}
        
        {activeTab === "SWEEP" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SweepPattern />
              <SupplySweepPattern />
            </div>
            <ZoneLifecycle />
          </div>
        )}
        
        {activeTab === "REFERENCE" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ZoneTagsReference />
              <PatternHierarchy />
            </div>
          </div>
        )}

        {activeTab === "PLAYBOOK" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-lg p-8">
              <h2 className="text-3xl font-bold text-white mb-3">The Complete Playbook</h2>
              <p className="text-muted-foreground max-w-3xl leading-relaxed">
                The Institutional Structure & S/D indicator identifies high-probability supply and demand zones by detecting where institutions likely accumulated (demand) or distributed (supply) positions. It doesn't draw zones at every swing: it filters for institutional footprints using volume, momentum imbalance, and multi-timeframe confluence, then scores each zone's quality.
              </p>
              <div className="mt-4 text-sm text-primary font-mono">
                Core premise: Institutions can't fill large orders instantly. They accumulate at lows, distribute at highs, and price often returns to these zones before continuing.
              </div>
            </div>

            {/* Zone Creation Flow */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">How Zones Are Created</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1e222d] border border-primary/30 p-6 rounded-lg">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">1</div>
                    <div>
                      <h4 className="font-bold text-white mb-1">DETECT BOS</h4>
                      <p className="text-xs text-muted-foreground">Price crosses last swing high (bullish) or low (bearish)</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono text-muted-foreground">
                    <div>• Swing detection: 3-bar lookback</div>
                    <div>• Triggers zone creation event</div>
                  </div>
                </div>

                <div className="bg-[#1e222d] border border-primary/30 p-6 rounded-lg">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">2</div>
                    <div>
                      <h4 className="font-bold text-white mb-1">SCAN ORIGIN</h4>
                      <p className="text-xs text-muted-foreground">Look back 50 bars for lowest low (demand) or highest high (supply)</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono text-muted-foreground">
                    <div>• Demand: locate min price</div>
                    <div>• Supply: locate max price</div>
                  </div>
                </div>

                <div className="bg-[#1e222d] border border-primary/30 p-6 rounded-lg">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">3</div>
                    <div>
                      <h4 className="font-bold text-white mb-1">FILTER CHECK</h4>
                      <p className="text-xs text-muted-foreground">Verify institutional participation via volume and imbalance</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono text-muted-foreground">
                    <div>• Volume ≥ 85th percentile</div>
                    <div>• Body ≥ ATR × multiplier</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Requirements */}
            <div className="bg-[#1e222d] border border-[#2a2e39] p-6 rounded-lg">
              <h3 className="text-lg font-bold text-white mb-4">Filter Requirements (Origin Candle)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-primary font-mono text-sm font-bold mb-3">VOLUME CHECK</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Default mode:</span>
                      <span className="text-white">Volume ≥ 85th %ile (100 bars)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Manual mode:</span>
                      <span className="text-white">Volume ≥ 2.0 × 20-bar avg</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-primary font-mono text-sm font-bold mb-3">IMBALANCE CHECK</h4>
                  <div className="space-y-2 text-sm text-muted-foreground font-mono">
                    <div><span className="text-white">Daily+:</span> 0.5 × ATR</div>
                    <div><span className="text-white">4H:</span> 0.6 × ATR</div>
                    <div><span className="text-white">1H:</span> 0.8 × ATR</div>
                    <div><span className="text-white">Below 1H:</span> 1.0 × ATR</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone Quality Scoring */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">Zone Quality Scoring</h3>
              <p className="text-muted-foreground">Every zone receives a quality score based on 7 components (Maximum: ~11.5 points)</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1e222d] border border-[#2a2e39] p-4 rounded">
                  <div className="text-sm font-bold text-white mb-2 flex justify-between">
                    <span>RSI</span>
                    <span className="text-primary">0-1.5 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">DEMAND: RSI &lt;30 → 1.5 | RSI &lt;40 → 1.0 | SUPPLY: RSI &gt;70 → 1.5 | RSI &gt;60 → 1.0</p>
                </div>

                <div className="bg-[#1e222d] border border-[#2a2e39] p-4 rounded">
                  <div className="text-sm font-bold text-white mb-2 flex justify-between">
                    <span>Relative Volume</span>
                    <span className="text-primary">0.5-2 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Vol/AvgVol &gt;2.5 → 2.0 | &gt;1.5 → 1.0 | Otherwise → 0.5</p>
                </div>

                <div className="bg-[#1e222d] border border-[#2a2e39] p-4 rounded">
                  <div className="text-sm font-bold text-white mb-2 flex justify-between">
                    <span>Imbalance (Displacement)</span>
                    <span className="text-primary">0.5-2 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Body/ATR &gt;2.0 → 2.0 | &gt;1.5 → 1.0 | Otherwise → 0.5</p>
                </div>

                <div className="bg-[#1e222d] border border-[#2a2e39] p-4 rounded">
                  <div className="text-sm font-bold text-white mb-2 flex justify-between">
                    <span>Trend Alignment</span>
                    <span className="text-primary">0-1 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">DEMAND + bullish trend → 1.0 | SUPPLY + bearish trend → 1.0</p>
                </div>

                <div className="bg-[#1e222d] border border-[#2a2e39] p-4 rounded">
                  <div className="text-sm font-bold text-white mb-2 flex justify-between">
                    <span>ADX (Trend Strength)</span>
                    <span className="text-primary">0-1 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">ADX &gt;25 → 1.0 (indicates strong trend direction)</p>
                </div>

                <div className="bg-[#1e222d] border border-[#2a2e39] p-4 rounded">
                  <div className="text-sm font-bold text-white mb-2 flex justify-between">
                    <span>Volume Profile</span>
                    <span className="text-primary">-0.5-2 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">POC → 2.0 | High volume node → 1.0 | Low volume → -0.5</p>
                </div>

                <div className="bg-[#1e222d] border border-[#2a2e39] p-4 rounded">
                  <div className="text-sm font-bold text-white mb-2 flex justify-between">
                    <span>Liquidity Sweep</span>
                    <span className="text-primary">0-2 pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Origin swept prior highs/lows → 2.0 (strong institutional signature)</p>
                </div>
              </div>
            </div>

            {/* Star Ratings */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Star Ratings</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <span className="text-2xl text-primary">★★★</span>
                  <div>
                    <p className="text-sm font-bold text-white">Score ≥ 8.0</p>
                    <p className="text-xs text-muted-foreground">Highest conviction · institutional footprint clear</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl text-primary">★★</span>
                  <div>
                    <p className="text-sm font-bold text-white">Score ≥ 6.0</p>
                    <p className="text-xs text-muted-foreground">Strong setup · multiple factors aligned</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl text-primary">★</span>
                  <div>
                    <p className="text-sm font-bold text-white">Score ≥ 4.0</p>
                    <p className="text-xs text-muted-foreground">Valid but moderate · trade with caution</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-2xl text-muted-foreground">○</span>
                  <div>
                    <p className="text-sm font-bold text-white">Score &lt; 4.0</p>
                    <p className="text-xs text-muted-foreground">Weak zone · consider skipping</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone Labels Anatomy */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">Reading Zone Labels</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#1e222d] border border-[#2a2e39] p-6 rounded-lg">
                  <h4 className="font-mono text-primary font-bold mb-4">Label Anatomy Example</h4>
                  <div className="bg-black/40 p-4 rounded font-mono text-sm text-white mb-4 border border-white/10">
                    <div>D★★(3)</div>
                    <div className="text-muted-foreground">HTF</div>
                    <div className="text-muted-foreground">(Sweep)</div>
                    <div className="text-muted-foreground">(POC)</div>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div><span className="text-primary font-bold">D★★(3)</span> = Demand, 2 stars, 3 zones merged</div>
                    <div><span className="text-primary font-bold">HTF</span> = Aligns with higher timeframe</div>
                    <div><span className="text-primary font-bold">(Sweep)</span> = Swept prior liquidity</div>
                    <div><span className="text-primary font-bold">(POC)</span> = Contains Point of Control</div>
                  </div>
                </div>

                <div className="bg-[#1e222d] border border-[#2a2e39] p-6 rounded-lg">
                  <h4 className="font-mono text-primary font-bold mb-4">Visual Indicators</h4>
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-8 border-4 border-primary rounded bg-primary/10"></div>
                      <div>
                        <div className="text-white font-bold text-sm">Thick border</div>
                        <span className="text-muted-foreground">High score (≥7.0) or sweep zone</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-8 border border-cyan-400 rounded bg-cyan-400/15"></div>
                      <div>
                        <div className="text-white font-bold text-sm">Solid border</div>
                        <span className="text-muted-foreground">Fresh/active zone (highest relevance)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-8 border border-dashed border-yellow-400 rounded bg-yellow-400/10"></div>
                      <div>
                        <div className="text-white font-bold text-sm">Dashed border</div>
                        <span className="text-muted-foreground">Mitigated zone (price touched)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-8 rounded bg-gradient-to-r from-primary/50 to-primary/30 border border-primary/40"></div>
                      <div>
                        <div className="text-white font-bold text-sm">High opacity</div>
                        <span className="text-muted-foreground">Fresh zone (~40% transparent)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-8 rounded bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20"></div>
                      <div>
                        <div className="text-white font-bold text-sm">Low opacity</div>
                        <span className="text-muted-foreground">Aged/faded zone (~90% transparent)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone Lifecycle */}
            <div className="bg-[#1e222d] border border-[#2a2e39] p-6 rounded-lg">
              <h3 className="text-lg font-bold text-white mb-4">Zone Lifecycle</h3>
              <p className="text-sm text-muted-foreground mb-4">Zones evolve through states based on price interaction and time.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="border border-green-500/30 bg-green-500/5 p-4 rounded">
                  <h4 className="font-bold text-green-400 text-sm mb-2">FRESH</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Just created</li>
                    <li>• Solid border</li>
                    <li>• ~40% transparent</li>
                    <li>• Highest relevance</li>
                  </ul>
                </div>

                <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 rounded">
                  <h4 className="font-bold text-yellow-400 text-sm mb-2">AGING</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• No interaction</li>
                    <li>• Solid border</li>
                    <li>• 40-90% transparent</li>
                    <li>• Lower priority</li>
                  </ul>
                </div>

                <div className="border border-orange-500/30 bg-orange-500/5 p-4 rounded">
                  <h4 className="font-bold text-orange-400 text-sm mb-2">MITIGATED</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Price touched</li>
                    <li>• Dashed border</li>
                    <li>• ~90% transparent</li>
                    <li>• May still hold</li>
                  </ul>
                </div>

                <div className="border border-red-500/30 bg-red-500/5 p-4 rounded">
                  <h4 className="font-bold text-red-400 text-sm mb-2">DELETED</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Price closed through</li>
                    <li>• Removed from chart</li>
                    <li>• Or too far away</li>
                    <li>• (&gt; 25% range)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Zone Clustering */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Zone Clustering</h3>
              <p className="text-sm text-muted-foreground mb-4">When multiple zones overlap, they merge into a single, stronger zone.</p>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Zones must overlap</span>
                  <span className="text-primary">Tops and bottoms intersect</span>
                </div>
                <div className="flex justify-between">
                  <span>Merged zone height limit</span>
                  <span className="text-primary">≤ 3.0 × ATR (default)</span>
                </div>
                <div className="flex justify-between">
                  <span>Zone centers within</span>
                  <span className="text-primary">± 1.0 × ATR (default)</span>
                </div>
                <div className="flex justify-between">
                  <span>Merged score</span>
                  <span className="text-primary">max(score_A, score_B) + 0.1</span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                💡 Why it matters: Clustered zones represent multiple accumulation/distribution events at similar prices: stronger institutional interest.
              </p>
            </div>
          </div>
        )}

        <PlaybookCTA />
      <LegalFooter />

      </div>
    </div>
  );
}
