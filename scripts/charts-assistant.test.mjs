import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../server/charts-app/charts.html", import.meta.url), "utf8");

function fnBody(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is defined`);
  const next = html.indexOf("\nfunction ", start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

test("fact band sits between the toolbar and the chart, hidden until signed in", () => {
  assert.match(html, /<\/div>\s*<section id="factBand"[^>]*data-state="loading"[^>]*hidden>/);
  assert.match(html, /<\/section>\s*<div id="chart">/);
  assert.match(html, /#factBand\[hidden\] \{ display:none; \}/);
  assert.match(html, /#factBand \{[^}]*flex:0 0 auto;[^}]*flex-wrap:wrap/s);
});

test("fact band exposes the stable hooks the checks read", () => {
  for (const fact of ["yield", "cadence", "trend", "vs6mHigh", "nearestBuy"]) {
    const tile = html.match(new RegExp(`data-fact="${fact}">([\\s\\S]*?)\\n  </div>`));
    assert.ok(tile, `tile ${fact}`);
    assert.match(tile[1], /class="fact-value"/, `${fact} has a .fact-value`);
    assert.match(tile[1], /class="fact-source">[^<]+</, `${fact} has a non-empty .fact-source`);
  }
  assert.match(html, /data-fact="overall">\s*<span class="fact-value">/);
  for (const w of ["d21", "m3", "m6"]) {
    assert.match(html, new RegExp(`data-window="${w}">.*<span class="fact-change">.*<span class="fact-verdict">`));
  }
  assert.match(html, /band\.setAttribute\('data-symbol', sym\)/);
  assert.match(html, /band\.setAttribute\('data-state', state\)/);
  assert.match(html, /state = r\.ok \? 'ready' : 'error'/);
});

test("trend says it is price change, and missing data shows a dash", () => {
  assert.match(html, /TREND <span class="fb-sub">price change, not total return<\/span>/);
  const fill = fnBody("fillFactBand");
  assert.match(fill, /setFactTile\('yield', 'none'/);
  assert.match(fill, /setFactTile\('cadence', '—'/);
  assert.match(fill, /includes a special payout/);
  assert.match(fnBody("setFactWindow"), /win \? fbSigned\(win\.change\) : '—'/);
  assert.match(fill, /overall \|\| '—'/);
});

test("facts load one symbol at a time through a cached, de-duplicated tickerFacts()", () => {
  const body = fnBody("tickerFacts");
  assert.match(body, /if \(sym in _tickerFactsCache\) return Promise\.resolve\(_tickerFactsCache\[sym\]\);/);
  assert.match(body, /if \(_tickerFactsPending\[sym\]\) return _tickerFactsPending\[sym\];/);
  assert.match(body, /fetch\('\/api\/ticker-facts\?symbols=' \+ encodeURIComponent\(sym\)/);
  assert.match(html, /factBandShow\(c\.sym\);/);
  assert.match(fnBody("factBandShow"), /if \(sym === _factSym\) return;/);
});

test("signed out: no band and no facts request", () => {
  const facts = fnBody("tickerFacts");
  const guard = facts.indexOf("if (!SITE || siteUser !== true) return Promise.resolve(null);");
  assert.ok(guard >= 0, "tickerFacts refuses unless signed in");
  assert.ok(guard < facts.indexOf("fetch("), "the guard runs before the request");
  const render = fnBody("renderFactBand");
  const hide = render.indexOf("if (!SITE || siteUser !== true || !_factSym) { band.hidden = true; return; }");
  assert.ok(hide >= 0, "renderFactBand hides the band unless signed in");
  assert.ok(hide < render.indexOf("tickerFacts("), "the band hides before asking for facts");
  assert.equal(html.match(/fetch\('\/api\/ticker-facts/g).length, 1, "one place requests facts");
});

test("nearest buy reuses the Limit Buy dialog's lead-price code", () => {
  const lead = fnBody("exportLeadPrice");
  assert.match(lead, /exportSectionFor\(item, range, strength\)/);
  assert.match(lead, /markExportClusters\(sec\.rows\)/);
  assert.match(lead, /limits\[nearestStrongIndex\(limits\)\]/);
  assert.match(fnBody("buildExportTable"), /exportSectionFor\(item, range, _exportStrength\)/);
  assert.match(fnBody("exportCardsHtml"), /var lead = nearestStrongIndex\(limits\);/);
  assert.match(fnBody("renderFactBand"), /exportLeadPrice\(sym, resolve\)/);
});

test("trend cells are toggle buttons that shade their window on the chart", () => {
  for (const w of ["d21", "m3", "m6"]) {
    assert.match(html, new RegExp(`<button type="button" class="fb-cell" aria-pressed="false"[^>]*data-window="${w}">`));
  }
  assert.match(fnBody("setFactWindow"), /cell\.setAttribute\('aria-disabled', win \? 'false' : 'true'\)/);
  assert.match(fnBody("setTrendHlCells"), /cell\.setAttribute\('aria-pressed', w === on \? 'true' : 'false'\)/);
  const toggle = fnBody("toggleTrendWindow");
  assert.match(toggle, /if \(_trendHl && _trendHl\.w === w\) \{ clearTrendHighlight\(\); return; \}/);
  assert.match(toggle, /revealTrendWindow\(bars\.si, bars\.ei\)/);
});

test("the highlight exposes the stable hooks the checks read", () => {
  assert.match(fnBody("trendHlEl"), /el\.id = 'trendHighlight';/);
  const toggle = fnBody("toggleTrendWindow");
  for (const attr of ["data-window", "data-start-date", "data-start-close", "data-end-date", "data-end-close"]) {
    assert.ok(toggle.includes(`el.setAttribute('${attr}'`), attr);
  }
  assert.match(toggle, /TREND_HL_NAMES\[w\] \+ ' ' \+ fbSigned\(win\.change\) \+ ' ' \+ win\.verdict/);
  assert.match(html, /<button type="button" class="fb-hlclear" data-action="clear-highlight" hidden>Clear<\/button>/);
  assert.match(html, /#trendHighlight\[hidden\] \{ display:none; \}/);
});

test("the window starts on the first bar on or after startDate, by New York date", () => {
  assert.match(fnBody("etDay"), /timeZone: ET_TZ/);
  assert.match(fnBody("trendHlBars"), /if \(si < 0 && d >= h\.win\.startDate\) si = i;/);
  assert.match(fnBody("trendHlBars"), /if \(d <= h\.asOf\) ei = i;/);
});

test("the line runs from startClose to the as-of close through the chart's own scales", () => {
  const pos = fnBody("positionTrendHighlight");
  assert.match(pos, /candleSeries\.priceToCoordinate\(h\.win\.startClose\), y2 = candleSeries\.priceToCoordinate\(h\.close\)/);
  assert.match(pos, /ts\.logicalToCoordinate\(bars\.si\), ex = ts\.logicalToCoordinate\(bars\.ei\)/);
});

test("the highlight follows pan and zoom, and ticker or timeframe changes clear it", () => {
  const redraw = fnBody("redraw");
  assert.match(redraw, /cs\.attachPrimitive\(trendHlPrimitive\);/);
  assert.match(redraw, /subscribeVisibleLogicalRangeChange\(scheduleTrendHighlight\)/);
  assert.match(redraw, /positionTourCard\(\); positionTrendHighlight\(\);/);
  assert.match(fnBody("show"), /factBandShow\(c\.sym\);[^\n]*\n\s*clearTrendHighlight\(\);/);
  assert.match(fnBody("renderFactBand"), /clearTrendHighlight\(\);/);
});

test("ASK AI: a top-row button toggles a right-side dock and a 52px rail, signed in only", () => {
  assert.match(html, /<button id="askAiBtn" type="button" aria-expanded="false" aria-controls="askDock" hidden>ASK AI<\/button>/);
  assert.match(html, /<aside id="askDock"[^>]*data-mode="rail" hidden>/);
  assert.match(html, /#askDock\[data-mode="rail"\] \{ width:52px; \}/);
  assert.match(html, /body\.ask-open #factBand, body\.ask-open #chart \{ margin-right:var\(--askW\); \}/);
  assert.match(html, /body\.ask-rail #factBand, body\.ask-rail #chart \{ margin-right:52px; \}/);
  const render = fnBody("renderAskDock");
  assert.match(render, /var on = SITE && siteUser === true;/);
  assert.match(render, /btn\.hidden = !on;\s*dock\.hidden = !on;/);
  assert.match(render, /dock\.setAttribute\('data-symbol', sym\)/);
  assert.match(render, /'ASK ABOUT ' \+ \(sym \|\| '—'\)/);
  assert.match(fnBody("renderFactBand"), /renderAskDock\(\);/);
  const mode = fnBody("setAskMode");
  assert.match(mode, /setAttribute\('aria-expanded', mode === 'open' \? 'true' : 'false'\)/);
  assert.match(mode, /localStorage\.setItem\(ASK_MODE_KEY, mode\)/);
  assert.match(mode, /el\.focus\(\);/);
  assert.match(html, /var ASK_MODE_KEY = 'kf-ask-dock-v1';/);
});

test("ASK AI: Esc in the dock collapses it to the rail and returns focus to the button", () => {
  const init = fnBody("initAskDock");
  assert.match(init, /dock\.addEventListener\('keydown', function \(e\) \{\s*e\.stopPropagation\(\);\s*if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); collapseAskDock\(\); \}/);
  assert.match(fnBody("collapseAskDock"), /setAskMode\('rail'\);\s*document\.getElementById\('askAiBtn'\)\.focus\(\);/);
});

test("ASK AI: chips and rail icons, with payout for payers and Compare with QQQ for non-payers", () => {
  for (const k of ["yield", "why", "payout", "compare", "buy"]) assert.match(html, new RegExp(`class="ask-chip" data-chip="${k}"`));
  for (const k of ["yield", "trend", "payout", "compare", "buy", "ask"]) {
    assert.match(html, new RegExp(`class="ask-railbtn" data-rail="${k}" aria-label="[^"]+" data-tip="[^"]+"`));
  }
  const render = fnBody("renderAskDock");
  assert.match(render, /'Why ' \+ overall \+ '\?'/);
  assert.match(render, /\[data-chip="yield"\]'\)\.hidden = !\(known && payer\);/, "hidden while facts load, shown only for payers");
  assert.match(render, /\[data-chip="payout"\]'\)\.hidden = !\(known && payer\)/);
  assert.match(render, /\[data-chip="compare"\]'\)\.hidden = !\(known && !payer\)/);
  assert.match(render, /\[data-rail="yield"\]'\)\.hidden = !\(known && payer\)/);
  assert.match(render, /\[data-rail="payout"\]'\)\.hidden = !\(known && payer\)/);
  assert.match(render, /\[data-rail="compare"\]'\)\.hidden = !\(known && !payer\)/);
  assert.doesNotMatch(html, /Compare yield/i);
});

test("ASK AI: chips answer from facts with a source line, never a model call or a pay date", () => {
  const chunk = html.slice(html.indexOf("// --- ASK AI dock"), html.indexOf("// --- typed questions"));
  assert.ok(chunk.length > 1000, "chip code found");
  assert.doesNotMatch(chunk, /ticker-assistant/, "chips never call the assistant route");
  assert.doesNotMatch(chunk, /fetch\(/, "facts only through tickerFacts()");
  assert.doesNotMatch(chunk, /pay(ment)? date/i);
  for (const name of ["runAskChip", "askCompareAnswer", "askBuyAnswer", "askAnswer"]) {
    assert.doesNotMatch(fnBody(name), /sendAskQuestion|postAskQuestion|fetch\(/, `${name} makes no model call`);
  }
  assert.match(fnBody("askAnswer"), /askNode\('p', 'ask-src', 'Source: ' \+ source\)/);
  assert.match(fnBody("askCompareAnswer"), /tickerFacts\('QQQ'\)/);
  assert.match(fnBody("runAskChip"), /'Next ex-date expected around ' \+ fbDay\(next\) \+ ' \(estimate from the ' \+ f\.cadence \+ ' cadence; not an announced date\)\.'/);
  assert.match(fnBody("askBuyAnswer"), /px2\(buy\.lim\.row\.limit\)/);
  assert.match(fnBody("initAskDock"), /addEventListener\('submit', function \(e\) \{\s*e\.preventDefault\(\);/);
  assert.match(html, /<div id="askAnswer" aria-live="polite"><\/div>/);
  assert.match(html, /<input id="askInput"[^>]*aria-label="[^"]+"/);
  assert.match(html, /Not investment advice, and the site never places orders\./);
});

test("ASK AI: a chip answer shown before the facts arrive is answered again when they do", () => {
  assert.match(fnBody("setAskPressed"), /_askChip = chip;/);
  assert.match(fnBody("askHint"), /setAskPressed\(null\);/);
  const render = fnBody("renderFactBand");
  const ready = render.indexOf("_factReady = { sym: sym,");
  const rerun = render.indexOf("if (_askChip && _askSym === sym) runAskChip(_askChip);");
  assert.ok(ready >= 0 && rerun > ready, "the answer is rebuilt after the new facts are stored");
  assert.match(fnBody("runAskChip"), /if \(!r\) return askAnswer\(sym \|\| 'Facts', \['Facts for ' \+ sym \+ ' are still loading\./);
});

test("ASK AI: a typed question posts symbol, question and nearest buy with the CSRF header", () => {
  const post = fnBody("postAskQuestion");
  assert.match(post, /fetch\('\/api\/ticker-assistant', \{/);
  assert.match(post, /method: 'POST'/);
  assert.match(post, /'X-CSRF-Token': token/);
  assert.match(post, /chartCsrfToken\(retried\)/, "reuses the page's CSRF helper");
  assert.match(post, /r\.status === 419 \|\| j\.code === 'CSRF_REFRESH_NEEDED'/);
  assert.match(post, /postAskQuestion\(body, true, signal\)/, "one retry with a fresh token");
  const send = fnBody("sendAskQuestion");
  assert.match(send, /var payload = \{ symbols: \[sym\], question: question \};/);
  assert.match(send, /payload\.nearestBuy\[sym\] = buyPx;/);
  assert.match(fnBody("askNearestBuy"), /Number\(px2\(buy\.lim\.row\.limit\)\)/, "the price the band shows");
  assert.equal(html.match(/fetch\('\/api\/ticker-assistant'/g).length, 1, "one place calls the assistant");
  const submit = fnBody("initAskDock");
  assert.match(submit, /addEventListener\('submit', function \(e\) \{\s*e\.preventDefault\(\);\s*if \(_askReq\) return;/);
  assert.match(submit, /sendAskQuestion\(q\);/);
});

test("ASK AI: the answer streams in as text under the question, source line last", () => {
  const send = fnBody("sendAskQuestion");
  assert.match(fnBody("askTypedCard"), /askNode\('p', 'ask-q', question\)/);
  assert.match(fnBody("readAskStream"), /r\.body\.getReader\(\)/);
  assert.match(fnBody("readAskStream"), /if \(!live\(\)\) \{ reader\.cancel\(\)/, "a dropped answer stops reading");
  assert.match(send, /readAskStream\(r, function \(\) \{ return _askReq === req; \}, add\)\.then\(function \(complete\) \{ if \(complete\) finish\(\); \}\)/);
  assert.match(send, /text\.data \+= chunk;/, "chunks append to a text node");
  assert.match(send, /card\.appendChild\(askNode\('p', 'ask-src', last\)\);/);
  assert.ok(send.includes("if (/\\[Answer interrupted/.test(all) || !/^Source: /.test(last)) return fail(ASK_FAIL_MSG, true);"),
    "an interrupted answer or one without the source line ends in the retry message");
  const typed = html.slice(html.indexOf("// --- typed questions"), html.indexOf("function initAskDock("));
  assert.doesNotMatch(typed, /innerHTML|insertAdjacentHTML|outerHTML/, "never rendered as HTML");
  assert.match(fnBody("setAskBusy"), /send\.disabled = on;/);
  assert.match(fnBody("setAskBusy"), /box\.setAttribute\('aria-busy', 'true'\)/);
});

test("ASK AI: a ticker change, a chip or a new question aborts the running answer", () => {
  const abort = fnBody("askAbort");
  assert.match(abort, /if \(req\.ctl\) req\.ctl\.abort\(\);/);
  assert.match(fnBody("renderAskDock"), /if \(sym !== _askSym\) \{[^}]*askAbort\(\);/);
  assert.match(fnBody("renderAskDock"), /if \(!on\) \{ askAbort\(\); return; \}/);
  assert.match(fnBody("runAskChip"), /askAbort\(\);/);
  assert.match(fnBody("sendAskQuestion"), /askAbort\(\);/);
  assert.match(fnBody("sendAskQuestion"), /if \(e && e\.name === 'AbortError'\) return;/);
});

test("ASK AI: errors show plain messages; network, 5xx and interrupted answers get Retry", () => {
  assert.match(html, /var ASK_FAIL_MSG = "Couldn't get an answer\. Try again\.";/);
  const err = fnBody("askTypedError");
  assert.match(err, /b\.setAttribute\('data-action', 'ask-retry'\);/);
  assert.match(err, /sendAskQuestion\(_askLast\.question\);/);
  const send = fnBody("sendAskQuestion");
  assert.match(send, /if \(!r\.ok\) return fail\(ASK_FAIL_MSG, true\);/);
  assert.match(send, /\.catch\(function \(e\) \{[\s\S]*fail\(ASK_FAIL_MSG, true\);/);
  assert.match(send, /r\.status === 401\) \{[\s\S]*?showSignupCta\(/, "401 shows the sign-in prompt");
  assert.match(send, /r\.status === 404\) return fail\('No facts for ' \+ sym/);
  const cap = send.slice(send.indexOf("r.status === 429"), send.indexOf("r.status === 400"));
  assert.match(cap, /j\.error/, "429 shows the server's limit message");
  assert.match(cap, /fail\(m, false\)/, "and no Retry");
  assert.doesNotMatch(send, /r\.status \+|statusText|e\.message|e\.stack/, "no status codes or error text on screen");
});

test("Limit Buy table: YIELD, CADENCE, 21D, 3M, 6M cells on each ticker's heading row, signed in only", () => {
  assert.match(html, /var XP_FACT_KEYS = \['yield', 'cadence', 'd21', 'm3', 'm6'\];/);
  for (const head of ["'Yield'", "'Cadence'", "'21D'", "'3M'", "'6M'"]) assert.ok(html.includes(`[${head}, `), `header ${head}`);
  const table = fnBody("exportTableHtml");
  assert.match(table, /var facts = xpFactsOn\(\)/);
  assert.match(table, /<tbody data-sec="' \+ escHtml\(sec\.sym\) \+ '"><tr class="xp-tgroup"/);
  assert.match(table, /XP_FACT_KEYS\.map\(function \(key\) \{ return xpFactCellHtml\(sec\.sym, key\); \}\)/);
  assert.match(fnBody("xpFactsOn"), /return SITE && siteUser === true;/);
  assert.match(fnBody("xpFactCellHtml"), /data-xp-fact="' \+ key \+ '" data-state="' \+ v\.state \+ '"/);
  assert.doesNotMatch(fnBody("exportCardsHtml"), /data-xp-fact|xpFact/, "cards view has no fact cells");
});

test("Limit Buy table: fact cells format change, yield and cadence, and show a dash when missing", () => {
  const view = fnBody("xpFactView");
  assert.match(view, /state: 'pending'/);
  assert.match(view, /state: 'error', text: '—'/);
  assert.match(view, /f\.yield\.toFixed\(2\) \+ '%'/);
  assert.match(view, /var payer = !!\(f\.cadence && f\.cadence !== 'none'\);/);
  assert.match(view, /text: fbSigned\(win\.change\), cls: win\.change > 0 \? 'is-up' : win\.change < 0 \? 'is-down' : 'is-flat'/);
  assert.match(view, /not total return/);
  assert.match(fnBody("xpFactCellHtml"), /class="xp-fpend" aria-hidden="true"/);
});

test("Limit Buy table: facts load lazily, through tickerFacts, at most 3 at once", () => {
  assert.match(html, /var XP_FACT_MAX = 3;/);
  const pump = fnBody("pumpXpFacts");
  assert.match(pump, /while \(_xpFactRunning < XP_FACT_MAX && _xpFactQueue\.length\)/);
  assert.match(pump, /tickerFacts\(sym\)/);
  assert.match(pump, /_xpFactRunning--;/);
  const want = fnBody("xpFactWant");
  assert.match(want, /if \(!xpFactsOn\(\) \|\| _exportView !== 'table'\) return;/);
  assert.match(want, /if \(sym in _tickerFactsCache\) \{ fillXpFactCells\(sym\); return; \}/);
  assert.match(want, /if \(st === 'loading' \|\| \(st === 'error' && !urgent\)\) return;/);
  assert.match(fnBody("xpFactDrop"), /if \(_xpFactState\[sym\] !== 'queued'\) return;/);
  const obs = fnBody("observeXpFactRows");
  assert.match(obs, /new IntersectionObserver\(/);
  assert.match(obs, /document\.getElementById\('exportMain'\)/);
  assert.match(obs, /if \(e\.isIntersecting\) xpFactWant\(sym, false\); else xpFactDrop\(sym\);/);
  assert.match(fnBody("renderExportTable"), /observeXpFactRows\(\);/);
  assert.match(fnBody("openFirstPrice"), /xpFactWant\(sym, true\);/, "selecting a ticker loads it");
  assert.match(fnBody("closeExportDialog"), /stopXpFactRows\(\);/);
  assert.match(fnBody("openExportDialog"), /stopXpFactRows\(\);/);
  assert.doesNotMatch(fnBody("openExportDialog"), /tickerFacts|xpFactWant/, "opening the dialog fetches nothing");
  assert.equal(html.match(/fetch\('\/api\/ticker-facts/g).length, 1, "one place fetches facts");
});

const xpChunk = html.slice(html.indexOf("// --- Limit Buy: assistant column"), html.indexOf("function exportTableHtml("));

test("Limit Buy assistant column: markup hooks, signed in only, with the selection count", () => {
  assert.ok(xpChunk.length > 2000, "assistant column code found");
  assert.match(html, /<aside id="xpAssist" aria-labelledby="xpAssistTitle" hidden>/);
  for (const k of ["monthly", "yield", "up3", "buy"]) {
    assert.match(html, new RegExp(`<button type="button" class="xp-check" data-xp-check="${k}">`), `check ${k}`);
  }
  assert.match(html, /<p id="xpAssistProgress" role="status" aria-live="polite"><\/p>/);
  assert.match(html, /<div id="xpAssistAnswer" aria-live="polite"><\/div>/);
  assert.match(html, /<input id="xpAskInput"[^>]*aria-label="[^"]+"/);
  assert.match(html, /<div id="xpFilterChip" hidden><span>Filtered by assistant: up in all three periods<\/span><button type="button" data-action="clear-xp-filter" aria-label="[^"]+">/);
  const render = fnBody("renderXpAssist");
  assert.match(render, /on = xpFactsOn\(\);\s*box\.hidden = !on;/);
  assert.match(render, /classList\.toggle\('has-assist', on\)/);
  assert.match(render, /' ticker' \+ \(syms\.length === 1 \? '' : 's'\) \+ ' selected\)'/);
  assert.match(fnBody("updateExportPickCount"), /renderXpAssist\(\);/);
  assert.match(html, /#exportDialog \.xp-body\.has-assist \{ grid-template-columns:/);
});

test("Limit Buy assistant column: quick checks answer from facts and lead prices, never the model", () => {
  for (const name of ["runXpCheck", "xpRunTick", "xpCheckAnswer", "xpBuyAnswer", "xpLeadPrices", "applyXpFilter", "xpAnswerCard"]) {
    assert.doesNotMatch(fnBody(name), /postAskQuestion|sendXpQuestion|fetch\(|ticker-assistant/, `${name} makes no model call`);
  }
  assert.doesNotMatch(xpChunk, /fetch\(/, "facts only through the queue and tickerFacts()");
  assert.doesNotMatch(xpChunk, /innerHTML|insertAdjacentHTML|outerHTML/, "answers are built as text");
  assert.match(fnBody("xpAnswerCard"), /askNode\('p', 'ask-src', 'Source: ' \+ source\)/);
  const answer = fnBody("xpCheckAnswer");
  assert.match(answer, /x\.f\.cadence === 'monthly'/);
  assert.match(answer, /askPayer\(x\.f\) && fbNum\(x\.f\.yield\)/);
  assert.match(answer, /top\.sym \+ ' yields ' \+ top\.f\.yield\.toFixed\(1\) \+ '%/);
  const leads = fnBody("xpLeadPrices");
  assert.match(leads, /limits\[nearestStrongIndex\(limits\)\]/, "the lead price Cards view shows");
  assert.match(leads, /pct: pctBelow\(lim\.row\)/);
  assert.match(fnBody("xpBuyAnswer"), /\.sort\(function \(a, b\) \{ return a\.pct - b\.pct; \}\)/, "closest first");
});

test("Limit Buy assistant column: up in all three never includes a negative or missing window", () => {
  const answer = fnBody("xpCheckAnswer");
  assert.match(answer, /if \(!c\.every\(function \(v\) \{ return fbNum\(v\); \}\)\) return;/, "a missing window rules a ticker out");
  assert.match(answer, /if \(pos === 3\) up\.push\(x\.sym\);/);
  assert.match(answer, /else if \(pos === 2 && neg === 1\)/, "close = exactly one window down, two up");
  assert.match(answer, /_xpFilter = \{ up: up, close: close\.map/);
  const apply = fnBody("applyXpFilter");
  assert.match(apply, /tb\.hidden = on && _xpFilter\.up\.indexOf\(tb\.getAttribute\('data-sec'\)\) < 0;/);
  assert.match(apply, /sec\.id = 'xpCloseSection';/);
  assert.match(apply, /'Close: down in one period'/);
  assert.match(apply, /document\.getElementById\('xpFilterChip'\)\.hidden = !on;/);
});

test("Limit Buy assistant column: whole-selection checks load through the shared 3-at-a-time queue", () => {
  const run = fnBody("runXpCheck");
  assert.match(run, /if \(kind === 'buy'\) return xpBuyAnswer\(syms\);/, "buy needs no facts");
  assert.match(run, /if \(st === 'loading' \|\| st === 'queued'\) return;/, "never a second request");
  assert.match(run, /_xpFactQueue\.push\(sym\);/);
  assert.match(run, /pumpXpFacts\(\);\s*xpRunTick\(\);/);
  assert.match(fnBody("pumpXpFacts"), /xpRunTick\(\);/);
  const tick = fnBody("xpRunTick");
  assert.match(tick, /'Checking ' \+ done \+ ' of ' \+ run\.syms\.length \+ ' tickers…'/);
  assert.match(tick, /setXpBusy\(true\);/);
  assert.match(fnBody("setXpBusy"), /box\.setAttribute\('data-busy', 'true'\)/);
  assert.match(fnBody("xpFactDrop"), /if \(xpRunNeeds\(sym\)\) return;/, "scrolling away keeps a check's tickers queued");
  assert.match(fnBody("stopXpFactRows"), /if \(xpRunNeeds\(sym\)\) keep\.push\(sym\);/);
  assert.match(fnBody("xpPartialNote"), /'Partial answer: '/);
  assert.match(fnBody("xpPartialNote"), /'could not check ' \+ xpList\(r\.failed\)/);
});

test("Limit Buy assistant column: the filter goes on selection change, close, Cards view or its clear button", () => {
  assert.match(fnBody("renderXpAssist"), /if \(key === _xpSelKey\) return;[\s\S]*clearXpFilter\(\);/);
  assert.match(fnBody("setExportView"), /if \(_exportView === 'cards'\) clearXpFilter\(\);/);
  assert.match(fnBody("closeExportDialog"), /resetXpAssist\(\);/);
  assert.match(fnBody("openExportDialog"), /resetXpAssist\(\);/);
  assert.match(fnBody("resetXpAssist"), /clearXpFilter\(\);/);
  assert.match(fnBody("renderExportTable"), /applyXpFilter\(\);/, "a rebuild with the same selection keeps it");
  assert.match(fnBody("wireXpAssist"), /\[data-action="clear-xp-filter"\]'\)\.addEventListener\('click', function \(\) \{\s*clearXpFilter\(\);/);
  assert.match(fnBody("wireExportDialog"), /wireXpAssist\(\);/);
});

test("Limit Buy assistant column: typed questions send every selected ticker, at most 40", () => {
  assert.match(html, /var XP_ASK_MAX = 40;/);
  const send = fnBody("sendXpQuestion");
  const cap = send.indexOf("if (syms.length > XP_ASK_MAX)");
  assert.ok(cap >= 0 && cap < send.indexOf("postAskQuestion("), "the 40 limit is checked before anything is sent");
  assert.match(send, /Narrow the selection to '\s*\+ XP_ASK_MAX \+ ' or fewer/);
  assert.match(send, /var payload = \{ symbols: syms, question: question \}/);
  assert.match(send, /var syms = checkedExportSymbols\(\);/);
  assert.match(send, /postAskQuestion\(JSON\.stringify\(payload\), false, req\.ctl && req\.ctl\.signal\)/, "the dock's CSRF helper");
  assert.match(send, /readAskStream\(r, live, add\)/);
  assert.match(send, /text\.data \+= chunk;/);
  assert.match(send, /if \(!r\.ok\) return fail\(ASK_FAIL_MSG, true\);/);
  assert.match(send, /r\.status === 429/);
  assert.match(fnBody("xpTypedError"), /b\.setAttribute\('data-action', 'xp-ask-retry'\);/);
  assert.match(fnBody("wireXpAssist"), /if \(_xpAskReq\) return;/);
  assert.equal(html.match(/fetch\('\/api\/ticker-assistant'/g).length, 1, "one place calls the assistant");
});

test("NEAREST BUY uses the account's gap placement from page start", () => {
  const load = fnBody("loadAccountGapPlacement");
  assert.match(load, /if \(!SITE \|\| siteUser !== true\) return;/);
  assert.match(load, /fetch\('\/api\/chart-prefs', \{ credentials: 'same-origin', cache: 'no-store' \}\)/);
  assert.match(load, /if \(!j \|\| !j\.account \|\| !j\.stored \|\| !GAP_PLACEMENT_HINTS\[j\.gapPlacement\]\) return;/);
  assert.match(load, /setGapPlacement\(j\.gapPlacement, false\);/);
  assert.match(load, /refreshFactBandBuy\(\);/);
  assert.match(fnBody("initSiteAccount"), /renderFactBand\(\);\s*loadAccountGapPlacement\(\);/);
});

test("closing Limit Buy refreshes only NEAREST BUY, so a trend highlight stays", () => {
  const close = fnBody("closeExportDialog");
  assert.match(close, /refreshFactBandBuy\(\);/);
  assert.doesNotMatch(close, /renderFactBand\(\)/);
  const refresh = fnBody("refreshFactBandBuy");
  assert.match(refresh, /exportLeadPrice\(r\.sym, function \(buy\)/);
  assert.match(refresh, /setNearestBuyTile\(buy\);/);
  assert.doesNotMatch(refresh, /clearTrendHighlight/);
  assert.match(fnBody("fillFactBand"), /setNearestBuyTile\(buy\);/);
});

test("the highlight's endpoint dots are at least 6px", () => {
  const dots = fnBody("trendHlEl").match(/<circle r="(\d+(?:\.\d+)?)"><\/circle>/g);
  assert.equal(dots.length, 2);
  for (const d of dots) assert.ok(Number(d.match(/r="([\d.]+)"/)[1]) >= 6, d);
});

test("the Limit Buy table keeps its column headings visible while it scrolls", () => {
  assert.match(html, /\.xp-table thead \{ position:sticky; top:-14px; z-index:2; \}/);
  assert.match(html, /\.xp-table thead th, \.xp-table thead \.xp-fhead \{ padding-top:14px; background:var\(--panel\);/);
  // no horizontal scroller around the table at any width: it would trap the sticky headings
  assert.match(html, /\.xp-tablewrap \{ overflow-x:visible; \}/);
  assert.doesNotMatch(html, /\.xp-tablewrap \{ overflow-x:auto; \}/);
  // under 900px the dialog body scrolls and has no top padding to cover
  assert.match(html, /@media \(max-width:900px\) \{[^}]*\.xp-table thead \{ top:0; \}/);
});

test("phones: a failed facts load offers Try again on the collapsed summary line", () => {
  assert.match(html, /<div class="fb-summary">[\s\S]*?<button type="button" class="fb-sumretry" hidden>Try again<\/button>/);
  assert.match(fnBody("setFactMsg"), /\.fb-sumretry'\)\.hidden = !retry;/);
  assert.match(html, /#factBand \.fb-sumretry'\)\.addEventListener\('click', renderFactBand\);/);
  assert.match(html, /#factBand \.fb-sumretry\[hidden\], #factBand\.is-expanded \.fb-sumretry \{ display:none; \}/);
});

test("phones: the fact band starts collapsed to one line with a toggle", () => {
  assert.match(html, /<div class="fb-summary">[\s\S]*?<button type="button" class="fb-toggle" data-action="fact-band-toggle" aria-expanded="false">All facts<\/button>/);
  assert.match(html, /#factBand:not\(\.is-expanded\) > \.fb-tile, #factBand:not\(\.is-expanded\) > \.fb-msg \{ display:none; \}/);
  assert.match(html, /@media \(min-width:601px\) \{ #factBand \.fb-summary \{ display:none; \} \}/);
  assert.match(html, /#factBand \.fb-toggle \{[^}]*min-height:44px/);
  assert.match(html, /\[data-action="fact-band-toggle"\]'\)\.addEventListener\('click', function \(\) \{[\s\S]*?band\.classList\.toggle\('is-expanded', open\);\s*this\.setAttribute\('aria-expanded', open \? 'true' : 'false'\);/);
  assert.match(fnBody("initAskDock"), /if \(mode === 'open' && window\.matchMedia && window\.matchMedia\('\(max-width:700px\)'\)\.matches\) mode = 'rail';/,
    "a saved open dock does not open as a full-screen sheet over the band on phones");
  const fill = fnBody("fillFactBand");
  assert.match(fill, /\.fb-sumsym'\)\.textContent = sym;/);
  assert.match(fill, /st\.textContent = overall \|\| '—';/);
  assert.match(fill, /'% yield' : 'no yield'/);
});
