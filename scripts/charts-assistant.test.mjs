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
  assert.match(body, /return fetchTickerFacts\(\[sym\]\)\[0\];/, "the band and the dock ask for one symbol");
  assert.match(fnBody("fetchTickerFacts"), /fetch\('\/api\/ticker-facts\?symbols=' \+ syms\.map\(encodeURIComponent\)\.join\(','\)/);
  assert.match(html, /factBandShow\(c\.sym\);/);
  assert.match(fnBody("factBandShow"), /if \(sym === _factSym\) return;/);
});

test("signed out: no band and no facts request", () => {
  const facts = fnBody("tickerFacts");
  const guard = facts.indexOf("if (!SITE || siteUser !== true) return Promise.resolve(null);");
  assert.ok(guard >= 0, "tickerFacts refuses unless signed in");
  assert.ok(guard < facts.indexOf("fetchTickerFacts("), "the guard runs before the request");
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
  assert.match(send, /readAskStream\(r, live, add\)\.then\(function \(complete\) \{ if \(complete\) finish\(\); else drop\(\); \}\)/);
  assert.match(send, /text\.data \+= chunk;/, "chunks append to a text node");
  assert.match(send, /card\.appendChild\(askSourceNode\(last\)\);/);
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
  const pump = fnBody("pumpXpFactsNow");
  assert.match(pump, /while \(_xpFactRunning < XP_FACT_MAX && _xpFactQueue\.length\)/);
  assert.match(pump, /fetchTickerFacts\(batch\)/);
  assert.match(pump, /_xpFactRunning--;/);
  const want = fnBody("xpFactWant");
  assert.match(want, /if \(!xpFactsOn\(\) \|\| _exportView !== 'table'\) return;/);
  assert.match(want, /if \(factsCachedFresh\(sym\)\) \{ fillXpFactCells\(sym\); return; \}/);
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
  assert.match(run, /if \(st === 'loading' \|\| st === 'queued'\) \{ run\.check\.push\(sym\); run\.need\[sym\] = true; return; \}/, "never a second request");
  assert.match(run, /_xpFactQueue\.push\(sym\);/);
  assert.match(run, /pumpXpFacts\(\);\s*xpRunTick\(\);/);
  assert.match(fnBody("pumpXpFactsNow"), /xpRunTick\(\);/);
  const tick = fnBody("xpRunTick");
  assert.match(tick, /'Checking ' \+ done \+ ' of ' \+ run\.check\.length \+ ' tickers…'/);
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

// Runs page functions out of charts.html in a bare scope, with the helpers they need.
function pageFns(names, prelude = "") {
  const src = names.map((n) => fnBody(n)).join("\n");
  return new Function(`${prelude}\n${src}\nreturn { ${names.join(", ")} };`)();
}

test("ASK AI: every chip and typed question takes a new token, so a slow compare never overwrites a newer answer", () => {
  assert.match(html, /var _askToken = 0;/);
  assert.doesNotMatch(html, /_askGen/, "the ticker-only counter is gone");
  assert.match(fnBody("runAskChip"), /askAbort\(\);[^\n]*\n\s*var tok = \+\+_askToken;/);
  assert.match(fnBody("runAskChip"), /return askCompareAnswer\(sym, f, tok\);/);
  const compare = fnBody("askCompareAnswer");
  assert.match(compare, /function askCompareAnswer\(sym, f, tok\)/);
  assert.match(compare, /if \(tok !== _askToken\) return;/);
  assert.match(fnBody("renderAskDock"), /if \(sym !== _askSym\) \{[^}]*_askToken\+\+;/, "a ticker change drops pending answers");
  const send = fnBody("sendAskQuestion");
  assert.match(send, /tok: \+\+_askToken \};/);
  assert.match(send, /var live = function \(\) \{ return _askReq === req && req\.tok === _askToken && card\.isConnected; \};/,
    "a typed answer stops writing once superseded or detached");
  assert.match(send, /if \(!live\(\) \|\| !chunk\) return;/);
  assert.match(send, /var fail = function \(msg, retry\) \{ if \(!live\(\)\) return drop\(\);/);
});

test("Limit Buy assistant column: checks and questions take tokens; an older one neither writes nor overwrites", () => {
  assert.match(html, /var _xpToken = 0;/);
  const run = fnBody("runXpCheck");
  assert.match(run, /var tok = \+\+_xpToken;/);
  assert.match(run, /need: Object\.create\(null\), tok: tok \}/);
  assert.match(fnBody("xpRunTick"), /if \(!run \|\| run\.tok !== _xpToken\) return;/);
  assert.match(fnBody("renderXpAssist"), /_xpSelKey = key;\s*_xpToken\+\+;/);
  assert.match(fnBody("resetXpAssist"), /_xpToken\+\+;/);
  const send = fnBody("sendXpQuestion");
  assert.match(send, /tok: \+\+_xpToken \};/);
  assert.match(send, /var live = function \(\) \{ return _xpAskReq === req && req\.tok === _xpToken && card\.isConnected; \};/);
  assert.match(send, /readAskStream\(r, live, add\)\.then\(function \(complete\) \{ if \(complete\) finish\(\); else drop\(\); \}\)/);
});

test("browser facts expire at the first 18:30 New York after they were fetched", () => {
  const { nextNewYorkRefresh } = pageFns(["nyWallAsUtc", "nextNewYorkRefresh"], "var _nyPartsFmt = null;");
  const at = (iso) => new Date(nextNewYorkRefresh(Date.parse(iso))).toISOString();
  assert.equal(at("2026-10-23T14:00:00Z"), "2026-10-23T22:30:00.000Z", "10:00 EDT -> 18:30 the same day");
  assert.equal(at("2026-10-23T22:30:00Z"), "2026-10-24T22:30:00.000Z", "at 18:30 -> the next day");
  assert.equal(at("2026-10-24T03:00:00Z"), "2026-10-24T22:30:00.000Z", "23:00 EDT the day before");
  assert.equal(at("2026-11-01T12:00:00Z"), "2026-11-01T23:30:00.000Z", "after the fall clock change: 18:30 EST");
  assert.equal(at("2026-03-08T12:00:00Z"), "2026-03-08T22:30:00.000Z", "after the spring clock change: 18:30 EDT");
  const facts = fnBody("tickerFacts");
  assert.match(facts, /if \(sym in _tickerFactsCache && factsExpired\(sym\)\) \{ delete _tickerFactsCache\[sym\]; delete _tickerFactsExpires\[sym\]; \}/);
  assert.ok(facts.indexOf("factsExpired(sym)") < facts.indexOf("if (sym in _tickerFactsCache) return"), "expired entries are dropped before the cache answers");
  assert.match(fnBody("fetchTickerFacts"), /_tickerFactsExpires\[sym\] = nextNewYorkRefresh\(asked\);/);
  assert.match(fnBody("factsExpired"), /return !\(Date\.now\(\) < _tickerFactsExpires\[sym\]\);/);
});

test("coming back to the tab refetches expired facts for the band and an open Limit Buy answer", () => {
  assert.match(html, /document\.addEventListener\('visibilitychange', function \(\) \{\s*if \(document\.visibilityState === 'visible'\) refreshExpiredFacts\(\);/);
  const refresh = fnBody("refreshExpiredFacts");
  assert.match(refresh, /var gone = dropExpiredFacts\(\);/);
  assert.match(refresh, /if \(_factSym && gone\.indexOf\(_factSym\) >= 0\) renderFactBand\(\);/);
  assert.match(refresh, /observeXpFactRows\(\);/);
  assert.match(refresh, /runXpCheck\(kind\);/);
  assert.match(fnBody("runXpCheck"), /if \(factsCachedFresh\(sym\)\) \{ run\.check\.push\(sym\); return; \}/, "a quick check refetches expired tickers");
});

test("Limit Buy table: facts past their 18:30 New York expiry are never drawn and are fetched again", () => {
  const prelude = `var _tickerFactsCache = Object.create(null); var _tickerFactsExpires = Object.create(null);
    var _xpFactState = Object.create(null); var _xpFactQueue = []; var _exportView = 'table';
    var _tickerFactsPending = Object.create(null), _xpTableLeft = 10, _xpTableSpent = Object.create(null);
    var filled = [], pumped = 0;
    function xpFactsOn() { return true; } function fillXpFactCells(s) { filled.push(s); } function pumpXpFacts() { pumped++; }
    function xpRedrawCapped() {}`;
  const src = ["factsExpired", "factsCachedFresh", "xpFactWant"].map((n) => fnBody(n)).join("\n");
  const page = new Function(`${prelude}\n${src}\nreturn {
    set(sym, f, msLeft) { _tickerFactsCache[sym] = f; _tickerFactsExpires[sym] = Date.now() + msLeft; },
    has(sym) { return sym in _tickerFactsCache; },
    state: () => ({ queue: _xpFactQueue.slice(), st: Object.assign({}, _xpFactState), filled: filled.slice(), pumped }),
    factsCachedFresh, xpFactWant };`)();
  page.set("SPY", { yield: 1.1 }, 60000);
  page.set("QQQ", { yield: 0.6 }, -1);
  assert.equal(page.factsCachedFresh("SPY"), true, "an entry before its expiry stays");
  assert.equal(page.factsCachedFresh("QQQ"), false, "an expired entry counts as not loaded");
  assert.equal(page.has("QQQ"), false, "and is dropped from the cache");
  page.xpFactWant("SPY", false);
  assert.deepEqual(page.state(), { queue: [], st: {}, filled: ["SPY"], pumped: 0 }, "fresh facts redraw without a request");
  page.set("IWM", { yield: 1.3 }, -1);
  page.xpFactWant("IWM", false);
  const s = page.state();
  assert.deepEqual(s.queue, ["IWM"], "an expired ticker goes back on the queue");
  assert.equal(s.st.IWM, "queued");
  assert.deepEqual(s.filled, ["SPY", "IWM"], "its old cells go back to the placeholder");
  assert.equal(s.pumped, 1);
  assert.equal(page.has("IWM"), false);
  page.xpFactWant("IWM", false);
  assert.deepEqual(page.state().queue, ["IWM"], "never queued twice");
  assert.match(fnBody("xpFactView"), /if \(!factsCachedFresh\(sym\)\) \{/, "the table never draws expired facts");
  assert.match(fnBody("runXpCheck"), /_xpFactQueue\.push\(sym\);\s*fillXpFactCells\(sym\);/, "a queued ticker's old cells go back to the placeholder");
  assert.doesNotMatch(fnBody("xpFactWant"), /fetch\(|tickerFacts\(/, "requests still go through the queue");
});

test("Limit Buy answers name each distinct as-of date", () => {
  const { xpThrough } = pageFns(["xpList", "fbDay", "xpThrough"], "var FB_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];");
  const r = (pairs) => ({ facts: pairs.map(([sym, asOf]) => ({ sym, f: { asOf } })) });
  assert.equal(xpThrough(r([["SPY", "2026-10-22"], ["QQQ", "2026-10-22"]])), " through Oct 22");
  assert.equal(xpThrough(r([["SPY", "2026-10-22"], ["IWM", "2026-01-02"], ["TSLA", "2026-10-22"]])), " through Oct 22; IWM through Jan 2");
  assert.equal(xpThrough(r([["A", "2026-10-22"], ["B", "2026-01-02"], ["C", "2026-10-21"], ["D", "2026-10-22"]])),
    " through Oct 22; C through Oct 21; B through Jan 2");
  assert.equal(xpThrough(r([])), "");
  assert.match(fnBody("xpCheckAnswer"), /var through = xpThrough\(r\);/);
  assert.doesNotMatch(fnBody("xpFactsOf"), /asOf/, "no single newest date any more");
});

test("Limit Buy answers carry no stale buy prices while Min/Max is invalid or the build is pending", () => {
  const problem = fnBody("xpPriceProblem");
  assert.match(problem, /if \(range\.error\) return \{ range: range\.error \};/);
  assert.match(problem, /return _exportBuilt \? null : \{ pending: true \};/);
  assert.match(fnBody("xpLeadPrices"), /if \(xpPriceProblem\(\)\) return out;/, "so typed questions send no nearestBuy");
  const buy = fnBody("xpBuyAnswer");
  assert.ok(buy.indexOf("xpPriceProblem()") < buy.indexOf("xpLeadPrices("), "checked before any price is listed");
  assert.match(buy, /'The Min\/Max range above is not valid\. ' \+ problem\.range/);
  assert.match(fnBody("scheduleExportBuild"), /_exportBuilt = false;/);
  assert.match(fnBody("buildExportTable"), /updateExportFooter\(rows, sections\.length\);\s*_exportBuilt = true;/);
  assert.match(fnBody("sendXpQuestion"), /xpLeadPrices\(syms\)\.forEach/);
});

test("phones: the full-screen dock keeps keyboard focus inside it", () => {
  assert.match(html, /var ASK_SHEET_MQ = window\.matchMedia \? window\.matchMedia\('\(max-width:700px\)'\) : null;/);
  assert.match(html, /var ASK_BEHIND = \['#bar', '#factBand', '#chart'/);
  assert.match(fnBody("askSheetOpen"), /dock\.getAttribute\('data-mode'\) === 'open'/);
  const upd = fnBody("updateAskSheet");
  assert.match(upd, /ASK_BEHIND\.forEach/);
  assert.match(upd, /el\.inert = on;/);
  const trap = fnBody("trapAskFocus");
  assert.match(trap, /if \(!askSheetOpen\(\)\) return;/);
  assert.match(trap, /if \(event\.shiftKey && document\.activeElement === first\) \{ event\.preventDefault\(\); last\.focus\(\); \}/);
  assert.match(trap, /else if \(!event\.shiftKey && document\.activeElement === last\) \{ event\.preventDefault\(\); first\.focus\(\); \}/);
  assert.match(fnBody("initAskDock"), /else if \(e\.key === 'Tab'\) trapAskFocus\(e\);/);
  assert.match(fnBody("renderAskDock"), /updateAskSheet\(\);[^\n]*\n\s*if \(!on\) \{ askAbort\(\); return; \}/, "collapse or sign-out lifts the inert page");
  assert.match(html, /ASK_SHEET_MQ\.addEventListener\('change', updateAskSheet\)/, "growing past 700px lifts it too");
});

test("weekly payers: next ex-date a week after the last one, and never listed as monthly", () => {
  const { askNextExDate } = pageFns(["askNextExDate"], "var ASK_CADENCE_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };");
  assert.equal(askNextExDate({ cadence: "weekly", lastExDate: "2026-10-20", asOf: "2026-10-22" }), "2026-10-27");
  assert.equal(askNextExDate({ cadence: "weekly", lastExDate: "2026-10-13", asOf: "2026-10-22" }), "2026-10-27", "stepped past the as-of date");
  assert.equal(askNextExDate({ cadence: "weekly", lastExDate: "2026-12-29", asOf: "2026-12-30" }), "2027-01-05", "across the year end");
  assert.equal(askNextExDate({ cadence: "monthly", lastExDate: "2026-10-02", asOf: "2026-10-22" }), "2026-11-02");
  assert.equal(askNextExDate({ cadence: "irregular", lastExDate: "2026-10-02", asOf: "2026-10-22" }), null);
  assert.match(html, /var ASK_STEP_WORDS = \{ weekly: 'about a week',/);
  assert.match(fnBody("xpCheckAnswer"), /x\.f\.cadence === 'monthly'/, "weekly payers are not monthly");
});

test("loadOnce injects a data file once; callers during the load share its result or its miss", () => {
  const prelude = `var DATA = 'dashboard/'; var injected = [];
    function inject(src, ok, err) { injected.push({ src: src, ok: ok, err: err }); }`;
  const src = fnBody("loadOnce");
  const page = new Function(`${prelude}\nvar _loadWaiters = Object.create(null);\n${src}\nreturn { loadOnce, injected };`)();
  const reg = {}, got = [];
  page.loadOnce(reg, "data-", "SPY_D", (p) => got.push(["a", p]), () => got.push(["a", "miss"]));
  page.loadOnce(reg, "data-", "SPY_D", (p) => got.push(["b", p]), () => got.push(["b", "miss"]));
  page.loadOnce(reg, "overlays-", "SPY_D", () => got.push(["ov"]), () => got.push(["ov", "miss"]));
  assert.deepEqual(page.injected.map((x) => x.src), ["dashboard/data-SPY_D.js", "dashboard/overlays-SPY_D.js"], "one injection per file");
  reg.SPY_D = { candles: [1] };
  page.injected[0].ok();
  assert.deepEqual(got, [["a", reg.SPY_D], ["b", reg.SPY_D]], "both callers get the first load's result");
  page.loadOnce(reg, "data-", "SPY_D", (p) => got.push(["c", p]), () => got.push(["c", "miss"]));
  assert.equal(page.injected.length, 2, "a loaded file answers from the registry");
  assert.deepEqual(got[2], ["c", reg.SPY_D]);
  const reg2 = {}, miss = [];
  page.loadOnce(reg2, "data-", "ZZZ", () => miss.push("x"), () => miss.push("a"));
  page.loadOnce(reg2, "data-", "ZZZ", () => miss.push("x"), () => miss.push("b"));
  page.injected[2].err();
  assert.deepEqual(miss, ["a", "b"], "a failed load is a miss for every waiting caller");
  page.loadOnce(reg2, "data-", "ZZZ", () => {}, () => {});
  assert.equal(page.injected.length, 4, "after a miss the next caller tries again");
});

test("Limit Buy facts: queued tickers go out up to 40 per request, at most 3 requests at once, never twice", async () => {
  const prelude = `var SITE = true, siteUser = true, XP_FACT_MAX = 3, TICKER_FACTS_BATCH = 40;
    var TICKER_FACTS_RE = /^[A-Z0-9](?:[A-Z0-9.-]{0,10}[A-Z0-9])?$/;
    var _tickerFactsCache = Object.create(null), _tickerFactsPending = Object.create(null), _tickerFactsExpires = Object.create(null);
    var _xpFactQueue = [], _xpFactRunning = 0, _xpFactState = Object.create(null), _xpFactPumpSoon = false;
    var calls = [], ticks = 0, filled = [];
    function nextNewYorkRefresh(ms) { return ms + 3600e3; }
    function fillXpFactCells(s) { filled.push(s); } function xpRunTick() { ticks++; }
    function fetch(url) {
      var syms = decodeURIComponent(url.split('symbols=')[1]).split(',');
      var call = { syms: syms };
      call.promise = new Promise(function (ok) { call.settle = ok; });
      calls.push(call);
      return call.promise;
    }`;
  const names = ["factsExpired", "factsCachedFresh", "tickerFacts", "tickerFactsNeedsRequest", "fetchTickerFacts", "pumpXpFacts", "pumpXpFactsNow", "xpFactTrack"];
  const page = new Function(`${prelude}\n${names.map((n) => fnBody(n)).join("\n")}\nreturn {
    queue(syms) { syms.forEach(function (s) { _xpFactState[s] = 'queued'; _xpFactQueue.push(s); }); pumpXpFacts(); },
    calls, tickerFacts, state: function () { return Object.assign({}, _xpFactState); },
    cache: function () { return _tickerFactsCache; }, running: function () { return _xpFactRunning; } };`)();
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const ok = (body) => ({ ok: true, json: () => Promise.resolve(body) });

  const band = page.tickerFacts("SPY");   // the fact band's own one-symbol request
  assert.deepEqual(page.calls[0].syms, ["SPY"]);
  const syms = Array.from({ length: 130 }, (_, i) => "T" + i).concat(["SPY"]);
  page.queue(syms);
  page.queue(["T1", "T2"]);   // a second want for queued tickers adds nothing new to the request
  assert.equal(page.calls.length, 1, "the pump waits for the current task, so the rows queued together share a request");
  await flush();
  const batches = page.calls.slice(1);
  assert.deepEqual(batches.map((c) => c.syms.length), [40, 40, 40], "three requests of 40, the rest wait for a slot");
  assert.equal(page.running(), 3);
  const shared = page.tickerFacts("T5");
  assert.equal(page.calls.length, 4, "a tickerFacts call for a batched ticker shares that request");

  const facts = {}; for (const s of batches[0].syms) if (s !== "T7") facts[s] = { symbol: s };
  batches[0].settle(ok({ facts, missing: ["T7"] }));
  await flush(); await flush();
  assert.deepEqual(await shared, { symbol: "T5" });
  assert.equal(page.cache().T7, null, "a ticker missing from the answer is cached as no facts");
  assert.equal(page.state().T5, undefined);
  assert.deepEqual(page.calls.slice(4).map((c) => c.syms.length), [10], "the freed slot takes the rest; SPY rides on the band's request");
  assert.equal(page.calls[4].syms.includes("SPY"), false);

  batches[1].settle(Promise.reject(new Error("HTTP 502")));
  await flush(); await flush();
  for (const s of batches[1].syms) assert.equal(page.state()[s], "error", s + " marked failed");
  assert.equal(batches[1].syms.some((s) => s in page.cache()), false, "a failed request caches nothing");

  page.calls[0].settle(ok({ facts: { SPY: { symbol: "SPY" } } }));
  await band;
  await flush(); await flush();
  assert.equal(page.state().SPY, undefined, "SPY settles with the band's answer");
  const all = page.calls.flatMap((c) => c.syms);
  assert.equal(new Set(all).size, all.length, "no ticker is requested twice");
  assert.ok(page.calls.every((c) => c.syms.length <= 40));
});

test("Download CSV follows the up-in-all-three filter and turns off when no ticker is shown", () => {
  const prelude = `var _exportRows = null, _xpFilter = null, _exportView = 'table', _exportCsvReady = true;
    var btn = { disabled: false };
    var document = { getElementById: function () { return btn; } };`;
  const page = new Function(`${prelude}\n${["exportCsvRows", "syncExportCsvButton"].map((n) => fnBody(n)).join("\n")}\nreturn {
    set(o) { if ('rows' in o) _exportRows = o.rows; if ('filter' in o) _xpFilter = o.filter; if ('view' in o) _exportView = o.view; if ('ready' in o) _exportCsvReady = o.ready; },
    exportCsvRows, syncExportCsvButton, btn };`)();
  const rows = ["SPY", "SPY", "QQQ", "IWM", "TSLA"].map((sym, i) => ({ sym, limit: i }));
  page.set({ rows });
  assert.equal(page.exportCsvRows().length, 5, "no filter: every row");
  page.set({ filter: { up: ["SPY"], close: ["IWM"] } });
  assert.deepEqual(page.exportCsvRows().map((r) => r.sym), ["SPY", "SPY", "IWM"], "the matches and the Close tickers, in table order");
  page.syncExportCsvButton();
  assert.equal(page.btn.disabled, false);
  page.set({ filter: { up: [], close: [] } });
  page.syncExportCsvButton();
  assert.equal(page.btn.disabled, true, "no ticker shown: nothing to download");
  page.set({ filter: null });
  page.syncExportCsvButton();
  assert.equal(page.btn.disabled, false, "clearing the filter brings the full export back");
  page.set({ ready: false });
  page.syncExportCsvButton();
  assert.equal(page.btn.disabled, true, "a stale table never downloads");
  const dl = fnBody("downloadExportCsv");
  assert.match(dl, /var rows = exportCsvRows\(\);/);
  assert.match(dl, /rows\.forEach\(function \(row\) \{/);
  assert.match(fnBody("applyXpFilter"), /syncExportCsvButton\(\);/);
  assert.match(fnBody("updateExportFooter"), /syncExportCsvButton\(\);/);
});

test("Limit Buy: a shown buy-price answer follows a rebuild and never keeps the old prices", () => {
  assert.match(fnBody("scheduleExportBuild"), /_exportBuilt = false;[\s\S]*refreshXpBuyAnswer\(\);/, "stale as soon as a rebuild starts");
  assert.match(fnBody("buildExportTable"), /_exportBuilt = true;\s*refreshXpBuyAnswer\(\);/, "answered again from the new build");
  const buy = fnBody("xpBuyAnswer");
  assert.equal((buy.match(/xpAnswerCard\(/g) || []).length, (buy.match(/, tag\);/g) || []).length, "every buy card is tagged");

  const prelude = `
    function node(tag, cls, text) {
      return { attrs: {}, kids: [], text: text || '',
        setAttribute: function (k, v) { this.attrs[k] = v; },
        getAttribute: function (k) { return k in this.attrs ? this.attrs[k] : null; },
        appendChild: function (c) { this.kids.push(c); },
        get textContent() { return this.text + this.kids.map(function (c) { return c.textContent; }).join(' '); } };
    }
    var box = { kids: [], writes: 0,
      get firstElementChild() { return this.kids[0] || null; },
      replaceChildren: function () { this.kids = Array.prototype.slice.call(arguments); this.writes++; },
      querySelector: function (sel) {
        var kind = /data-xp-answer="([a-z]+)"/.exec(sel)[1];
        return this.kids.filter(function (c) { return c.getAttribute('data-xp-answer') === kind; })[0] || null;
      } };
    var askNode = node, _exportBuilt = true, _range = { depth: 40, min: 0 }, _leads = [], _exportSecs = {};
    function xpAnswerBox() { return box; }
    function xpFactsOn() { return true; }
    function checkedExportSymbols() { return ['AAA', 'BBB']; }
    function readExportRange() { return _range; }
    function xpLeadPrices() { return _exportBuilt ? _leads.slice() : []; }
    function exportLimits(rows) { return rows; }
    function xpList(s) { return s.join(', '); }
    function px2(v) { return Number(v).toFixed(2); }
    function pctBelowText(row) { return row.pct.toFixed(1) + '% below'; }
    function closeLabel() { return 'Latest close'; }`;
  const page = new Function(`${prelude}\n${["xpAnswerCard", "xpPriceProblem", "xpBuyAnswer", "refreshXpBuyAnswer"].map((n) => fnBody(n)).join("\n")}\nreturn {
    box: box, xpBuyAnswer: xpBuyAnswer, xpAnswerCard: xpAnswerCard, refresh: refreshXpBuyAnswer,
    set: function (o) { if ('built' in o) _exportBuilt = o.built; if ('range' in o) _range = o.range; if ('leads' in o) _leads = o.leads;
      if ('secs' in o) _exportSecs = o.secs; } };`)();
  const lead = (sym, limit, pct) => ({ sym, pct, sec: { close: 100 }, lim: { row: { limit, pct } } });
  const text = () => page.box.kids[0].textContent;
  const secs = { AAA: { rows: [1] }, BBB: { rows: [1] } };

  page.set({ secs, leads: [lead("AAA", 97.25, 2.75), lead("BBB", 90.5, 9.5)] });
  page.xpBuyAnswer(["AAA", "BBB"]);
  assert.match(text(), /Closest to a buy price: AAA/);
  assert.match(text(), /97\.25/);

  page.set({ built: false });   // Min moved: the rebuild starts
  page.refresh();
  assert.match(text(), /Prices are updating/);
  assert.doesNotMatch(text(), /\d+\.\d\d/, "no price from the old build while the new one loads");
  const writes = page.box.writes;
  page.refresh();
  assert.equal(page.box.writes, writes, "a refresh that changes nothing is not announced again");

  page.set({ built: true, leads: [lead("BBB", 90.5, 9.5)] });   // the new build dropped AAA's lead
  page.refresh();
  assert.match(text(), /Closest to a buy price: BBB/);
  assert.doesNotMatch(text(), /97\.25/);

  page.set({ range: { error: "Set min below max." } });
  page.refresh();
  assert.match(text(), /Fix the Min\/Max range first/);
  page.set({ range: { depth: 40, min: 5 } });

  page.xpAnswerCard("Highest yield: AAA", ["AAA yields 5.0%."], "Tiingo");   // another check's answer
  page.set({ built: false });
  page.refresh();
  assert.match(text(), /Highest yield: AAA/, "other answers are left alone");
});

test("Limit Buy: a Close-section ticker heading opens the price that section shows", () => {
  const click = html.slice(html.indexOf("var head = e.target.closest && e.target.closest('[data-first]');"));
  assert.match(click.slice(0, 400), /if \(head\.closest\('#xpCloseSection'\)\) openCloseSectionPrice\(head\.getAttribute\('data-first'\), head\);\s*else openFirstPrice\(head\.getAttribute\('data-first'\), false\);/,
    "main table and Cards headings keep openFirstPrice");
  const prelude = `
    var opened = null, wanted = [], rows = {};
    var _exportSecs = { SPY: { rows: ['weak', 'weak', 'strong', 'strong'] }, QQQ: { rows: ['weak'] }, IWM: { rows: [] } };
    function exportLimits(r) { return r.map(function (s) { return { members: s === 'strong' ? [1] : [], row: { s: s } }; }); }
    function exportTier() { return 'weak'; }
    function xpFactWant(sym) { wanted.push(sym); }
    function openWhyPanel(sym, idx, opener) { opened = { sym: sym, idx: idx, opener: opener }; }
    var document = { querySelector: function (sel) { return rows[sel] || null; } };`;
  const page = new Function(`${prelude}\n${["limitStrength", "nearestStrongIndex", "openCloseSectionPrice"].map((n) => fnBody(n)).join("\n")}\nreturn {
    open: openCloseSectionPrice, rows: rows, opened: function () { return opened; }, wanted: wanted };`)();
  const head = { name: "SPY heading" }, shown = { name: "SPY shown row" };
  page.rows['#xpCloseSection [data-why="SPY|2"]'] = shown;
  page.open("SPY", head);
  assert.deepEqual(page.opened(), { sym: "SPY", idx: 2, opener: shown }, "the nearest Strong price, with the visible row the section shows");
  page.open("QQQ", head);
  assert.deepEqual(page.opened(), { sym: "QQQ", idx: 0, opener: head }, "no Strong price: the nearest, falling back to the heading");
  page.open("IWM", head);
  assert.equal(page.opened().sym, "QQQ", "no price in range: nothing opens");
  assert.deepEqual(page.wanted, ["SPY", "QQQ", "IWM"], "selecting a ticker still loads its facts");
});

// Contract v2: the shared Tiingo key is on the free tier (50 calls an hour for the whole site).
const capPrelude = `
  var _tickerFactsCache = Object.create(null), _tickerFactsExpires = Object.create(null), _tickerFactsPending = Object.create(null);
  var _xpFactState = Object.create(null), _xpFactQueue = [], _exportView = 'table', _xpRun = null;
  var XP_TABLE_CAP = 10, _xpTableLeft = XP_TABLE_CAP, _xpTableSpent = Object.create(null);
  var filled = [], pumped = 0, redrawn = 0;
  function xpFactsOn() { return true; } function fillXpFactCells(s) { filled.push(s); } function pumpXpFacts() { pumped++; }
  function xpRunNeeds(s) { return !!(_xpRun && _xpRun.need[s]); }`;

test("Limit Buy table: rows coming into view load at most 10 uncached tickers per dialog opening", () => {
  assert.match(html, /var XP_TABLE_CAP = 10;/);
  const names = ["factsExpired", "factsCachedFresh", "xpFactWant", "xpFactDrop", "xpTableRefund"];
  const page = new Function(`${capPrelude}\nfunction xpRedrawCapped() { redrawn++; }\n${names.map((n) => fnBody(n)).join("\n")}\nreturn {
    xpFactWant, xpFactDrop,
    cache(sym, f) { _tickerFactsCache[sym] = f; _tickerFactsExpires[sym] = Date.now() + 60000; },
    pending(sym) { _tickerFactsPending[sym] = Promise.resolve(null); },
    s: () => ({ queue: _xpFactQueue.slice(), left: _xpTableLeft, filled: filled.slice(), redrawn: redrawn, st: Object.assign({}, _xpFactState) }) };`)();
  page.cache("SPY", { yield: 1 });
  page.xpFactWant("SPY", false);
  assert.equal(page.s().left, 10, "a cached ticker always shows and costs nothing");
  page.pending("QQQ");
  page.xpFactWant("QQQ", false);
  assert.equal(page.s().left, 10, "one the fact band is already fetching costs nothing");
  const syms = Array.from({ length: 14 }, (_, i) => "T" + i);
  syms.forEach((s) => page.xpFactWant(s, false));
  let s = page.s();
  assert.deepEqual(s.queue, ["QQQ"].concat(syms.slice(0, 10)), "ten uncached tickers go on the queue");
  assert.equal(s.left, 0);
  assert.equal(s.redrawn, 1, "running out redraws the rows not loaded, once");
  assert.equal(s.st.T10, undefined, "the rest are not queued");
  assert.ok(s.filled.includes("T13"), "and their cells are redrawn to offer Load facts");
  page.xpFactWant("T12", true);
  s = page.s();
  assert.equal(s.queue[0], "T12", "Load facts (or any pick of one ticker) loads it past the cap");
  assert.equal(s.left, 0, "without touching the allowance");
  page.xpFactDrop("T3");
  assert.equal(page.s().left, 1, "a queued ticker scrolled past before its request gives its share back");
  page.xpFactDrop("T12");
  assert.equal(page.s().left, 1, "a picked ticker never refunds what it did not spend");
  const open = fnBody("openExportDialog");
  assert.match(open, /_xpTableLeft = XP_TABLE_CAP;/, "each opening starts a new allowance");
  assert.match(open, /_xpTableSpent = Object\.create\(null\);/);
  assert.match(fnBody("stopXpFactRows"), /else \{ delete _xpFactState\[sym\]; xpTableRefund\(sym\); \}/);
});

test("Limit Buy table: rows past the cap show a dash and a keyboard-reachable Load facts button", () => {
  const page = new Function(`${capPrelude}
    var XP_FACT_KEYS = ['yield', 'cadence', 'd21', 'm3', 'm6'];
    ${["factsExpired", "factsCachedFresh", "escHtml", "xpFactView", "xpFactCellHtml"].map((n) => fnBody(n)).join("\n")}
    return { cell: xpFactCellHtml, set(o) { if ('left' in o) _xpTableLeft = o.left; if ('st' in o) _xpFactState.ABC = o.st; } };`)();
  assert.match(page.cell("ABC", "yield"), /data-state="pending"/, "allowance left: the loading placeholder");
  page.set({ left: 0 });
  const y = page.cell("ABC", "yield");
  assert.match(y, /data-state="capped"/);
  assert.match(y, /<button type="button" class="xp-link xp-fload" data-xp-load="ABC" aria-label="Load facts for ABC">Load facts<\/button>/);
  for (const key of ["cadence", "d21", "m3", "m6"]) {
    const c = page.cell("ABC", key);
    assert.match(c, /data-state="capped"[^>]*>—<\/td>$/, `${key} shows a dash`);
    assert.doesNotMatch(c, /<button/, "one button per row");
  }
  page.set({ st: "queued" });
  assert.match(page.cell("ABC", "yield"), /data-state="pending"/, "a queued ticker shows the placeholder, not the button");
  const click = fnBody("wireExportDialog");
  const load = click.indexOf("closest('[data-xp-load]')");
  assert.ok(load > 0 && load < click.indexOf("closest('[data-why]')") && load < click.indexOf("closest('[data-first]')"),
    "Load facts is handled before the price and heading clicks around it");
  assert.match(click, /if \(load\) \{ xpFactWant\(load\.getAttribute\('data-xp-load'\), true\); return; \}/);
  assert.match(click, /xpFactWant\(parts\[0\], true\);\s*\/\/[^\n]*\n\s*openWhyPanel\(parts\[0\], Number\(parts\[1\]\), why\);/, "clicking a price row loads its ticker");
  assert.match(click, /xpFactWant\(parts\[0\], true\);\s*openWhyPanel\(parts\[0\], Number\(parts\[1\]\), row\);/, "so does Enter on it");
  assert.match(html, /#exportDialog \.xp-tgroup \.xp-fload \{ min-height:24px;/);
  assert.match(html, /@media \(max-width:600px\) \{ #exportDialog \.xp-tgroup \.xp-fload \{ min-height:44px; \} \}/);
});

test("Limit Buy table: every copy of a ticker's fact cells redraws, and focus on a redrawn button stays in its row", () => {
  const mk = (name) => {
    const cells = {}, sec = { name, focused: null, cells };
    for (const k of ["yield", "cadence", "d21", "m3", "m6"]) cells[k] = { set outerHTML(v) { cells[k].html = v; } };
    const row = { focus() { sec.focused = "row"; } };
    sec.querySelector = (sel) => {
      const m = /data-xp-fact="(\w+)"/.exec(sel);
      if (m) return cells[m[1]];
      if (sel === "tr.xp-trow") return row;
      return null;
    };
    sec.contains = (el) => !!el && el.sec === sec;
    return sec;
  };
  const main = mk("main"), copy = mk("close copy");
  const page = new Function("secs", "act", `var XP_FACT_KEYS = ['yield', 'cadence', 'd21', 'm3', 'm6'];
    var document = { activeElement: act, querySelectorAll: function (sel) { return sel === '#exportResult tbody[data-sec="ABC"]' ? secs : []; } };
    function xpFactCellHtml(sym, key) { return sym + ':' + key; }
    ${fnBody("fillXpFactCells")}
    return fillXpFactCells;`)([main, copy], { sec: copy, closest: () => ({}) });
  page("ABC");
  for (const sec of [main, copy]) assert.equal(sec.cells.d21.html, "ABC:d21", `${sec.name} redrawn`);
  assert.equal(copy.focused, "row", "focus on a Load facts button moves to that row's first price, not the page");
  assert.equal(main.focused, null);
});

test("Limit Buy quick checks fetch at most 10 uncached tickers per tap and leave the rest for the next tap", () => {
  assert.match(html, /var XP_CHECK_CAP = 10;/);
  const names = ["factsExpired", "factsCachedFresh", "runXpCheck"];
  const page = new Function("syms", `${capPrelude}
    var XP_CHECK_CAP = 10, _xpToken = 0;
    function xpAskAbort() {} function xpCheckAbort() {} function setXpCheckActive() {} function xpRunTick() {}
    function checkedExportSymbols() { return syms; }
    ${names.map((n) => fnBody(n)).join("\n")}
    return { run: runXpCheck, last: function () { return _xpRun; }, queue: function () { return _xpFactQueue.slice(); },
      cache(sym) { _tickerFactsCache[sym] = { symbol: sym }; _tickerFactsExpires[sym] = Date.now() + 60000; },
      pending(sym) { _tickerFactsPending[sym] = Promise.resolve(null); },
      queued(sym) { _xpFactState[sym] = 'queued'; _xpFactQueue.push(sym); } };`)(
    ["A0", "A1"].concat(Array.from({ length: 24 }, (_, i) => "T" + String(i).padStart(2, "0"))));
  page.cache("A0");
  page.pending("T00");   // the fact band is fetching it
  page.queued("T01");    // the table already queued it
  page.run("yield");
  const run = page.last();
  assert.equal(run.check.length, 13, "the cached one, the two already on their way and ten new fetches");
  assert.equal(run.skipped.length, 13);
  assert.deepEqual(run.skipped.slice(0, 2), ["T11", "T12"], "A1 and T02 to T10 are fetched; the next ones alphabetically wait for the next tap");
  assert.equal(page.queue().filter((s) => s !== "T01" && s !== "T00").length, 10, "ten uncached tickers fetched");
  assert.equal(run.need.A0, undefined, "a cached ticker needs nothing");
  for (const s of run.check) page.cache(s);
  page.run("yield");
  assert.equal(page.last().skipped.length, 3, "tapping again fetches the next ten");
  assert.match(fnBody("xpRunTick"), /xpCheckAnswer\(run\.kind, run\.check, run\.skipped\);/);
});

test("Limit Buy quick-check answers say how many tickers were not checked", () => {
  const { xpSkippedNote } = pageFns(["xpSkippedNote"], `var XP_CHECK_CAP = 10;
    function askNode(tag, cls, text) { return { tag: tag, cls: cls, text: text }; }`);
  assert.equal(xpSkippedNote([]), null);
  assert.equal(xpSkippedNote(undefined), null);
  const note = xpSkippedNote(Array.from({ length: 12 }, (_, i) => "T" + i));
  assert.equal(note.text, "12 not checked: facts load 10 at a time; tap again to check more.");
  const answer = fnBody("xpCheckAnswer");
  assert.match(answer, /function xpCheckAnswer\(kind, syms, skipped\)/);
  assert.match(answer, /var more = xpSkippedNote\(skipped\);/);
  assert.equal((answer.match(/partial, more,/g) || []).length, 4, "every quick-check answer carries the note");
});

test("Limit Buy: with the filter on, the ticker list's jump lands on a visible price", () => {
  const els = {}, calls = [];
  const page = new Function("els", "calls", `var _exportGoPending = null;
    var document = { querySelector: function (sel) { return els[sel] || null; } };
    function updateExportPickCount() {} function scheduleExportBuild() {}
    function openCloseSectionPrice(sym, head) { calls.push(['close', sym, head]); }
    function openFirstPrice(sym, scroll) { calls.push(['first', sym, scroll]); }
    function clearXpFilter() { calls.push(['clear']); } function setXpCheckActive(k) { calls.push(['active', k]); }
    ${fnBody("goToExportTicker")}
    return goToExportTicker;`)(els, calls);
  const head = { name: "IWM close heading" }, scrolled = [];
  els['#exportPicks input[value="IWM"]'] = { checked: true };
  els['#exportResult [data-sec="IWM"]'] = {};
  els['#xpCloseSection tbody[data-sec="IWM"]'] = { querySelector: () => head, scrollIntoView: (o) => scrolled.push(o) };
  page("IWM");
  assert.deepEqual(calls, [["close", "IWM", head]], "a Close ticker opens the price that section shows");
  assert.deepEqual(scrolled, [{ block: "start" }], "and scrolls to it");
  calls.length = 0;
  els['#exportPicks input[value="TSLA"]'] = { checked: true };
  els['#exportResult [data-sec="TSLA"]'] = {};
  els['#exportResult .xp-tablewrap tbody[data-sec="TSLA"]'] = { hidden: true };
  page("TSLA");
  assert.deepEqual(calls, [["clear"], ["active", null], ["first", "TSLA", true]], "a hidden ticker clears the filter, then jumps as usual");
  calls.length = 0;
  els['#exportResult .xp-tablewrap tbody[data-sec="TSLA"]'] = { hidden: false };
  page("TSLA");
  assert.deepEqual(calls, [["first", "TSLA", true]], "no filter: the usual jump");
});

test("ASK AI compare: a tie with QQQ counts as compared", () => {
  const { askCompareSentence } = pageFns(["xpList", "askCompareSentence"]);
  assert.equal(askCompareSentence("TSLA", [], [], ["21 days", "3 months", "6 months"]),
    "TSLA and QQQ had the same price change over 21 days, 3 months and 6 months.");
  assert.equal(askCompareSentence("TSLA", ["21 days"], [], ["3 months", "6 months"]),
    "TSLA did better than QQQ over 21 days, and matched it over 3 months and 6 months.");
  assert.equal(askCompareSentence("TSLA", ["21 days"], ["3 months"], ["6 months"]),
    "TSLA did better than QQQ over 21 days, worse over 3 months, and matched it over 6 months.");
  assert.equal(askCompareSentence("TSLA", [], ["21 days", "3 months"], []), "TSLA did worse than QQQ over 21 days and 3 months.");
  assert.equal(askCompareSentence("TSLA", [], [], []), "There is not enough history to compare the two.");
  const compare = fnBody("askCompareAnswer");
  assert.match(compare, /if \(!a \|\| !b\) return;/);
  assert.match(compare, /\(a\.change > b\.change \? ahead : a\.change < b\.change \? behind : same\)\.push/);
});

test("Limit Buy opened before the account check answers turns signed in when it does", () => {
  assert.match(fnBody("initSiteAccount"), /loadAccountGapPlacement\(\);\s*xpAccountKnown\(\);/);
  const known = fnBody("xpAccountKnown");
  assert.match(known, /if \(!xpFactsOn\(\) \|\| !document\.getElementById\('exportDialog'\)\.classList\.contains\('open'\)\) return;/);
  assert.match(known, /renderXpAssist\(\);/);
  assert.match(known, /if \(_exportView === 'table' && document\.querySelector\('#exportResult \[data-sec\]'\)\) renderExportTable\(_exportLastSections\);/,
    "drawn table results get their fact columns; a build still running draws them itself");
  // the opening's allowance is not spent while the account is unknown
  assert.match(fnBody("xpFactWant"), /if \(!xpFactsOn\(\) \|\| _exportView !== 'table'\) return;/);
});

test("a visible tab redraws the band and the dock from new facts once they expire at 18:30 New York", () => {
  const settle = fnBody("renderFactBand");
  assert.match(settle, /expires: r\.ok \? _tickerFactsExpires\[sym\] : undefined \};\s*armFactBandExpiry\(\);/, "settling the band arms the timer");
  assert.match(html, /document\.addEventListener\('visibilitychange', armFactBandExpiry\);/);
  assert.match(fnBody("askFacts"), /if \(factBandStale\(\)\) refreshStaleFactBand\(\);\s*return _factReady/, "askFacts never hands out expired facts");
  // the visibilitychange refresh is unchanged
  assert.match(html, /document\.addEventListener\('visibilitychange', function \(\) \{\s*if \(document\.visibilityState === 'visible'\) refreshExpiredFacts\(\);/);

  const prelude = `var now = 0, timers = [], log = [], vis = 'visible', _factSym = 'SPY', _factReady = null;
    var Date = { now: function () { return now; } };
    var document = { get visibilityState() { return vis; }, addEventListener: function () {},
      querySelector: function () { return { addEventListener: function () {} }; } };
    function setTimeout(fn, ms) { timers.push({ fn: fn, at: now + ms }); return timers.length; }
    function clearTimeout(id) { if (id) timers[id - 1] = null; }
    function refreshExpiredFacts() { log.push('refreshExpiredFacts'); if (dropped) { _factReady = null; log.push('render'); } }
    function renderFactBand() { _factReady = null; log.push('render'); }
    var dropped = true;
    var FACT_EXPIRY_STEP = 60e3, FACT_EXPIRY_GRACE = 30e3, _factExpiryTimer = 0;`;
  const names = ["factBandStale", "armFactBandExpiry", "onFactBandExpiry", "refreshStaleFactBand", "askFacts"];
  const page = new Function(`${prelude}\n${names.map((n) => fnBody(n)).join("\n")}\nreturn {
    ready(o) { _factReady = o; armFactBandExpiry(); },
    set(o) { if ('now' in o) now = o.now; if ('vis' in o) vis = o.vis; if ('dropped' in o) dropped = o.dropped; if ('sym' in o) _factSym = o.sym; },
    pending() { return timers.filter(Boolean); },
    fire() { var t = timers.filter(Boolean); timers = timers.map(function () { return null; }); t.forEach(function (x) { x.fn(); }); },
    log, askFacts, factBandStale, armFactBandExpiry, cur() { return _factReady; } };`)();
  const H = 3600e3, exp = 8.5 * H;

  page.ready({ sym: "SPY", ok: true, facts: { yield: 0.99 }, expires: exp });
  assert.deepEqual(page.pending().map((t) => t.at), [60e3], "the timer wakes at most a minute apart");
  page.set({ now: 60e3 }); page.fire();
  assert.deepEqual(page.log, [], "before the expiry a wake only re-arms: no request");
  assert.equal(page.pending().length, 1);

  // the computer sleeps through 18:30, or the clock jumps: the next wake refreshes once
  page.set({ now: exp + 60e3 }); page.fire();
  assert.deepEqual(page.log, ["refreshExpiredFacts", "render"]);
  assert.equal(page.cur(), null);
  page.fire();
  assert.deepEqual(page.log, ["refreshExpiredFacts", "render"], "no band, no timer: nothing more until the band settles again");

  // a wake within 30 s of the expiry waits out the rest of that grace
  page.log.length = 0;
  page.set({ now: 0 });
  page.ready({ sym: "SPY", ok: true, facts: {}, expires: 50e3 });
  assert.deepEqual(page.pending().map((t) => t.at), [60e3]);
  page.set({ now: 60e3 }); page.fire();
  assert.deepEqual(page.log, [], "10 s past the expiry: not yet");
  assert.deepEqual(page.pending().map((t) => t.at), [80e3]);
  page.set({ now: 80e3 }); page.fire();
  assert.deepEqual(page.log, ["refreshExpiredFacts", "render"]);

  // the cache entry was already dropped elsewhere: the band is still redrawn
  page.log.length = 0;
  page.set({ now: 0, dropped: false });
  page.ready({ sym: "SPY", ok: true, facts: {}, expires: 1000 });
  page.set({ now: 31e3 }); page.fire();
  assert.deepEqual(page.log, ["refreshExpiredFacts", "render"]);

  // a failed load has no expiry; a hidden tab stops the timer
  page.set({ now: 0, dropped: true });
  page.ready({ sym: "SPY", ok: false, facts: null, expires: undefined });
  assert.equal(page.pending().length, 0);
  page.set({ vis: "hidden" });
  page.ready({ sym: "SPY", ok: true, facts: {}, expires: exp });
  assert.equal(page.pending().length, 0, "hidden: no timer; showing the tab arms it");
  page.set({ vis: "visible" }); page.armFactBandExpiry();
  assert.equal(page.pending().length, 1);

  // askFacts: fresh facts as they are, expired ones never (it starts the refresh instead)
  page.log.length = 0;
  const fresh = { sym: "SPY", ok: true, facts: { yield: 0.99 }, expires: exp };
  page.ready(fresh);
  page.set({ now: exp - 1 });
  assert.equal(page.askFacts(), fresh);
  page.set({ now: exp });
  assert.equal(page.askFacts(), null, "a chip tapped at or after 18:30 waits for new facts");
  assert.deepEqual(page.log, ["refreshExpiredFacts", "render"]);
  page.set({ sym: "QQQ" });
  page.ready({ sym: "SPY", ok: true, facts: {}, expires: 0 });
  assert.equal(page.factBandStale(), false, "facts for another ticker are not the band's");
});

test("ASK AI and Limit Buy: a Search the web checkbox, off on every load, sends web: true only when ticked", () => {
  for (const id of ["askWeb", "xpAskWeb"]) {
    assert.match(html, new RegExp(`<label class="ask-web"><input type="checkbox" id="${id}" aria-describedby="${id}Note"> Search the web</label>`));
    assert.match(html, new RegExp(`<p class="ask-webnote" id="${id}Note" hidden>[^<]*web results are not checked by this site\\.</p>`));
    assert.match(html, new RegExp(`wireAskWeb\\('${id}'\\);`));
  }
  assert.doesNotMatch(html, /id="(xp)?[aA]skWeb"[^>]*checked/, "never ticked by default");
  assert.doesNotMatch(html, /localStorage\.setItem\([^)]*[wW]eb/, "the choice is not saved");
  const dock = fnBody("sendAskQuestion"), xp = fnBody("sendXpQuestion");
  assert.match(dock, /var web = askWebOn\('askWeb'\);/);
  assert.match(dock, /if \(web\) payload\.web = true;/);
  assert.match(xp, /var web = askWebOn\('xpAskWeb'\);/);
  assert.match(xp, /if \(web\) payload\.web = true;/);
  assert.match(xp, /card\.appendChild\(askSourceNode\(last\)\);/);
  assert.match(fnBody("wireAskWeb"), /note\.hidden = !c\.checked;/);
});

test("source line links: only http and https become links, opened safely, as text nodes", () => {
  const src = fnBody("askSourceNode");
  assert.match(src, /url\.protocol !== 'https:' && url\.protocol !== 'http:'/);
  assert.match(src, /a\.rel = 'noopener noreferrer';/);
  assert.match(src, /a\.target = '_blank';/);
  assert.match(src, /document\.createTextNode\(part\)/);
  assert.doesNotMatch(src, /innerHTML/);
});
