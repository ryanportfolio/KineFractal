const OPENROUTER_RATIO_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_RATIO_MODEL = "google/gemini-3.1-flash-lite";

export interface OpenRouterRatioInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface OpenRouterRatioAdapterOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  // Request overrides for other callers. Left out, the body is the Ratio
  // Relevance request: Gemini Flash Lite, 2048 tokens, hidden medium reasoning.
  model?: string;
  maxTokens?: number;
  reasoning?: Record<string, unknown>;
  provider?: Record<string, unknown>;
}

class MalformedOpenRouterSseError extends Error {
  constructor(message: string) {
    super(`malformed OpenRouter SSE: ${message}`);
  }
}

class OpenRouterSseError extends Error {
  constructor(message: string) {
    super(`OpenRouter SSE error: ${message}`);
  }
}

function sanitizedSseErrorMessage(error: unknown): string {
  const message = error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message.trim()
    : "provider error";

  return message
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]+/g, "[redacted]");
}

/** A web page the answer drew on, from OpenRouter's url_citation annotations. */
export interface OpenRouterCitation {
  url: string;
  title?: string;
}

export interface OpenRouterStreamOptions {
  signal?: AbortSignal;
  // OpenRouter plugins for this request only, e.g. [{ id: "web" }] for web search.
  plugins?: Record<string, unknown>[];
  // Called with each url_citation the response carries (web search results).
  onCitation?: (citation: OpenRouterCitation) => void;
}

function citationsFrom(annotations: unknown, onCitation: (citation: OpenRouterCitation) => void) {
  if (!Array.isArray(annotations)) return;
  for (const a of annotations) {
    const c = a && typeof a === "object" ? (a as { type?: unknown; url_citation?: unknown }) : null;
    if (!c || c.type !== "url_citation" || !c.url_citation || typeof c.url_citation !== "object") continue;
    const { url, title } = c.url_citation as { url?: unknown; title?: unknown };
    if (typeof url !== "string" || !url) continue;
    onCitation(typeof title === "string" && title ? { url, title } : { url });
  }
}

function contentFromSseEvent(
  event: string,
  onCitation?: (citation: OpenRouterCitation) => void,
): string | undefined {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");

  if (!data || data === "[DONE]") return undefined;

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new MalformedOpenRouterSseError("invalid JSON event data");
  }

  if (!payload || typeof payload !== "object") return undefined;
  const providerError = (payload as { error?: unknown }).error;
  if (providerError) throw new OpenRouterSseError(sanitizedSseErrorMessage(providerError));

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") return undefined;
  if (onCitation) {
    // streamed citations arrive on the delta; some providers repeat them on a message
    citationsFrom(((firstChoice as { delta?: { annotations?: unknown } }).delta ?? {}).annotations, onCitation);
    citationsFrom(((firstChoice as { message?: { annotations?: unknown } }).message ?? {}).annotations, onCitation);
  }
  const delta = (firstChoice as { delta?: unknown }).delta;
  if (!delta || typeof delta !== "object") return undefined;
  const content = (delta as { content?: unknown }).content;

  return typeof content === "string" && content.length > 0 ? content : undefined;
}

function consumeSseEvent(buffer: string): { event: string; rest: string } | undefined {
  const delimiter = /\r?\n\r?\n/.exec(buffer);
  if (!delimiter || delimiter.index === undefined) return undefined;

  return {
    event: buffer.slice(0, delimiter.index),
    rest: buffer.slice(delimiter.index + delimiter[0].length),
  };
}

export function createOpenRouterRatioAdapter({
  env = process.env as Record<string, string | undefined>,
  fetch: fetchImpl = globalThis.fetch,
  model = OPENROUTER_RATIO_MODEL,
  maxTokens = 2048,
  reasoning = { effort: "medium", exclude: true },
  provider,
}: OpenRouterRatioAdapterOptions = {}) {
  return {
    // signal, when given, is passed to fetch so the caller can cancel the
    // upstream request (and its token spend).
    async *stream(
      { systemPrompt, userPrompt }: OpenRouterRatioInput,
      { signal, plugins, onCitation }: OpenRouterStreamOptions = {},
    ): AsyncGenerator<string> {
      const apiKey = env.OPENROUTER_API?.trim();
      if (!apiKey) throw new Error("OPENROUTER_API is required for Ratio Relevance analysis");

      let response: Response;
      try {
        response = await fetchImpl(OPENROUTER_RATIO_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            stream: true,
            max_tokens: maxTokens,
            reasoning,
            ...(provider ? { provider } : {}),
            ...(plugins && plugins.length ? { plugins } : {}),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
          ...(signal ? { signal } : {}),
        });
      } catch {
        throw new Error("OpenRouter request failed");
      }

      if (!response.ok) {
        const status = `${response.status} ${response.statusText}`.trim();
        throw new Error(`OpenRouter request failed (${status})`);
      }
      if (!response.body) throw new Error("empty OpenRouter response body");

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";
      let reachedEof = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            reachedEof = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          let event = consumeSseEvent(buffer);
          while (event) {
            buffer = event.rest;
            const content = contentFromSseEvent(event.event, onCitation);
            if (content) yield content;
            event = consumeSseEvent(buffer);
          }
        }

        buffer += decoder.decode();
        if (buffer.trim().length > 0) {
          throw new MalformedOpenRouterSseError("incomplete event");
        }
      } catch (error) {
        if (error instanceof MalformedOpenRouterSseError || error instanceof OpenRouterSseError) throw error;
        throw new Error("OpenRouter SSE stream failed");
      } finally {
        if (!reachedEof) {
          try {
            await reader.cancel();
          } catch {
            // Preserve the original stream failure or consumer cancellation.
          }
        }
        reader.releaseLock();
      }
    },
  };
}
