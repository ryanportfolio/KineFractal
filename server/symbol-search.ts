// GET /charts/symbol-search?q= — ticker lookup for the chart app's "add ticker"
// boxes: "netflix" finds NFLX, "NF" lists the tickers it could be.
//
// Backed by Tiingo's search utility (the same TIINGO_API_KEY as the price
// proxy in routes.ts). Signed-in only: adding a ticker needs an account, and
// keeping anonymous typing off the Tiingo quota protects the price routes that
// share it. Answers are cached in memory per query. It sits outside /api, like
// /labels and /watchlist, so typing does not spend the site-wide API counter;
// symbolSearchLimiter in security.ts bounds it instead.
import type { Express, Request, Response } from "express";
import { sessionUser } from "./account-routes";

export type SymbolHit = { sym: string; name: string; type: "stock" | "etf" };

type TiingoSearchRow = {
  ticker?: unknown;
  name?: unknown;
  assetType?: unknown;
  isActive?: unknown;
  countryCode?: unknown;
};

const MAX_HITS = 10;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
// same shape the add route accepts (fearlab-charts.ts TICKER_RE), upper case
const TICKER_RE = /^[A-Z0-9](?:[A-Z0-9.-]{0,10}[A-Z0-9])?$/;

const cache = new Map<string, { at: number; hits: SymbolHit[] }>();

function tiingoApiKey(): string | undefined {
  return process.env.TIINGO_API_KEY?.trim() || process.env.VITE_T?.trim();
}

// Exact ticker first, then tickers that start with the query, then names with a
// word that starts with it, then the rest in Tiingo's order.
export function rankSymbolHits(query: string, rows: unknown): SymbolHit[] {
  if (!Array.isArray(rows)) return [];
  const q = query.trim().toUpperCase();
  const seen = new Set<string>();
  const hits: { hit: SymbolHit; score: number; i: number }[] = [];
  rows.forEach((row: TiingoSearchRow, i) => {
    if (!row || typeof row.ticker !== "string") return;
    if (row.isActive === false) return;
    if (typeof row.countryCode === "string" && row.countryCode.toUpperCase() !== "US") return;
    const type = String(row.assetType ?? "").toLowerCase();
    if (type !== "stock" && type !== "etf") return;   // mutual funds have no intraday candles to chart
    const sym = row.ticker.trim().toUpperCase();
    if (!TICKER_RE.test(sym) || seen.has(sym)) return;
    seen.add(sym);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const words = name.toUpperCase().split(/[^A-Z0-9]+/);
    const score = sym === q ? 0 : sym.startsWith(q) ? 1 : words.some((w) => w.startsWith(q)) ? 2 : 3;
    hits.push({ hit: { sym, name, type: type === "etf" ? "etf" : "stock" }, score, i });
  });
  return hits
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, MAX_HITS)
    .map((h) => h.hit);
}

export function registerSymbolSearchRoute(app: Express): void {
  app.get("/charts/symbol-search", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      const u = await sessionUser(req);
      if (!u) return res.status(401).json({ error: "sign in to search tickers" });
      const q = String(req.query.q ?? "").trim().slice(0, 40);
      if (!q) return res.json({ results: [] });
      const key = q.toLowerCase();
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return res.json({ results: hit.hits });

      const token = tiingoApiKey();
      if (!token) return res.status(503).json({ error: "ticker search unavailable" });
      const url = `https://api.tiingo.com/tiingo/utilities/search?query=${encodeURIComponent(q)}&token=${token}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) {
        console.error("[symbol-search] Tiingo answered", r.status);
        return res.status(502).json({ error: "ticker search failed" });
      }
      const hits = rankSymbolHits(q, await r.json());
      cache.delete(key);
      cache.set(key, { at: Date.now(), hits });
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      res.json({ results: hits });
    } catch (e: any) {
      console.error("[symbol-search] failed:", e?.message ?? e);
      res.status(502).json({ error: "ticker search failed" });
    }
  });
}
