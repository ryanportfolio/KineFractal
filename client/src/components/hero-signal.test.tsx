import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("home logo host is not hidden by a redundant opacity transition", async () => {
  Object.assign(globalThis, { React });
  const { HeroSignal } = await import("./hero-signal");
  const markup = renderToStaticMarkup(<HeroSignal />);
  const host = markup.match(/<div style="([^"]*width:clamp\(170px[^"]*)"/);

  assert.ok(host, "expected the centered logo host");
  assert.doesNotMatch(host[1], /opacity:0/, "the logo animates itself after mounting");
});

test("hero keeps the plain-language tagline and removes channel telemetry", async () => {
  Object.assign(globalThis, { React });
  const { HeroSignal } = await import("./hero-signal");
  const markup = renderToStaticMarkup(<HeroSignal />);

  assert.match(markup, /buys fear in SPY, QQQ and IWM → trims into strength/);
  assert.doesNotMatch(markup, />CH\d/);
  assert.doesNotMatch(markup, /\barmed\b|\bquiet\b|\bfloor\b/i);
});

test("hero acquires the history progressively instead of seeding it in one frame", () => {
  const source = readFileSync(new URL("./hero-signal.tsx", import.meta.url), "utf8");

  assert.match(source, /acquisitionProgress/);
  assert.match(source, /depositBed\(api, 0\.28, acquiredTo, progress\)/);
  assert.doesNotMatch(source, /depositBed\(api, 0\.4\)/);
  assert.doesNotMatch(source, /prefers-reduced-motion/);
});

test("static signal fallback fades in", () => {
  const source = readFileSync(new URL("./hero-signal.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

  assert.match(source, /hero-signal-fallback-in/);
  assert.match(css, /@keyframes hero-signal-fallback-in/);
  assert.doesNotMatch(css, /prefers-reduced-motion/);
});
