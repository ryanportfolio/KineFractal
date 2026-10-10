// KineFractalLogo — the ring-and-waves mark beside the KINE FRACTAL wordmark.
//
// Intro ("round trip", picked in the logo lab, 2026-10-10): the mark draws, its
// waves stretch into rows and become the letter strokes, the ring is absorbed, a
// beam column sweeps the name, then the crossbars of E, F, A, T and A peel back
// out and rebuild the mark at the left. When the intro ends every animation is
// cancelled, so what stays on screen is the plain static SVG below (theme-aware
// through the beam tokens).
//
// Idle: a faint band passes through the letters every 12 s. Each pass is a
// one-shot animation started by a timer, so nothing animates between passes, and
// a pass is skipped while the tab is hidden or the logo is off-screen.
//
// `play`: "load" runs the intro on the first mount of each page load (the navbar
// remounts on every route, later mounts show the finished mark); "visible" runs it
// the first time the mark scrolls into view (footer).
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { lockup, polyD, resample, topColor, TOP_GRADIENT, type Pt } from "@/lib/kf-logo-geometry";

const RING_TOP = "#06b6d4";
const RING_BOT = "#00ff88";
const IO = "cubic-bezier(0.65,0,0.35,1)";
const EXPO = "cubic-bezier(0.16,1,0.3,1)";
const BAND = 46;
const LOOP_FIRST = 3.6;
const LOOP_EVERY = 12;

let introPlayedThisLoad = false;

const dpath = (pts: Pt[]) => `path("${polyD(pts)}")`;

export function KineFractalLogo({
  size = "nav",
  play = "load",
  className,
}: {
  size?: "nav" | "large";
  play?: "load" | "visible";
  className?: string;
}) {
  const uid = "kfl" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const L = lockup(size === "large");
  const { vb, ring, strokes, waves, sw, wsw, rsw, tx, right } = L;

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const timers: number[] = [];
    const anims: Animation[] = [];
    let cancelled = false;
    let visible = false;
    const later = (s: number, fn: () => void) => timers.push(window.setTimeout(fn, s * 1000));

    const q = <T extends Element>(sel: string) => svg.querySelector(sel) as T;
    const qa = <T extends Element>(sel: string) => Array.from(svg.querySelectorAll(sel)) as T[];
    const band = q<SVGRectElement>(".kfl-band");
    const lead = 0.97 * BAND;

    const loopPass = () => {
      if (cancelled) return;
      if (visible && !document.hidden) band.animate(
        [
          { opacity: 0.6, transform: `translateX(${tx - 2 - lead}px)` },
          { opacity: 0.6, offset: 0.97 },
          { opacity: 0, transform: `translateX(${right + 6}px)` },
        ],
        { duration: 1400, easing: "linear" },
      );
      later(LOOP_EVERY, loopPass);
    };

    // returns the time (s) the last intro animation ends
    const runIntro = (): number => {
      const cs = getComputedStyle(svg);
      const HOT = `hsl(${cs.getPropertyValue("--beam-hot").trim()})`;
      const CORE = `hsl(${cs.getPropertyValue("--beam-core").trim()})`;
      const A = (el: Element, frames: Keyframe[], delay: number, dur: number, easing = EXPO, fill: FillMode = "both") => {
        const a = el.animate(frames, { delay: delay * 1000, duration: dur * 1000, easing, fill });
        anims.push(a);
        return a;
      };
      const ringEl = q<SVGCircleElement>(".kfl-ring");
      const ringG = q<SVGGElement>(".kfl-ringg");
      const col = q<SVGLineElement>(".kfl-col");
      const sweepBand = q<SVGRectElement>(".kfl-sweep");
      const copies = q<SVGGElement>(".kfl-copies");
      const markWaves = qa<SVGPathElement>(".kfl-wave");

      // 1. the mark draws; its wave pieces are the letter strokes, parked inside the ring
      A(ringEl, [{ strokeDasharray: "1 1.02", strokeDashoffset: 1.01 }, { strokeDasharray: "1 1.02", strokeDashoffset: 0 }], 0.05, 0.55, "cubic-bezier(0.3,0.1,0.3,1)");
      for (const w of markWaves) A(w, [{ opacity: 0 }, { opacity: 0 }], 0, 0.01, "linear"); // hidden until rebuilt
      qa<SVGPathElement>(".kfl-stroke").forEach((el, i) => {
        const s = strokes[i];
        const c0 = s.color === "top" ? topColor(s.topT) : HOT;
        A(el, [{ strokeDasharray: "1 1.02", strokeDashoffset: 1.01 }, { strokeDasharray: "1 1.02", strokeDashoffset: 0 }], 0.15 + s.wave * 0.06 + s.order * 0.45, 0.06, "linear");
        // 2. pieces stretch into rows and settle into the letters
        const tm = 0.95 + ((s.x0 - tx) / (right - tx)) * 0.25;
        A(el, [{ d: dpath(s.start) }, { d: dpath(s.row), offset: 0.45 }, { d: dpath(s.pts) }] as Keyframe[], tm, 1.0, IO);
        A(el, [{ stroke: c0, strokeWidth: wsw }, { stroke: CORE, strokeWidth: sw, offset: 0.7 }, { stroke: HOT, strokeWidth: sw }], tm, 1.25, "linear");
      });

      // 3. the ring is absorbed, then waits hidden for the rebuild
      A(ringG, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.2)", opacity: 0 }], 0.95, 0.5, IO);
      A(ringEl, [{ strokeDasharray: "1 1.02", strokeDashoffset: 0 }, { strokeDasharray: "1 1.02", strokeDashoffset: 1.01 }], 1.5, 0.01, "linear", "forwards");
      A(ringG, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1)", opacity: 1 }], 1.6, 0.01, "linear", "forwards");

      // 4. a beam column sweeps the finished name
      A(col, [{ opacity: 1, transform: `translateX(${tx - 2}px)` }, { opacity: 1, offset: 0.92 }, { opacity: 0, transform: `translateX(${right + 4}px)` }], 1.95, 0.9, "linear", "forwards");
      A(sweepBand, [{ opacity: 1, transform: `translateX(${tx - 2 - lead}px)` }, { opacity: 1, offset: 0.85 }, { opacity: 0, transform: `translateX(${right + 4 - lead}px)` }], 1.95, 0.9, "linear", "forwards");

      // 5. the crossbars peel back out and become the mark's waves; the ring redraws
      const t0 = 2.25;
      L.bars.forEach((si, w) => {
        const s = strokes[si];
        const tgt = resample(L.waves[w].pts, s.pts.length);
        const lift = s.pts.map(([x, y]): Pt => [x, y - 6 - w * 0.6]);
        const copy = document.createElementNS("http://www.w3.org/2000/svg", "path");
        copy.setAttribute("d", polyD(s.pts));
        copy.setAttribute("opacity", "0");
        copies.append(copy);
        const t = t0 + w * 0.07;
        const end = w === 0 ? "#fb923c" : HOT;
        A(copy, [
          { opacity: 1, d: dpath(s.pts), stroke: CORE, strokeWidth: sw },
          { d: dpath(lift), offset: 0.3 },
          { opacity: 1, d: dpath(tgt), stroke: end, strokeWidth: wsw, offset: 0.9 },
          { opacity: 0, d: dpath(tgt), stroke: end, strokeWidth: wsw },
        ] as Keyframe[], t, 0.95, IO, "forwards");
        A(markWaves[w], [{ opacity: 0 }, { opacity: 1 }], t + 0.8, 0.25, "linear", "forwards");
      });
      A(ringEl, [{ strokeDasharray: "1 1.02", strokeDashoffset: 1.01 }, { strokeDasharray: "1 1.02", strokeDashoffset: 0 }], t0 + 0.45, 0.6, "cubic-bezier(0.3,0.1,0.3,1)", "forwards");

      // done once the last animation ends: drop them all so the static SVG (and its
      // theme tokens) is what remains
      const end = Math.max(...anims.map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0))) / 1000;
      later(end + 0.05, () => {
        anims.forEach((a) => a.cancel());
        anims.length = 0;
        copies.replaceChildren();
      });
      return end;
    };

    let started = false;
    const start = (intro: boolean) => {
      started = true;
      // claimed at the start, so a route change mid-intro shows the finished logo
      if (intro && play === "load") introPlayedThisLoad = true;
      const end = intro ? runIntro() : 0;
      later(intro ? Math.max(LOOP_FIRST, end + 0.3) : LOOP_EVERY / 2, loopPass);
    };

    // tracks whether the logo is on screen (idle passes skip when it is not); the
    // footer's intro waits until 60% of it is in view
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        visible = e.isIntersecting;
        if (!started && play === "visible" && e.intersectionRatio >= 0.6) start(true);
      },
      { threshold: [0, 0.6] },
    );
    io.observe(svg);
    if (play === "load") start(!introPlayedThisLoad);

    return () => {
      cancelled = true;
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      anims.forEach((a) => a.cancel());
    };
  }, [play, L, tx, right, sw, wsw, strokes]);

  const textStrokes = strokes.map((s, i) => <path key={i} d={s.d} />);
  return (
    <svg
      ref={svgRef}
      viewBox={vb.join(" ")}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <filter id={`${uid}g`} filterUnits="userSpaceOnUse" x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={size === "large" ? 1.1 : 0.9} result="b" />
          <feComponentTransfer in="b" result="g"><feFuncA type="linear" slope="0.75" /></feComponentTransfer>
          <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`${uid}rg`} gradientUnits="userSpaceOnUse" x1="0" y1={L.my} x2="0" y2={L.my + L.D}>
          <stop offset="0" stopColor={RING_TOP} />
          <stop offset="1" stopColor={RING_BOT} />
        </linearGradient>
        <linearGradient id={`${uid}tg`} gradientUnits="userSpaceOnUse" x1={waves[0].pts[0][0]} y1="0" x2={waves[0].pts[waves[0].pts.length - 1][0]} y2="0">
          {TOP_GRADIENT.map((c, i) => <stop key={c} offset={i / (TOP_GRADIENT.length - 1)} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`${uid}bd`} x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "hsl(var(--beam-core))", stopOpacity: 0 }} />
          <stop offset=".8" style={{ stopColor: "hsl(var(--beam-core))", stopOpacity: 0.55 }} />
          <stop offset=".97" style={{ stopColor: "hsl(var(--beam-core))", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "hsl(var(--beam-core))", stopOpacity: 0 }} />
        </linearGradient>
        <mask id={`${uid}mk`} maskUnits="userSpaceOnUse" x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]}>
          <g fill="none" stroke="#fff" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{textStrokes}</g>
        </mask>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g className="kfl-ringg" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <circle className="kfl-ring" cx={ring.cx} cy={ring.cy} r={ring.r} stroke={`url(#${uid}rg)`} strokeWidth={rsw} pathLength={1} filter={`url(#${uid}g)`} />
        </g>
        <g filter={`url(#${uid}g)`} strokeWidth={wsw}>
          {waves.map((w, i) => (
            <path key={i} className="kfl-wave" d={w.d} style={{ stroke: w.top ? `url(#${uid}tg)` : "hsl(var(--beam-hot))" }} />
          ))}
        </g>
        <g filter={`url(#${uid}g)`}>
          {strokes.map((s, i) => (
            <path key={i} className="kfl-stroke" d={s.d} pathLength={1} style={{ stroke: "hsl(var(--beam-hot))", strokeWidth: sw }} />
          ))}
        </g>
        <g className="kfl-copies" filter={`url(#${uid}g)`} />
        <g mask={`url(#${uid}mk)`} filter={`url(#${uid}g)`}>
          <rect className="kfl-sweep" x="0" y="-4" width={BAND} height="28" fill={`url(#${uid}bd)`} opacity="0" />
          <rect className="kfl-band" x="0" y="-4" width={BAND} height="28" fill={`url(#${uid}bd)`} opacity="0" />
        </g>
        <line className="kfl-col" x1="0" x2="0" y1="-3.5" y2="23.5" strokeWidth={sw * 0.5} opacity="0" style={{ stroke: "hsl(var(--beam-core))" }} />
      </g>
    </svg>
  );
}

