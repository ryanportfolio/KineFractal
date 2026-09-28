#!/usr/bin/env node
// Pull the /charts page document from the engine repo into this site.
//
// fearlab/charts.html in ryanportfolio/range is the single source: the owner's
// local charts app and the nightly worker publish both use it. This site serves
// the DOCUMENT from a bundled copy, server/charts-app/charts.html (see
// server/fearlab-charts.ts), so a charts UI change ships on the next site deploy
// instead of waiting for a worker run. Chart DATA still comes from the worker's
// S3 store.
//
// Never hand-edit the bundled copy. Change fearlab/charts.html in range, merge
// it, then run:
//   npm run sync:charts            # copy range main -> server/charts-app/charts.html
//   npm run sync:charts -- --check # exit 1 if the bundled copy differs
//   RANGE_REF=<branch|sha> npm run sync:charts
//
// Exit codes: 0 = in sync (copied or already identical), 1 = drift (--check),
// 2 = could not fetch the source.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RANGE_REF, RANGE_REPO, fetchRangeFile } from "./lib/range-source.mjs";

const CHECK = process.argv.includes("--check");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DST = path.join(root, "server", "charts-app", "charts.html");
const SRC = "fearlab/charts.html";

let src;
try {
  src = fetchRangeFile(SRC);
} catch (err) {
  console.error(`[sync-charts] could not fetch ${RANGE_REPO}@${RANGE_REF}:${SRC}`);
  console.error(String(err.stderr || err.message).trim());
  process.exit(2);
}

const same = existsSync(DST) && Buffer.compare(src, readFileSync(DST)) === 0;
if (same) {
  console.log(`[sync-charts] in sync with ${RANGE_REPO}@${RANGE_REF}`);
  process.exit(0);
}
if (CHECK) {
  console.error(`[sync-charts] server/charts-app/charts.html differs from ${RANGE_REPO}@${RANGE_REF}:${SRC}`);
  console.error("  Fix: npm run sync:charts");
  process.exit(1);
}

mkdirSync(path.dirname(DST), { recursive: true });
writeFileSync(DST, src);
console.log(`[sync-charts] copied ${src.length} bytes from ${RANGE_REPO}@${RANGE_REF} -> server/charts-app/charts.html`);
