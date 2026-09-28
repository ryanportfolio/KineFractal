// FearField — the hero's WebGL2 phosphor field.
//
// The strategy's core mechanic, made visible: a domain-warped flow field of
// market structure rendered as glowing phosphor topography, with amber
// luminescence welling up in the troughs — the fear the engine buys. The
// `fear` prop (0..1, from the live fear state) widens and brightens the amber
// fissures; when the buy zone arms, the field visibly runs hotter.
//
// Engineering contract (DESIGN.md "WebGL"):
//   - raw WebGL2, zero dependencies, one fullscreen triangle
//   - phosphor + accent colors are read from the CSS custom properties at
//     mount and on [data-phosphor] changes, so theme swaps recolor the shader
//   - DPR capped, renders at 85% resolution and lets CSS upscale (it's glow —
//     the upscale is invisible and the fill-rate savings are real)
//   - pointer glow and scroll dissolve are LERPED in the render loop — no
//     teleporting spotlight, no hard resets on hover or re-entry
//   - rAF pauses when the tab is hidden or the canvas leaves the viewport
//   - WebGL unavailable: canvas stays transparent; context loss: full re-init
//     on restore
import { useEffect, useRef } from "react";

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;   // backing-store px, GL y-up (lerped on the JS side)
uniform float uSpot;    // 0..1 pointer-glow strength (lerped)
uniform float uFear;    // 0..1 live fear level (arming widens the fissures)
uniform float uScroll;  // 0..1 hero scroll-out -> field dissolves to dust
uniform vec3  uPhos;    // phosphor RGB 0..1
uniform vec3  uAccent;  // amber RGB 0..1

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = r * p * 2.03; a *= 0.52; }
  return v;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;          // centered, aspect-safe
  float t = uTime * 0.045;

  // gentle parallax toward the pointer + slow upward drift as the hero scrolls out
  vec2 mo = (uMouse - 0.5 * uRes) / uRes.y;
  uv += mo * 0.03 * uSpot;
  uv.y += uScroll * 0.3;

  // --- domain-warped structure field (the market's topography) -----------
  vec2 p = uv * 2.1;
  vec2 q = vec2(fbm(p + t * 0.9), fbm(p + vec2(2.7, 9.1) - t * 0.7));
  vec2 w = vec2(fbm(p + 2.4 * q + vec2(1.7, 9.2) + t * 1.3),
                fbm(p + 2.4 * q + vec2(8.3, 2.8) - t * 0.8));
  float f = fbm(p + 2.1 * w);

  // pseudo-lighting from the field gradient (cheap volumetric read)
  float e = 0.02;
  float fx = fbm(p + 2.1 * w + vec2(e, 0.0)) - f;
  float fy = fbm(p + 2.1 * w + vec2(0.0, e)) - f;
  float light = clamp(0.5 + 3.5 * (fx * 0.6 - fy), 0.0, 1.0);

  // --- phosphor topo lines: iso-contours of the field --------------------
  float k = 12.0;
  float band = abs(fract(f * k) - 0.5) * 2.0;           // 0 at line center
  float aa = clamp(fwidth(f * k) * 5.0, 0.05, 0.2);      // stays visible after upscale
  float line = smoothstep(aa, 0.0, band) * 0.38
             + smoothstep(0.4, 0.0, band) * 0.055;       // soft halo
  float haze = smoothstep(0.45, 1.0, f) * 0.03;          // whisper of body

  // --- amber fear fissures ---------------------------------------------------
  // Hairline cracks: iso-lines of a second noise field, pocket-masked so they
  // surface only in scattered patches of the troughs. uFear widens the line a
  // touch and raises the glow; armed unlocks a second, deeper crack system.
  float fearN = fbm(p * 1.6 + vec2(4.7, -1.3) - t * 1.7);
  float pocket = smoothstep(0.5, 0.68, fbm(p * 0.55 + vec2(7.3, 3.1) + t * 0.3));
  float crackW = mix(0.01, 0.022, uFear);
  float d1 = abs(fearN - 0.52);
  float d2 = abs(fearN - 0.33);
  float crack = smoothstep(crackW, 0.0, d1) * 1.2
              + smoothstep(crackW, 0.0, d2) * smoothstep(0.55, 1.0, uFear);
  float glow  = smoothstep(crackW * 4.0, 0.0, min(d1, d2)) * 0.06;
  float trough = smoothstep(0.52, 0.26, f);
  float pulse = 0.78 + 0.22 * sin(uTime * 0.8 + fearN * 11.0);
  float fiss = (crack + glow) * trough * pocket * pulse;

  // --- pointer glow (smoothed on the JS side; no teleports) -----------------
  float md = length((frag - uMouse) / uRes.y);
  float spot = exp(-md * md * 7.0) * 0.4 * uSpot;

  // --- eidolon dissolve: scrolling out breaks the field into dust grains ----
  float dis = smoothstep(0.05, 0.95, uScroll);
  float grain = step(dis, vnoise(p * 34.0 + vec2(0.0, t * 2.5)));

  // --- compose -------------------------------------------------------------
  float phosI = line * (0.55 + 0.45 * light) + haze;
  phosI *= 0.78 + spot;
  phosI *= mix(1.0, grain * 0.5, dis);
  vec3 col = uPhos * phosI;
  col += uAccent * fiss * (0.55 + 0.45 * uFear) * (1.0 - dis);
  col += uPhos * spot * 0.35;

  // depth falloff: darker at the edges so the tube glass reads curved
  float vig = smoothstep(1.25, 0.35, length(uv));
  col *= vig;

  // headline shelter: the field recedes over the left third where the
  // wordmark and copy live (the DOM wash finishes the job)
  col *= mix(0.4, 1.0, smoothstep(-0.85, 0.45, uv.x));

  // filmic-ish soft clip + dither (kills banding in the dark glass)
  col = 1.0 - exp(-col * 1.2);
  col += (h21(frag + fract(uTime) * 61.7) - 0.5) * 0.012;

  outColor = vec4(col, 1.0);
}`;

interface FearFieldProps {
  /** 0..1 — live fear level; drives fissure width + amber intensity */
  fear: number;
  className?: string;
}

function cssHslToRgb(raw: string): [number, number, number] | null {
  // custom props hold raw triplets like "152 100% 50%"
  const m = raw.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  const h = parseFloat(m[1]) / 360, s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
  const f = (n: number) => {
    const kk = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
  };
  return [f(0), f(8), f(4)];
}

function readPhosphor(): { phos: [number, number, number]; accent: [number, number, number] } {
  const cs = getComputedStyle(document.documentElement);
  return {
    phos: cssHslToRgb(cs.getPropertyValue("--primary")) ?? [0, 1, 0.53],
    accent: cssHslToRgb(cs.getPropertyValue("--accent")) ?? [1, 0.58, 0],
  };
}

export function FearField({ fear, className }: FearFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fearRef = useRef(fear);
  useEffect(() => {
    fearRef.current = fear;
  }, [fear]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return; // no WebGL2 -> transparent canvas, DOM backdrop carries the hero

    // --- GL state (rebuilt wholesale on context restore) --------------------
    type GLState = {
      prog: WebGLProgram;
      buf: WebGLBuffer;
      vs: WebGLShader;
      fs: WebGLShader;
      u: Record<string, WebGLUniformLocation | null>;
    };
    let state: GLState | null = null;

    const mk = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // eslint-disable-next-line no-console
        console.error("FearField shader:", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const initGL = (): GLState | null => {
      const vs = mk(gl.VERTEX_SHADER, VERT);
      const fs = mk(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      if (!prog) return null;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      if (!buf) return null;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const names = ["uRes", "uTime", "uMouse", "uSpot", "uFear", "uScroll", "uPhos", "uAccent"];
      const u: GLState["u"] = {};
      for (const n of names) u[n] = gl.getUniformLocation(prog, n);
      return { prog, buf, vs, fs, u };
    };

    const applyColors = () => {
      if (!state) return;
      const { phos, accent } = readPhosphor();
      gl.uniform3f(state.u.uPhos, phos[0], phos[1], phos[2]);
      gl.uniform3f(state.u.uAccent, accent[0], accent[1], accent[2]);
    };

    // --- sizing (85% internal res, DPR-capped) ------------------------------
    const RES = 0.85;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr * RES));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr * RES));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    // --- smoothed interaction state ------------------------------------------
    // Targets set by events; the loop eases the shader values toward them so
    // hover, leave and scroll never snap.
    let mx = 0, my = 0;            // current (eased) pointer, backing-store px
    let tx = 0, ty = 0;            // target pointer
    let spotCur = 0, spotTgt = 0;  // pointer-glow strength
    let scrollCur = 0, scrollTgt = 0;

    const onMove = (e: PointerEvent) => {
      // Rect-relative fractions map straight to backing-store pixels — this is
      // zoom- (fl-zoom 1.25), DPR- and RES-proof, same space as gl_FragCoord.
      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      tx = ((e.clientX - r.left) / r.width) * canvas.width;
      ty = (1 - (e.clientY - r.top) / r.height) * canvas.height;
      spotTgt = 1;
      if (spotCur === 0) { mx = tx; my = ty; } // first entry: appear in place, fade in
    };
    const onLeave = () => { spotTgt = 0; };
    const host = canvas.parentElement ?? canvas;
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    const onScroll = () => {
      const r = canvas.getBoundingClientRect();
      if (r.height < 1) return;
      scrollTgt = Math.max(0, Math.min(1, -r.top / (r.height * 0.85)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // --- render loop ----------------------------------------------------------
    let raf = 0;
    let running = false;
    let visible = true;
    let lost = false;
    let last = performance.now();
    const t0 = last;

    const draw = (now: number) => {
      if (!state) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ease = 1 - Math.exp(-dt * 7);
      mx += (tx - mx) * ease;
      my += (ty - my) * ease;
      spotCur += (spotTgt - spotCur) * ease;
      scrollCur += (scrollTgt - scrollCur) * ease;
      gl.uniform2f(state.u.uRes, canvas.width, canvas.height);
      gl.uniform1f(state.u.uTime, ((now - t0) / 1000) % 3600);
      gl.uniform2f(state.u.uMouse, mx, my);
      gl.uniform1f(state.u.uSpot, spotCur);
      gl.uniform1f(state.u.uScroll, scrollCur);
      gl.uniform1f(state.u.uFear, Math.max(0, Math.min(1, fearRef.current)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const renderOnce = () => {
      if (lost || !state) return;
      // for single-frame renders, land values instantly
      mx = tx; my = ty; spotCur = spotTgt; scrollCur = scrollTgt;
      draw(performance.now());
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || lost || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // --- lifecycle wiring -----------------------------------------------------
    state = initGL();
    if (!state) return;
    applyColors();
    size();

    const themeObs = new MutationObserver(() => { applyColors(); if (!running) renderOnce(); });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phosphor"] });

    const ro = new ResizeObserver(() => { size(); if (!running) renderOnce(); });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start(); else stop();
    });
    io.observe(canvas);
    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVis);

    const onLost = (e: Event) => { e.preventDefault(); lost = true; stop(); };
    const onRestored = () => {
      lost = false;
      state = initGL();           // programs/buffers died with the old context
      if (!state) return;
      applyColors();
      size();
      renderOnce();
      start();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    onScroll();     // seed scroll state before first paint
    renderOnce();   // first paint
    start();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      themeObs.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (state) {
        gl.deleteBuffer(state.buf);
        gl.deleteProgram(state.prog);
        gl.deleteShader(state.vs);
        gl.deleteShader(state.fs);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
      data-testid="fear-field"
    />
  );
}
