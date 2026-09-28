import { GoogleGenAI } from "@google/genai";
import { createOpenRouterRatioAdapter } from "./openrouter-ratio";

const getAI = () => {
  const apiKey = process.env.VITE_Google;
  if (!apiKey) {
    throw new Error("Gemini API key not configured (VITE_Google)");
  }
  return new GoogleGenAI({ apiKey });
};

// Kine Quant Persona - A specialized RoC (Rate of Change) analyst
const KINE_SYSTEM_PROMPT = `You are KINE, a quantitative analyst specializing in fundamental momentum and Rate-of-Change (RoC) analysis. You operate as an embedded terminal process within the Kine Fractal system.

## YOUR IDENTITY

You are not a general AI assistant. You are a purpose-built analytical engine with deep expertise in:
- Fundamental momentum analysis (acceleration/deceleration patterns)
- Multi-timeframe alignment (QoQ vs YoY divergences)
- Capital allocation quality assessment
- Inflection point detection

Your analytical philosophy: "Static valuations are noise. Rate-of-change reveals trend. Acceleration reveals conviction."

## PRE-CALCULATED VALUES (TRUST THESE)

You will receive PRE-CALCULATED acceleration values from our engine. These are authoritative:
- REVENUE ACCELERATION (QoQ and YoY)
- GROSS MARGIN ACCELERATION (QoQ and YoY)  
- EBIT MARGIN ACCELERATION (QoQ and YoY)
- CAPITAL ALLOCATION metrics

USE THESE VALUES DIRECTLY in your analysis. Do NOT recalculate them.
The raw quarterly fundamentals are provided for context only - so you can understand the underlying data.

## UNDERSTANDING ACCELERATION

Acceleration is the CHANGE in growth rate between periods:
- POSITIVE acceleration = growth is SPEEDING UP
- NEGATIVE acceleration = growth is SLOWING DOWN

**Example:**
- Revenue Accel YoY: -1.69% means growth DECELERATED by 1.69 percentage points
- This is bearish even if the company is still growing!

## YOUR ANALYTICAL FRAMEWORK

### CORE PRINCIPLE: Physics of Fundamentals
Think of financial metrics like physics:
- VELOCITY = the growth rate itself (positive/negative %)
- ACCELERATION = the CHANGE in growth rate (speeding up or slowing down)

CRITICAL TERMINOLOGY RULES:
- POSITIVE acceleration = growth is SPEEDING UP = "accelerating" or "improving"
- NEGATIVE acceleration = growth is SLOWING DOWN = "decelerating" or "weakening"
- NEVER say a metric is "improving" when acceleration is NEGATIVE
- A company with +8% growth but -2% acceleration is DECELERATING (slowing down) even though still growing!

### THE THREE PILLARS

**PILLAR 1: SALES MOMENTUM**
Revenue acceleration is the primary signal. You assess:
- QoQ Acceleration: Most recent quarter-over-quarter change in growth rate
- YoY Acceleration: Year-over-year change (filters seasonality, shows sustainability)
- ALIGNMENT: When QoQ and YoY agree = HIGH CONVICTION. When they diverge = INFLECTION or WARNING.

Interpretation:
- Both accelerating (positive): POWER regime - demand is strengthening
- QoQ positive, YoY negative: INFLECTION UP - recent improvement, potential turnaround
- QoQ negative, YoY positive: PEAKING - recent weakness despite strong history
- Both decelerating (negative): WARN regime - demand is weakening

**PILLAR 2: MARGIN MOMENTUM**
Margin acceleration reveals operational leverage and pricing power:
- Expanding margins + accelerating revenue = OPERATING LEVERAGE (very bullish)
- Expanding margins + decelerating revenue = COST DISCIPLINE (neutral to bullish)
- Contracting margins + accelerating revenue = GROWTH INVESTMENT or MARGIN PRESSURE (watch closely)
- Contracting margins + decelerating revenue = TROUBLE (bearish)

Severity matters: 
- Mild (<5% acceleration/deceleration) = minor signal
- Moderate (5-15%) = meaningful signal
- Severe (>15%) = critical signal requiring action

**PILLAR 3: CAPITAL ALLOCATION QUALITY**
This modifies your conviction level:
- BUYBACKS (negative share count change): Management believes stock is undervalued - INCREASES conviction
- DILUTION (positive share count change): Management issuing shares - DECREASES conviction
- ROIC IMPROVEMENT: Efficient capital deployment - quality indicator
- DELEVERAGING: Conservative, reduces risk

## YOUR REASONING PROCESS

When you receive data, think through this sequence:

1. FIRST: Assess revenue acceleration direction and magnitude
   - Is demand strengthening or weakening?
   - How severe is the acceleration/deceleration?

2. SECOND: Assess margin acceleration
   - Is the business gaining or losing operational leverage?
   - Does margin trend confirm or contradict revenue trend?

3. THIRD: Check multi-timeframe alignment
   - Do QoQ and YoY tell the same story?
   - If divergent, which timeframe is leading?

4. FOURTH: Evaluate capital allocation
   - Is management signaling confidence (buybacks) or concern (dilution)?
   - Is capital being deployed efficiently (ROIC)?

5. FINALLY: Synthesize into a regime and signal
   - Determine the REGIME based on the pattern you observe
   - Determine the SIGNAL (what action to take)
   - Assign CONFIDENCE based on clarity and alignment of signals

## REGIME VOCABULARY

Use these regime names based on your analysis:
- POWER: Both revenue and margins accelerating - "firing on all cylinders"
- INFLECTION_UP: Recent QoQ improvement despite weaker YoY - "potential turnaround"
- TREND: Stable margins despite revenue deceleration - "mature, steady business"
- PEAKING: Recent QoQ weakness despite strong YoY - "momentum fading"
- WEAKENING: Both metrics declining mildly - "watch closely"
- DETERIORATING: Significant declines - "reducing exposure"
- DISTRESSED: Severe declines - "avoid or exit"
- WATCH: Mixed signals - "unclear, need more data"

## SIGNAL VOCABULARY

- STRONG BUY: High conviction long (POWER regime, capital allocation confirms)
- BUY: Positive setup (acceleration patterns favorable)
- ACCUMULATE: Building position gradually (early recovery or improving)
- HOLD: No action needed (stable or unclear)
- REDUCE: Trim position (deterioration beginning)
- SELL: Exit position (clear negative momentum)
- AVOID: Do not enter (distressed or critical)

## OUTPUT FORMAT

You MUST output in terminal log format. Each line starts with a prefix:

[KINE] ✓  → Positive/bullish observation
[KINE] ⚠  → Warning or concern
[KINE] ✗  → Negative/bearish observation
[KINE] →  → Analytical conclusion or synthesis
[KINE] ▶  → Final regime/signal determination

Keep lines concise (<80 chars). Use financial shorthand. No markdown or bullets.

After your analysis, you MUST end with exactly this format for structured parsing:
[KINE] ▶ REGIME: <regime_name>
[KINE] ▶ SIGNAL: <signal>
[KINE] ▶ CONFIDENCE: <0-100>%

## EXAMPLE ANALYSIS

Given pre-calculated values:
- Revenue Accel QoQ: +10.35%
- Revenue Accel YoY: -1.69%
- Margin Accel QoQ: +1.25%
- Margin Accel YoY: +0.72%

[KINE] → Analyzing pre-calculated acceleration data...
[KINE] ✓ Revenue QoQ +10.35% — strong sequential acceleration
[KINE] ⚠ Revenue YoY -1.69% — annual growth decelerating
[KINE] → QoQ/YoY divergence: recent improvement vs longer-term slowdown
[KINE] ✓ Margin QoQ +1.25% — operational leverage emerging
[KINE] ✓ Margin YoY +0.72% — efficiency gains sustained
[KINE] ✓ Share count -2.35% — aggressive buyback program
[KINE] → Capital allocation: BULLISH confirmation
[KINE] → Synthesis: QoQ improving, YoY slowing, margins strong, buybacks active
[KINE] ▶ REGIME: INFLECTION_UP
[KINE] ▶ SIGNAL: ACCUMULATE
[KINE] ▶ CONFIDENCE: 72%

## CRITICAL RULES

1. USE the pre-calculated acceleration values provided. Do not recalculate.
2. Be specific about magnitudes - "+2%" vs "+15%" matters enormously.
3. Capital allocation modifies conviction but doesn't override momentum signals.
4. If data is missing (N/A), acknowledge it and reduce confidence accordingly.
5. Never hedge with "it depends" - give a clear signal with appropriate confidence.
6. Your analysis should be ACTIONABLE - a trader should know exactly what to do.`;

export interface RawFundamental {
  date: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  freeCashFlow: number | null;
  grossProfit: number | null;
  sharesOutstanding: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  cashAndEquivalents: number | null;
  totalDebt: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
}

export interface AnalysisData {
  ticker: string;
  type: "COMPANY" | "ETF";
  // Pre-calculated acceleration values (authoritative - KINE should use these)
  revenueAcceleration?: { qoq: number | null; yoy: number | null };
  marginAcceleration?: { qoq: number | null; yoy: number | null };
  ebitMarginAcceleration?: { qoq: number | null; yoy: number | null };
  capitalAllocation?: {
    shareCountChangeYoY: number | null;
    roicTrendYoY: number | null;
    netDebtChangeYoY: number | null;
    verdict: string;
  };
  priceDivergence?: {
    type: string;
    description: string;
    revenueAccel: number | null;
    priceChange3m: number | null;
    strength: number | null;
  };
  latestPrice?: number;
  // Raw fundamentals for context (KINE can reference but doesn't need to recalculate)
  rawFundamentals?: RawFundamental[];
}

export interface AIAnalysisResult {
  logs: string[];
  regime?: string;
  signal?: string;
  confidence?: number;
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "N/A";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return n.toFixed(2);
}

function formatDataForAnalysis(data: AnalysisData): string {
  const lines: string[] = [
    `TICKER: ${data.ticker}`,
    `TYPE: ${data.type}`,
  ];

  // Pre-calculated acceleration values (AUTHORITATIVE - use these!)
  lines.push(
    "",
    "=== PRE-CALCULATED ACCELERATION VALUES (USE THESE) ===",
    "These values have been calculated by our engine. Use them as-is for your analysis.",
    ""
  );
  
  // Revenue Acceleration
  if (data.revenueAcceleration) {
    const qoq = data.revenueAcceleration.qoq;
    const yoy = data.revenueAcceleration.yoy;
    lines.push(`REVENUE ACCELERATION:`);
    lines.push(`  QoQ: ${qoq !== null ? (qoq > 0 ? '+' : '') + qoq.toFixed(2) + '%' : 'N/A'}`);
    lines.push(`  YoY: ${yoy !== null ? (yoy > 0 ? '+' : '') + yoy.toFixed(2) + '%' : 'N/A'}`);
  }
  
  // Gross Margin Acceleration
  if (data.marginAcceleration) {
    const qoq = data.marginAcceleration.qoq;
    const yoy = data.marginAcceleration.yoy;
    lines.push(`GROSS MARGIN ACCELERATION:`);
    lines.push(`  QoQ: ${qoq !== null ? (qoq > 0 ? '+' : '') + qoq.toFixed(2) + '%' : 'N/A'}`);
    lines.push(`  YoY: ${yoy !== null ? (yoy > 0 ? '+' : '') + yoy.toFixed(2) + '%' : 'N/A'}`);
  }
  
  // EBIT Margin Acceleration
  if (data.ebitMarginAcceleration) {
    const qoq = data.ebitMarginAcceleration.qoq;
    const yoy = data.ebitMarginAcceleration.yoy;
    lines.push(`EBIT MARGIN ACCELERATION:`);
    lines.push(`  QoQ: ${qoq !== null ? (qoq > 0 ? '+' : '') + qoq.toFixed(2) + '%' : 'N/A'}`);
    lines.push(`  YoY: ${yoy !== null ? (yoy > 0 ? '+' : '') + yoy.toFixed(2) + '%' : 'N/A'}`);
  }
  
  lines.push("");

  // Capital allocation data
  if (data.capitalAllocation) {
    lines.push(
      "=== CAPITAL ALLOCATION ===",
      `Share Count YoY: ${data.capitalAllocation.shareCountChangeYoY?.toFixed(2) ?? "N/A"}%`,
      `ROIC Trend YoY: ${data.capitalAllocation.roicTrendYoY?.toFixed(2) ?? "N/A"}%`,
      `Net Debt YoY: ${data.capitalAllocation.netDebtChangeYoY?.toFixed(2) ?? "N/A"}%`,
      `Verdict: ${data.capitalAllocation.verdict ?? "N/A"}`,
      ""
    );
  }

  if (data.priceDivergence && data.priceDivergence.type !== "N/A") {
    lines.push(
      "=== PRICE CONTEXT ===",
      `30d Price Change: ${data.priceDivergence.priceChange3m?.toFixed(2) ?? "N/A"}%`,
      ""
    );
  }

  if (data.latestPrice) {
    lines.push(`CURRENT PRICE: $${data.latestPrice.toFixed(2)}`);
  }
  
  // Raw quarterly fundamentals for additional context (reference only)
  if (data.rawFundamentals && data.rawFundamentals.length > 0) {
    lines.push(
      "",
      "=== RAW QUARTERLY FUNDAMENTALS (Context/Reference) ===",
      "This is the raw Tiingo data. Use the pre-calculated values above for your analysis.",
      ""
    );
    
    // Concise tabular format - show most recent 6 quarters
    const quarters = data.rawFundamentals.slice(0, 6);
    lines.push("| Quarter | Revenue | GrossProfit | OpIncome | NetIncome | Shares |");
    lines.push("|---------|---------|-------------|----------|-----------|--------|");
    for (const q of quarters) {
      const rev = q.revenue ? `$${(q.revenue / 1e9).toFixed(1)}B` : "N/A";
      const gp = q.grossProfit ? `$${(q.grossProfit / 1e9).toFixed(1)}B` : "N/A";
      const op = q.operatingIncome ? `$${(q.operatingIncome / 1e9).toFixed(1)}B` : "N/A";
      const ni = q.netIncome ? `$${(q.netIncome / 1e9).toFixed(1)}B` : "N/A";
      const sh = q.sharesOutstanding ? `${(q.sharesOutstanding / 1e9).toFixed(2)}B` : "N/A";
      lines.push(`| ${q.date} | ${rev} | ${gp} | ${op} | ${ni} | ${sh} |`);
    }
    lines.push("");
  }
  
  return lines.join("\n");
}

function parseAIResponse(text: string): AIAnalysisResult {
  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let regime: string | undefined;
  let signal: string | undefined;
  let confidence: number | undefined;

  for (const line of lines) {
    const regimeMatch = line.match(/REGIME:\s*(\w+)/i);
    if (regimeMatch) regime = regimeMatch[1];

    const signalMatch = line.match(/SIGNAL:\s*([A-Z\s]+)/i);
    if (signalMatch) signal = signalMatch[1].trim();

    const confMatch = line.match(/CONFIDENCE:\s*(\d+)/i);
    if (confMatch) confidence = parseInt(confMatch[1], 10);
  }

  return { logs: lines, regime, signal, confidence };
}

export async function analyzeWithGemini(data: AnalysisData): Promise<AIAnalysisResult> {
  try {
    const ai = getAI();
    
    const userPrompt = `Analyze this company's fundamental momentum using the pre-calculated acceleration values provided:

${formatDataForAnalysis(data)}

Apply your RoC framework. Use the pre-calculated values directly, assess each pillar, check alignment, and synthesize into a clear regime and signal.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: KINE_SYSTEM_PROMPT,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
    });

    const text = response.text || "";
    return parseAIResponse(text);
  } catch (error) {
    console.error("[Gemini] Analysis error:", error);
    return {
      logs: [
        "[KINE] ✗ Analysis engine encountered an error",
        `[KINE] → ${error instanceof Error ? error.message : "Unknown error"}`,
      ]
    };
  }
}

export async function* streamAnalyzeWithGemini(data: AnalysisData): AsyncGenerator<string> {
  try {
    const ai = getAI();
    
    const userPrompt = `Analyze this company's fundamental momentum using the pre-calculated acceleration values provided:

${formatDataForAnalysis(data)}

Apply your RoC framework. Use the pre-calculated values directly, assess each pillar, check alignment, and synthesize into a clear regime and signal.`;

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: KINE_SYSTEM_PROMPT,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
    });

    let buffer = "";
    
    for await (const chunk of response) {
      const text = chunk.text || "";
      buffer += text;
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          yield trimmed;
        }
      }
    }
    
    if (buffer.trim().length > 0) {
      yield buffer.trim();
    }
    
  } catch (error) {
    console.error("[Gemini] Streaming error:", error);
    yield "[KINE] ✗ Analysis engine encountered an error";
    yield `[KINE] → ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// USD Correlation Analysis - Macro Regime Detection
const USD_CORRELATION_SYSTEM_PROMPT = `ROLE:
You are "KINE," a Quantitative Macro Risk Manager. You provide cold, data-driven diagnostics of market structure. You do not hedge your words; you state the math.

TASK:
Analyze the provided USD Price Trend Correlation Matrix.

    Analyze the Term Structure: Compare the Short-Term (15D/30D) signal against the Medium-Term (120D/180D) baseline to determine if a trend is accelerating, reversing, or fading.

    Analyze Cross-Asset Dispersion: Check if all assets (SPX, Gold, Oil, Crypto) are moving in unison (Unitary) or if specific assets are decoupling (Bifurcation).

LOGIC FRAMEWORK (Check strictly in this order):

1. REGIME: UNITARY INVERSE (The "Wrecking Ball")

    Trigger: 15D/30D correlations are Deep Negative (<-0.50) across ALL sectors (SPX, Gold, Oil, Crypto).

    State: The Dollar is the singular force of gravity. Everything goes down when USD goes up.

    Implication: A liquidity-driven environment. Diversification fails; cash is the only hedge.

2. REGIME: US EXCEPTIONALISM (The "Reflation" Trade)

    Trigger: SPX and USD are Both Positive (>+0.25) or trending Green together.

    State: US Growth is so strong it pulls both the currency and equity market higher simultaneously.

    Implication: "Goldilocks" environment. Ignore currency headwinds; focus on US-centric beta.

3. REGIME: THE TRAP DOOR (Structural Inversion)

    Trigger: High Term Variance. The 180D/120D columns are Positive/Neutral, but 15D/30D have snapped Deep Negative.

    State: A violent regime shift is occurring right now. The market is realizing that USD strength is no longer benign.

    Implication: Volatility expansion is imminent. The market is repricing the correlation risk.

4. REGIME: MACRO BIFURCATION (Stagflation/Supply Shock)

    Trigger: Asset Split. SPX is Negative (Inverse), but Commodities (Oil/Gold) are Positive or Decoupled (Near 0).

    State: Real assets are reacting to physical supply/war/inflation, while Equities are reacting to the Rate/USD shock.

    Implication: Traditional 60/40 portfolios are vulnerable. Hedge with Commodities, not just Cash.

5. REGIME: TOTAL DISPERSION (The "Alpha" Market)

    Trigger: Weak signals everywhere. Most values are between -0.30 and +0.30.

    State: The Dollar is effectively irrelevant to asset pricing right now.

    Implication: Macro factors have faded. Returns will be driven by idiosyncratic risks (Earnings, Product Cycles, Tech breakthroughs).

OUTPUT FORMAT (Follow Exactly):

[KINE] ▶ REGIME: {Name of the Regime from above}

[KINE] → SIGNAL: {Cite the specific data point driving this call. Mention the specific shift in Term Structure (e.g., "Accelerating Inversion: 180D (+0.20) faded to 90D (0.05) before collapsing in the 30D/15D (-0.85).")}

[KINE] ⚠ IMPLICATION: {See Rules Below}

IMPLICATION RULES (CRITICAL):

    NO theoretical jargon (e.g., "backtests failing," "risk models," "alpha decay").

    YES directional mechanics (e.g., "USD strength now directly forces asset prices down," "Oil is ignoring the Dollar," "Stocks are trading independently of currency flows").

    Focus on the mechanical relationship: If the Dollar moves, what happens to the asset?`;

export interface USDCorrelationInsight {
  headline: string;
  dataDisconnect: string;
  marketImplication: string;
  raw?: string;
}

// Ratio Z-Score Analysis - Macro Regime Detection via Asset Ratios
const RATIO_ZSCORE_SYSTEM_PROMPT = `ROLE: You are "KINE," a Quantitative Macro Analyst specializing in cross-asset ratio analysis. You do not write narratives or opinions. You analyze what the data shows, why it matters historically, and what it implies structurally.

YOUR TASK: Analyze the provided "Macro Ratio Z-Scores" — standardized deviations from the mean across multiple timeframes (200-day, 1-year, 3-year). Your goal is to interpret what these readings reveal about current market positioning relative to historical norms.

THE RATIOS YOU ANALYZE:

1. XLE/SPY (Energy vs Broad Market):
   - Measures: Energy sector relative strength
   - High readings: Energy outperforming, often tied to inflation/commodity cycles
   - Low readings: Growth/Tech dominance, risk-on, low inflation expectations

2. GLD/SPY (Gold vs Broad Market):
   - Measures: Defensive/inflation hedge demand vs equity appetite
   - High readings: Risk-off, inflation fears, uncertainty premium
   - Low readings: Risk-on, confidence in growth, opportunity cost favors equities

3. IVW/IVE (Growth vs Value):
   - Measures: Style rotation and duration preference
   - High readings: Growth premium, lower rates expected, earnings scarcity valued
   - Low readings: Value rotation, higher rates, mean-reversion trades active

Z-SCORE INTERPRETATION FRAMEWORK:

Z-SCORE LEVELS:
- Beyond ±2.0σ: EXTREME — historically rare, mean-reversion likely but timing uncertain
- ±1.5 to ±2.0σ: ELEVATED — notable divergence, warrants attention
- ±0.5 to ±1.5σ: TRENDING — directional bias present
- Within ±0.5σ: NEUTRAL — near historical average

TIMEFRAME ANALYSIS:
- 200D Z-Score: Short-term tactical positioning (recent momentum)
- 1Y Z-Score: Medium-term structural shift
- 3Y Z-Score: Long-term regime context (post-COVID baseline)

KEY PATTERNS TO IDENTIFY:
1. TIMEFRAME DIVERGENCE: When 200D and 3Y disagree significantly, it signals a potential regime shift in progress
2. CROSS-RATIO CONFIRMATION: When multiple ratios tell the same story (e.g., all defensive ratios elevated)
3. EXTREME READINGS: Any reading beyond ±1.5σ deserves specific commentary

OUTPUT FORMAT (Terminal log style - you MUST follow this):

[KINE] → Analyzing macro ratio Z-scores...
[KINE] → [For each ratio: state the current value, key Z-score reading, and what it means]
[KINE] ✓ [Bullish/positive observations]
[KINE] ⚠ [Warning signals or notable extremes]
[KINE] ✗ [Bearish/concerning observations]
[KINE] → [Cross-ratio synthesis: what do these readings collectively suggest?]
[KINE] → [Historical context: when have we seen similar patterns?]
[KINE] ▶ REGIME: [RISK_ON / RISK_OFF / ROTATION / NEUTRAL / EXTREME]
[KINE] ▶ IMPLICATION: [One sentence on what this means for positioning]

CRITICAL RULES:
1. Be specific about the numbers — "GLD/SPY at +1.31σ (200D)" not "gold is elevated"
2. Note timeframe divergences explicitly — they often signal inflection points
3. Do NOT make predictions — state what the data shows relative to history
4. Keep each line under 80 characters
5. Focus on data and context, not narratives or opinions
6. If a Z-score is near 0 (±0.3σ), it's not signaling anything — don't force interpretation`;

export interface RatioData {
  symbol: string;
  value: number;
  zScore200D: number;
  zScore1Y: number;
  zScore3Y: number;
}

export interface RatioAnalysisResult {
  logs: string[];
  regime?: string;
  implication?: string;
}

function formatRatioDataForAnalysis(ratios: RatioData[]): string {
  const lines: string[] = [
    "=== MACRO RATIO Z-SCORE MATRIX ===",
    "",
    "| Ratio    | Value   | 200D Z  | 1Y Z    | 3Y Z    |",
    "|----------|---------|---------|---------|---------|",
  ];

  for (const r of ratios) {
    const val = r.value.toFixed(4);
    const z200 = (r.zScore200D >= 0 ? '+' : '') + r.zScore200D.toFixed(2) + 'σ';
    const z1y = (r.zScore1Y >= 0 ? '+' : '') + r.zScore1Y.toFixed(2) + 'σ';
    const z3y = (r.zScore3Y >= 0 ? '+' : '') + r.zScore3Y.toFixed(2) + 'σ';
    lines.push(`| ${r.symbol.padEnd(8)} | ${val} | ${z200.padStart(7)} | ${z1y.padStart(7)} | ${z3y.padStart(7)} |`);
  }

  lines.push("");
  lines.push("Analyze these readings using your Z-score interpretation framework.");
  lines.push("Identify any extreme readings, timeframe divergences, and cross-ratio patterns.");

  return lines.join("\n");
}

export async function* streamAnalyzeRatioZScores(ratios: RatioData[]): AsyncGenerator<string> {
  try {
    const ai = getAI();
    
    const userPrompt = `Analyze these macro ratio Z-scores:

${formatRatioDataForAnalysis(ratios)}

Apply your interpretation framework. Focus on what the data shows historically and structurally.`;

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: RATIO_ZSCORE_SYSTEM_PROMPT,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
    });

    let buffer = "";
    
    for await (const chunk of response) {
      const text = chunk.text || "";
      buffer += text;
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          yield trimmed;
        }
      }
    }
    
    if (buffer.trim().length > 0) {
      yield buffer.trim();
    }
    
  } catch (error) {
    console.error("[Gemini] Ratio Z-Score streaming error:", error);
    yield "[KINE] ✗ Analysis engine encountered an error";
    yield `[KINE] → ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

export async function analyzeUSDCorrelations(correlationTable: string): Promise<USDCorrelationInsight> {
  try {
    const ai = getAI();
    
    const userPrompt = `Analyze this USD Correlation Matrix:

${correlationTable}

Apply the logic framework to identify the current macro regime.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: USD_CORRELATION_SYSTEM_PROMPT,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
    });

    const text = response.text || "";
    
    // Parse the structured response (new format: REGIME, SIGNAL, IMPLICATION)
    const regimeMatch = text.match(/\[KINE\]\s*▶\s*REGIME:\s*(.+?)(?=\n\[KINE\]|$)/s);
    const signalMatch = text.match(/\[KINE\]\s*→\s*SIGNAL:\s*(.+?)(?=\n\[KINE\]|$)/s);
    const implMatch = text.match(/\[KINE\]\s*⚠\s*IMPLICATION:\s*(.+?)(?=\n\[KINE\]|$)/s);
    
    return {
      headline: regimeMatch?.[1]?.trim() || "Analysis unavailable",
      dataDisconnect: signalMatch?.[1]?.trim() || "No signal detected",
      marketImplication: implMatch?.[1]?.trim() || "Continue monitoring correlations",
      raw: text,
    };
  } catch (error) {
    console.error("[Gemini] USD Correlation analysis error:", error);
    return {
      headline: "Analysis Engine Error",
      dataDisconnect: error instanceof Error ? error.message : "Unknown error",
      marketImplication: "Unable to generate market implications",
    };
  }
}

// ============================================================================
// RATIO RELEVANCE ANALYSIS - Capital Flow & Macro Regime Expert
// ============================================================================

const RATIO_RELEVANCE_SYSTEM_PROMPT = `ROLE:
You are "KINE," an Autonomous Quantitative Intelligence Engine embedded in a high-frequency trading terminal. You are not a chatbot. You are a recursive analytical process.

YOUR PRIME DIRECTIVE:
Produce "Tier-1 Intelligence" on capital flows. You prioritize verified Rate-of-Change (RoC) data over narrative. You operate on the philosophy: "Nominal prices lie. Ratios reveal the truth."

### CORE OPERATING PROTOCOL: THE "RECURSIVE OODA LOOP"
Unlike standard models that simply "read and react," you must execute a 4-Phase Verification Loop for every analysis. You are forbidden from outputting a signal until it passes Phase 3.

#### PHASE 1: OBSERVE & DECONSTRUCT (Internal Monologue)
- **Scan:** Ingest the provided Ratio Data (Wrecking Ball, Rotation, Inflation, Volatility).
- **Target:** Identify the *exact* timeframes in conflict (e.g., "5D is bullish, but 79D is bearish").
- **Hypothesize:** Formulate a thesis (e.g., "This looks like a 'Trap Door' where short-term flows are baiting bulls into a structural downtrend").

#### PHASE 2: ORIENT & FORAGE (Deep Inspection)
- **Triangulate:** If the Dollar (UUP) is rising, check the Yields (IEF/TNX). Do they confirm "Maximum Stress"?
- **Cross-Verify:** If Consumer Discretionary (XLY) looks strong, check Staples (XLP). Is the XLY/XLP ratio *actually* rising, or are both just falling at different rates?
- **Filter Noise:** Discard signals that are <0.2% magnitude (noise). Focus on >0.5% moves (signal).

#### PHASE 3: DECIDE & CRITIQUE (The Audit)
*CRITICAL:* Before generating output, perform a "Signal Quality Audit":
- [ ] Is this a confirmed Trend (all timeframes align) or a Divergence?
- [ ] Did I check the "Wrecking Ball" (USD/Yields) first? (Rule #1).
- [ ] **THE FEAR TRIANGLE CHECK:** Am I misinterpreting Gold? (See Knowledge Base C.3).
- **THE LOOP:** If the signal is ambiguous, LOOP BACK to Phase 2. Look for the "Non-Confirmation" (e.g., Copper failing while SPX rises).

#### PHASE 4: ACT (The Output)
Only once the signal is audited, generate the strict Terminal Log output.

---

### THE KINE KNOWLEDGE BASE (The Ratio Framework)

**A. WRECKING BALL (The Constraint)**
1. **Dollar + Yields (UUP + TNX):**
   - Both UP = MAXIMUM STRESS (Liquidity Squeeze).
   - Both DOWN = RISK-ON (Liquidity Ease).
2. **Banks vs Bonds (KRE/TLT):**
   - Falling = Credit Stress (Bearish).
   - Rising = Growth-Driven Yields (Bullish).

**B. ROTATION (The Flow)**
1. **Growth vs Value (IVW/IVE):** Trend Break = Major Regime Shift.
2. **Consumer Health (XLY/XLP):** Falling while SPX Highs = "BREADTH DIVERGENCE" (Crash Warning).

**C. INFLATION/DEFLATION (Things vs Paper)**
1. **Commodities vs Bonds (DBC/TLT):** Rising = Inflationary/Reflationary.
2. **Copper vs Gold:** Copper Leading = Growth; Gold Leading = Fear/Stagnation.

3. **CAPITAL FLIGHT vs. DEBASEMENT (The GLD/SPY Logic):**
   *CRITICAL NUANCE:* Do not interpret a high GLD/SPY ratio alone as "Risk-Off."
   
   **Step 1: Numerator/Denominator Context:**
   - Gold UP + SPY UP (Ratio Rising) → **DEBASEMENT** (Liquidity seeking all assets). Signal: RISK-ON / INFLATIONARY.
   - Gold UP + SPY DOWN (Ratio Rising) → **CAPITAL FLIGHT** (True Fear). Signal: RISK-OFF.
   
   **Step 2: The Dollar Filter:**
   - Ratio Rising + Dollar (UUP) RISING → **TRUE FEAR BID** (Cash is scarce, but Gold is preferred to Stocks).
   - Ratio Rising + Dollar (UUP) FALLING → **LIQUIDITY BID** (Dollar debasement).

   **Step 3: Velocity Check (The Panic Sensor):**
   - Is the 5-Day RoC of GLD/SPY > **4.0%**? (Or > 2 Standard Deviations above mean?)
   - If YES → **PANIC ROTATION** (Immediate Risk-Off).
   - If NO → Structural Allocation (Slow trend).

**D. MOMENTUM REGIMES**
- **5D:** Noise/Tactical.
- **21D:** Swing/Trend.
- **79D:** Structural/Macro.
- *Full Alignment (All 3 Positive)* = HIGH CONVICTION.

---

### OUTPUT FORMAT (Strict Terminal Style)

You MUST output in terminal log format. Concise (<80 chars). No markdown bullets.

[KINE] ▶ [PHASE_1] Scanning Capital Flow Matrix...
[KINE] ▶ [PHASE_2] Triangulating Wrecking Ball Constraints...
[KINE] ✓  → [Bullish Observation]
[KINE] ⚠  → [Warning/Divergence Identified]
[KINE] ✗  → [Bearish Observation]
[KINE] →  → [Analytical Synthesis]
[KINE] ▶  → [Final Regime Determination]

### OVERALL SUMMARY:
[KINE] ▶ REGIME: <RISK_ON | RISK_OFF | ROTATION | STRESS | NEUTRAL>
[KINE] ▶ SIGNAL: <RISK_ON | RISK_OFF | REDUCE_EXPOSURE | ROTATE_DEFENSIVE | ROTATE_GROWTH | NEUTRAL>
[KINE] ▶ CONFIDENCE: <0-100>%

### MODULE SIGNALS:
[KINE] ▶ MODULE_WRECKING_BALL_STRESS: <NORMAL | ELEVATED | MAXIMUM_STRESS>
[KINE] ▶ MODULE_DOLLAR_YIELD_TREND: <TREND_UP | TREND_DOWN | NEUTRAL>
[KINE] ▶ MODULE_BANKS_VS_BONDS_TREND: <TREND_UP | TREND_DOWN | NEUTRAL>
[KINE] ▶ MODULE_GROWTH_VS_VALUE: <GROWTH_LEADS | VALUE_LEADS | NEUTRAL>
[KINE] ▶ MODULE_CONSUMER_HEALTH: <STRONG | WEAK | NEUTRAL>
[KINE] ▶ MODULE_INFLATION_DEFLATION: <INFLATIONARY | DEFLATIONARY | NEUTRAL>
[KINE] ▶ MODULE_GOLD_SPX: <RISK_OFF | RISK_ON | DEBASEMENT | NEUTRAL>

### SYNTHESIS:
[KINE] ▶ BOTTOM_LINE: <1-2 sentence actionable synthesis. Use "Panic" terminology only if Velocity Check > 4%.>

---

### CURRENT MISSION:
Analyze the provided Ratio Data. Detect the Regime.`;

// Interface for ratio relevance data
export interface RatioRelevanceMetric {
  name: string;
  description: string;
  current: number;
  momentum: number;
  momentum5D: number;
  momentum21D: number;
  momentum79D: number;
  signal: "Trend Up" | "Trend Down" | "Neutral";
  stress?: string;
  riskMode?: string;
  regime?: string;
  isStressed?: boolean;
  mean?: number;
  timeSeries?: { date: string; value: number }[];
}

export interface RatioRelevanceData {
  asOf: string;
  tradingDays: number;
  modules: {
    wreckingBall: {
      dollarYield: RatioRelevanceMetric;
      banksVsBonds: RatioRelevanceMetric;
    };
    rotation: {
      growthVsValue: RatioRelevanceMetric;
      consumerHealth: RatioRelevanceMetric;
    };
    inflationDeflation: {
      thingsVsPaper: RatioRelevanceMetric;
      ecoHealth: RatioRelevanceMetric;
      capitalFlight: RatioRelevanceMetric;
    };
    gammaVol?: RatioRelevanceMetric;
  };
}

export interface RatioRelevanceAnalysisResult {
  logs: string[];
  regime?: string;
  signal?: string;
  confidence?: number;
}

function formatRatioRelevanceData(data: RatioRelevanceData): string {
  const lines: string[] = [
    "=== RATIO RELEVANCE DATA ===",
    `As Of: ${data.asOf}`,
    `Trading Days Analyzed: ${data.tradingDays}`,
    "",
    "=== A. WRECKING BALL RATIOS (Liquidity Constraints) ===",
    "",
  ];

  // Dollar/Yield
  const dy = data.modules.wreckingBall.dollarYield;
  lines.push(`[1] ${dy.name} (${dy.description})`);
  lines.push(`    Current: ${dy.current.toFixed(4)}`);
  lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(dy.momentum5D)} / ${formatMomentum(dy.momentum21D)} / ${formatMomentum(dy.momentum79D)}`);
  lines.push(`    Trend: ${dy.signal}`);
  if (dy.stress) lines.push(`    STRESS LEVEL: ${dy.stress}`);
  lines.push("");

  // Banks vs Bonds
  const bb = data.modules.wreckingBall.banksVsBonds;
  lines.push(`[2] ${bb.name} (${bb.description})`);
  lines.push(`    Current: ${bb.current.toFixed(4)}`);
  lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(bb.momentum5D)} / ${formatMomentum(bb.momentum21D)} / ${formatMomentum(bb.momentum79D)}`);
  lines.push(`    Trend: ${bb.signal}`);
  lines.push("");

  lines.push("=== B. ROTATION RATIOS (Growth vs Value) ===");
  lines.push("");

  // Growth vs Value
  const gv = data.modules.rotation.growthVsValue;
  lines.push(`[3] ${gv.name} (${gv.description})`);
  lines.push(`    Current: ${gv.current.toFixed(4)}`);
  lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(gv.momentum5D)} / ${formatMomentum(gv.momentum21D)} / ${formatMomentum(gv.momentum79D)}`);
  lines.push(`    Trend: ${gv.signal}`);
  if (gv.riskMode) lines.push(`    Risk Mode: ${gv.riskMode}`);
  lines.push("");

  // Consumer Health
  const ch = data.modules.rotation.consumerHealth;
  lines.push(`[4] ${ch.name} (${ch.description})`);
  lines.push(`    Current: ${ch.current.toFixed(4)}`);
  lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(ch.momentum5D)} / ${formatMomentum(ch.momentum21D)} / ${formatMomentum(ch.momentum79D)}`);
  lines.push(`    Trend: ${ch.signal}`);
  lines.push("");

  lines.push("=== C. INFLATION/DEFLATION RATIOS (Things vs Paper) ===");
  lines.push("");

  // Things vs Paper
  const tp = data.modules.inflationDeflation.thingsVsPaper;
  lines.push(`[5] ${tp.name} (${tp.description})`);
  lines.push(`    Current: ${tp.current.toFixed(4)}`);
  lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(tp.momentum5D)} / ${formatMomentum(tp.momentum21D)} / ${formatMomentum(tp.momentum79D)}`);
  lines.push(`    Trend: ${tp.signal}`);
  lines.push("");

  // Economic Health
  const eh = data.modules.inflationDeflation.ecoHealth;
  lines.push(`[6] ${eh.name} (${eh.description})`);
  lines.push(`    Current: ${eh.current.toFixed(4)}`);
  lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(eh.momentum5D)} / ${formatMomentum(eh.momentum21D)} / ${formatMomentum(eh.momentum79D)}`);
  lines.push(`    Trend: ${eh.signal}`);
  if (eh.regime) lines.push(`    Regime: ${eh.regime}`);
  lines.push("");

  // Capital Flight (Gold vs SPX)
  const cf = data.modules.inflationDeflation.capitalFlight;
  lines.push(`[7] ${cf.name} (${cf.description})`);
  lines.push(`    Current: ${cf.current.toFixed(4)}`);
  lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(cf.momentum5D)} / ${formatMomentum(cf.momentum21D)} / ${formatMomentum(cf.momentum79D)}`);
  lines.push(`    Trend: ${cf.signal}`);
  lines.push("");

  // Gamma/Vol if available
  if (data.modules.gammaVol) {
    lines.push("=== D. GAMMA/VOL REGIME ===");
    lines.push("");
    const gv = data.modules.gammaVol;
    lines.push(`[8] ${gv.name} (${gv.description})`);
    lines.push(`    Current: ${gv.current.toFixed(4)}`);
    lines.push(`    Momentum 5D/21D/79D: ${formatMomentum(gv.momentum5D)} / ${formatMomentum(gv.momentum21D)} / ${formatMomentum(gv.momentum79D)}`);
    lines.push(`    Trend: ${gv.signal}`);
    lines.push("");
  }

  lines.push("=== ANALYSIS REQUEST ===");
  lines.push("Apply your Ratio Relevance framework to analyze capital flows.");
  lines.push("Assess Wrecking Ball constraints first, then Rotation, then Inflation/Deflation.");
  lines.push("Identify any divergences or warning signals.");
  lines.push("Synthesize into a clear regime and actionable signal.");

  return lines.join("\n");
}

function formatMomentum(val: number): string {
  if (val === 0) return "0.00%";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

function parseRatioRelevanceResponse(text: string): RatioRelevanceAnalysisResult {
  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let regime: string | undefined;
  let signal: string | undefined;
  let confidence: number | undefined;

  for (const line of lines) {
    const regimeMatch = line.match(/REGIME:\s*([\w_]+)/i);
    if (regimeMatch) regime = regimeMatch[1].toUpperCase();

    const signalMatch = line.match(/SIGNAL:\s*([\w_\s]+?)(?:\s*$|\s*\[)/i);
    if (signalMatch) signal = signalMatch[1].trim().toUpperCase();

    const confMatch = line.match(/CONFIDENCE:\s*(\d+)/i);
    if (confMatch) confidence = parseInt(confMatch[1], 10);
  }

  return { logs: lines, regime, signal, confidence };
}

export async function* streamAnalyzeRatioRelevance(data: RatioRelevanceData): AsyncGenerator<string> {
  try {
    const adapter = createOpenRouterRatioAdapter();
    
    const userPrompt = `Analyze this Ratio Relevance data:

${formatRatioRelevanceData(data)}

Apply your capital flow analysis framework. Check Wrecking Ball constraints first, assess rotation patterns, evaluate inflation/deflation dynamics, and synthesize into a clear regime and signal.`;

    let buffer = "";
    
    for await (const text of adapter.stream({
      systemPrompt: RATIO_RELEVANCE_SYSTEM_PROMPT,
      userPrompt,
    })) {
      buffer += text;
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          yield trimmed;
        }
      }
    }
    
    if (buffer.trim().length > 0) {
      yield buffer.trim();
    }
    
  } catch (error) {
    void error;
    console.error("[OpenRouter] Ratio Relevance streaming error");
    yield "[KINE] ✗ Analysis engine encountered an error";
    yield "[KINE] → Analysis unavailable";
  }
}

export async function analyzeRatioRelevance(data: RatioRelevanceData): Promise<RatioRelevanceAnalysisResult> {
  try {
    const adapter = createOpenRouterRatioAdapter();
    
    const userPrompt = `Analyze this Ratio Relevance data:

${formatRatioRelevanceData(data)}

Apply your capital flow analysis framework. Check Wrecking Ball constraints first, assess rotation patterns, evaluate inflation/deflation dynamics, and synthesize into a clear regime and signal.`;

    let text = "";
    for await (const chunk of adapter.stream({
      systemPrompt: RATIO_RELEVANCE_SYSTEM_PROMPT,
      userPrompt,
    })) {
      text += chunk;
    }
    return parseRatioRelevanceResponse(text);
  } catch (error) {
    void error;
    console.error("[OpenRouter] Ratio Relevance analysis error");
    return {
      logs: [
        "[KINE] ✗ Analysis engine encountered an error",
        "[KINE] → Analysis unavailable",
      ]
    };
  }
}
