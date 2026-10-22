// Groups for the Alerts ticker picker. The picker shows whatever the server
// publishes (/api/watchlist universe: the engine's curated list plus tickers
// people add from the charts page), so anything not listed here lands in
// "Other" and shows its code alone. A short name is given only where it is
// certain; an unknown fund shows its code rather than a guessed name.

export type TickerGroup = { id: string; label: string; symbols: string[] };

const GROUPS: ReadonlyArray<{ id: string; label: string; symbols: readonly string[] }> = [
  { id: "indexes", label: "Market indexes", symbols: ["SPY", "QQQ", "IWM", "VXUS"] },
  { id: "stocks", label: "Stocks", symbols: ["AAPL", "MSFT", "NVDA", "AMZN", "TSLA"] },
  { id: "themes", label: "Sectors and themes", symbols: ["SMH", "XLE", "ITA", "XTL", "QTUM", "DRAM", "PINK"] },
  { id: "hedges", label: "Bonds, gold and hedges", symbols: ["SHY", "TLT", "CLOZ", "GLD", "SH", "VIX"] },
];

export const TICKER_NAMES: Readonly<Record<string, string>> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  IWM: "Small caps",
  VXUS: "Stocks outside the US",
  AAPL: "Apple",
  MSFT: "Microsoft",
  NVDA: "Nvidia",
  AMZN: "Amazon",
  TSLA: "Tesla",
  SMH: "Chip makers",
  XLE: "Energy",
  ITA: "Aerospace and defense",
  XTL: "Telecom",
  QTUM: "Quantum computing",
  SHY: "Short-term Treasuries",
  TLT: "Long-term Treasuries",
  GLD: "Gold",
  SH: "Short S&P 500",
  VIX: "Volatility index",
};

// Splits the published universe into the groups above, in their order, then
// "Other" for the rest; empty groups are dropped.
export function groupTickers(universe: readonly string[]): TickerGroup[] {
  const remaining = new Set(universe);
  const groups: TickerGroup[] = [];
  for (const group of GROUPS) {
    const symbols = group.symbols.filter((symbol) => remaining.has(symbol));
    symbols.forEach((symbol) => remaining.delete(symbol));
    if (symbols.length) groups.push({ id: group.id, label: group.label, symbols });
  }
  const other = universe.filter((symbol) => remaining.has(symbol));
  if (other.length) groups.push({ id: "other", label: "Other", symbols: other });
  return groups;
}
