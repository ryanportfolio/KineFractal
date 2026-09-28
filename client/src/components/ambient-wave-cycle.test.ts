import assert from "node:assert/strict";
import test from "node:test";
import {
  AMBIENT_WAVE_LOOP_SECONDS,
  sampleAmbientWaveCycle,
} from "./ambient-wave-cycle";

test("charged drift holds the complete three-trace instrument", () => {
  const state = sampleAmbientWaveCycle(1.5);

  assert.equal(state.phase, "charged");
  assert.deepEqual(state.traceWeights, [1, 1, 1]);
  assert.deepEqual(state.traceReveal, [1, 1, 1]);
  assert.equal(state.brightness, 1);
  assert.equal(state.amplitude, 1);
  assert.equal(state.tau, 0.52);
});

test("power-down reaches a visible one-trace pilot instead of a blank frame", () => {
  const state = sampleAmbientWaveCycle(5.7);

  assert.equal(state.phase, "pilot");
  assert.deepEqual(state.traceWeights, [0, 1, 0]);
  assert.equal(state.pilot, true);
  assert.ok(state.brightness >= 0.05);
  assert.ok(state.brightness <= 0.08);
  assert.ok(state.amplitude >= 0.04);
  assert.ok(state.tau > 0);
  assert.ok(state.tau <= 0.08);
});

test("flyback ignition rebuilds brightness, amplitude, and traces in sequence", () => {
  const early = sampleAmbientWaveCycle(6.45);
  const middle = sampleAmbientWaveCycle(6.95);
  const late = sampleAmbientWaveCycle(7.5);

  assert.equal(early.phase, "ignition");
  assert.equal(middle.phase, "ignition");
  assert.equal(late.phase, "ignition");
  assert.ok(early.brightness < middle.brightness);
  assert.ok(middle.brightness < late.brightness);
  assert.ok(early.amplitude < middle.amplitude);
  assert.ok(middle.amplitude < late.amplitude);
  assert.ok(early.traceWeights[1] > early.traceWeights[0]);
  assert.ok(middle.traceWeights[0] > middle.traceWeights[2]);
  assert.ok(late.traceWeights.every((weight) => weight > 0.95));
  assert.ok(early.ignitionSpot !== null);
  assert.ok(late.ignitionSpot! > early.ignitionSpot!);
});

test("settling lands on the charged state without a loop seam", () => {
  const end = sampleAmbientWaveCycle(AMBIENT_WAVE_LOOP_SECONDS - 0.0001);
  const start = sampleAmbientWaveCycle(AMBIENT_WAVE_LOOP_SECONDS);
  const repeated = sampleAmbientWaveCycle(AMBIENT_WAVE_LOOP_SECONDS + 1.5);

  assert.ok(Math.abs(end.brightness - start.brightness) < 0.001);
  assert.ok(Math.abs(end.amplitude - start.amplitude) < 0.001);
  assert.ok(Math.abs(end.tau - start.tau) < 0.001);
  assert.deepEqual(repeated, sampleAmbientWaveCycle(1.5));
});
