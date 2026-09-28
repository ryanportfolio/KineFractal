# Architecture

> System flow, auth strategy, state management, cross-cutting structure. Keep it terse: pointers into code, not essays.

- **Layout.** `client/` React SPA (Vite root), `server/` Express API, `shared/` Drizzle schema and contracts used by both, `migrations/` SQL, `attached_assets/` images imported via the `@assets` alias.
- **Routing.** `wouter`, routes in `client/src/App.tsx`. Trace route → page file → inline JSX before editing a section: pages inline their own sections and stale `*-legacy.tsx` / same-named components exist (see pitfalls).
- **Server entry.** `server/app.ts` (middleware, `registerRoutes` from `server/routes.ts`), `server/index-dev.ts` (Vite middleware), `server/index-prod.ts` (static `dist/public`).
- **FearLab data.** Read-only from the engine's S3 bucket via `server/fearlab-live.ts`; `/api/fearlab/*` routes in `server/routes.ts`; `/charts` in `server/fearlab-charts.ts`. Contracts in `shared/fearlab-contracts.ts`. Offline fallback: `client/public/fearlab/` + `client/src/data/fearlab-snapshot.generated.json`.
- **Accounts and alerts.** Better Auth, email + password (`server/auth.ts`, `server/account-routes.ts`). Watchlist, alert prefs, unsubscribe and Resend webhook in `server/alerts-routes.ts`. The engine worker sends the alert emails.
- **Market data.** Tiingo through a cache (`server/tiingo-cache.ts`, table from `migrations/0005_market_data_cache.sql`); falls back to memory without a database.
- **Security.** `server/security.ts`: Helmet headers, rate limits, CSRF double-submit (client helper `client/src/lib/csrf-fetch.ts`), input sanitization.
- **Python on the server.** `server/python/usd_correlations.py`, spawned per request by `GET /api/correlations/usd`. The image installs neither Python nor yfinance, so that endpoint degrades in production.
