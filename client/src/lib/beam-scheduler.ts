// beam-scheduler — the single-beam law.
//
// A storage scope has one electron beam, so only one thing on this site moves
// at a time. Every animated movement (WebGL canvas, SVG draw, DOM raster)
// registers here; one shared IntersectionObserver watches them all and the
// beam is granted to the visible section nearest the viewport center.
//
//   grant()   — start your animation loop / play your draw-on-arrival
//   revoke()  — stop the loop but LEAVE the last frame (phosphor holds the
//               trace); if your entrance was still playing, snap to done
//
// Sections that have finished a one-shot entrance can tell the scheduler they
// no longer need the beam (release()), letting it fall to the next candidate.

export interface BeamClient {
  el: Element;
  /** the beam arrived — begin/resume animating */
  grant: () => void;
  /** the beam left — stop animating, hold the last frame, finish entrances instantly */
  revoke: () => void;
}

interface Entry {
  client: BeamClient;
  ratio: number;
  visible: boolean;
  done: boolean; // released — one-shot entrance finished, no idle loop wanted
}

const entries = new Map<Element, Entry>();
let io: IntersectionObserver | null = null;
let holder: Entry | null = null;
let scrollBound = false;
let rafPending = 0;

function pick(): Entry | null {
  // nearest visible section center to viewport center wins
  const mid = window.innerHeight / 2;
  let best: Entry | null = null;
  let bestDist = Infinity;
  entries.forEach((e) => {
    if (!e.visible || e.done) return;
    const r = e.client.el.getBoundingClientRect();
    const c = r.top + r.height / 2;
    // sticky showpieces taller than the viewport: measure the on-screen center
    const cc = Math.max(Math.min(c, window.innerHeight), 0);
    const d = Math.abs(cc - mid);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  });
  return best;
}

function arbitrate() {
  rafPending = 0;
  const next = pick();
  if (next === holder) return;
  if (holder) holder.client.revoke();
  holder = next;
  if (holder) holder.client.grant();
}

function requestArbitration() {
  if (rafPending) return;
  rafPending = requestAnimationFrame(arbitrate);
}

function ensureInfra() {
  if (io) return;
  io = new IntersectionObserver(
    (obs) => {
      for (const o of obs) {
        const e = entries.get(o.target);
        if (!e) continue;
        e.ratio = o.intersectionRatio;
        e.visible = o.isIntersecting;
      }
      requestArbitration();
    },
    { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
  );
  if (!scrollBound) {
    // ratios alone can't tell which of two visible sections is more central
    window.addEventListener("scroll", requestArbitration, { passive: true });
    scrollBound = true;
  }
}

export function registerBeam(client: BeamClient): () => void {
  ensureInfra();
  const entry: Entry = { client, ratio: 0, visible: false, done: false };
  entries.set(client.el, entry);
  io!.observe(client.el);
  return () => {
    io?.unobserve(client.el);
    entries.delete(client.el);
    if (holder === entry) {
      holder = null;
      requestArbitration();
    }
  };
}

/** A one-shot section finished its entrance and doesn't idle — free the beam. */
export function releaseBeam(el: Element) {
  const e = entries.get(el);
  if (!e) return;
  e.done = true;
  if (holder === e) {
    holder = null;
    requestArbitration();
  }
}

/** An idle-capable section (hero) may re-request eligibility after release. */
export function rearmBeam(el: Element) {
  const e = entries.get(el);
  if (!e) return;
  e.done = false;
  requestArbitration();
}
