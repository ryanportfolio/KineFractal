import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [
  about,
  aboutPage,
  app,
  alerts,
  controls,
  footer,
  logo,
  heroSignal,
  ratioRelevance,
  sectorRotation,
] = await Promise.all([
  read("client/src/components/about-hero.tsx"),
  read("client/src/pages/about.tsx"),
  read("client/src/App.tsx"),
  read("client/src/pages/alerts.tsx"),
  read("client/src/components/alert-control-panel.tsx"),
  read("client/src/components/footer.tsx"),
  read("client/src/components/kf-logo.tsx"),
  read("client/src/components/hero-signal.tsx"),
  read("client/src/pages/ratio-relevance.tsx"),
  read("client/src/pages/sector-rotation.tsx"),
]);

test("About centers a fixed-width suffix slot so KINE never moves", () => {
  assert.match(about, /className="relative w-full"/);
  assert.match(about, /inline-grid w-\[9ch\] text-left/);
  assert.match(about, /invisible[\s\S]*STRUCTURE/);
});

test("Alerts keeps controls directly after a content-sized header", () => {
  assert.doesNotMatch(alerts, /min-h-\[62svh\]/);
  assert.match(alerts, /id="control"/);
});

test("alert switch track cannot flex-shrink into its thumb", () => {
  assert.match(controls, /relative h-6 w-11 shrink-0 border/);
});

test("Footer omits diagnostic telemetry and theme controls", () => {
  for (const text of ["eod board", "phosphor:", "every trace replayed", "fills recorded"]) {
    assert.equal(footer.includes(text), false, text);
  }
});

test("top logo gradient blends through closely spaced color stops", () => {
  const gradient = logo.match(/top-gradient[\s\S]*?<\/linearGradient>/)?.[0] ?? "";
  const offsets = [...gradient.matchAll(/offset="(\d+)%"/g)].map((match) => Number(match[1]));
  assert.ok(offsets.length >= 6, offsets);
  assert.ok(Math.max(...offsets.slice(1).map((offset, index) => offset - offsets[index])) <= 25, offsets);
});

test("logo glow filter uses generous user-space bounds", () => {
  const filter = logo.match(/<filter id=\{`\$\{id\}-glow`\}[\s\S]*?<\/filter>/)?.[0] ?? "";
  assert.match(filter, /filterUnits="userSpaceOnUse"/);
  assert.match(filter, /x="-20" y="-20" width="140" height="140"/);
});

test("Home replays logo motion for every session, returning or not", () => {
  // DESIGN.md: never branch on prefers-reduced-motion (owner call, 2026-08-02).
  assert.match(heroSignal, /<KfLogo animate revealFx \/>/);
  assert.doesNotMatch(heroSignal, /<KfLogo animate=\{/);
});

test("About and Alerts rely on the single app-shell footer", () => {
  assert.equal(aboutPage.includes("LegalFooter"), false);
  assert.equal(alerts.includes("LegalFooter"), false);
});

test("About omits the app-shell footer instead of rendering a second footer", () => {
  assert.match(app, /normalizedLocation === "\/about"/);
  assert.match(app, /return null/);
});

test("Alerts removes redundant control and delivery chrome", () => {
  assert.equal(alerts.includes("CONTROL SURFACE"), false);
  assert.equal(alerts.includes("Your alert terminal"), false);
  assert.equal(controls.includes("DELIVERY"), false);
  assert.equal(controls.includes("ONE-CLICK UNSUBSCRIBE"), false);
});

test("alert preferences autosave without a manual save button", () => {
  const persist = controls.match(/const persist[\s\S]*?\n  useEffect\(\(\) => \{/g)?.at(-1) ?? "";
  assert.equal(controls.includes("SAVE ALERT SETTINGS"), false);
  assert.doesNotMatch(controls, /\bSave\b/);
  assert.match(controls, /700/);
  assert.match(controls, /saving settings…/);
  assert.match(persist, /setSavedPrefs\(snapshot\)/);
  assert.doesNotMatch(persist, /setPrefs\(normalized\)/);
});

test("About CTA cards prioritize destination and purpose over metadata", () => {
  assert.equal(about.includes("channel.channel"), false);
  assert.equal(about.includes("channel.phosphor.toUpperCase()"), false);
  assert.match(about, /group relative flex min-h-36 flex-col justify-center/);
  assert.match(about, /text-lg[^"]*md:text-xl/);
  assert.match(about, /text-sm[^"]*leading-relaxed[^"]*md:text-base/);
});

test("Alerts omits redundant channel and format explainers", () => {
  for (const text of ["WHAT ARRIVES", "FORMAT PREVIEW", "AlertChannelRows", "FormatPreview"]) {
    assert.equal(alerts.includes(text), false, text);
  }
});

test("About omits the trailing terminal-question hint", () => {
  assert.equal(aboutPage.includes("questions the site doesn't answer"), false);
});

test("Ratio Relevance and Sector Rotation rely on the app-shell footer", () => {
  assert.equal(ratioRelevance.includes("LegalFooter"), false);
  assert.equal(sectorRotation.includes("LegalFooter"), false);
});
