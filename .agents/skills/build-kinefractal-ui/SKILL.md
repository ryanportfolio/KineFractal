---
name: "build-kinefractal-ui"
description: "Build or audit user-facing UI on kinefractal.com, the FearLab site. Use for changes to the /charts chart app (toolbar, dialogs, account and sign-in affordances, legend, export), React pages under client/src, navbar, account and alerts screens, or a UI review of any of them. Not for engine logic, data pipelines, server-only routes, or copy-free backend work."
---

# Build KineFractal UI

Change or review an interface on kinefractal.com so it keeps the site's evidence rules, fits the surface's existing design system, and works for a signed-out visitor, a signed-in visitor, and the owner's local tool.

## Authority

Current user request > `CLAUDE.md` / `AGENTS.md` > `PRODUCT.md` (copy and evidence invariants) > the surface's own design source > this skill. When this skill disagrees with those files, they win; report the conflict.

## 1. Identify the surface

The site has two UI systems with different sources of truth. Pick before editing.

| Surface | Code | Design source | Reference |
|---|---|---|---|
| `/charts/` chart app | `server/charts-app/charts.html` (copy of range's `fearlab/charts.html`) | its own `:root` block and existing CSS in that file | [references/charts-app.md](references/charts-app.md) |
| Every other page | `client/src/` React + Tailwind, routes in `client/src/App.tsx` | `DESIGN.md`, tokens in `client/src/index.css` | [references/site-react.md](references/site-react.md) |

Read the matching reference completely before the first edit. A change that spans both (for example, a sign-in flow that starts on `/charts/` and finishes on `/account`) reads both.

## 2. Choose the change mode

- **Small extension** (a control, a state, a label, one dialog): inspect the neighbouring code, reuse its classes, tokens and helpers, ship the smallest change that solves the task. A new control should look like it was always there. No mockups or variant rounds.
- **Audit**: report findings ranked by user impact with file and line, and do not edit unless fixes were requested.
- **Overhaul or modernization** (new layout, new visual language, moving or removing controls people use): audit first, then write a short plan naming what moves, what disappears and what stays, sorted into preserve / improve / remove, and get the user's approval before building. Ship in slices. Offer `$lab` for live tuning when the look is undecided.

When improving an existing screen, fix in this order and stop once the request is met: broken function and accessibility, hierarchy and spacing, narrow-width layout, states, tokens, motion, then recomposing or replacing whole blocks.

**Protected contracts** never change silently: routes and URLs, element ids and classes that script or tests bind to, `localStorage` keys, API request and response shapes, existing keyboard and screen-reader behaviour, and every plotted value's source. Changing one is an explicit line in the plan.

## 3. Always-on rules

1. **Account state is visible where account features live.** A surface that changes behaviour by sign-in state (drawing, adding tickers, reorder, alerts) shows which state the visitor is in and offers the next step: sign in when signed out, the account identity and a way to manage or sign out when signed in. Unknown state (probe pending or failed) renders as neither; never flash a wrong state.
2. **Signing in returns the visitor to where they started**, with the page state they had (ticker, timeframe) when the page keeps it in the URL or storage. A sign-in link that strands the visitor on `/account` is a defect.
3. **Fail open on account probes.** If `/api/me` or another account call fails, the public chart and pages still work; only account-only actions degrade.
4. **Reuse before adding.** Existing tokens, button styles, dialog pattern, tooltip pattern (`symbtn` + `data-tip` on charts), and copy vocabulary come first. No new dependency, font, colour or component library without the user's approval.
5. **Evidence and copy.** UI text follows `PRODUCT.md` invariants and the project voice: plain labels, no internal codes, backtest fills labelled simulated, no account-dollar P&L on public pages. Write new copy with the `$writing` skill.
6. **Every state is designed**: loading, empty, error with a retry, stale (bundled snapshot or data older than the latest session), signed out, signed in, unverified email, narrow width. A busy button keeps its label and adds "…". No dead ends. Name each state you handled in the handover.
7. **One wording per action.** The sign-in call to action reads the same in the toolbar, the dialogs and the navbar.
8. **Keyboard and screen reader.** Every new control is a real `<button>`, `<a>` or form element with a visible focus style and an accessible name that does not depend on `title` alone. Dialogs trap focus, close on Esc, return focus to the opener, and announce status changes through an `aria-live="polite"` region. Fixed bars and overlays must not cover the focused element.
9. **Targets and widths.** Hit targets are at least 24 px on desktop and 44 px below 600 px; a checkbox and its label form one target. Check at 375 px and at the user's desktop width (1920 px when unknown). Toolbars wrap; they must not push account controls off-screen. Native `<select>` and inputs get explicit dark background and text colours.
10. **Security stays server-side.** UI hides or shows affordances; the server enforces access. Never read secrets, tokens or session cookies in page script, and keep CSRF helpers on state-changing calls.

## 4. Verify honestly

Follow `CLAUDE.md` verification rules and the surface reference's verification section. Run `npm run check`, `npm test` and `npm run build` for code changes. For visual claims, use the browser tooling the kernel names and say which states you actually saw. For an accessibility claim, walk the flow by keyboard and read the accessibility tree; an automated score alone is not conformance. Audit a signed-in state without reloading, since a reload can drop it. States you could not reach locally (a real signed-in session, live chart data) are reported as unverified, with the reason.

## 5. Handover

Report: surface and files changed, states covered and how each was verified, anything left unverified, and for chart-app changes which repo each edit landed in (range, site, or both) and whether the copies match.
