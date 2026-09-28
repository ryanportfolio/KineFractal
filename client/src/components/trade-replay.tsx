// TradeReplay — 33 years of the real SPY v3.8 backtest replayed as cinema.
// Data = the same baked cast the hero uses (/fearlab/casts/spy-1d-v3.8.json):
// downsampled equity curve [t, strat, bench] (growth of $1k) + the full
// closed-trade ledger [e_ts, x_ts, eng, tag, entry, exit, pct, pnl].
// Canvas draws the curve up to the time cursor; fills fire as win/loss dots.
// Honest by construction: REPLAY-labeled, nothing simulated at runtime.
import { useEffect, useRef, useState } from "react";
import { engineName, trimName } from "@/data/lab-data";

const CAST_URL = "/fearlab/casts/spy-1d-v3.8.json";
const BENCH = "#7f8aa0";
const BASE_SECS = 60; // full 33-year run
const END_HOLD_MS = 5000; // hold the finished curve before looping

interface Cast {
  meta: { sym: string; tf: string; variant: string; start: string; end: string; generated: string };
  metrics: { trades: number; irr: number; bench_irr: number; board_edge: number; max_dd: number; win_rate: number; final_equity: number };
  fills: [number, number, string, string, number, number, number, number][];
  equity: [number, number, number][];
}

const day = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
const pct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}k` : `$${v.toFixed(0)}`);

export function TradeReplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [cast, setCast] = useState<Cast | null>(null);
  const [failed, setFailed] = useState(false);
  // refs so the rAF loop never re-subscribes — the replay is ambient: no
  // controls, it runs while in view, holds the end frame, then loops.
  const progRef = useRef(0);
  const playRef = useRef(false);

  useEffect(() => {
    let live = true;
    fetch(CAST_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((c: Cast) => { if (live) setCast(c); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  // run only while in view; pause offscreen
  useEffect(() => {
    if (!cast) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { playRef.current = entries.some((e) => e.isIntersecting); },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cast]);

  // main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !cast) return;

    const eq = cast.equity;
    const fills = cast.fills;
    const t0 = eq[0][0], t1 = eq[eq.length - 1][0], tSpan = t1 - t0 || 1;
    // log y — 33y compounding is unreadable linear
    let vMin = Infinity, vMax = -Infinity;
    for (const [, s, b] of eq) { vMin = Math.min(vMin, s, b); vMax = Math.max(vMax, s, b); }
    const ly = (v: number) => Math.log10(Math.max(v, 1));
    const yLo = ly(vMin), ySpan = ly(vMax) - yLo || 1;

    let W = 0, H = 0, dpr = 1;
    let xs: number[] = [], ysS: number[] = [], ysB: number[] = [];
    const PAD = { t: 16, r: 12, b: 26, l: 12 };
    const project = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth; H = wrap.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      const px = (t: number) => PAD.l + ((t - t0) / tSpan) * (W - PAD.l - PAD.r);
      const py = (v: number) => PAD.t + (1 - (ly(v) - yLo) / ySpan) * (H - PAD.t - PAD.b);
      xs = eq.map((p) => px(p[0]));
      ysS = eq.map((p) => py(p[1]));
      ysB = eq.map((p) => py(p[2]));
    };
    project();

    const ctx = canvas.getContext("2d")!;
    // theme colors re-read on [data-phosphor] swaps so the canvas recolors live
    let prim = "", primWin = "", primHead = "";
    const readPhosphor = () => {
      const p = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      prim = `hsl(${p})`;
      primWin = `hsl(${p} / 0.7)`;
      primHead = `hsl(${p} / 0.35)`;
    };
    readPhosphor();

    // index of the last equity point at or before time T (binary search)
    const idxAt = (T: number) => {
      let lo = 0, hi = eq.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (eq[m][0] <= T) lo = m; else hi = m - 1; }
      return lo;
    };

    let lastFillShown = -1;
    const draw = () => {
      const p = progRef.current;
      const T = t0 + p * tSpan;
      const n = idxAt(T);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // year grid, decade emphasis
      ctx.textBaseline = "top";
      ctx.font = "10px 'JetBrains Mono', monospace";
      const y0 = new Date(t0 * 1000).getUTCFullYear() + 1;
      const y1 = new Date(t1 * 1000).getUTCFullYear();
      for (let y = y0; y <= y1; y++) {
        const ts = Date.UTC(y, 0, 1) / 1000;
        const x = PAD.l + ((ts - t0) / tSpan) * (W - PAD.l - PAD.r);
        const major = y % 5 === 0;
        if (!major && W < 720) continue;
        ctx.strokeStyle = major ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)";
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke();
        if (major) { ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fillText(String(y), x - 12, H - PAD.b + 8); }
      }

      // bench then strategy, drawn up to the cursor
      const line = (ys: number[], color: string, width: number, glow: number, dash?: number[]) => {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) (i ? ctx.lineTo(xs[i], ys[i]) : ctx.moveTo(xs[i], ys[i]));
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.setLineDash(dash ?? []);
        ctx.shadowColor = glow ? color : "transparent"; ctx.shadowBlur = glow;
        ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;
      };
      line(ysB, BENCH, 1.2, 0, [5, 4]);
      line(ysS, prim, 2, 8);

      // fills fired so far: exit dots on the strategy curve
      let latest = -1;
      ctx.shadowBlur = 0;
      for (let f = 0; f < fills.length; f++) {
        const xt = fills[f][1];
        if (xt > T) break;
        latest = f;
        const i = idxAt(xt);
        const win = fills[f][6] >= 0;
        ctx.fillStyle = win ? primWin : "rgba(255,90,90,0.75)";
        ctx.fillRect(xs[i] - 1.5, ysS[i] - 1.5, 3, 3);
      }

      // playhead
      const hx = xs[n];
      ctx.strokeStyle = primHead;
      ctx.beginPath(); ctx.moveTo(hx, PAD.t); ctx.lineTo(hx, H - PAD.b); ctx.stroke();
      ctx.fillStyle = prim;
      ctx.beginPath(); ctx.arc(hx, ysS[n], 3, 0, Math.PI * 2); ctx.fill();

      // HUD via direct DOM writes — no React churn at 60fps
      if (hudRef.current) {
        const [ts, s, b] = eq[n];
        // both lines carry the same deposits — the dollar gap IS the edge
        const gap = s - b;
        hudRef.current.innerHTML =
          `<span class="trp-d">${day(ts)}</span>` +
          `<span>strategy <b class="trp-g">${money(s)}</b></span>` +
          `<span>hold <b style="color:${BENCH}">${money(b)}</b></span>` +
          `<span>ahead <b class="${gap >= 0 ? "trp-g" : "trp-down"}">${gap >= 0 ? "+" : "-"}${money(Math.abs(gap))}</b></span>` +
          `<span>trades <b class="trp-g">${latest + 1}</b></span>`;
      }
      if (fillRef.current && latest >= 0 && latest !== lastFillShown) {
        lastFillShown = latest;
        const f = fills[latest];
        const win = f[6] >= 0;
        fillRef.current.innerHTML =
          `<span class="trp-dim">EXIT ${day(f[1])}</span> ` +
          `<span>${engineName(f[2])} → ${trimName(f[3])}</span> ` +
          `<span class="${win ? "trp-up" : "trp-down"}">${win ? "▲" : "▼"} ${pct(f[6], 1)}</span>`;
      }
    };

    draw(); // paint the first frame now — rAF is frozen in hidden/background tabs
    const ro = new ResizeObserver(() => { project(); draw(); });
    ro.observe(wrap);
    const themeObs = new MutationObserver(() => { readPhosphor(); draw(); });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phosphor"] });

    let raf = 0, prev = 0, holdUntil = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = prev ? (now - prev) / 1000 : 0;
      prev = now;
      if (playRef.current && now >= holdUntil) {
        if (progRef.current >= 1) progRef.current = 0; // loop after the end-hold
        progRef.current = Math.min(1, progRef.current + dt / BASE_SECS);
        if (progRef.current >= 1) holdUntil = now + END_HOLD_MS; // let the end state breathe
      }
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); themeObs.disconnect(); };
  }, [cast]);

  if (failed) {
    return (
      <div className="terminal-container p-6 font-mono text-xs text-muted-foreground">
        <span className="text-[hsl(0_100%_60%)]">&gt;</span> replay feed offline
      </div>
    );
  }

  return (
    <div className="terminal-container p-4 md:p-6">
      <style>{TRP_CSS}</style>
      <div className="relative z-[2]">
        <div ref={hudRef} className="trp-hud flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground min-h-[18px] tabular-nums" />
        <div ref={wrapRef} className="relative w-full h-[300px] md:h-[380px] mt-3">
          <canvas ref={canvasRef} className="absolute inset-0" aria-label="Replay of the SPY strategy vs buy and hold since 1993" role="img" />
          {!cast && (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted-foreground">
              <span className="text-primary">&gt;</span>&nbsp;loading replay
              <span className="inline-block w-[7px] h-[14px] bg-primary align-middle ml-1 animate-pulse" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <div ref={fillRef} className="font-mono text-[12px] min-h-[18px]" />
          <span className="font-mono text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
            replay · real fills · {cast?.meta.generated ?? ""}
          </span>
        </div>
      </div>
    </div>
  );
}

const TRP_CSS = `
.trp-hud .trp-d{color:hsl(var(--foreground));}
.trp-hud b{font-weight:700;}
.trp-g{color:hsl(var(--primary));text-shadow:0 0 8px hsl(var(--primary)/0.45);}
.trp-dim{color:hsl(var(--muted-foreground));}
.trp-up{color:hsl(var(--primary));text-shadow:0 0 8px hsl(var(--primary)/0.5);}
.trp-down{color:#ff5a5a;text-shadow:0 0 8px rgba(255,90,90,.45);}
`;
