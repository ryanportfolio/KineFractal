import assert from "node:assert/strict";
import test from "node:test";
import { isViewPrefs, normalizeViewPrefs } from "./fearlab-charts";

test("view prefs accept only a known theme and a boolean labels choice", () => {
  assert.equal(isViewPrefs({ theme: "light", hoverLabels: true }), true);
  assert.equal(isViewPrefs({ theme: "dark", hoverLabels: false }), true);
  assert.equal(isViewPrefs({ theme: "blue", hoverLabels: false }), false);
  assert.equal(isViewPrefs({ theme: "light", hoverLabels: "yes" }), false);
  assert.equal(isViewPrefs({ theme: "light" }), false);
  assert.equal(isViewPrefs(["light", true]), false);
  assert.equal(isViewPrefs(null), false);
});

test("stored view prefs normalize to the known fields with dark and labels-shown defaults", () => {
  assert.deepEqual(normalizeViewPrefs({ theme: "light", hoverLabels: true, extra: 1 }), { theme: "light", hoverLabels: true });
  assert.deepEqual(normalizeViewPrefs({ theme: "sepia", hoverLabels: 1 }), { theme: "dark", hoverLabels: false });
  assert.deepEqual(normalizeViewPrefs(null), { theme: "dark", hoverLabels: false });
});
