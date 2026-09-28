import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./alerts.tsx", import.meta.url), "utf8");

test("signed-out alerts copy states the outcome concisely", () => {
  assert.match(source, />ALERT TERMINAL · EOD<\/div>/);
  assert.doesNotMatch(source, /CH3/);
  assert.match(source, />INBOX DELIVERY<\/span>/);
  assert.doesNotMatch(source, /VERIFIED EMAIL/);
  assert.match(source, /Create a free account, then choose tickers and filters here to get limit-buy alerts\s*<\/p>/);
  assert.doesNotMatch(source, /verify the inbox/);
  assert.doesNotMatch(source, /no payment details/);
  assert.doesNotMatch(source, /no broker connection/);
});
