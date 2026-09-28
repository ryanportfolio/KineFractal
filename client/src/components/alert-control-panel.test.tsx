import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("advanced weekly controls use the enlarged readable type scale", async () => {
  const source = await readFile(new URL("./alert-control-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /text-lg text-beam-dim">MINIMUM STRENGTH/);
  assert.match(source, /px-4 py-2 font-mono text-lg/);
  assert.match(source, /mt-2 font-mono text-sm text-beam-dim">Timeframes agreeing:/);
  assert.match(source, /large\?: boolean/);
  assert.match(source, /large=\{true\}[^\n]*id="triple-distance"/);
});
