# DESIGN.md: The Signal

Kine Fractal behaves like a single-beam storage oscilloscope. Charts, headlines
and brand moments are phosphor traces that draw, persist and decay. A scope has one
beam, so only one section earns active motion at a time. Restraint is part of the
instrument, not a decorative preference.

The token source of truth is `client/src/index.css`. This file records design and
copy intent. Where a page breaks a rule below, it is listed under
[Known exceptions](#known-exceptions); fix the page, not the rule.

The `/charts/` app (`server/charts-app/charts.html`) is a separate system with its
own palette and fonts in its `:root` block. This file covers every other route.

## The beam ramp

Color represents beam energy. A fresh trace runs from a white-hot core through the
selected phosphor hue as it decays. Every stop takes its hue from `--phos-h`; each
stop's saturation and lightness are fixed, so the emerald, amber and ice tube
themes recolor the whole ramp and stay coherent.

| token | role |
|---|---|
| `--beam-core` | electron spot; brief flashes only |
| `--beam-hot` | newest trace, active headline, primary result |
| `--beam-mid` | default text and data |
| `--beam-dim` | secondary text, etched labels, benchmark traces |
| `--beam-ghost` | hairlines, graticules, panel borders; never text |

- The background is unlit phosphor (`hsl(160 28% 3.2%)`), not pure black.
- Amber is the accent, reserved for fear, drawdown, sell/caution states or a
  crossed buy line. The amber tube theme shifts the accent to orange-red so it
  still reads against the tube.
- Benchmark traces are dimmer than strategy traces and may be dashed.
- Keep no more than three highly luminous objects in one viewport.
- A page can pin a tube theme with `data-phosphor` (alerts uses ice). The command
  drawer lets the visitor switch themes; the switch plays the degauss thump.

## Typography

| face | token | use |
|---|---|---|
| Space Grotesk | `--font-sans` | body default on every page |
| JetBrains Mono (IBM Plex Mono fallback) | `--font-mono` | data, numbers, labels, navigation, terminal output |
| IBM Plex Mono | set directly | `.etched` labels and the evidence stamp (`.kf-stamp`) |
| Orbitron | `--font-display` | headlines, through `BeamHeading` |

- Headlines use `BeamHeading` (`client/src/components/beam-heading.tsx`): real
  uppercase text in Orbitron, phosphor-hot with a soft glow, revealed by a
  left-to-right beam wipe. Use the component; don't restyle headings by hand.
- Etched labels (`.etched`) are small, tracked and dim. They must still be plain
  enough to understand without internal strategy vocabulary.
- The logo's KINE FRACTAL wordmark draws from its own single-stroke glyphs in
  `client/src/lib/kf-logo-geometry.ts`; it is not a font.

## Layout and scale

- **Desktop zoom.** The root zooms 1.2 at 1440px wide and 1.4 at 1800px. CSS zoom
  also scales viewport units, so viewport-sized pieces divide by `--pz` (see the
  `DESKTOP SCALE` block in `index.css`). Code that measures the page must allow
  for it: `getBoundingClientRect` returns zoomed pixels while `offsetWidth` returns
  layout pixels, and Radix popovers carry a zoom fix. The root font size is 22px.
- **Square corners.** `--radius` is `0px`. Don't add `rounded-*`.
- **Panels.** Homepage sections use darkness, graticules (`.graticule`) and hairline
  rules instead of glass cards. Panels are a hairline border
  (`border-beam-ghost/70`, brightening to `border-beam-dim` on hover) on the
  background.
- **Homepage section header.** An etched section number (`02`), a `BeamHeading`
  h2, then an etched paragraph stating the basis before any score. The beam
  scheduler drives the heading's reveal.
- **Inner page header.** `Navbar`, then a `main` with top padding clearing the
  navbar, content in `max-w-6xl mx-auto px-5 md:px-10`, an etched label, then a
  `BeamHeading` h1. Two pages lead differently on purpose: `/about` opens on its
  own hero (a large mono title with a rotating word), and a `/lab/:key` report
  leads with its score, the edge in pp, under a hairline meta bar.

## Motion

`client/src/lib/beam-scheduler.ts` grants motion to the visible section nearest
the viewport center. When the beam leaves a section, its entrance finishes
instantly and it keeps its final state.

The persistence engine in `client/src/components/persistence-engine.ts` uses raw
WebGL2 with a static SVG fallback. Keep its performance contract: DPR capped at
1.5, pause while hidden, context-loss recovery, theme-aware uniforms and graceful
quality reduction on slow frames. Pointer deflection affects the composite view,
not the underlying data.

- Use the `cubic-bezier(0.16,1,0.3,1)` family (`--ease-out-expo`). No bounce except
  the evidence stamp and the degauss thump.
- No two canvases animate simultaneously; DOM raster scans also consume the beam.
- Idle motion is limited to:
  - the hero's low-energy sweep;
  - the tube's slow scan roll;
  - the caret blink in terminal shells;
  - one footer breathing dot;
  - the logo's band pass: one faint 1.4 s pass through the letters every 12 s,
    run as a timed one-shot animation;
  - restrained current-state rail motion.
- Pause work off-screen and while `document.hidden`.
- Infinite CSS animations on SVG stroke properties keep the main thread busy.
  Run repeating SVG motion as timer-started one-shot animations instead.
- Do not branch on `prefers-reduced-motion`. Every visitor gets the same full
  motion (owner call, 2026-08-02); never reintroduce a reduced-motion path.
  `App.tsx` sets framer-motion's `MotionConfig reducedMotion="never"` for this.

## Homepage movements

The homepage has six movements, in this order. Movements below the fold mount
lazily.

### 1. Ignition

The spot ignites, traces the brand figure and settles into an engine-derived SPY
market-history sweep. The hero mark (`client/src/components/kf-logo.tsx`) arrives
with one sentence:

> buys fear in SPY, QQQ and IWM → trims into strength

There are no channel codes, floor statuses or telemetry readouts beneath the
sentence. First-visit motion is skippable; returning visits settle immediately.

### 2. Year by year

Three fund panels show the number of completed independent calendar years ahead of
buy-and-hold. Copy states the basis before the reader sees the score: each year
starts all cash, has no deposits, uses equal starting capital and dates for both
legs, and ends at year-end. The current partial year is excluded from the count.

Do not substitute continuous full-window returns, drawdowns or trade counts here.

### 3. SPY strategy

The heading names the deployed SPY variant, read from the snapshot data; never
hard-code a version. The monthly return grid shows strategy percentages. Each
monthly number sits on a faint tint (beam for gain, amber for loss); the number
carries the reading, the tint only hints at sign and size. Its final columns
compare each independent strategy year with buy-and-hold: a solid strategy bar
over a dashed buy-and-hold bar on one shared scale, then strategy %, buy-and-hold
% and the edge in percentage points (pp). Each year is a button; the selected
year fills a readout with its edge in pp and strategy vs buy-and-hold %, stated
as one calendar year, not an average. State the independent annual basis,
identify partial periods and keep account dollars out.

### 4. How it buys / How it sells

Each fund gets its own fear rail, all on one shared 0-100 percentile scale. The
buy line is labeled above the rail (`buy 85th`) and today's fear percentile below
it, so the two labels never share a row. The order-size range reads in percent of
account (`3% to 100%`, or `up to 55%` when the rule starts at zero). State
whether the buy line is crossed or how many percentile points remain. Explain
that crossing the line is only the first check: cooldown, protection, regime and
available cash can still block a buy.

Below the rails, one sizing curve at a time, picked with SPY / QQQ / IWM tabs:
order size as % of account against fear percentile, from that fund's live sizing
policy, with the buy line and today's point marked. Label it a sizing rule, not
an executed order. Do not overlay three sizing curves. Do not expose channel
codes or an internal one-word readiness state as user-facing copy.

Sell logic follows in a separate block, in three groups: trim (sell slices into
strength), exit (step aside when the protection line breaks) and watch markets
(sell signals read from other markets). Each rule carries a schematic sketch of
the shape its trigger looks for; sketches carry no numbers or data and are
labeled schematic. Describe simulated strength trims, lot-harvest, recycle and
SPY protection in plain language. Exact engines and thresholds differ by fund.

### 5. SPY, step by step

This is a full-history SPY backtest viewed through a recorded episode. Label it
as simulated and state the next-open fill assumption. The label names the variant
the episode was recorded under, read from the episode itself; when the site now
runs a different variant, a note says so. Never relabel a recorded episode with
the deployed version.
The explanation may walk through fear buys, trims, recycle and protection, but
must not imply QQQ and IWM share SPY's exact rules.

Below the replay, the five rules run as a cycle wheel: gauge, buy, trim, exit,
recycle, then back to the buy. Each station is a button; the selected one opens
a when / then / limits panel with its key numbers, plus a SPY / QQQ / IWM switch.
Buy line and order-size range are live; other numbers are deployed preset facts.
With QQQ or IWM selected, SPY-only rules are labeled as SPY settings, never shown
as that fund's own. The fund switch may carry a one-word temperament (eager,
patient, cautious); there is no separate temperaments block.

### 6. The record

The record has two visibly separate panels:

1. **Latest EOD decision**: closed-session signal facts for deployed cells, one
   row per fund. Quoted ETF prices may appear and must be identified as market
   quotes, not account values. A queued intent is still not an executed broker
   order.
2. **Recent simulated activity**: the latest events from the deployed SPY
   variant's full-history backtest. A timeline puts one tick per fill on a date
   axis, buys up and sells down; tick height is order size as % of the simulated
   account. Single-line rows follow. Buy and sell size appears as percent of
   simulated account; sell rows may show sold-lot return. No account-dependent
   dollar P&L or notional appears.

The evidence stamp is explicit, with the variant read from data:

`BACKTEST · SPY DAILY · V<variant> · SIMULATED NEXT-OPEN FILLS`

## Chrome

- **Navbar:** one compact bar with the logo, the route links with a beam cursor
  under the active one, and the terminal button. No live numbers and no second
  status tier.
- **Logo:** `client/src/components/kine-fractal-logo.tsx`, the ring-and-waves mark
  beside the single-stroke wordmark, in two sizes. In the navbar its intro plays
  once per full page load; in the footer it plays the first time the logo is 60%
  in view. Its colors are fixed (a cyan-to-green ring, a red-to-green top wave)
  and don't follow the tube theme.
- **Footer:** a calibration plate with the large logo and one low-energy breathing
  dot. It is hidden on `/about`.
- **The tube:** one global CRT overlay (`crt-tube.tsx`): raster, barrel vignette,
  corner glare and a slow scan roll. There is no flicker. The only one-shot tube
  event is the degauss thump when the phosphor theme changes.
- **Terminal shells:** the mobile menu, the command drawer, the 404 page and the
  route transition use scanlines and a blinking beam caret. That look stays inside
  terminal-style surfaces.
- **Command drawer:** a scope control panel. Its report and trade output follows
  the same percentage-only, simulation-label and plain-language rules as visible
  pages.

## Public numeric language

- Account-dependent gain, loss, equity, cash, order notional, deployed capital,
  realized P&L and open P&L use percentages, percentage points, ratios or counts.
- A fund's quoted market price may retain `$` because it describes one ETF share,
  not account scale. Label it `ETF quote` or equivalent when ambiguity is possible.
- Use `pp` for a difference between returns. Do not label a percentage-point edge
  as a percent return.
- The continuous report's funding schedule is a simulation assumption. It is not
  the live strategy and does not describe annual or start-cohort evaluation.

## Evidence language

- `EOD`, `latest closed session`, `decision` and `queued intent` describe signal
  artifacts.
- `backtest`, `simulated` and `next-open fill` describe report events.
- `broker fill` is reserved for the separate paper-account fills ledger and is not
  used for homepage or lab backtest rows.
- Do not describe backtest trades or fills as actual or live, and do not use a
  provenance slogan in place of a simulation label. A value can be engine-derived
  while the trade remains hypothetical.
- Version numbers come from data, never from hand-written copy: the deployed
  variant from the snapshot, a recorded artifact's variant from that artifact.

## Bans

- No gradient text, side-stripe card language, fourth hue, homepage glass cards or
  per-widget CRT effects outside terminal shells.
- No fabricated numeric data as texture. Plotted values come from `board.json`, a
  report artifact, the EOD signal artifact or another explicitly named source.
- No constant glitch or flicker loops.
- No unexplained chart. If the comparison, basis or unit cannot be stated in one
  short paragraph, redesign the visual before shipping it.
- No account-scale dollar gains or losses on any public route.

## Known exceptions

These break the rules above. The first two are owner-approved and stay; the rest
are debt to fix when the surface is next reworked, and the command drawer comes
first because it breaks an evidence rule.

- **Logo colors** (approved). The logo's cyan-to-green ring and red-to-green top
  wave are a fourth hue. Approved with the logo (2026-10-10); no other component
  may borrow them.
- **About page motion** (approved). The hero title's word rotation keeps running
  beside the margin figure once the hero entrance has played, an owner call over
  the one-moving-section rule (recorded in `about-rail.tsx`).
- **Command drawer** (`command-line.tsx`): the board and trades output prints
  backtest returns and fills without a simulated label; the header says
  "live EOD data"; the intro line is a provenance slogan ("real end-of-day
  data"); it prints raw internal states (`protect_broken`, "buy zone armed"); a
  `$` price appears without an ETF quote label; one column uses a hex gray.
- **Hero:** a `CodeRain` canvas animates alongside the WebGL beam, and the hero
  mark runs an infinite pulse glow. A comment in `hero-signal.tsx` still
  describes a reduced-motion frame that no longer exists.
- **Sector pages** (`/sector-rotation`, `/ratio-relevance`): their own palette
  (`#00ff88`, Tailwind red, blue and cyan, white text, an 11-color sector map),
  rounded corners, neon tool boxes that scale on hover and a pulsing "MORE"
  label, side-stripe boxes, and a looping glitch title effect on ratio-relevance.
- **Account, reset-password and legal pages:** a plain `h1`, rounded `bg-card`
  cards and white text instead of the inner page header.
- **Sectors link:** the navbar points to `/ratio-relevance`, the footer to
  `/sector-rotation`.

## Token contract

Raw HSL triplets and existing variables (`--background`, `--primary`, `--accent`,
`--phos-h`, `--tube-h`, and related names), `[data-phosphor]` themes and
`@theme inline` mappings remain compatible. Beam tokens are additive. Legacy
utility classes in `index.css` stay while something uses them; many no longer
have any user (`glitch-*`, `crt-*`, `diamond-*`, `matrix-*`, `terminal-*`,
`kf-cta`, `kf-wordmark`, `fl-zoom`, `ascii-heading`) and can be deleted.
