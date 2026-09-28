import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../server/charts-app/charts.html", import.meta.url), "utf8");

test("site mode runs on every http(s) host, including the localhost dev server", () => {
  assert.match(html, /var SITE = \/\^https\?:\$\/\.test\(location\.protocol\);/);
  assert.doesNotMatch(html, /127\\\.0\\\.0\\\.1\|localhost\)\$\/\.test\(location\.hostname\)/);
});

test("the account control renders only after the /api/me probe answers", () => {
  assert.match(html, /siteEmail = \(j\.user && j\.user\.email\) \|\| null;\s*renderAccountControl\(\);/);
  assert.match(html, /wrap\.hidden = true;/);
  assert.match(html, /if \(!wrap \|\| siteUser === null\) return;/);
  assert.match(html, /id="signInBtn" type="button" hidden>SIGN IN</);
  assert.match(html, /aria-label', 'Signed in as ' \+ email/);
});

test("sign-in happens in the page against Better Auth and returns to the same chart", () => {
  assert.match(html, /fetch\('\/api\/auth\/sign-in\/email'/);
  assert.match(html, /if \(r\.ok\) \{ clearLineCache\(\); location\.reload\(\); return; \}/);
  assert.match(html, /fetch\('\/api\/auth\/sign-out'/);
  assert.match(html, /var SIGNUP_HREF = '\/account\?mode=signup&next=%2Fcharts%2F';/);
});

test("the sign-in dialog is labelled, traps focus, closes on Escape and owns the keyboard", () => {
  assert.match(html, /el\.setAttribute\('aria-labelledby', 'signInTitle'\)/);
  assert.match(html, /<label for="signInEmail">Email<\/label>/);
  assert.match(html, /<label for="signInPassword">Password<\/label>/);
  assert.match(html, /id="signInError" class="err" role="status" aria-live="polite"/);
  assert.match(html, /function trapSignInFocus\(event\)/);
  assert.match(html, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); closeSignInDialog\(\); \}/);
  assert.match(html, /_signInReturnFocus\.focus\(\)/);
});

test("the signup prompt offers in-page sign-in with one wording", () => {
  assert.match(html, /<button class="go" type="button">Sign in<\/button>/);
  assert.match(html, /<a class="alt" href="' \+ SIGNUP_HREF \+ '">Create account<\/a>/);
  assert.doesNotMatch(html, /sign in \/ create account/);
});

test("the account control and its keys start at page load, independent of chart data", () => {
  assert.match(html, /initSiteAccount\(\);\s*start\(\);/);
  assert.match(html, /document\.addEventListener\('keydown', onAccountKeydown\);/);
  assert.match(html, /if \(accountUiOwnsKeys\(e\)\) return;/);
});

test("account UI swallows its keys and never keeps a typed password", () => {
  const fn = html.slice(html.indexOf("function onAccountKeydown(e)"), html.indexOf("function trapSignInFocus(event)"));
  assert.equal((fn.match(/e\.stopImmediatePropagation\(\);/g) || []).length, 3);
  assert.match(html, /document\.getElementById\('signInPassword'\)\.value = '';/);
});

test("sign-in and sign-out drop cached drawn lines and every chart entry to /account returns to the chart", () => {
  assert.match(html, /if \(k && k\.indexOf\(LS_HAND\) === 0\) localStorage\.removeItem\(k\);/);
  assert.match(html, /clearLineCache\(\);\s*location\.reload\(\);\s*\}\)/);
  assert.match(html, /<a href="\/account\?next=%2Fcharts%2F">Account<\/a>/);
  assert.doesNotMatch(html, /id="acctBtn"[^>]*aria-haspopup/);
  assert.match(html, /if \(!el\.contains\(document\.activeElement\)\) \{ event\.preventDefault\(\);/);
  assert.match(html, /\['account', '\/account\?next=%2Fcharts%2F'\]/);
  assert.match(html, /#signInDialog \.box \{[^}]*max-height:calc\(100vh - 40px\); overflow-y:auto;/);
});

test("site chrome (home link, site menu, trimmed toolbar) is applied at page load", () => {
  assert.match(html, /applySiteChrome\(\);\s*initSiteAccount\(\);\s*start\(\);/);
  const mode = html.slice(html.indexOf("function applySiteMode()"), html.indexOf("function applySiteChrome()"));
  assert.doesNotMatch(mode, /siteNav|SITE_HIDE_LAYERS/);
});
