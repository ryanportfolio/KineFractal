// Nadaraya-Watson envelope for the /charts page: a smoothed centre line with a band above and
// below it, the "on-the-day" version of the TradingView indicator. Every value at bar t is
// worked out from prices up to bar t only, so a band never changes after its bar has closed.
//
// A plain script with no page or network access: load it with a <script src> tag, or in Node
// with vm.runInContext. It sets one global, NWEnvelope.
//
// For a source series x, a bandwidth bw and a multiplier mult, with N = 500:
//   coef(k)   = exp(-k^2 / (2 * bw^2))
//   centre[t] = sum of x[t-k] * coef(k) over k = 0..K, divided by the sum of coef(k),
//               K = min(N-1, t)
//   half[t], width "alert" = mult * mean of |x[i] - centre[i]| over the last L bars,
//               L = min(N-1, t+1)
//   half[t], width "edge"  = mult * sum of |x[i] - y[i]| over the window a..t, divided by
//               max(W-1, 1), where W = min(N, t+1), a = t-W+1, and y[i] is the kernel
//               average of the window around bar i:
//               y[i] = sum of x[j] * coef(|i-j|) over j = a..t, divided by the sum of
//               coef(|i-j|)
//   lower = centre - half, upper = centre + half
// Values exist for every bar from the first one.
(function () {
  'use strict';

  // the most bars any one value looks back over, fixed by the indicator
  var N = 500;
  var SOURCES = ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4'];
  var WIDTHS = ['edge', 'alert'];
  var DEFAULTS = { bandwidth: 17, mult: 2.4, source: 'low', width: 'edge' };

  // one number per candle: a single price, or an average of several
  function source(candles, kind) {
    if (SOURCES.indexOf(kind) < 0) throw new RangeError('unknown source: ' + kind);
    var n = candles.length;
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var c = candles[i];
      if (kind === 'open') out[i] = c.open;
      else if (kind === 'high') out[i] = c.high;
      else if (kind === 'low') out[i] = c.low;
      else if (kind === 'close') out[i] = c.close;
      else if (kind === 'hl2') out[i] = (c.high + c.low) / 2;
      else if (kind === 'hlc3') out[i] = (c.high + c.low + c.close) / 3;
      else out[i] = (c.open + c.high + c.low + c.close) / 4;
    }
    return out;
  }

  // kernel weight for bars k apart, k = 0..N-1. A very small bandwidth gives 0 for every
  // k above 0, a very large one gives 1 throughout.
  function kernel(bandwidth) {
    var coef = new Float64Array(N);
    var denom = 2 * bandwidth * bandwidth;
    coef[0] = 1;
    for (var k = 1; k < N; k++) coef[k] = Math.exp(-(k * k) / denom);
    return coef;
  }

  // "alert" width: the centre is a weighted average of the last N bars, the half-width a
  // plain average of how far the last N-1 bars sat from their own centre.
  function alertBands(x, coef, mult, centre, half) {
    var n = x.length;
    var err = new Float64Array(n);
    for (var t = 0; t < n; t++) {
      var K = t < N - 1 ? t : N - 1;
      var acc = 0, wsum = 0;
      for (var k = 0; k <= K; k++) { acc += x[t - k] * coef[k]; wsum += coef[k]; }
      centre[t] = acc / wsum;
      err[t] = Math.abs(x[t] - centre[t]);
      var L = t + 1 < N - 1 ? t + 1 : N - 1;
      var sum = 0;
      for (var i = t - L + 1; i <= t; i++) sum += err[i];
      half[t] = mult * (sum / L);
    }
  }

  // "edge" width. For the window a..t, the kernel average around bar i splits at bar i:
  //   left part  = sum of x[i-k] * coef(k) for k = 0..i-a   (bar i and the bars before it)
  //   right part = sum of x[i+k] * coef(k) for k = 1..t-i   (the bars after it)
  // Summing every window from scratch costs W * W steps per bar. Both parts can be carried
  // from bar to bar instead, with nothing left out and nothing rounded off:
  // - The right part of bar i gains one term each time a new bar arrives: right[i].
  // - The left part of bar i has a different length in each window that holds bar i,
  //   because the window start a moves. When bar i arrives, one pass over the bars behind
  //   it gives the left part for every start a = i-k, and tab keeps each one in the row
  //   of its window start, so one window later reads a single row from end to end. A row
  //   is finished with once its window has passed, so N rows are enough.
  // That leaves about 2 * N steps per bar whatever the bandwidth.
  function edgeBands(x, coef, mult, centre, half) {
    var n = x.length;
    // cs[m] = coef(0) + ... + coef(m); csr[m] = coef(1) + ... + coef(m)
    var cs = new Float64Array(N), csr = new Float64Array(N);
    var k, acc = 0;
    for (k = 0; k < N; k++) { acc += coef[k]; cs[k] = acc; }
    for (acc = 0, k = 1; k < N; k++) { acc += coef[k]; csr[k] = acc; }

    // tab[(a % N) * N + d] = left part of bar a+d in a window that starts at bar a
    var tab = new Float64Array(N * N);
    var right = new Float64Array(n);

    for (var t = 0; t < n; t++) {
      // the new bar's left parts, one per window start t, t-1, ... t-K
      var K = t < N - 1 ? t : N - 1;
      var slot = t % N;
      acc = 0;
      for (k = 0; k <= K; k++) {
        acc += x[t - k] * coef[k];
        tab[slot * N + k] = acc;
        slot = slot === 0 ? N - 1 : slot - 1;
      }
      // the longest left part is the centre line's weighted sum
      centre[t] = acc / cs[K];

      var a = t - K;
      var row = (a % N) * N;
      var xt = x[t];
      var sum = 0;
      for (var i = a, d = 0, r = K; i < t; i++, d++, r--) {
        var rs = right[i] + xt * coef[r];
        right[i] = rs;
        var e = x[i] - (tab[row + d] + rs) / (cs[d] + csr[r]);
        sum += e < 0 ? -e : e;
      }
      // the newest bar has nothing to its right, so its kernel average is the centre
      sum += Math.abs(xt - centre[t]);
      half[t] = mult * sum / (K > 1 ? K : 1);
    }
  }

  // the centre line and the half-width of the band, one value per source value.
  // width: 'edge' or 'alert' (see the top of this file).
  function envelope(src, bandwidth, mult, width) {
    if (WIDTHS.indexOf(width) < 0) throw new RangeError('width must be "edge" or "alert"');
    if (typeof bandwidth !== 'number' || !isFinite(bandwidth) || bandwidth <= 0) {
      throw new RangeError('bandwidth must be a finite number above 0');
    }
    if (typeof mult !== 'number' || !isFinite(mult) || mult < 0) {
      throw new RangeError('mult must be a finite number, 0 or above');
    }
    var n = src.length;
    var x = new Float64Array(n);
    for (var i = 0; i < n; i++) x[i] = +src[i];
    var centre = new Float64Array(n), half = new Float64Array(n);
    var coef = kernel(bandwidth);
    if (width === 'alert') alertBands(x, coef, mult, centre, half);
    else edgeBands(x, coef, mult, centre, half);
    return { centre: centre, half: half };
  }

  // bars where the source crosses out of the band: `up` when it drops below the lower band
  // (the bar before was on or above it), `down` when it rises above the upper band (the bar
  // before was on or below it). Bar indexes, oldest first.
  function marks(src, centre, half) {
    var up = [], down = [];
    for (var t = 1; t < src.length; t++) {
      if (src[t] < centre[t] - half[t] && src[t - 1] >= centre[t - 1] - half[t - 1]) up.push(t);
      if (src[t] > centre[t] + half[t] && src[t - 1] <= centre[t - 1] + half[t - 1]) down.push(t);
    }
    return { up: up, down: down };
  }

  globalThis.NWEnvelope = {
    N: N,
    SOURCES: SOURCES,
    WIDTHS: WIDTHS,
    DEFAULTS: DEFAULTS,
    source: source,
    envelope: envelope,
    marks: marks
  };
})();
