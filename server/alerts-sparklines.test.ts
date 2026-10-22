import assert from "node:assert/strict";
import test from "node:test";
import { dailyCloses } from "./alerts-routes";

const DAY = 86_400;

test("dailyCloses keeps the last close of each day, oldest first", () => {
  const candles = [
    { time: 2 * DAY + 3600, close: 12 },
    { time: DAY + 3600, close: 10 },
    { time: DAY + 7200, close: 11 },
    { time: 2 * DAY + 7200, close: 13 },
  ];
  assert.deepEqual(dailyCloses(candles), [11, 13]);
});

test("dailyCloses keeps only the most recent days and skips bad candles", () => {
  const candles = Array.from({ length: 30 }, (_, day) => ({ time: day * DAY, close: day }));
  candles.push({ time: Number.NaN, close: 99 }, { time: 31 * DAY, close: "x" as unknown as number });
  const closes = dailyCloses(candles, 5);
  assert.deepEqual(closes, [25, 26, 27, 28, 29]);
  assert.deepEqual(dailyCloses(undefined), []);
});
