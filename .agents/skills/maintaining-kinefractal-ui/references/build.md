# Build and modify production UI

Use for implementation, fixes, responsive adaptation, copy changes, motion, and new production surfaces.

## 1. Establish local truth

Before editing:

- Read `PRODUCT.md`, `DESIGN.md`, and the relevant repository instructions completely once per session; reuse that context for small follow-up edits.
- Read the route and representative components. Search for an existing primitive or pattern before creating one.
- Identify the data artifact/API and every displayed unit, date, and evidence label.
- Check whether the target is the React SPA, the `/charts` document (canonical source: range's `fearlab/charts.html`), or another distinct surface.
- Check nearby tests and the exact commands maintained by the repository.

Do not conclude product context is missing because a generic context loader skipped them. The authoritative files are `PRODUCT.md` and `DESIGN.md` at the repository root.

## 2. Preserve the instrument

Kine Fractal is settled, not greenfield.

- Keep the single CRT/instrument model. Sections belong to one machine, not a grid of individually decorated widgets.
- Use `client/src/index.css` tokens. Preserve raw HSL triplets, existing variable names, `[data-phosphor]` themes, Tailwind mappings, and legacy utilities.
- Preserve IBM Plex Mono for homepage body/data/labels and the trace-font system for traced headings. Orbitron and Space Grotesk are legacy inner-page choices, not prompts for font discovery.
- Color carries beam energy or state. Respect `--beam-core`, `--beam-hot`, `--beam-mid`, `--beam-dim`, and `--beam-ghost`. Amber remains fear/drawdown/sell/caution or a crossed buy line.
- Keep no more than three highly luminous objects in a viewport.
- Prefer darkness, graticules, hairlines, and alignment over glass panels, generic cards, gradient text, side stripes, or crypto-neon decoration.
- Keep the homepage introduction exact when touched: `buys fear in SPY, QQQ and IWM → trims into strength`.

New tokens or primitives require a demonstrated repeated need. They must extend the existing system rather than rename or replace it.

## 3. Protect financial meaning

Read the complete invariants in `PRODUCT.md`; do not rely on this summary alone.

Before showing a number, chart, fill, ledger row, or status, name:

- source artifact or report;
- actual EOD decision versus simulated backtest activity;
- independent calendar year, start-year cohort, or continuous report basis;
- unit (`%`, `pp`, ratio, count, or quoted ETF price);
- comparison dates and latest closed-session date;
- partial-period state where applicable.

Hard lines:

- Backtest fills/trades/P&L are simulated; use `next-open` when applicable.
- EOD decisions are not executed orders or broker fills.
- Never expose account-dependent dollar gains, losses, equity, cash, notional, or P&L on public routes. ETF quotes may retain currency when clearly labeled.
- Never imply recurring deposits belong to the live strategy or independent-year/cohort measurements.
- Never merge actual decisions and simulated activity into one unlabeled ledger.
- SPY, QQQ, and IWM can have different deployed rules and variants.

When content conflicts with current artifacts, stop and resolve the source; do not polish a false claim.

## 4. Build complete task states

Every affected task must work across applicable states:

- loading or deferred content;
- empty data;
- offline/stale/unavailable worker data;
- partial or nullable metrics;
- error with a concrete recovery path;
- signed out, unverified email, terms not accepted, or permission-gated;
- disabled, saving, saved, and retrying controls;
- long labels, narrow widths, zoomed text, and localization-safe numbers/dates.

Use plain user-facing language. Explain what the reader controls or recognizes, not internal channel codes, engine plumbing, or repository names.

## 5. Accessibility and responsive behavior

- Prefer native semantics and existing Radix primitives. Give every control an accessible name.
- Preserve visible `:focus-visible`; verify logical keyboard order and Escape behavior for dialogs/drawers.
- Associate labels, descriptions, errors, and status updates programmatically. Announce meaningful async changes with an appropriate live region.
- Keep focused targets clear of fixed/sticky chrome. Provide skip/navigation paths where repeated chrome warrants them.
- Ensure reflow at 320 CSS px and usability at 200% zoom. Avoid horizontal scrolling except intentional data/chart workbenches with an accessible alternative or controlled pan.
- Meet WCAG 2.2 AA contrast and minimum target-size requirements. Dense `/charts` controls may be compact, but still need operable hit areas and non-color state cues.
- Drag/reorder interactions need keyboard or button alternatives.
- Do not hide essential behavior behind hover.

Responsive behavior is structural. Collapse, wrap, disclose, or reorganize based on content; do not create a separate mobile design language.

## 6. Motion and runtime performance

Read `DESIGN.md` and `client/src/lib/beam-scheduler.ts` before adding motion.

- Only one active movement receives the beam. Register through the existing scheduler where applicable.
- Revoked/off-screen sections stop work and hold or settle their final composited state.
- Pause work while `document.hidden`.
- Use the existing `cubic-bezier(0.16,1,0.3,1)` family. No bounce or constant glitch/flicker loops.
- Prefer transforms/opacity for routine motion. Keep filters, glows, WebGL, masks, and paint-heavy effects bounded, measured, and justified by the tube model.
- Preserve the persistence engine’s DPR cap, visibility pause, context-loss recovery, theme-aware uniforms, SVG fallback, and slow-frame degradation.
- Use passive scroll listeners, `requestAnimationFrame`, and Intersection Observer appropriately. Avoid interleaved layout reads/writes and render-time geometry reads.
- Preserve route code-splitting and deferred below-fold work. Do not import heavy reports, auth, charts, or animation code eagerly without evidence.
- Profile before adding memoization, virtualization, preloads, or caching. Apply only the React/Vite/Express guidance that matches this stack; reject Next.js, RSC, SWR, or Vercel-hosting assumptions.

## 7. Surface-specific cautions

### Homepage

Preserve the documented six-movement order and each section’s single question. A user-requested structural addition must reconcile `PRODUCT.md` and `DESIGN.md`; do not silently create a seventh movement. A new section earns its place through legibility and named evidence, not spectacle.

### Board and lab reports

Keep static-snapshot and live-overlay behavior safe under nullable/missing worker data. Preserve comparison basis, units, freshness, and variant labels.

### Charts

Edit range's `fearlab/charts.html`, never `server/charts-app/charts.html` here; pull the merged change with `npm run sync:charts`. Dense controls need discoverable labels, keyboard paths, responsive overflow handling, and stable chart viewport behavior. CSS values passed into lightweight-charts must use syntax its parser accepts; see project pitfalls.

### Alerts and account

Reuse existing Radix/form/auth patterns. Make verification, terms, permission, save, failure, and retry states explicit. Never weaken security or consent for visual convenience.

## 8. Verify proportionally

Minimum for changed TypeScript/React behavior:

1. Focused tests for changed behavior.
2. `npm run check`.
3. `npm run build`.
4. Browser/DOM verification for affected interactions and responsive/motion facts when browser capability is available.

For canonical charts changes, run range's checks there, then `npm run sync:charts` and `npm run check:charts` here, plus relevant JS/browser validation. Use source/DOM assertions for structure and values; screenshots only for subjective visual judgment.

Production Railway behavior remains unverified until observed there. State that boundary plainly.
