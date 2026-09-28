---
name: maintaining-kinefractal-ui
description: Use on $maintaining-kinefractal-ui or to build, polish, review, or fix Kine Fractal production UI: homepage, reports, charts, alerts, account, nav, legal, responsive, a11y, motion, copy. Not backend-only or local-basic prototypes.
---

# Maintaining Kine Fractal UI

## Outcome

Strengthen the production Railway site without replacing its identity. Kine Fractal already has an unusually strong, shipped visual language: one CRT instrument, phosphor traces, calibrated labels, terse evidence-first copy, and one-beam motion. Preserve it, extend it coherently, and remove friction around it.

Routine UI work is maintenance, not an invitation to choose a new palette, font, aesthetic lane, component library, or motion personality.

For Kine Fractal production UI, this repository-specific skill supersedes generic design personalities and generic brainstorming ceremony. Do not additionally invoke `impeccable` or another generic design skill, or restart broad design exploration unless the user explicitly asks for a new visual direction.

## Authority and target

Follow current instructions first, then read the sources relevant to the surface:

1. `AGENTS.md`, `CLAUDE.md`, and the `.claude/reference/` files they route to
2. `PRODUCT.md` and `DESIGN.md`
3. `client/src/index.css`
4. The real route, components, primitives, tests, and data contracts

Production target = Railway `kinefractal.com`. Local presentation may stay basic; use it to verify production code, not as a competing design target.

`fearlab/charts.html` in `ryanportfolio/range` is the canonical `/charts` document. Never hand-edit `server/charts-app/charts.html`: change the range file and merge it there, then run `npm run sync:charts` here (`npm run check:charts` reports drift).

## Choose the smallest mode

| Request | Mode | Required behavior |
|---|---|---|
| Small extension or defect | Build | Inspect nearby patterns, make the smallest coherent change, verify it. No redesign ceremony. |
| UI review, critique, accessibility or responsive check | Audit | Diagnose only unless fixes were requested. Use evidence and file:line locations. |
| Major new surface or explicit redesign | Brief, then build | Define purpose, evidence, placement, states, and motion budget. Preserve settled identity unless the user explicitly authorizes changing it. |
| Backend-only work | Do not use this skill | Use backend/project workflows instead. |

Read [references/build.md](references/build.md) for implementation or [references/audit.md](references/audit.md) for review. Read both only when the request genuinely includes both.

A brief is not palette/font exploration or multi-concept ceremony. It records the user task, evidence question, canonical data source, placement, affected states, and interaction/motion budget. The seven homepage movements in `PRODUCT.md`/`DESIGN.md` remain fixed unless the user explicitly requests a structural change; reconcile those documents when an approved change alters them.

## Always-on laws

- Existing identity wins. Do not regenerate it from generic design advice.
- Real product content and artifacts win over invented examples or decorative numbers.
- Financial meaning is UI behavior: evidence type, capital basis, unit, comparison dates, partial status, and freshness must stay explicit.
- Reuse existing tokens, primitives, icons, typography, route patterns, and state vocabulary before adding anything.
- Preserve the one-beam law. New motion joins the scheduler or remains static; it never creates competing ambient loops.
- Accessibility is a product contract, not a cleanup pass. Reduced motion is the exception: the site ships one motion path for everyone and no `prefers-reduced-motion` branch (owner call, 2026-08-02).
- Prefer the smallest causal change. Do not refactor adjacent visual systems without need.
- No new runtime dependency, font, UI kit, browser requirement, image generator, or design platform unless the user explicitly approves it and the repository needs it.
- Never claim browser, visual, accessibility, Railway, or performance validation that did not run.

## Common mistakes

- Treating "public site" as permission to invent a fresh marketing aesthetic.
- Missing `PRODUCT.md` because a loader stopped at `AGENTS.md` or `CLAUDE.md`.
- Applying generic finance-dashboard conventions to the terminal-native system.
- Missing evidence basis, `pp`, one-beam, or canonical `/charts` rules.
- Scoring "AI slop" while missing task completion, provenance, keyboard access, or performance.

## Completion

Report the surface changed or reviewed, contracts preserved, checks actually run, and any production/browser checks still unverified. Do not commit, push, deploy, install dependencies, or modify Railway unless separately authorized.

Provenance for this skill's principles: [NOTICE.md](NOTICE.md).
