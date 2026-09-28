# Tech stack

> Non-default library choices and WHY they were made, so future sessions don't "fix" deliberate picks.

- **`pg` (node-postgres), not the Neon serverless driver.** Railway Postgres speaks plain TCP; the Neon driver only speaks Neon's proxy protocol (`server/db.ts`).
- **Better Auth, email + password only.** Accounts exist for watchlists and email alerts. No OAuth, no billing. Browsing never requires an account.
- **Bundled `charts.html` instead of a React port.** The `/charts` page is the engine owner's standalone lightweight-charts app, served byte-identical so one file serves both the local tool and the site.
- **Dockerfile build.** `railway.json` selects the `Dockerfile`, overriding the service's Railpack default. The runtime `node:22-slim` image ships without Python, so `server/python/usd_correlations.py` cannot run there as built.
- **`@replit/*` Vite plugins** are Replit-era leftovers. `vite-plugin-runtime-error-modal` still loads in every build; the other two only load when `REPL_ID` is set.
