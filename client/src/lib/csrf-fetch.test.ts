import assert from "node:assert/strict";
import test from "node:test";

import { createCsrfFetch } from "./csrf-fetch";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("concurrent protected requests share one CSRF token acquisition", async () => {
  let tokenGets = 0;
  const protectedTokens: string[] = [];
  let releaseToken!: () => void;
  const tokenGate = new Promise<void>((resolve) => {
    releaseToken = resolve;
  });

  const fakeFetch: typeof fetch = async (input, init) => {
    if (String(input) === "/api/csrf-token") {
      tokenGets += 1;
      await tokenGate;
      return json({ csrfToken: "shared-token" });
    }
    protectedTokens.push(new Headers(init?.headers).get("x-csrf-token") ?? "");
    return json({ ok: true });
  };

  const csrfFetch = createCsrfFetch(fakeFetch);
  const first = csrfFetch("/api/alerts/prefs", { method: "PUT", body: "{}" });
  const second = csrfFetch("/api/alerts/prefs", { method: "PUT", body: "{}" });
  releaseToken();
  const responses = await Promise.all([first, second]);

  assert.equal(tokenGets, 1);
  assert.deepEqual(protectedTokens, ["shared-token", "shared-token"]);
  assert.equal(responses.every((response) => response.ok), true);
});

test("a rejected CSRF token refreshes once and retries the request", async () => {
  let tokenGets = 0;
  const protectedTokens: string[] = [];

  const fakeFetch: typeof fetch = async (input, init) => {
    if (String(input) === "/api/csrf-token") {
      tokenGets += 1;
      return json({ csrfToken: `token-${tokenGets}` });
    }
    const token = new Headers(init?.headers).get("x-csrf-token") ?? "";
    protectedTokens.push(token);
    return token === "token-1"
      ? json({ error: "Invalid CSRF token" }, 403)
      : json({ ok: true });
  };

  const csrfFetch = createCsrfFetch(fakeFetch);
  const response = await csrfFetch("/api/alerts/prefs", { method: "PUT", body: "{}" });

  assert.equal(response.ok, true);
  assert.equal(tokenGets, 2);
  assert.deepEqual(protectedTokens, ["token-1", "token-2"]);
});
