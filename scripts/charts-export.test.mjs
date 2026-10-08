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
  assert.match(html, /if \(csrf\) return putExportGroups\(true\);/);
  assert.match(html, /!remote\.length && local\.length && !groupsSynced\(\)/);
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
  assert.match(html, /<p id="exportLegend">/);
  assert.match(html, /'<p class="xp-incl">Includes '/);
});

test("the CSV columns and the stacked-level rule are unchanged", () => {
  assert.match(html, /'Ticker,Limit price,Signal,Touches,Timeframes,Gap zone,Below close %,Last close'/);
  assert.match(html, /var CLUSTER_PCT = 2;/);
  assert.match(html, /localStorage\.setItem\('kf-export-strength', mode\)/);
});
