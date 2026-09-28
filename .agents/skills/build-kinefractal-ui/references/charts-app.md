# /charts/ chart app

One self-contained HTML file: inline CSS, one large inline script, lightweight-charts for the candles. No React, no Tailwind, no build step. Server side is `server/fearlab-charts.ts`.

## Ownership

`server/charts-app/charts.html` is this site's page and is edited here, like any other file in the repo. It began as a copy of the local chart viewer in the engine repo (`ryanportfolio/range`); the two are now separate files that are never synced. Do not look in range for this page, do not treat range as its source, and do not copy changes between them.

What still comes from the engine is chart DATA: `/charts/dashboard/*` and `/charts/assets/*` (lightweight-charts, `kf-theme.css`, fonts) proxy the nightly worker's published run. The page document itself ships with each deploy of this repo; if it is missing, `/charts/` answers 503.

Server work that supports the page (a JSON route, a redirect parameter) goes in `server/` and ships in the same change.

## Site mode and local mode

`var SITE` is true on http(s) hosts other than localhost / 127.0.0.1. `applySiteMode()` hides owner-only controls, rewires the email button to `/alerts`, replaces the wordmark with a home link plus the site menu (`#siteNav`, `#siteMenu`), and probes account state.

The non-site branches are left over from the file's shared past. Their only remaining user is this repo's dev server on localhost, where they make the page render without site chrome. Public behaviour is site mode; new features target it. Removing or simplifying the leftover local-mode code is fair game in a modernization slice, as long as local verification (below) still works.

## Account state already in the file

- `siteUser`: `null` unknown, `false` signed out, `true` signed in. Set once from `GET /api/me` (`{user:null}` signed out; `{user:{id,email,name,emailVerified}, tosAccepted, tosVersion}` signed in). Failure leaves it `null` (fail open).
- `_chartAccess` from `GET /api/chart-symbols` decides which ticker buttons show. `#superBtns.await-access` hides the row until it answers.
- `showSignupCta(heading, body)` builds the `#drawCta` modal with a `/account` link. `showDrawCta()` and `showAddCta()` call it when a signed-out visitor uses draw or "+ Add".
- Hand lines persist through `/labels/*` per account; signed out they fall back to localStorage and save errors say "sign in at /account".
- `/account` (React, `client/src/pages/account.tsx`) reads `?mode=signup` but has no return-to parameter today. A sign-in entry point on charts needs one: accept only same-origin relative paths (reject `//host`, schemes and backslashes) so it cannot become an open redirect. The page restores the last ticker and view from `localStorage` (`fearlab_charts_sel` and the saved view), so returning to plain `/charts/` lands on the same chart; no URL state is needed. Sign-in does not require a verified email (`requireEmailVerification: false` in `server/auth.ts`); verification and ToS only gate alert emails.

The existing chart writes (`/labels/save`, `/watchlist/add`, `DELETE /api/chart-symbols/:sym`, `PUT /api/chart-symbols/order`) use raw `fetch` with no CSRF token, a leftover from when the page was shared with the local viewer. They rely on the SameSite=Lax session cookie, the request shape, server validation and rate limits in `server/security.ts` (`linesLimiter` on `/labels`, the shared `strictLimiter` on `/watchlist` and `/api/chart-symbols`); changing them is a protected-contract change. A new state-changing route the page calls should use the site's CSRF protection: fetch a token from `GET /api/csrf-token`, send it as `X-CSRF-Token`, and mount `csrfProtection` plus a rate limiter in `server/security.ts`. Better Auth's own `/api/auth/*` routes carry their own origin checks and need no token.

`siteUser` keeps only a boolean. An account indicator needs the identity too: store it from the same `/api/me` response (do not add a second call) and render when that probe resolves. Show a shortened email, since charts get screen-shared. Signing out from the page is `POST /api/auth/sign-out` (same origin, JSON body `{}`), then reload; `/account` also offers it. Signed-in state should reach every consumer that currently checks `siteUser` or `_chartAccess` without a page reload where practical.

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
- Browser: start `web-dev` from `.claude/launch.json` and open `http://localhost:5000/charts/`. Localhost means `SITE` is false, so site mode does not run there. To see site mode, open the page through a non-localhost name (for example the machine's LAN IP on port 5000) or say you could not.
- Without Railway secrets the dashboard data routes return 503, so the chart body may be empty; toolbar and dialogs still render. Without a database `/api/me` always answers signed out. A signed-in state can only be exercised with a real session (deployed site or a local database the user provides); otherwise mark it unverified. Stubbing `siteUser` in the console shows layout only and must be reported as a stub.
- Check 375 px and the user's desktop width, keyboard-only use of any new control, and the local (non-site) rendering.
