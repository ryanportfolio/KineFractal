// persistence-engine — the site's one beam.
//
// A reusable raw-WebGL2 storage-oscilloscope renderer (zero dependencies).
// Callers submit, per frame, whatever the beam draws THIS frame (polylines /
// spots in normalized 0..1 space, y down); the engine holds everything drawn
// before in a decaying phosphor buffer, so traces persist and cool exactly
// like a real storage tube.
//
// Passes per frame, all into half-res ping-pong RGBA8 buffers:
//   1. DECAY      prev * exp2(-dt / tau)  (+ blue-noise dither vs banding)
//   2. DEPOSIT    instanced capsule quads, additive Gaussian beam profile
//   3. COMPOSITE  energy -> beam ramp (ghost->mid->hot->core), comet smear,
//                 scanline modulation, slight barrel, cursor lens, flash
//
// Engineering contract (per fear-field.tsx / DESIGN.md):
//   DPR cap 1.5 · buffers at 50% res · rAF pauses off-screen & hidden ·
//   context-loss re-init ·
//   theme colors read from CSS vars + MutationObserver on [data-phosphor] ·
//   frame governor: 3 frames > 22ms -> third-res buffers + smear off.
//
// The cursor is a LENS in the composite pass — it bends where you look,
// never the deposited data. Honesty holds even under the pointer.

export interface PathOpts {
  /** deposit energy 0..1 (per frame; steady traces want ~0.5 * dt * 60) */
  energy?: number;
  /** beam sigma in device px */
  width?: number;
  /** deposit into the accent (amber/fear) channel instead of the phosphor */
  accent?: boolean;
}

export interface EngineApi {
  /** polyline in normalized coords [x0,y0,x1,y1,...], 0..1, y down */
  path(points: ArrayLike<number>, opts?: PathOpts): void;
  /** a single beam spot */
  spot(x: number, y: number, energy?: number, width?: number, accent?: boolean): void;
  setTau(tau: number): void;
  /** one-shot full-canvas brightness dip/boost (recovers over ~120ms) */
  flash(mult: number): void;
  /** canvas client size in CSS px */
  size(): { w: number; h: number };
}

export interface PersistenceEngine {
  readonly ok: boolean;
  /** allow the loop (still gated by tab visibility) */
  start(): void;
  /** freeze — the last composited frame stays on the canvas */
  stop(): void;
  /** single synchronous frame (settle, theme refresh) */
  renderOnce(): void;
  /** wipe the phosphor */
  clear(): void;
  destroy(): void;
}

export interface EngineOpts {
  /** phosphor time constant, seconds */
  tau?: number;
  /** called every frame while running; draw the beam's current work */
  onFrame: (api: EngineApi, t: number, dt: number) => void;
  /** enable the composite-pass cursor lens */
  cursorLens?: boolean;
  /** element whose pointer events drive the lens (default: canvas parent) */
  lensHost?: Element;
  /** persistence buffer scale relative to canvas backing store */
  bufferScale?: number;
}

const VERT_FS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG_DECAY = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 o;
uniform sampler2D uPrev;
uniform float uK;      // exp2(-dt/tau)
uniform float uDither; // amplitude, scaled to the decay rate on the JS side —
                       // fast fades need dither vs banding; storage holds must
                       // not random-walk
uniform float uSeed;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 e = texture(uPrev, vUV).rg * uK;            // r = phosphor, g = accent
  e += (h21(gl_FragCoord.xy + uSeed) - 0.5) * uDither;
  e = mix(e, vec2(0.0), step(e, vec2(0.006)));     // kill the floor ghost
  o = vec4(e, 0.0, 1.0);
}`;

const VERT_SEG = `#version 300 es
layout(location=0) in vec2 aCorner;   // quad corner 0..1
layout(location=1) in vec4 aSeg;      // x0 y0 x1 y1 (buffer px, y up)
layout(location=2) in vec3 aProps;    // energy, sigma(px), channel (0 phos / 1 accent)
uniform vec2 uRes;
out vec2 vA;
out vec2 vB;
out vec3 vProps;
void main(){
  vec2 a = aSeg.xy, b = aSeg.zw;
  vec2 d = b - a;
  float len = length(d);
  vec2 t = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float pad = aProps.y * 3.5 + 1.0;
  vec2 p = mix(a - t * pad, b + t * pad, aCorner.x) + n * (aCorner.y * 2.0 - 1.0) * pad;
  vA = a; vB = b; vProps = aProps;
  gl_Position = vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG_DEPOSIT = `#version 300 es
precision highp float;
in vec2 vA;
in vec2 vB;
in vec3 vProps;
out vec4 o;
void main(){
  vec2 p = gl_FragCoord.xy;
  vec2 ab = vB - vA;
  float l2 = dot(ab, ab);
  float h = l2 > 1e-6 ? clamp(dot(p - vA, ab) / l2, 0.0, 1.0) : 0.0;
  float d = length(p - (vA + ab * h));
  float s = max(vProps.y, 0.5);
  float e = exp(-d * d / (2.0 * s * s)) * vProps.x;
  o = vec4(e * (1.0 - vProps.z), e * vProps.z, 0.0, 1.0);
}`;

const FRAG_COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 o;
uniform sampler2D uBuf;
uniform vec2 uRes;        // output px
uniform vec2 uCursor;     // output px, y up
uniform float uCursorAmt; // 0..1
uniform float uFlash;     // brightness multiplier (settles to 1)
uniform float uSmear;     // 0 or 1
uniform float uSeed;
uniform vec3 uGhost;
uniform vec3 uMid;
uniform vec3 uHot;
uniform vec3 uCore;
uniform vec3 uAccent;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 uv = vUV;
  // slight barrel — the trace lives behind curved glass
  vec2 c = uv - 0.5;
  // barrel curve, normalized by its own corner maximum (1 + 0.5*0.06) so the
  // corners land exactly on the frame edge and no sample ever leaves [0,1] —
  // fills edge to edge without CLAMP_TO_EDGE smearing a block at the sides
  uv = 0.5 + c * (1.0 + dot(c, c) * 0.06) / 1.03;
  // cursor lens: bend the glass toward the pointer, never the data
  vec2 cpx = uv * uRes;
  vec2 dc = cpx - uCursor;
  float cd2 = dot(dc, dc);
  float lens = exp(-cd2 / (2.0 * 90.0 * 90.0)) * uCursorAmt;
  uv += (dc / uRes) * lens * 0.06;
  vec2 ee = texture(uBuf, uv).rg;
  if (uSmear > 0.5) {
    // phosphor comet tail: energy bleeds a touch along +x
    ee += texture(uBuf, uv - vec2(1.6 / uRes.x, 0.0)).rg * 0.22;
    ee += texture(uBuf, uv - vec2(3.2 / uRes.x, 0.0)).rg * 0.09;
  }
  float e = ee.r;
  float ac = ee.g;
  // the ramp: unlit -> ghost -> mid -> hot -> core
  vec3 col = uGhost * smoothstep(0.0, 0.10, e) * 0.55;
  col = mix(col, uMid, smoothstep(0.08, 0.42, e));
  col = mix(col, uHot, smoothstep(0.42, 0.78, e));
  col = mix(col, uCore, smoothstep(0.78, 1.0, e));
  col *= clamp(e * 6.0, 0.0, 1.0);        // keep true black where unlit
  // accent channel: fear burns amber, cooling toward its own dim
  vec3 acol = mix(uAccent * 0.45, uAccent, smoothstep(0.12, 0.6, ac));
  acol = mix(acol, uCore, smoothstep(0.85, 1.0, ac));
  col += acol * clamp(ac * 5.0, 0.0, 1.0);
  // faint scanline modulation (the global tube raster is coarser)
  col *= 1.0 - 0.03 * step(0.5, fract(gl_FragCoord.y * 0.33));
  col *= uFlash;
  col = 1.0 - exp(-col * 1.35);           // filmic soft clip
  col += (h21(gl_FragCoord.xy + uSeed) - 0.5) * 0.008;
  float a = clamp(max(col.r, max(col.g, col.b)) * 1.15, 0.0, 1.0);
  o = vec4(min(col, vec3(a)), a);
}`;

function cssHslToRgb(raw: string): [number, number, number] | null {
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

function readRamp() {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string, fb: [number, number, number]) =>
    cssHslToRgb(cs.getPropertyValue(v)) ?? fb;
  return {
    ghost: get("--beam-ghost", [0.08, 0.18, 0.13]),
    mid: get("--beam-mid", [0.09, 0.81, 0.47]),
    hot: get("--beam-hot", [0.26, 0.97, 0.62]),
    core: get("--beam-core", [0.95, 1, 0.97]),
    accent: get("--accent", [1, 0.65, 0]),
  };
}

const MAX_SEGS = 8192;

export function createPersistenceEngine(
  canvas: HTMLCanvasElement,
  opts: EngineOpts,
): PersistenceEngine {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) {
    return {
      ok: false,
      start() {},
      stop() {},
      renderOnce() {},
      clear() {},
      destroy() {},
    };
  }

  let tau = opts.tau ?? 0.45;
  let bufScale = opts.bufferScale ?? 0.5;
  let smear = 1;
  let destroyed = false;
  let lost = false;

  // Half-float persistence buffers when available: exponential decay works to
  // arbitrarily small values with no quantization stall and no dither walk.
  // RGBA8 fallback keeps a 1-LSB dither to break the rounding freeze.
  const floatBufs = !!gl.getExtension("EXT_color_buffer_float");

  // ---- programs -----------------------------------------------------------
  const mkShader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("persistence-engine shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const mkProg = (vs: string, fs: string) => {
    const v = mkShader(gl.VERTEX_SHADER, vs);
    const f = mkShader(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("persistence-engine link:", gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  };

  type GLState = {
    pDecay: WebGLProgram;
    pDeposit: WebGLProgram;
    pComposite: WebGLProgram;
    fsBuf: WebGLBuffer;
    fsVAO: WebGLVertexArrayObject;
    segVAO: WebGLVertexArrayObject;
    cornerBuf: WebGLBuffer;
    segBuf: WebGLBuffer;
    propBuf: WebGLBuffer;
    fbo: [WebGLFramebuffer, WebGLFramebuffer];
    tex: [WebGLTexture, WebGLTexture];
    u: Record<string, Record<string, WebGLUniformLocation | null>>;
    bw: number;
    bh: number;
  };
  let S: GLState | null = null;

  const uniforms = (p: WebGLProgram, names: string[]) => {
    const out: Record<string, WebGLUniformLocation | null> = {};
    for (const n of names) out[n] = gl.getUniformLocation(p, n);
    return out;
  };

  const mkTarget = (w: number, h: number): [WebGLFramebuffer, WebGLTexture] => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (floatBufs) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return [f, t];
  };

  const initGL = (): GLState | null => {
    const pDecay = mkProg(VERT_FS, FRAG_DECAY);
    const pDeposit = mkProg(VERT_SEG, FRAG_DEPOSIT);
    const pComposite = mkProg(VERT_FS, FRAG_COMPOSITE);
    if (!pDecay || !pDeposit || !pComposite) return null;

    const fsBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const fsVAO = gl.createVertexArray()!;
    gl.bindVertexArray(fsVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const segVAO = gl.createVertexArray()!;
    gl.bindVertexArray(segVAO);
    const cornerBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const segBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_SEGS * 4 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    const propBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, propBuf);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_SEGS * 3 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    const bw = Math.max(2, Math.round(canvas.width * bufScale));
    const bh = Math.max(2, Math.round(canvas.height * bufScale));
    const [f0, t0] = mkTarget(bw, bh);
    const [f1, t1] = mkTarget(bw, bh);

    return {
      pDecay,
      pDeposit,
      pComposite,
      fsBuf,
      fsVAO,
      segVAO,
      cornerBuf,
      segBuf,
      propBuf,
      fbo: [f0, f1],
      tex: [t0, t1],
      u: {
        decay: uniforms(pDecay, ["uPrev", "uK", "uDither", "uSeed"]),
        deposit: uniforms(pDeposit, ["uRes"]),
        composite: uniforms(pComposite, [
          "uBuf", "uRes", "uCursor", "uCursorAmt", "uFlash", "uSmear", "uSeed",
          "uGhost", "uMid", "uHot", "uCore", "uAccent",
        ]),
      },
      bw,
      bh,
    };
  };

  // ---- sizing --------------------------------------------------------------
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      rebuildBuffers();
    }
  };
  const rebuildBuffers = () => {
    if (!S) return;
    const bw = Math.max(2, Math.round(canvas.width * bufScale));
    const bh = Math.max(2, Math.round(canvas.height * bufScale));
    if (bw === S.bw && bh === S.bh) return;
    const [f0, t0] = mkTarget(bw, bh);
    const [f1, t1] = mkTarget(bw, bh);
    // carry the stored phosphor into the new tube — a resize (mobile toolbar,
    // window drag) must not erase the performance so far
    gl.bindFramebuffer(gl.FRAMEBUFFER, f0);
    gl.viewport(0, 0, bw, bh);
    gl.disable(gl.BLEND);
    gl.useProgram(S.pDecay);
    gl.bindVertexArray(S.fsVAO);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, S.tex[ping]);
    gl.uniform1i(S.u.decay.uPrev, 0);
    gl.uniform1f(S.u.decay.uK, 1);
    gl.uniform1f(S.u.decay.uDither, 0);
    gl.uniform1f(S.u.decay.uSeed, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const t of S.tex) gl.deleteTexture(t);
    for (const f of S.fbo) gl.deleteFramebuffer(f);
    S.fbo = [f0, f1];
    S.tex = [t0, t1];
    S.bw = bw;
    S.bh = bh;
    ping = 0;
  };

  // ---- ramp / theme ---------------------------------------------------------
  let ramp = readRamp();
  const themeObs = new MutationObserver(() => {
    ramp = readRamp();
    if (!running) renderOnce(true); // recolor a frozen frame in place
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-phosphor"] });

  // ---- per-frame segment accumulation ---------------------------------------
  const segData = new Float32Array(MAX_SEGS * 4);
  const propData = new Float32Array(MAX_SEGS * 3);
  let segCount = 0;

  const pushSeg = (
    x0: number, y0: number, x1: number, y1: number,
    energy: number, sigma: number, channel: number,
  ) => {
    if (segCount >= MAX_SEGS || !S) return;
    // normalized (0..1, y down) -> buffer px (y up)
    const i4 = segCount * 4;
    segData[i4] = x0 * S.bw;
    segData[i4 + 1] = (1 - y0) * S.bh;
    segData[i4 + 2] = x1 * S.bw;
    segData[i4 + 3] = (1 - y1) * S.bh;
    const i3 = segCount * 3;
    propData[i3] = energy;
    propData[i3 + 1] = sigma * bufScale * Math.min(window.devicePixelRatio || 1, 1.5);
    propData[i3 + 2] = channel;
    segCount++;
  };

  const api: EngineApi = {
    path(points, o = {}) {
      const e = o.energy ?? 0.5;
      const w = o.width ?? 2.2;
      const ch = o.accent ? 1 : 0;
      for (let i = 0; i + 3 < points.length; i += 2) {
        pushSeg(points[i], points[i + 1], points[i + 2], points[i + 3], e, w, ch);
      }
    },
    spot(x, y, energy = 1, width = 3, accent = false) {
      pushSeg(x, y, x, y, energy, width, accent ? 1 : 0);
    },
    setTau(t) {
      tau = Math.max(0.02, t);
    },
    flash(mult) {
      flashCur = mult;
    },
    size() {
      return { w: canvas.clientWidth, h: canvas.clientHeight };
    },
  };

  // ---- cursor lens -----------------------------------------------------------
  let cx = 0, cy = 0, ctx_ = 0, cty = 0, cAmt = 0, cTgt = 0;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 1) return;
    ctx_ = ((e.clientX - r.left) / r.width) * canvas.width;
    cty = (1 - (e.clientY - r.top) / r.height) * canvas.height;
    cTgt = 1;
    if (cAmt === 0) { cx = ctx_; cy = cty; }
  };
  const onLeave = () => { cTgt = 0; };
  const host = opts.lensHost ?? canvas.parentElement ?? canvas;
  if (opts.cursorLens) {
    host.addEventListener("pointermove", onMove as EventListener);
    host.addEventListener("pointerleave", onLeave);
  }

  // ---- render ----------------------------------------------------------------
  let flashCur = 1;
  let ping = 0;
  let raf = 0;
  let running = false;
  let allowed = false; // scheduler grant
  let last = performance.now();
  const t0 = last;
  let slowFrames = 0;

  const drawFrame = (now: number, compositeOnly = false) => {
    if (!S || lost || destroyed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    if (!compositeOnly) {
      segCount = 0;
      opts.onFrame(api, t, dt);

      const src = ping, dst = 1 - ping;
      gl.bindFramebuffer(gl.FRAMEBUFFER, S.fbo[dst]);
      gl.viewport(0, 0, S.bw, S.bh);
      gl.disable(gl.BLEND);
      gl.useProgram(S.pDecay);
      gl.bindVertexArray(S.fsVAO);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, S.tex[src]);
      const k = Math.pow(2, -dt / tau);
      gl.uniform1i(S.u.decay.uPrev, 0);
      gl.uniform1f(S.u.decay.uK, k);
      // float buffers decay cleanly with zero dither; the 8-bit fallback needs
      // ~1 LSB to break the rounding stall (accepting a slight brightness walk)
      gl.uniform1f(S.u.decay.uDither, floatBufs ? 0 : 1 / 255);
      gl.uniform1f(S.u.decay.uSeed, (t * 61.7) % 100);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (segCount > 0) {
        gl.useProgram(S.pDeposit);
        gl.bindVertexArray(S.segVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, S.segBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, segData, 0, segCount * 4);
        gl.bindBuffer(gl.ARRAY_BUFFER, S.propBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, propData, 0, segCount * 3);
        gl.uniform2f(S.u.deposit.uRes, S.bw, S.bh);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, segCount);
        gl.disable(gl.BLEND);
      }
      ping = dst;
    }

    // cursor ease
    const ease = 1 - Math.exp(-dt * 8);
    cx += (ctx_ - cx) * ease;
    cy += (cty - cy) * ease;
    cAmt += (cTgt - cAmt) * ease;
    flashCur += (1 - flashCur) * Math.min(1, dt * 9);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(S.pComposite);
    gl.bindVertexArray(S.fsVAO);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, S.tex[ping]);
    gl.uniform1i(S.u.composite.uBuf, 0);
    gl.uniform2f(S.u.composite.uRes, canvas.width, canvas.height);
    gl.uniform2f(S.u.composite.uCursor, cx, cy);
    gl.uniform1f(S.u.composite.uCursorAmt, opts.cursorLens ? cAmt : 0);
    gl.uniform1f(S.u.composite.uFlash, flashCur);
    gl.uniform1f(S.u.composite.uSmear, smear);
    gl.uniform1f(S.u.composite.uSeed, (t * 47.3) % 100);
    gl.uniform3f(S.u.composite.uGhost, ...ramp.ghost);
    gl.uniform3f(S.u.composite.uMid, ...ramp.mid);
    gl.uniform3f(S.u.composite.uHot, ...ramp.hot);
    gl.uniform3f(S.u.composite.uCore, ...ramp.core);
    gl.uniform3f(S.u.composite.uAccent, ...ramp.accent);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    if (!running) return;
    const frameStart = performance.now();
    drawFrame(now);
    // frame governor
    if (performance.now() - frameStart > 22) {
      if (++slowFrames >= 3 && bufScale > 0.34) {
        bufScale = 0.33;
        smear = 0;
        rebuildBuffers();
        slowFrames = 0;
      }
    } else {
      slowFrames = 0;
    }
    raf = requestAnimationFrame(loop);
  };

  const start = () => {
    allowed = true;
    if (running || lost || destroyed || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    allowed = false;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const renderOnce = (compositeOnly = false) => {
    if (lost || destroyed || !S) return;
    size();
    drawFrame(performance.now(), compositeOnly);
  };
  const clear = () => {
    if (!S) return;
    for (const f of S.fbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  // ---- lifecycle -------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    size();
    if (!running) renderOnce(true);
  });
  ro.observe(canvas);
  const onVis = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      running = false;
    } else if (allowed) {
      start();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    running = false;
  };
  const onRestored = () => {
    lost = false;
    S = initGL();
    if (!S) return;
    clear();
    if (allowed) start();
    else renderOnce();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  S = initGL();
  if (!S) {
    themeObs.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    return { ok: false, start() {}, stop() {}, renderOnce() {}, clear() {}, destroy() {} };
  }
  size();
  clear();

  return {
    ok: true,
    start,
    stop,
    renderOnce: () => renderOnce(false),
    clear,
    destroy() {
      destroyed = true;
      stop();
      themeObs.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (opts.cursorLens) {
        host.removeEventListener("pointermove", onMove as EventListener);
        host.removeEventListener("pointerleave", onLeave);
      }
      if (S) {
        for (const t of S.tex) gl.deleteTexture(t);
        for (const f of S.fbo) gl.deleteFramebuffer(f);
        gl.deleteBuffer(S.fsBuf);
        gl.deleteBuffer(S.cornerBuf);
        gl.deleteBuffer(S.segBuf);
        gl.deleteBuffer(S.propBuf);
        gl.deleteVertexArray(S.fsVAO);
        gl.deleteVertexArray(S.segVAO);
        gl.deleteProgram(S.pDecay);
        gl.deleteProgram(S.pDeposit);
        gl.deleteProgram(S.pComposite);
        S = null;
      }
    },
  };
}
