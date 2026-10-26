import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../server/charts-app/charts.html", import.meta.url), "utf8");
const css = html.slice(0, html.indexOf("</style>"));

function fnBody(name) {
  const start = html.indexOf("function " + name + "(");
  assert.notEqual(start, -1, name + " exists");
  const open = html.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) return html.slice(open, i + 1);
  }
  throw new Error("unclosed " + name);
}

test("the saved light theme is applied in <head>, before the page paints", () => {
  const head = html.slice(0, html.indexOf("<style>"));
  assert.match(head, /localStorage\.getItem\('kf-chart-theme-v1'\) === 'light'\) document\.documentElement\.setAttribute\('data-theme', 'light'\)/);
  assert.match(html, /var THEME_KEY = 'kf-chart-theme-v1';/);
});

test("light theme tokens stay hex, so lightweight-charts can parse them", () => {
  const block = /html\[data-theme="light"\] \{ color-scheme:light;([\s\S]*?)\}/.exec(css);
  assert.ok(block, "light token block");
  const tokens = [...block[1].matchAll(/--(bg|panel|grid|fg|mut|sup|res|lvl|gap|ss|ssr|prom|thr|rr|cbuy|csell|pdeq|mine|struct|dpool|gex|uoac|uoap|meas):([^;]+);/g)];
  assert.equal(tokens.length, 24);
  for (const [, name, value] of tokens) assert.match(value, /^#[0-9a-f]{6}$/, "--" + name + " is #rrggbb");
});

test("light theme sets Verdana and larger text on every element, the dark theme keeps its fonts", () => {
  assert.match(css, /html\[data-theme="light"\] body \*::after \{\s*font-family:Verdana,Geneva,sans-serif !important; font-size-adjust:0\.6 !important; \}/);
  assert.match(css, /font:14px "Space Grotesk","Segoe UI",Verdana,sans-serif;/);
  const layout = fnBody("chartLayout");
  assert.match(layout, /fontSize: 16 \}/);
  assert.match(layout, /if \(lightTheme\(\)\) \{ l\.fontSize = 18; l\.fontFamily = 'Verdana, Geneva, sans-serif'; \}/);
});

test("the theme switch is a labelled toggle that remakes the chart and saves to the account", () => {
  assert.match(html, /<button id="themeBtn" class="symbtn tip-right" type="button" aria-pressed="false" aria-label="Light theme"/);
  const set = fnBody("setTheme");
  assert.match(set, /localStorage\.setItem\(THEME_KEY, light \? 'light' : 'dark'\)/);
  assert.match(set, /if \(current\) redraw\(\);/);
  assert.match(set, /if \(byUser\) \{ _viewEdited = true; saveViewPrefs\(\); \}/);
  assert.match(fnBody("renderThemeBtn"), /b\.setAttribute\('aria-pressed', light \? 'true' : 'false'\);/);
});

test("labels on hover hides line labels and shows the ones under the pointer", () => {
  assert.match(html, /<input type="checkbox" id="tHoverTags">labels on hover<\/label>/);
  assert.match(html, /var HOVER_TAGS_KEY = 'kf-chart-hover-labels-v1';/);
  assert.match(html, /lineTags = \[\]; trackLineTags\(cs\);/);
  const track = fnBody("trackLineTags");
  assert.match(track, /Object\.assign\(\{\}, o, \{ title: '', axisLabelVisible: false \}\)/);
  const apply = fnBody("applyLineTags");
  assert.match(apply, /var show = !hide \|\| lineTagHit\(t\.p\);/);
  assert.match(apply, /t\.line\.applyOptions\(show \? \{ title: t\.title, axisLabelVisible: t\.axis \} : \{ title: '', axisLabelVisible: false \}\);/);
  assert.match(fnBody("drawLevelTags"), /hoverTagsOn\(\) \? lvlTags\.filter\(function \(g\) \{ return lineTagHit\(g\.p\); \}\) : lvlTags/);
  assert.match(html, /document\.getElementById\('chart'\)\.addEventListener\('mouseleave', onTagHover\);/);
  // the toggle is its own preference, so solo and the tour never rewrite it
  assert.doesNotMatch(html, /var PREF_IDS = \[[^\]]*tHoverTags/);
});

test("signed in, the theme and labels choice load from and save to /api/chart-prefs", () => {
  assert.match(fnBody("loadAccountGapPlacement"), /if \(j && j\.account\) applyAccountViewPrefs\(j\.viewPrefs\);/);
  const apply = fnBody("applyAccountViewPrefs");
  assert.match(apply, /if \(_viewEdited\) return;/);
  const save = fnBody("saveViewPrefs");
  assert.match(save, /if \(!\(SITE && siteUser === true\)\) return;/);
  assert.match(save, /JSON\.stringify\(\{ viewPrefs: \{ theme: lightTheme\(\) \? 'light' : 'dark', hoverLabels: hoverTagsOn\(\) \} \}\)/);
  assert.match(save, /putExportGroups\(body, false, '\/api\/chart-prefs'\)/);
});
