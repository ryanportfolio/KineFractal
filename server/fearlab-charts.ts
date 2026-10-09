// /charts/ page and its data proxy.
//
// The page DOCUMENT is this site's own chart app, server/charts-app/charts.html,
// edited in this repo and shipped with the image (Dockerfile COPY
// server/charts-app). It started as a copy of the engine repo's local chart
// viewer; the two are now separate files and this one is not synced from range.
//
// Chart DATA still comes from the engine: the nightly Railway worker publishes
// it under the staged run's `charts-app/` prefix and the latest.json pointer:
//
//   <env-prefix>/runs/<td>/charts-app/assets/lightweight-charts.standalone.production.js
//   <env-prefix>/runs/<td>/charts-app/assets/kf-theme.css
//   <env-prefix>/runs/<td>/charts-app/assets/fonts/{jetbrainsmono,spacegrotesk,orbitron}.woff2
//   <env-prefix>/runs/<td>/charts-app/dashboard/data-index.js
//   <env-prefix>/runs/<td>/charts-app/dashboard/data-charts-extra.js
//   <env-prefix>/runs/<td>/charts-app/dashboard/data-<key>.js
//   <env-prefix>/runs/<td>/charts-app/dashboard/overlays-<key>.js
//
// The page loads those through RELATIVE paths ("dashboard/...", "assets/..."),
// so it is served at the trailing-slash path /charts/ (GET /charts 301s there)
// and the relative URLs resolve to /charts/dashboard/* and /charts/assets/*.
//
// Graceful degradations on the site (charts.html handles all of these
// client-side already; the /labels + /watchlist stubs below only make sure
// the SPA catch-all never answers them with HTML-200):
//   - board combo dropdown is empty (cloud publishes no v2 combos) — the page
//     falls back to the SPY super chart;
//   - hand-drawn lines: signed-in users get per-account server persistence
//     (chart_lines table — the /labels routes below implement the local
//     label-server protocol); signed-out users fall back to browser
//     localStorage exactly as before;
//   - "+ Add" ticker: signed-in users get live per-account ticker builds
//     (chart_symbols/symbol_requests tables + the chart-builder service —
//     see registerChartSymbolRoutes); signed-out users get a signup CTA;
//   - the "email" button opens the site's /alerts page;
//   - darkpool/gex/uoa layers are absent from cloud overlays (null-guarded).
//
// Failure model matches the /api/fearlab/* routes: bucket env unset or
// pointer unreachable => 503; object missing in the run => 404.

import { readFile } from "node:fs/promises";
import path from "node:path";
import express, { type Express, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { chartLines, chartPreferences, chartSymbols, symbolRequests } from "@shared/schema";
import { sessionUser } from "./account-routes";
import {
  getLatestPointer,
  getRunArtifactBytes,
  getRunArtifactText,
  isConfigured,
} from "./fearlab-live";

const CHARTS_CACHE = "public, max-age=300"; // worker publishes 1x/night;
// charts.html additionally cache-busts its dashboard/* loads with ?v=Date.now()
// The page document ships with each deploy and must revalidate on every navigation;
// otherwise a just-deployed interaction fix can remain stale in an open browser.
const CHARTS_DOCUMENT_CACHE = "no-cache";

// The page document bundled with this service (Dockerfile COPY server/charts-app).
// cwd is the service root in both dev and prod (WORKDIR /app), so this resolves
// to <root>/server/charts-app/charts.html either way.
const LOCAL_CHARTS_HTML_PATH = path.resolve(process.cwd(), "server/charts-app/charts.html");
// Read once, then serve from memory. `undefined` = not yet read; `null` = read
// failed (file missing from the build) -> the route answers 503.
let localChartsHtml: string | null | undefined;
async function readLocalChartsHtml(): Promise<string | null> {
  if (localChartsHtml !== undefined) return localChartsHtml;
  try {
    localChartsHtml = await readFile(LOCAL_CHARTS_HTML_PATH, "utf8");
  } catch {
    localChartsHtml = null; // absent -> 503
  }
  return localChartsHtml;
}

// charts.html is one big inline <script> app, so the helmet production CSP
// (script-src 'self', server/security.ts) would blank the page. Override on
// the DOCUMENT response only; the unpkg.com entry covers the page's CDN
// fallback for the lightweight-charts lib (normally unused — the local copy
// is published alongside).
const CHARTS_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join("; ");

// STRICT allowlists — only the file shapes charts.html actually loads
// (see the interface map: data-index.js, data-charts-extra.js,
// data-<key>.js, overlays-<key>.js; keys are lowercase [a-z0-9.-]).
const DASHBOARD_FILE = /^(?:data|overlays)-[a-z0-9][a-z0-9.-]{0,78}\.js$/;
// Exact-name -> content-type map for charts-app/assets/* (worker publishes
// exactly these: CHARTS_APP_ASSETS in worker/eod.py).
const ASSET_FILES = new Map<string, string>([
  ["lightweight-charts.standalone.production.js", "text/javascript; charset=utf-8"],
  ["kf-theme.css", "text/css; charset=utf-8"],
]);
// kf-theme.css @font-face pulls these (BINARY — served via the bytes getter).
const FONT_FILES = new Set([
  "jetbrainsmono.woff2",
  "spacegrotesk.woff2",
  "orbitron.woff2",
]);

// Body cache (text or binary) keyed by (pointer generation, rel path) — a
// nightly pointer flip invalidates naturally. ~50 objects per run (html + lib
// + css + 3 fonts + 22 data + 22 overlays), biggest ~832KB, whole set ~6-7MB.
const BODY_CACHE_MAX = 64;
const bodyCache = new Map<string, string | Buffer>();

function cachePut(key: string, value: string | Buffer): void {
  if (bodyCache.size >= BODY_CACHE_MAX) {
    const oldest = bodyCache.keys().next().value;
    if (oldest !== undefined) bodyCache.delete(oldest);
  }
  bodyCache.set(key, value);
}

/** Proxy one charts-app object of the latest run to the response.
 *  `binary` switches to the byte-safe getter (fonts — utf-8 decode corrupts
 *  woff2). */
async function serveChartsObject(
  res: Response,
  relPath: string,
  contentType: string,
  extraHeaders?: Record<string, string>,
  binary = false
): Promise<void> {
  if (!isConfigured()) {
    res.status(503).json({ error: "charts unavailable" });
    return;
  }
  const pointer = await getLatestPointer();
  if (!pointer) {
    res.status(503).json({ error: "charts unavailable" });
    return;
  }
  const cacheKey = `${pointer.generated}|${relPath}`;
  let body = bodyCache.get(cacheKey);
  if (body === undefined) {
    const result = binary
      ? await getRunArtifactBytes(`charts-app/${relPath}`)
      : await getRunArtifactText(`charts-app/${relPath}`);
    if (!result.ok) {
      if (result.reason === "not_found") {
        res.status(404).json({ error: "not found" });
      } else {
        res.status(503).json({ error: "charts unavailable" });
      }
      return;
    }
    body = result.data;
    cachePut(cacheKey, body);
  }
  res.set("Content-Type", contentType);
  res.set("Cache-Control", CHARTS_CACHE);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.set(k, v);
  }
  res.send(body);
}

export function registerFearlabChartsRoutes(app: Express): void {
  // The chart page. Relative asset paths ("dashboard/...") only resolve under
  // a trailing slash, so /charts canonicalizes to /charts/ first. Express
  // matches both spellings here (non-strict routing).
  app.get("/charts", async (req: Request, res: Response) => {
    try {
      if (!req.path.endsWith("/")) {
        return res.redirect(301, "/charts/");
      }
      const local = await readLocalChartsHtml();
      if (local == null) {
        res.status(503).json({ error: "charts unavailable" });
        return;
      }
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", CHARTS_DOCUMENT_CACHE);
      // Override the helmet CSP for this inline-script page (see CHARTS_CSP).
      res.set("Content-Security-Policy", CHARTS_CSP);
      res.send(local);
    } catch (error: any) {
      console.error("[FearLab charts] page route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load charts" });
    }
  });

  // Chart data sidecars: dashboard/data-*.js + dashboard/overlays-*.js.
  // charts.html appends ?v=Date.now() to these — the query is simply ignored.
  app.get("/charts/dashboard/:file", async (req: Request, res: Response) => {
    try {
      const file = String(req.params.file);
      if (!DASHBOARD_FILE.test(file)) {
        return res.status(404).json({ error: "not found" });
      }
      await serveChartsObject(res, `dashboard/${file}`, "text/javascript; charset=utf-8");
    } catch (error: any) {
      console.error("[FearLab charts] dashboard route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load chart data" });
    }
  });

  // Text assets: the vendored lightweight-charts lib + kf-theme.css
  // (exact-name allowlist mapping name -> content-type).
  app.get("/charts/assets/:file", async (req: Request, res: Response) => {
    try {
      const file = String(req.params.file);
      const contentType = ASSET_FILES.get(file);
      if (!contentType) {
        return res.status(404).json({ error: "not found" });
      }
      await serveChartsObject(res, `assets/${file}`, contentType);
    } catch (error: any) {
      console.error("[FearLab charts] assets route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load chart asset" });
    }
  });

  // Webfonts pulled by kf-theme.css @font-face (url("fonts/*.woff2") relative
  // to the css -> /charts/assets/fonts/*). Binary — served byte-safe.
  app.get("/charts/assets/fonts/:file", async (req: Request, res: Response) => {
    try {
      const file = String(req.params.file);
      if (!FONT_FILES.has(file)) {
        return res.status(404).json({ error: "not found" });
      }
      await serveChartsObject(res, `assets/fonts/${file}`, "font/woff2", undefined, true);
    } catch (error: any) {
      console.error("[FearLab charts] fonts route error:", error?.message ?? error);
      res.status(500).json({ error: "Failed to load chart font" });
    }
  });

  // --- per-account hand-drawn lines ---------------------------------------
  // charts.html persists its "mine" layer via same-origin POST /labels/save +
  // GET /labels/hand-lines-<key>.json (a protocol inherited from the engine
  // repo's local label server), scoped here to the Better Auth session user:
  //   - signed out: GET 404 / POST 401 -> the page silently falls back to its
  //     browser-localStorage copy;
  //   - signed in: lines round-trip through chart_lines keyed
  //     (user_id, chart_key) -> they follow the account across devices.
  // CSRF posture: the page sends no CSRF token on this call, so /labels/save
  // is exempt from csrfProtection. The POST is
  // a text/plain "simple request" and Better Auth's session cookie is
  // SameSite=Lax, so a cross-site page can't send it — and the payload is the
  // user's own cosmetic line list, validated + size-capped below.
  registerHandLinesRoutes(app);

  // --- per-account chart tickers -----------------------------------------
  // charts.html's "+ Add" posts {sym} to /watchlist/add. For signed-in users
  // this validates + records in the DB, asks the always-on chart-builder
  // service (range repo, worker/chart_builder.py) to build the symbol's full
  // MTF super into the CURRENT published run, and returns {ok, entry}. The nightly worker
  // unions symbol_requests(pending|built) into its chart build, so a live
  // build that dies (or a missing builder) degrades to next-morning
  // availability, never a lost request.
  // CSRF posture: same as /labels/save — the page sends no token. The POST is application/json (cross-site
  // browsers preflight it and there are no CORS headers) and the Better Auth
  // cookie is SameSite=Lax, so cross-site forgery can't reach it.
  registerChartSymbolRoutes(app);
}

// --- hand-lines storage ------------------------------------------------------

// Chart combo keys are the DASHBOARD_FILE key charset (lowercase [a-z0-9.-]).
const HAND_LINES_FILE = /^hand-lines-([a-z0-9][a-z0-9.-]{0,78})\.json$/;
const CHART_KEY = /^[a-z0-9][a-z0-9.-]{0,78}$/;
const MAX_LINES = 300; // a hand-curated layer; local heavy use is ~dozens
const MAX_BODY = "256kb";
// userLines entry shape (charts.html addUserLine): everything else is dropped.
const LINE_KEYS = new Set(["id", "kind", "t1", "p1", "t2", "p2", "note", "drawn_at"]);

/** Validate + strip one drawn line; null if it isn't one. */
function cleanLine(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!LINE_KEYS.has(k)) continue;
    if (k === "t1" || k === "p1" || k === "t2" || k === "p2") {
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      out[k] = v;
    } else {
      if (typeof v !== "string" || v.length > 300) return null;
      out[k] = v;
    }
  }
  for (const req of ["t1", "p1", "t2", "p2"]) {
    if (!(req in out)) return null;
  }
  return out;
}

function registerHandLinesRoutes(app: Express): void {
  // GET /labels/hand-lines-<key>.json — the signed-in user's stored lines for
  // that combo, shaped like the local label server's file ({key, lines}).
  // Signed out, unknown file shape, or nothing stored => 404 (charts.html
  // keeps its localStorage copy). Never cached: lines are per-user.
  app.get("/labels/:file", async (req: Request, res: Response) => {
    try {
      const m = HAND_LINES_FILE.exec(String(req.params.file));
      if (!m || !db) return res.status(404).json({ error: "not found" });
      const u = await sessionUser(req);
      if (!u) return res.status(404).json({ error: "not found" });
      const rows = await db
        .select({ lines: chartLines.lines })
        .from(chartLines)
        .where(and(eq(chartLines.userId, u.id), eq(chartLines.chartKey, m[1])))
        .limit(1);
      if (!rows.length) return res.status(404).json({ error: "not found" });
      res.set("Cache-Control", "no-store");
      res.json({ key: m[1], lines: rows[0].lines });
    } catch (e: any) {
      console.error("[FearLab charts] labels get failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to load lines" });
    }
  });

  // POST /labels/save — upsert the user's lines for one combo. Body arrives as
  // Content-Type: text/plain (charts.html keeps the POST a CORS simple
  // request for its file:// local path), so the global express.json() skips
  // it; parse it here. An empty lines array deletes the row (drawing then
  // erasing everything leaves no residue).
  app.post(
    "/labels/save",
    express.text({ type: "*/*", limit: MAX_BODY }),
    async (req: Request, res: Response) => {
      try {
        if (!db) return res.status(503).json({ ok: false, error: "database unavailable" });
        const u = await sessionUser(req);
        if (!u) return res.status(401).json({ ok: false, error: "sign in to save lines" });
        let doc: any;
        try {
          doc = JSON.parse(typeof req.body === "string" ? req.body : "");
        } catch {
          return res.status(400).json({ ok: false, error: "invalid JSON" });
        }
        const key = typeof doc?.key === "string" ? doc.key : "";
        if (!CHART_KEY.test(key) || !Array.isArray(doc?.lines) || doc.lines.length > MAX_LINES) {
          return res.status(400).json({ ok: false, error: "invalid payload" });
        }
        const lines: Record<string, unknown>[] = [];
        for (const raw of doc.lines) {
          const line = cleanLine(raw);
          if (!line) return res.status(400).json({ ok: false, error: "invalid line entry" });
          lines.push(line);
        }
        if (!lines.length) {
          await db
            .delete(chartLines)
            .where(and(eq(chartLines.userId, u.id), eq(chartLines.chartKey, key)));
        } else {
          await db
            .insert(chartLines)
            .values({ userId: u.id, chartKey: key, lines })
            .onConflictDoUpdate({
              target: [chartLines.userId, chartLines.chartKey],
              set: { lines, updatedAt: new Date() },
            });
        }
        res.json({ ok: true, key, count: lines.length });
      } catch (e: any) {
        console.error("[FearLab charts] labels save failed:", e?.message ?? e);
        res.status(500).json({ ok: false, error: "failed to save lines" });
      }
    }
  );
}

// --- per-account chart tickers -------------------------------------------------

const MAX_GLOBAL_TICKERS = 100; // total user-requested symbols (bounds nightly build time + store size)
const MAX_TICKER_ORDER = 200;
// add_ticker.py's charset: >=1 alnum, first+last alnum, <=12 chars total.
const TICKER_RE = /^[a-z0-9](?:[a-z0-9.-]{0,10}[a-z0-9])?$/;
// A single-symbol build is ~1 min, but deep-history tickers (e.g. WMT, daily
// bars back to 1972) have taken ~3 min end to end; 180s cut one off at 176s
// (2026-08-27) — the build landed but the page only showed it after a refresh.
const BUILDER_TIMEOUT_MS = 300_000;

function normalizeTickerOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const raw of value) {
    const symbol = typeof raw === "string" ? raw.toLowerCase().trim() : "";
    if (!TICKER_RE.test(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    order.push(symbol);
    if (order.length >= MAX_TICKER_ORDER) break;
  }
  return order;
}

// Export-dialog ticker groups: [{ id, name, symbols }], one list per account.
const MAX_TICKER_GROUPS = 30;
const MAX_GROUP_NAME = 40;
const MAX_GROUP_SYMBOLS = 100;
const GROUP_ID_RE = /^[a-z0-9]{1,24}$/;

export type TickerGroup = { id: string; name: string; symbols: string[] };

/** Drop malformed groups, trim names, dedupe ids and names, cap every list. */
// inputSanitizer runs on every request body and HTML-encodes text ("S&P 500"
// arrives as "S&amp;P 500"). Group names are plain text, escaped by the page
// wherever it draws them, so they are decoded back before saving.
export function decodeGroupName(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || typeof (raw as any).name !== "string") return raw;
  const name = (raw as any).name
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&");
  return { ...(raw as any), name };
}
export function normalizeTickerGroups(value: unknown): TickerGroup[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const groups: TickerGroup[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const id = typeof (raw as any).id === "string" ? (raw as any).id.trim().toLowerCase() : "";
    const name = typeof (raw as any).name === "string"
      ? (raw as any).name.replace(/\s+/g, " ").trim().slice(0, MAX_GROUP_NAME)
      : "";
    if (!GROUP_ID_RE.test(id) || ids.has(id) || !name || names.has(name.toLowerCase())) continue;
    const symbols = normalizeTickerOrder((raw as any).symbols).slice(0, MAX_GROUP_SYMBOLS);
    if (!symbols.length) continue;
    ids.add(id);
    names.add(name.toLowerCase());
    groups.push({ id, name, symbols });
    if (groups.length >= MAX_TICKER_GROUPS) break;
  }
  return groups;
}

/** Mutate this account's hidden-ticker list (curated buttons the user removed),
 *  stored on the chart_preferences row. Tolerates the hidden_tickers column not
 *  existing yet (web deploy landing before the additive migration): logs and
 *  returns false instead of throwing. */
async function updateHiddenTickers(
  userId: string,
  mutate: (hidden: string[]) => string[]
): Promise<boolean> {
  if (!db) return false;
  try {
    const rows = await db
      .select({ hiddenTickers: chartPreferences.hiddenTickers })
      .from(chartPreferences)
      .where(eq(chartPreferences.userId, userId))
      .limit(1);
    const current = normalizeTickerOrder(rows.length ? rows[0].hiddenTickers : []);
    const next = normalizeTickerOrder(mutate(current));
    if (!rows.length && !next.length) return true;
    if (rows.length && next.join(",") === current.join(",")) return true;
    await db
      .insert(chartPreferences)
      .values({ userId, hiddenTickers: next })
      .onConflictDoUpdate({
        target: chartPreferences.userId,
        set: { hiddenTickers: next, updatedAt: new Date() },
      });
    return true;
  } catch (e: any) {
    console.error("[FearLab charts] hidden tickers update failed:", e?.message ?? e);
    return false;
  }
}

function reconcileTickerOrder(saved: unknown, visible: string[]): string[] {
  const allowed = new Set(visible);
  const order = normalizeTickerOrder(saved).filter((symbol) => allowed.has(symbol));
  const seen = new Set(order);
  for (const symbol of visible) {
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    order.push(symbol);
  }
  return order;
}

interface SuperCombo {
  key: string;
  [k: string]: unknown;
}

// Published super combos (charts-app/dashboard/data-charts-extra.js), parsed
// once per pointer generation. Invalidated by invalidateExtra() when a live
// build mutates the file inside the current run (generation unchanged).
let extraCache: { gen: string; combos: SuperCombo[] } | null = null;

async function publishedCombos(): Promise<SuperCombo[] | null> {
  if (!isConfigured()) return null;
  const pointer = await getLatestPointer();
  if (!pointer) return null;
  if (extraCache && extraCache.gen === pointer.generated) return extraCache.combos;
  const res = await getRunArtifactText("charts-app/dashboard/data-charts-extra.js");
  if (!res.ok) return null;
  const m = /window\.FEARLAB_CHARTS_EXTRA=([\s\S]*);\s*$/.exec(res.data);
  if (!m) return null;
  let combos: SuperCombo[];
  try {
    const parsed = JSON.parse(m[1]);
    combos = Array.isArray(parsed?.combos) ? parsed.combos : [];
  } catch {
    return null;
  }
  combos = combos.filter((c) => c && typeof c.key === "string");
  extraCache = { gen: pointer.generated, combos };
  return combos;
}

/** Lowercase symbol of a default super combo ("aapl-super" -> "aapl"). */
function comboSym(c: SuperCombo): string | null {
  return c.key.endsWith("-super") ? c.key.slice(0, -"-super".length) : null;
}

/** Drop the served copy + parsed cache of data-charts-extra.js after a live
 *  build rewrites it inside the current run — the body cache is keyed by
 *  pointer generation, which an incremental upload does NOT change. */
function invalidateExtra(): void {
  extraCache = null;
  for (const k of Array.from(bodyCache.keys())) {
    if (k.endsWith("|dashboard/data-charts-extra.js")) bodyCache.delete(k);
  }
}

/** Ask the chart-builder service to build one symbol into the current run.
 *  transport:true = the BUILD may still be running or land later (network /
 *  timeout / builder absent) — callers keep the request pending; transport
 *  absent = the builder answered definitively. */
async function callBuilder(
  sym: string
): Promise<{ ok: boolean; entry?: SuperCombo; error?: string; transport?: boolean }> {
  const url = (process.env.CHART_BUILDER_URL || "").replace(/\/+$/, "");
  const secret = process.env.CHART_BUILDER_SECRET || "";
  if (!url || !secret) return { ok: false, transport: true, error: "builder not configured" };
  try {
    const r = await fetch(`${url}/internal/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Builder-Secret": secret },
      body: JSON.stringify({ sym }),
      signal: AbortSignal.timeout(BUILDER_TIMEOUT_MS),
    });
    const j: any = await r.json().catch(() => null);
    if (!j || typeof j.ok !== "boolean") {
      return { ok: false, transport: true, error: "builder returned an unreadable response" };
    }
    return j;
  } catch (e: any) {
    return {
      ok: false,
      transport: true,
      error: e?.name === "TimeoutError" ? "build timed out" : "builder unreachable",
    };
  }
}

// In-flight builds (single web replica): a second add of the same symbol
// while one is building gets a polite retry message instead of a dup build.
const building = new Set<string>();

function registerChartSymbolRoutes(app: Express): void {
  // GET /api/chart-symbols — what the visitor's /charts button row should
  // show: curated = published symbols nobody user-requested (the owner's
  // watchlist + the board indexes) minus this account's hides, mine = this
  // account's added tickers. Signed out => mine is empty (page then shows
  // the full curated row).
  app.get("/api/chart-symbols", async (req: Request, res: Response) => {
    try {
      const combos = await publishedCombos();
      const published = new Set<string>();
      for (const c of combos ?? []) {
        const s = comboSym(c);
        if (s) published.add(s);
      }
      let requested = new Set<string>();
      let hidden = new Set<string>();
      let mine: string[] = [];
      let order: string[] | null = null;
      let account = false;
      if (db) {
        const reqRows = await db.select({ symbol: symbolRequests.symbol }).from(symbolRequests);
        requested = new Set(reqRows.map((r) => r.symbol));
        const u = await sessionUser(req);
        if (u) {
          account = true;
          const [rows, prefRows] = await Promise.all([
            db
              .select({ symbol: chartSymbols.symbol })
              .from(chartSymbols)
              .where(eq(chartSymbols.userId, u.id)),
            db
              .select({
                tickerOrder: chartPreferences.tickerOrder,
                hiddenTickers: chartPreferences.hiddenTickers,
              })
              .from(chartPreferences)
              .where(eq(chartPreferences.userId, u.id))
              .limit(1)
              // Keep chart access working during a web deploy that lands just
              // before the additive preference migration is applied.
              .catch(() => []),
          ]);
          mine = rows.map((r) => r.symbol).sort();
          if (prefRows.length) {
            order = normalizeTickerOrder(prefRows[0].tickerOrder);
            hidden = new Set(normalizeTickerOrder(prefRows[0].hiddenTickers));
          }
        }
      }
      const curated = Array.from(published)
        .filter((s) => !requested.has(s) && !hidden.has(s))
        .sort();
      if (order !== null) order = reconcileTickerOrder(order, [...curated, ...mine]);
      res.set("Cache-Control", "no-store");
      res.json({ curated, mine, order, account });
    } catch (e: any) {
      console.error("[FearLab charts] chart-symbols get failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to load chart symbols" });
    }
  });

  // PUT /api/chart-symbols/order — save the visible shortcut order for this
  // account. Unknown/stale symbols are removed; newly visible ones append.
  app.put("/api/chart-symbols/order", async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "database unavailable" });
      const u = await sessionUser(req);
      if (!u) return res.status(401).json({ ok: false, error: "sign in required" });
      if (!Array.isArray((req.body as any)?.order)) {
        return res.status(400).json({ ok: false, error: "order must be an array" });
      }

      const combos = await publishedCombos();
      if (combos === null) return res.status(503).json({ ok: false, error: "charts unavailable" });
      const published = new Set<string>();
      for (const combo of combos) {
        const symbol = comboSym(combo);
        if (symbol) published.add(symbol);
      }
      const [requestRows, mineRows, prefRows] = await Promise.all([
        db.select({ symbol: symbolRequests.symbol }).from(symbolRequests),
        db
          .select({ symbol: chartSymbols.symbol })
          .from(chartSymbols)
          .where(eq(chartSymbols.userId, u.id)),
        db
          .select({ hiddenTickers: chartPreferences.hiddenTickers })
          .from(chartPreferences)
          .where(eq(chartPreferences.userId, u.id))
          .limit(1)
          // Additive-migration lag tolerance, same as the GET above.
          .catch(() => []),
      ]);
      const requested = new Set(requestRows.map((row) => row.symbol));
      const hidden = new Set(
        prefRows.length ? normalizeTickerOrder(prefRows[0].hiddenTickers) : []
      );
      const curated = Array.from(published)
        .filter((symbol) => !requested.has(symbol) && !hidden.has(symbol))
        .sort();
      const mine = mineRows.map((row) => row.symbol).sort();
      const order = reconcileTickerOrder((req.body as any).order, [...curated, ...mine]);

      await db
        .insert(chartPreferences)
        .values({ userId: u.id, tickerOrder: order })
        .onConflictDoUpdate({
          target: chartPreferences.userId,
          set: { tickerOrder: order, updatedAt: new Date() },
        });
      res.json({ ok: true, order });
    } catch (e: any) {
      console.error("[FearLab charts] ticker order save failed:", e?.message ?? e);
      res.status(500).json({ ok: false, error: "failed to save ticker order" });
    }
  });

  // GET /api/chart-groups — this account's Export ticker groups. Signed out
  // (or no database) answers account:false and the page keeps groups in the
  // browser. stored:false means the ticker_groups column is not there yet.
  app.get("/api/chart-groups", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      const u = db ? await sessionUser(req) : null;
      if (!db || !u) return res.json({ groups: [], account: false, stored: false });
      const rows = await db
        .select({ tickerGroups: chartPreferences.tickerGroups })
        .from(chartPreferences)
        .where(eq(chartPreferences.userId, u.id))
        .limit(1)
        // Additive-migration lag tolerance, same as /api/chart-symbols.
        .catch(() => null);
      if (rows === null) return res.json({ groups: [], account: true, stored: false });
      res.json({ groups: normalizeTickerGroups(rows[0]?.tickerGroups), account: true, stored: true });
    } catch (e: any) {
      console.error("[FearLab charts] chart-groups get failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to load ticker groups" });
    }
  });

  // PUT /api/chart-groups — replace this account's group list.
  app.put("/api/chart-groups", async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "database unavailable" });
      const u = await sessionUser(req);
      if (!u) return res.status(401).json({ ok: false, error: "sign in required" });
      if (!Array.isArray((req.body as any)?.groups)) {
        return res.status(400).json({ ok: false, error: "groups must be an array" });
      }
      const groups = normalizeTickerGroups((req.body as any).groups.map(decodeGroupName));
      await db
        .insert(chartPreferences)
        .values({ userId: u.id, tickerGroups: groups })
        .onConflictDoUpdate({
          target: chartPreferences.userId,
          set: { tickerGroups: groups, updatedAt: new Date() },
        });
      res.json({ ok: true, groups });
    } catch (e: any) {
      console.error("[FearLab charts] chart-groups save failed:", e?.message ?? e);
      res.status(500).json({ ok: false, error: "failed to save ticker groups" });
    }
  });

  // DELETE /api/chart-symbols/:symbol — remove a ticker from THIS account's
  // row. When the last account referencing it lets go, retire the global
  // build request too: the nightly worker stops rebuilding it and its files
  // drop off at the next run flip.
  app.delete("/api/chart-symbols/:symbol", async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "database unavailable" });
      const u = await sessionUser(req);
      if (!u) return res.status(401).json({ ok: false, error: "sign in required" });
      const symbol = String(req.params.symbol || "").toLowerCase().trim();
      if (!TICKER_RE.test(symbol)) {
        return res.status(400).json({ ok: false, error: "invalid ticker" });
      }
      await db
        .delete(chartSymbols)
        .where(and(eq(chartSymbols.userId, u.id), eq(chartSymbols.symbol, symbol)));
      const left = await db
        .select({ symbol: chartSymbols.symbol })
        .from(chartSymbols)
        .where(eq(chartSymbols.symbol, symbol))
        .limit(1);
      if (!left.length) {
        await db.delete(symbolRequests).where(eq(symbolRequests.symbol, symbol));
      }
      // Hide it for THIS account too: curated (built-in) buttons have no
      // chart_symbols row to delete, and a just-retired request stays published
      // until the next run flip — the hide keeps the button gone either way.
      await updateHiddenTickers(u.id, (hidden) =>
        hidden.includes(symbol) ? hidden : [...hidden, symbol]
      );
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[FearLab charts] chart-symbols delete failed:", e?.message ?? e);
      res.status(500).json({ ok: false, error: "failed to remove ticker" });
    }
  });

  // POST /watchlist/add — the local label-server protocol, session-scoped.
  app.post("/watchlist/add", async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ ok: false, error: "database unavailable" });
      const u = await sessionUser(req);
      if (!u) return res.status(401).json({ ok: false, error: "sign in to add tickers" });
      const sym = String((req.body as any)?.sym ?? "").toLowerCase().trim();
      if (!TICKER_RE.test(sym)) return res.status(400).json({ ok: false, error: "invalid ticker" });

      const combos = await publishedCombos();
      if (combos === null) return res.status(503).json({ ok: false, error: "charts unavailable" });
      const entryOf = (list: SuperCombo[]) => list.find((c) => c.key === `${sym}-super`) ?? null;

      const mineRows = await db
        .select({ symbol: chartSymbols.symbol })
        .from(chartSymbols)
        .where(eq(chartSymbols.userId, u.id));
      const alreadyMine = mineRows.some((r) => r.symbol === sym);

      // Adding un-hides: a curated ticker this account removed earlier comes
      // back to its row by adding it again.
      await updateHiddenTickers(u.id, (hidden) => hidden.filter((s) => s !== sym));

      // Fast path: the chart already exists (curated, or built for any user
      // earlier). Curated symbols need no account row; a user-built one does
      // (that row is what makes its button show for THIS account).
      const existing = entryOf(combos);
      if (existing) {
        const reqRow = await db
          .select({ symbol: symbolRequests.symbol })
          .from(symbolRequests)
          .where(eq(symbolRequests.symbol, sym))
          .limit(1);
        if (reqRow.length && !alreadyMine) {
          await db.insert(chartSymbols).values({ userId: u.id, symbol: sym }).onConflictDoNothing();
        }
        return res.json({ ok: true, entry: existing });
      }

      // New symbol -> live build.
      if (building.has(sym)) {
        return res
          .status(409)
          .json({ ok: false, pending: true, error: "already building, try again in a minute" });
      }
      const globalRows = await db.select({ symbol: symbolRequests.symbol }).from(symbolRequests);
      if (!globalRows.some((r) => r.symbol === sym) && globalRows.length >= MAX_GLOBAL_TICKERS) {
        return res
          .status(400)
          .json({ ok: false, error: "the site ticker limit is reached, try again later" });
      }

      // Record intent FIRST: the nightly worker unions pending requests into
      // its build, so even a dead builder degrades to next-morning delivery.
      await db
        .insert(symbolRequests)
        .values({ symbol: sym, requestedBy: u.id })
        .onConflictDoUpdate({
          target: symbolRequests.symbol,
          set: { status: "pending", error: null, updatedAt: new Date() },
        });
      await db.insert(chartSymbols).values({ userId: u.id, symbol: sym }).onConflictDoNothing();

      building.add(sym);
      try {
        const built = await callBuilder(sym);
        if (built.ok && built.entry) {
          await db
            .update(symbolRequests)
            .set({ status: "built", error: null, updatedAt: new Date() })
            .where(eq(symbolRequests.symbol, sym));
          invalidateExtra();
          return res.json({ ok: true, entry: built.entry });
        }
        if (built.transport) {
          // Build may still land, and the nightly run is the safety net.
          return res.status(202).json({
            ok: false,
            pending: true,
            error: "the chart is still building, check back in a few minutes",
          });
        }
        if (built.error === "already in watchlist") {
          // Raced another completed build: the combo exists now — serve it.
          invalidateExtra();
          const fresh = await publishedCombos();
          const entry = fresh ? entryOf(fresh) : null;
          if (entry) {
            await db
              .update(symbolRequests)
              .set({ status: "built", error: null, updatedAt: new Date() })
              .where(eq(symbolRequests.symbol, sym));
            return res.json({ ok: true, entry });
          }
        }
        // Definitive rejection (bad ticker / no data): don't hold a slot.
        await db
          .update(symbolRequests)
          .set({ status: "failed", error: built.error ?? "build failed", updatedAt: new Date() })
          .where(eq(symbolRequests.symbol, sym));
        await db
          .delete(chartSymbols)
          .where(and(eq(chartSymbols.userId, u.id), eq(chartSymbols.symbol, sym)));
        return res.status(400).json({ ok: false, error: built.error || "build failed" });
      } finally {
        building.delete(sym);
      }
    } catch (e: any) {
      console.error("[FearLab charts] watchlist add failed:", e?.message ?? e);
      res.status(500).json({ ok: false, error: "failed to add ticker" });
    }
  });
}
