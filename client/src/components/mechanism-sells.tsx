// How it sells: the TRIM_INFO rules in three groups (trim, exit, watch
// markets), each with a schematic sketch of its trigger shape. Sketches carry
// no numbers and no data; they show the shape a trigger looks for.
import type { ReactNode } from "react";
import { TRIM_INFO } from "@/data/fearlab-board";

const GROUPS: { title: string; sub: string; rules: string[] }[] = [
  { title: "trim", sub: "sell slices into strength", rules: ["Extension ladder", "Profit ladder", "Trailing harvest"] },
  { title: "exit", sub: "step aside when the protection line breaks", rules: ["Protective exit"] },
  { title: "watch markets", sub: "sell signals read from other markets", rules: ["Breadth omen", "Credit stress", "Dollar shock", "Narrow leadership"] },
];

const HOT = "hsl(var(--beam-hot))";
const DIM = "hsl(var(--beam-dim))";
const AMBER = "hsl(var(--accent))";
const line = { fill: "none", stroke: HOT, strokeWidth: 1.4, strokeLinejoin: "round" as const };
const dashed = { fill: "none", stroke: DIM, strokeWidth: 1, strokeDasharray: "3 3" };
const tag = { fontSize: 9, fill: DIM };

function Sketch({ w = 132, h = 72, children }: { w?: number; h?: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block h-auto w-full font-mono" aria-hidden="true">
      {children}
    </svg>
  );
}

const SKETCHES: Record<string, ReactNode> = {
  "Extension ladder": (
    <Sketch>
      <path d="M4 64 C40 62 80 50 112 30" {...dashed} />
      <path d="M4 70 C44 68 84 58 112 40" {...dashed} />
      <polyline points="4,60 12,56 18,58 26,50 32,52 40,44 46,46 54,38 60,40 68,30 74,33 82,24 88,26 96,16 102,18 108,8" {...line} />
      {[8, 18, 28].map((yy) => <line key={yy} x1="112" y1={yy} x2="128" y2={yy} stroke={AMBER} strokeDasharray="3 2" />)}
    </Sketch>
  ),
  "Profit ladder": (
    <Sketch>
      {[52, 40, 28, 16].map((yy) => <line key={yy} x1="30" y1={yy} x2="128" y2={yy} {...dashed} />)}
      <polyline points="4,66 24,66 24,52 44,52 44,40 64,40 64,28 84,28 84,16 104,16" {...line} />
      {[[24, 52], [44, 40], [64, 28], [84, 16]].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="2.6" fill={AMBER} />)}
    </Sketch>
  ),
  "Trailing harvest": (
    <Sketch>
      <polyline points="4,64 16,58 24,60 34,48 42,50 52,36 58,38 68,20 76,10 84,22 90,30 96,36 104,32 114,34 126,26" {...line} />
      <polyline points="4,70 30,68 50,56 66,44 76,34 128,34" {...dashed} />
      <circle cx="96" cy="35" r="3" fill={AMBER} />
    </Sketch>
  ),
  "Protective exit": (
    <Sketch w={300} h={110}>
      <line x1="4" y1="56" x2="296" y2="56" {...dashed} />
      <text x="6" y="72" {...tag}>protection line</text>
      <polyline points="4,36 16,28 24,32 34,20 42,26 52,14 60,22 70,30 80,26 92,40 104,48 116,56 126,66 136,72 146,84 156,92 164,86 174,90 184,78 194,72 204,74 214,62 224,56 234,50 244,46 256,48 268,38 280,34 296,26" {...line} />
      <circle cx="116" cy="56" r="3.4" fill={AMBER} />
      <circle cx="224" cy="56" r="3.4" fill={HOT} />
      <text x="128" y="50" {...tag} fill={AMBER}>break: exit</text>
      <text x="232" y="76" {...tag}>reclaim</text>
    </Sketch>
  ),
  "Breadth omen": (
    <Sketch>
      <line x1="4" y1="32" x2="84" y2="32" stroke={DIM} />
      {[[30, 10], [36, 16], [42, 6], [48, 14], [64, 12], [70, 18]].map(([xx, top]) => <line key={`h${xx}`} x1={xx} y1="32" x2={xx} y2={top} stroke={HOT} strokeWidth="1.6" />)}
      {[[60, 46], [66, 52], [72, 44], [78, 50]].map(([xx, bot]) => <line key={`l${xx}`} x1={xx} y1="32" x2={xx} y2={bot} stroke={AMBER} strokeWidth="1.6" />)}
      <path d="M4 40 C36 44 62 54 84 66" {...dashed} />
      <text x="88" y="14" {...tag}>highs</text>
      <text x="88" y="50" {...tag}>lows</text>
      <text x="88" y="68" {...tag}>breadth</text>
    </Sketch>
  ),
  "Credit stress": (
    <Sketch>
      <polyline points="4,20 18,19 30,20 42,18 56,19 70,17" {...line} strokeWidth={1.1} />
      <polyline points="4,32 12,34 20,33 28,40 36,38 44,46 52,44 60,52 70,58" {...line} />
      <text x="74" y="21" {...tag}>treasuries</text>
      <text x="74" y="61" {...tag}>HYG</text>
    </Sketch>
  ),
  "Dollar shock": (
    <Sketch>
      <polyline points="4,58 14,57 24,59 34,56 44,58 54,57 64,58 74,55 82,52 88,40 92,14 96,26 102,22 110,24 118,20 128,22" {...line} />
      <text x="4" y="70" {...tag}>DXY</text>
      <circle cx="92" cy="14" r="3" fill={AMBER} />
    </Sketch>
  ),
  "Narrow leadership": (
    <Sketch>
      <polyline points="4,52 14,48 22,50 32,42 40,44 50,36 58,38 68,30 78,28 88,22 98,20 108,14" {...line} />
      <polyline points="4,58 14,54 22,56 32,52 40,54 50,50 58,54 68,52 78,56 88,58 98,62 108,64" {...line} stroke={DIM} />
      <text x="112" y="16" {...tag}>SPY</text>
      <text x="112" y="66" {...tag}>RSP</text>
    </Sketch>
  ),
};

export function MechanismSells({ drawn, instant }: { drawn: boolean; instant: boolean }) {
  const byName = new Map(TRIM_INFO.map((rule) => [rule.name, rule]));
  return (
    <div className="mt-10">
      <div className="grid gap-y-10 md:grid-cols-3 md:gap-y-0 md:divide-x md:divide-beam-ghost">
        {GROUPS.map((group, g) => (
          <section
            key={group.title}
            aria-labelledby={`sells-${g}`}
            className="md:px-6 md:first:pl-0 md:last:pr-0"
            style={{ opacity: drawn ? 1 : 0, transition: instant ? "none" : `opacity .6s ease ${300 + g * 200}ms` }}
          >
            <h3 id={`sells-${g}`} className="font-mono text-lg font-semibold uppercase tracking-[0.12em] text-beam-hot">{group.title}</h3>
            <p className="mt-1 font-mono text-sm text-beam-dim">{group.sub}</p>
            <ul className="mt-6 space-y-7">
              {group.rules.map((name) => {
                const rule = byName.get(name);
                if (!rule) return null;
                const wide = name === "Protective exit";
                return (
                  <li key={name} className={wide ? "" : "flex items-start justify-between gap-4 md:block"}>
                    <div className="min-w-0">
                      <h4 className="font-mono font-semibold text-beam-mid">{rule.name}</h4>
                      <p className="mt-1 font-mono text-sm leading-relaxed text-beam-dim">{rule.watches}</p>
                    </div>
                    <div className={wide ? "mt-6 max-w-[420px]" : "w-[110px] shrink-0 sm:w-[132px] md:mt-3 md:w-[190px]"}>{SKETCHES[name]}</div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="etched mt-10 border-t border-beam-ghost pt-5">
        Sketches are schematic: the shape each trigger looks for, with no data or returns.
      </p>
    </div>
  );
}
