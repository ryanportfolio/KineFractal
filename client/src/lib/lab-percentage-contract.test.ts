import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fetchReportLive } from "../data/lab-data";

const report = readFileSync(new URL("../pages/lab-report.tsx", import.meta.url), "utf8");
const curve = readFileSync(new URL("../components/lab/equity-curve.tsx", import.meta.url), "utf8");
const data = readFileSync(new URL("../data/lab-data.ts", import.meta.url), "utf8");
const commandLine = readFileSync(new URL("../components/command-line.tsx", import.meta.url), "utf8");

function normalizedReport() {
  return {
    key: "spy-1d-full-v4.6", sym: "SPY", tf: "1d", start: "full", label: "full history",
    window: { start: "2000-01-03", end: "2026-07-10" }, generated: "2026-07-11T00:00:00Z", lastBar: 1,
    headline: {
      ret: 10, bench_ret: 8, edge_pp: 2, irr: 5, bench_irr: 4, dd: -12, bench_dd: -20,
      trades: 1, money_in: 1, final_equity: 1, net_pnl: 1, realized_pnl: 1,
      win_rate: 60, profit_factor: 1.5, open_lots: 1, exposure_end: 20, exposure_avg: 30, cash_end: 1,
    },
    fear: { on: true, floorPct: 25, power: 2, minPct: 3, maxPct: 100, confluence: false, nowPct: 30 },
    curveBasis: "cash_flow_adjusted", yearlyBasis: "carried",
    curve: [{ t: 1, s: 0, b: 0 }], drawdown: [{ t: 1, s: 0, b: 0 }], invested: [{ t: 1, v: 20 }],
    yearly: [{ y: 2026, partial: true, spnl: 1, spct: 2, bpct: 1, edge: 1, contrib: 0 }],
    monthly: [{ y: 2026, m: 1, s: 2, b: 1 }],
    attribution: [{ eng: "fav", buys: 1, buy_flow_pct: 100, return_contrib_pp: 2 }],
    trimTags: { G1: 1 },
    recent: [{ ts: 1, side: "buy", label: "F", n: 1, price: 123.45, account_pct: 3, lot_return_pct: null }],
    cards: [],
  };
}

test("lab report never renders account-scale money", () => {
  for (const forbidden of [
    "fmtMoney(", "fmtMoneyFull(", "h.money_in", "h.final_equity",
    "h.realized_pnl", "r.usd_in", "r.realized", "r.open_pnl", "e.usd",
    "same deposits", "locked profit",
  ]) {
    assert.ok(!report.includes(forbidden), `lab report still contains ${forbidden}`);
  }
});

test("lab report names its normalized percentage bases", () => {
  for (const required of [
    "cash-flow-adjusted", "funding schedule", "profit factor",
    "buy_flow_pct", "return_contrib_pp", "account_pct", "lot_return_pct",
    "account move", "lot return", "ETF price",
  ]) {
    assert.ok(report.includes(required), `lab report missing ${required}`);
  }
});

test("equity curve renders return percentages, never money", () => {
  assert.ok(curve.includes("fmtPct"));
  assert.ok(curve.includes("cash-flow-adjusted cumulative return"));
  assert.ok(!curve.includes("fmtMoney"));
  assert.ok(!curve.includes("same deposits"));
});

test("lab artifact types expose normalized public fields", () => {
  for (const required of [
    "curveBasis", "yearlyBasis", "buy_flow_pct", "return_contrib_pp",
    "account_pct", "lot_return_pct",
  ]) {
    assert.ok(data.includes(required), `lab data contract missing ${required}`);
  }
});

test("old live report falls back to a normalized static artifact", async () => {
  const old = { headline: {}, curve: [{ t: 1, s: 1000, b: 1000 }], attribution: [], recent: [] };
  const normalized = normalizedReport();
  const prior = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return { ok: true, json: async () => calls === 1 ? old : normalized } as Response;
  }) as typeof fetch;
  try {
    const result = await fetchReportLive("old-live");
    assert.equal(calls, 2);
    assert.equal(result.meta.live, false);
    assert.equal(result.data.curveBasis, "cash_flow_adjusted");
  } finally {
    globalThis.fetch = prior;
  }
});

test("normalized reports fail closed when a consumed field is malformed", async () => {
  const malformed = normalizedReport() as any;
  delete malformed.headline.irr;
  const prior = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => malformed } as Response)) as typeof fetch;
  try {
    await assert.rejects(fetchReportLive("partial-normalized"), /no report/);
  } finally {
    globalThis.fetch = prior;
  }
});

test("old live and old static reports fail closed", async () => {
  const old = { headline: {}, curve: [{ t: 1, s: 1000, b: 1000 }], attribution: [], recent: [] };
  const prior = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => old } as Response)) as typeof fetch;
  try {
    await assert.rejects(fetchReportLive("old-everywhere"), /no report/);
  } finally {
    globalThis.fetch = prior;
  }
});

test("command-line recent report events use normalized percentages", () => {
  assert.ok(commandLine.includes("f.account_pct"));
  assert.ok(commandLine.includes("f.lot_return_pct"));
  assert.ok(commandLine.includes("ETF price"));
  assert.ok(!commandLine.includes("f.qty} sh"));
  assert.ok(!commandLine.includes("fmtMoney(f.usd)"));
});

test("command-line report summary never renders account dollars", () => {
  assert.ok(!commandLine.includes("fmtMoney"));
  assert.ok(!commandLine.includes("h.final_equity"));
  assert.ok(!commandLine.includes("h.money_in"));
  assert.ok(commandLine.includes("h.bench_ret"));
  assert.ok(commandLine.includes("h.edge_pp"));
});

test("recent sell detail remains visible on mobile", () => {
  assert.match(report, /lot return/);
  assert.match(report, /block md:hidden[^>]*>\{detail\}/s);
});

test("attribution explains its percentage-point basis and scope", () => {
  assert.ok(report.includes("trading P&amp;L contribution"));
  assert.ok(report.includes("percentage points of money in"));
  assert.ok(report.includes("need not sum to headline return"));
});
