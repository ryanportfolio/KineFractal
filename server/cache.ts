import fs from 'fs-extra';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'server', 'cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: any;
  timestamp: number;
}

interface CacheData {
  [ticker: string]: CacheEntry;
}

export async function getCache(ticker: string): Promise<any | null> {
  try {
    if (!await fs.pathExists(CACHE_FILE)) {
      return null;
    }
    
    const cacheData: CacheData = await fs.readJson(CACHE_FILE);
    const entry = cacheData[ticker.toUpperCase()];
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL_MS) {
      console.log(`[Cache] ${ticker} expired (age: ${((now - entry.timestamp) / (1000 * 60 * 60)).toFixed(1)}h)`);
      return null;
    }
    
    console.log(`[Cache] HIT for ${ticker} (age: ${((now - entry.timestamp) / (1000 * 60 * 60)).toFixed(1)}h)`);
    return entry.data;
  } catch (error) {
    console.error('[Cache] Read error:', error);
    return null;
  }
}

export async function setCache(ticker: string, data: any): Promise<void> {
  try {
    let cacheData: CacheData = {};
    
    if (await fs.pathExists(CACHE_FILE)) {
      cacheData = await fs.readJson(CACHE_FILE);
    }
    
    cacheData[ticker.toUpperCase()] = {
      data,
      timestamp: Date.now()
    };
    
    await fs.writeJson(CACHE_FILE, cacheData, { spaces: 2 });
    console.log(`[Cache] SAVED ${ticker} (${Array.isArray(data) ? data.length : 0} quarters)`);
  } catch (error) {
    console.error('[Cache] Write error:', error);
  }
}

export async function clearCache(ticker?: string): Promise<void> {
  try {
    if (ticker) {
      if (await fs.pathExists(CACHE_FILE)) {
        const cacheData: CacheData = await fs.readJson(CACHE_FILE);
        delete cacheData[ticker.toUpperCase()];
        await fs.writeJson(CACHE_FILE, cacheData, { spaces: 2 });
        console.log(`[Cache] Cleared ${ticker}`);
      }
    } else {
      await fs.remove(CACHE_FILE);
      console.log('[Cache] Cleared all');
    }
  } catch (error) {
    console.error('[Cache] Clear error:', error);
  }
}
