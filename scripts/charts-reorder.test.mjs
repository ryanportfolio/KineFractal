import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../server/charts-app/charts.html", import.meta.url), "utf8");

test("ticker toolbar exposes an explicit reorder modal instead of drag handles", () => {
  assert.match(html, /id="tickerReorderBtn"[^>]*>REORDER</);
  assert.match(html, /id="tickerReorderDialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /aria-labelledby="tickerReorderTitle"/);
  assert.doesNotMatch(html, /class="ticker-drag"/);
  assert.doesNotMatch(html, /function addTickerDrag\(/);
});

test("modal provides reliable non-drag movement and reset controls", () => {
  for (const action of ["top", "up", "down", "bottom"]) {
    assert.match(html, new RegExp(`makeTickerMoveButton\\(symbol, '${action}'`));
  }
  assert.match(html, /id="tickerReorderReset"[^>]*>Reset to default order</);
  assert.match(html, /function moveTickerInModal\(symbol, destination\)/);
  assert.match(html, /function resetTickerOrder\(\)/);
});

test("modal includes focus management, announcements, scrolling, and responsive controls", () => {
  assert.match(html, /id="tickerReorderStatus"[^>]*aria-live="polite"/);
  assert.match(html, /function trapTickerReorderFocus\(event\)/);
  assert.match(html, /_tickerReorderReturnFocus\.focus\(\)/);
  assert.match(html, /#tickerReorderList\s*\{[^}]*overflow-y:auto/s);
  assert.match(html, /@media \(max-width:600px\)[\s\S]*\.ticker-reorder-controls/);
});

test("autosave keeps the latest account order and offers retry after failure", () => {
  assert.match(html, /var _tickerOrderPending = null;/);
  assert.match(html, /function flushTickerOrderSave\(\)/);
  assert.match(html, /_tickerOrderPending = visibleTickerSymbols\(\);/);
  assert.match(html, /id="tickerReorderRetry"/);
  assert.match(html, /function retryTickerOrderSave\(\)/);
});

test("site changes made while account state loads are queued for the resolved persistence path", () => {
  assert.match(html, /if \(SITE && !_chartAccess\) \{/);
  assert.match(html, /function resolvePendingTickerOrder\(\)/);
  assert.match(html, /_chartAccess = j; applyTickerAccess\(\); resolvePendingTickerOrder\(\);/);
});

test("reset restores the captured data order without inventing a default", () => {
  assert.match(html, /var _tickerDefaultOrder = \[\];/);
  assert.match(html, /_tickerDefaultOrder = SUPER_SYMS\.slice\(\);/);
  assert.match(html, /localStorage\.removeItem\(TICKER_ORDER_KEY\)/);
  assert.doesNotMatch(html, /SUPER_SYMS\.sort\(/);
});
