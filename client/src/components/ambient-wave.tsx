// Decorative standing-wave study, adapted from the retired fear gauges.
// Geometry is deterministic atmosphere only: no strategy or market data.
import { useEffect, useRef } from "react";
import { sampleAmbientWaveCycle } from "@/components/ambient-wave-cycle";
import { createPersistenceEngine } from "@/components/persistence-engine";

const TRACES = [
  { center: 0.34, amplitude: 0.105, speed: 0.76, phase: 0.72, energy: 0.28, width: 1.25 },
  { center: 0.50, amplitude: 0.095, speed: 0.94, phase: 1.68, energy: 0.36, width: 1.45 },
  { center: 0.66, amplitude: 0.082, speed: 1.12, phase: 2.54, energy: 0.46, width: 1.7 },
] as const;

export default function AmbientWave() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let visibleClock = 0;
    const engine = createPersistenceEngine(canvas, {
      tau: 0.52,
      bufferScale: 0.6,
      onFrame: (api, _t, dt) => {
        visibleClock += dt;
        const state = sampleAmbientWaveCycle(visibleClock);
        api.setTau(state.tau);

        if (state.pilot) {
          const pilot = TRACES[1];
          const pilotPoints: number[] = [];
          const pilotSwing = Math.sin(visibleClock * pilot.speed * Math.PI + pilot.phase);
          for (let i = 0; i <= 56; i++) {
            const u = i / 56;
            const envelope = Math.sin(u * Math.PI);
            pilotPoints.push(
              0.07 + u * 0.86,
              pilot.center - pilot.amplitude * 0.05 * envelope * Math.sin(u * Math.PI * 5) * pilotSwing,
            );
          }
          api.path(pilotPoints, {
            energy: pilot.energy * state.brightness,
            width: pilot.width * 0.68,
          });
        }

        if (state.phase !== "pilot") {
          for (let index = 0; index < TRACES.length; index++) {
            const trace = TRACES[index];
            const weight = state.traceWeights[index];
            if (weight <= 0.001) continue;
            const swing = Math.sin(visibleClock * trace.speed * Math.PI + trace.phase);
            const points: number[] = [];
            const steps = 56;
            const lastStep = Math.max(1, Math.ceil(steps * state.traceReveal[index]));
            for (let i = 0; i <= lastStep; i++) {
              const u = i / steps;
              const envelope = Math.sin(u * Math.PI);
              const y = trace.center - trace.amplitude * state.amplitude * envelope
                * Math.sin(u * Math.PI * 5) * swing;
              points.push(0.07 + u * 0.86, y);
            }
            const energy = trace.energy * state.brightness * weight;
            const width = trace.width * state.width;
            api.path(points, { energy, width });
            if (state.phase !== "ignition") {
              api.spot(
                points[points.length - 2],
                points[points.length - 1],
                energy * 0.9,
                width * 1.35,
              );
            }
          }
        }

        if (state.ignitionSpot !== null) {
          const trace = TRACES[1];
          const u = (state.ignitionSpot - 0.07) / 0.86;
          const envelope = Math.sin(u * Math.PI);
          const swing = Math.sin(visibleClock * trace.speed * Math.PI + trace.phase);
          const y = trace.center - trace.amplitude * state.amplitude * envelope
            * Math.sin(u * Math.PI * 5) * swing;
          api.spot(
            state.ignitionSpot,
            y,
            Math.min(1, 0.45 + state.brightness * 0.45),
            2.4 * state.width,
          );
        }
      },
    });
    engine.renderOnce();

    if (!engine.ok) return () => engine.destroy();

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) engine.start();
      else engine.stop();
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      engine.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="block h-full w-full"
      data-testid="rulebook-ambient-wave"
    />
  );
}
