# Commands

> Build / dev / test / deploy commands for this project.

| Command | What it does |
|---|---|
| `npm ci` | Install from the lockfile. |
| `npm run check` | Type-check (`tsc`). |
| `npm test` | All tests via `tsx --test`: `client/src/**`, `shared/`, `server/`, `scripts/*.test.mjs`. |
| `npm run build` | Vite client build + esbuild server bundle → `dist/`. |
| `npm start` | Run the built server (`dist/index.js`, `NODE_ENV=production`). |
| `npm run dev` | Express + Vite dev server. The script sets `NODE_ENV` with POSIX syntax, which fails under Windows cmd; on Windows run `npx tsx server/index-dev.ts` or use `.claude/launch.json`. |
| `npm run db:push` | drizzle-kit schema push. Hand to the user; never run blind against the shared database. |
| `npm run sync:charts` | Copy range's `fearlab/charts.html` → `server/charts-app/charts.html` (needs `gh` logged in). `-- --check` or `npm run check:charts` only reports drift. |
| `npm run sync:snapshot` | Fetch range's `cells.py`, then run `scripts/regen_fearlab_snapshot.py` to rewrite the static FearLab snapshot from the live API. Needs `gh` and Python 3. |
| `npm run check:snapshot` | Exit 1 if the snapshot's deploy versions differ from range's `cells.py`. |
| `py -m unittest scripts/test_regen_fearlab_snapshot.py` | Tests for the snapshot regen script. |

`RANGE_REPO` / `RANGE_REF` override the engine source for the sync scripts (default `ryanportfolio/range@main`).
