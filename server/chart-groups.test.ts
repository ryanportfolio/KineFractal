import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTickerGroups } from "./fearlab-charts";

test("ticker groups keep valid entries and drop the rest", () => {
  const groups = normalizeTickerGroups([
    { id: "g1", name: "  Group   A ", symbols: ["AAPL", "aapl", "NVDA", "bad symbol!"] },
    { id: "g2", name: "group a", symbols: ["SPY"] },        // duplicate name, any case
    { id: "g1", name: "Other", symbols: ["SPY"] },          // duplicate id
    { id: "G 3", name: "Bad id", symbols: ["SPY"] },
    { id: "g4", name: "Empty", symbols: [] },
    { id: "g5", name: "x".repeat(60), symbols: ["QQQ"] },
    "not an object",
  ]);
  assert.deepEqual(groups, [
    { id: "g1", name: "Group A", symbols: ["aapl", "nvda"] },
    { id: "g5", name: "x".repeat(40), symbols: ["qqq"] },
  ]);
});

test("ticker groups cap at 30 and reject non-arrays", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: "g" + i, name: "G" + i, symbols: ["SPY"] }));
  assert.equal(normalizeTickerGroups(many).length, 30);
  assert.deepEqual(normalizeTickerGroups({ groups: [] }), []);
});
