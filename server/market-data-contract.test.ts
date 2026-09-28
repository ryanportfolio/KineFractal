import assert from "node:assert/strict";
import test from "node:test";
import type { DailyBar } from "@shared/market-data";
import {
  MarketMatrixUnavailableError,
  requireCommonMarketHistory,
  requireCompleteMarketMatrix,
} from "./market-data-contract";

const bar: DailyBar = {
  date: "2026-07-13",
  open: 100,
  high: 102,
  low: 99,
  close: 101,
  volume: 1_000,
  adjClose: 101,
};

test("requires every requested ticker to have a non-empty canonical series", () => {
  const incomplete = new Map<string, DailyBar[]>([["SPY", []]]);

  assert.throws(
    () => requireCompleteMarketMatrix(["SPY", "UUP"], incomplete),
    (error: unknown) => {
      assert(error instanceof MarketMatrixUnavailableError);
      assert.match(error.message, /SPY/);
      assert.match(error.message, /UUP/);
      return true;
    },
  );

  const complete = new Map<string, DailyBar[]>([
    ["SPY", [bar]],
    ["UUP", [{ ...bar, close: 104, adjClose: 104 }]],
  ]);
  assert.doesNotThrow(() => requireCompleteMarketMatrix(["SPY", "UUP"], complete));
});

test("requires enough shared market-history dates before ratio calculations", () => {
  const truncated = new Map<string, DailyBar[]>([
    ["SPY", [
      { ...bar, date: "2026-07-10" },
      { ...bar, date: "2026-07-11" },
    ]],
    ["UUP", [
      { ...bar, date: "2026-07-11", close: 104, adjClose: 104 },
    ]],
  ]);
  const disjoint = new Map<string, DailyBar[]>([
    ["SPY", [{ ...bar, date: "2026-07-10" }]],
    ["UUP", [{ ...bar, date: "2026-07-13", close: 104, adjClose: 104 }]],
  ]);

  for (const matrix of [truncated, disjoint]) {
    assert.throws(
      () => requireCommonMarketHistory(["SPY", "UUP"], matrix, 2),
      MarketMatrixUnavailableError,
    );
  }

  const complete = new Map<string, DailyBar[]>([
    ["SPY", [
      { ...bar, date: "2026-07-11" },
      { ...bar, date: "2026-07-10" },
    ]],
    ["UUP", [
      { ...bar, date: "2026-07-10", close: 104, adjClose: 104 },
      { ...bar, date: "2026-07-11", close: 105, adjClose: 105 },
    ]],
  ]);

  assert.deepEqual(
    requireCommonMarketHistory(["SPY", "UUP"], complete, 2),
    ["2026-07-10", "2026-07-11"],
  );
});
