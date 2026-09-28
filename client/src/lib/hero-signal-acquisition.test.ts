import assert from "node:assert/strict";
import test from "node:test";
import { acquisitionDuration, acquisitionProgress } from "./hero-signal-acquisition";

test("first visits get the full acquisition and returns stay brisk", () => {
  assert.equal(acquisitionDuration(false), 1100);
  assert.equal(acquisitionDuration(true), 650);
});

test("acquisition progress clamps and eases into and out of the scan", () => {
  assert.equal(acquisitionProgress(-1, 1100), 0);
  assert.equal(acquisitionProgress(0, 1100), 0);
  assert.equal(acquisitionProgress(1100, 1100), 1);
  assert.equal(acquisitionProgress(2000, 1100), 1);
  assert.ok(acquisitionProgress(275, 1100) > 0.1);
  assert.ok(acquisitionProgress(275, 1100) < 0.25);
  assert.equal(acquisitionProgress(550, 1100), 0.5);
});
