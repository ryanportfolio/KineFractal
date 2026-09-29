import { Link } from "wouter";
import { BeamHeading } from "@/components/beam-heading";
import { useBeam } from "@/hooks/use-beam";
import { useFearState, type FundFear } from "@/hooks/use-fear-state";
import { ord } from "@/data/lab-data";
import { TRIM_INFO } from "@/data/fearlab-board";
import { clampPercent } from "@/lib/homepage-signal-model";

const ORDER: Record<string, number> = { SPY: 0, QQQ: 1, IWM: 2 };

function stateText(fund: FundFear): string {
  const crossed = fund.nowPct >= fund.floorPct;
  return crossed
    ? "buy line crossed"
    : `waiting ${Math.ceil(fund.floorPct - fund.nowPct)} percentile points`;
}

function BuyRail({ fund, index, drawn, instant }: {
  fund: FundFear;
  index: number;
  drawn: boolean;
  instant: boolean;
}) {
  const now = clampPercent(fund.nowPct);
  const buyLine = clampPercent(fund.floorPct);
  return (
    <article className="border border-beam-ghost/60 p-5">
      <div className="flex items-baseline justify-between gap-4 font-mono">
        <h3 className="text-lg font-semibold text-beam-hot">{fund.sym}</h3>
        <span className="etched text-beam-dim">{fund.tfLabel}</span>
      </div>
      <div className="relative mt-5 h-2 bg-[hsl(var(--beam-ghost)/.45)]" aria-hidden="true">
        <div
          className="h-full bg-beam-mid"
          style={{
            width: `${now}%`,
            transform: drawn ? "scaleX(1)" : "scaleX(0)",
            transformOrigin: "left",
            transition: instant ? "none" : `transform .8s ease ${200 + index * 150}ms`,
          }}
        />
        <span
          data-testid="buy-line-marker"
          className="absolute top-[-5px] h-4 border-l-2 border-accent"
          style={{ left: `${buyLine}%` }}
        />
        <span
          data-testid="fear-now-marker"
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-beam-hot shadow-[0_0_7px_hsl(var(--beam-mid))]"
          style={{ left: `${now}%` }}
        />
      </div>
      <span className="sr-only">{fund.sym} fear now is the {ord(fund.nowPct)} percentile; its buy line is the {ord(fund.floorPct)} percentile.</span>
      <div className="mt-2 flex justify-between font-mono text-xs text-beam-dim">
        <span>calm 0</span><span>fear 100</span>
      </div>
      <dl className="mt-5 space-y-2 font-mono text-sm tabular-nums">
        <div className="flex justify-between gap-4"><dt className="text-beam-dim">fear now</dt><dd className="text-beam-mid">{ord(fund.nowPct)} percentile</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-beam-dim">buy line</dt><dd className="text-beam-mid">{ord(fund.floorPct)} percentile</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-beam-dim">minimum</dt><dd className="text-beam-mid">{fund.minPct === 0 ? "none" : `${fund.minPct}% of account`}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-beam-dim">maximum</dt><dd className="text-beam-mid">{fund.maxPct}% of account</dd></div>
      </dl>
      <p className={`mt-5 font-mono text-sm font-semibold ${fund.nowPct >= fund.floorPct ? "text-accent" : "text-beam-dim"}`}>
        {stateText(fund)}
      </p>
      <p className="etched mt-3 leading-relaxed text-beam-dim">
        {fund.sym === "SPY" && "At the line, sizing starts at 3% and rises sharply toward the 100% maximum as fear deepens."}
        {fund.sym === "QQQ" && "Crossing the line enables sizing. A meaningful order appears only as fear approaches the extreme, up to 55%."}
        {fund.sym === "IWM" && "Crossing the line enables sizing. Order size then rises gradually with fear, up to 30%."}
      </p>
    </article>
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
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {funds.map((fund, index) => <BuyRail key={fund.sym} fund={fund} index={index} drawn={drawn} instant={instant} />)}
          </div>
        ) : (
          <div className="etched mt-10 py-8 text-beam-dim">current fear readings unavailable</div>
        )}

        <div className="mt-20 max-w-[620px]">
          <BeamHeading text="HOW IT SELLS" as="h2" active={drawn} instant={instant} />
        </div>
        <p className="etched mt-4 max-w-[82ch] leading-relaxed text-beam-dim">
          The simulated rules trim profitable positions into strength, step aside when SPY’s protection rule breaks,
          and recycle raised cash when conditions improve. Exact thresholds differ by fund.
        </p>
        <div className="mt-8 grid gap-px border border-beam-ghost/50 bg-[hsl(var(--beam-ghost))] md:grid-cols-2">
          {TRIM_INFO.slice(0, 8).map((rule) => (
            <article key={rule.name} className="bg-background p-4">
              <h3 className="font-mono font-semibold text-beam-mid">{rule.name}</h3>
              <p className="mt-2 font-mono text-sm leading-relaxed text-beam-dim">{rule.watches}</p>
            </article>
          ))}
        </div>
        <p className="etched mt-5 text-beam-dim">
          <Link href="/#rulebook" className="hover:text-beam-mid">full methodology →</Link>
        </p>
      </div>
    </section>
  );
}
