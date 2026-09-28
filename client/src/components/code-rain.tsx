// CodeRain — the engine's own source, writing itself across the tube.
//
// Not matrix rain. Real lines of the fearlab engine (/fearlab/casts/corpus.txt
// — strategy.py and friends, baked to a static asset) type themselves out
// HORIZONTALLY at quiet random positions, hold long enough to be read, then
// fade and respawn elsewhere. The point is legibility: a visitor who looks
// closely reads `wvf`, `floor`, `protect` — the actual code that produced the
// numbers — instead of decorative falling glyphs.
//
// Restraint contract (this sits under THE SIGNAL, it never competes with the
// beam): phosphor hue at low alpha, slow tick, DPR 1, IO + visibility paused,
// and a CSS mask keeps the top and bottom chrome clear.
import { useEffect, useRef } from "react";

const CORPUS_URL = "/fearlab/casts/corpus.txt";
const FONT = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
const CH_W = 7.3; // ~advance of the 12px mono glyph
const ROW_H = 26; // vertical slot pitch — lines never overlap
const TICK_MS = 76; // one glyph per tick per line (staggered by phase)
const HOLD_TICKS = 110; // fully-typed dwell before the fade
const BODY_ALPHA = 0.34;
const HEAD_ALPHA = 0.75;
const RAMP_TICKS = 560; // ~43s (at TICK_MS) to grow from a sparse ignition to a
// full tube — the code keeps taking over more of the hero the longer you watch

type CodeLine = {
  row: number; // slot index (y = row * ROW_H)
  x: number; // left edge px
  src: string;
  at: number; // chars typed so far
  hold: number; // ticks remaining at full text
  alpha: number; // current body alpha (ramps in, fades out)
  fading: boolean;
  phase: number; // tick offset so lines don't type in lockstep
};

function phosColor(alpha: number): string {
  const h = getComputedStyle(document.documentElement).getPropertyValue("--phos-h").trim() || "160";
  return `hsla(${h}, 60%, 62%, ${alpha})`;
}

export function CodeRain({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let corpus: string[] = [];
    let lines: CodeLine[] = [];
    let rowsFree: boolean[] = [];
    let raf = 0;
    let last = 0;
    let acc = 0;
    let running = false;
    let dead = false;
    let hue = "160";

    const size = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width));
      canvas.height = Math.max(1, Math.floor(r.height));
      ctx.font = FONT;
      rowsFree = Array.from({ length: Math.max(1, Math.floor(canvas.height / ROW_H)) }, () => true);
      lines = [];
    };

    const pick = (): string => {
      for (let tries = 0; tries < 10; tries++) {
        const l = corpus[(Math.random() * corpus.length) | 0];
        // want statements a reader can parse, not brace-noise
        if (l && l.trim().length > 14 && l.trim().length < 90) return l.trim();
      }
      return "def fear(bar): return wvf(bar) > floor";
    };

    // how many lines the tube carries at once. Ramps up over the first ~43s so
    // the hero keeps filling with more typed code instead of plateauing sparse.
    const fullCount = () =>
      Math.max(6, Math.min(30, Math.floor((canvas.width * canvas.height) / 48000)));
    const targetCount = () => {
      const ramp = Math.min(1, tick / RAMP_TICKS);
      return Math.max(4, Math.round(fullCount() * (0.4 + 0.6 * ramp)));
    };

    const spawn = (): CodeLine | null => {
      const free: number[] = [];
      for (let i = 0; i < rowsFree.length; i++) if (rowsFree[i]) free.push(i);
      if (!free.length) return null;
      const row = free[(Math.random() * free.length) | 0];
      rowsFree[row] = false;
      const src = pick();
      const maxX = Math.max(8, canvas.width - src.length * CH_W - 8);
      return {
        row,
        x: 8 + Math.random() * maxX,
        src,
        at: 0,
        hold: HOLD_TICKS + ((Math.random() * 60) | 0),
        alpha: BODY_ALPHA,
        fading: false,
        phase: (Math.random() * 3) | 0,
      };
    };

    let tick = 0;
    const step = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = FONT;

      // top up the population
      if (lines.length < targetCount() && Math.random() < 0.35) {
        const l = spawn();
        if (l) lines.push(l);
      }

      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        if ((tick + l.phase) % 2 === 0) {
          if (l.at < l.src.length) l.at += 1;
          else if (l.hold > 0) l.hold -= 1;
          else l.fading = true;
          if (l.fading) l.alpha -= 0.012;
        }
        if (l.alpha <= 0.01) {
          rowsFree[l.row] = true;
          lines.splice(i, 1);
          continue;
        }
        const y = l.row * ROW_H + ROW_H * 0.7;
        const shown = l.src.slice(0, l.at);
        ctx.fillStyle = `hsla(${hue}, 60%, 62%, ${l.alpha})`;
        ctx.fillText(shown, l.x, y);
        // typing head glows a touch hotter
        if (l.at > 0 && l.at < l.src.length && !l.fading) {
          const a = Math.min(HEAD_ALPHA, l.alpha * 2.2);
          ctx.fillStyle = `hsla(${hue}, 70%, 72%, ${a})`;
          ctx.fillText(l.src[l.at - 1], l.x + (l.at - 1) * CH_W, y);
        }
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = t;
      acc += t - last;
      last = t;
      if (acc >= TICK_MS) {
        acc %= TICK_MS;
        step();
      }
    };

    const start = () => {
      if (running || dead || !corpus.length) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    size();
    const onResize = () => size();
    window.addEventListener("resize", onResize);

    // theme retint (phosphor selector swaps --phos-h on <html>)
    const readHue = () => {
      hue = getComputedStyle(document.documentElement).getPropertyValue("--phos-h").trim() || "160";
    };
    readHue();
    const obs = new MutationObserver(readHue);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phosphor"] });

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), {
      threshold: 0,
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    fetch(CORPUS_URL)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((txt) => {
        if (dead) return;
        corpus = txt.split("\n").filter((l) => l.trim().length > 14);
        start();
      })
      .catch(() => {
        /* corpus offline — the tube simply stays clean */
      });

    return () => {
      dead = true;
      stop();
      io.disconnect();
      obs.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block w-full h-full ${className}`}
      style={{
        // a slim fade top and bottom keeps the chrome bands clean, but the
        // stream now runs through most of the hero's height
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 7%, black 93%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 7%, black 93%, transparent 100%)",
      }}
    />
  );
}
