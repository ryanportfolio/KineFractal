// /lab/:key — the full report, in the scope's register: darkness, hairlines,
// ramp-colored numerals. Structure unchanged (headline → curves → years →
// months → attribution → recent → method); every number from the report JSON.
import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { EquityCurve } from "@/components/lab/equity-curve";
import { DrawdownCurve, InvestedCurve } from "@/components/lab/series-curves";
import {
  fetchReport, engineName, trimName, fmtPct, fmtPp,
  TF_LABEL, SYM_NAME, type LabReport,
} from "@/data/lab-data";

const BENCH = "hsl(var(--beam-dim))";
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STICKY_COLUMN_HEADER =
  "sticky top-[52px] z-20 bg-background/95 backdrop-blur-[8px] " +
  "border-b border-beam-ghost/70 shadow-[0_8px_16px_hsl(var(--background)/0.72)]";

function Head({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="mb-7">
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="etched text-beam-dim">{n}</span>
        <h2 className="font-mono text-sm md:text-base font-semibold tracking-[0.18em] uppercase text-beam-mid">{title}</h2>
        {note && <span className="etched text-beam-dim">{note}</span>}
      </div>
      <div className="h-px w-16 mt-3" style={{ background: "hsl(var(--beam-dim))" }} />
    </div>
  );
}

// Horizontal compare bar; the strategy is the bright trace, the benchmark the
// fainter one, losses burn amber.
function CmpBar({ label, pct, scaleMax, glow, value }: { label: string; pct: number; scaleMax: number; glow?: boolean; value: string }) {
  const w = Math.max((Math.abs(pct) / scaleMax) * 100, 6);
  return (
    <div className="flex items-center gap-3">
      <span className="etched w-24 shrink-0" style={{ color: glow ? undefined : BENCH }}>{label}</span>
      <div className="relative flex-1 h-7">
        <div className="absolute inset-y-0 left-0 flex items-center"
          style={{
            width: `${w}%`,
            background: glow
              ? "linear-gradient(90deg, hsl(var(--beam-hot)), hsl(var(--beam-mid)))"
              : pct < 0
                ? "hsl(var(--accent) / 0.85)"
                : "hsl(var(--beam-ghost))",
            boxShadow: glow ? "0 0 10px hsl(var(--beam-mid) / 0.5)" : undefined,
          }}>
          <span className={`pl-2 font-mono text-[12px] font-semibold tabular-nums ${glow || pct < 0 ? "" : "text-beam-mid"}`}
            style={glow || pct < 0 ? { color: "hsl(var(--tube-h) 28% 4%)" } : undefined}>{value}</span>
        </div>
      </div>
    </div>
  );
}

function Tile({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-beam-hot" : tone === "bad" || tone === "warn" ? "text-accent" : "text-beam-mid";
  return (
    <div className="border border-beam-ghost/50 p-4">
      <div className="etched text-beam-dim">{k}</div>
      <div className={`font-mono font-semibold text-2xl tabular-nums mt-1 ${color}`}
        style={tone === "good" ? { textShadow: "0 0 12px hsl(var(--beam-mid) / 0.4)" } : undefined}>{v}</div>
      {sub && <div className="etched text-beam-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="px-5 md:px-10 py-32 text-center etched text-beam-dim">
      loading {label}<span className="beam-caret ml-1" />
    </div>
  );
}

export default function LabReportPage() {
  const params = useParams();
  const key = (params as { key?: string }).key || "";
  const [d, setD] = useState<LabReport | null>(null);
  const [err, setErr] = useState(false);

  const edge = d?.headline.edge_pp;
  const metaTitle = d
    ? `${d.sym} ${TF_LABEL[d.tf] ?? d.tf}${
        edge != null ? ` · ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}pp vs buy & hold` : " · backtest"
      }`
    : key
      ? `${key} · backtest`
      : "Backtest";
  const metaDescription = d
    ? `${d.sym} ${TF_LABEL[d.tf] ?? d.tf} strategy backtest: ${fmtPct(d.headline.ret)} vs ${fmtPct(
        d.headline.bench_ret,
      )} buy & hold, ${d.window.start} to ${d.window.end}. Educational only.`
    : undefined;
  useDocumentMeta({ title: metaTitle, description: metaDescription });

  useEffect(() => {
    setD(null); setErr(false);
    let live = true;
    fetchReport(key).then((r) => { if (live) setD(r); }).catch(() => { if (live) setErr(true); });
    window.scrollTo(0, 0);
    return () => { live = false; };
  }, [key]);

  return (
    <>
      <Navbar />
      <main className="relative bg-background text-foreground overflow-x-clip pt-[52px] min-h-screen">
        {err ? (
          <div className="px-5 md:px-10 py-32 text-center font-mono text-sm">
            <p className="text-accent">no report for <span className="text-beam-mid">{key}</span></p>
            <Link href="/lab" className="etched text-beam-dim hover:text-beam-mid mt-4 inline-block">← back to the board</Link>
          </div>
        ) : !d ? (
          <Loading label={key} />
        ) : (
          <Report d={d} />
        )}
      </main>
    </>
  );
}

function Report({ d }: { d: LabReport }) {
  const h = d.headline;
  const edge = h.edge_pp;
  const scaleMax = Math.max(Math.abs(h.ret), Math.abs(h.bench_ret), 1);
  const ahead = edge != null && edge >= 0;

  return (
    <>
      {/* status rule */}
      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-beam-ghost/60 px-5 md:px-10 py-3 etched">
        <span className="flex items-center gap-3">
          <Link href="/lab" className="flex items-center gap-1.5 text-beam-dim hover:text-beam-mid transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> board
          </Link>
          <span className="text-beam-ghost">/</span>
          <span className="text-beam-mid font-semibold">{d.sym}</span>
          <span className="hidden md:inline text-beam-dim">{SYM_NAME[d.sym]} · {TF_LABEL[d.tf] || d.tf}{d.variant ? ` · ${d.variant}` : ""}</span>
        </span>
        <span className="flex items-center gap-2 tabular-nums text-beam-dim">
          {d.window.start} → {d.window.end}
          <span className="text-beam-ghost">·</span>
          EOD {d.generated.slice(0, 10)}
        </span>
      </div>

      {/* 01 headline */}
      <section className="px-5 md:px-10 pt-12 pb-12 border-b border-beam-ghost/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <div className="etched text-beam-dim mb-2">01 · ahead of buy &amp; hold</div>
              <div className={`font-mono font-semibold tabular-nums leading-none text-[clamp(3.5rem,11vw,7rem)] ${ahead ? "text-beam-hot" : "text-accent"}`}
                style={ahead ? { textShadow: "0 0 28px hsl(var(--beam-mid) / 0.4)" } : undefined}>
                {fmtPp(edge)}
              </div>
              <div className="etched text-beam-dim mt-2">percentage points · strategy return minus buy &amp; hold</div>
              <p className="font-mono text-[13px] leading-relaxed text-beam-mid mt-6 max-w-md border-l border-beam-dim pl-4">
                Strategy return: <span className="text-beam-hot font-semibold">{fmtPct(h.ret)}</span>.{" "}
                Buying and holding {d.sym}: <span style={{ color: BENCH }}>{fmtPct(h.bench_ret)}</span>.{" "}
                These are simulated returns shown as percentages. The simulation's funding schedule is a measurement input, not a live contribution plan.
              </p>
            </div>
            <div className="lg:col-span-7">
              <div className="space-y-3 mb-6">
                <CmpBar label="strategy" pct={h.ret} scaleMax={scaleMax} glow value={fmtPct(h.ret)} />
                <CmpBar label="buy & hold" pct={h.bench_ret} scaleMax={scaleMax} value={fmtPct(h.bench_ret)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Tile k="annualized" v={fmtPct(h.irr)} sub={`buy & hold ${fmtPct(h.bench_irr)}`} tone={h.irr >= h.bench_irr ? "good" : undefined} />
                <Tile k="deepest drop" v={`${h.dd.toFixed(1)}%`} sub={`buy & hold ${h.bench_dd.toFixed(1)}%`} tone={h.dd <= h.bench_dd ? "good" : "warn"} />
                <Tile k="invested now" v={`${h.exposure_end.toFixed(0)}%`} sub={`avg ${h.exposure_avg.toFixed(0)}%`} />
                <Tile k="trades closed" v={h.trades.toLocaleString()} sub={`${h.open_lots} lots still open`} />
                <Tile k="win rate" v={`${h.win_rate.toFixed(0)}%`} sub="of closed trades" tone={h.win_rate >= 50 ? "good" : undefined} />
                <Tile k="profit factor" v={h.profit_factor == null ? "n/a" : h.profit_factor.toFixed(2)} sub="gross wins ÷ gross losses" tone={h.profit_factor != null && h.profit_factor >= 1 ? "good" : undefined} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 the curve */}
      <section className="px-5 md:px-10 py-12 border-b border-beam-ghost/50">
        <div className="max-w-6xl mx-auto">
          <Head n="02" title="The two lines" note="strategy vs buy & hold · hover for any date" />
          <div className="border border-beam-ghost/50 p-4 md:p-6">
            <EquityCurve points={d.curve} height={360} />
          </div>
          <p className="etched text-beam-dim mt-3">
            cash-flow-adjusted cumulative percent return · external simulation funding is removed from both lines · the dim dash is just owning {d.sym}
          </p>
        </div>
      </section>

      {/* 02b underwater / drawdown */}
      {d.drawdown.length > 0 && (
        <section className="px-5 md:px-10 py-12 border-b border-beam-ghost/50">
          <div className="max-w-6xl mx-auto">
            <Head n="02b" title="How deep it bled" note="drawdown from each line's own peak · shallower is better" />
            <div className="border border-beam-ghost/50 p-4 md:p-6">
              <DrawdownCurve points={d.drawdown} height={300} />
            </div>
            <p className="etched text-beam-dim mt-3">
              each dip is measured against that line's own high
            </p>
          </div>
        </section>
      )}

      {/* 02c invested / exposure */}
      {d.invested.length > 0 && (
        <section className="px-5 md:px-10 py-12 border-b border-beam-ghost/50">
          <div className="max-w-6xl mx-auto">
            <Head n="02c" title="How much was in" note="percent of capital deployed · buys fear, trims strength" />
            <div className="border border-beam-ghost/50 p-4 md:p-6">
              <InvestedCurve points={d.invested} height={240} />
            </div>
            <p className="etched text-beam-dim mt-3">
              cash sits idle until fear shows up, then the engine scales in; strength trims it back down · buy-and-hold is always 100% in
            </p>
          </div>
        </section>
      )}

      {/* 03 year by year */}
      {d.yearly.length > 0 && (
        <section className="px-5 md:px-10 py-12 border-b border-beam-ghost/50">
          <div className="max-w-5xl mx-auto">
            <Head n="03" title="Year by year" note={d.yearlyBasis === "carried" ? "continuous simulation slices · * = partial year" : "independent years · * = partial year"} />
            <YearTable d={d} />
          </div>
        </section>
      )}

      {/* 04 month heatmap */}
      {d.monthly.length >= 3 && (
        <section className="px-5 md:px-10 py-12 border-b border-beam-ghost/50">
          <div className="max-w-6xl mx-auto">
            <Head n="04" title="Every month" note="strategy return · bright up, amber down" />
            <MonthHeat d={d} />
          </div>
        </section>
      )}

      {/* 05 what did the work */}
      <section className="px-5 md:px-10 py-12 border-b border-beam-ghost/50">
        <div className="max-w-6xl mx-auto">
          <Head n="05" title="What did the work" note="which engines bought, which signals trimmed" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Attribution d={d} />
            <Trims d={d} />
          </div>
        </div>
      </section>

      {/* 06 recent */}
      {d.recent.length > 0 && (
        <section className="px-5 md:px-10 py-12 border-b border-beam-ghost/50">
          <div className="max-w-4xl mx-auto">
            <Head n="06" title="Recent activity" note="latest simulated fills" />
            <Recent d={d} />
          </div>
        </section>
      )}

      {/* fear preset + footer */}
      <section className="px-5 md:px-10 py-12">
        <div className="max-w-4xl mx-auto">
          {d.fear.on && (
            <div className="border border-beam-ghost/50 p-5 mb-8">
              <div className="font-mono text-[13px] leading-relaxed text-beam-mid">
                <span className="text-beam-hot font-semibold">How {d.sym} buys: </span>
                fear is read from price: how far {d.sym} has dropped below its recent high.
                Buying starts once fear crosses the <span className="text-beam-hot">{d.fear.floorPct?.toFixed(0)}th percentile</span>,
                and the deeper the drop the bigger the buy: size scales from{" "}
                <span className="text-beam-hot">{d.fear.minPct}%</span> up to{" "}
                <span className="text-beam-hot">{d.fear.maxPct}%</span> of the buy.
                {d.fear.nowPct != null && (
                  <> Right now fear sits at <span className={d.fear.nowPct >= (d.fear.floorPct || 100) ? "text-accent font-semibold" : "text-beam-dim"}>{d.fear.nowPct.toFixed(0)}</span>.</>
                )}
              </div>
            </div>
          )}
          <p className="etched text-beam-dim leading-relaxed">
            backtest on {d.sym} {TF_LABEL[d.tf] || d.tf} bars, {d.window.start} to {d.window.end} · educational only ·
            not investment, financial, or trading advice · past performance does not guarantee future results ·
            trading involves substantial risk of loss
          </p>
        </div>
      </section>
    </>
  );
}

function YearTable({ d }: { d: LabReport }) {
  const max = Math.max(...d.yearly.flatMap((y) => [Math.abs(y.spct), Math.abs(y.bpct)]), 1);
  return (
    <div className="space-y-2">
      <div
        data-sticky-column-header="yearly"
        className={`${STICKY_COLUMN_HEADER} -mx-1 grid grid-cols-[60px_1fr_1fr_70px] gap-3 px-2 py-2 etched text-beam-dim`}
      >
        <span>year</span><span>strategy</span><span>buy &amp; hold</span><span className="text-right">edge</span>
      </div>
      {d.yearly.slice().reverse().map((y) => {
        const win = y.edge >= 0;
        return (
          <div key={y.y} className="grid grid-cols-[60px_1fr_1fr_70px] gap-3 items-center py-1.5 border-b border-beam-ghost/40">
            <span className="font-mono text-sm tabular-nums text-beam-mid">{y.y}{y.partial ? "*" : ""}</span>
            <MiniBar pct={y.spct} max={max} glow />
            <MiniBar pct={y.bpct} max={max} />
            <span className={`font-mono text-sm font-semibold tabular-nums text-right ${win ? "text-beam-hot" : "text-accent"}`}>{fmtPp(y.edge)}</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniBar({ pct, max, glow }: { pct: number; max: number; glow?: boolean }) {
  const w = Math.max((Math.abs(pct) / max) * 100, 4);
  const neg = pct < 0;
  return (
    <div className="relative h-6">
      <div className="absolute inset-y-0 left-0 flex items-center"
        style={{
          width: `${w}%`,
          background: neg
            ? "hsl(var(--accent) / 0.8)"
            : glow
              ? "linear-gradient(90deg, hsl(var(--beam-hot)), hsl(var(--beam-mid)))"
              : "hsl(var(--beam-ghost))",
          boxShadow: glow && !neg ? "0 0 8px hsl(var(--beam-mid) / 0.4)" : undefined,
        }}>
        <span className={`pl-2 font-mono text-[11px] font-semibold tabular-nums ${!glow && !neg ? "text-beam-mid" : ""}`}
          style={glow || neg ? { color: "hsl(var(--tube-h) 28% 4%)" } : undefined}>{fmtPct(pct)}</span>
      </div>
    </div>
  );
}

function MonthHeat({ d }: { d: LabReport }) {
  const byY: Record<number, Record<number, number>> = {};
  d.monthly.forEach((r) => { (byY[r.y] = byY[r.y] || {})[r.m] = r.s; });
  const yrTot: Record<number, number> = {};
  d.yearly.forEach((y) => { yrTot[y.y] = y.spct; });
  const years = Object.keys(byY).map(Number).sort((a, b) => b - a);
  const cell = (v: number | undefined, k: string) => {
    if (v == null) return <td key={k} className="border border-beam-ghost/30" />;
    const a = Math.min(Math.abs(v) / 8, 1) * 0.5 + 0.06;
    const bg = v >= 0 ? `hsl(var(--beam-mid) / ${a.toFixed(2)})` : `hsl(var(--accent) / ${a.toFixed(2)})`;
    return (
      <td key={k} className="border border-beam-ghost/30 px-1.5 py-1.5 text-center tabular-nums text-foreground"
        style={{ background: bg }} title={`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}>
        {v >= 0 ? "+" : ""}{v.toFixed(1)}
      </td>
    );
  };
  return (
    <div className="overflow-x-auto md:overflow-visible">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead className={STICKY_COLUMN_HEADER}>
          <tr className="text-beam-dim">
            <th className="text-left px-2 py-1 font-semibold">year</th>
            {MN.map((m) => <th key={m} className="px-1 py-1 font-semibold">{m}</th>)}
            <th className="px-1 py-1 font-semibold">year</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <td className="text-left px-2 py-1 text-beam-mid tabular-nums">{y}</td>
              {Array.from({ length: 12 }, (_, i) => cell(byY[y][i + 1], `${y}-${i}`))}
              {cell(yrTot[y], `${y}-t`)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Attribution({ d }: { d: LabReport }) {
  const rows = d.attribution.slice().sort((a, b) => b.return_contrib_pp - a.return_contrib_pp);
  return (
    <div>
      <div className="etched text-beam-mid mb-3">&gt; buy engines</div>
      <p className="etched text-beam-dim mb-4 leading-relaxed">
        bars show each engine&apos;s buy-flow share · right side is trading P&amp;L contribution in percentage points of money in ·
        it need not sum to headline return because dividends and other account effects sit outside engine trading P&amp;L
      </p>
      <table className="w-full table-fixed border-collapse font-mono text-[11px]">
        <caption className="sr-only">Buy-engine attribution</caption>
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[14%]" />
          <col className="w-[25%]" />
          <col className="w-[25%]" />
        </colgroup>
        <thead>
          <tr className="etched text-beam-dim">
            <th scope="col" className="px-2 py-1 text-left font-semibold">engine</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">buys</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">buy flow</th>
            <th scope="col" className="px-2 py-1 text-right font-semibold">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.eng} className="border-t border-beam-ghost/40">
              <td className="px-2 py-1.5 text-beam-mid">
                <div className="truncate" title={r.eng}>{engineName(r.eng)}</div>
              </td>
              <td className="px-1 py-1.5 text-right text-beam-dim tabular-nums whitespace-nowrap">{r.buys}</td>
              <td className="relative px-1 py-1.5 text-right text-beam-dim tabular-nums whitespace-nowrap">
                <div className="absolute inset-y-1 left-0 border-r"
                  style={{
                    width: `${Math.max(Math.abs(r.buy_flow_pct), 4)}%`,
                    background: "hsl(var(--beam-mid) / 0.22)",
                    borderColor: "hsl(var(--beam-mid) / 0.5)",
                  }} />
                <span className="relative">{r.buy_flow_pct.toFixed(1)}%</span>
              </td>
              <td className={`px-1 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${r.return_contrib_pp >= 0 ? "text-beam-hot" : "text-accent"}`}>{fmtPp(r.return_contrib_pp)} pp</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Trims({ d }: { d: LabReport }) {
  const tags = Object.entries(d.trimTags).sort((a, b) => b[1] - a[1]);
  const total = tags.reduce((s, [, n]) => s + n, 0);
  if (!total) return (
    <div>
      <div className="etched text-accent mb-3">&gt; trim signals</div>
      <p className="etched text-beam-dim">never sold · pure accumulation · profit is unrealized, still riding in open lots</p>
    </div>
  );
  const max = Math.max(...tags.map(([, n]) => n), 1);
  return (
    <div>
      <div className="etched text-accent mb-3">&gt; trim signals · {total} sells</div>
      <div className="space-y-2.5">
        {tags.map(([tag, n]) => (
          <div key={tag} className="flex items-center gap-3">
            <span className="etched text-beam-mid w-40 shrink-0 truncate" title={tag}>{trimName(tag)}</span>
            <div className="relative flex-1 h-6">
              <div className="absolute inset-y-0 left-0 border-r"
                style={{
                  width: `${Math.max((n / max) * 100, 4)}%`,
                  background: "hsl(var(--accent) / 0.2)",
                  borderColor: "hsl(var(--accent) / 0.5)",
                }} />
            </div>
            <span className="font-mono text-[11px] font-semibold tabular-nums w-10 text-right text-accent">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Recent({ d }: { d: LabReport }) {
  const rows = d.recent.slice().reverse();
  const fmtTs = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");
  return (
    <div className="border border-beam-ghost/50 p-4 md:p-5">
      <div className="font-mono text-[12px]">
        <div
          data-sticky-column-header="recent"
          className={`${STICKY_COLUMN_HEADER} -mx-1 grid grid-cols-[5.2rem_2.8rem_minmax(0,1fr)_5.5rem] gap-2 px-1 py-2 etched text-beam-dim md:grid-cols-[140px_50px_minmax(0,1fr)_110px_130px]`}
        >
          <span>time</span><span>side</span><span>signal</span><span className="text-right">account move</span><span className="text-right hidden md:block">detail</span>
        </div>
        {rows.map((e, i) => {
          const detail = e.side === "buy"
            ? (e.price == null ? "ETF price n/a" : `ETF price $${e.price.toFixed(2)}`)
            : (e.lot_return_pct == null ? "lot return n/a" : `lot return ${fmtPct(e.lot_return_pct, 2)}`);
          return (
          <div key={i} className="grid grid-cols-[5.2rem_2.8rem_minmax(0,1fr)_5.5rem] md:grid-cols-[140px_50px_minmax(0,1fr)_110px_130px] gap-2 py-1.5 border-b border-beam-ghost/30 items-center tabular-nums">
            <span className="text-beam-dim">
              <span className="md:hidden">{fmtTs(e.ts).slice(0, 10)}</span>
              <span className="hidden md:inline">{fmtTs(e.ts)}</span>
            </span>
            <span className={e.side === "buy" ? "text-beam-hot font-semibold" : "text-accent font-semibold"}>{e.side.toUpperCase()}</span>
            <span className="text-beam-mid min-w-0">
              <span className="block truncate">{e.side === "buy" ? engineName(e.label) : trimName(e.label)}{e.n > 1 ? ` ×${e.n}` : ""}</span>
              <span className="block md:hidden text-beam-dim text-[10px] mt-0.5">{detail}</span>
            </span>
            <span className="text-right text-beam-mid">{e.account_pct == null ? "n/a" : `${e.account_pct.toFixed(2)}%`}</span>
            <span className={`text-right hidden md:block ${e.side === "sell" && (e.lot_return_pct ?? 0) < 0 ? "text-accent" : "text-beam-mid"}`}>
              {detail}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
