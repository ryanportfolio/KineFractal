// AboutStory — the About page's scroll film.
//
// A tall section pins one full-screen canvas; scrolling drives the story's
// progress 0..1 (eased, so a flick glides instead of jumping). The WebGL
// scene (story-scene.ts) draws the beam, and this component owns the DOM
// layers on top: captions per beat, labels projected from 3D anchors, the
// 2020 readout and a timebase bar. Captions are real text in reading order,
// so the story still reads without WebGL.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { DEPLOY } from "@/data/fearlab-board";
import { fetchBoardCached, fetchReportCached } from "@/data/lab-data";
import { BEATS, buildStory, clamp01, episodeClock, windowAlpha, type Episode, type StoryData } from "@/lib/about-story-model";
import { buildGeometry, drawStory, type Label, type Palette } from "./story-scene";
import { StoryRenderer, hslTriplet } from "./story-renderer";

const SCROLL_VH = 1100;
const EPISODE_URL = "/fearlab/episodes/spy-2020.json";

interface Caption {
  key: string;
  a: number;
  b: number;
  eyebrow?: string;
  body: ReactNode;
  stamp?: string;
}

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function buildCaptions(d: StoryData): Caption[] {
  const clock = episodeClock(d.episode.days.length, d.episode.events.map((e) => e.i));
  const marks = d.canyonMarks.map((m) => m.label).join(", ");
  const epStamp = `SPY ${d.episode.variant} backtest · simulated next-open fills`;

  const caps: Caption[] = [
    {
      key: "open",
      a: -1,
      b: 0.05,
      eyebrow: "FearLab · Kine Fractal",
      body: <span className="text-beam-hot">buys fear in SPY, QQQ and IWM → trims into strength</span>,
      stamp: "scroll to play ↓",
    },
    {
      key: "high",
      a: 0.075,
      b: 0.135,
      body: "The flat line is SPY at its all-time high. Every dip below it is a fall from a previous high, measured in percent.",
      stamp: `buy-and-hold SPY · drop from prior high · monthly · ${d.canyonRange}`,
    },
    {
      key: "fear",
      a: 0.14,
      b: 0.2,
      body: "Falls bring fear. After every close the engine takes a fear reading, and when fear runs high it buys, sized to how high it runs.",
    },
    {
      key: "canyons",
      a: 0.205,
      b: 0.258,
      body: `The deepest canyons: ${marks}. Each one so far has climbed back to a new high. The engine is built to be buying while they are deep.`,
    },
    {
      key: "zoom",
      a: 0.285,
      b: 0.34,
      eyebrow: "Zoom in · 2020",
      body: "The bright line is SPY's daily close. The columns beneath it are the engine's fear reading, from 0 to 100.",
      stamp: epStamp,
    },
  ];

  const evP = d.episode.events.map((e) => clock.progressAt(e.i - 0.6));
  const firstEv = evP[0] ?? 0.37;
  caps.push({
    key: "marks",
    a: 0.345,
    b: Math.min(firstEv - 0.004, 0.345 + 0.03),
    body: "Buys drop in as bright points. Sells rise off as amber sparks. A bigger mark moved a bigger share of the account.",
    stamp: epStamp,
  });
  d.episode.events.forEach((e, k) => {
    const a = evP[k];
    const next = evP[k + 1] ?? clock.progressAt(e.i + 26);
    caps.push({
      key: `ev${k}`,
      a,
      b: next - 0.004,
      eyebrow: shortDate(d.episode.days[e.i].d),
      body: e.text,
      stamp: epStamp,
    });
  });
  const lastEv = d.episode.events.at(-1);
  caps.push({
    key: "ep-rest",
    a: lastEv ? clock.progressAt(lastEv.i + 26) : 0.5,
    b: BEATS.episode[1] - 0.004,
    body: "Every mark on this chart is a simulated fill from the backtest, placed at the next day's opening price. None of it was a broker order.",
    stamp: epStamp,
  });

  caps.push(
    {
      key: "cohorts",
      a: 0.665,
      b: 0.715,
      eyebrow: "Start any year",
      body: `Now start in any year from ${d.cohorts[0]?.year ?? ""} on. All cash on day one, no deposits, held to the latest close.`,
      stamp: `SPY daily · start-year cohorts · ${d.cohortPreset} · simulated · through ${d.cohortEnd}`,
    },
    {
      key: "cohorts-result",
      a: 0.72,
      b: 0.772,
      body: `Bright columns are the strategy. Dim columns behind them are buy-and-hold over the same dates. The strategy finishes ahead in ${d.cohortsAhead} of ${d.cohorts.length} start years.`,
      stamp: "log height · simulated",
    },
    {
      key: "years",
      a: 0.8,
      b: 0.85,
      eyebrow: "Year by year",
      body: "Single calendar years are rougher. Each year restarts all cash, gives both sides the same starting capital and dates, and ends at year-end.",
      stamp: `independent calendar years · ${d.firstYear} to ${d.lastYear} · simulated`,
    },
    {
      key: "years-result",
      a: 0.853,
      b: 0.9,
      body: `A lit square is a year the strategy finished ahead of buy-and-hold. A dark one is a year it fell behind. Every year stays on the record; the unfinished ${d.lastYear} is drawn faint and left out of the count.`,
      stamp: d.funds.map((f) => `${f.sym} ${f.ahead}/${f.total}`).join(" · ") + " completed years ahead",
    },
    {
      key: "close",
      a: 0.93,
      b: 2,
      eyebrow: "Every close",
      body: (
        <>
          <span className="block">
            After each market close the engine re-reads the full price history and publishes one decision per fund.
            This site shows it. It never places an order.
          </span>
          <span className="mt-5 flex flex-wrap gap-x-6 gap-y-2 pointer-events-auto">
            <Link href="/" className="text-beam-hot underline underline-offset-4">latest decision →</Link>
            <Link href="/lab" className="text-beam-hot underline underline-offset-4">backtest reports →</Link>
            <a href="/charts/" className="text-beam-hot underline underline-offset-4">charts →</a>
          </span>
        </>
      ),
      stamp: "buys fear in SPY, QQQ and IWM → trims into strength",
    },
  );
  return caps;
}

// ---- projected labels ------------------------------------------------------------------
class LabelLayer {
  private els = new Map<string, HTMLDivElement>();
  constructor(private host: HTMLDivElement) {}
  update(labels: Label[], project: (p: Label["pos"]) => { x: number; y: number } | null) {
    const seen = new Set<string>();
    for (const l of labels) {
      if (l.alpha <= 0.01) continue;
      const s = project(l.pos);
      if (!s) continue;
      seen.add(l.key);
      let el = this.els.get(l.key);
      if (!el) {
        el = document.createElement("div");
        el.className = "etched absolute left-0 top-0 whitespace-nowrap will-change-transform";
        this.host.appendChild(el);
        this.els.set(l.key, el);
      }
      if (el.textContent !== l.text) el.textContent = l.text;
      const tone = l.tone === "amber" ? "hsl(var(--accent))" : l.tone === "hot" ? "hsl(var(--beam-hot))" : "hsl(var(--beam-dim))";
      el.style.color = tone;
      const off = l.anchor === "above" ? "translate(-50%, calc(-100% - 6px))"
        : l.anchor === "aboveStart" ? "translate(0, calc(-100% - 6px))"
        : l.anchor === "left" ? "translate(calc(-100% - 12px), -50%)"
        : l.anchor === "right" ? "translate(12px, -50%)"
        : "translate(-50%, 8px)";
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) ${off}`;
      el.style.opacity = l.alpha.toFixed(3);
      el.style.display = "";
    }
    this.els.forEach((el, k) => { if (!seen.has(k)) el.style.display = "none"; });
  }
}

function readPalette(): { pal: Palette; bg: [number, number, number] } {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: [number, number, number]) => hslTriplet(cs.getPropertyValue(name), fb);
  return {
    pal: {
      core: v("--beam-core", [0.9, 1, 0.95]),
      hot: v("--beam-hot", [0.3, 1, 0.6]),
      mid: v("--beam-mid", [0.1, 0.8, 0.45]),
      dim: v("--beam-dim", [0.2, 0.55, 0.4]),
      ghost: v("--beam-ghost", [0.08, 0.18, 0.13]),
      amber: v("--accent", [1, 0.6, 0]),
    },
    bg: v("--background", [0.02, 0.04, 0.035]),
  };
}

export function AboutStory() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [data, setData] = useState<StoryData | null>(null);
  const [failed, setFailed] = useState(false);
  const [noGl, setNoGl] = useState(false);

  useEffect(() => {
    let live = true;
    const key = (sym: string) => DEPLOY.find((f) => f.sym === sym)?.reportKey ?? `${sym.toLowerCase()}-1d-full`;
    Promise.all([
      fetchReportCached(key("SPY")),
      fetchReportCached(key("QQQ")),
      fetchReportCached(key("IWM")),
      fetchBoardCached(),
      fetch(EPISODE_URL).then((r) => (r.ok ? (r.json() as Promise<Episode>) : Promise.reject(new Error("episode")))),
    ])
      .then(([spy, qqq, iwm, board, ep]) => { if (live) setData(buildStory({ spy, qqq, iwm }, board, ep)); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  const captions = useMemo(() => (data ? buildCaptions(data) : []), [data]);

  useEffect(() => {
    const section = sectionRef.current, canvas = canvasRef.current, labelHost = labelsRef.current;
    if (!data || !section || !canvas || !labelHost) return;

    const renderer = new StoryRenderer(canvas);
    if (!renderer.ok) setNoGl(true);
    const geo = buildGeometry(data);
    const layer = new LabelLayer(labelHost);
    let { pal, bg } = readPalette();
    renderer.bg = bg;
    const themeObs = new MutationObserver(() => { ({ pal, bg } = readPalette()); renderer.bg = bg; });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phosphor"] });

    let target = 0, shown = 0;
    const measure = () => {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = total > 0 ? clamp01(-rect.top / total) : 0;
    };
    measure();
    shown = target;

    let inView = false, raf = 0, last = performance.now();
    const t0 = last;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.1, (now - last) / 1000);
      const ms = now - last;
      last = now;
      shown += (target - shown) * (1 - Math.exp(-dt * 6));
      if (Math.abs(target - shown) < 1e-5) shown = target;
      const p = shown, time = (now - t0) / 1000;

      if (renderer.ok) {
        renderer.resize();
        const out = drawStory(renderer, data, geo, pal, p, time);
        renderer.end(time, out.flash);
        renderer.reportFrame(ms);
        layer.update(out.labels, (pos) => renderer.project(pos));
        const hud = hudRef.current;
        if (hud) {
          hud.style.opacity = out.hud ? "1" : "0";
          if (out.hud) {
            const txt = `${out.hud.date} · SPY close ${out.hud.close} · fear ${out.hud.fear}`;
            if (hud.textContent !== txt) hud.textContent = txt;
          }
        }
      }
      captions.forEach((c, i) => {
        const el = capRefs.current[i];
        if (!el) return;
        const a = windowAlpha(p, c.a, c.b, 0.008);
        el.style.opacity = a.toFixed(3);
        el.style.transform = `translateY(${((1 - a) * 10).toFixed(1)}px)`;
        el.style.visibility = a > 0 ? "visible" : "hidden";
      });
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      if (inView && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && inView && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; kick(); }, { rootMargin: "100px 0px" });
    io.observe(section);
    const onScroll = () => { measure(); kick(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("visibilitychange", kick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      themeObs.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", kick);
      renderer.destroy();
      labelHost.replaceChildren();
    };
  }, [data, captions]);

  return (
    <section ref={sectionRef} aria-label="How FearLab works, as a scrolling story" className="relative" style={{ height: `calc(${SCROLL_VH}vh / var(--pz))` }}>
      {/* viewport units divide out the desktop CSS zoom (--pz, index.css) */}
      <div className="sticky top-0 w-full overflow-hidden" style={{ height: "calc(100vh / var(--pz))" }}>
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" style={{ visibility: noGl ? "hidden" : "visible" }} />
        <div ref={labelsRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-background via-background/70 to-transparent" />

        <div ref={hudRef} aria-hidden="true" className="etched pointer-events-none absolute right-5 top-20 text-beam-mid opacity-0 transition-opacity duration-300 tabular-nums md:right-[6vw] md:top-auto md:bottom-[calc(9vh/var(--pz))]" />

        {!data && (
          <div className="etched absolute inset-0 flex items-center justify-center text-beam-dim">
            {failed ? "engine files unreachable · the story needs the bundled report data" : "reading engine files…"}
          </div>
        )}
        {noGl && data && (
          <div className="etched absolute left-5 top-24 text-beam-dim md:left-10">WebGL2 unavailable · captions only</div>
        )}

        <div className="pointer-events-none absolute left-5 right-5 md:left-[6vw] md:right-auto md:w-[min(46ch,48vw)]" style={{ bottom: "calc(9vh / var(--pz))" }}>
          {captions.map((c, i) => (
            <div
              key={c.key}
              ref={(el) => { capRefs.current[i] = el; }}
              className="absolute bottom-0 left-0 right-0"
              style={{ opacity: 0, visibility: "hidden" }}
            >
              {c.eyebrow && <div className="etched mb-2 text-beam-dim">{c.eyebrow}</div>}
              <p className="font-mono text-[15px] leading-relaxed text-beam-mid md:text-[17px] [text-shadow:0_0_18px_hsl(var(--background))]">
                {c.body}
              </p>
              {c.stamp && <div className="etched mt-3 text-beam-dim">{c.stamp}</div>}
            </div>
          ))}
        </div>

        <div aria-hidden="true" className="absolute left-5 right-5 h-px bg-[hsl(var(--beam-ghost))] md:left-[6vw] md:right-[6vw]" style={{ bottom: "calc(4vh / var(--pz))" }}>
          <div ref={barRef} className="h-px origin-left bg-[hsl(var(--beam-hot))]" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}
