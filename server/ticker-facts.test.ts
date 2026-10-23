import assert from "node:assert/strict";
import test from "node:test";
import {
  clearTickerFactsCache,
  computeTickerFacts,
  fetchFactsForSymbols,
  fetchTickerFacts,
  nextNewYorkRefresh,
  TickerFactsUnavailableError,
  type TickerFactsRow,
} from "./ticker-facts";

const DAY = 86_400_000;
const AS_OF = "2026-10-01";

// n consecutive calendar days ending AS_OF; close(i) for i = 0 (oldest) .. n-1.
function rows(n: number, close: (i: number) => number = () => 100): TickerFactsRow[] {
  const end = Date.parse(AS_OF);
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(end - (n - 1 - i) * DAY).toISOString().slice(0, 10),
    close: close(i),
    divCash: 0,
  }));
}

function daysBefore(days: number): string {
  return new Date(Date.parse(AS_OF) - days * DAY).toISOString().slice(0, 10);
}

// Set divCash on the rows whose dates are `days` before AS_OF.
function pay(list: TickerFactsRow[], payouts: [days: number, amount: number][]): TickerFactsRow[] {
  for (const [days, amount] of payouts) {
    const row = list.find((r) => r.date === daysBefore(days));
    assert.ok(row, `no row ${days} days before ${AS_OF}`);
    row.divCash = amount;
  }
  return list;
}

test("monthly payer: windows, overall, yield and cadence", () => {
  // Rising line: every window is up.
  const list = pay(rows(400, (i) => 50 + i * 0.1), Array.from({ length: 12 }, (_, m) => [m * 30 + 5, 0.2] as [number, number]));
  const f = computeTickerFacts("cloz", list);
  const close = 50 + 399 * 0.1;
  assert.equal(f.symbol, "CLOZ");
  assert.equal(f.asOf, AS_OF);
  assert.equal(f.close, close);
  assert.deepEqual(f.windows.d21, {
    change: Number(((close / list[399 - 21].close - 1) * 100).toFixed(1)),
    verdict: "BULLISH",
    startDate: list[399 - 21].date,
    startClose: list[399 - 21].close,
  });
  assert.equal(f.windows.m3?.startDate, list[399 - 63].date);
  assert.equal(f.windows.m6?.startDate, list[399 - 126].date);
  assert.equal(f.upCount, 3);
  assert.equal(f.overall, "UP");
  assert.equal(f.high6m, close);
  assert.equal(f.vs6mHigh, 0);
  assert.equal(f.cadence, "monthly");
  assert.equal(f.payouts.length, 12);
  assert.equal(f.payouts[0].exDate, daysBefore(335));   // oldest first
  assert.equal(f.lastExDate, daysBefore(5));
  assert.equal(f.yield, Number((2.4 / close * 100).toFixed(2)));
  assert.equal(f.special, false);
  assert.match(f.source, /price change/);
});

test("quarterly payer, falling price: DOWN and distance from the 6-month high", () => {
  const list = pay(rows(400, (i) => 200 - i * 0.2), [[10, 1], [100, 1], [190, 1], [280, 1]]);
  const f = computeTickerFacts("SPY", list);
  assert.equal(f.cadence, "quarterly");
  assert.equal(f.upCount, 0);
  assert.equal(f.overall, "DOWN");
  assert.equal(f.windows.d21?.verdict, "BEARISH");
  const high = list[400 - 126].close;               // oldest of the last 126 bars
  assert.equal(f.high6m, high);
  assert.equal(f.vs6mHigh, Number(((f.close / high - 1) * 100).toFixed(1)));
  assert.equal(f.special, false);
});

test("no payouts: yield null, cadence none, no last ex-date", () => {
  const f = computeTickerFacts("TSLA", rows(300));
  assert.equal(f.yield, null);
  assert.equal(f.cadence, "none");
  assert.deepEqual(f.payouts, []);
  assert.equal(f.lastExDate, null);
  assert.equal(f.special, false);
});

test("payouts with no regular spacing read as irregular", () => {
  // Gaps 35, 40, 50, 60, 70, 70 days: median 55, between monthly and quarterly.
  const list = pay(rows(400), [[5, 0.1], [40, 0.1], [90, 0.1], [130, 0.1], [200, 0.1], [260, 0.1], [330, 0.1]]);
  assert.equal(computeTickerFacts("X", list).cadence, "irregular");
});

test("semiannual and annual cadences", () => {
  assert.equal(computeTickerFacts("X", pay(rows(400), [[20, 1], [200, 1]])).cadence, "semiannual");
  assert.equal(computeTickerFacts("X", pay(rows(400), [[20, 1]])).cadence, "annual");
  assert.equal(computeTickerFacts("X", pay(rows(400), [[10, 1], [375, 1]])).cadence, "annual");
});

test("cadence comes from payout spacing, not the count", () => {
  const cadence = (days: number[]) =>
    computeTickerFacts("X", pay(rows(400), days.map((d) => [d, 0.1] as [number, number]))).cadence;
  // 52 weekly payouts: a count rule would call this monthly.
  assert.equal(cadence(Array.from({ length: 52 }, (_, w) => 2 + w * 7)), "weekly");
  // Started paying monthly 3 months ago: a count rule would call this quarterly.
  assert.equal(cadence([3, 33, 63]), "monthly");
  assert.equal(cadence([10, 100, 190, 280]), "quarterly");
  // Boundaries: median gap 10 is weekly, 11 to 19 irregular, 20 and 40 monthly.
  assert.equal(cadence([1, 11, 21]), "weekly");
  assert.equal(cadence([1, 16, 31]), "irregular");
  assert.equal(cadence([1, 21, 41]), "monthly");
  assert.equal(cadence([1, 41, 81]), "monthly");
  assert.equal(cadence([1, 76, 151]), "quarterly");
  assert.equal(cadence([1, 106, 211]), "quarterly");
  assert.equal(cadence([1, 107, 213]), "irregular");
});

test("cadence uses older payouts but is none when nothing paid in the trailing year", () => {
  // Monthly until 13 months ago, then stopped.
  assert.equal(computeTickerFacts("X", pay(rows(400), [[395, 0.1], [380, 0.1], [370, 0.1]])).cadence, "none");
  // One trailing payout plus older ones a month apart: monthly, though only one counts for yield.
  const f = computeTickerFacts("X", pay(rows(400), [[396, 0.1], [366, 0.1], [336, 0.1]]));
  assert.equal(f.cadence, "monthly");
  assert.equal(f.payouts.length, 1);
});

test("a 2-for-1 split with an unchanged position shows no loss and adjusts payouts", () => {
  // 200 before the split 10 bars ago, 100 after: the same position in today's shares.
  const list = rows(300, (i) => (i < 290 ? 200 : 100));
  list[290].splitFactor = 2;
  pay(list, [[200, 1], [100, 1], [5, 0.5]]);         // 1.00 on old shares = 0.50 today
  const f = computeTickerFacts("SPLT", list);
  for (const w of [f.windows.d21, f.windows.m3, f.windows.m6]) {
    assert.equal(w?.change, 0);
    assert.equal(w?.verdict, "FLAT");
    assert.equal(w?.startClose, 100);
  }
  assert.equal(f.high6m, 100);
  assert.equal(f.vs6mHigh, 0);
  assert.equal(f.close, 100);
  assert.deepEqual(f.payouts.map((p) => p.amount), [0.5, 0.5, 0.5]);
  assert.equal(f.yield, 1.5);
  assert.equal(f.special, false);
});

test("split factors compound and a missing or 0 factor counts as 1", () => {
  // 3-for-1 then 2-for-1: the oldest close is divided by 6.
  const list = rows(30, (i) => (i < 10 ? 600 : i < 20 ? 200 : 100));
  list[10].splitFactor = 3;
  list[20].splitFactor = 2;
  list[25].splitFactor = 0;
  const f = computeTickerFacts("X", list);
  assert.equal(f.windows.d21?.startClose, 100);
  assert.equal(f.windows.d21?.change, 0);
  assert.equal(f.high6m, 100);
});

test("special payout: one amount above twice the median", () => {
  const special = pay(rows(400), [[10, 0.5], [100, 0.5], [190, 1.6], [280, 0.5]]);
  assert.equal(computeTickerFacts("X", special).special, true);
  // Exactly twice the median is not special.
  const edge = pay(rows(400), [[10, 0.5], [100, 0.5], [190, 1], [280, 0.5]]);
  assert.equal(computeTickerFacts("X", edge).special, false);
  // Fewer than 3 payouts is never special.
  const two = pay(rows(400), [[10, 0.1], [190, 5]]);
  assert.equal(computeTickerFacts("X", two).special, false);
});

test("fewer than 127 bars: m6 null and overall null", () => {
  const f = computeTickerFacts("NEW", rows(126, (i) => 10 + i));
  assert.equal(f.windows.m6, null);
  assert.notEqual(f.windows.m3, null);
  assert.notEqual(f.windows.d21, null);
  assert.equal(f.upCount, 2);
  assert.equal(f.overall, null);
  assert.equal(f.high6m, 135);
  // 127 bars is enough for the 126-bar window.
  assert.notEqual(computeTickerFacts("NEW", rows(127)).windows.m6, null);
  // 21 bars or fewer: no windows at all.
  const tiny = computeTickerFacts("NEW", rows(21));
  assert.deepEqual(tiny.windows, { d21: null, m3: null, m6: null });
  assert.equal(tiny.upCount, 0);
  assert.equal(tiny.overall, null);
});

test("unchanged price over a window is FLAT and mixed windows read MIXED", () => {
  // Flat for the last 30 bars, rising before that.
  const list = rows(200, (i) => (i < 170 ? 50 + i * 0.1 : 50 + 169 * 0.1));
  const f = computeTickerFacts("X", list);
  assert.equal(f.windows.d21?.change, 0);
  assert.equal(f.windows.d21?.verdict, "FLAT");
  assert.equal(f.windows.m3?.verdict, "BULLISH");
  assert.equal(f.upCount, 2);
  assert.equal(f.overall, "MIXED");
});

test("365-day cutoff: a payout exactly 365 days back is outside the trailing year", () => {
  const list = pay(rows(400), [[365, 1], [364, 0.5]]);
  const f = computeTickerFacts("X", list);
  assert.deepEqual(f.payouts, [{ exDate: daysBefore(364), amount: 0.5 }]);
  assert.equal(f.yield, 0.5);

  // Only an old payout: not trailing, but still the last ex-date on record.
  const old = computeTickerFacts("X", pay(rows(400), [[365, 1]]));
  assert.deepEqual(old.payouts, []);
  assert.equal(old.yield, null);
  assert.equal(old.cadence, "none");
  assert.equal(old.lastExDate, daysBefore(365));
});

test("yield rounds to 2 decimals and change to 1", () => {
  const list = pay(rows(400, () => 7), [[30, 1]]);
  assert.equal(computeTickerFacts("X", list).yield, 14.29);       // 14.2857...
  const up = rows(30, (i) => (i === 29 ? 103.04 : 100));
  assert.equal(computeTickerFacts("X", up).windows.d21?.change, 3);   // 3.04 -> 3.0
  const up2 = rows(30, (i) => (i === 29 ? 103.06 : 100));
  assert.equal(computeTickerFacts("X", up2).windows.d21?.change, 3.1);
});

test("next 18:30 New York refresh", () => {
  // 17:05 EDT -> same day 18:30 EDT (22:30 UTC): a close that lands after 17:00 is still picked up.
  assert.equal(nextNewYorkRefresh(new Date("2026-10-23T21:05:00Z")), Date.parse("2026-10-23T22:30:00Z"));
  // 18:31 EDT -> next day.
  assert.equal(nextNewYorkRefresh(new Date("2026-10-23T22:31:00Z")), Date.parse("2026-10-24T22:30:00Z"));
  // Exactly 18:30 -> next day (strictly after).
  assert.equal(nextNewYorkRefresh(new Date("2026-10-23T22:30:00Z")), Date.parse("2026-10-24T22:30:00Z"));
  // Winter (EST, UTC-5): 18:00 EST -> 18:30 EST same day.
  assert.equal(nextNewYorkRefresh(new Date("2026-12-01T23:00:00Z")), Date.parse("2026-12-01T23:30:00Z"));
  // Across the November DST change: 2026-11-01 01:00 EST -> 18:30 EST same day.
  assert.equal(nextNewYorkRefresh(new Date("2026-11-01T06:00:00Z")), Date.parse("2026-11-01T23:30:00Z"));
  // Across the March DST change: 2027-03-13 19:00 EST -> 2027-03-14 18:30 EDT.
  assert.equal(nextNewYorkRefresh(new Date("2027-03-14T00:00:00Z")), Date.parse("2027-03-14T22:30:00Z"));
});

// --- fetch path -------------------------------------------------------------

const KEY = "test-key-9f3a";

function tiingoBody(n = 200): string {
  return JSON.stringify(rows(n).map((r, i) => ({
    date: `${r.date}T00:00:00.000Z`,
    close: 100 + i,
    divCash: i === n - 10 ? 0.25 : 0.0,
  })));
}

function stubFetch(answer: () => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return answer();
  }) as typeof fetch;
  return { fn, calls };
}

function withKey(t: { after: (fn: () => void) => void }) {
  const saved = { a: process.env.TIINGO_API_KEY, b: process.env.VITE_T };
  process.env.TIINGO_API_KEY = ` ${KEY} `;
  delete process.env.VITE_T;
  clearTickerFactsCache();
  t.after(() => {
    if (saved.a === undefined) delete process.env.TIINGO_API_KEY; else process.env.TIINGO_API_KEY = saved.a;
    if (saved.b === undefined) delete process.env.VITE_T; else process.env.VITE_T = saved.b;
    clearTickerFactsCache();
  });
}

const NOW = new Date("2026-10-23T18:00:00Z");   // 14:00 EDT

test("fetch sends the key in the Authorization header, never the URL", async (t) => {
  withKey(t);
  const { fn, calls } = stubFetch(() => new Response(tiingoBody(), { status: 200 }));
  const f = await fetchTickerFacts("cloz", { fetch: fn, now: () => NOW });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url,
    "https://api.tiingo.com/tiingo/daily/CLOZ/prices?startDate=2025-09-18&columns=date,close,divCash,splitFactor");
  assert.ok(!url.includes(KEY));
  assert.equal((init?.headers as Record<string, string>).Authorization, `Token ${KEY}`);
  assert.equal(f?.symbol, "CLOZ");
  assert.equal(f?.asOf, AS_OF);
  assert.equal(f?.close, 299);
  assert.equal(f?.payouts.length, 1);
});

test("fetch applies Tiingo's splitFactor; a missing one counts as 1", async (t) => {
  withKey(t);
  const body = JSON.stringify(rows(200).map((r, i) => ({
    date: `${r.date}T00:00:00.000Z`,
    close: i < 190 ? 80 : 20,                       // 4-for-1 split 10 bars ago
    divCash: i === 100 ? 0.4 : 0.0,
    ...(i === 190 ? { splitFactor: 4 } : i % 2 ? { splitFactor: 1 } : {}),
  })));
  const { fn } = stubFetch(() => new Response(body, { status: 200 }));
  const f = await fetchTickerFacts("SPLT", { fetch: fn, now: () => NOW });
  assert.equal(f?.windows.m6?.change, 0);
  assert.equal(f?.windows.m6?.startClose, 20);
  assert.equal(f?.vs6mHigh, 0);
  assert.deepEqual(f?.payouts.map((p) => p.amount), [0.1]);
});

test("the legacy VITE_T key is used when TIINGO_API_KEY is unset", async (t) => {
  withKey(t);
  delete process.env.TIINGO_API_KEY;
  process.env.VITE_T = "legacy-key";
  const { fn, calls } = stubFetch(() => new Response(tiingoBody(), { status: 200 }));
  await fetchTickerFacts("SPY", { fetch: fn, now: () => NOW });
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Token legacy-key");
});

test("Tiingo 404 resolves to null", async (t) => {
  withKey(t);
  const { fn } = stubFetch(() => new Response('{"detail":"not found"}', { status: 404 }));
  assert.equal(await fetchTickerFacts("ZZZZ", { fetch: fn, now: () => NOW }), null);
});

test("other Tiingo failures throw without the key in the message", async (t) => {
  withKey(t);
  const { fn } = stubFetch(() => new Response("boom", { status: 500 }));
  await assert.rejects(fetchTickerFacts("SPY", { fetch: fn, now: () => NOW }), (e: unknown) => {
    assert.ok(e instanceof TickerFactsUnavailableError);
    assert.equal(e.upstreamStatus, 500);
    assert.ok(!e.message.includes(KEY));
    return true;
  });
  const broken = (async () => { throw new Error(`socket closed for token=${KEY}`); }) as typeof fetch;
  await assert.rejects(fetchTickerFacts("QQQ", { fetch: broken, now: () => NOW }), (e: unknown) => {
    assert.ok(e instanceof TickerFactsUnavailableError);
    assert.ok(!e.message.includes(KEY));
    return true;
  });
});

test("cache hit avoids a second request until the next 18:30 New York", async (t) => {
  withKey(t);
  const { fn, calls } = stubFetch(() => new Response(tiingoBody(), { status: 200 }));
  let now = NOW;
  const clock = () => now;
  await fetchTickerFacts("SPY", { fetch: fn, now: clock });
  now = new Date("2026-10-23T22:29:00Z");          // 18:29 EDT, still cached
  await fetchTickerFacts("spy", { fetch: fn, now: clock });
  assert.equal(calls.length, 1);
  now = new Date("2026-10-23T22:30:00Z");          // 18:30 EDT, expired
  await fetchTickerFacts("SPY", { fetch: fn, now: clock });
  assert.equal(calls.length, 2);
});

test("a 404 is cached too", async (t) => {
  withKey(t);
  const { fn, calls } = stubFetch(() => new Response("{}", { status: 404 }));
  await fetchTickerFacts("ZZZZ", { fetch: fn, now: () => NOW });
  assert.equal(await fetchTickerFacts("ZZZZ", { fetch: fn, now: () => NOW }), null);
  assert.equal(calls.length, 1);
});

test("concurrent calls for one symbol share one request", async (t) => {
  withKey(t);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    await gate;
    return new Response(tiingoBody(), { status: 200 });
  }) as typeof fetch;
  const pending = [
    fetchTickerFacts("CLOZ", { fetch: fn, now: () => NOW }),
    fetchTickerFacts("cloz", { fetch: fn, now: () => NOW }),
    fetchTickerFacts("CLOZ", { fetch: fn, now: () => NOW }),
  ];
  release();
  const [a, b, c] = await Promise.all(pending);
  assert.equal(calls.length, 1);
  assert.equal(a, b);
  assert.equal(b, c);
});

test("a failed request is not cached", async (t) => {
  withKey(t);
  let status = 503;
  const { fn, calls } = stubFetch(() => new Response(status === 200 ? tiingoBody() : "x", { status }));
  await assert.rejects(fetchTickerFacts("SPY", { fetch: fn, now: () => NOW }));
  status = 200;
  assert.equal((await fetchTickerFacts("SPY", { fetch: fn, now: () => NOW }))?.symbol, "SPY");
  assert.equal(calls.length, 2);
});

test("fetchFactsForSymbols keeps symbol order and runs at most four at a time", async () => {
  const facts = computeTickerFacts("SPY", rows(200, (i) => 100 + i * 0.1));
  let running = 0;
  let peak = 0;
  const syms = ["A", "B", "C", "D", "E", "F", "G"];
  const out = await fetchFactsForSymbols(syms, async (s) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, s === "A" ? 30 : 5));
    running--;
    return s === "C" ? null : { ...facts, symbol: s };
  });
  assert.deepEqual(out.map((f) => f?.symbol ?? null), ["A", "B", null, "D", "E", "F", "G"]);
  assert.equal(peak, 4);
  assert.deepEqual(await fetchFactsForSymbols([], async () => facts), []);
});

test("fetchFactsForSymbols starts no symbol after the first failure and rejects with it", async () => {
  const started: string[] = [];
  const boom = new TickerFactsUnavailableError(500);
  const syms = Array.from({ length: 20 }, (_, i) => `S${i}`);
  await assert.rejects(
    fetchFactsForSymbols(syms, async (s) => {
      started.push(s);
      if (s === "S1") throw boom;
      await new Promise((r) => setTimeout(r, 20));
      return null;
    }),
    (e) => e === boom,
  );
  await new Promise((r) => setTimeout(r, 100));
  // The four already in flight finish; nothing new starts once S1 failed.
  assert.deepEqual(started, ["S0", "S1", "S2", "S3"]);
});

test("fetchFactsForSymbols starts no symbol after the signal aborts", async () => {
  const controller = new AbortController();
  const started: string[] = [];
  const syms = Array.from({ length: 10 }, (_, i) => `S${i}`);
  const out = await fetchFactsForSymbols(syms, async (s) => {
    started.push(s);
    await new Promise((r) => setTimeout(r, s === "S0" ? 5 : 20));
    if (s === "S0") controller.abort();
    return null;
  }, controller.signal);
  assert.equal(out.length, 10);
  // The four already in flight finish; nothing new starts after the abort.
  assert.deepEqual(started, ["S0", "S1", "S2", "S3"]);
});
