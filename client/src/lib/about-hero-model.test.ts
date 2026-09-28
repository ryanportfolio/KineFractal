import assert from "node:assert/strict";
import test from "node:test";

import { ABOUT_CTA_CHANNELS, KINE_WORDS, nextKineWordIndex } from "./about-hero-model";

test("maps the three About channels to requested routes and existing phosphors", () => {
  assert.deepEqual(
    ABOUT_CTA_CHANNELS.map(({ href, phosphor }) => ({ href, phosphor })),
    [
      { href: "/sector-rotation", phosphor: "emerald" },
      { href: "/ratio-relevance", phosphor: "amber" },
      { href: "/alerts", phosphor: "ice" },
    ],
  );
});

test("cycles Kine words and wraps after the final word", () => {
  assert.equal(KINE_WORDS.includes("LUMINA" as (typeof KINE_WORDS)[number]), false);
  assert.equal(KINE_WORDS.at(-1), "CONTEXT");
  assert.equal(nextKineWordIndex(0), 1);
  assert.equal(nextKineWordIndex(KINE_WORDS.length - 1), 0);
});
