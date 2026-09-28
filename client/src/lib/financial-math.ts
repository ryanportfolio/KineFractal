export interface DailyData {
  date: string;
  close: number;
  high?: number;
  low?: number;
  open?: number;
}

export class FinancialMath {
  // --- 4. Resample Data ---
  // Groups daily data into Monthly or Quarterly bars
  static resample(data: DailyData[], timeframe: 'M' | 'Q'): DailyData[] {
    if (!data || data.length === 0) return [];

    const grouped = new Map<string, DailyData[]>();

    data.forEach(d => {
        const date = new Date(d.date);
        let key = '';
        if (timeframe === 'M') {
            // Key: YYYY-MM
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            // Key: YYYY-Qx
            const q = Math.floor(date.getMonth() / 3) + 1;
            key = `${date.getFullYear()}-Q${q}`;
        }

        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(d);
    });

    const result: DailyData[] = [];
    grouped.forEach((groupData, key) => {
        // Sort by date just in case
        groupData.sort((a, b) => a.date.localeCompare(b.date));
        
        const first = groupData[0];
        const last = groupData[groupData.length - 1];
        
        // Calculate High/Low for the period
        let periodHigh = -Infinity;
        let periodLow = Infinity;
        
        groupData.forEach(d => {
            const h = d.high !== undefined ? d.high : d.close;
            const l = d.low !== undefined ? d.low : d.close;
            if (h > periodHigh) periodHigh = h;
            if (l < periodLow) periodLow = l;
        });

        // Use the LAST date of the period as the bar date
        result.push({
            date: last.date,
            close: last.close,
            open: first.open !== undefined ? first.open : first.close,
            high: periodHigh,
            low: periodLow
        });
    });

    // Sort result by date
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  // --- 5. Calculate SMA Series ---
  static calculateSMA(data: DailyData[], period: number): number[] {
    const values = data.map(d => d.close);
    const smaArr: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            smaArr.push(NaN); // Not enough data
            continue;
        }
        
        const slice = values.slice(i - period + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        smaArr.push(sum / period);
    }
    return smaArr;
  }

  // --- 6. Calculate ROC (Rate of Change) ---
  // Returns the ROC for the last data point using proper percentage change formula
  // Formula: ((Price_Today - Price_N_Days_Ago) / Price_N_Days_Ago) * 100
  static calculateROC(data: DailyData[], period: number): number | null {
      if (!data || data.length <= period) return null;
      
      // Ensure data is sorted ascending (oldest first)
      const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
      
      const current = sortedData[sortedData.length - 1].close;
      const prev = sortedData[sortedData.length - 1 - period].close;
      
      if (prev === 0) return 0; // Avoid division by zero
      const roc = ((current - prev) / prev) * 100;
      
      // Debug logging for verification
      console.log(`[ROC] Period: ${period} days | Date: ${sortedData[sortedData.length - 1].date} | Current: ${current.toFixed(2)} | ${period} days ago: ${prev.toFixed(2)} | ROC: ${roc.toFixed(2)}%`);
      
      return roc;
  }

  // --- 1. Build Ratio Series (A / B) ---
  static buildRatio(
    symbolA: string, 
    symbolB: string, 
    dataMap: Record<string, DailyData[]>
  ): DailyData[] {
    const dataA = dataMap[symbolA];
    const dataB = dataMap[symbolB];

    if (!dataA || !dataB) return [];

    // Create Map for B for O(1) lookup
    const mapB = new Map(dataB.map(d => [d.date, d.close]));
    const ratioData: DailyData[] = [];

    // Iterate A and match with B
    dataA.forEach(pointA => {
      const priceB = mapB.get(pointA.date);
      if (priceB) {
        ratioData.push({
          date: pointA.date,
          close: pointA.close / priceB
        });
      }
    });

    // Sort by date ascending just in case
    return ratioData.sort((a, b) => a.date.localeCompare(b.date));
  }

  // --- 2. Calculate Statistics (SMA, StdDev, Z-Score) ---
  static calculateStats(data: DailyData[], period: number = 200) {
    if (data.length < period) return null;

    const current = data[data.length - 1];
    const slice = data.slice(-period);
    const values = slice.map(d => d.close);

    // SMA
    const sum = values.reduce((a, b) => a + b, 0);
    const sma = sum / period;

    // StdDev
    const squaredDiffs = values.map(v => Math.pow(v - sma, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Z-Score
    const zScore = (current.close - sma) / stdDev;

    return {
      currentPrice: current.close,
      sma,
      stdDev,
      zScore
    };
  }

  // --- 3. Calculate MACD & Velocity ---
  static calculateMACD(data: DailyData[]) {
    // Need enough data for EMA(26) + Signal(9)
    if (data.length < 35) return null;

    const values = data.map(d => d.close);
    
    // Helper: Calculate EMA Array
    const calcEMA = (vals: number[], period: number): number[] => {
        const k = 2 / (period + 1);
        const emaArr: number[] = [];
        // Start with SMA for first point
        let prevEma = vals.slice(0, period).reduce((a, b) => a + b, 0) / period;
        // Fill leading (matching index) - actually usually we just push nulls or start later
        // For simplicity, we'll just map 1-to-1 but the first 'period-1' are approximations or skipped.
        // Let's just iterate from period index.
        
        // Initialize array with nulls or matching values? 
        // Standard way: First EMA = SMA of first 'period' prices.
        for (let i = 0; i < period; i++) emaArr.push(vals[i]); // Placeholder/Approximation
        
        emaArr[period - 1] = prevEma; // Correct start

        for (let i = period; i < vals.length; i++) {
            const val = vals[i];
            const ema = (val * k) + (prevEma * (1 - k));
            emaArr.push(ema);
            prevEma = ema;
        }
        return emaArr;
    };

    const ema12 = calcEMA(values, 12);
    const ema26 = calcEMA(values, 26);

    // MACD Line = EMA12 - EMA26
    const macdLine: number[] = [];
    for (let i = 0; i < values.length; i++) {
        macdLine.push(ema12[i] - ema26[i]);
    }

    // Signal Line = EMA(9) of MACD Line
    // We need to handle the startup period of MACD line carefully? 
    // Just feed the whole macdLine into EMA function.
    const signalLine = calcEMA(macdLine, 9);

    // Histogram = MACD - Signal
    const histogram: number[] = [];
    for (let i = 0; i < values.length; i++) {
        histogram.push(macdLine[i] - signalLine[i]);
    }

    // Get current values (last index)
    const idx = values.length - 1;
    const currentHist = histogram[idx];
    const prevHist = histogram[idx - 1];
    const prevHist2 = histogram[idx - 2];

    // Velocity Reversal Logic (Last 3 days)
    // Up Reversal: Was going down, now going up? 
    // Or just changing direction? 
    // "Detect if MACD Histogram has changed direction in last 3 days"
    // Direction change: (H[t] > H[t-1] AND H[t-1] < H[t-2]) -> Bottoming/Turning Up
    // Direction change: (H[t] < H[t-1] AND H[t-1] > H[t-2]) -> Topping/Turning Down
    
    let velocityDirection = 'NEUTRAL';
    let isReversing = false;

    if (currentHist > prevHist && prevHist <= prevHist2) {
        velocityDirection = 'UP';
        isReversing = true;
    } else if (currentHist < prevHist && prevHist >= prevHist2) {
        velocityDirection = 'DOWN';
        isReversing = true;
    } else if (currentHist > prevHist) {
        velocityDirection = 'UP_TREND';
    } else {
        velocityDirection = 'DOWN_TREND';
    }

    return {
        macd: macdLine[idx],
        signal: signalLine[idx],
        histogram: currentHist,
        velocityDirection,
        isReversing
    };
  }
}
