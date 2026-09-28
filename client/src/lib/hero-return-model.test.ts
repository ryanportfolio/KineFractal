import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { intervalReturnFromCumulativePct } from "./hero-return-model";

test("derives an interval return from cumulative percentage wealth", () => {
  assert.ok(Math.abs(intervalReturnFromCumulativePct(10, 21)! - 0.1) < 1e-12);
  assert.ok(Math.abs(intervalReturnFromCumulativePct(-20, -12)! - 0.1) < 1e-12);
});

test("rejects invalid or non-positive wealth inputs", () => {
  assert.equal(intervalReturnFromCumulativePct(-100, 0), null);
  assert.equal(intervalReturnFromCumulativePct(0, -100), null);
  assert.equal(intervalReturnFromCumulativePct(Number.NaN, 10), null);
  assert.equal(intervalReturnFromCumulativePct(10, Number.POSITIVE_INFINITY), null);
});

test("both animated and static hero traces use the cumulative-return converter", () => {
  const source = readFileSync(new URL("../components/hero-signal.tsx", import.meta.url), "utf8");
  const calls = source.match(/intervalReturnFromCumulativePct\(/g) ?? [];
  assert.equal(calls.length, 2);
  assert.doesNotMatch(source, /\.b\s*\/\s*prev/);
});
