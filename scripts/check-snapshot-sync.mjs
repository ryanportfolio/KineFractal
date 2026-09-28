// Drift guard: the site's static snapshot deploy VERSIONS must match the engine's
// single source of truth, fearlab/bridge/cells.py DEPLOY_CELLS in the range repo.
// A version flip edits cells.py; if the site snapshot is not regenerated,
// report-by-key fetches 404 onto stale static files and the site shows the old
// generation (the exact IWM v4.2-vs-v4.7 bug this guard exists to prevent).
//
// Usage:
//   npm run check:snapshot                        # exit 1 on drift (hard gate)
//   node scripts/check-snapshot-sync.mjs --warn   # always exit 0
//
// cells.py is fetched from range via gh (scripts/lib/range-source.mjs), or read
// from FEARLAB_CELLS when that points at a local file. Unreachable -> exit 0
// with a notice (nothing to compare against).
import { readFileSync } from "node:fs";
import { RANGE_REF, RANGE_REPO, fetchRangeFile } from "./lib/range-source.mjs";

const WARN = process.argv.includes("--warn");
const snapUrl = new URL("../client/src/data/fearlab-snapshot.generated.json", import.meta.url);

let cellsText;
try {
  cellsText = process.env.FEARLAB_CELLS
    ? readFileSync(process.env.FEARLAB_CELLS, "utf8")
    : fetchRangeFile("fearlab/bridge/cells.py").toString("utf8");
} catch {
  console.log(`[snapshot-sync] cells.py unavailable (${RANGE_REPO}@${RANGE_REF} via gh, or FEARLAB_CELLS); skipping`);
  process.exit(0);
}

const snapshot = JSON.parse(readFileSync(snapUrl, "utf8"));

// Parse the DEPLOY_CELLS dict literal: Cell("SPY", "1d", "fav-spy-v4.6-1d").
// Bear cells build Cell(sym, tf, preset, ...) from variables, so they never
// match this string-literal pattern.
const block = cellsText.slice(cellsText.indexOf("DEPLOY_CELLS"));
const closeAt = block.indexOf("\n}");
const scope = closeAt >= 0 ? block.slice(0, closeAt) : block;
const re = /Cell\(\s*"([A-Z]+)"\s*,\s*"([^"]+)"\s*,\s*"fav-[a-z]+-(v[\d.]+)-[^"]+"\s*\)/g;
const cells = {};
let m;
while ((m = re.exec(scope))) cells[m[1]] = { tf: m[2], variant: m[3] };

if (Object.keys(cells).length === 0) {
  console.error("[snapshot-sync] could not parse DEPLOY_CELLS from cells.py");
  process.exit(2);
}

const funds = new Map(snapshot.funds.map((f) => [f.sym, f]));
const problems = [];
for (const [sym, { tf, variant }] of Object.entries(cells)) {
  const f = funds.get(sym);
  if (!f) {
    problems.push(`${sym}: declared in cells.py but missing from the snapshot`);
    continue;
  }
  if (f.variant !== variant) problems.push(`${sym}: snapshot ${f.variant} != cells.py ${variant}`);
  if (f.tf !== tf) problems.push(`${sym}: snapshot tf ${f.tf} != cells.py ${tf}`);
  const wantKey = `${sym.toLowerCase()}-${tf}-full-${variant}`;
  if (f.reportKey !== wantKey) problems.push(`${sym}: reportKey ${f.reportKey} != ${wantKey}`);
}

if (problems.length) {
  console.error("[snapshot-sync] DRIFT — web snapshot disagrees with fearlab/bridge/cells.py:");
  for (const p of problems) console.error("  - " + p);
  console.error("\n  Fix, once prod has republished the flip:");
  console.error("    npm run sync:snapshot");
  process.exit(WARN ? 0 : 1);
}

console.log(`[snapshot-sync] ok — ${Object.keys(cells).length} deploy cells match the snapshot`);
