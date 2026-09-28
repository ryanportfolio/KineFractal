import assert from "node:assert/strict";
import test from "node:test";
import { createOpenRouterRatioAdapter } from "./openrouter-ratio";

const MODEL = "google/gemini-3.1-flash-lite";
const input = {
  systemPrompt: "You are a capital-flow analyst.",
  userPrompt: "Analyze the ratio matrix.",
};

type CapturedRequest = {
  url: string;
  init: RequestInit | undefined;
};

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

function failingSseResponse(event: string, error: Error): Response {
  const encoder = new TextEncoder();
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(encoder.encode(event));
        return;
      }

      controller.error(error);
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

function sse(payload: unknown, eol = "\n"): string {
  return `data: ${JSON.stringify(payload)}${eol}${eol}`;
}

function rawSse(data: string, eol = "\n"): string {
  return `data: ${data}${eol}${eol}`;
}

function doneSse(eol = "\n"): string {
  return rawSse("[DONE]", eol);
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const content: string[] = [];
  for await (const chunk of stream) content.push(chunk);
  return content;
}

test("sends the pinned Gemini Flash Lite request with medium hidden reasoning", async () => {
  let request: CapturedRequest | undefined;
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      request = { url: String(url), init };
      return sseResponse([doneSse()]);
    },
  });

  await collect(adapter.stream(input));

  assert.equal(request?.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(request?.init?.method, "POST");
  assert.equal(new Headers(request?.init?.headers).get("authorization"), "Bearer test-openrouter-key");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    model: MODEL,
    stream: true,
    max_tokens: 2048,
    reasoning: { effort: "medium", exclude: true },
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
  });
});

test("requires a non-blank OPENROUTER_API without substitute-key fallbacks", async () => {
  for (const env of [
    { OPENROUTER_API_KEY: "must-not-be-used" },
    { GEMINI_API_KEY: "must-not-be-used" },
    { OPENROUTER_API: "" },
  ]) {
    let calls = 0;
    const adapter = createOpenRouterRatioAdapter({
      env,
      fetch: async () => {
        calls += 1;
        return sseResponse([doneSse()]);
      },
    });

    await assert.rejects(collect(adapter.stream(input)), /OPENROUTER_API/);
    assert.equal(calls, 0);
  }
});

test("yields only first-choice delta content from fragmented CRLF OpenRouter SSE", async () => {
  const reasoning = sse({ choices: [{ delta: { reasoning: "hidden chain" } }] }, "\r\n");
  const role = sse({ choices: [{ delta: { role: "assistant" } }] }, "\r\n");
  const firstContent = sse({
    choices: [
      { delta: { content: "first " } },
      { delta: { content: "ignore this" } },
    ],
  }, "\r\n");
  const reasoningDetails = sse({
    choices: [{ delta: { reasoning_details: [{ text: "still hidden" }] } }],
  }, "\r\n");
  const finalContent = sse({ choices: [{ delta: { content: "line" } }] }, "\r\n");
  const done = doneSse("\r\n");
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => sseResponse([
      reasoning.slice(0, 8),
      reasoning.slice(8) + role + firstContent.slice(0, -1),
      firstContent.slice(-1) + reasoningDetails + finalContent + done,
    ]),
  });

  assert.deepEqual(await collect(adapter.stream(input)), ["first ", "line"]);
});

test("throws an actionable error when OpenRouter rejects the request", async () => {
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => new Response("capacity exhausted", {
      status: 503,
      statusText: "Service Unavailable",
    }),
  });

  await assert.rejects(
    collect(adapter.stream(input)),
    /OpenRouter request failed \(503 Service Unavailable\)/,
  );
});

test("redacts OpenRouter request transport errors before callers can render them", async () => {
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => {
      throw new Error("Bearer secret-openrouter-token");
    },
  });

  await assert.rejects(
    collect(adapter.stream(input)),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(error.message, "OpenRouter request failed");
      assert.doesNotMatch(error.message, /secret-openrouter-token/);
      return true;
    },
  );
});

test("throws an actionable error when a successful response has no SSE body", async () => {
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => new Response(null, { status: 200 }),
  });

  await assert.rejects(collect(adapter.stream(input)), /empty OpenRouter response body/i);
});

test("throws an actionable error for malformed OpenRouter SSE", async () => {
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => sseResponse([rawSse("{not-valid-json")]),
  });

  await assert.rejects(collect(adapter.stream(input)), /malformed OpenRouter SSE/i);
});

test("throws an actionable sanitized error from an OpenRouter SSE error event", async () => {
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => sseResponse([
      sse({ error: { message: "capacity exhausted" } }),
    ]),
  });

  await assert.rejects(
    collect(adapter.stream(input)),
    /OpenRouter SSE error: capacity exhausted/i,
  );
});

test("redacts OpenRouter stream transport errors before callers can render them", async () => {
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => failingSseResponse(
      sse({ choices: [{ delta: { content: "partial" } }] }),
      new Error("Bearer secret-openrouter-token"),
    ),
  });

  await assert.rejects(
    collect(adapter.stream(input)),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(error.message, "OpenRouter SSE stream failed");
      assert.doesNotMatch(error.message, /secret-openrouter-token/);
      return true;
    },
  );
});

test("cancels the OpenRouter response body when the consumer stops early", async () => {
  const encoder = new TextEncoder();
  let cancelCalls = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sse({ choices: [{ delta: { content: "first" } }] })));
    },
    cancel() {
      cancelCalls += 1;
    },
  });
  const adapter = createOpenRouterRatioAdapter({
    env: { OPENROUTER_API: "test-openrouter-key" },
    fetch: async () => new Response(body, {
      headers: { "content-type": "text/event-stream" },
    }),
  });
  const iterator = adapter.stream(input);

  assert.deepEqual(await iterator.next(), { value: "first", done: false });
  await iterator.return(undefined);

  assert.equal(cancelCalls, 1);
});
