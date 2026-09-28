# Pitfalls

> Accumulated project-specific gotchas. Dated entries, newest at the bottom. If this file exceeds ~200 lines, split by area (`pitfalls-<area>.md`) and update the CLAUDE.md index.

### 2026-06-23: Dead-code component trap: edit the file that's actually rendered

`client/src/components/hero.tsx` is NOT on the live site; only `client/src/pages/home-legacy.tsx` imports it. The `/` route (`client/src/App.tsx`) renders `client/src/pages/home.tsx`, which defines its own inline `Hero()` holding the hero `<h1>`. The persistent "KINE FRACTAL" logo is the navbar's ASCII `<pre>` in `client/src/components/navbar.tsx`.

Symptom: an edit to `components/hero.tsx` merged and nothing changed on screen. Before editing "the hero", "the logo" or any section, trace route in `App.tsx` → page file → inline JSX. Pages inline their sections and stale same-named components (`*-legacy.tsx`) remain, so a `components/<name>.tsx` matching the concept is not proof it's wired in.

### 2026-07-01: The site can silently serve a stale engine generation

The site showed FearLab v2 numbers for about two weeks after v3.8 became the deployed default, because the engine's site emitter hard-filtered the old variant and nothing on the site side noticed.

When the engine flips a deployed version, the site snapshot must follow: run `npm run check:snapshot`, and once the prod worker has republished, `npm run sync:snapshot`. Fast audit: compare `client/public/fearlab/board.json` `generated`/`variant` with the live `/api/fearlab/board.json`, and grep `client/src` for the previous variant string.

### 2026-07-12: DESIGN.md "no fabricated data as texture" is not a ban on decorative visuals

User clarification: the homepage ignition Lissajous and visuals like it are decoration and are fine. The DESIGN.md rule targets fake data VALUES presented as real (invented numbers, made-up curves labeled as history), not ornamental motion.

### 2026-09-28: `launchPlacedChrome()` needs Playwright, which the repo does not install

`scripts/lib/launch-chrome.mjs` imports `playwright` or `playwright-core`, but neither is in `package.json`, so a fresh worktree fails with `launch-chrome needs playwright or playwright-core installed`. Run `npm i --no-save playwright-core` before a headed-browser check; it drives the system Chrome channel, so no browser download is needed. `--no-save` keeps `package.json` and the lockfile clean, and the next `npm ci` removes it.

### 2026-09-28: `/charts/` belongs to this repo; range's chart file is a separate local tool

This repo was split out of range so the public site and the owner's local tools stop sharing files. `server/charts-app/charts.html` is the site's own page and is edited here. Range's `fearlab/charts.html` is the local viewer; it is not this page's source and nothing syncs between them. Only chart DATA (`/charts/dashboard/*`, `/charts/assets/*`) still comes from the engine worker.

Symptom: docs and comments carried over from range (kernel, README, deployment/tech-stack/commands references, `server/fearlab-charts.ts`, a `sync:charts` script) said the page was a byte-identical copy to be edited in range and synced in. A session built a UI skill on that and routed a charts login change through a range PR; the user corrected it. Those references and the sync script were removed. If "edit range, then sync" reappears anywhere for the chart page, it is stale.

### 2026-09-28: Desktop CSS zoom scales viewport units; full-screen pieces must divide by `--pz`

At widths of 1440px and up, `index.css` sets `zoom: 1.2` (1.4 from 1800px) on `:root` and exposes the factor as `--pz`. CSS zoom scales `vh`/`vw` too, so a new `h-screen` sticky stage or `bottom-[9vh]` overlay renders 20 to 40% taller than the screen and its bottom captions fall off the page. The About scroll film hit this: captions and the progress bar were cut off until the heights moved to `calc(100vh / var(--pz))`.

Two related traps: `canvas.clientWidth` reports unzoomed CSS px, so a WebGL canvas sized from it renders below screen resolution unless the backing store also multiplies by `--pz`; and `getBoundingClientRect()` returns zoomed px while `offsetHeight` does not, so scroll-progress math must not mix the two. Existing full-screen utilities get unlayered overrides in `index.css` (`.h-\[100svh\]` and friends); new ones need either an override there or an inline `calc(... / var(--pz))`.
