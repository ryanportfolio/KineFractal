const OPENROUTER_RATIO_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_RATIO_MODEL = "google/gemini-3.1-flash-lite";

export interface OpenRouterRatioInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface OpenRouterRatioAdapterOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
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

function contentFromSseEvent(event: string): string | undefined {
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
}: OpenRouterRatioAdapterOptions = {}) {
  return {
    async *stream({ systemPrompt, userPrompt }: OpenRouterRatioInput): AsyncGenerator<string> {
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
            model: OPENROUTER_RATIO_MODEL,
            stream: true,
            max_tokens: 2048,
            reasoning: { effort: "medium", exclude: true },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
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
            const content = contentFromSseEvent(event.event);
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
