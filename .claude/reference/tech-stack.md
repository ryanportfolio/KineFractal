# Tech stack

> Non-default library choices and WHY they were made, so future sessions don't "fix" deliberate picks.

- **`pg` (node-postgres), not the Neon serverless driver.** Railway Postgres speaks plain TCP; the Neon driver only speaks Neon's proxy protocol (`server/db.ts`).
- **Better Auth, email + password only.** Accounts exist for watchlists and email alerts. No OAuth, no billing. Browsing never requires an account.
- **`/charts/` is one self-contained HTML file, not a React page.** `server/charts-app/charts.html` (vanilla JS + lightweight-charts) is edited in this repo. It began as a copy of the engine repo's local chart viewer; the two are now separate and never synced.
- **Dockerfile build.** `railway.json` selects the `Dockerfile`, overriding the service's Railpack default. The runtime `node:22-slim` image has no Python.
- **Tailwind v4 through `@tailwindcss/vite`, no PostCSS config.** `vite.config.ts` sets `css.postcss` inline, so a `postcss.config.js` would be ignored; the old one (and `postcss`, `autoprefixer`) was removed with byte-identical CSS output.
  retired 2026-10-01: `@replit/*` Vite plugins and `vite-plugin-meta-images.ts` were Replit-era leftovers still in the build; reason: removed in #13. `og:image` and `twitter:image` are now absolute URLs in `client/index.html`.
