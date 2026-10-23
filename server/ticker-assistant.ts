// /charts ticker assistant: a signed-in user asks about one or more tickers and
// a small model explains the facts from ticker-facts.ts. The model never
// produces numbers of its own: facts are computed server-side from Tiingo, the
// prompt tells the model to use only those, and the server appends the source
// line itself. No buy or sell advice; the site never places orders.

import { createOpenRouterRatioAdapter, type OpenRouterRatioInput } from "./openrouter-ratio";
import {
  fetchTickerFacts,
  TickerFactsUnavailableError,
  TICKER_RE,
  type TickerFacts,
} from "./ticker-facts";

export const TICKER_ASSISTANT_MODEL = "deepseek/deepseek-v4.1-flash-1017";
export const TICKER_ASSISTANT_MAX_SYMBOLS = 40;
export const TICKER_ASSISTANT_MAX_QUESTION = 500;
export const TICKER_ASSISTANT_DAILY_LIMIT = 30;

export interface TickerAssistantAdapter {
  stream(input: OpenRouterRatioInput, opts?: { signal?: AbortSignal }): AsyncIterable<string>;
}

export function createTickerAssistantAdapter(
  opts: { env?: Record<string, string | undefined>; fetch?: typeof globalThis.fetch } = {},
): TickerAssistantAdapter {
  return createOpenRouterRatioAdapter({
    ...opts,
    model: TICKER_ASSISTANT_MODEL,
    maxTokens: 400,
    reasoning: { enabled: false },
    // Ask OpenRouter to route only to providers that do not keep prompts.
    provider: { data_collection: "deny" },
  });
}

// --- Prompt -------------------------------------------------------------------

const FIELD_GUIDE = [
  "How to read the facts: each entry is keyed by its ticker. \"as-of date\" is the date of the latest daily close; \"latest close\" is that close.",
  "\"21-day price change\", \"3-month price change\" and \"6-month price change\" cover the last 21, 63 and 126 trading days",
  "(about 1, 3 and 6 months): \"percent\" is the price change in percent from \"start close\" on \"start date\";",
  "\"direction\" is BULLISH when the change is above 0, BEARISH when below.",
  "\"periods up\" is how many of those three periods are up; \"overall trend\" is UP, DOWN or MIXED (null when a period lacks history).",
  "\"6-month high close\" is the highest close in the last 126 trading days; \"distance from 6-month high\" is the latest close's percent distance from it (0 means at the high).",
  "\"trailing 12-month yield\" is trailing 12-month payouts divided by the latest close, in percent (null when nothing was paid);",
  "\"payout cadence\" is how often it pays, from the usual spacing between payouts: weekly, monthly, quarterly, semiannual, annual, irregular, or none when nothing was paid in the trailing 365 days;",
  "\"payouts\" lists the trailing 365 days' ex-dates and cash amounts;",
  "\"last ex-date\" is the most recent payout ex-date; \"special payout\" is true when one payout was more than twice the median.",
  "Prices and payouts are adjusted for stock splits to today's share basis.",
].join(" ");

const RULES = [
  "Rules:",
  "1. Use only numbers and dates that appear in the facts, copied exactly or rounded. Do not calculate new numbers (no differences, sums, averages or counts) and do not mention any other number, month or year.",
  "2. Write dates exactly as they appear in the facts (YYYY-MM-DD).",
  "3. Trend figures are price change, not total return. Payouts are reported separately as yield.",
  "4. Do not give buy, sell or hold advice, recommendations, price targets or predictions. When asked for advice, say briefly that you cannot give buy or sell advice, then describe what the facts show.",
  "5. When a question needs data that is not in the facts (pay dates, news, earnings, forecasts, targets, fundamentals), say the facts do not include it.",
  "6. Answer in plain text with no markdown, at most about 120 words. Do not add a source line; the server adds it.",
  "7. Do not use em dashes. Use a comma, colon or period instead.",
  "8. Every number in the answer must name the ticker it belongs to in the same sentence, and never give one ticker's figure for another.",
  "9. Use the plain period names (21-day, 3-month, 6-month) and the plain labels from the facts. Never write code-style field names or JSON.",
].join("\n");

// An em dash plus the spaces and any further em dashes around it.
const EM_DASH_RUN = / *—[ —]*/g;
// The run of spaces and em dashes at the end of a chunk.
const TRAILING_RUN = /[ —]*$/;

/**
 * Removes em dashes from streamed model text. Each em dash, together with the
 * spaces (and any further em dashes) around it, becomes ", ". An unspaced dash
 * never becomes a hyphen, so "6M—1.1%" reads "6M, 1.1%" rather than looking
 * like a minus sign; digits and existing minus signs are left alone. A run of
 * spaces or dashes at the end of a chunk is held back until the next chunk
 * shows where the run ends, so a dash split across chunks is still caught;
 * everything else passes through at once.
 */
export async function* stripEmDashes(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  const replace = (s: string) => s.replace(EM_DASH_RUN, ", ");
  let held = "";
  for await (const chunk of chunks) {
    const text = held + chunk;
    const cut = TRAILING_RUN.exec(text)!.index;
    held = text.slice(cut);
    const out = replace(text.slice(0, cut));
    if (out) yield out;
  }
  if (held) yield replace(held);
}

type Window = TickerFacts["windows"]["d21"];

function windowForPrompt(w: Window) {
  return w && { percent: w.change, direction: w.verdict, "start date": w.startDate, "start close": w.startClose };
}

/**
 * The facts under plain labels, keyed by ticker, so the model never sees (or
 * echoes) internal field names. Values are passed through unchanged. The source
 * string is left out: the server appends the source line.
 */
function factsForPrompt(facts: TickerFacts[]) {
  return Object.fromEntries(facts.map((f) => [f.symbol, {
    "as-of date": f.asOf,
    "latest close": f.close,
    "21-day price change": windowForPrompt(f.windows.d21),
    "3-month price change": windowForPrompt(f.windows.m3),
    "6-month price change": windowForPrompt(f.windows.m6),
    "periods up": f.upCount,
    "overall trend": f.overall,
    "6-month high close": f.high6m,
    "distance from 6-month high": f.vs6mHigh,
    "trailing 12-month yield": f.yield,
    "payout cadence": f.cadence,
    payouts: f.payouts.map((p) => ({ "ex-date": p.exDate, amount: p.amount })),
    "last ex-date": f.lastExDate,
    "special payout": f.special,
  }]));
}

export function buildTickerAssistantPrompt(
  facts: TickerFacts[],
  question: string,
  opts: { missing?: string[]; nearestBuy?: Record<string, number> } = {},
): { systemPrompt: string; userPrompt: string } {
  const parts = [
    "You explain end-of-day facts about stock and ETF tickers to a trader on a charts page.",
    "You only explain the numbers you are given. You never produce facts of your own.",
    RULES,
    FIELD_GUIDE,
    `Facts (JSON, keyed by ticker): ${JSON.stringify(factsForPrompt(facts))}`,
  ];
  const missing = opts.missing ?? [];
  if (missing.length) {
    parts.push(`No data for: ${missing.join(", ")}. Say there is no data for these if the question involves them.`);
  }
  const levels = Object.entries(opts.nearestBuy ?? {});
  if (levels.length) {
    parts.push(
      "Chart levels (JSON): the nearest buy level drawn on the user's chart for each symbol, sent by the page."
        + " They are chart levels, not facts computed from Tiingo, and not advice."
        + ` ${JSON.stringify(Object.fromEntries(levels))}`,
    );
  }
  return { systemPrompt: parts.join("\n\n"), userPrompt: question };
}

/** One line, starting "Source: ", naming the data and the as-of date(s). */
export function tickerSourceLine(facts: TickerFacts[]): string {
  const bySymbol = new Map<string, string[]>();
  for (const f of facts) bySymbol.set(f.asOf, [...(bySymbol.get(f.asOf) ?? []), f.symbol]);
  const dates = Array.from(bySymbol.keys()).sort().reverse();
  const asOf = dates.length === 0
    ? ""
    : dates.length === 1
      ? `, as of ${dates[0]}`
      : `, as of ${dates.map((d) => `${d} (${bySymbol.get(d)!.join(", ")})`).join(", ")}`;
  return `Source: Tiingo daily closes and distributions${asOf}; trend is price change, not total return.`;
}

// --- Answer -------------------------------------------------------------------

export class TickerAssistantNoFactsError extends Error {
  constructor(readonly symbols: string[]) {
    super("no ticker facts for any requested symbol");
    this.name = "TickerAssistantNoFactsError";
  }
}

export interface TickerAssistantInput {
  symbols: string[];
  question: string;
  nearestBuy?: Record<string, number>;
}

async function factsFor(
  symbols: string[],
  fetchFacts: (symbol: string) => Promise<TickerFacts | null>,
  signal?: AbortSignal,
): Promise<(TickerFacts | null)[]> {
  // A few Tiingo requests at a time; cache hits return immediately. No new
  // symbol starts once the caller has gone away.
  const results: (TickerFacts | null)[] = new Array(symbols.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < symbols.length && !signal?.aborted) {
      const i = next++;
      results[i] = await fetchFacts(symbols[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, symbols.length) }, worker));
  return results;
}

/**
 * Streams the model's answer, then a final "\n\n" + source line chunk. Throws
 * TickerAssistantNoFactsError, without calling the model, when no symbol has
 * facts; TickerFactsUnavailableError when Tiingo fails. When deps.signal is
 * aborted before the model call, it ends without yielding anything and makes
 * no model request; the signal is also passed to the model request.
 */
export async function* answerTickerQuestion(
  input: TickerAssistantInput,
  deps: {
    adapter?: TickerAssistantAdapter;
    fetchFacts?: (symbol: string) => Promise<TickerFacts | null>;
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<string> {
  const { signal } = deps;
  const results = await factsFor(input.symbols, deps.fetchFacts ?? ((s) => fetchTickerFacts(s)), signal);
  if (signal?.aborted) return;
  const facts = results.filter((f): f is TickerFacts => f !== null);
  const missing = input.symbols.filter((_, i) => results[i] === null);
  if (facts.length === 0) throw new TickerAssistantNoFactsError(missing);

  const prompt = buildTickerAssistantPrompt(facts, input.question, {
    missing,
    nearestBuy: input.nearestBuy,
  });
  const adapter = deps.adapter ?? createTickerAssistantAdapter();
  const stream = signal ? adapter.stream(prompt, { signal }) : adapter.stream(prompt);
  for await (const chunk of stripEmDashes(stream)) yield chunk;
  yield `\n\n${tickerSourceLine(facts)}`;
}

/** Error detail safe to log: no API keys, no prompt or question text. */
export function tickerAssistantErrorDetail(error: unknown): string {
  if (error instanceof TickerFactsUnavailableError) return error.message;
  const message = error instanceof Error ? error.message : "";
  // Provider error text could echo the prompt; log only its kind.
  if (message.startsWith("OpenRouter SSE error:")) return "OpenRouter SSE error";
  if (/^(OpenRouter request failed|empty OpenRouter response body|malformed OpenRouter SSE|OpenRouter SSE stream failed)/.test(message)) {
    return message;
  }
  return "unexpected error";
}

// --- Request body ---------------------------------------------------------------

export type TickerAssistantBodyResult =
  | { ok: true; value: TickerAssistantInput }
  | { ok: false; error: string };

export function parseTickerAssistantBody(body: unknown): TickerAssistantBodyResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid request body" };
  const raw = body as { symbols?: unknown; question?: unknown; nearestBuy?: unknown };

  if (!Array.isArray(raw.symbols) || raw.symbols.some((s) => typeof s !== "string")) {
    return { ok: false, error: "symbols must be a list of tickers" };
  }
  const symbols = Array.from(new Set((raw.symbols as string[]).map((s) => s.trim().toUpperCase())));
  if (symbols.length < 1 || symbols.length > TICKER_ASSISTANT_MAX_SYMBOLS) {
    return { ok: false, error: `send 1 to ${TICKER_ASSISTANT_MAX_SYMBOLS} symbols` };
  }
  if (symbols.some((s) => !TICKER_RE.test(s))) return { ok: false, error: "invalid ticker" };

  const question = typeof raw.question === "string" ? raw.question.trim() : "";
  if (question.length < 1 || question.length > TICKER_ASSISTANT_MAX_QUESTION) {
    return { ok: false, error: `question must be 1 to ${TICKER_ASSISTANT_MAX_QUESTION} characters` };
  }

  let nearestBuy: Record<string, number> | undefined;
  if (raw.nearestBuy !== undefined && raw.nearestBuy !== null) {
    if (typeof raw.nearestBuy !== "object" || Array.isArray(raw.nearestBuy)) {
      return { ok: false, error: "nearestBuy must map symbols to prices" };
    }
    nearestBuy = {};
    for (const [key, value] of Object.entries(raw.nearestBuy as Record<string, unknown>)) {
      const sym = key.trim().toUpperCase();
      if (!symbols.includes(sym) || typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return { ok: false, error: "nearestBuy must map requested symbols to positive prices" };
      }
      nearestBuy[sym] = value;
    }
  }

  return { ok: true, value: { symbols, question, ...(nearestBuy ? { nearestBuy } : {}) } };
}

// --- Daily question cap ---------------------------------------------------------

const nyDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** America/New_York calendar date of `now`, YYYY-MM-DD. */
export function newYorkDay(now: Date): string {
  return nyDate.format(now);
}

/**
 * Per-user count of accepted questions per New York calendar day, in memory
 * (resets on deploy; one web instance). tryConsume reserves a slot; release
 * returns it when the question never reached the model.
 */
export function createDailyQuestionCounter(
  limit = TICKER_ASSISTANT_DAILY_LIMIT,
  now: () => Date = () => new Date(),
) {
  const counts = new Map<string, { day: string; count: number }>();
  const current = (userId: string, day: string) => {
    const entry = counts.get(userId);
    return entry && entry.day === day ? entry.count : 0;
  };
  return {
    tryConsume(userId: string): boolean {
      const day = newYorkDay(now());
      const count = current(userId, day);
      if (count >= limit) return false;
      counts.set(userId, { day, count: count + 1 });
      // Drop earlier days' entries so the map holds about one day of users.
      if (counts.size > 10_000) {
        for (const [id, entry] of Array.from(counts)) if (entry.day !== day) counts.delete(id);
      }
      return true;
    },
    release(userId: string): void {
      const day = newYorkDay(now());
      const count = current(userId, day);
      if (count > 0) counts.set(userId, { day, count: count - 1 });
    },
    remaining(userId: string): number {
      return Math.max(0, limit - current(userId, newYorkDay(now())));
    },
  };
}

export const tickerAssistantQuota = createDailyQuestionCounter();
