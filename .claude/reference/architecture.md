# Architecture

> System flow, auth strategy, state management, cross-cutting structure. Keep it terse: pointers into code, not essays.

- **Layout.** `client/` React SPA (Vite root), `server/` Express API, `shared/` Drizzle schema and contracts used by both, `migrations/` SQL.
- **Routing.** `wouter`, routes in `client/src/App.tsx`. Trace route → page file → inline JSX before editing a section: pages inline their own sections. Unrouted pages and the code only they reached were deleted 2026-10-01 (#13); a page file that exists should be routed.
- **Server entry.** `server/app.ts` (middleware, `registerRoutes` from `server/routes.ts`), `server/index-dev.ts` (Vite middleware), `server/index-prod.ts` (static `dist/public`).
- **FearLab data.** Read-only from the engine's S3 bucket via `server/fearlab-live.ts`; `/api/fearlab/*` routes in `server/routes.ts`; `/charts` in `server/fearlab-charts.ts`. Contracts in `shared/fearlab-contracts.ts`. Offline fallback: `client/public/fearlab/` + `client/src/data/fearlab-snapshot.generated.json`.
- **Accounts and alerts.** Better Auth, email + password (`server/auth.ts`, `server/account-routes.ts`). Watchlist, alert prefs, unsubscribe and Resend webhook in `server/alerts-routes.ts`. The engine worker sends the alert emails.
- **Market data.** Tiingo through a cache (`server/tiingo-cache.ts`, table from `migrations/0005_market_data_cache.sql`); falls back to memory without a database. Refresh is lazy: the first request after the latest weekday 18:30 New York window opens fetches from Tiingo; requests before the next window read the cache (2026-10-01, #12). Nothing refreshes without a visitor.
- **Security.** `server/security.ts`: Helmet headers, rate limits, CSRF double-submit (client helper `client/src/lib/csrf-fetch.ts`), input sanitization.
- **No Python on the server.** The runtime image (`node:22-slim`) has no `python3`; server code must not spawn it. Python in this repo is local tooling only (`scripts/regen_fearlab_snapshot.py`).
  retired 2026-10-01: `server/python/usd_correlations.py`, spawned by `GET /api/correlations/usd`; reason: removed in #13, the endpoint returned 500 on every production request and only an unrouted page called it.
