# Pitfalls

> Accumulated project-specific gotchas. Dated entries, newest at the bottom. If this file exceeds ~200 lines, split by area (`pitfalls-<area>.md`) and update the CLAUDE.md index.

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

Radix tooltips (Floating UI) hit the same zoom: the popper writes on-screen px as a CSS translate, the root zoom multiplies it again, and at 1440px and up the box landed right of and below its trigger, cut off at the viewport edge (Alerts panel `?` help, 2026-10-09). `index.css` now unzooms `[data-radix-popper-content-wrapper]` and rezooms its child; keep that rule if a new Radix popover, menu or select is added.

### 2026-09-28: A Playwright locator call skews frame-time measurements

Any `page.locator(...)` call (even `.count()`) injects Playwright's helper script into the page, and from then on requestAnimationFrame intervals in headed Chrome can sit at 30-40 ms instead of the panel's 10 ms. It hit the untouched home page as well as the About film, so it is the harness, not the site. A frame-time check that called `locator().count()` before measuring failed at 30 ms; the same sweep without it measured 10 ms.

Measure frame time in a page that has never had a locator call: find elements with `page.evaluate(() => document.querySelector(...))` instead, or take the timing before any locator runs.

### 2026-09-28: A detached Codex review sends no completion notice

`nohup codex exec ... &` inside a background Bash call returns as soon as Codex is launched, so the "command completed" notice arrives at launch, not when the review ends. One review finished 25 minutes before anyone looked, while the session sat waiting for a notice that never came.

Run `codex exec` itself as the background command (Bash `run_in_background`, no `nohup` or `&`), so the notice fires when Codex exits and `report.md` is written.

### 2026-09-28: The engine repo is readable; check engine semantics there

`ryanportfolio/range` is private but this account can read it: `gh api repos/ryanportfolio/range/contents/<path> -H "Accept: application/vnd.github.raw"`. A caption was once hedged as unconfirmable instead of being checked there, and the user corrected it.

Confirmed from it: in `fearlab/episodes/*.json` a fill's `d` is the day the order fills, not the signal day. `emit_episode.py` takes it from the broker's fill `ts`, and `broker.py` `on_bar_open` fills market orders queued on the previous close at this bar's open; limit and stop fills land intrabar on the same bar.

### 2026-09-29: Resizing a WebGL canvas after drawing shows a black frame

Setting `canvas.width` or `canvas.height` clears the drawing buffer. Done after the frame's draw calls but before the browser composites (the About film's governor did it inside `reportFrame`, called after `renderer.end`), the frame shows as pure black. Each render-scale change flashed once, and users saw it often. Only change canvas size at the start of a frame, before drawing. `/about?film=debug` in `npm run dev` has a blank-frame detector; `.tmp`-style probes can force governor changes with CDP `Emulation.setCPUThrottlingRate`.

### 2026-10-01: Chrome refuses some local ports for a headed check

Chrome blocks a fixed list of ports it treats as unsafe, and 5061 (SIP over TLS) is on it: `page.goto` fails with `net::ERR_UNSAFE_PORT` while `curl` against the same server works. A production-build check on `PORT=5061` failed on every page and had to be rerun on 5071. Pick a port such as 5055 or 5071-5079 for a local server that Chrome will load.
