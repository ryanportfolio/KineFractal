// Versioned Terms-of-Service acceptance (platform/P2-DESIGN.md).
// Bump TOS_VERSION whenever the terms/disclaimer content changes materially —
// every user must re-accept before their alerts resume (server-enforced in
// /api/alerts/prefs; the worker fan-out also filters on the CURRENT version).

export const TOS_VERSION = "2026-07-11";

// Shown in the acceptance modal and on /legal/disclaimer. Plain-language summary —
// the load-bearing compliance lines (not-investment-advice + CFTC 4.41).
export const TOS_POINTS: string[] = [
  "KineFractal is an educational and informational tool. Nothing on this site or in its emails is investment advice, a recommendation, or an offer to buy or sell any security.",
  "No client or adviser relationship is created by using this site or enabling alerts. Consult a licensed financial adviser before making investment decisions.",
  "Backtest and simulated figures are HYPOTHETICAL. CFTC Rule 4.41: hypothetical or simulated performance results have inherent limitations; no representation is made that any account will achieve profits or losses similar to those shown. Simulated results do not represent actual trading and may under- or over-compensate for market factors.",
  "Past performance does not guarantee future results. Markets involve risk of loss.",
  "Signals and alerts are published on a fixed schedule, identical for every recipient. Watchlists and alert settings only filter generally-available content — nothing is personalized advice.",
  "Alert delivery is best-effort. No guarantee of accuracy, availability, or timeliness. Market data is provided as-is from third-party sources.",
  "This service never connects to your brokerage account and never executes trades on your behalf.",
];
