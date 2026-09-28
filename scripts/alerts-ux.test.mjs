import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const panel = await readFile(new URL("client/src/components/alert-control-panel.tsx", root), "utf8");
const page = await readFile(new URL("client/src/pages/alerts.tsx", root), "utf8");
const security = await readFile(new URL("server/security.ts", root), "utf8");
const routes = await readFile(new URL("server/alerts-routes.ts", root), "utf8");

function infoTipSource() {
  const start = panel.indexOf("function InfoTip");
  const end = panel.indexOf("function Toggle", start);
  assert.ok(start >= 0 && end > start, "InfoTip source must be present");
  return panel.slice(start, end);
}

function sentenceStops(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  function visit(node) {
    // Search-snippet metadata, not on-page prose; every page's description ends with a stop.
    if (ts.isCallExpression(node) && node.expression.getText(file) === "useDocumentMeta") return;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      const text = node.text.trim();
      if (/[A-Za-z]/.test(text) && /\.(?=\s|$)/.test(text)) hits.push(text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return hits;
}

test("Alerts help tooltip stays open across the trigger-to-content pointer handoff", () => {
  const source = infoTipSource();
  assert.doesNotMatch(source, /disableHoverableContent/);
  assert.doesNotMatch(source, /pointer-events-none/);
  assert.match(source, /sideOffset=\{10\}/);
  assert.match(source, /collisionPadding=\{12\}/);
});

test("Alerts visible prose contains no sentence-ending full stops", () => {
  assert.deepEqual(sentenceStops(panel, "alert-control-panel.tsx"), []);
  assert.deepEqual(sentenceStops(page, "alerts.tsx"), []);
});

test("alert preference autosave has a dedicated bounded rate limit", () => {
  assert.match(security, /export const alertPrefsLimiter = rateLimit\(\{[\s\S]*?max: 90,/);
  assert.match(security, /app\.use\('\/api\/alerts\/prefs', alertPrefsLimiter, csrfProtection\);/);
  assert.doesNotMatch(security, /app\.use\('\/api\/alerts\/prefs', strictLimiter, csrfProtection\);/);
});

test("eligible users get enabled defaults without overwriting explicit opt-outs", () => {
  assert.match(routes, /u\.emailVerified && await hasAcceptedCurrentTos\(u\.id\)/);
  assert.match(routes, /values\(\{ userId, kind, enabled: true \}\)/);
  assert.match(routes, /onConflictDoNothing\(\)/);
  assert.match(routes, /enabled: eligibleForDefaults/);
});
