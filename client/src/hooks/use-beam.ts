// useBeam — React binding for the single-beam scheduler.
//
// Returns a phase: "dark" (waiting for the beam) | "drawing" (granted; play
// your entrance / run your loop) | "held" (beam left or entrance finished;
// hold the final state). One-shot sections (releaseAfter set) latch into
// "held" once their entrance completes and never re-animate. Idle sections
// (no releaseAfter — the sweep, the gauges) re-take the beam every time it
// returns, so their loops resume when scrolled back to.
import { useEffect, useRef, useState } from "react";
import { registerBeam, releaseBeam } from "@/lib/beam-scheduler";

export type BeamPhase = "dark" | "drawing" | "held";

export function useBeam<T extends Element>(opts?: {
  /** ms after grant at which a one-shot entrance is finished and the beam is released */
  releaseAfter?: number;
}) {
  const ref = useRef<T | null>(null);
  const [phase, setPhase] = useState<BeamPhase>("dark");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const releaseAfter = opts?.releaseAfter;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let released = false;
    const unregister = registerBeam({
      el,
      grant: () => {
        // one-shot sections stay held after their entrance; idle sections
        // resume whenever the beam comes back
        if (released) return;
        setPhase("drawing");
        if (releaseAfter != null && releaseTimer == null) {
          releaseTimer = setTimeout(() => {
            released = true;
            setPhase("held");
            releaseBeam(el);
          }, releaseAfter);
        }
      },
      revoke: () => {
        // beam left mid-draw: snap to final state; a one-shot entrance that
        // already started completes instantly and releases for good
        if (phaseRef.current === "dark") return;
        setPhase("held");
        if (releaseAfter != null) {
          if (releaseTimer) clearTimeout(releaseTimer);
          released = true;
          releaseBeam(el);
        }
      },
    });
    return () => {
      if (releaseTimer) clearTimeout(releaseTimer);
      unregister();
    };
  }, [releaseAfter]);

  return { ref, phase };
}
