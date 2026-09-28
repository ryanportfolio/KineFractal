#!/usr/bin/env node
// Regenerate the site's static FearLab snapshot.
//
// 1. Fetch fearlab/bridge/cells.py (the engine's deploy-version list) from the
//    range repo into .tmp/range-src/cells.py.
// 2. Run scripts/regen_fearlab_snapshot.py with FEARLAB_CELLS pointing at it.
//    That script pulls the board and combos from the live site API and rewrites
//    client/public/fearlab/*.json and client/src/data/fearlab-snapshot.generated.json.
//
// Run after the engine's prod worker has published a version flip:
//   npm run sync:snapshot
// Needs gh (logged in) and Python 3 (`py` on Windows, `python3` elsewhere).
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RANGE_REF, RANGE_REPO, fetchRangeFile } from "./lib/range-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cellsPath = path.join(root, ".tmp", "range-src", "cells.py");

try {
  const cells = fetchRangeFile("fearlab/bridge/cells.py");
  mkdirSync(path.dirname(cellsPath), { recursive: true });
  writeFileSync(cellsPath, cells);
  console.log(`[sync-snapshot] fetched cells.py from ${RANGE_REPO}@${RANGE_REF}`);
} catch (err) {
  console.error(`[sync-snapshot] could not fetch cells.py from ${RANGE_REPO}@${RANGE_REF}`);
  console.error(String(err.stderr || err.message).trim());
  process.exit(2);
}

const python = process.platform === "win32" ? "py" : "python3";
const result = spawnSync(python, [path.join("scripts", "regen_fearlab_snapshot.py")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, FEARLAB_CELLS: cellsPath },
});
process.exit(result.status ?? 1);
