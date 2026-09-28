# Deployment

> Deploy target, build output, asset paths, publish flow.

## Railway project `kinefractal`

| Service | Source | What it does |
|---|---|---|
| `web` | this repo, branch `main`, root `/` | The site. Serves kinefractal.com, www.kinefractal.com and web-production-781bd.up.railway.app. Builds `Dockerfile` (config: `railway.json`). |
| `worker` | `ryanportfolio/range`, branch `prod` | FearLab end-of-day run. Cron `0 11 * * 2-6` (UTC). Publishes board, signals, combos and `/charts` data to the S3 bucket. |
| `chart-builder` | range, `prod` | Builds per-account "+ Add" tickers for `/charts` (reached via `CHART_BUILDER_URL`). |
| `chart-refresh` | range, `prod` | `python worker/chart_refresh.py`, cron `0 21 * * 1-5` (UTC). |
| `Postgres` | Railway image | Accounts, alerts, chart lines and preferences, market-data cache. |

A merge to this repo's `main` redeploys `web` only. Engine changes ship from range: merge to range `main`, a GitHub Action fast-forwards `prod`, and the next cron run publishes.

## Build

- `Dockerfile`, two stages on `node:22-slim`: `npm ci` + `npm run build`, then a runtime stage with `npm ci --omit=dev`, `dist/`, `server/python/`, `server/charts-app/` and `client/public/`. Starts `node dist/index.js` on `PORT` (default 5000).
- Build context is the repo root. `.dockerignore` is a whitelist; a new top-level file the build needs must be added there.
- `npm run build` = `vite build` (client → `dist/public`) + esbuild (server → `dist/index.js`).

## Data served from the engine

- `/api/fearlab/*` and `/charts/dashboard/*`, `/charts/assets/*` read the worker's S3 bucket (`server/fearlab-live.ts`), following the `latest.json` pointer. Bucket unset or unreachable → 503.
- `/charts/` document: `server/charts-app/charts.html`, owned and edited in this repo, shipped in the image. Missing file → 503. Only its data (`dashboard/*`, `assets/*`) comes from the worker.
- Static fallback snapshot: `client/public/fearlab/*.json` and `client/src/data/fearlab-snapshot.generated.json`, written by `npm run sync:snapshot` from the live API. `npm run check:snapshot` compares deploy versions against range's `fearlab/bridge/cells.py`.
