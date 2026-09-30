// story-renderer — the About film's 3D phosphor tube (raw WebGL2, no deps).
//
// Scene code submits beam geometry in world space every frame: glowing
// segments (capsules with a Gaussian beam profile) and spots. The renderer
// projects them through a perspective camera, deposits them additively into
// an HDR buffer, blooms the result through a dual-filter mip chain, then
// composites the tube: exposure tonemap, slight barrel + chromatic fringe,
// scanlines, vignette, grain, and the unlit-phosphor floor color.
//
// Performance contract (same family as persistence-engine.ts):
//   DPR cap 1.5 · bloom from half res · the caller pauses the loop off-screen
//   and while hidden · context-loss re-init · slow frames drop render scale.
import { FrameGovernor } from "@/lib/about-story-model";

export type Vec3 = [number, number, number];
export type RGB = [number, number, number];
export interface Camera { eye: Vec3; target: Vec3; fov: number; fogNear?: number; fogFar?: number }

const FLOATS = 13; // p0(3) p1(3) width(1) color+alpha(4) caps(2)
const LEVELS = 6; // scene + 5 bloom levels
const DPR_CAP = 1.5;
const REF_DEPTH = 7; // world depth at which `width` is exact CSS px

const LINE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec3 a_p0;
layout(location=2) in vec3 a_p1;
layout(location=3) in float a_w;
layout(location=4) in vec4 a_col;
layout(location=5) in vec2 a_cap;
uniform mat4 u_vp;
uniform vec2 u_res;
uniform float u_px;
uniform vec2 u_fog;
uniform float u_k;
out vec2 v_px;
flat out vec2 v_a;
flat out vec2 v_b;
flat out float v_r;
flat out vec3 v_col;
flat out vec2 v_cap;
void main() {
  vec4 c0 = u_vp * vec4(a_p0, 1.0);
  vec4 c1 = u_vp * vec4(a_p1, 1.0);
  if (c0.w < 0.08 || c1.w < 0.08) { gl_Position = vec4(3.0, 3.0, 3.0, 1.0); return; }
  vec2 s0 = (c0.xy / c0.w * 0.5 + 0.5) * u_res;
  vec2 s1 = (c1.xy / c1.w * 0.5 + 0.5) * u_res;
  float depth = 0.5 * (c0.w + c1.w);
  float r = max(a_w * u_px * clamp(${REF_DEPTH.toFixed(1)} * pow(u_k, 0.35) / depth, 0.3, 3.0), 0.6);
  float R = r * 3.2;
  vec2 d = s1 - s0;
  float L = length(d);
  vec2 dir = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 base = mix(s0, s1, a_corner.x * 0.5 + 0.5);
  vec2 px = base + dir * a_corner.x * R + nrm * a_corner.y * R;
  float fog = 1.0 - smoothstep(u_fog.x, u_fog.y, depth);
  v_px = px; v_a = s0; v_b = s1; v_r = r; v_cap = a_cap;
  // a pulled-back (portrait) camera packs the same beams into fewer pixels
  // beams passing right by the lens fade instead of blowing out the frame
  float nearFade = smoothstep(0.6, 2.4, depth);
  v_col = a_col.rgb * a_col.a * fog * nearFade / pow(u_k, 0.45);
  gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0);
}`;

const LINE_FS = `#version 300 es
precision highp float;
in vec2 v_px;
flat in vec2 v_a;
flat in vec2 v_b;
flat in float v_r;
flat in vec3 v_col;
flat in vec2 v_cap;
out vec4 o;
void main() {
  vec2 pa = v_px - v_a, ba = v_b - v_a;
  float bb = dot(ba, ba);
  float h = bb > 1e-6 ? dot(pa, ba) / bb : 0.0;
  // polyline interiors carry no end caps, so joints do not double up
  if ((h < 0.0 && v_cap.x < 0.5) || (h > 1.0 && v_cap.y < 0.5)) discard;
  float d = length(pa - ba * clamp(h, 0.0, 1.0));
  float k = exp(-d * d / (2.0 * v_r * v_r)) + 0.14 * exp(-d / (v_r * 1.3));
  o = vec4(v_col * k, 1.0);
}`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
out vec2 v_uv;
void main() { v_uv = a_corner * 0.5 + 0.5; gl_Position = vec4(a_corner, 0.0, 1.0); }`;

// dual-filter (Kawase) blur: cheap, wide, stable under motion
const DOWN_FS = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_tex; uniform vec2 u_texel;
void main() {
  vec2 h = u_texel * 0.5;
  vec3 s = texture(u_tex, v_uv).rgb * 4.0;
  s += texture(u_tex, v_uv - h).rgb;
  s += texture(u_tex, v_uv + h).rgb;
  s += texture(u_tex, v_uv + vec2(h.x, -h.y)).rgb;
  s += texture(u_tex, v_uv - vec2(h.x, -h.y)).rgb;
  o = vec4(s / 8.0, 1.0);
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_tex; uniform vec2 u_texel;
void main() {
  vec2 h = u_texel * 0.5;
  vec3 s = texture(u_tex, v_uv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture(u_tex, v_uv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture(u_tex, v_uv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture(u_tex, v_uv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture(u_tex, v_uv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture(u_tex, v_uv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture(u_tex, v_uv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture(u_tex, v_uv + vec2(-h.x, -h.y)).rgb * 2.0;
  o = vec4(s / 12.0, 1.0);
}`;

const COMP_FS = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_scene; uniform sampler2D u_bloom;
uniform vec3 u_bg; uniform float u_time; uniform float u_flash; uniform float u_px;
void main() {
  vec2 c = v_uv - 0.5;
  float r2 = dot(c, c);
  // slight barrel, normalised so the corners still sample inside the frame
  vec2 uv = 0.5 + c * (1.0 + 0.04 * r2) / 1.02;
  float ab = 0.0012 + 0.006 * r2;
  vec3 s;
  s.r = texture(u_scene, uv + c * ab).r;
  s.g = texture(u_scene, uv).g;
  s.b = texture(u_scene, uv - c * ab).b;
  vec3 b = texture(u_bloom, uv).rgb;
  vec3 col = (s + b * 1.1) * (1.0 + u_flash);
  col = 1.0 - exp(-col * 1.15);
  float sl = 0.9 + 0.1 * sin(gl_FragCoord.y * 3.14159 / (1.5 * u_px));
  col *= sl;
  // (edges in order: reversed smoothstep edges are undefined in GLSL)
  float vig = 1.0 - smoothstep(0.18, 0.82, length(c * vec2(1.0, 1.15)));
  col = u_bg + col * mix(0.5, 1.0, vig);
  col *= mix(0.72, 1.0, vig);
  float n = fract(sin(dot(gl_FragCoord.xy + fract(u_time) * 97.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * (3.0 / 255.0);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = u_bg * 0.6;
  o = vec4(col, 1.0);
}`;

// ---- tiny matrix helpers (column-major, like GL) ------------------------------
function perspective(fovDeg: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(e: Vec3, t: Vec3): Float32Array {
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
  let l = Math.hypot(zx, zy, zz) || 1;
  zx /= l; zy /= l; zz /= l;
  // up = +y
  let xx = zz, xy = 0, xz = -zx;
  l = Math.hypot(xx, xy, xz) || 1;
  xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xy * e[1] + xz * e[2]),
    -(yx * e[0] + yy * e[1] + yz * e[2]),
    -(zx * e[0] + zy * e[1] + zz * e[2]),
    1,
  ]);
}
function mul(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

interface Target { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

export class StoryRenderer {
  ok = false;
  private gl: WebGL2RenderingContext | null = null;
  private lineProg: WebGLProgram | null = null;
  private downProg: WebGLProgram | null = null;
  private upProg: WebGLProgram | null = null;
  private compProg: WebGLProgram | null = null;
  private lineVao: WebGLVertexArrayObject | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private instBuf: WebGLBuffer | null = null;
  private targets: Target[] = [];
  private data = new Float32Array(FLOATS * 4096);
  private n = 0;
  private vp = new Float32Array(16);
  private cssW = 1;
  private cssH = 1;
  private px = 1; // device px per CSS px actually rendered
  private scale = 1; // governor-reduced render scale
  private builtScale = 1;
  private dpr = 1;
  private governor = new FrameGovernor();
  private hdr = false;
  private fog: [number, number] = [40, 60];
  private k = 1; // portrait camera pull-back factor
  bg: RGB = [0.02, 0.04, 0.035];

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    this.init();
  }

  /** called with false when the WebGL context is lost and true once it is restored */
  onContextChange: ((ok: boolean, restoring: boolean) => void) | null = null;
  private onLost = (e: Event) => { e.preventDefault(); this.ok = false; this.onContextChange?.(false, false); };
  private onRestored = () => {
    // init() rebuilds programs and render targets once; a device that cannot
    // is reported as a failed restore (ok false), not a pause
    this.init();
    this.onContextChange?.(this.ok, true);
  };

  private init() {
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) return;
    this.gl = gl;
    this.hdr = !!gl.getExtension("EXT_color_buffer_float");
    try {
      this.lineProg = this.program(LINE_VS, LINE_FS);
      this.downProg = this.program(QUAD_VS, DOWN_FS);
      this.upProg = this.program(QUAD_VS, UP_FS);
      this.compProg = this.program(QUAD_VS, COMP_FS);
    } catch (e) {
      // keep the diagnostic: the page itself only says WebGL2 is unavailable
      console.error("about film: WebGL program build failed", e);
      return;
    }
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.lineVao = gl.createVertexArray();
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    const stride = FLOATS * 4;
    const attrs: [number, number, number][] = [[1, 3, 0], [2, 3, 3], [3, 1, 6], [4, 4, 7], [5, 2, 11]];
    for (const [loc, size, off] of attrs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    // (handles from a lost context are already dead; deleting them is a no-op)
    for (const t of this.targets) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
    this.targets = [];
    this.cssW = this.cssH = 0; // force target rebuild on the resize below
    this.ok = true;
    this.resize();
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, this.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }

  /** match the canvas backing store to its CSS box; cheap when unchanged */
  resize() {
    const gl = this.gl;
    if (!gl || !this.ok) return;
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    if (w === this.cssW && h === this.cssH && dpr === this.dpr && this.scale === this.builtScale && this.targets.length) return;
    // the site's desktop CSS zoom (--pz, index.css) scales CSS px on screen;
    // clientWidth does not include it, so fold it in to render at true res
    const pz = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pz")) || 1;
    this.cssW = w; this.cssH = h; this.dpr = dpr; this.builtScale = this.scale;
    this.px = Math.min(dpr, DPR_CAP) * pz * this.scale;
    // never ask for a texture or drawing buffer larger than the device allows
    const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const lim = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), vp[0], vp[1]);
    this.px = Math.min(this.px, lim / w, lim / h);
    this.canvas.width = Math.round(w * this.px);
    this.canvas.height = Math.round(h * this.px);
    const build = () => {
      for (const t of this.targets) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
      this.targets = [];
      let tw = this.canvas.width, th = this.canvas.height;
      for (let i = 0; i < LEVELS; i++) {
        this.targets.push(this.makeTarget(Math.max(1, tw), Math.max(1, th)));
        tw = Math.round(tw / 2); th = Math.round(th / 2);
      }
      return this.targets.every((t) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      });
    };
    let complete = build();
    // half-float targets are optional: fall back to 8-bit before giving up
    if (!complete && this.hdr) { this.hdr = false; complete = build(); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!complete) {
      console.error("about film: render targets incomplete", this.canvas.width, this.canvas.height);
      this.ok = false;
      this.onFail?.();
    }
  }

  /** called once if the device cannot build the film's render targets */
  onFail: (() => void) | null = null;

  /** height of the stage in CSS px */
  cssHeight() { return this.cssH; }

  /** width / height of the stage in CSS px */
  aspect() { return this.cssW / Math.max(1, this.cssH); }

  /** current governor render scale (1 = full resolution) */
  get renderScale() { return this.scale; }

  /** frame-time governor (see FrameGovernor): may change render resolution */
  reportFrame(interval: number, work = 0) {
    // resizing here would clear the frame just drawn (a canvas size change
    // wipes its buffer) and show one black frame; the next frame's resize()
    // rebuilds at the new scale before it draws
    this.scale = this.governor.report(interval, work);
  }

  begin(cam: Camera) {
    this.n = 0;
    const aspect = this.cssW / this.cssH;
    // Scenes are composed for landscape. Narrower screens pull the camera back
    // along its view line (and push the fog out with it) so the width still fits.
    const k = aspect < 1.5 ? 1.5 / Math.max(aspect, 0.3) : 1;
    const eye: Vec3 = [
      cam.target[0] + (cam.eye[0] - cam.target[0]) * k,
      cam.target[1] + (cam.eye[1] - cam.target[1]) * k,
      cam.target[2] + (cam.eye[2] - cam.target[2]) * k,
    ];
    this.vp = mul(perspective(cam.fov, aspect, 0.05, 400), lookAt(eye, cam.target));
    this.fog = [(cam.fogNear ?? 40) * k, (cam.fogFar ?? 60) * k];
    this.k = k;
  }

  private push(ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, c: RGB, a: number, capA: number, capB: number) {
    if (a <= 0.002) return;
    if ((this.n + 1) * FLOATS > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    const o = this.n * FLOATS;
    const d = this.data;
    d[o] = ax; d[o + 1] = ay; d[o + 2] = az;
    d[o + 3] = bx; d[o + 4] = by; d[o + 5] = bz;
    d[o + 6] = w;
    d[o + 7] = c[0]; d[o + 8] = c[1]; d[o + 9] = c[2]; d[o + 10] = a;
    d[o + 11] = capA; d[o + 12] = capB;
    this.n++;
  }

  seg(a: Vec3, b: Vec3, w: number, c: RGB, alpha: number) {
    this.push(a[0], a[1], a[2], b[0], b[1], b[2], w, c, alpha, 1, 1);
  }

  spot(p: Vec3, w: number, c: RGB, alpha: number) {
    this.push(p[0], p[1], p[2], p[0], p[1], p[2], w, c, alpha, 1, 1);
  }

  /**
   * polyline through flat xyz points; draws vertices [from, to] with a
   * fractional tail so a sweeping head moves smoothly between samples.
   * `alphaAt(i)` optionally shades each segment.
   */
  path(pts: ArrayLike<number>, w: number, c: RGB, alpha: number, from = 0, to = pts.length / 3 - 1, alphaAt?: (i: number) => number) {
    const last = Math.min(to, pts.length / 3 - 1);
    const end = Math.floor(last);
    const start = Math.max(0, Math.floor(from));
    for (let i = start; i < end; i++) {
      const a = alphaAt ? alpha * alphaAt(i) : alpha;
      const j = i * 3;
      this.push(pts[j], pts[j + 1], pts[j + 2], pts[j + 3], pts[j + 4], pts[j + 5], w, c, a, i === start ? 1 : 0, i === end - 1 && last === end ? 1 : 0);
    }
    const frac = last - end;
    if (frac > 0 && end + 1 < pts.length / 3) {
      const j = end * 3;
      const a = alphaAt ? alpha * alphaAt(end) : alpha;
      this.push(pts[j], pts[j + 1], pts[j + 2],
        pts[j] + (pts[j + 3] - pts[j]) * frac, pts[j + 1] + (pts[j + 4] - pts[j + 1]) * frac, pts[j + 2] + (pts[j + 5] - pts[j + 2]) * frac,
        w, c, a, 0, 1);
    }
  }

  /** world -> CSS px in the canvas box; null when behind the camera */
  project(p: Vec3): { x: number; y: number; depth: number } | null {
    const m = this.vp;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (w < 0.08) return null;
    return { x: (x / w * 0.5 + 0.5) * this.cssW, y: (1 - (y / w * 0.5 + 0.5)) * this.cssH, depth: w };
  }

  end(time: number, flash = 0) {
    const gl = this.gl;
    if (!gl || !this.ok || !this.targets.length) return;
    const [scene] = this.targets;

    // 1. deposit beam geometry, additive, into the HDR scene buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.w, scene.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    if (this.n) {
      gl.useProgram(this.lineProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProg!, "u_vp"), false, this.vp);
      gl.uniform2f(gl.getUniformLocation(this.lineProg!, "u_res"), scene.w, scene.h);
      gl.uniform1f(gl.getUniformLocation(this.lineProg!, "u_px"), this.px);
      gl.uniform2f(gl.getUniformLocation(this.lineProg!, "u_fog"), this.fog[0], this.fog[1]);
      gl.uniform1f(gl.getUniformLocation(this.lineProg!, "u_k"), this.k);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * FLOATS), gl.STREAM_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    }

    // 2. bloom: downsample chain, then additive upsample back to level 1
    gl.bindVertexArray(this.quadVao);
    gl.disable(gl.BLEND);
    gl.useProgram(this.downProg);
    for (let i = 1; i < LEVELS; i++) {
      const src = this.targets[i - 1], dst = this.targets[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(gl.getUniformLocation(this.downProg!, "u_tex"), 0);
      gl.uniform2f(gl.getUniformLocation(this.downProg!, "u_texel"), 1 / src.w, 1 / src.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.upProg);
    for (let i = LEVELS - 1; i > 1; i--) {
      const src = this.targets[i], dst = this.targets[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(gl.getUniformLocation(this.upProg!, "u_tex"), 0);
      gl.uniform2f(gl.getUniformLocation(this.upProg!, "u_texel"), 1 / src.w, 1 / src.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.BLEND);

    // 3. composite the tube to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(gl.getUniformLocation(this.compProg!, "u_scene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[1].tex);
    gl.uniform1i(gl.getUniformLocation(this.compProg!, "u_bloom"), 1);
    gl.uniform3f(gl.getUniformLocation(this.compProg!, "u_bg"), this.bg[0], this.bg[1], this.bg[2]);
    gl.uniform1f(gl.getUniformLocation(this.compProg!, "u_time"), time);
    gl.uniform1f(gl.getUniformLocation(this.compProg!, "u_flash"), flash);
    gl.uniform1f(gl.getUniformLocation(this.compProg!, "u_px"), this.px);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * Release the GPU objects this renderer made. The context itself is left
   * alive: a canvas keeps one context for its whole life, so losing it here
   * would leave the next renderer on the same canvas (the film effect running
   * again) with a dead context. The browser frees it with the canvas.
   */
  destroy() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      for (const t of this.targets) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
      for (const p of [this.lineProg, this.downProg, this.upProg, this.compProg]) if (p) gl.deleteProgram(p);
      if (this.quadVao) gl.deleteVertexArray(this.quadVao);
      if (this.lineVao) gl.deleteVertexArray(this.lineVao);
      if (this.instBuf) gl.deleteBuffer(this.instBuf);
    }
    this.targets = [];
    this.ok = false;
  }
}

/** "152 95% 62%" (a resolved CSS HSL triplet) -> sRGB 0..1 */
export function hslTriplet(v: string, fallback: RGB): RGB {
  const m = v.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return fallback;
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
