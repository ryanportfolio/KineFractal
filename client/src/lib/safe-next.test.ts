import assert from "node:assert/strict";
import test from "node:test";
import { nextLabel, safeNext } from "./safe-next";

test("same-origin paths pass through", () => {
  assert.equal(safeNext("/charts/"), "/charts/");
  assert.equal(safeNext("/lab/spy?x=1#top"), "/lab/spy?x=1#top");
});

test("anything that could leave the site is rejected", () => {
  for (const raw of [
    null,
    "",
    "charts",
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/charts/\u0000",
    "/\tevil",
    "/" + "a".repeat(600),
  ]) {
    assert.equal(safeNext(raw), null, JSON.stringify(raw));
  }
});

test("link text names the charts page and falls back for others", () => {
  assert.equal(nextLabel("/charts/"), "charts");
  assert.equal(nextLabel("/lab"), "where you were");
});
