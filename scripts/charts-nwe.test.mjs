import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The NW (Nadaraya-Watson envelope) toggle on the /charts/ page, read as text like the other
// charts-*.test.mjs files. The math itself is covered by nwe-envelope.test.mjs.
const html = await readFile(new URL("../server/charts-app/charts.html", import.meta.url), "utf8");
const server = await readFile(new URL("../server/fearlab-charts.ts", import.meta.url), "utf8");
const attrs = await readFile(new URL("../.gitattributes", import.meta.url), "utf8");

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
function listOf(pattern) {
  const m = pattern.exec(html);
  assert.ok(m, "list found: " + pattern);
  return m[1];
}

test("the page loads the math file with a versioned script tag, before the code that uses it", () => {
  const tag = '<script src="nwe-envelope.js?v=__NWE_ENVELOPE_VERSION__"></script>';
  assert.equal(html.split(tag).length, 2, "exactly one script tag");
  assert.equal(html.split("__NWE_ENVELOPE_VERSION__").length, 2, "the token appears nowhere else");
  assert.ok(html.indexOf(tag) < html.indexOf("var PREF_IDS = ["), "the tag comes before the inline script");
});

test("the server serves the math file and swaps the token for its content hash", () => {
  assert.match(server, /const NWE_ENVELOPE_TOKEN = "__NWE_ENVELOPE_VERSION__";/);
  assert.match(server, /path\.resolve\(process\.cwd\(\), "server\/charts-app\/nwe-envelope\.js"\)/);
  assert.match(server, /version: createHash\("sha256"\)\.update\(body\)\.digest\("hex"\)\.slice\(0, 16\)/);
  assert.match(server, /page\.split\(NWE_ENVELOPE_TOKEN\)\.join\(nwe\.version\)/);
  const at = server.indexOf('app.get("/charts/nwe-envelope.js"');
  assert.notEqual(at, -1, "route exists");
  const route = server.slice(at, server.indexOf("\n  });", at));
  assert.match(route, /res\.set\("Cache-Control", "no-store"\);\s*res\.status\(404\)/, "a missing file is a 404 that is not cached");
  assert.match(route, /res\.set\("Content-Type", "text\/javascript; charset=utf-8"\);/);
  assert.match(route, /req\.query\.v === file\.version\s*\? "public, max-age=31536000, immutable"\s*: CHARTS_DOCUMENT_CACHE/);
  assert.match(attrs, /^server\/charts-app\/nwe-envelope\.js text eol=lf\r?$/m);
});

test("the NW toggle is off by default, saved with the other toggles and shown to every visitor", () => {
  assert.match(html, /<input type="checkbox" id="tNwe"><span class="swatch"[^>]*><\/span>NW<\/label>/, "no checked attribute");
  assert.match(listOf(/var PREF_IDS = \[([^\]]*)\]/), /'tNwe'/);
  assert.match(fnBody("toggleSolo"), /var SYS = \[[^\]]*'tNwe'/);
  assert.doesNotMatch(listOf(/var SITE_HIDE_LAYERS = \[([\s\S]*?)\];/), /tNwe/);
  // the tooltip is one or two plain sentences: no '=' shorthand, no em or en dash
  const tip = /<label title="([^"]*)"><input type="checkbox" id="tNwe">/.exec(html);
  assert.ok(tip, "the toggle's label has a tooltip");
  assert.ok(tip[1].length >= 30 && tip[1].length <= 220, "tooltip length " + tip[1].length);
  assert.doesNotMatch(tip[1], /[=—–]/);
  assert.match(tip[1], /^[A-Z][^.]+\.( [A-Z][^.]+\.)?$/, "one or two sentences");
});

test("the legend has an nw card in its index, with a live screen and the card's own text", () => {
  const cards = listOf(/var CHART_LEGEND = \[([\s\S]*?)\n\];/);
  assert.match(cards, /\{ id:'nw', name:'Nadaraya-Watson envelope', toggle:'NW · tNwe \(off\)', colors:\['--cbuy','--csell'\],\n/);
  const card = cards.slice(cards.indexOf("{ id:'nw',"), cards.indexOf("{ id:'log',"));
  for (const field of ["plain", "one", "what", "how", "intent", "caveat"]) {
    assert.match(card, new RegExp("\\n    " + field + ":'[^\\n]{40,}',\\n"), field + " has text");
  }
  assert.doesNotMatch(card, /[—–]/, "no em or en dash in the card");
  assert.match(listOf(/var LG2_FAMILIES = \[([\s\S]*?)\n\];/), /\['Price', \['bars', 'log', 'nw'\]\]/);
  assert.match(listOf(/var LG2_LIVE = \{([\s\S]*?)\};/), /\bnw: \['tNwe'\]/);
  // shown on the site, and no replay scene: the text column shows the card's own fields
  assert.doesNotMatch(listOf(/var SITE_HIDE_LAYERS = \[([\s\S]*?)\];/), /legend: 'nw'/);
  assert.doesNotMatch(listOf(/var SITE_HIDE_LEGEND_CARDS = \[([^\]]*)\]/), /'nw'/);
  assert.doesNotMatch(listOf(/var LG2_DEMO = \{([\s\S]*?)\n\};/), /\n  nw:/);
  assert.match(html, /var LG2_CARD_TEXT = \['nw'\];/);
  assert.match(fnBody("lg2BuildText"), /if \(!spec && LG2_CARD_TEXT\.indexOf\(e\.id\) >= 0\) spec = \{ read: \[e\.what, e\.intent, e\.how\]\.join\('\\n'\)\.split\('\\n'\), note: e\.caveat \};/);
  // the live screen draws through drawNwe with the starting settings, and not while comparing
  assert.match(fnBody("lg2BuildLive"), /else if \(code === 'nw'\) \{\s*(?:\/\/[^\n]*\n\s*)*var nwSet = nweDefaults\(\), nwLive = comparing \? null : drawNwe\(T, current\.candles, nwSet\);/);
});

test("the guided tour has an NW step after TH, offered when the chart has candles and the math loaded", () => {
  assert.match(listOf(/var TOUR_OVL = \[([^\]]*)\]/), /'tThrust', 'tNwe', 'tOB'/);
  const tour = listOf(/var TOUR = \[([\s\S]*?)\n\];/);
  const step = /\{ toggle: 'tNwe', name: '([^']+)', sw: '(--[a-z]+)',\s*lead: "([^"]+)",\s*detail: "([^"]+)",\s*tags: \[([^\n]*)\] \}/.exec(tour);
  assert.ok(step, "the step has the shape of the others");
  assert.equal(step[1], "Nadaraya-Watson envelope (NW)");
  assert.ok(step[3].length > 20 && step[4].length > 20, "lead and detail have text");
  assert.doesNotMatch(step[3] + step[4] + step[5], /[—–]/);
  const at = (id) => tour.indexOf("toggle: '" + id + "'");
  assert.ok(at("tThrust") < at("tNwe") && at("tNwe") < at("tOB"), "in toolbar order");
  assert.match(fnBody("tourPresent"), /else if \(t === 'tNwe'\) has = !!window\.NWEnvelope && \(current\.candles \|\| \[\]\)\.length > 0;/);
  // ending the tour puts back every toggle the tour switches, and nothing is saved while it runs
  assert.match(html, /var TOUR_ALL = TOUR_OVL\.concat\(\['tLog', 'tMine'\]\);/);
  assert.match(fnBody("endTour"), /TOUR_ALL\.forEach\(function \(id\) \{ document\.getElementById\(id\)\.checked = _tourSaved\[id\]; \}\);/);
  assert.match(fnBody("savePrefs"), /_tourActive/);
});

test("the settings button opens a labelled panel with the four settings and a reset", () => {
  assert.match(html, /<button id="nweSetBtn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="nweMenu" aria-label="Envelope settings"/);
  assert.match(html, /<div id="nweMenu" role="dialog" aria-label="Envelope settings" hidden>/);
  assert.match(html, /<label for="nweBw">[^<]+<\/label>\s*<input id="nweBw" type="number" min="1" max="200" step="0\.5"/);
  assert.match(html, /<label for="nweMult">[^<]+<\/label>\s*<input id="nweMult" type="number" min="0" max="10" step="0\.1"/);
  assert.match(html, /<label for="nweSrc">[^<]+<\/label>\s*<select id="nweSrc"><\/select>/);
  assert.match(html, /<label for="nweWidth">[^<]+<\/label>\s*<select id="nweWidth"[^>]*>\s*<option value="edge">[^<]+<\/option>\s*<option value="alert">[^<]+<\/option>\s*<\/select>/);
  assert.match(html, /<button id="nweReset" type="button">/);
  // the source list comes from the math file, not from the page
  assert.match(fnBody("wireNwe"), /\(L \? L\.SOURCES : \[\]\)\.forEach/);
  // Escape closes the panel and hands focus back to the button. Any other key stops there only
  // while one of the panel's boxes has focus (typing); otherwise it goes on to the page shortcuts.
  assert.match(html, /var onField = document\.activeElement && \/\^\(INPUT\|SELECT\|TEXTAREA\)\$\/\.test\(document\.activeElement\.tagName\);\n(?:\s*\/\/[^\n]*\n)*\s*if \(nweMenuOpen\(\)\) \{\s*if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); closeNweMenu\(true\); return; \}\s*if \(onField\) return;\s*\}\s*if \(_tourActive\) \{/);
  assert.match(fnBody("closeNweMenu"), /if \(refocus\) document\.getElementById\('nweSetBtn'\)\.focus\(\);/);
});

test("starting the tour closes the settings panel and leaves focus alone", () => {
  // startTour is the one way into the tour (the t key and the header button both call it), so
  // the close sits there, after the check that a tour can start and before the tour takes over
  const start = fnBody("startTour");
  assert.match(start, /if \(!current \|\| _tourActive\) return;\n\s*closeNweMenu\(false\);[^\n]*\n\s*_tourSaved = \{\};/);
  assert.doesNotMatch(start, /closeNweMenu\(true\)|\.focus\(\)/, "no focus move: the tour takes its keys from the page");
  assert.match(html, /document\.getElementById\('tourBtn'\)\.onclick = startTour;/);
  assert.match(html, /if \(e\.key === 't' && current && !drawMode && !onField\) \{ startTour\(\); return; \}/);
  // closing without the refocus flag only hides the panel and resets the button's state
  assert.match(fnBody("closeNweMenu"), /^\{\s*if \(!nweMenuOpen\(\)\) return;\s*document\.getElementById\('nweMenu'\)\.hidden = true;\s*document\.getElementById\('nweSetBtn'\)\.setAttribute\('aria-expanded', 'false'\);\s*if \(refocus\) document\.getElementById\('nweSetBtn'\)\.focus\(\);\s*\}$/);
});

test("touch targets in the panel are 44px tall on phones", () => {
  const css = html.slice(0, html.indexOf("</style>"));
  assert.match(css, /@media \(max-width:600px\) \{\s*#nweSetBtn \{ min-width:44px; min-height:44px; \}\s*#nweMenu input, #nweMenu select, #nweMenu button \{ min-height:44px; \}/);
  assert.match(css, /#nweMenu \{[^}]*max-width:calc\(100vw - 8px\)/);
});

test("settings are kept per timeframe in this browser, and a bad number is refused", () => {
  assert.match(html, /var NWE_KEY = 'kf-nwe-settings-v1';/);
  assert.match(fnBody("nweKey"), /return TF_ORDER\.indexOf\(tf\) >= 0 \? tf : 'other';/);
  assert.match(fnBody("nweTf"), /var cur = currentSuper\(\);/);
  assert.match(fnBody("nweSettings"), /return nweValid\(s\) \? \{ bandwidth: s\.bandwidth, mult: s\.mult, source: s\.source, width: s\.width \} : nweDefaults\(\);/);
  assert.match(fnBody("nweReset"), /delete nweStore\(\)\[nweKey\(nweTf\(\)\)\];/);
  const apply = fnBody("nweApplyFields");
  assert.match(apply, /var ok = text !== '' && nweNumberOk\(v, f\[0\]\);/);
  assert.match(apply, /nweMark\(f\[0\], ok \|\| retyping\);\s*if \(ok\) next\[f\[1\]\] = v;/);
  assert.match(fnBody("nweMark"), /el\.setAttribute\('aria-invalid', 'true'\)/);
  // run the range check: numbers only, inside the box's own min and max
  const ok = new Function("document", "return function nweNumberOk(v, id) " + fnBody("nweNumberOk"))({
    getElementById: () => ({ min: "1", max: "200" }),
  });
  assert.equal(ok(17, "nweBw"), true);
  assert.equal(ok(1, "nweBw"), true);
  assert.equal(ok(200, "nweBw"), true);
  assert.equal(ok(0, "nweBw"), false);
  assert.equal(ok(-3, "nweBw"), false);
  assert.equal(ok(200.5, "nweBw"), false);
  assert.equal(ok(NaN, "nweBw"), false);
  assert.equal(ok("17", "nweBw"), false, "a number kept as text is not usable");
});

test("the settings panel comes right after its button in the page, so Tab moves between them in order", () => {
  // Tab follows the markup: the NW toggle, the settings button, the panel's five controls, then the CF toggle
  const m = /<input type="checkbox" id="tNwe">[^\n]*<button id="nweSetBtn"[^>]*>[^<]*<\/button><\/span>\s*(?:<!--[\s\S]*?-->\s*)?<div id="nweMenu"[^>]*>([\s\S]*?)<\/div>\s*<label title="[^"]*"><input type="checkbox" id="tConfl"/.exec(html);
  assert.ok(m, "the panel is the next element after the settings button's group, and the CF toggle follows it");
  const controls = Array.from(m[1].matchAll(/<(?:input|select|button|a|textarea)\b[^>]*?\bid="([^"]+)"/g), (x) => x[1]);
  assert.deepEqual(controls, ["nweBw", "nweMult", "nweSrc", "nweWidth", "nweReset"]);
  assert.doesNotMatch(m[1], /tabindex/, "nothing in the panel changes the Tab order");
  assert.equal(html.split('<div id="nweMenu"').length, 2, "one panel in the page");
  // focus landing outside the panel and its button closes the panel, so it is never left open behind
  assert.match(fnBody("wireNwe"), /document\.addEventListener\('focusin', function \(e\) \{\s*if \(nweMenuOpen\(\) && !e\.target\.closest\('#nweMenu, #nweSetBtn'\)\) closeNweMenu\(false\);\s*\}\);/);
  // the panel is placed against the window (position:fixed). That holds only while the toolbar around it
  // does not become the box a fixed element is placed in, and does not clip it.
  const css = html.slice(0, html.indexOf("</style>"));
  assert.match(css, /#nweMenu \{ position:fixed; z-index:70;/);
  const barRules = Array.from(css.matchAll(/(?:^|[\s,}])#bar \{([^}]*)\}/g), (x) => x[1]);
  assert.ok(barRules.length >= 1, "the toolbar's own rule is found");
  assert.match(barRules[0], /overflow:visible;/);
  for (const rule of barRules) {
    assert.doesNotMatch(rule, /transform|filter|contain|perspective|will-change|clip-path|overflow:(?!visible)|zoom/, "toolbar rule: " + rule.trim());
  }
});

test("a number box emptied to retype it shows no error line until the visitor leaves it", () => {
  const apply = fnBody("nweApplyFields");
  assert.match(html, /function nweApplyFields\(e\) \{/);
  assert.match(apply, /var typing = !!e && e\.type === 'input';/);
  assert.match(apply, /var retyping = text === '' && typing && document\.activeElement === el;/);
  // the error lines are still announced when they do show
  assert.match(html, /<p id="nweBwMsg" class="nwe-msg" role="alert" hidden>/);
  assert.match(html, /<p id="nweMultMsg" class="nwe-msg" role="alert" hidden>/);
  // leaving a box counts through change, and through blur for a box that was already empty when it
  // took focus (no change event fires for that one)
  const wire = fnBody("wireNwe");
  assert.match(wire, /el\.addEventListener\('input', nweApplyFields\);\s*el\.addEventListener\('change', nweApplyFields\);\s*(?:\/\/[^\n]*\n\s*)*if \(el\.type === 'number'\) el\.addEventListener\('blur', nweApplyFields\);/);
  // a press on Reset does not take focus out of the box first (the error line would move the button)
  assert.match(wire, /if \(id === 'nweReset'\) \{\s*el\.onclick = nweReset;\s*(?:\/\/[^\n]*\n\s*)*el\.onmousedown = function \(e\) \{ e\.preventDefault\(\); \};\s*return;\s*\}/);

  // run the function against stand-ins for the page: which boxes get marked, and which value is kept
  const boxes = {
    nweBw: { min: "1", max: "200", value: "17" },
    nweMult: { min: "0", max: "10", value: "2.4" },
    nweSrc: { value: "low" },
    nweWidth: { value: "edge" },
  };
  const doc = { activeElement: null, getElementById: (id) => boxes[id] };
  const marks = {};
  const store = {};
  const numberOk = new Function("document", "return function nweNumberOk(v, id) " + fnBody("nweNumberOk"))(doc);
  const applyFields = new Function(
    "window", "document", "nweKey", "nweTf", "nweSettings", "nweNumberOk", "nweMark", "nweMenuOpen", "placeNweMenu",
    "nweStore", "nweSaveStore", "current", "redraw", "return function nweApplyFields(e) " + apply,
  )(
    { NWEnvelope: { SOURCES: ["low", "close"], WIDTHS: ["edge", "alert"] } }, doc, () => "1d", () => "1d",
    () => store["1d"] || { bandwidth: 17, mult: 2.4, source: "low", width: "edge" }, numberOk,
    (id, ok) => { marks[id] = ok; }, () => false, () => {}, () => store, () => {}, null, () => {},
  );
  const mult = () => (store["1d"] ? store["1d"].mult : 2.4);

  boxes.nweMult.value = "";
  doc.activeElement = boxes.nweMult;
  applyFields({ type: "input" });
  assert.deepEqual([marks.nweMult, marks.nweBw, mult()], [true, true, 2.4], "emptied and still focused: no error, last good value kept");
  applyFields({ type: "change" });
  assert.deepEqual([marks.nweMult, mult()], [false, 2.4], "left empty (change): error, last good value kept");
  applyFields({ type: "input" });
  assert.equal(marks.nweMult, true, "typing in it again clears the error while it is empty");
  applyFields({ type: "blur" });
  assert.equal(marks.nweMult, false, "left empty (blur): error");
  doc.activeElement = boxes.nweBw;
  applyFields({ type: "input" });
  assert.deepEqual([marks.nweMult, marks.nweBw], [false, true], "typing in another box does not clear an empty box's error");
  doc.activeElement = boxes.nweMult;
  boxes.nweMult.value = "50";
  applyFields({ type: "input" });
  assert.deepEqual([marks.nweMult, mult()], [false, 2.4], "a value out of range shows the error at once");
  boxes.nweMult.value = "3";
  applyFields({ type: "input" });
  assert.deepEqual([marks.nweMult, mult()], [true, 3], "a usable value applies at once");
  boxes.nweMult.value = "";
  applyFields({ type: "input" });
  assert.deepEqual([marks.nweMult, mult()], [true, 3], "emptied again: no error, 3 stays in use");
});

test("the bands are two line series with their own marks, hidden while comparing", () => {
  const draw = fnBody("drawNwe");
  assert.match(draw, /L\.envelope\(src, s\.bandwidth, s\.mult, s\.width\)/);
  assert.match(draw, /band\(getCss\('--cbuy'\), lower, marks\.up, 'belowBar', 'arrowUp'\)/);
  assert.match(draw, /band\(getCss\('--csell'\), upper, marks\.down, 'aboveBar', 'arrowDown'\)/);
  assert.doesNotMatch(draw, /T\.cs\.setMarkers/, "the candle series' markers belong to TH");
  assert.match(fnBody("redraw"), /if \(document\.getElementById\('tNwe'\)\.checked && !comparing\) \{\s*_nweDrawn = drawNwe\(mainT, current\.candles, nweSettings\(nweKey\(nweTf\(\)\)\)\);/);
  assert.match(html, /window\.KFNwe = \{\s*snapshot: function \(\) \{/);
});
