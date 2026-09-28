// RealTerminal — the kinefractal hero's living backdrop.
//
// Not a boxed widget: a full-bleed, ambient stream of the ACTUAL fearlab engine
// source (thousands of real lines — strategy.py, the vnext tools, …) drifting
// slowly behind the headline as texture, with the REAL v3.8 backtest result
// (941 trades since 1993, IRR/edge/win/equity + real closed trades) floating
// crisp on top as the "live edge." Everything is baked into static assets by
// scripts/emit_cast.py — nothing executes at request time. Honest by
// construction: real code, real numbers, labeled REPLAY, never fabricated.
//
//   /fearlab/casts/corpus.txt        real engine source (the drifting backdrop)
//   /fearlab/casts/spy-1d-v3.8.json  real v3.8 metrics + closed-trade ledger
import { useEffect, useRef } from "react";

const CAST_URL = "/fearlab/casts/spy-1d-v3.8.json";
const CORPUS_URL = "/fearlab/casts/corpus.txt";

interface Cast {
  meta: { variant: string; start: string; end: string; generated: string };
  metrics: { trades: number; irr: number; bench_irr: number; board_edge: number; max_dd: number; profit_factor: number; win_rate: number; final_equity: number };
  fills: [number, number, string, string, number, number, number, number][];
}

const KW = /\b(import|from|def|return|if|elif|else|for|in|not|and|or|None|True|False|while|with|as|lambda|class|try|except|finally|raise|continue|break|pass|global|nonlocal|yield|is|assert|del)\b/g;

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Lightweight, line-based Python highlighter -> HTML (one <pre> blob, inline
// token spans only, so the DOM stays light even at thousands of lines).
function highlightPy(code: string): string {
  const lines = code.split("\n");
  const out: string[] = [];
  let doc = false;
  for (const raw of lines) {
    let s = esc(raw);
    const triples = (raw.match(/"""/g) || []).length;
    if (doc) { out.push(`<i class="cd">${s}</i>`); if (triples % 2 === 1) doc = false; continue; }
    if (triples >= 2) { out.push(`<i class="cd">${s}</i>`); continue; }
    if (triples === 1) { doc = true; out.push(`<i class="cd">${s}</i>`); continue; }
    let comment = "";
    const h = s.indexOf("#");
    if (h >= 0) { comment = `<i class="cc">${s.slice(h)}</i>`; s = s.slice(0, h); }
    s = s.replace(KW, (m) => `<i class="ck">${m}</i>`);
    s = s.replace(/\b(\d[\d.]*)\b/g, (m) => `<i class="cn">${m}</i>`);
    out.push(s + comment);
  }
  return out.join("\n");
}

function fmtMoney(n: number) {
  const a = Math.abs(n), s = n < 0 ? "-$" : "$";
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(0)}k`;
  return `${s}${a.toFixed(0)}`;
}
const pct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const day = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

function renderEdge(el: HTMLDivElement, c: Cast, dead: () => boolean): number | undefined {
  const m = c.metrics;
  el.innerHTML =
    `<div class="rt-cmd">$ py vnext/scan.py SPY 1d</div>` +
    `<div class="rt-big">${m.trades} TRADES <span class="rt-since">· SINCE ${c.meta.start}</span></div>` +
    `<div class="rt-row">IRR <b>${pct(m.irr, 2)}</b> <span>vs ${pct(m.bench_irr, 2)} S&amp;P</span></div>` +
    `<div class="rt-row">EDGE <b>+${m.board_edge.toFixed(0)}pp</b> · WIN <b>${m.win_rate}%</b> · PF <b>${m.profit_factor}</b></div>` +
    `<div class="rt-row">MAXDD <b>${m.max_dd}%</b> · equity <b>${fmtMoney(m.final_equity)}</b></div>` +
    `<div class="rt-fill" id="rtfill"></div>` +
    `<div class="rt-tag">REPLAY · real ${c.meta.variant} · data ${c.meta.generated}<span class="rt-cur">▍</span></div>`;
  const fillEl = el.querySelector<HTMLDivElement>("#rtfill");
  const fills = c.fills || [];
  let i = 0;
  const show = () => {
    if (!fillEl || !fills.length) return;
    const f = fills[i % fills.length];
    const win = f[6] >= 0;
    fillEl.innerHTML =
      `<span class="rt-fd">EXIT ${day(f[1])}</span> ` +
      `<span class="rt-fe">${f[2]}</span> ` +
      `<span class="${win ? "rt-up" : "rt-down"}">${win ? "▲" : "▼"} ${pct(f[6], 2)}</span>`;
  };
  show();
  return window.setInterval(() => {
    if (dead()) return;
    i += 1 + Math.floor(Math.random() * 9); // stride through 33 years of trades
    show();
  }, 2000);
}

export default function RealTerminal() {
  const codeRef = useRef<HTMLDivElement | null>(null);
  const edgeRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // (The old backdrop-filter pointer spotlight is gone: filtering over the
  // animating WebGL hero janked on every hover. The FearField shader carries
  // the pointer glow now, smoothed in-shader.)

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    (async () => {
      let cast: Cast | null = null, corpus = "";
      try {
        const [cr, tr] = await Promise.all([fetch(CAST_URL), fetch(CORPUS_URL)]);
        if (cr.ok) cast = (await cr.json()) as Cast;
        if (tr.ok) corpus = await tr.text();
      } catch { /* assets offline -> backdrop stays empty, page still fine */ }
      if (disposed) return;

      if (codeRef.current && corpus) {
        // a full-width WALL of code: split the corpus into columns so the whole
        // hero fills with real source (Python lines are short + left-aligned, so
        // one block would only cover the left third). Each column drifts upward
        // at its own pace; content is doubled so the loop is seamless.
        const COLS = 4;
        const SPEED = 34;          // px/s
        const LH = 12 * 1.5;       // font-size * line-height — keep in sync with CSS
        const all = corpus.split("\n");
        const per = Math.ceil(all.length / COLS);
        let html = "";
        for (let k = 0; k < COLS; k++) {
          const hl = highlightPy(all.slice(k * per, (k + 1) * per).join("\n"));
          const dur = Math.round((per * LH / SPEED) * (1 + k * 0.07)); // varied per column
          html += `<div class="rt-col"><div class="rt-colinner" style="animation-duration:${dur}s">${hl}\n${hl}</div></div>`;
        }
        codeRef.current.innerHTML = html;
      }
      if (edgeRef.current && cast) timer = renderEdge(edgeRef.current, cast, () => disposed);
    })();

    return () => { disposed = true; if (timer) window.clearInterval(timer); };
  }, []);

  return (
    <div className="rt-root" aria-hidden="true" ref={rootRef}>
      <style>{RT_CSS}</style>
      <div className="rt-bg"><div className="rt-code" ref={codeRef} /></div>
      <div className="rt-edge" ref={edgeRef} />
    </div>
  );
}

/* All color comes from the phosphor tokens (index.css) so theme swaps recolor
   the code wall, the HUD and the cursor together with the rest of the tube. */
const RT_CSS = `
.rt-root{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.rt-bg{position:absolute;inset:0;opacity:.26;
 -webkit-mask-image:linear-gradient(to bottom,transparent,#000 7%,#000 92%,transparent);
 mask-image:linear-gradient(to bottom,transparent,#000 7%,#000 92%,transparent);}
.rt-code{position:absolute;inset:0;display:flex;gap:2vw;padding:0 1vw;}
.rt-col{position:relative;flex:1 1 0;overflow:hidden;}
.rt-colinner{position:absolute;top:0;left:0;will-change:transform;white-space:pre;
 font-family:'JetBrains Mono','IBM Plex Mono',monospace;font-size:12px;line-height:1.5;
 color:hsl(var(--primary));text-shadow:0 0 6px hsl(var(--primary) / .4);
 animation:rt-drift 2500s linear infinite;}
@keyframes rt-drift{from{transform:translateY(0)}to{transform:translateY(-50%)}}
.rt-bg .ck{color:hsl(var(--accent) / .9);}
.rt-bg .cc{color:hsl(var(--primary) / .3);}
.rt-bg .cd{color:hsl(var(--primary) / .28);}
.rt-bg .cn{color:hsl(var(--phos-h) 80% 72%);}
.rt-edge{position:absolute;right:4.5%;top:50%;transform:translateY(-50%);max-width:42ch;text-align:right;
 font-family:'JetBrains Mono','IBM Plex Mono',monospace;color:hsl(var(--tube-h) 14% 86%);
 padding:1.1em 1.2em;background:radial-gradient(ellipse at 75% 50%,hsl(var(--tube-h) 40% 2% / .82) 0%,hsl(var(--tube-h) 40% 2% / .55) 55%,transparent 82%);}
.rt-cmd{font-size:12px;color:hsl(var(--tube-h) 8% 42%);margin-bottom:.7em;letter-spacing:.02em;}
.rt-big{font-size:clamp(15px,1.9vw,20px);font-weight:800;color:hsl(var(--primary));letter-spacing:.03em;
 text-shadow:0 0 18px hsl(var(--primary) / .65);margin-bottom:.55em;}
.rt-big .rt-since{font-weight:500;font-size:.62em;color:hsl(var(--tube-h) 10% 66%);text-shadow:none;}
.rt-row{font-size:13px;color:hsl(var(--tube-h) 9% 58%);margin:.22em 0;letter-spacing:.01em;}
.rt-row b{color:hsl(var(--primary));font-weight:700;text-shadow:0 0 10px hsl(var(--primary) / .5);}
.rt-fill{font-size:13px;margin-top:.8em;min-height:1.5em;}
.rt-fd{color:hsl(var(--tube-h) 8% 42%);}.rt-fe{color:hsl(var(--tube-h) 14% 86%);}
.rt-up{color:hsl(var(--primary));text-shadow:0 0 8px hsl(var(--primary) / .5);}
.rt-down{color:hsl(0 100% 67%);text-shadow:0 0 8px hsl(0 100% 67% / .45);}
.rt-tag{margin-top:1em;font-size:11px;color:hsl(var(--tube-h) 8% 38%);letter-spacing:.14em;}
.rt-cur{display:inline-block;margin-left:2px;color:hsl(var(--primary));animation:rt-blink 1.1s steps(1) infinite;}
@keyframes rt-blink{50%{opacity:0;}}
@media (max-width:1023px){.rt-bg{opacity:.06;}.rt-edge{display:none;}}
`;
