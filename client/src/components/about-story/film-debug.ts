// Dev-only review harness for the About film (/about?film=debug in `npm run dev`).
// Adds a bottom bar: pause/play, a scrubber over the whole film, frame steps,
// and a flash detector that logs every frame whose canvas comes out black or
// transparent next to its film position, so a split-second flicker can be
// found again. Click anywhere on the film or press Space to pause.

export interface FilmDebugControls {
  /** jump the film to progress p (0..1) */
  seek(p: number): void;
  /** p one frame back at the film's reading pace */
  stepBack(p: number): number;
}

export interface FrameInfo {
  p: number;
  ms: number;
  scale: number;
  beat: string;
  canvas: HTMLCanvasElement;
}

interface Flash { n: number; p: number; t: number; beat: string; luma: number; was: number; alpha: number; scale: string }

const SAMPLE_W = 32, SAMPLE_H = 18;

export class FilmDebug {
  paused = false;
  /** frames to advance while paused (the step-forward button) */
  steps = 0;
  private time = 0;
  private n = 0;
  private p = 0;
  private scale = 1;
  private recent: number[] = [];
  private flashes: Flash[] = [];
  private dragging = false;
  private detect = true;
  private bar: HTMLDivElement;
  private playBtn: HTMLButtonElement;
  private slider: HTMLInputElement;
  private readout: HTMLSpanElement;
  private log: HTMLDivElement;
  private count: HTMLSpanElement;
  private sample = document.createElement("canvas");
  private sctx: CanvasRenderingContext2D | null;

  constructor(private stage: HTMLElement, private ctl: FilmDebugControls) {
    this.sample.width = SAMPLE_W;
    this.sample.height = SAMPLE_H;
    this.sctx = this.sample.getContext("2d", { willReadFrequently: true });

    const bar = (this.bar = document.createElement("div"));
    bar.dataset.filmDebug = "";
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:8px 12px;background:rgba(0,0,0,.88);" +
      "border-top:1px solid #2a5;color:#cfe;font:12px/1.4 ui-monospace,Consolas,monospace;display:flex;flex-direction:column;gap:6px";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px";
    const btn = (label: string, title: string, on: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.style.cssText = "min-width:34px;padding:4px 8px;background:#132;border:1px solid #2a5;color:#cfe;cursor:pointer;font:inherit";
      b.addEventListener("click", (e) => { e.stopPropagation(); on(); });
      return b;
    };
    this.playBtn = btn("pause", "pause / play (Space, or click the film)", () => this.toggle());
    const back = btn("<", "one frame back (Left arrow)", () => this.stepBack());
    const fwd = btn(">", "one frame forward (Right arrow)", () => this.stepFwd());
    const slider = (this.slider = document.createElement("input"));
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.0001";
    slider.value = "0";
    slider.style.cssText = "flex:1;accent-color:#3c7";
    slider.addEventListener("pointerdown", () => { this.dragging = true; this.setPaused(true); });
    slider.addEventListener("pointerup", () => { this.dragging = false; });
    slider.addEventListener("input", () => { this.setPaused(true); ctl.seek(+slider.value); });
    this.readout = document.createElement("span");
    this.readout.style.cssText = "min-width:360px;white-space:nowrap";
    row.append(this.playBtn, back, fwd, slider, this.readout);

    const row2 = document.createElement("div");
    row2.style.cssText = "display:flex;align-items:flex-start;gap:8px";
    const det = document.createElement("label");
    det.style.cssText = "white-space:nowrap;cursor:pointer";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.addEventListener("change", () => { this.detect = box.checked; this.recent = []; });
    det.append(box, " flash detector ");
    this.count = document.createElement("span");
    const clear = btn("clear", "clear the flash log", () => { this.flashes = []; this.renderLog(); });
    this.log = document.createElement("div");
    this.log.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;max-height:66px;overflow:auto;flex:1";
    const hint = document.createElement("span");
    hint.style.cssText = "opacity:.6;white-space:nowrap";
    hint.textContent = "click film / Space: pause · arrows: step · click a flash to jump there";
    row2.append(det, this.count, clear, this.log, hint);
    bar.append(row, row2);
    document.body.append(bar);
    this.renderLog();

    stage.addEventListener("click", this.onClick);
    window.addEventListener("keydown", this.onKey, true);
  }

  /** film clock in seconds: stops while paused */
  clock(ms: number): number {
    if (!this.paused) this.time += ms / 1000;
    else if (this.steps > 0) this.time += 1 / 60;
    return this.time;
  }

  /** after each drawn frame: update the bar and look for a blank canvas */
  frame(f: FrameInfo) {
    this.n++;
    this.p = f.p;
    const scaleWas = this.scale;
    this.scale = f.scale;
    if (!this.dragging) this.slider.value = f.p.toFixed(4);
    this.readout.textContent =
      `p ${f.p.toFixed(4)} · t ${this.time.toFixed(2)}s · ${f.ms.toFixed(1)}ms · scale ${f.scale.toFixed(2)} · ${f.beat || "-"}`;
    if (!this.detect || !this.sctx || f.canvas.width === 0) return;
    // the WebGL buffer is still readable inside the frame that drew it
    this.sctx.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
    this.sctx.drawImage(f.canvas, 0, 0, SAMPLE_W, SAMPLE_H);
    const px = this.sctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
    let luma = 0, alpha = 0;
    for (let i = 0; i < px.length; i += 4) {
      luma += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      alpha += px[i + 3];
    }
    const cells = px.length / 4;
    luma /= cells;
    alpha /= cells;
    const sorted = [...this.recent].sort((a, b) => a - b);
    const was = sorted.length ? sorted[sorted.length >> 1] : luma;
    // blank: nothing drawn, or far darker than the last dozen frames
    const blank = alpha < 250 || luma < 0.5 || (this.recent.length >= 6 && was > 4 && luma < was * 0.35);
    if (blank) {
      const hit: Flash = {
        n: this.n, p: f.p, t: this.time, beat: f.beat, luma, was, alpha,
        scale: scaleWas !== f.scale ? `${scaleWas.toFixed(2)}->${f.scale.toFixed(2)}` : f.scale.toFixed(2),
      };
      this.flashes.push(hit);
      console.warn("about film: blank frame", hit);
      this.renderLog();
    } else {
      this.recent.push(luma);
      if (this.recent.length > 12) this.recent.shift();
    }
  }

  destroy() {
    this.stage.removeEventListener("click", this.onClick);
    window.removeEventListener("keydown", this.onKey, true);
    this.bar.remove();
  }

  private setPaused(on: boolean) {
    this.paused = on;
    this.playBtn.textContent = on ? "play" : "pause";
  }

  private toggle() {
    this.setPaused(!this.paused);
    if (!this.paused) this.ctl.seek(this.p); // resume playing from here
  }

  private stepFwd() {
    this.setPaused(true);
    this.steps++;
  }

  private stepBack() {
    this.setPaused(true);
    this.time = Math.max(0, this.time - 1 / 60);
    this.ctl.seek(this.ctl.stepBack(this.p));
  }

  private onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest("a,button,input,[data-film-debug]")) return;
    this.toggle();
  };

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t !== this.slider) return;
    if (e.key === " ") this.toggle();
    else if (e.key === "ArrowRight") this.stepFwd();
    else if (e.key === "ArrowLeft") this.stepBack();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  private renderLog() {
    this.count.textContent = `${this.flashes.length} blank`;
    this.log.replaceChildren(
      ...this.flashes.slice(-40).map((f) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `p ${f.p.toFixed(4)} ${f.beat || "-"} luma ${f.luma.toFixed(0)}/${f.was.toFixed(0)} a${f.alpha.toFixed(0)} s${f.scale}`;
        b.title = `frame ${f.n}, film clock ${f.t.toFixed(2)}s`;
        b.style.cssText = "padding:2px 6px;background:#311;border:1px solid #a33;color:#fcc;cursor:pointer;font:inherit";
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.setPaused(true);
          this.ctl.seek(f.p);
        });
        return b;
      }),
    );
  }
}
