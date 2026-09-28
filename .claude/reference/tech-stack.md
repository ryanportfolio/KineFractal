# Tech stack

> Non-default library choices and WHY they were made, so future sessions don't "fix" deliberate picks.

- **`pg` (node-postgres), not the Neon serverless driver.** Railway Postgres speaks plain TCP; the Neon driver only speaks Neon's proxy protocol (`server/db.ts`).
- **Better Auth, email + password only.** Accounts exist for watchlists and email alerts. No OAuth, no billing. Browsing never requires an account.
- **`/charts/` is one self-contained HTML file, not a React page.** `server/charts-app/charts.html` (vanilla JS + lightweight-charts) is edited in this repo. It began as a copy of the engine repo's local chart viewer; the two are now separate and never synced.
- **Dockerfile build.** `railway.json` selects the `Dockerfile`, overriding the service's Railpack default. The runtime `node:22-slim` image ships without Python, so `server/python/usd_correlations.py` cannot run there as built.
- **`@replit/*` Vite plugins** are Replit-era leftovers. `vite-plugin-runtime-error-modal` still loads in every build; the other two only load when `REPL_ID` is set.
