import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CHART_LINE_CACHE_PREFIX, clearChartLineCache } from "./chart-line-cache";

function memoryStorage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

test("clears every cached drawn-line entry and nothing else", () => {
  const s = memoryStorage({
    "fearlab_hand_spy-super": "[1]",
    "fearlab_hand_qqq-super-4h": "[2]",
    fearlab_charts_sel: "spy-super",
  });
  clearChartLineCache(s);
  assert.equal(s.length, 1);
  assert.equal(s.getItem("fearlab_charts_sel"), "spy-super");
});

test("prefix matches the chart page's LS_HAND", () => {
  const html = readFileSync(new URL("../../../server/charts-app/charts.html", import.meta.url), "utf8");
  assert.match(html, new RegExp(`var LS_HAND = '${CHART_LINE_CACHE_PREFIX}';`));
});
