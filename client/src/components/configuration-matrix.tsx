import { Terminal, ShieldCheck } from "lucide-react";

export function ConfigurationMatrix() {

  return (
    <section className="py-24 bg-black border-t border-white/10 font-mono text-xs">
      <div className="container px-4 md:px-6">

        <div className="flex items-end justify-between mb-8 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/20">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold uppercase text-white tracking-wider group cursor-default">
                <span className="glitch-subtle" data-text="System_Manifest.json">System_Manifest.json</span>
              </h2>
              <p className="text-muted-foreground mt-1">Range Engine · Production Configuration Map (Pre-Loaded)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 text-primary font-mono text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>FACTORY_DEFAULTS_ACTIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* COLUMN 1 */}
          <div className="space-y-8">
            {/* DOMAIN WEIGHTS */}
            <div className="group">
              <div className="text-primary/50 mb-3 border-b border-primary/20 pb-1 inline-block">01_DOMAIN_WEIGHTS</div>
              <div className="space-y-2">
                <ConfigRow label="Location" value="30" />
                <ConfigRow label="Momentum" value="25" />
                <ConfigRow label="Regime" value="25" />
                <ConfigRow label="Macro" value="20" />
              </div>
            </div>

            {/* POSITION ENGINE */}
            <div className="group">
              <div className="text-primary/50 mb-3 border-b border-primary/20 pb-1 inline-block">02_POSITION_ENGINE</div>
              <div className="space-y-2">
                <ConfigRow label="Buy Thresh (TCS)" value="12" color="text-primary" />
                <ConfigRow label="Trim Thresh" value="-10" color="text-accent" />
                <ConfigRow label="Max Tranches" value="4" />
                <ConfigRow label="Max Equity" value="100%" />
                <ConfigRow label="Tranche Spacing" value="0.75 xATR" />
                <div className="h-px bg-white/5 my-2" />
                <ConfigRow label="Add Cooldown" value="2 bars" />
                <ConfigRow label="Trim Cooldown" value="3 bars" />
                <ConfigRow label="Re-entry Cooldown" value="10 bars" />
                <ConfigRow label="Shed / Trim" value="1" />
                <div className="h-px bg-white/5 my-2" />
                <ConfigRow label="Never Sell at Loss" value="true" type="boolean" />
                <ConfigRow label="Min Gain to Sell" value="1.7%" />
                <ConfigRow label="Protective Exit" value="100%" />
                <ConfigRow label="Regime Floor" value="-70" />
                <ConfigRow label="Capitulation Ovr" value="true" type="boolean" />
                <ConfigRow label="ATR Hard Stop" value="false" type="boolean" />
                <ConfigRow label="Hard Stop Dist" value="4.0 xATR" />
              </div>
            </div>
          </div>

          {/* COLUMN 2 */}
          <div className="space-y-8">
            {/* REGIME DOMAIN */}
            <div className="group">
              <div className="text-primary/50 mb-3 border-b border-primary/20 pb-1 inline-block">03_REGIME_DOMAIN</div>
              <div className="space-y-2">
                <ConfigRow label="Supertrend ATR" value="14" />
                <ConfigRow label="Multiplier" value="3.0" />
                <ConfigRow label="Fakeout Bars" value="5" />
                <ConfigRow label="Fakeout Depth" value="1.5 xATR" />
                <ConfigRow label="ZigZag Length" value="9" />
              </div>
            </div>

            {/* LOCATION DOMAIN */}
            <div className="group">
              <div className="text-primary/50 mb-3 border-b border-primary/20 pb-1 inline-block">04_LOCATION_DOMAIN</div>
              <div className="space-y-2">
                <ConfigRow label="Order Blocks / Side" value="5" />
                <ConfigRow label="OB Full Candle" value="false" type="boolean" />
                <ConfigRow label="NW Bandwidth" value="8.0" />
                <ConfigRow label="NW Envelope Mult" value="3.0" />
                <ConfigRow label="NW Source" value="close" />
                <ConfigRow label="Min Gap Size" value="0.2%" />
                <ConfigRow label="Gap Zones Kept" value="10" />
                <ConfigRow label="Quarterly Fib" value="true" type="boolean" />
                <ConfigRow label="Loc Freshness" value="8 bars" />
              </div>
            </div>
          </div>

          {/* COLUMN 3 */}
          <div className="space-y-8">
            {/* MOMENTUM DOMAIN */}
            <div className="group">
              <div className="text-primary/50 mb-3 border-b border-primary/20 pb-1 inline-block">05_MOMENTUM_DOMAIN</div>
              <div className="space-y-2">
                <ConfigRow label="Div Pivot Period" value="5" />
                <ConfigRow label="Max Pivots" value="10" />
                <ConfigRow label="Max Bars" value="100" />
                <ConfigRow label="Trigger Freshness" value="8 bars" />
                <div className="h-px bg-white/5 my-2" />
                <ConfigRow label="RSI Divergence" value="true" type="boolean" />
                <ConfigRow label="MACD-hist Div" value="true" type="boolean" />
                <ConfigRow label="MFI Divergence" value="true" type="boolean" />
                <ConfigRow label="OBV Divergence" value="true" type="boolean" />
                <ConfigRow label="PPO Divergence" value="true" type="boolean" />
              </div>
            </div>

            {/* MACRO DOMAIN */}
            <div className="group">
              <div className="text-primary/50 mb-3 border-b border-primary/20 pb-1 inline-block">06_MACRO_DOMAIN</div>
              <div className="space-y-2">
                <ConfigRow label="Enable Macro" value="true" type="boolean" />
                <ConfigRow label="VIX ROC Length" value="5" />
                <ConfigRow label="VIX ROC Limit" value="10%" />
                <ConfigRow label="New Highs Sym" value="HIGN" />
                <ConfigRow label="New Lows Sym" value="LOWN" />
              </div>
            </div>
          </div>

          {/* COLUMN 4 */}
          <div className="space-y-8">
            {/* DISPLAY */}
            <div className="group">
              <div className="text-primary/50 mb-3 border-b border-primary/20 pb-1 inline-block">07_DISPLAY</div>
              <div className="space-y-2">
                <ConfigRow label="Dashboard" value="true" type="boolean" />
                <ConfigRow label="Order Block Boxes" value="true" type="boolean" />
                <ConfigRow label="NW Bands" value="true" type="boolean" />
                <ConfigRow label="Gap Zones" value="true" type="boolean" />
                <ConfigRow label="Signal Markers" value="true" type="boolean" />
              </div>
            </div>
          </div>

        </div>

        <div className="mt-12 border-t border-white/10 pt-6 flex justify-between items-center text-muted-foreground">
           <div>STATUS: LOCKED</div>
           <div>ENGINE: Range Engine [Stack of Probability]</div>
           <div>SRC: strategy/range-engine.pine</div>
        </div>

      </div>
    </section>
  );
}

function ConfigRow({ label, value, type = "string", color }: { label: string, value: string, type?: "string" | "boolean", color?: string }) {
  const isTrue = value === "true";

  let valueDisplay = <span className={color || "text-white"}>{value}</span>;

  if (type === "boolean") {
    valueDisplay = (
      <span className={isTrue ? "text-primary" : "text-destructive"}>
        {isTrue ? "ENABLED" : "DISABLED"}
      </span>
    );
  }

  return (
    <div className="flex justify-between items-center hover:bg-white/5 px-2 py-1 -mx-2 transition-colors rounded">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{valueDisplay}</span>
    </div>
  );
}
