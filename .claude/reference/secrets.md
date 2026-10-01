# Secrets & environment variables

> Env var names, what they key, and where they're consumed. Never store actual secret VALUES here: names and purposes only.

All are Railway variables on the `web` service. Unset locally, the matching feature degrades instead of crashing.

| Env var | Keys what | Consumed in |
|---|---|---|
| `DATABASE_URL` | Railway Postgres | `server/db.ts`, `drizzle.config.ts` |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Account sessions (Better Auth) | `server/auth.ts` |
| `RESEND_API_KEY`, `ALERTS_FROM` | Outbound email (verification, alerts) | `server/auth.ts` |
| `RESEND_WEBHOOK_SECRET` | Resend bounce/complaint webhook signature | `server/alerts-routes.ts` |
| `ALERTS_UNSUB_SECRET` | One-click unsubscribe link signing | `server/alerts-routes.ts` |
| `FEARLAB_S3_BUCKET`, `FEARLAB_S3_PREFIX` | Worker's artifact bucket and key prefix | `server/fearlab-live.ts` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ENDPOINT_URL_S3` (or `AWS_ENDPOINT_URL`) | S3-compatible bucket access (SDK default credential chain) | `server/fearlab-live.ts` |
| `CHART_BUILDER_URL`, `CHART_BUILDER_SECRET` | Engine `chart-builder` service for per-account tickers | `server/fearlab-charts.ts` |
| `TIINGO_API_KEY` (legacy name `VITE_T`) | Tiingo market data | `server/routes.ts` |
| `OPENROUTER_API` | Ratio Relevance analysis via OpenRouter | `server/openrouter-ratio.ts` |
| `PORT` | Listen port (default 5000) | `server/app.ts` |

retired 2026-10-01: `VITE_Google`, the Gemini key for the legacy analyzer; reason: its last reader was removed in #13. The Railway variable is unused and can be deleted.
