import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  type TickerCache,
  type InsertTickerCache,
  tickerCache,
} from "@shared/schema";

// Fundamentals ticker cache over the shared Railway Postgres handle (server/db.ts).
// Degrades gracefully when no database is configured — reads miss, writes no-op.

export interface IStorage {
  getTickerCache(ticker: string): Promise<TickerCache | undefined>;
  upsertTickerCache(cache: InsertTickerCache): Promise<TickerCache>;
  clearTickerCache(ticker?: string): Promise<void>;
}

class PostgresStorage implements IStorage {
  async getTickerCache(ticker: string): Promise<TickerCache | undefined> {
    if (!db) return undefined;
    try {
      const result = await db
        .select()
        .from(tickerCache)
        .where(eq(tickerCache.ticker, ticker.toUpperCase()))
        .limit(1);
      return result[0];
    } catch {
      console.error("Fundamentals cache read failed");
      return undefined;
    }
  }

  async upsertTickerCache(cache: InsertTickerCache): Promise<TickerCache> {
    const fallback = () => ({
      id: "nocache",
      ticker: cache.ticker,
      fundamentals: cache.fundamentals,
      fetchedAt: new Date(),
      updatedAt: new Date(),
    } as TickerCache);
    if (!db) return fallback();
    try {
      const upperTicker = cache.ticker.toUpperCase();
      const result = await db
        .insert(tickerCache)
        .values({ ...cache, ticker: upperTicker })
        .onConflictDoUpdate({
          target: tickerCache.ticker,
          set: {
            fundamentals: cache.fundamentals,
            fetchedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();
      return result[0];
    } catch {
      console.error("Fundamentals cache write failed");
      return fallback();
    }
  }

  async clearTickerCache(ticker?: string): Promise<void> {
    if (!db) return;
    try {
      if (ticker) {
        await db.delete(tickerCache).where(eq(tickerCache.ticker, ticker.toUpperCase()));
      } else {
        await db.delete(tickerCache);
      }
    } catch {
      console.error("Fundamentals cache clear failed");
      throw new Error("Fundamentals cache clear failed");
    }
  }
}

export const storage = new PostgresStorage();
