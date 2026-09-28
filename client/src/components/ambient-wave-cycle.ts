export const AMBIENT_WAVE_LOOP_SECONDS = 10;

type TraceTuple = readonly [number, number, number];

export type AmbientWavePhase =
  | "charged"
  | "bleed"
  | "pilot"
  | "ignition"
  | "settle"
  | "static";

export interface AmbientWaveCycleState {
  phase: AmbientWavePhase;
  brightness: number;
  amplitude: number;
  width: number;
  tau: number;
  traceWeights: TraceTuple;
  traceReveal: TraceTuple;
  pilot: boolean;
  ignitionSpot: number | null;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

// Canvas equivalent of the site's cubic-bezier(0.16, 1, 0.3, 1) beam ease.
function beamEase(progress: number) {
  const x = clamp01(progress);
  if (x === 0 || x === 1) return x;

  const x1 = 0.16;
  const x2 = 0.3;
  let parameter = x;
  for (let i = 0; i < 5; i++) {
    const inverse = 1 - parameter;
    const currentX =
      3 * inverse * inverse * parameter * x1 +
      3 * inverse * parameter * parameter * x2 +
      parameter * parameter * parameter;
    const derivative =
      3 * inverse * inverse * x1 +
      6 * inverse * parameter * (x2 - x1) +
      3 * parameter * parameter * (1 - x2);
    if (derivative < 0.0001) break;
    parameter = clamp01(parameter - (currentX - x) / derivative);
  }

  return 1 - Math.pow(1 - parameter, 3);
}

const phaseProgress = (time: number, start: number, end: number) =>
  clamp01((time - start) / (end - start));

const stagger = (progress: number, start: number, end: number) =>
  beamEase(phaseProgress(progress, start, end));

export function sampleAmbientWaveCycle(elapsedSeconds: number): AmbientWaveCycleState {
  const time =
    ((elapsedSeconds % AMBIENT_WAVE_LOOP_SECONDS) + AMBIENT_WAVE_LOOP_SECONDS) %
    AMBIENT_WAVE_LOOP_SECONDS;

  if (time < 3) {
    return {
      phase: "charged",
      brightness: 1,
      amplitude: 1,
      width: 1,
      tau: 0.52,
      traceWeights: [1, 1, 1],
      traceReveal: [1, 1, 1],
      pilot: false,
      ignitionSpot: null,
    };
  }

  if (time < 5.2) {
    const raw = phaseProgress(time, 3, 5.2);
    const eased = beamEase(raw);
    const outerWeight = 1 - stagger(raw, 0.15, 0.8);
    return {
      phase: "bleed",
      brightness: lerp(1, 0.06, eased),
      amplitude: lerp(1, 0.06, eased),
      width: lerp(1, 0.68, eased),
      tau: lerp(0.52, 0.06, eased),
      traceWeights: [outerWeight, 1, outerWeight],
      traceReveal: [1, 1, 1],
      pilot: false,
      ignitionSpot: null,
    };
  }

  if (time < 6.3) {
    return {
      phase: "pilot",
      brightness: 0.06,
      amplitude: 0.05,
      width: 0.68,
      tau: 0.06,
      traceWeights: [0, 1, 0],
      traceReveal: [1, 1, 1],
      pilot: true,
      ignitionSpot: null,
    };
  }

  if (time < 7.6) {
    const raw = phaseProgress(time, 6.3, 7.6);
    const eased = beamEase(raw);
    const traceWeights: TraceTuple = [
      stagger(raw, 0.18, 0.68),
      stagger(raw, 0, 0.48),
      stagger(raw, 0.36, 0.86),
    ];
    return {
      phase: "ignition",
      brightness: lerp(0.06, 1.2, eased),
      amplitude: lerp(0.06, 1.08, eased),
      width: lerp(0.68, 1.4, eased),
      tau: lerp(0.06, 1.15, eased),
      traceWeights,
      traceReveal: traceWeights,
      pilot: true,
      ignitionSpot: 0.07 + eased * 0.86,
    };
  }

  const eased = beamEase(phaseProgress(time, 7.6, 10));
  return {
    phase: "settle",
    brightness: lerp(1.2, 1, eased),
    amplitude: lerp(1.08, 1, eased),
    width: lerp(1.4, 1, eased),
    tau: lerp(1.15, 0.52, eased),
    traceWeights: [1, 1, 1],
    traceReveal: [1, 1, 1],
    pilot: false,
    ignitionSpot: null,
  };
}

