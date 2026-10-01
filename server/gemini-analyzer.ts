import { createOpenRouterRatioAdapter } from "./openrouter-ratio";

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
