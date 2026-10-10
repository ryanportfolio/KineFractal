// SectorToolsMenu — the three link boxes shared by the sector pages
// (/sector-rotation, /ratio-relevance): sector rotation, alerts, ratio relevance.
// The box for the page you are on reads [CURRENT] instead of [ENTER].
import { Link } from "wouter";

type SectorPage = "sector-rotation" | "ratio-relevance";

export function SectorToolsMenu({ current }: { current: SectorPage }) {
  const tag = (page: SectorPage) => (page === current ? "[CURRENT]" : "[ENTER]");
  return (
    <div className="space-y-4 mb-8">
      {/* MORE Indicator */}
      <div className="flex justify-center">
        <div className="font-mono text-xs text-muted-foreground/60 flex items-center gap-2 animate-pulse">
          <span>MORE</span>
          <span>↓</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {/* Sector Rotation Button */}
        <Link href="/sector-rotation">
          <div className="group cursor-pointer bg-black border-2 border-blue-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300 hover:border-blue-500 hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:scale-105 h-full">
            <div className="font-mono text-xs text-blue-500/90 leading-tight transition-colors duration-300 group-hover:text-blue-400 space-y-2">
              <div className="text-center font-bold">→ $ SECTOR_ROTATION</div>
              <div className="text-blue-400/70 text-center text-xs">Macro rotation analysis</div>
              <div className="text-blue-500/50 text-center">{tag("sector-rotation")}</div>
            </div>
          </div>
        </Link>

        {/* Alerts Button */}
        <Link href="/alerts">
          <div className="group cursor-pointer bg-black border-2 border-emerald-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all duration-300 hover:border-emerald-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-105 h-full">
            <div className="font-mono text-xs text-emerald-500/90 leading-tight transition-colors duration-300 group-hover:text-emerald-400 space-y-2">
              <div className="text-center font-bold">→ ◊ ALERT_TERMINAL</div>
              <div className="text-emerald-400/70 text-center text-xs">Free custom email alerts</div>
              <div className="text-emerald-500/50 text-center">[ENTER]</div>
            </div>
          </div>
        </Link>

        {/* Ratio Relevance Button */}
        <Link href="/ratio-relevance">
          <div className="group cursor-pointer bg-black border-2 border-cyan-500/50 p-4 overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all duration-300 hover:border-cyan-500 hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] hover:scale-105 h-full">
            <div className="font-mono text-xs text-cyan-500/90 leading-tight transition-colors duration-300 group-hover:text-cyan-400 space-y-2">
              <div className="text-center font-bold">→ ◊ RATIO_RELEVANCE</div>
              <div className="text-cyan-400/70 text-center text-xs">Capital flow analysis</div>
              <div className="text-cyan-500/50 text-center">{tag("ratio-relevance")}</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
