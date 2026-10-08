# /charts/ chart app

One self-contained HTML file: inline CSS, one large inline script, lightweight-charts for the candles. No React, no Tailwind, no build step. Server side is `server/fearlab-charts.ts`.

## Ownership

`server/charts-app/charts.html` is this site's page and is edited here, like any other file in the repo. It began as a copy of the local chart viewer in the engine repo (`ryanportfolio/range`); the two are now separate files that are never synced. Do not look in range for this page, do not treat range as its source, and do not copy changes between them.

What still comes from the engine is chart DATA: `/charts/dashboard/*` and `/charts/assets/*` (lightweight-charts, `kf-theme.css`, fonts) proxy the nightly worker's published run. The page document itself ships with each deploy of this repo; if it is missing, `/charts/` answers 503.

Server work that supports the page (a JSON route, a redirect parameter) goes in `server/` and ships in the same change.

## Site mode and local mode

`var SITE` is true whenever the page is served over http(s), including the localhost dev server, so a local preview matches production. `applySiteChrome()` runs at page load: it hides owner-only controls and local-only layer toggles, rewires the email button to `/alerts` and replaces the wordmark with a home link plus the site menu (`#siteNav`, `#siteMenu`). `applySiteMode()` runs after chart data loads and only fetches per-account ticker access. `initSiteAccount()` runs at page load, independent of chart data: it probes `/api/me` and builds the account control.

The non-site branches (file:// only) are left over from the file's shared past and have no remaining user. Public behaviour is site mode; new features target it. Removing the leftover local-mode code is fair game in a modernization slice.

## Account state already in the file

- `siteUser`: `null` unknown, `false` signed out, `true` signed in. Set once from `GET /api/me` (`{user:null}` signed out; `{user:{id,email,name,emailVerified}, tosAccepted, tosVersion}` signed in). Failure leaves it `null` (fail open).
- `_chartAccess` from `GET /api/chart-symbols` decides which ticker buttons show. `#superBtns.await-access` hides the row until it answers.
- `showSignupCta(heading, body)` builds the `#drawCta` prompt: **Sign in** (opens `#signInDialog`), **Create account** (`SIGNUP_HREF`) and **Not now**. `showDrawCta()` and `showAddCta()` call it when a signed-out visitor uses draw or "+ Add".
- Hand lines persist through `/labels/*` per account; signed out they fall back to localStorage and save errors say "sign in at /account".
- `/account` (React, `client/src/pages/account.tsx`) reads `?mode=signup` and `?next=`. `next` passes through `safeNext()` (`client/src/lib/safe-next.ts`, same-origin relative paths only, so it cannot become an open redirect). After sign-in it redirects there; after sign-up it shows a link back. The page restores the last ticker and view from `localStorage` (`fearlab_charts_sel` and the saved view), so returning to plain `/charts/` lands on the same chart. Sign-in does not require a verified email (`requireEmailVerification: false` in `server/auth.ts`); verification and ToS only gate alert emails.

The existing chart writes (`/labels/save`, `/watchlist/add`, `DELETE /api/chart-symbols/:sym`, `PUT /api/chart-symbols/order`) use raw `fetch` with no CSRF token, a leftover from when the page was shared with the local viewer. They rely on the SameSite=Lax session cookie, the request shape, server validation and rate limits in `server/security.ts` (`linesLimiter` on `/labels`, the shared `strictLimiter` on `/watchlist` and `/api/chart-symbols`); changing them is a protected-contract change. A new state-changing route the page calls should use the site's CSRF protection: fetch a token from `GET /api/csrf-token`, send it as `X-CSRF-Token`, and mount `csrfProtection` plus a rate limiter in `server/security.ts`. Better Auth's own `/api/auth/*` routes carry their own origin checks and need no token.

The account control (`#acct`, right of the Limit Buy Levels button `#exportBtn`) is hidden until the probe answers, then shows **SIGN IN** (`#signInBtn`) or the shortened email (`#acctBtn`) with a menu (account, email alerts, sign out via `POST /api/auth/sign-out`). `#signInDialog` posts to `/api/auth/sign-in/email` and reloads; the signup prompt (`#drawCta`) offers the same dialog. `siteEmail` holds the identity from the same probe; do not add a second `/api/me` call. Key handling for these lives in `onAccountKeydown`, registered before the chart key handler; it calls `stopImmediatePropagation()` while account UI is open so no key reaches the chart shortcuts. The `fearlab_hand_*` line cache has no account scope, so every account change clears it: chart sign-in and sign-out (`clearLineCache()`) and `/account` sign-in, sign-up and sign-out (`client/src/lib/chart-line-cache.ts`). Any new sign-in or sign-out path must do the same. Tests: `scripts/charts-account.test.mjs`.

## Export dialog

`#exportDialog` builds limit-buy levels from the published overlays. Group tabs (`#exportGroupTabs`) sit on top; the left column holds the ticker list (`#exportPicks`, symbol + full name + type), search, min/max % and strength; the right column (`#exportResult`) shows one section per ticker and rebuilds live on every change (`scheduleExportBuild`, a generation counter drops stale builds). There is no Build step; `#exportCsv` in the footer is the one primary action. The CSV columns, `CLUSTER_PCT` stacking and the `kf-export-strength` key are unchanged from before the redesign.

- Full names come from the published combos (`superMap[sym].name`). The data has no asset type, so `tickerType()` reads it from the fund name (ETF/ETN/Fund, SPDR/iShares/ProShares, or a name ending in "Trust" = ETF; "Index" = index; else stock).
- `#exportTip` is one fixed-position tooltip for every `[data-tip]` in the dialog, shown at once on hover and on keyboard focus.
- Groups are `{id, name, symbols}` lists. Signed in: `GET/PUT /api/chart-groups` (`chart_preferences.ticker_groups`, `normalizeTickerGroups` in `server/fearlab-charts.ts`), with `csrfProtection` and `chartGroupsLimiter`; the page fetches `/api/csrf-token` and retries once on 419. Signed out or account storage failing: `kf-export-groups-v1` in localStorage. Checked tickers per tab persist in `kf-export-picks-v1`.
- `#exportEditor` (create, rename, add/remove, two-click delete) replaces the columns while open; Escape closes it before the dialog (`onExportEscape`).
- Results are ticker cards (`.xp-card`), each limit a row with price and % below close side by side (`.xp-px`, `.xp-pct`). A stacked pack shows as one limit at its highest price with an "Includes …" line for the levels it covers (`exportLimits`). "Combine nearby levels" (`#exportCombineToggle`, `#exportCombinePct`, 0.5 to 5%, default 2) sets `CLUSTER_PCT` or switches stacking off; it is kept in this browser (`kf-export-combine-v1`) and is not yet shared with the alert emails, whose pair/triple rules run in the range worker. `#exportLegend` explains the colours and stacking. The CSV still lists every level.

Tests: `scripts/charts-export.test.mjs`, `server/chart-groups.test.ts`.

## Design system of this file

Its own tokens, not `DESIGN.md`'s beam ramp:

- `:root` hex variables: chrome `--bg --panel --grid --fg --mut` (`assets/kf-theme.css` also sets them but is served from the worker's run, so change chrome tokens in the page's own `:root`) and overlay colours (`--sup`, `--prom`, `--rr`, `--mine`, `--cbuy`, `--csell` and the rest). Overlay colours encode data meaning; do not retheme them as part of a chrome change. Any variable read by lightweight-charts or other JS colour parsing stays hex; space-separated `hsl()` kills the whole chart (incident, 2026-07-04).
- Brand green `#00ff88` on the wordmark and button hover; `--mine` lime for the visitor's own drawing and the signup CTA.
- Buttons: square corners, `1px solid var(--grid)`, hover border green. Icon buttons use `.symbtn` with a CSS tooltip from `data-tip` (`tip-right` near the right edge).
- Dialogs: fixed full-screen backdrop, `.box` panel, `.open` class toggles `display:flex`; z-index ladder `#drawCta`/`#buildOvl` 60, reorder/export 75, remove confirm 80. The reorder dialog is the reference for focus trap, Esc, focus return and `aria-live` status.
- Ticker symbols render in Verdana (user decision, 2026-08-08).
- Layout: `#bar` flex-wraps; `#topActions` sits right via `margin-left:auto`; `@media (max-width:600px)` blocks handle narrow widths.
- One overlay colour change = change its token; the legend swatch and the stroke both read it.

## Modernization

The user wants the chart app modernized beyond login. Treat that as an overhaul: audit first, then a plan for approval, then build in slices, one PR per slice. Known gaps against `PRODUCT.md` / `DESIGN.md` to raise in the audit, not fix silently:

- In site mode, layer toggles show internal codes (`TL`, `S+`, `SW`, `RR`, `RX`, `LV`, `GP`, `TH`, `CF`, `OB`, `tOB`, `PD`) with meaning only in `title` tooltips, which touch and keyboard users cannot reach.
- `.kf-brand` runs `kf-glow` (keyframes come from the worker-served `kf-theme.css`) on an infinite 1 s loop; `DESIGN.md` limits idle motion and bans constant loops.
- Fonts (Space Grotesk, Orbitron, Verdana) differ from the site's IBM Plex Mono voice. Its fonts come from the worker's published assets; a new font has to be served from this repo instead.
- Many controls rely on `title` for their only description, and several targets are under 24 px.

Keep: the terminal-native dark instrument feel, hex tokens, the one-file architecture, every existing site feature and its default state. Adopting the site's React components or Tailwind here is out of scope.

## Verification

- Tests: `scripts/charts-*.test.mjs` assert on source strings of `charts.html`. Add or update one for each new contract (element ids, ARIA attributes, gating on `SITE`), then run `npm test`.
- Browser: start `web-dev` from `.claude/launch.json` and open `http://localhost:5000/charts/`; site mode runs there. The server reads `charts.html` once and keeps it in memory, so restart it after editing the page.
- Without Railway secrets the dashboard data routes return 503, so the chart body stays empty; site chrome, the account control and dialogs still render. Without a database `/api/me` always answers signed out. A signed-in state can only be exercised with a real session (deployed site or a local database the user provides); otherwise mark it unverified. Stubbing `siteUser` in the console shows layout only and must be reported as a stub.
- Check 375 px and the user's desktop width and keyboard-only use of any new control.
