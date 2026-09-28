# KineFractal

Source for [kinefractal.com](https://kinefractal.com), the public site for FearLab: an end-of-day research engine for SPY, QQQ and IWM that buys into fear and trims into strength. The site shows the engine's latest decisions, its backtest reports and a charts page, and lets visitors sign up for email alerts.

The engine (Python) lives in a separate private repo, `ryanportfolio/range`. It publishes data to an S3 bucket each night; this site reads that bucket and never places orders.

## Stack

React and Vite in `client/`, Express in `server/`, a Drizzle schema in `shared/`, Postgres. Hosted on Railway as the `web` service of the `kinefractal` project.

## Run it

```
npm ci
npx tsx server/index-dev.ts   # dev server on http://localhost:5000
npm run check                 # type-check
npm test
npm run build && npm start    # production bundle
```

Without the Railway environment variables the site still runs: engine data routes return 503 and pages fall back to the bundled snapshot. Variable names are listed in `.claude/reference/secrets.md`.

## Deploy

Merging to `main` deploys the `web` service. Build and data flow: `.claude/reference/deployment.md`.

Two files are copies of engine output and are refreshed from the range repo, not edited here:

- `server/charts-app/charts.html`: `npm run sync:charts`
- the FearLab snapshot (`client/public/fearlab/`, `client/src/data/fearlab-snapshot.generated.json`): `npm run sync:snapshot`

Both need the GitHub CLI logged in with access to `ryanportfolio/range`.
