import assert from "node:assert/strict";
import test from "node:test";
import {
  MarketDataUnavailableError,
  choosePreferredCacheEntry,
  createTiingoCache,
  type MarketDataCacheEntry,
  type MarketDataCacheStore,
} from "./tiingo-cache";

const bars = [{
  date: "2026-07-10", open: 100, high: 102, low: 99,
  close: 101, volume: 1_000, adjClose: 101,
}];

const defaultNow = () => new Date("2026-07-13T22:30:00Z");
const canonicalFields = ["date", "open", "high", "low", "close", "volume", "adjClose"] as const;

function cloneEntry(entry: MarketDataCacheEntry): MarketDataCacheEntry {
  return {
    ...entry,
    bars: entry.bars.map((bar) => ({ ...bar })),
    lastSuccessfulAt: new Date(entry.lastSuccessfulAt.getTime()),
    lastAttemptAt: new Date(entry.lastAttemptAt.getTime()),
    nextRetryAt: entry.nextRetryAt ? new Date(entry.nextRetryAt.getTime()) : null,
  };
}

class MemoryStore implements MarketDataCacheStore {
  entries = new Map<string, MarketDataCacheEntry>();

  async get(ticker: string) {
    const entry = this.entries.get(ticker);
    return entry ? cloneEntry(entry) : undefined;
  }

  async put(entry: MarketDataCacheEntry) {
    this.entries.set(entry.ticker, cloneEntry(entry));
  }

  async recordFailure(ticker: string, error: string, nextRetryAt: Date) {
    const entry = this.entries.get(ticker);
    if (entry) this.entries.set(ticker, cloneEntry({
      ...entry,
      lastError: error,
      nextRetryAt: new Date(nextRetryAt.getTime()),
    }));
  }

  async clear(ticker?: string) {
    if (ticker) this.entries.delete(ticker);
    else this.entries.clear();
  }
}

class SlowPutStore extends MemoryStore {
  private signalPutStarted!: () => void;
  private releasePut!: () => void;
  readonly putStarted = new Promise<void>((resolve) => {
    this.signalPutStarted = resolve;
  });
  readonly putReleased = new Promise<void>((resolve) => {
    this.releasePut = resolve;
  });

  releaseBlockedPut(): void {
    this.releasePut();
  }

  override async put(entry: MarketDataCacheEntry) {
    this.signalPutStarted();
    await this.putReleased;
    await super.put(entry);
  }
}

test("keeps a newer verified series when merging a later failed attempt", () => {
  const local: MarketDataCacheEntry = {
    ticker: "SPY",
    bars,
    marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-13T23:00:00Z"),
    nextRetryAt: new Date("2026-07-13T23:15:00Z"),
    lastError: "Tiingo refresh failed",
  };
  const mondayBars = [{ ...bars[0], date: "2026-07-13", close: 103, adjClose: 103 }];
  const remote: MarketDataCacheEntry = {
    ticker: "SPY",
    bars: mondayBars,
    marketDate: "2026-07-13",
    lastSuccessfulAt: new Date("2026-07-13T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-13T22:30:00Z"),
    nextRetryAt: null,
    lastError: null,
  };

  const selected = choosePreferredCacheEntry(local, remote);

  assert.deepEqual(selected.bars, mondayBars);
  assert.equal(selected.marketDate, "2026-07-13");
  assert.equal(selected.lastSuccessfulAt.toISOString(), "2026-07-13T22:30:00.000Z");
  assert.equal(selected.lastAttemptAt.toISOString(), "2026-07-13T23:00:00.000Z");
  assert.equal(selected.nextRetryAt?.toISOString(), "2026-07-13T23:15:00.000Z");
  assert.equal(selected.lastError, "Tiingo refresh failed");
});

test("coalesces concurrent cold refreshes", async () => {
  const store = new MemoryStore();
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-13T23:00:00Z") });
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    await Promise.resolve();
    return bars;
  };

  const [a, b] = await Promise.all([
    cache.getOrFetch("spy", fetcher),
    cache.getOrFetch("SPY", fetcher),
  ]);

  assert.equal(calls, 1);
  assert.equal(a.freshness.state, "fresh");
  assert.equal(b.freshness.state, "fresh");
});

test("does not repopulate a ticker after clear races an in-flight refresh", async () => {
  const store = new MemoryStore();
  const cache = createTiingoCache({ store, now: defaultNow });
  let resolveFetch!: (value: typeof bars) => void;
  let markFetchStarted!: () => void;
  const fetchStarted = new Promise<void>((resolve) => {
    markFetchStarted = resolve;
  });

  const pending = cache.getOrFetch("SPY", () => {
    markFetchStarted();
    return new Promise<typeof bars>((resolve) => {
      resolveFetch = resolve;
    });
  });
  await fetchStarted;

  await cache.clear("SPY");
  resolveFetch(bars);
  await pending;

  assert.equal(await store.get("SPY"), undefined);
});

test("does not leave a ticker behind when clear races a blocked daily-cache write", async () => {
  const store = new SlowPutStore();
  const cache = createTiingoCache({ store, now: defaultNow });

  const refresh = cache.getOrFetch("SPY", async () => bars);
  await store.putStarted;

  const clear = cache.clear("SPY");
  store.releaseBlockedPut();
  await Promise.all([clear, refresh]);

  assert.equal(await store.get("SPY"), undefined);
});

test("uses last verified data after an upstream failure", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-13T23:00:00Z") });

  const result = await cache.getOrFetch("SPY", async () => {
    throw new Error("429 Too Many Requests");
  });

  assert.equal(result.freshness.state, "stale");
  assert.equal(result.freshness.marketDate, "2026-07-10");
  assert.deepEqual(result.bars, bars);
});

test("records the failed refresh attempt without replacing the last successful timestamp", async () => {
  const store = new MemoryStore();
  const lastSuccessfulAt = new Date("2026-07-10T22:30:00Z");
  const attemptedAt = new Date("2026-07-13T23:00:00Z");
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt,
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => attemptedAt });

  const result = await cache.getOrFetch("SPY", async () => {
    throw new Error("429 Too Many Requests");
  });

  const stored = await store.get("SPY");
  assert.equal(result.freshness.state, "stale");
  assert.equal(stored?.lastAttemptAt.toISOString(), attemptedAt.toISOString());
  assert.equal(stored?.lastSuccessfulAt.toISOString(), lastSuccessfulAt.toISOString());
});

test("redacts Tiingo tokens from stale warnings and persisted errors", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: defaultNow });

  const result = await cache.getOrFetch("SPY", async () => {
    throw new Error("Tiingo request failed: https://api.tiingo.com/tiingo/daily/SPY?token=secret-token-value");
  });

  const stored = await store.get("SPY");
  assert.equal(result.freshness.state, "stale");
  assert.equal(result.freshness.warning, "Tiingo refresh failed");
  assert.equal(stored?.lastError, "Tiingo refresh failed");
  assert.doesNotMatch(result.freshness.warning ?? "", /secret-token-value/);
  assert.doesNotMatch(stored?.lastError ?? "", /secret-token-value/);
});

test("serves a completed cache before its next New York refresh window", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-13T22:29:59Z") });

  const result = await cache.getOrFetch("SPY", async () => {
    throw new Error("fetch must not run");
  });

  assert.equal(result.freshness.state, "cache");
});

test("fails a cold cache instead of returning a zero-capable payload", async () => {
  const cache = createTiingoCache({ store: new MemoryStore(), now: defaultNow });

  await assert.rejects(
    cache.getOrFetch("SPY", async () => {
      throw new Error("429 Too Many Requests");
    }),
    MarketDataUnavailableError,
  );
});

test("classifies a cold Axios 429 without exposing its Tiingo token", async () => {
  const cache = createTiingoCache({ store: new MemoryStore(), now: defaultNow });
  const upstreamError = Object.assign(
    new Error("Tiingo request failed: https://api.tiingo.com/tiingo/daily/SPY?token=secret-token-value"),
    { response: { status: 429 } },
  );

  await assert.rejects(
    cache.getOrFetch("SPY", async () => {
      throw upstreamError;
    }),
    (error: unknown) => {
      assert(error instanceof MarketDataUnavailableError);
      const classified = error as MarketDataUnavailableError & {
        category?: string;
        upstreamStatus?: number;
      };
      assert.equal(classified.causeMessage, "Tiingo refresh failed");
      assert.equal(classified.category, "rate_limited");
      assert.equal(classified.upstreamStatus, 429);
      assert.doesNotMatch(classified.message, /secret-token-value/);
      return true;
    },
  );
});

test("retries a stale cache refresh at exactly its 15-minute backoff boundary", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  let now = new Date("2026-07-13T22:30:00Z");
  const cache = createTiingoCache({ store, now: () => now });
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    throw new Error("429 Too Many Requests");
  };

  await cache.getOrFetch("SPY", fetcher);
  now = new Date("2026-07-13T22:44:59.999Z");
  await cache.getOrFetch("SPY", fetcher);
  now = new Date("2026-07-13T22:45:00.000Z");
  await cache.getOrFetch("SPY", fetcher);

  const entry = await store.get("SPY");
  assert.equal(calls, 2);
  assert.equal(entry?.lastError, "Tiingo refresh failed");
  assert.equal(entry?.nextRetryAt?.toISOString(), "2026-07-13T23:00:00.000Z");
});

test("retries a cold cache at its 15-minute backoff boundary", async () => {
  let now = new Date("2026-07-13T22:30:00Z");
  const cache = createTiingoCache({ store: new MemoryStore(), now: () => now });
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    throw new Error("429 Too Many Requests");
  };

  await assert.rejects(cache.getOrFetch("SPY", fetcher), MarketDataUnavailableError);
  now = new Date("2026-07-13T22:44:59.999Z");
  await assert.rejects(cache.getOrFetch("SPY", fetcher), MarketDataUnavailableError);
  now = new Date("2026-07-13T22:45:00.000Z");
  await assert.rejects(cache.getOrFetch("SPY", fetcher), MarketDataUnavailableError);

  assert.equal(calls, 2);
});

test("serves a cold-cache success for the rest of the refresh window", async () => {
  const store = new MemoryStore();
  const cache = createTiingoCache({ store, now: defaultNow });
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return bars;
  };

  const first = await cache.getOrFetch("SPY", fetcher);
  const cacheAfterRestart = createTiingoCache({ store, now: defaultNow });
  const second = await cacheAfterRestart.getOrFetch("SPY", async () => {
    calls += 1;
    throw new Error("fetch must not run");
  });

  assert.equal(calls, 1);
  assert.equal(first.freshness.state, "fresh");
  assert.equal(second.freshness.state, "cache");
});

test("refreshes a completed cache at the Monday 18:30 New York boundary", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-13T22:30:00Z") });
  const refreshedBars = [{ ...bars[0], date: "2026-07-13", close: 103, adjClose: 103 }];
  let calls = 0;

  const result = await cache.getOrFetch("SPY", async () => {
    calls += 1;
    return refreshedBars;
  });

  assert.equal(calls, 1);
  assert.equal(result.freshness.state, "fresh");
  assert.deepEqual(result.bars, refreshedBars);
});

test("uses the 18:30 EST refresh boundary in winter", async () => {
  const store = new MemoryStore();
  const winterBars = [{ ...bars[0], date: "2026-01-09" }];
  store.entries.set("SPY", {
    ticker: "SPY", bars: winterBars, marketDate: "2026-01-09",
    lastSuccessfulAt: new Date("2026-01-09T23:30:00Z"),
    lastAttemptAt: new Date("2026-01-09T23:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  let now = new Date("2026-01-12T23:29:59Z");
  const cache = createTiingoCache({ store, now: () => now });
  const refreshedBars = [{ ...bars[0], date: "2026-01-12", close: 103, adjClose: 103 }];
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return refreshedBars;
  };

  const beforeBoundary = await cache.getOrFetch("SPY", fetcher);
  now = new Date("2026-01-12T23:30:00Z");
  const atBoundary = await cache.getOrFetch("SPY", fetcher);

  assert.equal(calls, 1);
  assert.equal(beforeBoundary.freshness.state, "cache");
  assert.equal(atBoundary.freshness.state, "fresh");
  assert.deepEqual(atBoundary.bars, refreshedBars);
});

test("catches up missed refresh windows on the next request outside a window", async () => {
  // Production state on 2026-10-01: last attempt 2026-08-20 18:37 New York, and
  // no request had landed inside a weekday 18:30-24:00 window since.
  const store = new MemoryStore();
  const augustBars = [{ ...bars[0], date: "2026-08-20" }];
  store.entries.set("SPY", {
    ticker: "SPY", bars: augustBars, marketDate: "2026-08-20",
    lastSuccessfulAt: new Date("2026-08-20T22:37:23Z"),
    lastAttemptAt: new Date("2026-08-20T22:37:23Z"),
    nextRetryAt: null, lastError: null,
  });
  const now = new Date("2026-10-01T21:55:00Z"); // Thursday 17:55 New York
  const cache = createTiingoCache({ store, now: () => now });
  const refreshedBars = [{ ...bars[0], date: "2026-09-30", close: 103, adjClose: 103 }];
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return refreshedBars;
  };

  const first = await cache.getOrFetch("SPY", fetcher);
  const second = await cache.getOrFetch("SPY", fetcher);

  assert.equal(calls, 1);
  assert.equal(first.freshness.state, "fresh");
  assert.equal(first.freshness.marketDate, "2026-09-30");
  assert.equal(second.freshness.state, "cache");
});

test("catches up a missed Friday window over the weekend", async () => {
  const store = new MemoryStore();
  const thursdayBars = [{ ...bars[0], date: "2026-07-09" }];
  store.entries.set("SPY", {
    ticker: "SPY", bars: thursdayBars, marketDate: "2026-07-09",
    lastSuccessfulAt: new Date("2026-07-09T23:00:00Z"),
    lastAttemptAt: new Date("2026-07-09T23:00:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-11T15:00:00Z") });
  let calls = 0;

  const result = await cache.getOrFetch("SPY", async () => {
    calls += 1;
    return bars;
  });

  assert.equal(calls, 1);
  assert.equal(result.freshness.state, "fresh");
  assert.equal(result.freshness.marketDate, "2026-07-10");
});

test("serves the cache the morning after a refresh in the previous evening's window", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-13T23:00:00Z"),
    lastAttemptAt: new Date("2026-07-13T23:00:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-14T14:00:00Z") });
  let calls = 0;

  const result = await cache.getOrFetch("SPY", async () => {
    calls += 1;
    return bars;
  });

  assert.equal(calls, 0);
  assert.equal(result.freshness.state, "cache");
});

test("serves a verified cache on a weekend without invoking the fetcher", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-11T22:30:00Z") });
  let calls = 0;

  const result = await cache.getOrFetch("SPY", async () => {
    calls += 1;
    return bars;
  });

  assert.equal(calls, 0);
  assert.equal(result.freshness.state, "cache");
  assert.deepEqual(result.bars, bars);
});

test("rejects incomplete fetched bars from a cold cache", async () => {
  const store = new MemoryStore();
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-13T22:30:00Z") });
  const incompleteBars = [{ ...bars[0], volume: undefined }] as unknown as typeof bars;

  await assert.rejects(
    cache.getOrFetch("SPY", async () => incompleteBars),
    (error: unknown) => error instanceof MarketDataUnavailableError && error.ticker === "SPY",
  );
  assert.equal(await store.get("SPY"), undefined);
});

test("refreshes malformed stored data instead of serving it", async () => {
  const store = new MemoryStore();
  const malformedBars = [{ ...bars[0], volume: undefined }] as unknown as typeof bars;
  store.entries.set("SPY", {
    ticker: "SPY", bars: malformedBars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: defaultNow });
  let calls = 0;

  const result = await cache.getOrFetch("SPY", async () => {
    calls += 1;
    return bars;
  });

  assert.equal(calls, 1);
  assert.equal(result.freshness.state, "fresh");
  assert.deepEqual(result.bars, bars);
  assert.deepEqual((await store.get("SPY"))?.bars, bars);
});

test("rejects an upstream failure instead of serving malformed stored data as stale", async () => {
  const store = new MemoryStore();
  const malformedBars = [{ ...bars[0], volume: undefined }] as unknown as typeof bars;
  store.entries.set("SPY", {
    ticker: "SPY", bars: malformedBars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: defaultNow });
  let calls = 0;

  await assert.rejects(
    cache.getOrFetch("SPY", async () => {
      calls += 1;
      throw new Error("429 Too Many Requests");
    }),
    (error: unknown) => error instanceof MarketDataUnavailableError && error.ticker === "SPY",
  );

  assert.equal(calls, 1);
});

for (const field of canonicalFields) {
  test(`rejects fetched bars missing required ${field}`, async () => {
    const cache = createTiingoCache({ store: new MemoryStore(), now: defaultNow });
    const invalidBars = [{ ...bars[0], [field]: undefined }] as unknown as typeof bars;

    await assert.rejects(
      cache.getOrFetch("SPY", async () => invalidBars),
      (error: unknown) => error instanceof MarketDataUnavailableError && error.ticker === "SPY",
    );
  });

  test(`refreshes stored bars missing required ${field}`, async () => {
    const store = new MemoryStore();
    const invalidBars = [{ ...bars[0], [field]: undefined }] as unknown as typeof bars;
    store.entries.set("SPY", {
      ticker: "SPY", bars: invalidBars, marketDate: "2026-07-10",
      lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
      lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
      nextRetryAt: null, lastError: null,
    });
    const cache = createTiingoCache({ store, now: defaultNow });
    let calls = 0;

    const result = await cache.getOrFetch("SPY", async () => {
      calls += 1;
      return bars;
    });

    assert.equal(calls, 1);
    assert.equal(result.freshness.state, "fresh");
    assert.deepEqual(result.bars, bars);
    assert.deepEqual((await store.get("SPY"))?.bars, bars);
  });
}

test("rejects an empty fetched series from a cold cache", async () => {
  const cache = createTiingoCache({ store: new MemoryStore(), now: defaultNow });

  await assert.rejects(
    cache.getOrFetch("SPY", async () => []),
    (error: unknown) => error instanceof MarketDataUnavailableError && error.ticker === "SPY",
  );
});

test("keeps complete last-good data when a refresh returns partial bars", async () => {
  const store = new MemoryStore();
  const lastSuccessfulAt = new Date("2026-07-10T22:30:00Z");
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt,
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-13T22:30:00Z") });
  const incompleteBars = [{ ...bars[0], date: "2026-07-13", adjClose: undefined }] as unknown as typeof bars;

  const result = await cache.getOrFetch("SPY", async () => incompleteBars);

  assert.equal(result.freshness.state, "stale");
  assert.equal(result.freshness.marketDate, "2026-07-10");
  assert.deepEqual(result.bars, bars);
  const stored = await store.get("SPY");
  assert.deepEqual(stored?.bars, bars);
  assert.equal(stored?.marketDate, "2026-07-10");
  assert.equal(stored?.lastSuccessfulAt.toISOString(), lastSuccessfulAt.toISOString());
});

test("reports the actual final bar date after a fresh response", async () => {
  const store = new MemoryStore();
  const cache = createTiingoCache({ store, now: () => new Date("2026-07-13T22:30:00Z") });
  const freshBars = [
    { ...bars[0], date: "2026-07-09" },
    { ...bars[0], date: "2026-07-10", close: 102, adjClose: 102 },
  ];

  const result = await cache.getOrFetch("SPY", async () => freshBars);

  assert.equal(result.freshness.state, "fresh");
  assert.equal(result.freshness.marketDate, "2026-07-10");
  assert.equal((await store.get("SPY"))?.marketDate, "2026-07-10");
});

test("consumes a weekday refresh window when a holiday-like response has no new bar", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: defaultNow });
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return bars;
  };

  const first = await cache.getOrFetch("SPY", fetcher);
  const cacheAfterRestart = createTiingoCache({ store, now: defaultNow });
  const second = await cacheAfterRestart.getOrFetch("SPY", async () => {
    calls += 1;
    throw new Error("fetch must not run");
  });

  assert.equal(calls, 1);
  assert.equal(second.freshness.state, "cache");
  assert.equal(first.freshness.marketDate, "2026-07-10");
  assert.equal(second.freshness.marketDate, "2026-07-10");
  const stored = await store.get("SPY");
  assert.equal(stored?.marketDate, "2026-07-10");
  assert.equal(stored?.lastAttemptAt.toISOString(), defaultNow().toISOString());
});

test("reuses persisted data across fresh cache instances", async () => {
  const store = new MemoryStore();
  const cacheA = createTiingoCache({ store, now: defaultNow });
  await cacheA.getOrFetch("SPY", async () => bars);

  const cacheB = createTiingoCache({ store, now: defaultNow });
  let calls = 0;
  const result = await cacheB.getOrFetch("SPY", async () => {
    calls += 1;
    throw new Error("fetch must not run");
  });

  assert.equal(calls, 0);
  assert.equal(result.freshness.state, "cache");
  assert.deepEqual(result.bars, bars);
});

test("rejects a failed refresh when the stored bar series is empty", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars: [], marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: defaultNow });
  let calls = 0;

  await assert.rejects(
    cache.getOrFetch("SPY", async () => {
      calls += 1;
      throw new Error("429 Too Many Requests");
    }),
    (error: unknown) => error instanceof MarketDataUnavailableError && error.ticker === "SPY",
  );

  assert.equal(calls, 1);
});

test("recovers a stored empty bar series with a valid refresh", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars: [], marketDate: "2026-07-10",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: defaultNow });
  let calls = 0;

  const result = await cache.getOrFetch("SPY", async () => {
    calls += 1;
    return bars;
  });

  assert.equal(calls, 1);
  assert.equal(result.freshness.state, "fresh");
  assert.deepEqual(result.bars, bars);
  assert.deepEqual((await store.get("SPY"))?.bars, bars);
});

test("repairs a stored market date that disagrees with its final bar", async () => {
  const store = new MemoryStore();
  store.entries.set("SPY", {
    ticker: "SPY", bars, marketDate: "2026-07-13",
    lastSuccessfulAt: new Date("2026-07-10T22:30:00Z"),
    lastAttemptAt: new Date("2026-07-10T22:30:00Z"),
    nextRetryAt: null, lastError: null,
  });
  const cache = createTiingoCache({ store, now: defaultNow });
  let calls = 0;

  const result = await cache.getOrFetch("SPY", async () => {
    calls += 1;
    return bars;
  });

  assert.equal(calls, 1);
  assert.equal(result.freshness.state, "fresh");
  assert.equal(result.freshness.marketDate, "2026-07-10");
  assert.equal((await store.get("SPY"))?.marketDate, "2026-07-10");
});

test("refreshes again in the next New York weekday window", async () => {
  let now = new Date("2026-07-13T22:30:00Z");
  const cache = createTiingoCache({ store: new MemoryStore(), now: () => now });
  const mondayBars = [{ ...bars[0], date: "2026-07-13", close: 103, adjClose: 103 }];
  const tuesdayBars = [{ ...bars[0], date: "2026-07-14", close: 104, adjClose: 104 }];
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return calls === 1 ? mondayBars : tuesdayBars;
  };

  const monday = await cache.getOrFetch("SPY", fetcher);
  now = new Date("2026-07-14T22:30:00Z");
  const tuesday = await cache.getOrFetch("SPY", fetcher);

  assert.equal(calls, 2);
  assert.equal(monday.freshness.state, "fresh");
  assert.equal(monday.freshness.marketDate, "2026-07-13");
  assert.equal(tuesday.freshness.state, "fresh");
  assert.equal(tuesday.freshness.marketDate, "2026-07-14");
  assert.deepEqual(tuesday.bars, tuesdayBars);
});
