// /charts ticker assistant: a signed-in user asks about one or more tickers and
// a small model explains the facts from ticker-facts.ts. The model never
// produces numbers of its own: facts are computed server-side from Tiingo, the
// prompt tells the model to use only those, and the server appends the source
// line itself. No buy or sell advice; the site never places orders.

import {
  createOpenRouterRatioAdapter,
  type OpenRouterCitation,
  type OpenRouterRatioInput,
  type OpenRouterStreamOptions,
} from "./openrouter-ratio";
import {
  fetchFactsForSymbols,
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
  stream(input: OpenRouterRatioInput, opts?: OpenRouterStreamOptions): AsyncIterable<string>;
}

// Web search, only when the user ticks it: OpenRouter's web plugin through Exa
// (about $0.007 a search, 5 results). Exa receives the search built from the
// question. The model is told to name the site in plain words; the server lists
// the result links on the source line.
export const TICKER_ASSISTANT_WEB_RESULTS = 5;
const WEB_SEARCH_PROMPT = [
  "Web search results for the user's question follow.",
  "Use them only for news, events and context that the ticker facts do not cover.",
  "When you use a result, name its site in plain words (for example: according to reuters.com).",
  "Do not write links, URLs or markdown.",
].join(" ");
export const TICKER_ASSISTANT_WEB_PLUGIN = {
  id: "web",
  engine: "exa",
  max_results: TICKER_ASSISTANT_WEB_RESULTS,
  search_prompt: WEB_SEARCH_PROMPT,
  // Exa's own market-data pages are the search engine's copy of prices, not a source
  exclude_domains: ["exa.ai"],
};

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
  "6. Layout (the page shows it as a short answer with bullets): first line, one short sentence that answers the question. Then 2 to 4 lines that each start with \"- \", one point per line, at most about 20 words each. No other markdown: no bold, no # headings, no links. At most about 100 words in all. Do not add a source line; the server adds it.",
  "7. Do not use em dashes. Use a comma, colon or period instead.",
  "8. When the answer covers more than one ticker, every number must name its ticker on the same line. Never give one ticker's figure for another.",
  "9. Use the plain period names (21-day, 3-month, 6-month) and the plain labels from the facts. Never write code-style field names or JSON.",
  "10. Write percentages with the % sign and their sign as given, for example -1.5% or 7.14%. Do not put \"down\" or \"up\" in front of a signed percentage.",
].join("\n");

// With web search on, rules 1, 5 and 6 change: the facts stay the only source for
// the ticker's numbers, and web results may add news and context, named by site.
// The page turns the two section lines of rule 6 into small headings.
const WEB_RULES = RULES
  .replace(/^1\. .*$/m, "1. For the ticker's prices, closes, price changes, volume, yield, cadence, payouts and their dates, use only the facts, copied exactly or rounded, even when a web result shows its own figure. Do not calculate new numbers (no differences, sums, averages or counts). Web search results may add news, events and context that the facts do not cover.")
  .replace(/^5\. .*$/m, "5. Every point from a web result names its site in plain words at the start of the line, for example \"- reuters.com: ...\". If a web result disagrees with the facts, use the facts and say they differ. When neither covers the question, say so in the first line.")
  .replace(/^6\. .*$/m, "6. Layout (the page shows it as a short answer with sections): first line, one short sentence that answers the question. Then a line that reads exactly \"From the facts:\" followed by 1 to 3 lines that each start with \"- \". Then a line that reads exactly \"From the web:\" followed by 1 to 3 lines that each start with \"- \". One point per line, at most about 25 words each. No other markdown: no bold, no # headings, no links or URLs. At most about 140 words in all. Do not add a source line; the server adds it.");

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
  opts: { missing?: string[]; nearestBuy?: Record<string, number>; web?: boolean } = {},
): { systemPrompt: string; userPrompt: string } {
  const parts = [
    "You explain end-of-day facts about stock and ETF tickers to a trader on a charts page.",
    opts.web
      ? "You explain the numbers you are given, and you may add news and context from the web search results. You never produce numbers of your own."
      : "You only explain the numbers you are given. You never produce facts of your own.",
    opts.web ? WEB_RULES : RULES,
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
  // The web search is built from the user message, so it names the tickers too.
  const userPrompt = opts.web ? `About ${facts.map((f) => f.symbol).join(", ")}: ${question}` : question;
  return { systemPrompt: parts.join("\n\n"), userPrompt };
}

/**
 * The web results the answer drew on, for the source line: http(s) links only,
 * each page once, at most TICKER_ASSISTANT_WEB_RESULTS of them.
 */
export function webSourcesLine(citations: OpenRouterCitation[]): string {
  const urls: string[] = [];
  for (const c of citations) {
    let url: URL;
    try {
      url = new URL(c.url);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    url.hash = "";
    const href = url.toString();
    if (!urls.includes(href)) urls.push(href);
    if (urls.length >= TICKER_ASSISTANT_WEB_RESULTS) break;
  }
  return urls.length
    ? ` Web results (not checked by this site): ${urls.join(" ")}`
    : " Web search returned no sources.";
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

const TICKER_ASSISTANT_EMPTY_ANSWER = "empty model answer";

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
  web?: boolean;
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
  const results = await fetchFactsForSymbols(input.symbols, deps.fetchFacts ?? ((s) => fetchTickerFacts(s)), signal);
  if (signal?.aborted) return;
  const facts = results.filter((f): f is TickerFacts => f !== null);
  const missing = input.symbols.filter((_, i) => results[i] === null);
  if (facts.length === 0) throw new TickerAssistantNoFactsError(missing);

  const web = input.web === true;
  const prompt = buildTickerAssistantPrompt(facts, input.question, {
    missing,
    nearestBuy: input.nearestBuy,
    ...(web ? { web } : {}),
  });
  const adapter = deps.adapter ?? createTickerAssistantAdapter();
  const citations: OpenRouterCitation[] = [];
  const opts: OpenRouterStreamOptions = {
    ...(signal ? { signal } : {}),
    ...(web ? { plugins: [TICKER_ASSISTANT_WEB_PLUGIN], onCitation: (c: OpenRouterCitation) => { citations.push(c); } } : {}),
  };
  const stream = Object.keys(opts).length ? adapter.stream(prompt, opts) : adapter.stream(prompt);
  // Whitespace before the first real text is held back, so an answer with no
  // text throws before anything is sent: the route then reports the error and
  // refunds the question instead of showing a bare source line.
  let lead = "";
  let hasText = false;
  for await (const chunk of stripEmDashes(stream)) {
    if (hasText) {
      yield chunk;
    } else if (chunk.trim()) {
      hasText = true;
      yield lead + chunk;
    } else {
      lead += chunk;
    }
  }
  if (!hasText) {
    // A request cancelled after the browser left ends quietly, as before.
    if (signal?.aborted) return;
    throw new Error(TICKER_ASSISTANT_EMPTY_ANSWER);
  }
  yield `\n\n${tickerSourceLine(facts)}${web ? webSourcesLine(citations) : ""}`;
}

/** Error detail safe to log: no API keys, no prompt or question text. */
export function tickerAssistantErrorDetail(error: unknown): string {
  if (error instanceof TickerFactsUnavailableError) return error.message;
  const message = error instanceof Error ? error.message : "";
  // Provider error text could echo the prompt; log only its kind.
  if (message.startsWith("OpenRouter SSE error:")) return "OpenRouter SSE error";
  if (message === TICKER_ASSISTANT_EMPTY_ANSWER) return message;
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
  const raw = body as { symbols?: unknown; question?: unknown; nearestBuy?: unknown; web?: unknown };
  if (raw.web !== undefined && typeof raw.web !== "boolean") return { ok: false, error: "web must be true or false" };

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

  return { ok: true, value: { symbols, question, ...(nearestBuy ? { nearestBuy } : {}), ...(raw.web === true ? { web: true } : {}) } };
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

/** One reserved question: the New York day whose count it took a slot from. */
export interface QuestionReservation {
  readonly day: string;
}

/**
 * Per-user count of accepted questions per New York calendar day, in memory
 * (resets on deploy; one web instance). tryConsume reserves a slot and returns
 * the reservation, or false when the day's cap is reached; release returns that
 * reservation's slot when the question never reached the model. A reservation
 * refunds only its own day, so a question reserved before New York midnight that
 * fails after it never frees a slot of the new day, and it refunds at most once.
 */
export function createDailyQuestionCounter(
  limit = TICKER_ASSISTANT_DAILY_LIMIT,
  now: () => Date = () => new Date(),
) {
  const counts = new Map<string, { day: string; count: number }>();
  const released = new WeakSet<QuestionReservation>();
  const current = (userId: string, day: string) => {
    const entry = counts.get(userId);
    return entry && entry.day === day ? entry.count : 0;
  };
  return {
    tryConsume(userId: string): QuestionReservation | false {
      const day = newYorkDay(now());
      const count = current(userId, day);
      if (count >= limit) return false;
      counts.set(userId, { day, count: count + 1 });
      // Drop earlier days' entries so the map holds about one day of users.
      if (counts.size > 10_000) {
        for (const [id, entry] of Array.from(counts)) if (entry.day !== day) counts.delete(id);
      }
      return { day };
    },
    release(userId: string, reservation: QuestionReservation): void {
      if (released.has(reservation)) return;
      released.add(reservation);
      const count = current(userId, reservation.day);
      if (count > 0) counts.set(userId, { day: reservation.day, count: count - 1 });
    },
    remaining(userId: string): number {
      return Math.max(0, limit - current(userId, newYorkDay(now())));
    },
  };
}

export const tickerAssistantQuota = createDailyQuestionCounter();
