import assert from "node:assert/strict";
import test from "node:test";
import { computeTickerFacts, type TickerFacts, type TickerFactsRow } from "./ticker-facts";
import {
  answerTickerQuestion,
  buildTickerAssistantPrompt,
  createDailyQuestionCounter,
  createTickerAssistantAdapter,
  parseTickerAssistantBody,
  stripEmDashes,
  tickerAssistantErrorDetail,
  tickerSourceLine,
  TickerAssistantNoFactsError,
  TICKER_ASSISTANT_MODEL,
  type TickerAssistantAdapter,
} from "./ticker-assistant";

const DAY = 86_400_000;

function factsFor(symbol: string, asOf: string, close: (i: number) => number): TickerFacts {
  const end = Date.parse(asOf);
  const rows: TickerFactsRow[] = Array.from({ length: 200 }, (_, i) => ({
    date: new Date(end - (199 - i) * DAY).toISOString().slice(0, 10),
    close: close(i),
    divCash: i % 30 === 0 ? 0.25 : 0,
  }));
  return computeTickerFacts(symbol, rows);
}

const CLOZ = factsFor("CLOZ", "2026-10-22", (i) => 25 + i * 0.01);
const SPY = factsFor("SPY", "2026-10-22", (i) => 600 - i * 0.2);
const TSLA = factsFor("TSLA", "2026-10-21", (i) => 300 + (i % 7));

function stubAdapter(chunks: string[]) {
  const calls: { systemPrompt: string; userPrompt: string }[] = [];
  const adapter: TickerAssistantAdapter = {
    async *stream(input) {
      calls.push(input);
      for (const c of chunks) yield c;
    },
  };
  return { adapter, calls };
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

function sseDone(): Response {
  return new Response(new TextEncoder().encode("data: [DONE]\n\n"), {
    headers: { "content-type": "text/event-stream" },
  });
}

test("prompt carries the facts as JSON under plain labels and the grounding and no-advice rules", () => {
  const { systemPrompt, userPrompt } = buildTickerAssistantPrompt([CLOZ, SPY], "Is CLOZ up?", {
    missing: ["ZZZZ"],
    nearestBuy: { CLOZ: 26.5 },
  });
  assert.equal(userPrompt, "Is CLOZ up?");
  const json = /Facts \(JSON, keyed by ticker\): (.*)/.exec(systemPrompt)?.[1];
  assert.ok(json, "facts JSON line present");
  const parsed = JSON.parse(json!);
  assert.deepEqual(Object.keys(parsed), ["CLOZ", "SPY"]);
  const period = (w: TickerFacts["windows"]["d21"]) => ({
    percent: w!.change,
    direction: w!.verdict,
    "start date": w!.startDate,
    "start close": w!.startClose,
  });
  assert.deepEqual(parsed.CLOZ, {
    "as-of date": CLOZ.asOf,
    "latest close": CLOZ.close,
    "21-day price change": period(CLOZ.windows.d21),
    "3-month price change": period(CLOZ.windows.m3),
    "6-month price change": period(CLOZ.windows.m6),
    "periods up": CLOZ.upCount,
    "overall trend": CLOZ.overall,
    "6-month high close": CLOZ.high6m,
    "distance from 6-month high": CLOZ.vs6mHigh,
    "trailing 12-month yield": CLOZ.yield,
    "payout cadence": CLOZ.cadence,
    payouts: CLOZ.payouts.map((x) => ({ "ex-date": x.exDate, amount: x.amount })),
    "last ex-date": CLOZ.lastExDate,
    "special payout": CLOZ.special,
  });
  assert.equal(parsed.SPY["distance from 6-month high"], SPY.vs6mHigh);
  // No internal field names reach the model, and the source string is left out.
  for (const key of ["symbol", "asOf", "d21", "m3", "m6", "upCount", "vs6mHigh", "high6m",
    "startDate", "startClose", "exDate", "lastExDate", "verdict", "source"]) {
    assert.equal(systemPrompt.includes(`"${key}"`), false, key);
  }
  assert.match(systemPrompt, /Every number in the answer must name the ticker it belongs to/);
  assert.match(systemPrompt, /Use the plain period names \(21-day, 3-month, 6-month\)/);
  assert.match(systemPrompt, /Use only numbers and dates that appear in the facts/);
  assert.match(systemPrompt, /price change, not total return/);
  assert.match(systemPrompt, /Do not give buy, sell or hold advice/);
  assert.match(systemPrompt, /say the facts do not include it/);
  assert.match(systemPrompt, /at most about 120 words/);
  assert.match(systemPrompt, /Do not add a source line/);
  assert.match(systemPrompt, /No data for: ZZZZ/);
  assert.match(systemPrompt, /Chart levels \(JSON\).*\{"CLOZ":26\.5\}/s);
});

test("prompt sends a ticker with short history as null periods", () => {
  const short = computeTickerFacts("NEW", [{ date: "2026-10-22", close: 10, divCash: 0 }]);
  const { systemPrompt } = buildTickerAssistantPrompt([short], "Trend?");
  const parsed = JSON.parse(/Facts \(JSON, keyed by ticker\): (.*)/.exec(systemPrompt)![1]);
  assert.equal(parsed.NEW["21-day price change"], null);
  assert.equal(parsed.NEW["6-month price change"], null);
  assert.equal(parsed.NEW["overall trend"], null);
  assert.equal(parsed.NEW["last ex-date"], null);
});

test("prompt leaves out the no-data and chart-level sections when there are none", () => {
  const { systemPrompt } = buildTickerAssistantPrompt([CLOZ], "Yield?");
  assert.doesNotMatch(systemPrompt, /No data for/);
  assert.doesNotMatch(systemPrompt, /Chart levels/);
});

test("source line names Tiingo, the as-of dates and price change", () => {
  assert.equal(
    tickerSourceLine([CLOZ, SPY]),
    "Source: Tiingo daily closes and distributions, as of 2026-10-22; trend is price change, not total return.",
  );
  assert.equal(
    tickerSourceLine([CLOZ, TSLA, SPY]),
    "Source: Tiingo daily closes and distributions, as of 2026-10-22 (CLOZ, SPY), 2026-10-21 (TSLA);"
      + " trend is price change, not total return.",
  );
});

test("answer streams the model chunks, then the source line last", async () => {
  const { adapter, calls } = stubAdapter(["CLOZ is ", "up."]);
  const out = await collect(answerTickerQuestion(
    { symbols: ["CLOZ", "ZZZZ"], question: "Is CLOZ up?", nearestBuy: { CLOZ: 26 } },
    { adapter, fetchFacts: async (s) => (s === "CLOZ" ? CLOZ : null) },
  ));
  // a trailing space waits for the next chunk (it could start " — "), so it moves over
  assert.deepEqual(out, ["CLOZ is", " up.", `\n\n${tickerSourceLine([CLOZ])}`]);
  const lines = out.join("").split("\n");
  assert.match(lines[lines.length - 1], /^Source: /);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userPrompt, "Is CLOZ up?");
  assert.match(calls[0].systemPrompt, /No data for: ZZZZ/);
  assert.match(calls[0].systemPrompt, /\{"CLOZ":26\}/);
});

test("prompt field guide names every payout cadence, including weekly, and the split adjustment", () => {
  const { systemPrompt } = buildTickerAssistantPrompt([CLOZ], "?");
  for (const cadence of ["weekly", "monthly", "quarterly", "semiannual", "annual", "irregular", "none"]) {
    assert.ok(systemPrompt.includes(cadence), cadence);
  }
  assert.match(systemPrompt, /adjusted for stock splits/);
});

test("prompt tells the model not to use em dashes", () => {
  const { systemPrompt } = buildTickerAssistantPrompt([CLOZ], "Why?");
  assert.match(systemPrompt, /Do not use em dashes/);
});

test("answer replaces em dashes, including ones split across chunks", async () => {
  const { adapter } = stubAdapter(["CLOZ is DOWN", " — all three", " windows fell", "—21D -1.5%,", " 3M -1.8%", " and 6M —", "-1.1%. A ", "— B", " C —", " D", " E —"]);
  const out = await collect(answerTickerQuestion(
    { symbols: ["CLOZ"], question: "Why?" },
    { adapter, fetchFacts: async () => CLOZ },
  ));
  const text = out.join("");
  assert.equal(text.includes("—"), false);
  assert.equal(
    text,
    "CLOZ is DOWN, all three windows fell, 21D -1.5%, 3M -1.8% and 6M, -1.1%. A, B C, D E, "
      + `\n\n${tickerSourceLine([CLOZ])}`,
  );
  assert.equal(out[out.length - 1], `\n\n${tickerSourceLine([CLOZ])}`, "source line still comes last");
  assert.ok(out.length > 5, "text still arrives in several chunks");
});

test("stripEmDashes passes text without dashes through unchanged", async () => {
  async function* gen() { yield "plain "; yield "text, no dashes."; }
  assert.deepEqual(await collect(stripEmDashes(gen())), ["plain", " text, no dashes."]);
  async function* lone() { yield "—"; }
  assert.deepEqual(await collect(stripEmDashes(lone())), [", "]);
});

test("stripEmDashes never turns an unspaced em dash into a minus sign", async () => {
  async function* gen() { yield "Over 6M"; yield "—1.1%"; yield " lower; 21D—"; yield "1.5% lower; 3M  —  "; yield "-1.8% ——"; yield " 4"; }
  const text = (await collect(stripEmDashes(gen()))).join("");
  assert.equal(text, "Over 6M, 1.1% lower; 21D, 1.5% lower; 3M, -1.8%, 4");
});

test("answer throws a typed error and makes no model call when no symbol has facts", async () => {
  const { adapter, calls } = stubAdapter(["never"]);
  await assert.rejects(
    collect(answerTickerQuestion({ symbols: ["ZZZZ", "YYYY"], question: "?" }, { adapter, fetchFacts: async () => null })),
    (error: unknown) => {
      assert(error instanceof TickerAssistantNoFactsError);
      assert.deepEqual(error.symbols, ["ZZZZ", "YYYY"]);
      return true;
    },
  );
  assert.equal(calls.length, 0);
});

test("answer aborted while facts load ends with no output and no model call", async () => {
  const { adapter, calls } = stubAdapter(["never"]);
  const controller = new AbortController();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const fetched: string[] = [];
  const pending = collect(answerTickerQuestion(
    { symbols: ["CLOZ", "SPY", "TSLA", "QQQ", "IWM", "DIA"], question: "Why?" },
    {
      adapter,
      signal: controller.signal,
      fetchFacts: async (s) => { fetched.push(s); await gate; return CLOZ; },
    },
  ));
  controller.abort();
  release();
  assert.deepEqual(await pending, []);
  assert.equal(calls.length, 0);
  // The four symbols already in flight finish; no new one starts after the abort.
  assert.deepEqual(fetched, ["CLOZ", "SPY", "TSLA", "QQQ"]);
});

test("answer passes its abort signal to the model request", async () => {
  const signals: (AbortSignal | undefined)[] = [];
  const adapter: TickerAssistantAdapter = {
    async *stream(_input, opts) {
      signals.push(opts?.signal);
      yield "ok";
    },
  };
  const controller = new AbortController();
  const out = await collect(answerTickerQuestion(
    { symbols: ["CLOZ"], question: "?" },
    { adapter, fetchFacts: async () => CLOZ, signal: controller.signal },
  ));
  assert.equal(out[0], "ok");
  assert.deepEqual(signals, [controller.signal]);
});

test("answer with no text throws before yielding anything, so no bare source line is sent", async () => {
  for (const chunks of [[], ["  ", "\n\n", " "]]) {
    const { adapter } = stubAdapter(chunks);
    const out: string[] = [];
    await assert.rejects(
      (async () => {
        for await (const c of answerTickerQuestion({ symbols: ["CLOZ"], question: "?" }, { adapter, fetchFacts: async () => CLOZ })) out.push(c);
      })(),
      /empty model answer/,
    );
    assert.deepEqual(out, [], JSON.stringify(chunks));
  }
  assert.equal(tickerAssistantErrorDetail(new Error("empty model answer")), "empty model answer");
});

test("answer keeps leading whitespace and sends it with the first text", async () => {
  const { adapter } = stubAdapter(["\n", "  ", "CLOZ is up."]);
  const out = await collect(answerTickerQuestion({ symbols: ["CLOZ"], question: "?" }, { adapter, fetchFacts: async () => CLOZ }));
  assert.equal(out.join(""), `\n  CLOZ is up.\n\n${tickerSourceLine([CLOZ])}`);
});

test("answer with no text after the browser left ends quietly", async () => {
  const controller = new AbortController();
  const adapter: TickerAssistantAdapter = {
    async *stream() { controller.abort(); yield " "; },
  };
  const out = await collect(answerTickerQuestion(
    { symbols: ["CLOZ"], question: "?" },
    { adapter, fetchFacts: async () => CLOZ, signal: controller.signal },
  ));
  assert.deepEqual(out, []);
});

test("adapter sends the pinned model, 400 tokens, no reasoning, no data collection, streaming", async () => {
  let body: Record<string, unknown> | undefined;
  const adapter = createTickerAssistantAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async (_url: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return sseDone();
    },
  });
  await collect(adapter.stream({ systemPrompt: "s", userPrompt: "u" }));
  assert.equal(body?.model, TICKER_ASSISTANT_MODEL);
  assert.equal(TICKER_ASSISTANT_MODEL, "deepseek/deepseek-v4.1-flash-1017");
  assert.equal(body?.max_tokens, 400);
  assert.deepEqual(body?.reasoning, { enabled: false });
  assert.deepEqual(body?.provider, { data_collection: "deny" });
  assert.equal(body?.stream, true);
});

test("daily cap allows 30 questions per user per New York day and resets at New York midnight", () => {
  // 2026-10-23 03:59Z is 23:59 on 2026-10-22 in New York (EDT, UTC-4).
  let now = new Date("2026-10-22T14:00:00Z");
  const counter = createDailyQuestionCounter(30, () => now);
  for (let i = 0; i < 30; i++) assert.ok(counter.tryConsume("u1"), `question ${i + 1}`);
  assert.equal(counter.tryConsume("u1"), false);
  assert.equal(counter.remaining("u1"), 0);
  assert.ok(counter.tryConsume("u2"), "other users have their own count");

  now = new Date("2026-10-23T03:59:00Z");
  assert.equal(counter.tryConsume("u1"), false, "still the same New York day after UTC midnight");

  now = new Date("2026-10-23T04:00:00Z");
  assert.equal(counter.remaining("u1"), 30);
  assert.ok(counter.tryConsume("u1"), "new New York day");
});

test("daily cap release returns a slot for a question that never reached the model", () => {
  const now = new Date("2026-10-22T14:00:00Z");
  const counter = createDailyQuestionCounter(2, () => now);
  assert.ok(counter.tryConsume("u1"));
  const second = counter.tryConsume("u1");
  assert.ok(second);
  assert.equal(counter.tryConsume("u1"), false);
  counter.release("u1", second);
  assert.equal(counter.remaining("u1"), 1);
  counter.release("u1", second);
  assert.equal(counter.remaining("u1"), 1, "a reservation refunds at most once");
  assert.ok(counter.tryConsume("u1"));
  assert.equal(counter.tryConsume("u1"), false);
});

test("daily cap release refunds the reservation's own New York day, never a later one", () => {
  // 03:59Z is 23:59 on 2026-10-22 in New York; 04:01Z is 00:01 on 2026-10-23.
  let now = new Date("2026-10-23T03:59:00Z");
  const counter = createDailyQuestionCounter(2, () => now);
  const late = counter.tryConsume("u1");
  assert.ok(late);
  now = new Date("2026-10-23T04:01:00Z");
  assert.ok(counter.tryConsume("u1"));
  assert.ok(counter.tryConsume("u1"));
  assert.equal(counter.tryConsume("u1"), false, "the new day's cap is reached");
  counter.release("u1", late);
  assert.equal(counter.remaining("u1"), 0, "yesterday's failed question frees nothing today");
  assert.equal(counter.tryConsume("u1"), false);
});

test("body validation upper-cases and de-duplicates symbols and trims the question", () => {
  assert.deepEqual(parseTickerAssistantBody({ symbols: [" cloz", "CLOZ", "spy"], question: "  Is it up?  " }), {
    ok: true,
    value: { symbols: ["CLOZ", "SPY"], question: "Is it up?" },
  });
  assert.deepEqual(
    parseTickerAssistantBody({ symbols: ["SPY"], question: "q", nearestBuy: { spy: 580.5 } }),
    { ok: true, value: { symbols: ["SPY"], question: "q", nearestBuy: { SPY: 580.5 } } },
  );
});

test("body validation rejects bad symbols, questions and chart levels", () => {
  const forty = Array.from({ length: 41 }, (_, i) => `T${i}`);
  for (const body of [
    null,
    [],
    { question: "q" },
    { symbols: "SPY", question: "q" },
    { symbols: [], question: "q" },
    { symbols: forty, question: "q" },
    { symbols: ["SP Y"], question: "q" },
    { symbols: [1], question: "q" },
    { symbols: ["SPY"], question: "   " },
    { symbols: ["SPY"], question: "x".repeat(501) },
    { symbols: ["SPY"], question: 5 },
    { symbols: ["SPY"], question: "q", nearestBuy: [1] },
    { symbols: ["SPY"], question: "q", nearestBuy: { SPY: -1 } },
    { symbols: ["SPY"], question: "q", nearestBuy: { SPY: "580" } },
    { symbols: ["SPY"], question: "q", nearestBuy: { QQQ: 500 } },
  ]) {
    assert.equal(parseTickerAssistantBody(body).ok, false, JSON.stringify(body)?.slice(0, 80));
  }
  assert.equal(parseTickerAssistantBody({ symbols: ["SPY"], question: "x".repeat(500) }).ok, true);
});

test("logged error detail drops provider text that could echo the question", () => {
  assert.equal(tickerAssistantErrorDetail(new Error("OpenRouter SSE error: about Is CLOZ up?")), "OpenRouter SSE error");
  assert.equal(
    tickerAssistantErrorDetail(new Error("OpenRouter request failed (503 Service Unavailable)")),
    "OpenRouter request failed (503 Service Unavailable)",
  );
  assert.equal(tickerAssistantErrorDetail(new Error("Is CLOZ up?")), "unexpected error");
});
