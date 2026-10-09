import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../server/charts-app/charts.html", import.meta.url), "utf8");

test("the export dialog rebuilds live, with Download CSV as its one action", () => {
  assert.doesNotMatch(html, /id="exportBuild"/);
  assert.doesNotMatch(html, /id="exportPicksToggle"/);
  assert.match(html, /<button id="exportCsv" class="xp-primary" type="button" disabled>Download CSV<\/button>/);
  assert.match(html, /function scheduleExportBuild\(delay\)/);
  assert.match(html, /if \(gen !== _exportGen\) return;/);
});

test("tickers show full names and an instant tooltip on hover and keyboard focus", () => {
  assert.match(html, /function tickerName\(sym\) \{ return \(superMap\[sym\] && superMap\[sym\]\.name\) \|\| ''; \}/);
  assert.match(html, /<div id="exportTip" role="tooltip" hidden><\/div>/);
  assert.match(html, /dialog\.addEventListener\('mouseover'/);
  assert.match(html, /dialog\.addEventListener\('focusin'/);
  assert.match(html, /label\.setAttribute\('data-tip', tickerTip\(sym\)\)/);
});

test("ticker groups save to the account with a CSRF token, else to this browser", () => {
  assert.match(html, /var EXPORT_GROUPS_KEY = 'kf-export-groups-v1';/);
  assert.match(html, /fetch\('\/api\/chart-groups', \{ credentials: 'same-origin', cache: 'no-store' \}\)/);
  assert.match(html, /'X-CSRF-Token': token/);
  assert.match(html, /if \(csrf\) return putExportGroups\(body, true\);/);
  assert.match(html, /!remote\.length && guest\.length && siteEmail && !groupsSynced\(\)/);
  assert.match(html, /_exportGroupsLocked = maybeAccount;/);
});

test("Download never hands out rows from before the latest change, and bad ranges are shown, not replaced", () => {
  assert.match(html, /_exportCsvReady = false;\s*document\.getElementById\('exportCsv'\)\.disabled = true;/);
  assert.match(html, /if \(!_exportCsvReady \|\| !_exportRows \|\| !_exportRows\.length\) return;/);
  assert.match(html, /if \(minPct >= depthPct\) return \{ error: 'Set min below max\.' \};/);
});

test("the group editor is labelled, Escape closes it before the dialog, delete takes two clicks", () => {
  assert.match(html, /<div id="exportEditor" role="region" aria-labelledby="exportEditorTitle" hidden>/);
  assert.match(html, /if \(!document\.getElementById\('exportEditor'\)\.hidden\) closeExportEditor\(true\);/);
  assert.match(html, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); onExportEscape\(\); \}/);
  assert.match(html, /del\.textContent = 'Click again to delete';/);
});

test("combining nearby levels is stated on screen and adjustable", () => {
  assert.match(html, /<button id="exportCombineToggle" type="button" role="switch" aria-checked="true" aria-labelledby="exportCombineTitle"><\/button>/);
  assert.match(html, /<input id="exportCombinePct" type="range" min="0\.5" max="5" step="0\.5" value="2"/);
  assert.match(html, /var EXPORT_COMBINE_KEY = 'kf-export-combine-v1';/);
  assert.match(html, /if \(!_exportCombineOn\) return rows;/);
});

test("each card leads with the nearest strong price, in plain words, with a why panel", () => {
  assert.match(html, /\(tier === 'strong' \? 'Nearest strong price' : 'Nearest price'\)/);
  assert.match(html, /var STRENGTH_WORD = \{ strong: 'Strong', mid: 'Medium', light: 'Weaker' \};/);
  assert.match(html, /if \(row\.type === 'gap'\) return 'A price gap from earlier has not been filled yet';/);
  assert.match(html, /<aside id="exportWhy" aria-labelledby="exportWhyTitle" hidden>/);
  assert.match(html, /if \(_whyOpen\) closeWhyPanel\(true\);/);
  assert.match(html, /Chart signals are clues, not guarantees; prices can keep falling\./);
});

test("results switch between cards and one table, reasons stay in tooltips", () => {
  assert.match(html, /var EXPORT_VIEW_KEY = 'kf-export-view-v1';/);
  assert.match(html, /<span id="exportViewSwitch" class="xp-seg" role="group" aria-labelledby="exportViewLabel">/);
  assert.match(html, /wrap\.innerHTML = _exportView === 'table' \? exportTableHtml\(sections\) : exportCardsHtml\(sections\);/);
  assert.match(html, /'<tr class="xp-trow tier-' \+ t \+ '" tabindex="0"' \+ limitAttrs\(sec\.sym, lim, k\) \+ '>'/);
  assert.match(html, /return t \+ '\\nClick for the chart and details';/);
  assert.doesNotMatch(html, /class="xp-link xp-why"/);
});

test("the CSV columns and the stacked-level rule are unchanged", () => {
  assert.match(html, /'Ticker,Limit price,Signal,Touches,Timeframes,Gap zone,Below close %,Last close'/);
  assert.match(html, /var CLUSTER_PCT = 2;/);
  assert.match(html, /localStorage\.setItem\('kf-export-strength', mode\)/);
});
