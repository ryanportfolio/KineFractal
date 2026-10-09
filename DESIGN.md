# DESIGN.md — THE SIGNAL

Kine Fractal behaves like a single-beam storage oscilloscope. Charts, headlines
and brand moments are phosphor traces that draw, persist and decay. A scope has one
beam, so only one section earns active motion at a time. Restraint is part of the
instrument, not a decorative preference.

The token source of truth is `client/src/index.css`. This file records design and
copy intent.

## The beam ramp

Color represents beam energy. A fresh trace runs from a white-hot core through the
selected phosphor hue as it decays. All five stops derive from
`--phos-h`/`--phos-s`, so emerald, amber and ice tube themes remain coherent.

| token | role |
|---|---|
| `--beam-core` | electron spot; brief flashes only |
| `--beam-hot` | newest trace, active headline, primary result |
| `--beam-mid` | default text and data |
| `--beam-dim` | secondary copy and benchmark traces |
| `--beam-ghost` | graticules, rules and etched labels |

- The background is unlit phosphor, not pure black.
- Homepage sections use darkness and graticule rules instead of glass panels.
- Amber is reserved for fear, drawdown, sell/caution states or a crossed buy line.
- Benchmark traces are dimmer than strategy traces and may be dashed.
- Keep no more than three highly luminous objects in one viewport.

## Typography

IBM Plex Mono is the tube's voice for body copy, data, labels, navigation and the
footer. Etched labels are small, tracked and dim. Labels must still be plain enough
to understand without internal strategy vocabulary.

Headlines use the single-stroke glyph set in
`client/src/lib/trace-font.ts`, rendered as SVG polylines with a hidden text twin
for accessibility. Orbitron and Space Grotesk remain legacy inner-page fonts, not
homepage fonts.

## One-beam motion

`client/src/lib/beam-scheduler.ts` grants motion to the section nearest the
viewport center. Revoked sections stop their animation and retain their final
composited state. Fast scrolling settles a section immediately. Reduced-motion
mode renders final states without animation.

The persistence engine in `client/src/components/persistence-engine.ts` uses raw
WebGL2 with a static SVG fallback. Keep its existing performance contract: capped
DPR, visibility pause, context-loss recovery, theme-aware uniforms and graceful
quality reduction on slow frames. Pointer deflection affects the composite view,
not the underlying data.

## Homepage movements

The current homepage has six movements, in this order.

### 1. Ignition

The spot ignites, traces the brand figure and settles into an engine-derived SPY
market-history sweep. The wordmark arrives with one sentence:

> buys fear in SPY, QQQ and IWM → trims into strength

There are no channel codes, floor statuses or telemetry readouts beneath the
sentence. First-visit motion is skippable; returning visits settle immediately.

### 2. Year by year

Three fund panels show the number of completed independent calendar years ahead of
buy-and-hold. Copy states the basis before the reader sees the score: each year
starts all cash, has no deposits, uses equal starting capital and dates for both
legs, and ends at year-end. The current partial year is excluded from the count.

Do not substitute continuous full-window returns, drawdowns or trade counts here.

### 3. SPY v4.6 Strategy

The SPY v4.6 monthly return grid shows strategy percentages. Each monthly number
sits on a faint tint (beam for gain, amber for loss); the number carries the
reading, the tint only hints at sign and size. Its final columns compare each
independent strategy year with buy-and-hold: a solid strategy bar over a dashed
buy-and-hold bar on one shared scale, then strategy %, buy-and-hold % and the
edge in percentage points (pp). Each year is a button; the selected year fills a
readout with its edge in pp and strategy vs buy-and-hold %, stated as one
calendar year, not an average. State the independent annual basis, identify
partial periods and keep account dollars out.

### 4. How it buys / How it sells

Each fund gets its own fear rail, all on one shared 0-100 percentile scale. The
buy line is labeled above the rail and fear today below it, so the two labels
never share a row. Show `fear now`, `buy line`, `minimum` and `maximum` in
percentile or percent-of-account terms. State whether the buy line is crossed or
how many percentile points remain. Explain that crossing the line is only the
first check: cooldown, protection, regime and available cash can still block a
buy.

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

This is a SPY v4.6 full-history backtest viewed through a selected episode. Label
it as simulated and state the next-open fill assumption. The explanation may walk
through fear buys, trims, recycle and protection, but must not imply QQQ and IWM
share SPY's exact rules.

Below the replay, the five rules run as a cycle wheel: gauge, buy, trim, exit,
recycle, then back to the buy. Each station is a button; the selected one opens
a when / then / limits panel with its key numbers, plus a SPY / QQQ / IWM switch.
Buy line and order-size range are live; other numbers are deployed preset facts.
With QQQ or IWM selected, SPY-only rules are labeled as SPY settings, never shown
as that fund's own. There is no separate temperaments block.

### 6. The record

The record has two visibly separate panels:

1. **Latest EOD decision**: closed-session signal facts for deployed cells, one
   row per fund. Quoted ETF prices may appear and must be identified as market
   quotes, not account values. A queued intent is still not an executed broker
   order.
2. **Recent simulated activity**: the latest SPY v4.6 full-history backtest
   events. A timeline puts one tick per fill on a date axis, buys up and sells
   down; tick height is order size as % of the simulated account. Single-line
   rows follow. Buy and sell size appears as percent of simulated account; sell
   rows may show sold-lot return. No account-dependent dollar P&L or notional
   appears.

The evidence stamp is explicit:

`BACKTEST · SPY DAILY · V4.6 · SIMULATED NEXT-OPEN FILLS`

## Chrome

- **Navbar:** one compact bar, traced wordmark, active
  cursor segment and optional current fear readout. Avoid a second status tier.
- **Footer:** a static calibration plate with one low-energy breathing dot.
- **CRT tube:** global vignette, corner glare and slow scan drift. Flicker is a
  one-shot event, not a loop.
- **Command drawer:** a scope control panel. Its report and trade output follows
  the same percentage-only and simulation-label rules as visible pages.

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

## Motion laws

- Use the `cubic-bezier(0.16,1,0.3,1)` family. No bounce except a stamp.
- No two canvases animate simultaneously; DOM raster scans also consume the beam.
- Idle motion is limited to the hero's low-energy sweep, one footer dot and any
  restrained current-state rail motion.
- Pause work off-screen and while `document.hidden`.
- Do not branch on `prefers-reduced-motion`. Every visitor gets the same full
  motion (owner call, 2026-08-02); never reintroduce a reduced-motion path.

## Bans

- No gradient text, side-stripe card language, fourth hue, homepage glass cards or
  competing per-widget CRT effects.
- No fabricated numeric data as texture. Plotted values come from `board.json`, a
  report artifact, the EOD signal artifact or another explicitly named source.
- No constant glitch or flicker loops.
- No unexplained chart. If the comparison, basis or unit cannot be stated in one
  short paragraph, redesign the visual before shipping it.
- No account-scale dollar gains or losses on any public route.

## Token contract

Raw HSL triplets and existing variables (`--background`, `--primary`, `--accent`,
`--phos-h`, `--tube-h`, and related names), `[data-phosphor]` themes,
`@theme inline` mappings and legacy utility class names remain compatible. Beam
tokens are additive.
