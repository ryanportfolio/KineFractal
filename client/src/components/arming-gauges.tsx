import { Link } from "wouter";
import { BeamHeading } from "@/components/beam-heading";
import { MechanismSizingCurve } from "@/components/mechanism-sizing-curve";
import { MechanismSells } from "@/components/mechanism-sells";
import { useBeam } from "@/hooks/use-beam";
import { useFearState, type FundFear } from "@/hooks/use-fear-state";
import { ord, SYM_NAME } from "@/data/lab-data";
import { clampPercent } from "@/lib/homepage-signal-model";

const ORDER: Record<string, number> = { SPY: 0, QQQ: 1, IWM: 2 };
const AXIS = [0, 25, 50, 75, 100];
const MINOR = [5, 10, 15, 20, 30, 35, 40, 45, 55, 60, 65, 70, 80, 85, 90, 95];

// left edge at 0, centred at 50, right edge at 100: a label never leaves the rail
const along = (pos: number) => ({ left: `${pos}%`, transform: `translateX(-${pos}%)` });

function gapText(fund: FundFear): string {
  if (fund.nowPct >= fund.floorPct) return "buy line crossed";
  const points = Math.ceil(fund.floorPct - fund.nowPct);
  return `waiting ${points} ${points === 1 ? "point" : "points"}`;
}

// order size range in % of account: "3% to 100%" when the rule has a minimum, "up to 55%" when it starts at zero
function sizeSpan(fund: FundFear): string {
  return fund.minPct > 0 ? `${fund.minPct}% to ${fund.maxPct}%` : `up to ${fund.maxPct}%`;
}

function FundLane({ fund, index, drawn, instant }: {
  fund: FundFear;
  index: number;
  drawn: boolean;
  instant: boolean;
}) {
  const now = clampPercent(fund.nowPct);
  const buyLine = clampPercent(fund.floorPct);
  const crossed = fund.nowPct >= fund.floorPct;
  const lo = Math.min(now, buyLine);
  const hi = Math.max(now, buyLine);
  const fade = (delay: number) => ({
    opacity: drawn ? 1 : 0,
    transition: instant ? "none" : `opacity .5s ease ${delay + index * 150}ms`,
  });
  const size = sizeSpan(fund);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 border-t border-beam-ghost py-5 md:grid-cols-[150px_1fr_190px] md:py-6">
      <div className="order-1 font-mono">
        <h3 className="text-2xl font-semibold text-beam-hot">{fund.sym}</h3>
        <p className="mt-2 text-xs text-beam-dim">{SYM_NAME[fund.sym] ?? fund.tfLabel}</p>
      </div>
      <p className="order-2 text-right font-mono tabular-nums md:order-3 md:text-left">
        <span className="block text-lg font-semibold text-beam-hot md:text-xl">{size}</span>
        <span className="mt-2 block text-xs text-beam-dim"> of account</span>
      </p>

      {/* rows, top to bottom (px at the 22px root, where a text-xs label is 22px tall): buy-line label 0-22;
          rail at 46 with its tick 30-63, dot 36-56 and bracket 58-66; fear-now label 74-96; bracket text 106-128.
          The buy line is labeled above the rail and fear today below it, so the two never share a row however
          close the values are, and every label stays clear of the markers */}
      <div className="relative order-3 col-span-2 h-[128px] md:order-2 md:col-span-1">
        {AXIS.map((p) => (
          <span key={p} aria-hidden="true" className="absolute inset-y-0 border-l border-dashed border-beam-ghost" style={{ left: `${p}%` }} />
        ))}

        <span className="absolute top-0 whitespace-nowrap font-mono text-xs leading-4 text-accent" style={{ ...along(buyLine), ...fade(300) }} aria-hidden="true">
          buy {ord(fund.floorPct)}
        </span>

        <div className="absolute inset-x-0 top-[46px] h-px bg-beam-dim/60" aria-hidden="true"
          style={{ transform: drawn ? "scaleX(1)" : "scaleX(0)", transformOrigin: "left", transition: instant ? "none" : `transform .8s cubic-bezier(0.16,1,0.3,1) ${index * 150}ms` }}>
          {MINOR.map((p) => (
            <span key={p} className="absolute -top-[3px] h-[7px] border-l border-beam-ghost" style={{ left: `${p}%` }} />
          ))}
          <span className="absolute -top-[5px] left-0 h-[11px] border-l border-beam-dim" />
          <span className="absolute -top-[5px] right-0 h-[11px] border-r border-beam-dim" />
        </div>

        <span
          data-testid="buy-line-marker"
          aria-hidden="true"
          className="absolute top-[30px] h-6 -translate-x-1/2 border-l-2 border-accent shadow-[0_0_6px_hsl(var(--accent)/.6)]"
          style={{ left: `${buyLine}%`, ...fade(200) }}
        />
        <span
          data-testid="fear-now-marker"
          aria-hidden="true"
          className="absolute top-[46px] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-beam-hot shadow-[0_0_8px_hsl(var(--beam-mid))]"
          style={{ left: `${now}%`, ...fade(400) }}
        />

        {/* the gap: a bracket from fear today to the buy line */}
        <span
          aria-hidden="true"
          className={`absolute top-[58px] h-1.5 border-x border-b ${crossed ? "border-accent/80" : "border-beam-dim/70"}`}
          style={{ left: `${lo}%`, width: `${hi - lo}%`, ...fade(600) }}
        />
        <span className="absolute top-[74px] whitespace-nowrap font-mono text-xs leading-4 text-beam-hot" style={{ ...along(now), ...fade(300) }} aria-hidden="true">
          {ord(fund.nowPct)}
        </span>
        <span
          className={`absolute top-[106px] whitespace-nowrap font-mono text-xs leading-4 ${crossed ? "text-accent" : "text-beam-dim"}`}
          style={{ ...along((lo + hi) / 2), ...fade(600) }}
        >
          {gapText(fund)}
        </span>
      </div>
      <span className="sr-only">{fund.sym} fear percentile today is the {ord(fund.nowPct)}; its buy line is the {ord(fund.floorPct)} percentile. Order size range: {size} of account.</span>
    </div>
  );
}

function FundRails({ funds, drawn, instant }: { funds: FundFear[]; drawn: boolean; instant: boolean }) {
  return (
    <div className="mt-10">
      <div className="grid grid-cols-1 items-end gap-x-6 pb-3 md:grid-cols-[150px_1fr_190px]" aria-hidden="true">
        <span className="etched hidden md:block">fund</span>
        {/* a narrow rail (under 24rem) has no room for "calm 0" and "fear 100" between the ticks:
            it shows numbers only and puts the end words on their own line below */}
        <div className="@container">
          <p className="etched text-center">fear percentile</p>
          <div className="relative mt-2 h-4 font-mono text-xs text-beam-dim tabular-nums">
            {AXIS.map((p) => (
              <span key={p} className="absolute top-0 whitespace-nowrap" style={along(p)}>
                {p === 0 && <span className="hidden @min-[24rem]:inline">calm </span>}
                {p === 100 && <span className="hidden @min-[24rem]:inline">fear </span>}
                {p}
              </span>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-beam-dim @min-[24rem]:hidden">
            <span>calm</span>
            <span>fear</span>
          </div>
        </div>
        <span className="etched hidden md:block">order size range</span>
      </div>
      {funds.map((fund, index) => (
        <FundLane key={fund.sym} fund={fund} index={index} drawn={drawn} instant={instant} />
      ))}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-beam-ghost pt-5 font-mono text-xs text-beam-dim">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-beam-hot shadow-[0_0_6px_hsl(var(--beam-mid))]" />
          fear percentile today
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-4 border-l-2 border-accent" />
          buy line
        </span>
        <span>Order size range is the sizing rule, not an executed order.</span>
      </div>
    </div>
  );
}

export function ArmingGauges() {
  const { ref, phase } = useBeam<HTMLElement>();
  const fear = useFearState();
  const funds = [...fear.funds].sort((a, b) => ORDER[a.sym] - ORDER[b.sym]);
  const drawn = phase !== "dark";
  const instant = phase === "held";

  return (
    <section ref={ref} id="mechanism" className="scroll-mt-16 px-5 py-24 md:px-10" aria-label="How the strategy buys and sells">
      <div className="mx-auto max-w-6xl">
        <div className="etched mb-2 text-beam-dim" aria-hidden="true">04</div>
        <BeamHeading text="HOW IT BUYS" as="h2" active={drawn} instant={instant} />
        <p className="etched mt-4 max-w-[82ch] leading-relaxed text-beam-dim">
          Fear percentile ranks today’s pullback against recent history. Crossing a fund’s buy line is the first check, not an automatic order:
          cooldown, protection, market regime and available cash still decide whether a buy happens.
        </p>
        {funds.length ? (
          <>
            <FundRails funds={funds} drawn={drawn} instant={instant} />
            <MechanismSizingCurve funds={funds} defaultSym={fear.hottest?.sym ?? funds[0].sym} drawn={drawn} instant={instant} />
          </>
        ) : (
          <div className="etched mt-10 py-8 text-beam-dim">current fear readings unavailable</div>
        )}

        <div className="mt-24 max-w-[620px]">
          <BeamHeading text="HOW IT SELLS" as="h2" active={drawn} instant={instant} />
        </div>
        <p className="etched mt-4 max-w-[82ch] leading-relaxed text-beam-dim">
          The simulated rules trim profitable positions into strength, step aside when SPY’s protection rule breaks,
          and recycle raised cash when conditions improve. Exact thresholds differ by fund.
        </p>
        <MechanismSells drawn={drawn} instant={instant} />
        <p className="etched mt-5 text-beam-dim">
          <Link href="/#rulebook" className="inline-flex min-h-[44px] items-center hover:text-beam-mid sm:-my-[calc((24px_-_1lh)/2)] sm:min-h-[24px]">full methodology →</Link>
        </p>
      </div>
    </section>
  );
}
