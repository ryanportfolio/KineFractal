# Audit production UI

Audit is read-only unless the user also requests fixes. Diagnose the production Railway experience and canonical source, not the deliberately basic local presentation.

## 1. Set scope and evidence

- Read the relevant instructions, `PRODUCT.md`, `DESIGN.md`, tokens, route code, data contracts, and tests.
- Identify canonical source. For `/charts`, the canonical source is range's `fearlab/charts.html`; `server/charts-app/charts.html` here is a synced copy, so a defect in it is fixed in range.
- If checking the deployed site, distinguish what production DOM/runtime proves from what local source proves.
- Verify every finding with code, DOM, logs, measurements, or a reproducible interaction. Do not infer defects from a screenshot alone.
- Do not call source review visual verification. Do not call self-review independent review.

## 2. Review in risk order

### A. Product and financial correctness

Check first because a polished false claim is the worst outcome.

- Actual EOD decisions and simulated backtest events visibly separated.
- Independent-year, start-cohort, and continuous-report bases correctly named.
- `%` and `pp` used correctly; no public account-scale dollar results.
- Latest data date, partial-period state, fund/variant, and next-open assumption present where material.
- No implication of broker execution, recurring live deposits, leverage, or universal SPY/QQQ/IWM rules.
- Plotted and displayed numeric claims trace to named artifacts or reports.

### B. Task completion and states

- Primary task and current location understandable from headings, labels, and numbers.
- Loading, empty, stale/offline, nullable, error, retry, gated, disabled, saving, and success states behave coherently.
- Controls use consistent action names through button, status, error, and confirmation.
- Destructive or data-loss actions have confirmation or undo appropriate to risk.

### C. Accessibility

- Semantic landmarks and heading hierarchy.
- Accessible names, form labels/descriptions, and programmatic errors/status.
- Complete keyboard operation, logical focus order, visible focus, no traps, Escape behavior.
- Focus not obscured by navbar, drawer, or sticky chart chrome.
- WCAG 2.2 AA contrast, non-color cues, 24×24 CSS px minimum target size with documented exceptions.
- 200% zoom and 320 CSS px reflow.
- Drag/reorder/pan functions have non-drag alternatives where required.
- Reduced motion produces stable, meaningful final states.

### D. Responsive and interaction behavior

- No accidental horizontal overflow or clipped actions.
- Charts/tables preserve comparison meaning at narrow widths.
- Touch, pointer, hover, keyboard, and coarse-pointer paths remain usable.
- Long copy, long symbols, validation messages, and browser text scaling do not break layout.
- URL/deep-link state used when sharing or restoring the state has real user value, not by blanket rule.

### E. Identity and hierarchy

- Surface still reads as one Kine Fractal instrument.
- Existing tokens, beam energy semantics, typography roles, graticules, and phosphor themes used consistently.
- No competing design system, generic SaaS card grid, unexplained new hue, new font, or per-widget CRT effect.
- At most three highly luminous objects per viewport.
- Each chart/section states its question, unit, comparison, and takeaway before decoration.

Identity review asks “does this strengthen the shipped system?” It does not score whether the interface resembles current design trends or another company.

### F. Motion and performance

- One active beam only; no concurrent canvases, raster scans, or ambient loops.
- Off-screen and hidden-document work pauses; one-shot entrances release the beam.
- Reduced-motion path settles without broken state.
- No layout-property animation or unbounded blur/filter/shadow/WebGL cost.
- DPR caps, context-loss fallback, quality degradation, and theme swaps remain intact where applicable.
- Passive/deduplicated listeners, batched DOM reads/writes, deferred below-fold work, route splitting, and bounded bundle imports.
- Core Web Vitals or frame-rate claims require measurements; source patterns alone are not scores.

## 3. Report findings

Lead with verified problems, ordered by user and product impact:

- **P0 Blocking:** false financial meaning, security/consent failure, inaccessible critical task, or complete production failure.
- **P1 Major:** WCAG AA barrier, broken primary task/state, serious responsive defect, or harmful performance behavior.
- **P2 Minor:** real friction with a workaround or localized inconsistency.
- **P3 Polish:** low-impact refinement; keep these sparse.

For each finding include:

```text
[P?] Short title
Location: path:line or production route/state
Evidence: what was directly observed
Impact: affected user/task/contract
Fix direction: smallest causal correction
```

Also report suspicious items investigated and verified safe when that saves future rework. Do not emit a generic `/20` score, an “AI slop” verdict, or a menu of follow-up commands.

## 4. Audit completion

State:

- source files and production routes inspected;
- browser widths, zoom, keyboard, or runtime measurements actually exercised;
- checks not available or not run;
- whether findings are source-only, local-runtime, or deployed-production evidence.

No findings means “no actionable findings within inspected scope,” not universal certification.
