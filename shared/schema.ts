import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, boolean, doublePrecision, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { DailyBar } from "./market-data";

// ---------------------------------------------------------------------------
// Better Auth core tables (P2, platform/P2-DESIGN.md). Property names follow
// Better Auth's field names (the drizzle adapter resolves models by property);
// column names are snake_case because the Python worker reads this DB with
// plain SQL. The legacy plaintext-password `users` table was deleted in PR #31.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"), // scrypt hash managed by Better Auth — never plaintext
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Platform tables (P2-DESIGN.md schema section). The Railway worker (range
// repo, worker/alerts.py) reads user/watchlist/prefs/suppression and writes
// alert_state/deliveries/job_runs with plain SQL — keep column names stable.
// ---------------------------------------------------------------------------

export const tosAcceptances = pgTable("tos_acceptances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("tos_user_version_uq").on(t.userId, t.version),
]);

export const watchlistSymbols = pgTable("watchlist_symbols", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.symbol] }),
]);

export const alertPrefs = pgTable("alert_prefs", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'levels_weekly' | 'gap_daily'
  enabled: boolean("enabled").notNull().default(false),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.kind] }),
]);

// Global per-symbol alert ratchet state (worker-owned; e.g. key 'gap:global').
export const alertState = pgTable("alert_state", {
  key: text("key").primaryKey(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Send idempotency: digest_key = "<user_id>:<kind>:<trading_date>".
export const deliveries = pgTable("deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  digestKey: text("digest_key").notNull().unique(),
  kind: text("kind").notNull(),
  resendId: text("resend_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailSuppression = pgTable("email_suppression", {
  email: text("email").primaryKey(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Cross-week content dedup for the levels_weekly digest (worker-owned; worker/alerts.py
// writes + reads with plain SQL). One row per (user, symbol, level price) actually emailed
// on sent_date. The worker suppresses a level already sent to a user within their dedupDays
// window (±dedupPct) and prunes rows older than 180 days. No unique constraint: a level
// price drifts week to week and a symbol can surface different levels over time — the
// worker matches by price tolerance, not exact equality. sent_date is the trading_date
// text (YYYY-MM-DD), lexically comparable = chronological, matching job_runs.run_date.
export const sentLevels = pgTable("sent_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  price: doublePrecision("price").notNull(),
  sentDate: text("sent_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("sent_levels_user_symbol_idx").on(t.userId, t.symbol, t.sentDate),
]);

// Per-account hand-drawn chart lines (charts.html's "mine" layer). One row per
// (user, chart combo key); `lines` stores the page's userLines array verbatim
// so the shared charts.html needs zero edits — its existing POST /labels/save
// and GET /labels/hand-lines-<key>.json calls become the sync (fearlab-charts.ts).
export const chartLines = pgTable("chart_lines", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  chartKey: text("chart_key").notNull(),
  lines: jsonb("lines").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.chartKey] }),
]);

// Per-account chart tickers (charts.html site nav). symbol = the lowercase
// combo symbol ("aapl" for the aapl-super chart). A user's /charts button row
// shows the curated set plus THEIR rows here.
export const chartSymbols = pgTable("chart_symbols", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.symbol] }),
]);

// One row per account for chart-only presentation preferences. Keep this
// separate from alert watchlists and chart lines: neither owns shortcut order.
export const chartPreferences = pgTable("chart_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  tickerOrder: jsonb("ticker_order").notNull().default(sql`'[]'::jsonb`),
  // Curated (built-in) tickers this account has removed from its button row.
  hiddenTickers: jsonb("hidden_tickers").notNull().default(sql`'[]'::jsonb`),
  // Named ticker groups for the chart Export dialog: [{ id, name, symbols }].
  tickerGroups: jsonb("ticker_groups").notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Global user-requested chart-build ledger. One row per symbol ever requested;
// the chart-builder service builds it live, and the nightly worker (range
// repo, worker/eod.py) unions status IN ('pending','built') into its chart
// build with plain SQL — keep table/column names stable.
// status: 'pending' (queued / live build did not finish) | 'built' | 'failed'.
export const symbolRequests = pgTable("symbol_requests", {
  symbol: text("symbol").primaryKey(),
  requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Worker heartbeat rows — the alert fan-out gate + site staleness source.
export const jobRuns = pgTable("job_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  job: text("job").notNull(),
  runDate: text("run_date").notNull(), // trading_date YYYY-MM-DD
  started: timestamp("started"),
  finished: timestamp("finished"),
  ok: boolean("ok").notNull().default(false),
}, (t) => [
  uniqueIndex("job_runs_job_date_uq").on(t.job, t.runDate),
]);

// ---------------------------------------------------------------------------
// Fundamentals cache (pre-P2 feature, unchanged)
// ---------------------------------------------------------------------------

export const tickerCache = pgTable("ticker_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticker: text("ticker").notNull().unique(),
  fundamentals: jsonb("fundamentals").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Derived Tiingo daily-bar cache. PostgreSQL is a durable last-known-good
// cache only; Tiingo remains the market-data authority.
export const marketDataCache = pgTable("market_data_cache", {
  ticker: text("ticker").primaryKey(),
  bars: jsonb("bars").$type<DailyBar[]>().notNull(),
  marketDate: text("market_date").notNull(),
  lastSuccessfulAt: timestamp("last_successful_at", { withTimezone: true }).notNull().defaultNow(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTickerCacheSchema = createInsertSchema(tickerCache).omit({
  id: true,
  fetchedAt: true,
  updatedAt: true,
});
export type InsertTickerCache = z.infer<typeof insertTickerCacheSchema>;
export type TickerCache = typeof tickerCache.$inferSelect;

export type User = typeof user.$inferSelect;
export type AlertPref = typeof alertPrefs.$inferSelect;
