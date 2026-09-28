// Types - nullable fields for decoupled metric handling
export interface FundamentalData {
  date: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  fcf: number | null;
  grossProfit: number | null;
  // Balance Sheet fields for Capital Allocation analysis
  sharesOutstanding: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  cashAndEquivalents: number | null;
  // Marketable Securities and Investments
  investmentsCurrent: number | null;
  // Debt fields (specific debt instead of total liabilities for true solvency analysis)
  totalDebt: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  // Pre-calculated Net Debt = Total Debt - (Cash + Marketable Securities)
  netDebt: number | null;
}

// Capital Allocation analysis result
export interface CapitalAllocation {
  shareCountChangeYoY: number | null;  // Negative = Buybacks (GOOD), Positive = Dilution (BAD)
  roicTrendYoY: number | null;         // Change in ROIC year-over-year
  netDebtChangeYoY: number | null;     // Change in Net Debt year-over-year (negative = deleveraging)
  verdict: "Aggressive Buyback" | "Dilutive" | "High Efficiency" | "Capital Destroyer" | "Neutral" | "Insufficient Data";
}

// Backwards compatible - handles both number and null values
export function normalizeValue(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (val === 0) return 0; // 0 is a valid value
  return val;
}

export interface GrowthRate {
  qoq: number;
  yoy: number;
}

export interface Acceleration {
  qoq: number | null; // Current QoQ - Previous QoQ (null if insufficient data)
  yoy: number | null; // Current YoY - Previous YoY (null if insufficient data)
}

export interface PriceFundamentalDivergence {
  type: "BULLISH" | "BEARISH" | "ALIGNED" | "UNKNOWN";
  description: string;
  revenueAccel: number | null;
  priceChange3m: number | null;
  strength: number; // 0-100, how strong the divergence signal is
}

export interface LinRegDeviation {
  value: number; // Deviation percentage from 20-day trendline
  signal: "Overextended" | "Oversold" | "Neutral"; // Signal type
  expected: number; // Expected price on trendline
  actual: number; // Actual current price
}

export interface CompanyAnalysis {
  type: "COMPANY";
  ticker: string;
  regime: "POWER" | "TREND" | "WARN" | "WATCH";
  inflectionScore: number;
  revenueAcceleration: Acceleration;
  marginAcceleration: Acceleration;
  earningsAcceleration: Acceleration;
  capitalAllocation: CapitalAllocation; // Replaces fcfTrend - uses Balance Sheet data
  priceDivergence?: PriceFundamentalDivergence;
  linRegDeviation?: LinRegDeviation;
  latestPrice?: number; // Latest closing price from Tiingo
  confidence: number;
  isMock?: boolean;
}

export interface ETFAnalysis {
  type: "ETF";
  ticker: string;
  priceVsSectorMomentum: number;
  sectorTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  divergenceStrength: number;
  roc10?: number; // 10-day Rate of Change (short-term velocity)
  roc20?: number; // 20-day Rate of Change
  roc60?: number; // 60-day Rate of Change (medium-term trend)
  priceAcceleration: number;
  volumeTrend: number; // RVOL ratio (3-day avg / 20-day avg)
  volumeConviction: "HIGH CONVICTION BUY" | "HIGH CONVICTION SELL" | "NORMAL" | "LOW INTEREST"; // Based on RVOL + price direction
  linRegDeviation?: LinRegDeviation;
  latestPrice?: number; // Latest closing price from Tiingo
  confidence: number;
  isMock?: boolean;
}

export type DivergenceAnalysis = CompanyAnalysis | ETFAnalysis;

// Utility: Detect if ticker is likely an ETF
export function isLikelyETF(ticker: string): boolean {
  // Known large-cap companies (NOT ETFs)
  const knownCompanies = new Set([
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'BERKB',
    'JPM', 'JNJ', 'V', 'WMT', 'VISA', 'MA', 'PG', 'UNH', 'HD', 'DIS',
    'ADBE', 'NFLX', 'INTC', 'AMD', 'IBM', 'CSCO', 'ORCL', 'QCOM', 'CRM',
  ]);
  
  // If it's a known company, it's NOT an ETF
  if (knownCompanies.has(ticker.toUpperCase())) {
    return false;
  }
  
  const etfPatterns = [
    /^(SPY|QQQ|IWM|DIA|VTI|VOO|VUG|VTV|VEA|VXUS|AGG|BND|TLT|SHY|GLD|SLV|DBC|USO|XLE|XLF|XLK|XLV|XLY|XLRE|XLI|XLP|EEM|VWO|EFA|GEM|TUR|RSX|FXI|INDA|EPOL|FLRT|IEMG|VCIT|VGIT|PCY|BNDX|VGSH|BSV)$/,
  ];
  
  // Only match explicit ETF patterns
  return etfPatterns.some(p => p.test(ticker));
}

// Mean Reversion Signal - Linear Regression Deviation with Z-Score (Standard Deviations)
export function calculateLinRegDeviation(history: Array<{ close: number }>): LinRegDeviation | null {
  const period = 20;
  if (!history || history.length < period) return null;

  // Extract last 20 closing prices, reverse so index 0 = oldest, 19 = today
  const y_values = history.slice(0, period).map(h => h.close).reverse();

  // Perform Linear Regression (Least Squares Method)
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = period;

  for (let x = 0; x < n; x++) {
    const y = y_values[x];
    sumX += x;
    sumY += y;
    sumXY += (x * y);
    sumXX += (x * x);
  }

  // Calculate Slope (m) and Intercept (b)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate residuals (distance from each price to the trendline)
  const residuals: number[] = [];
  for (let x = 0; x < n; x++) {
    const expectedY = slope * x + intercept;
    const residual = y_values[x] - expectedY;
    residuals.push(residual);
  }

  // Calculate standard deviation of residuals
  const meanResidual = residuals.reduce((a, b) => a + b, 0) / n;
  const variance = residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) / n;
  const stdDevResiduals = Math.sqrt(variance);

  // Calculate Z-Score at today (x = n-1)
  const x_today = n - 1;
  const expectedPrice = (slope * x_today) + intercept;
  const actualPrice = y_values[x_today];
  const residualToday = actualPrice - expectedPrice;
  const zScore = stdDevResiduals !== 0 ? residualToday / stdDevResiduals : 0;

  // Determine Signal based on Z-Score thresholds (±2.0 sigma)
  let signal: "Overextended" | "Oversold" | "Neutral" = "Neutral";
  if (zScore > 2.0) signal = "Overextended";
  if (zScore < -2.0) signal = "Oversold";

  return {
    value: parseFloat(zScore.toFixed(2)),
    signal,
    expected: parseFloat(expectedPrice.toFixed(2)),
    actual: parseFloat(actualPrice.toFixed(2))
  };
}

// Company Analysis Engine
export class CompanyDivergenceEngine {
  
  /**
   * Calculate growth acceleration for a metric across quarters
   * Returns the delta of deltas: how much did the growth rate itself change
   * 
   * For proper YoY calculation, we need 6 data points (1.5 years):
   * - current (Q0)
   * - previous (Q-1)
   * - sameQuarterLastYear (Q-4, 4 quarters back from current)
   * - sameQuarterLastYearPrev (Q-5, 4 quarters back from previous)
   * - quarterTwoAgo (Q-2, for QoQ baseline)
   */
  static calculateAcceleration(
    current: number,
    previous: number,
    sameQuarterLastYear: number,
    sameQuarterLastYearPrev: number,
    quarterTwoAgo?: number
  ): Acceleration {
    // Use quarterTwoAgo if provided, otherwise fallback to sameQuarterLastYearPrev
    const q2Ago = quarterTwoAgo ?? sameQuarterLastYearPrev;

    // QoQ: Current quarter vs previous quarter
    const currentQoQ = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
    const previousQoQ = q2Ago !== 0 ? ((previous - q2Ago) / Math.abs(q2Ago)) * 100 : 0;

    // YoY: Current quarter vs same quarter last year (4 quarters apart)
    const currentYoY = sameQuarterLastYear !== 0 ? ((current - sameQuarterLastYear) / Math.abs(sameQuarterLastYear)) * 100 : 0;
    const previousYoY = sameQuarterLastYearPrev !== 0 ? ((previous - sameQuarterLastYearPrev) / Math.abs(sameQuarterLastYearPrev)) * 100 : 0;

    return {
      qoq: currentQoQ - previousQoQ, // Change in quarter-over-quarter growth
      yoy: currentYoY - previousYoY, // Change in year-over-year growth
    };
  }

  /**
   * Extract metric values from fundamentals, filtering out nulls
   * Returns array of {date, value} pairs sorted chronologically (OLDEST first)
   * This is critical: API returns newest-first, but calculation expects oldest-first
   */
  static extractMetric(
    fundamentals: FundamentalData[],
    getter: (f: FundamentalData) => number | null
  ): { date: string; value: number }[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return fundamentals
      .map(f => ({ date: f.date, value: getter(f) }))
      .filter((x): x is { date: string; value: number } => {
        // Only include completed quarters (date <= today)
        const qDate = new Date(x.date);
        qDate.setHours(0, 0, 0, 0);
        return x.value !== null && qDate <= today;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort OLDEST first
  }

  /**
   * Calculate acceleration for a single metric independently
   * Uses GROWTH RATE formula: ((value - prev) / prev) * 100
   * Returns null if insufficient data for that specific metric
   */
  static calculateMetricAcceleration(
    metricData: { date: string; value: number }[]
  ): Acceleration {
    // Need at least 3 data points for QoQ acceleration (Q0, Q-1, Q-2)
    if (metricData.length < 3) {
      return { qoq: null, yoy: null };
    }

    const n = metricData.length;
    const q0 = metricData[n - 1].value;  // Current
    const q1 = metricData[n - 2].value;  // Previous
    const q2 = metricData[n - 3].value;  // 2 quarters ago

    // QoQ acceleration
    const currentQoQ = q1 !== 0 ? ((q0 - q1) / Math.abs(q1)) * 100 : 0;
    const previousQoQ = q2 !== 0 ? ((q1 - q2) / Math.abs(q2)) * 100 : 0;
    const qoqAccel = currentQoQ - previousQoQ;

    // YoY acceleration requires 6 data points (Q0, Q-1, Q-4, Q-5)
    let yoyAccel: number | null = null;
    if (n >= 6) {
      const q4 = metricData[n - 5].value;  // Same quarter last year
      const q5 = metricData[n - 6].value;  // Same quarter last year, previous
      
      const currentYoY = q4 !== 0 ? ((q0 - q4) / Math.abs(q4)) * 100 : 0;
      const previousYoY = q5 !== 0 ? ((q1 - q5) / Math.abs(q5)) * 100 : 0;
      yoyAccel = currentYoY - previousYoY;
    }

    return { qoq: qoqAccel, yoy: yoyAccel };
  }

  /**
   * Calculate margin acceleration using ABSOLUTE DELTA (percentage point changes)
   * For margins (which are already percentages), we use absolute changes, not growth rates
   * Formula: (current_margin - prev_margin) - (prev_margin - prior_margin)
   */
  static calculateMarginAcceleration(
    marginData: { date: string; value: number }[]
  ): Acceleration {
    // Need at least 3 data points for QoQ acceleration (Q0, Q-1, Q-2)
    if (marginData.length < 3) {
      return { qoq: null, yoy: null };
    }

    const n = marginData.length;
    const q0 = marginData[n - 1].value;  // Current (NEWEST)
    const q1 = marginData[n - 2].value;  // Previous
    const q2 = marginData[n - 3].value;  // 2 quarters ago

    // QoQ acceleration: use ABSOLUTE DELTA (percentage points)
    const currentMarginDelta = q0 - q1;
    const prevMarginDelta = q1 - q2;
    const qoqAccel = currentMarginDelta - prevMarginDelta;

    // YoY acceleration requires 6 data points (Q0, Q-1, Q-4, Q-5)
    let yoyAccel: number | null = null;
    if (n >= 6) {
      const q4 = marginData[n - 5].value;  // Same quarter last year
      const q5 = marginData[n - 6].value;  // Same quarter last year, previous
      
      const currentYoYDelta = q0 - q4;
      const prevYoYDelta = q1 - q5;
      yoyAccel = currentYoYDelta - prevYoYDelta;
    }

    return { qoq: qoqAccel, yoy: yoyAccel };
  }

  /**
   * Calculate EBIT Margin Expansion Acceleration (YoY-focused)
   * This measures if the company's profit margins are expanding faster than before
   * 
   * Formula:
   * Step A: Calculate EBIT Margin for 4 key periods (OpIncome / Revenue * 100)
   * Step B: Calculate YoY Margin Expansion for current and prior quarters
   * Step C: Acceleration = Current_Expansion - Prior_Expansion
   * 
   * Requires 6 data points minimum for YoY calculation
   */
  static calculateEBITMarginAcceleration(
    fundamentals: FundamentalData[],
    ticker: string
  ): Acceleration {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filter to only completed quarters with valid revenue and operatingIncome data
    const validQuarters = fundamentals
      .filter(f => {
        const qDate = new Date(f.date);
        qDate.setHours(0, 0, 0, 0);
        return f.revenue !== null && f.operatingIncome !== null && f.revenue !== 0 && qDate <= today;
      })
      .map(f => ({
        date: f.date,
        revenue: f.revenue!,
        operatingIncome: f.operatingIncome!,
        ebitMargin: (f.operatingIncome! / f.revenue!) * 100
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort OLDEST first

    console.log(`\n[${"=".repeat(60)}]`);
    console.log(`[EBIT MARGIN ACCEL] Starting calculation for ${ticker}`);
    console.log(`  Valid quarters with OpIncome & Revenue: ${validQuarters.length}`);
    
    // Need at least 6 quarters for proper YoY acceleration (Q0, Q1, Q0_LY, Q1_LY)
    if (validQuarters.length < 6) {
      console.log(`  SKIPPED: Only ${validQuarters.length} quarters (need 6+ for YoY)`);
      console.log(`[${"=".repeat(60)}]\n`);
      return { qoq: null, yoy: null };
    }

    const n = validQuarters.length;
    
    // Extract the 4 key periods (using index from end since sorted oldest-first)
    const q0 = validQuarters[n - 1];      // Current quarter (NEWEST)
    const q1 = validQuarters[n - 2];      // Previous quarter
    const q0_ly = validQuarters[n - 5];   // Same quarter last year (4 quarters back from Q0)
    const q1_ly = validQuarters[n - 6];   // Same quarter last year for Q1 (5 quarters back from Q0)

    console.log(`\n  [STEP A] EBIT Margin Calculation for 4 Key Periods:`);
    console.log(`  ┌─────────────────────────────────────────────────────────────────┐`);
    console.log(`  │ Q0 (Current):     ${q0.date} │ OpIncome: $${q0.operatingIncome.toLocaleString().padStart(12)} │ Rev: $${q0.revenue.toLocaleString().padStart(12)} │ Margin: ${q0.ebitMargin.toFixed(2).padStart(6)}% │`);
    console.log(`  │ Q0_LY (Last Yr):  ${q0_ly.date} │ OpIncome: $${q0_ly.operatingIncome.toLocaleString().padStart(12)} │ Rev: $${q0_ly.revenue.toLocaleString().padStart(12)} │ Margin: ${q0_ly.ebitMargin.toFixed(2).padStart(6)}% │`);
    console.log(`  │ Q1 (Prior):       ${q1.date} │ OpIncome: $${q1.operatingIncome.toLocaleString().padStart(12)} │ Rev: $${q1.revenue.toLocaleString().padStart(12)} │ Margin: ${q1.ebitMargin.toFixed(2).padStart(6)}% │`);
    console.log(`  │ Q1_LY (Prior LY): ${q1_ly.date} │ OpIncome: $${q1_ly.operatingIncome.toLocaleString().padStart(12)} │ Rev: $${q1_ly.revenue.toLocaleString().padStart(12)} │ Margin: ${q1_ly.ebitMargin.toFixed(2).padStart(6)}% │`);
    console.log(`  └─────────────────────────────────────────────────────────────────┘`);

    // Step B: Calculate YoY Margin Expansion for both quarters
    const currentExpansion = q0.ebitMargin - q0_ly.ebitMargin;
    const priorExpansion = q1.ebitMargin - q1_ly.ebitMargin;

    console.log(`\n  [STEP B] YoY Margin Expansion:`);
    console.log(`  Current Expansion = Q0 Margin - Q0_LY Margin`);
    console.log(`                    = ${q0.ebitMargin.toFixed(2)}% - ${q0_ly.ebitMargin.toFixed(2)}%`);
    console.log(`                    = ${currentExpansion > 0 ? '+' : ''}${currentExpansion.toFixed(2)}% ← Current YoY Expansion`);
    console.log(`  Prior Expansion   = Q1 Margin - Q1_LY Margin`);
    console.log(`                    = ${q1.ebitMargin.toFixed(2)}% - ${q1_ly.ebitMargin.toFixed(2)}%`);
    console.log(`                    = ${priorExpansion > 0 ? '+' : ''}${priorExpansion.toFixed(2)}% ← Prior YoY Expansion`);

    // Step C: Calculate Acceleration
    const yoyAccel = currentExpansion - priorExpansion;

    console.log(`\n  [STEP C] EBIT Margin Acceleration (YoY):`);
    console.log(`  Acceleration = Current Expansion - Prior Expansion`);
    console.log(`               = ${currentExpansion.toFixed(2)}% - ${priorExpansion.toFixed(2)}%`);
    console.log(`               = ${yoyAccel > 0 ? '+' : ''}${yoyAccel.toFixed(2)}% ← EBIT MARGIN ACCEL (YoY)`);
    console.log(`[${"=".repeat(60)}]\n`);

    // For QoQ, we calculate margin change acceleration (simpler 3-quarter version)
    let qoqAccel: number | null = null;
    if (validQuarters.length >= 3) {
      const q2 = validQuarters[n - 3];  // 2 quarters ago
      const currentQoQDelta = q0.ebitMargin - q1.ebitMargin;
      const priorQoQDelta = q1.ebitMargin - q2.ebitMargin;
      qoqAccel = currentQoQDelta - priorQoQDelta;
    }

    return { qoq: qoqAccel, yoy: yoyAccel };
  }

  /**
   * Analyze Capital Allocation using Balance Sheet "Resultant" metrics
   * Since Cash Flow data (CapEx/Buybacks) is often missing, we use:
   * - sharesOutstanding: Detects buybacks vs dilution
   * - ROIC Proxy: Operating Income / (Total Assets - Cash)
   * - Net Debt: Total Liabilities - Cash
   */
  static analyzeCapitalAllocation(
    fundamentals: FundamentalData[],
    ticker: string
  ): CapitalAllocation {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // RELAXED FILTER: Only filter by date, allow partial data through for debugging
    // This lets us see 0% instead of NaN when a field is missing
    const validQuarters = fundamentals
      .filter(f => {
        const qDate = new Date(f.date);
        qDate.setHours(0, 0, 0, 0);
        return qDate <= today && f.date !== undefined;
      })
      .map(f => ({
        date: f.date,
        sharesOutstanding: f.sharesOutstanding ?? 0,  // Default to 0 if null
        totalAssets: f.totalAssets ?? 0,
        totalLiabilities: f.totalLiabilities ?? 0,
        cashAndEquivalents: f.cashAndEquivalents ?? 0,
        operatingIncome: f.operatingIncome ?? 0,
        // Debt fields for true solvency analysis (avoids pension charges inflating liabilities)
        totalDebt: f.totalDebt ?? 0,
        shortTermDebt: f.shortTermDebt ?? 0,
        longTermDebt: f.longTermDebt ?? 0,
        // Marketable securities + pre-computed net debt: calcNetDebt's Priority-1
        // fast path reads these; dropping them here made that path dead code
        investmentsCurrent: f.investmentsCurrent ?? null,
        netDebt: f.netDebt ?? null
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort OLDEST first

    console.log(`\n[${"=".repeat(60)}]`);
    console.log(`[CAPITAL ALLOCATION] Starting analysis for ${ticker}`);
    console.log(`  Valid quarters with Balance Sheet data: ${validQuarters.length}`);

    // Need at least 5 quarters for proper YoY analysis (Q0, Q0_LY)
    if (validQuarters.length < 5) {
      console.log(`  INSUFFICIENT DATA: Only ${validQuarters.length} quarters (need 5+ for YoY)`);
      console.log(`[${"=".repeat(60)}]\n`);
      return {
        shareCountChangeYoY: null,
        roicTrendYoY: null,
        netDebtChangeYoY: null,
        verdict: "Insufficient Data"
      };
    }

    const n = validQuarters.length;
    const q0 = validQuarters[n - 1];      // Current quarter (NEWEST)
    const q1 = validQuarters[n - 2];      // Previous quarter
    const q0_ly = validQuarters[n - 5];   // Same quarter last year (4 quarters back)

    // === A. SHARE COUNT VELOCITY (Buyback Signal) ===
    let shareCountChangeYoY: number | null = null;
    if (q0.sharesOutstanding && q0_ly.sharesOutstanding && q0_ly.sharesOutstanding !== 0) {
      shareCountChangeYoY = ((q0.sharesOutstanding - q0_ly.sharesOutstanding) / q0_ly.sharesOutstanding) * 100;
    }

    console.log(`\n  [A] SHARE COUNT VELOCITY (Buyback Signal):`);
    console.log(`      Q0 Shares:    ${q0.sharesOutstanding?.toLocaleString() ?? 'N/A'}`);
    console.log(`      Q0_LY Shares: ${q0_ly.sharesOutstanding?.toLocaleString() ?? 'N/A'}`);
    console.log(`      YoY Change:   ${shareCountChangeYoY !== null ? `${shareCountChangeYoY > 0 ? '+' : ''}${shareCountChangeYoY.toFixed(2)}%` : 'N/A'}`);
    if (shareCountChangeYoY !== null) {
      console.log(`      → ${shareCountChangeYoY < 0 ? '✓ BUYBACKS (shares decreasing)' : '⚠ DILUTION (shares increasing)'}`);
    }

    // === B. ROIC PROXY (Efficiency Signal) ===
    // ROIC = Operating Income / (Total Assets - Cash)
    let roicTrendYoY: number | null = null;
    const calcROIC = (q: typeof q0): number | null => {
      if (q.operatingIncome === null || q.totalAssets === null) return null;
      const investedCapital = q.totalAssets - (q.cashAndEquivalents || 0);
      if (investedCapital <= 0) return null;
      return (q.operatingIncome / investedCapital) * 100;
    };

    const roic_q0 = calcROIC(q0);
    const roic_q0_ly = calcROIC(q0_ly);

    if (roic_q0 !== null && roic_q0_ly !== null) {
      roicTrendYoY = roic_q0 - roic_q0_ly;
    }

    console.log(`\n  [B] ROIC PROXY (Efficiency Signal):`);
    console.log(`      Q0 ROIC:      ${roic_q0 !== null ? `${roic_q0.toFixed(2)}%` : 'N/A'}`);
    console.log(`      Q0_LY ROIC:   ${roic_q0_ly !== null ? `${roic_q0_ly.toFixed(2)}%` : 'N/A'}`);
    console.log(`      YoY Change:   ${roicTrendYoY !== null ? `${roicTrendYoY > 0 ? '+' : ''}${roicTrendYoY.toFixed(2)}%` : 'N/A'}`);
    if (roicTrendYoY !== null) {
      console.log(`      → ${roicTrendYoY > 0 ? '✓ EFFICIENCY IMPROVING' : '⚠ EFFICIENCY DECLINING'}`);
    }

    // === C. NET DEBT HEALTH (Leverage Signal) ===
    // Net Debt = Total Debt - (Cash + Marketable Securities) [pre-calculated by backend]
    // This avoids false alarms from non-debt items like pension charges inflating liabilities
    let netDebtChangeYoY: number | null = null;
    const calcNetDebt = (q: typeof q0): number | null => {
      // Priority 1: Use pre-calculated netDebt if available
      if (q.netDebt !== null && q.netDebt !== undefined) {
        return q.netDebt;
      }
      // Priority 2: Fallback to manual calculation with marketable securities
      if (q.totalDebt && q.totalDebt > 0) {
        const cashAndInv = (q.cashAndEquivalents || 0) + (q.investmentsCurrent || 0);
        return q.totalDebt - cashAndInv;
      }
      // Priority 3: Sum of short-term + long-term debt if available
      if ((q.shortTermDebt || 0) > 0 || (q.longTermDebt || 0) > 0) {
        const grossDebt = (q.shortTermDebt || 0) + (q.longTermDebt || 0);
        const cashAndInv = (q.cashAndEquivalents || 0) + (q.investmentsCurrent || 0);
        return grossDebt - cashAndInv;
      }
      // Priority 4: Fallback to total liabilities (may include non-debt items)
      if (q.totalLiabilities && q.totalLiabilities > 0) {
        const cashAndInv = (q.cashAndEquivalents || 0) + (q.investmentsCurrent || 0);
        return q.totalLiabilities - cashAndInv;
      }
      return null;
    };

    const netDebt_q0 = calcNetDebt(q0);
    const netDebt_q0_ly = calcNetDebt(q0_ly);

    if (netDebt_q0 !== null && netDebt_q0_ly !== null && netDebt_q0_ly !== 0) {
      netDebtChangeYoY = ((netDebt_q0 - netDebt_q0_ly) / Math.abs(netDebt_q0_ly)) * 100;
    }

    console.log(`\n  [C] NET DEBT HEALTH (Leverage Signal):`);
    console.log(`      Q0 Net Debt:    $${netDebt_q0?.toLocaleString() ?? 'N/A'}`);
    console.log(`      Q0_LY Net Debt: $${netDebt_q0_ly?.toLocaleString() ?? 'N/A'}`);
    console.log(`      YoY Change:     ${netDebtChangeYoY !== null ? `${netDebtChangeYoY > 0 ? '+' : ''}${netDebtChangeYoY.toFixed(2)}%` : 'N/A'}`);
    if (netDebtChangeYoY !== null) {
      console.log(`      → ${netDebtChangeYoY < 0 ? '✓ DELEVERAGING' : '⚠ INCREASING LEVERAGE'}`);
    }

    // === D. VERDICT LOGIC ===
    // Tolerant of missing data - derive verdict from whatever metrics are available
    let verdict: CapitalAllocation["verdict"] = "Neutral";

    // Check if we have at least one metric to make a verdict
    const hasAnyMetric = shareCountChangeYoY !== null || roicTrendYoY !== null || netDebtChangeYoY !== null;
    
    if (!hasAnyMetric) {
      verdict = "Insufficient Data";
    } else {
      // Priority rules for verdict (check from most significant to least)
      if (shareCountChangeYoY !== null && shareCountChangeYoY < -2) {
        verdict = "Aggressive Buyback"; // Strong buyback signal
      } else if (shareCountChangeYoY !== null && shareCountChangeYoY > 1) {
        // Dilution detected - check if combined with poor efficiency
        if (roicTrendYoY !== null && roicTrendYoY < 0) {
          verdict = "Capital Destroyer"; // Diluting AND ROIC falling = worst case
        } else {
          verdict = "Dilutive"; // Just diluting, may be acceptable if for growth
        }
      } else if (roicTrendYoY !== null && roicTrendYoY > 1) {
        verdict = "High Efficiency"; // ROIC improving significantly
      }
      // If none of the above trigger, stay "Neutral" (stable capital allocation)
    }

    console.log(`\n  [D] VERDICT: ${verdict}`);
    console.log(`[${"=".repeat(60)}]\n`);

    return {
      shareCountChangeYoY,
      roicTrendYoY,
      netDebtChangeYoY,
      verdict
    };
  }

  static analyzeCompany(
    ticker: string,
    fundamentals: FundamentalData[]
  ): CompanyAnalysis | { error: string } {
    console.log(`\n[${"=".repeat(60)}]`);
    console.log(`[AUDIT] Starting Company Analysis for ${ticker}`);
    console.log(`[AUDIT] Raw API Response Count: ${fundamentals.length} quarters`);
    console.log(`[AUDIT] Raw Data:`, fundamentals.map(f => ({ 
      date: f.date, 
      revenue: f.revenue, 
      operatingIncome: f.operatingIncome,
      netIncome: f.netIncome,
      eps: f.eps,
      fcf: f.fcf
    })));

    // Extract each metric independently - null values are filtered out
    const revenueData = this.extractMetric(fundamentals, f => f.revenue);
    const operatingIncomeData = this.extractMetric(fundamentals, f => f.operatingIncome);
    const epsData = this.extractMetric(fundamentals, f => f.eps);
    const fcfData = this.extractMetric(fundamentals, f => f.fcf);

    // COMPREHENSIVE DEBUG: Revenue Extraction
    console.log(`\n[REVENUE EXTRACTION]`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log(`  Today's date (for filtering): ${today.toISOString().split('T')[0]}`);
    console.log(`  Step 1: Extract revenue from fundamentals`);
    console.log(`  Raw revenue values:`, fundamentals.map(f => {
      const qDate = new Date(f.date);
      qDate.setHours(0, 0, 0, 0);
      const isFuture = qDate > today;
      return { date: f.date, rev: f.revenue, isFuture };
    }));
    console.log(`  Step 2: Filter out nulls/zeros/future dates`);
    console.log(`  Extracted revenue data (${revenueData.length} quarters, OLDEST first):`, revenueData);
    console.log(`  ⚠️ Using LAST 3 COMPLETED QUARTERS for acceleration:`, revenueData.slice(-3));
    
    // Note: operatingIncomeData is now used in EBIT Margin Acceleration calculation (see below)

    // Need at least 3 quarters of REVENUE for basic analysis
    if (revenueData.length < 3) {
      return {
        error: `Insufficient revenue data (${revenueData.length} quarters found, need 3+)`
      };
    }

    // --- DETAILED REVENUE ACCEL CALCULATION AUDIT ---
    const n = revenueData.length;
    const q0 = revenueData[n - 1];  // Current (NEWEST)
    const q1 = revenueData[n - 2];  // Previous
    const q2 = revenueData[n - 3];  // 2 quarters ago
    
    console.log(`\n[REVENUE ACCEL - QoQ CALCULATION]`);
    console.log(`  Data Points (OLDEST to NEWEST):`);
    console.log(`  Q2 (n-3, 2 ago):  ${q2.date} = $${q2.value.toLocaleString()}`);
    console.log(`  Q1 (n-2, prev):   ${q1.date} = $${q1.value.toLocaleString()}`);
    console.log(`  Q0 (n-1, curr):   ${q0.date} = $${q0.value.toLocaleString()}`);
    
    console.log(`\n  Step A: Calculate CURRENT QoQ growth (Q0 vs Q1)`);
    const currentQoQgrowth = q1.value !== 0 ? ((q0.value - q1.value) / Math.abs(q1.value)) * 100 : 0;
    console.log(`    Formula: ((${q0.value} - ${q1.value}) / ${q1.value}) × 100`);
    console.log(`    = (${q0.value - q1.value} / ${q1.value}) × 100`);
    console.log(`    = ${(((q0.value - q1.value) / q1.value)).toFixed(6)} × 100`);
    console.log(`    = ${currentQoQgrowth.toFixed(2)}%`);
    
    console.log(`\n  Step B: Calculate PREVIOUS QoQ growth (Q1 vs Q2)`);
    const prevQoQgrowth = q2.value !== 0 ? ((q1.value - q2.value) / Math.abs(q2.value)) * 100 : 0;
    console.log(`    Formula: ((${q1.value} - ${q2.value}) / ${q2.value}) × 100`);
    console.log(`    = (${q1.value - q2.value} / ${q2.value}) × 100`);
    console.log(`    = ${(((q1.value - q2.value) / q2.value)).toFixed(6)} × 100`);
    console.log(`    = ${prevQoQgrowth.toFixed(2)}%`);
    
    console.log(`\n  Step C: Calculate ACCELERATION (change in growth rate)`);
    const revenueQoQaccel = currentQoQgrowth - prevQoQgrowth;
    console.log(`    Formula: CurrentGrowth - PreviousGrowth`);
    console.log(`    = ${currentQoQgrowth.toFixed(2)}% - ${prevQoQgrowth.toFixed(2)}%`);
    console.log(`    = ${revenueQoQaccel.toFixed(2)}% ← REVENUE ACCEL QoQ`);
    
    // YoY calculation
    console.log(`\n[REVENUE ACCEL - YoY CALCULATION]`);
    let revenueYoYaccel: number | null = null;
    if (n >= 6) {
      const q4 = revenueData[n - 5];  // Same quarter last year (4 quarters back)
      const q5 = revenueData[n - 6];  // Same quarter last year previous
      
      console.log(`  Data Points:`);
      console.log(`  Q5 (n-6, YoY prev):  ${q5.date} = $${q5.value.toLocaleString()}`);
      console.log(`  Q4 (n-5, YoY curr):  ${q4.date} = $${q4.value.toLocaleString()}`);
      console.log(`  Q1 (n-2, prev):      ${q1.date} = $${q1.value.toLocaleString()}`);
      console.log(`  Q0 (n-1, curr):      ${q0.date} = $${q0.value.toLocaleString()}`);
      
      console.log(`\n  Step A: Calculate CURRENT YoY growth (Q0 vs Q4)`);
      const currentYoYgrowth = q4.value !== 0 ? ((q0.value - q4.value) / Math.abs(q4.value)) * 100 : 0;
      console.log(`    Formula: ((${q0.value} - ${q4.value}) / ${q4.value}) × 100`);
      console.log(`    = ${currentYoYgrowth.toFixed(2)}%`);
      
      console.log(`\n  Step B: Calculate PREVIOUS YoY growth (Q1 vs Q5)`);
      const prevYoYgrowth = q5.value !== 0 ? ((q1.value - q5.value) / Math.abs(q5.value)) * 100 : 0;
      console.log(`    Formula: ((${q1.value} - ${q5.value}) / ${q5.value}) × 100`);
      console.log(`    = ${prevYoYgrowth.toFixed(2)}%`);
      
      revenueYoYaccel = currentYoYgrowth - prevYoYgrowth;
      console.log(`\n  Step C: ACCELERATION = ${currentYoYgrowth.toFixed(2)}% - ${prevYoYgrowth.toFixed(2)}%`);
      console.log(`    = ${revenueYoYaccel.toFixed(2)}% ← REVENUE ACCEL YoY`);
    } else {
      console.log(`  SKIPPED: Only ${n} data points available (need 6 for YoY)`);
    }
    console.log(`[${"=".repeat(60)}]\n`);

    // Calculate margin data (GROSS margin: grossProfit / revenue)
    // Filter to only completed quarters with valid data, then sort OLDEST first
    const marginData = fundamentals
      .filter(f => {
        // Only include completed quarters
        const qDate = new Date(f.date);
        qDate.setHours(0, 0, 0, 0);
        return f.revenue !== null && f.grossProfit !== null && f.revenue !== 0 && qDate <= today;
      })
      .map(f => ({
        date: f.date,
        value: (f.grossProfit! / f.revenue!) * 100
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort OLDEST first

    // MARGIN AUDIT: Show raw data and calculations
    console.log(`\n[MARGIN AUDIT - RAW DATA]`);
    console.log(`  Raw margin fundamentals (newest to oldest):`);
    fundamentals.forEach((f, idx) => {
      if (f.revenue && f.grossProfit) {
        const margin = (f.grossProfit / f.revenue) * 100;
        console.log(`  ${idx}. ${f.date}: GP=${f.grossProfit.toLocaleString()}, Rev=${f.revenue.toLocaleString()}, Margin=${margin.toFixed(2)}%`);
      }
    });
    
    console.log(`\n[MARGIN AUDIT - FILTERED DATA]`);
    console.log(`  Completed quarters only (OLDEST to NEWEST):`);
    marginData.forEach((m, idx) => {
      console.log(`  ${idx}. ${m.date}: ${m.value.toFixed(4)}%`);
    });

    if (marginData.length >= 3) {
      const n = marginData.length;
      const q0 = marginData[n - 1];  // Current (NEWEST)
      const q1 = marginData[n - 2];  // Previous
      const q2 = marginData[n - 3];  // 2 quarters ago
      
      console.log(`\n[MARGIN ACCEL - QoQ CALCULATION]`);
      console.log(`  Data Points (OLDEST to NEWEST):`);
      console.log(`  Q2 (n-3, 2 ago):  ${q2.date} = ${q2.value.toFixed(4)}%`);
      console.log(`  Q1 (n-2, prev):   ${q1.date} = ${q1.value.toFixed(4)}%`);
      console.log(`  Q0 (n-1, curr):   ${q0.date} = ${q0.value.toFixed(4)}%`);
      
      console.log(`\n  Step A: Calculate CURRENT margin delta (Q0 vs Q1)`);
      const currentMarginDelta = q0.value - q1.value;
      console.log(`    Formula: Q0_Margin - Q1_Margin`);
      console.log(`    = ${q0.value.toFixed(4)}% - ${q1.value.toFixed(4)}%`);
      console.log(`    = ${currentMarginDelta.toFixed(4)}% ← Current Delta`);
      
      console.log(`\n  Step B: Calculate PREVIOUS margin delta (Q1 vs Q2)`);
      const prevMarginDelta = q1.value - q2.value;
      console.log(`    Formula: Q1_Margin - Q2_Margin`);
      console.log(`    = ${q1.value.toFixed(4)}% - ${q2.value.toFixed(4)}%`);
      console.log(`    = ${prevMarginDelta.toFixed(4)}% ← Previous Delta`);
      
      console.log(`\n  Step C: Calculate ACCELERATION (change in margin delta)`);
      const marginAccelDebug = currentMarginDelta - prevMarginDelta;
      console.log(`    Formula: CurrentDelta - PreviousDelta`);
      console.log(`    = ${currentMarginDelta.toFixed(4)}% - ${prevMarginDelta.toFixed(4)}%`);
      console.log(`    = ${marginAccelDebug.toFixed(4)}% ← MARGIN ACCEL QoQ`);
    } else {
      console.log(`\n[MARGIN ACCEL] SKIPPED: Only ${marginData.length} data points (need 3+)`);
    }

    // Calculate accelerations independently for each metric
    const revenueAccel = this.calculateMetricAcceleration(revenueData);
    const marginAccel = this.calculateMarginAcceleration(marginData);  // Uses absolute deltas, not growth rates
    // EBIT Margin Acceleration: measures if profit margins are expanding faster YoY (filters out tax anomalies)
    const earningsAccel = this.calculateEBITMarginAcceleration(fundamentals, ticker);
    // Capital Allocation analysis (replaces FCF Trend - uses Balance Sheet data)
    const capitalAlloc = this.analyzeCapitalAllocation(fundamentals, ticker);

    // Regime Classification - use QoQ acceleration (most reliable with limited data)
    let regime: "POWER" | "TREND" | "WARN" | "WATCH" = "WATCH";
    
    // Only classify if we have both revenue and margin QoQ data
    const revQoQ = revenueAccel.qoq;
    const margQoQ = marginAccel.qoq;
    
    if (revQoQ !== null && margQoQ !== null) {
      const revenueAccelerating = revQoQ > 0;
      const revenueDecelerating = revQoQ < 0;
      const marginsExpanding = margQoQ > 0;
      const marginsContracting = margQoQ < 0;

      if (revenueAccelerating && marginsExpanding) {
        regime = "POWER";
      } else if (revenueDecelerating && marginsExpanding) {
        regime = "TREND";
      } else if (revenueDecelerating && marginsContracting) {
        regime = "WARN";
      } else if (revenueAccelerating && marginsContracting) {
        regime = "WATCH";
      }
    }

    // Calculate Inflection Score (0-100)
    let score = 50;

    if (regime === "POWER" || regime === "WARN") score += 15;

    // Multi-timeframe alignment (only if YoY available)
    if (revQoQ !== null && revenueAccel.yoy !== null) {
      const qoqConsistent = (revQoQ > 0) === (revenueAccel.yoy > 0);
      if (qoqConsistent) score += 20;
    }

    // Inflection detection
    if (revQoQ !== null && Math.abs(revQoQ) > 10) score += 10;
    if (margQoQ !== null && Math.abs(margQoQ) > 5) score += 5;

    // Confidence based on data availability
    const dataPoints = [revenueData.length, marginData.length, epsData.length, fcfData.length];
    const avgDataPoints = dataPoints.reduce((a, b) => a + b, 0) / 4;
    const confidence = Math.min(0.95, avgDataPoints / 8);

    return {
      type: "COMPANY",
      ticker,
      regime,
      inflectionScore: Math.min(100, Math.max(0, score)),
      revenueAcceleration: revenueAccel,
      marginAcceleration: marginAccel,
      earningsAcceleration: earningsAccel,
      capitalAllocation: capitalAlloc,
      confidence,
      linRegDeviation: undefined, // Will be populated from price data if available
    };
  }
}

// Price Divergence Analysis for Companies
export class PriceDivergenceEngine {
  /**
   * Calculate how much stock price is diverging from what fundamentals suggest
   * Returns 0-100 strength score
   * 
   * Logic:
   * - If fundamentals are accelerating but price is declining → HIGH divergence (bearish)
   * - If fundamentals are decelerating but price is rising → HIGH divergence (bullish)
   * - If price and fundamentals align → LOW divergence
   */
  static calculateDivergenceStrength(
    revenueAccelQoQ: number | null,
    priceChange30d: number
  ): number {
    if (revenueAccelQoQ === null) return 0;

    // Expected price change based on revenue acceleration
    // Conservative: assume fundamentals drive ~70% of price move
    const expectedPriceChange = revenueAccelQoQ * 0.7;
    
    // Divergence = how much price deviates from expected
    const divergence = Math.abs(priceChange30d - expectedPriceChange);
    
    // Convert to 0-100 scale (capped at 100)
    // Divergence of ~15% or more = max strength
    return Math.min(100, (divergence / 15) * 100);
  }

  /**
   * Classify divergence type based on acceleration and price direction
   */
  static classifyDivergence(
    revenueAccelQoQ: number | null,
    priceChange30d: number
  ): "BULLISH" | "BEARISH" | "ALIGNED" | "UNKNOWN" {
    if (revenueAccelQoQ === null) return "UNKNOWN";

    const fundamentalsAccelerating = revenueAccelQoQ > 0;
    const priceRising = priceChange30d > 0;

    // Aligned: fundamentals and price moving same direction
    if (fundamentalsAccelerating === priceRising) {
      return "ALIGNED";
    }

    // Bullish divergence: price rising despite decelerating fundamentals
    if (priceRising && !fundamentalsAccelerating) {
      return "BULLISH";
    }

    // Bearish divergence: price falling despite accelerating fundamentals
    if (!priceRising && fundamentalsAccelerating) {
      return "BEARISH";
    }

    return "ALIGNED";
  }
}

// ETF Analysis Engine
export class ETFDivergenceEngine {
  
  /**
   * Calculate Rate of Change (ROC) over a specified period
   * ROC = ((current - prior) / prior) * 100
   */
  private static calculateROC(closes: number[], period: number): number {
    if (closes.length <= period) return 0;
    const current = closes[closes.length - 1];
    const prior = closes[closes.length - 1 - period];
    return prior !== 0 ? ((current - prior) / prior) * 100 : 0;
  }

  // Helper: Calculate simple moving average
  private static calculateSMA(values: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        sma.push(0);
      } else {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  static analyzeETF(
    ticker: string,
    priceData: Array<{ date: string; close: number; volume: number; open?: number }>
  ): ETFAnalysis {
    if (priceData.length < 60) {
      return {
        type: "ETF",
        ticker,
        priceVsSectorMomentum: 0,
        sectorTrend: "NEUTRAL",
        divergenceStrength: 0,
        priceAcceleration: 0,
        volumeTrend: 0,
        volumeConviction: "NORMAL",
        confidence: 0,
      };
    }

    const closes = priceData.map(d => d.close);

    // ROC Momentum Divergence: Compare 20-day vs 60-day momentum
    // ROC-20: momentum over 1 month
    // ROC-60: momentum over ~3 months
    // Divergence = deceleration/acceleration (how momentum is changing)
    const roc20 = this.calculateROC(closes, 20);
    const roc60 = this.calculateROC(closes, 60);
    
    // Momentum divergence: positive = accelerating, negative = decelerating
    const momentumDivergence = roc20 - roc60;

    // Get last 3 periods of 10-day data for other metrics
    const latest10 = priceData.slice(-10);
    const prev10 = priceData.slice(-20, -10);

    // Calculate price momentum for sector trend with 3-day SMA smoothing
    // First calculate raw 10-day returns
    const latestReturn = ((latest10[9].close - latest10[0].close) / latest10[0].close) * 100;
    const prevReturn = ((prev10[9].close - prev10[0].close) / prev10[0].close) * 100;
    
    // Calculate ROC for last 21 days and apply 3-day SMA
    const rocValues: number[] = [];
    for (let i = 10; i < Math.min(closes.length, 21); i++) {
      rocValues.push(this.calculateROC(closes, i));
    }
    const rocSMA = this.calculateSMA(rocValues, 3);
    const latestROCSMA = rocSMA[rocSMA.length - 1] || latestReturn;
    const prevROCSMA = rocSMA[rocSMA.length - 4] || prevReturn;

    // Price acceleration (momentum of momentum) with SMA smoothing
    const priceAccel = latestROCSMA - prevROCSMA;

    // Relative Volume Intensity using Smoothed Relative Volume (RVOL)
    // RVOL = 3-day avg volume / 20-day avg volume
    const shortTermVol = priceData.slice(-3).reduce((sum, d) => sum + d.volume, 0) / 3;
    const baselineVol = priceData.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20;
    const volumeTrend = shortTermVol / baselineVol;
    
    // Determine volume conviction based on RVOL + price direction (Close > Open or Close < Open)
    const lastClose = priceData[priceData.length - 1].close;
    const lastOpen = priceData[priceData.length - 1].open || lastClose; // Fallback to close if open not available
    const isBullish = lastClose >= lastOpen;
    
    let volumeConviction: "HIGH CONVICTION BUY" | "HIGH CONVICTION SELL" | "NORMAL" | "LOW INTEREST";
    if (volumeTrend > 1.5) {
      volumeConviction = isBullish ? "HIGH CONVICTION BUY" : "HIGH CONVICTION SELL";
    } else if (volumeTrend < 0.8) {
      volumeConviction = "LOW INTEREST";
    } else {
      volumeConviction = "NORMAL";
    }

    // Momentum Spread: Time-normalized comparison of momentum
    // Fix: Normalize for time volatility using sqrt(period)
    // Norm_ROC10 = (Price / Price_10_ago - 1) / sqrt(10)
    // Norm_ROC60 = (Price / Price_60_ago - 1) / sqrt(60)
    const roc10 = this.calculateROC(closes, 10);
    const normROC10 = (roc10 / 100) / Math.sqrt(10);
    const normROC60 = (roc60 / 100) / Math.sqrt(60);
    const momentumSpread = (normROC10 - normROC60) * 100;

    // Get current price and historical prices
    const currentPrice = closes[closes.length - 1];
    const price10d = closes[closes.length - 1 - 10];
    const price60d = closes[closes.length - 1 - 60];

    // Debug: Log ETF analysis with full calculations
    console.log(`\n=== ETF DIVERGENCE ANALYSIS: ${ticker} ===`);
    console.log(`Current Price: $${currentPrice.toFixed(2)}`);
    console.log(`Price 10d ago: $${price10d.toFixed(2)}`);
    console.log(`Price 60d ago: $${price60d.toFixed(2)}`);
    console.log(`ROC-10 (Short-Term Velocity): ${roc10.toFixed(2)}%`);
    console.log(`ROC-60 (Medium-Term Trend): ${roc60.toFixed(2)}%`);
    console.log(`Momentum Spread (ROC-10 - ROC-60): ${momentumSpread.toFixed(2)}%`);

    // Determine sector trend
    let sectorTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (latestReturn > 5) sectorTrend = "BULLISH";
    else if (latestReturn < -5) sectorTrend = "BEARISH";

    // Divergence strength: ROC momentum divergence mapped to 0-100 scale
    // A divergence of ±20% or more = max strength (±100)
    // CRITICAL FIX: Remove Math.abs() to preserve sign (negative = decelerating, positive = accelerating)
    const divergenceStrength = Math.min(100, Math.max(-100, (momentumDivergence / 20) * 100));
    
    console.log(`Scaled Divergence: ${divergenceStrength.toFixed(2)}`);
    console.log(`Interpretation: ${divergenceStrength > 0 ? "ACCELERATING momentum" : divergenceStrength < 0 ? "DECELERATING momentum" : "NEUTRAL"}`);
    console.log(`===================================\n`);

    // Confidence based on volume consistency (using RVOL)
    const volumeConsistency = Math.min(1, volumeTrend * 0.9);
    const confidence = volumeConsistency * 0.8;

    // Calculate LinReg Deviation
    const linRegDev = calculateLinRegDeviation(priceData);

    return {
      type: "ETF",
      ticker,
      priceVsSectorMomentum: momentumSpread,
      sectorTrend,
      divergenceStrength,
      roc10,
      roc20,
      roc60,
      priceAcceleration: priceAccel,
      volumeTrend,
      volumeConviction,
      linRegDeviation: linRegDev || undefined,
      latestPrice: currentPrice,
      confidence,
    };
  }
}
