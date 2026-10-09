import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// section 04 is arming-gauges.tsx plus its mechanism-*.tsx parts
const mechanismSources = () => {
  const dir = new URL("../components/", import.meta.url);
  const parts = readdirSync(dir).filter((name) => /^mechanism-.*\.tsx$/.test(name)).sort();
  return [read("../components/arming-gauges.tsx"), ...parts.map((name) => read(`../components/${name}`))].join("\n");
};

test("homepage omits start-year cohorts and numbers six movements consecutively (mechanism section)", () => {
  const mechanism = read("../components/arming-gauges.tsx");

  assert.match(mechanism, /aria-hidden="true">04<\/div>/);
  assert.match(mechanism, /id="mechanism"/);
  assert.match(mechanism, /export function ArmingGauges\(/);
});

test("mechanism, replay and record use plain truthful labels (mechanism section)", () => {
  const mechanism = read("../components/arming-gauges.tsx");
  const all = mechanismSources();

  assert.match(mechanism, /HOW IT BUYS/);
  assert.match(mechanism, /HOW IT SELLS/);
  assert.doesNotMatch(all, /base order/i);
  assert.doesNotMatch(all, /sizing starts at 0%/i);
  assert.match(mechanism, /cooldown.*protection.*regime.*cash/is);
  assert.doesNotMatch(all, /\barmed\b|\bheadroom\b|\bfloor\b/i);
  assert.doesNotMatch(all, /fear score/i);
  assert.match(mechanism, /data-testid="buy-line-marker"/);
  assert.match(mechanism, /data-testid="fear-now-marker"/);
  assert.match(mechanism, /sr-only[^>]*>[^<]*buy line/is);
  assert.match(mechanism, /useBeam/);
});

test("how it buys: order size range in % of account, no minimum shown as a size when the rule starts at zero", () => {
  const mechanism = read("../components/arming-gauges.tsx");

  assert.match(mechanism, /% of account/);
  assert.match(mechanism, /fund\.minPct\s*>\s*0\s*\?[^:]*%\s*to\s*\$\{fund\.maxPct\}%[^:]*:\s*`up to \$\{fund\.maxPct\}%`/);
  assert.match(mechanism, /waiting \$\{points\}/);
  assert.match(mechanism, /buy line crossed/);
});

test("how it buys: one sizing curve at a time behind real WAI-ARIA tabs, labeled as the rule", () => {
  const curve = read("../components/mechanism-sizing-curve.tsx");

  assert.match(curve, /role="tablist"/);
  assert.match(curve, /role="tab"/);
  assert.match(curve, /role="tabpanel"/);
  assert.match(curve, /aria-selected=\{/);
  assert.match(curve, /<button/);
  assert.match(curve, /ArrowRight/);
  assert.match(curve, /ArrowLeft/);
  assert.match(curve, /% of account/);
  assert.match(curve, /not an executed order/i);
  // the plotted size comes from the fund's live sizing policy
  assert.match(curve, /fund\.minPct \+ \(fund\.maxPct - fund\.minPct\) \* Math\.pow\(f, fund\.power\)/);
  // the maximum order size is always labeled; label placement moves it, never hides it
  assert.match(curve, /`\$\{fund\.maxPct\}% maximum`/);
  assert.match(curve, />\{maxText\}<\/text>/);
  assert.doesNotMatch(curve, /display:\s*[^}]*"none"/);
});

test("how it sells: the methodology link is a 44px touch target on phones", () => {
  const mechanism = read("../components/arming-gauges.tsx");
  assert.match(mechanism, /<Link href="\/#rulebook" className="[^"]*\bmin-h-\[44px\][^"]*">full methodology →/);
});

test("how it sells: three groups with schematic sketches built from TRIM_INFO", () => {
  const sells = read("../components/mechanism-sells.tsx");

  assert.match(sells, /title: "trim"/);
  assert.match(sells, /title: "exit"/);
  assert.match(sells, /title: "watch markets"/);
  assert.match(sells, /TRIM_INFO/);
  assert.match(sells, /schematic/i);
  // schematic sketches label shapes with words only, never numbers
  for (const [, label] of sells.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
    assert.doesNotMatch(label, /\d/, `sketch label "${label}" has no numbers`);
  }
  for (const name of ["Extension ladder", "Profit ladder", "Trailing harvest", "Protective exit", "Breadth omen", "Credit stress", "Dollar shock", "Narrow leadership"]) {
    assert.ok(sells.includes(`"${name}"`), `${name} is grouped`);
  }
  const mechanism = read("../components/arming-gauges.tsx");
  assert.match(mechanism, /href="\/#rulebook"[^>]*>full methodology →/);
  assert.match(mechanism, /simulated rules/i);
  assert.match(mechanism, /thresholds differ by fund/i);
});
