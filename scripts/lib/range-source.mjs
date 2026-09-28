// Read a file from the FearLab engine repo (ryanportfolio/range) on GitHub.
//
// The site and the engine live in separate repos. A few site files are copies
// of, or are checked against, engine files (fearlab/charts.html,
// fearlab/bridge/cells.py). This helper fetches the engine's copy through the
// GitHub CLI, so it works on any machine where `gh auth status` passes, with
// no local range checkout.
//
// Override the source with RANGE_REPO (owner/name) and RANGE_REF (branch/sha).
import { execFileSync } from "node:child_process";

export const RANGE_REPO = process.env.RANGE_REPO || "ryanportfolio/range";
export const RANGE_REF = process.env.RANGE_REF || "main";

// Returns the file as a Buffer. Throws if gh is missing, not logged in, or the
// path does not exist at that ref.
export function fetchRangeFile(repoPath, ref = RANGE_REF) {
  return execFileSync(
    "gh",
    [
      "api",
      `repos/${RANGE_REPO}/contents/${repoPath}?ref=${encodeURIComponent(ref)}`,
      "-H",
      "Accept: application/vnd.github.raw",
    ],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
  );
}
