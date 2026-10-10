# PRODUCT.md — Kine Fractal Terminal

register: brand

## What this is

Kine Fractal Terminal (kinefractal) is the public face of **FearLab / Range**: a
local Python research engine and end-of-day decision layer for SPY, QQQ and IWM.
The strategy buys into fear, trims into strength and can reduce risk when a
deployed protection rule calls for it.

The website is an instrument panel for the engine. It presents two different
kinds of evidence, and it must keep them visibly separate:

- **Actual EOD decisions** come from the latest closed-session signal artifact.
  They can include the fund's quoted market price. They are not broker fills.
- **Backtest results and fills** are simulated. Current reports model
  hypothetical next-open fills and must say so wherever fill-level evidence is
  shown.

The site is not an execution interface. Paper orders require separate human
authorization and are sized from the broker account. Real-money execution is not
the current path.

## Users

- Curious traders and quants arriving from a portfolio or social link.
- Technical evaluators using the site as a craft and engineering sample.
- Returning readers checking the EOD board and detailed lab reports.

They are numerate and skeptical of marketing language. They want to know what a
number measures, when the data ended and whether an event is actual or simulated.

## Brand voice

**Phosphor** — light emitted from a dark tube, not painted on.

**Instrument** — calibrated, labeled and engineered.

**Honest** — measurement basis and evidence type stated plainly.

The voice is terse and technical, but understandable without repository context.
Use concrete labels such as `buy line`, `percent of account`, `percentage-point
edge`, `latest EOD decision` and `simulated next-open fill`. Avoid unexplained
channel codes, internal readiness shorthand and strategy folklore.

The homepage introduction stays exactly:

> buys fear in SPY, QQQ and IWM → trims into strength

## Evidence and capital bases

These measurements answer different questions. Never blend them into one story.

### Independent calendar years

The public year-by-year record uses independent annual backtests. Each year:

- starts all cash on its first available trading session;
- uses equal fixed internal capital, with no deposits;
- ends on that calendar year's final available session;
- compares strategy and buy-and-hold over the same dates and starting capital;
- may use pre-start history only to warm indicators, with no earlier money,
  positions or trades carried in.

The current partial year is labeled or excluded according to the surface. The
internal fixed capital is a measuring unit, not a funding recommendation.

### Start-year cohorts

`START ANY YEAR` asks a different question. Every SPY daily cohort starts all
cash in its named year and continues through the latest closed bar. Cohorts use
equal fixed internal capital, no deposits and no leverage. Strategy and
buy-and-hold share the same dates and starting capital. Earlier history warms
indicators only; it does not contribute capital, positions or fills.

These rows are contribution-free cumulative returns and percentage-point edge.
They do not stop at the starting year's end.

### Continuous reports

Full-history lab reports remain a separate continuous simulation. That simulation
has its own fixed initial-capital and monthly-contribution schedule, applied to
both strategy and benchmark. It is report plumbing, not the live strategy's
funding plan and not the basis of the independent annual or start-cohort sections.

The public UI removes the account scale from this model. Show account-dependent
gains, losses, equity, orders and attribution only as percentages,
percentage-point contributions, ratios or counts. A quoted ETF market price may
remain a price because it describes the security, not the simulated account.

## Homepage structure

The homepage is a showcase surface, organized in this order:

1. **Ignition** — the brand trace and the exact introduction above; no channel
   telemetry beneath it.
2. **Year by year** — completed independent calendar years ahead of buy-and-hold
   for SPY, QQQ and IWM, with the annual basis stated.
3. **SPY strategy** — the deployed SPY variant's monthly strategy returns, with annual strategy and
   buy-and-hold columns and partial-year status made clear.
4. **How it buys / How it sells** — separate per-fund fear rails, buy lines and
   percentage-of-account sizing; then plain-language trim and protection rules.
5. **SPY, step by step** — a labeled SPY backtest replay using simulated
   next-open fills, named by the variant it was recorded under. QQQ and IWM have different thresholds and exits.
6. **The record** — actual latest EOD decisions first, then a separately labeled
   list of recent simulated SPY backtest activity.

The hidden storage-sweep prototype is not part of the current homepage.

## Design lane

**Literal terminal-native.** The site is one CRT instrument, not a collection of
glowing widgets. Monospace type, phosphor traces, restrained animation and explicit
calibration labels belong to the product. Generic SaaS cards, crypto-bro neon,
editorial display styling and TradingView-clone chrome do not.

The hero demonstrates market movement with engine-derived history. The remaining
sections should make the strategy legible: the reader should understand the
question each chart answers before interpreting its shape.

## Copy and data invariants

Future changes must preserve these rules:

1. Never call a backtest fill, trade or P&L actual, live or real. Use `simulated`
   and, where relevant, `next-open`.
2. Never present EOD decisions as executed orders. Name the artifact and its
   closed-session date.
3. Never summarize every public comparison with one generic cash-flow-equivalence
   claim. Name the applicable basis: independent year, start cohort or continuous
   report.
4. Never imply recurring deposits are part of the live strategy. The continuous
   report's contribution schedule is a simulation assumption only.
5. Never imply one annual run inherits money or positions from another.
   Independent years restart all cash and end at year-end.
6. Never show account-dependent dollar gains or losses on public pages. Use `%`,
   `pp`, ratios or counts. ETF market quotes may retain their currency symbol.
7. Never merge actual EOD decisions and simulated replay activity into one
   unlabeled ledger.
8. Never reduce three deployed fund configurations to one universal rulebook.
   State when a section describes one SPY variant specifically, and name it
   from data, not hand-written copy.
9. Always identify partial periods and the latest data date where they can affect
   interpretation.
10. Decorative behavior may be atmospheric, but numeric claims and plotted data
    must come from a named artifact or report.

## Strategic principles

1. **Honesty is the differentiator.** Provenance, basis and simulation status are
   part of the content, not fine print.
2. **One machine.** Effects come from the tube—scanlines, vignette, persistence
   and beam energy—not from per-widget decoration.
3. **Clarity before spectacle.** A visual earns its place only when its question,
   axes or comparison can be understood in plain language.
4. **Performance is part of honesty.** Motion should remain smooth and pause
   off-screen. The site does not branch on reduced-motion preferences — every
   visitor sees the same full motion (owner call, 2026-08-02).
