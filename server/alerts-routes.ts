// P2 alert surface: per-user watchlist CRUD, alert prefs, one-click
// unsubscribe, and the Resend bounce/complaint webhook (platform/P2-DESIGN.md).
//
// Universe rule: a watchlist symbol must be one the worker actually publishes —
// the `charts` list in the latest run's manifest.json (currently 22 symbols).
// No on-demand ticker builds in v1.

import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "./db";
import { alertPrefs, emailSuppression, watchlistSymbols } from "@shared/schema";
import {
  ALERT_KINDS,
  normalizeAlertSettings,
  parseAlertSettings,
  type AlertKind,
} from "@shared/alert-settings";
import { getRunArtifact, isConfigured } from "./fearlab-live";
import { requireUser, hasAcceptedCurrentTos, type SessionUser } from "./account-routes";

export { ALERT_KINDS };

// ---------------------------------------------------------------------------
// Published-symbol universe (manifest.charts), cached 5 min — same cadence as
// the other bucket proxies; the set changes at most once per night.
// ---------------------------------------------------------------------------

interface ManifestV1 {
  charts?: string[];
}

let universeCache: { at: number; symbols: string[] } | null = null;
const UNIVERSE_TTL_MS = 5 * 60 * 1000;

export async function publishedUniverse(): Promise<string[]> {
  if (universeCache && Date.now() - universeCache.at < UNIVERSE_TTL_MS) {
    return universeCache.symbols;
  }
  if (!isConfigured()) return universeCache?.symbols ?? [];
  const result = await getRunArtifact<ManifestV1>("manifest.json");
  if (!result.ok || !Array.isArray(result.data.charts)) {
    return universeCache?.symbols ?? [];
  }
  const symbols = result.data.charts.map((s) => String(s).toUpperCase()).sort();
  universeCache = { at: Date.now(), symbols };
  return symbols;
}

// ---------------------------------------------------------------------------
// Unsubscribe tokens: base64url("<userId>|<kind>") + "." + HMAC-SHA256 sig.
// Minted here AND by the Python worker (same ALERTS_UNSUB_SECRET) for the
// List-Unsubscribe headers — keep the format in sync with worker/alerts.py.
// ---------------------------------------------------------------------------

const UNSUB_SECRET = process.env.ALERTS_UNSUB_SECRET || "";

function sign(payload: string): string {
  return crypto.createHmac("sha256", UNSUB_SECRET).update(payload).digest("base64url");
}

export function mintUnsubToken(userId: string, kind: AlertKind | "all"): string {
  const payload = Buffer.from(`${userId}|${kind}`, "utf-8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyUnsubToken(token: string): { userId: string; kind: AlertKind | "all" } | null {
  if (!UNSUB_SECRET) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  const bar = decoded.indexOf("|");
  if (bar <= 0) return null;
  const userId = decoded.slice(0, bar);
  const kind = decoded.slice(bar + 1);
  if (kind !== "all" && !ALERT_KINDS.includes(kind as AlertKind)) return null;
  return { userId, kind: kind as AlertKind | "all" };
}

async function applyUnsubscribe(userId: string, kind: AlertKind | "all"): Promise<void> {
  if (!db) throw new Error("database unavailable");
  if (kind === "all") {
    for (const k of ALERT_KINDS) {
      await db
        .insert(alertPrefs)
        .values({ userId, kind: k, enabled: false })
        .onConflictDoUpdate({
          target: [alertPrefs.userId, alertPrefs.kind],
          set: { enabled: false, updatedAt: new Date() },
        });
    }
    // Belt-and-braces: suppress the address too, so a worker bug can't mail it.
    const u = await db.query.user.findFirst({ where: (t, { eq: eq_ }) => eq_(t.id, userId) });
    if (u?.email) {
      await db
        .insert(emailSuppression)
        .values({ email: u.email.toLowerCase(), reason: "unsubscribe_all" })
        .onConflictDoNothing();
    }
  } else {
    await db
      .insert(alertPrefs)
      .values({ userId, kind, enabled: false })
      .onConflictDoUpdate({
        target: [alertPrefs.userId, alertPrefs.kind],
        set: { enabled: false, updatedAt: new Date() },
      });
  }
}

// ---------------------------------------------------------------------------
// Resend webhook (svix signing scheme). RESEND_WEBHOOK_SECRET unset => 503 —
// never accept unverified suppression writes.
// ---------------------------------------------------------------------------

function verifySvix(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";
  if (!secret) return false;
  const id = req.headers["svix-id"] as string;
  const ts = req.headers["svix-timestamp"] as string;
  const sigHeader = req.headers["svix-signature"] as string;
  if (!id || !ts || !sigHeader) return false;
  // 5-minute tolerance window against replay.
  const now = Math.floor(Date.now() / 1000);
  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > 300) return false;
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!raw) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${id}.${ts}.${raw.toString("utf-8")}`;
  const expected = crypto.createHmac("sha256", key).update(signed).digest("base64");
  // Header carries space-separated "v1,<sig>" entries.
  return sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

async function ensureDefaultAlertPrefs(userId: string): Promise<void> {
  const database = db;
  if (!database) throw new Error("database unavailable");
  await Promise.all(
    ALERT_KINDS.map((kind) =>
      database
        .insert(alertPrefs)
        .values({ userId, kind, enabled: true })
        .onConflictDoNothing(),
    ),
  );
}

// Last applied watchlist save revision per user (PUT /api/watchlist). Kept in
// process memory: the web service runs exactly one Railway replica. With more
// replicas, or after a restart, this check stops ordering saves across
// instances and needs a column in Postgres instead.
const lastWatchlistRev = new Map<string, number>();

// ---------------------------------------------------------------------------

export function registerAlertsRoutes(app: Express): void {
  // ---- watchlist ----------------------------------------------------------
  app.get("/api/watchlist", requireUser, async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const u = (req as any).kfUser as SessionUser;
      const [universe, rows] = await Promise.all([
        publishedUniverse(),
        db.select({ symbol: watchlistSymbols.symbol }).from(watchlistSymbols)
          .where(eq(watchlistSymbols.userId, u.id)),
      ]);
      res.json({ universe, symbols: rows.map((r) => r.symbol).sort() });
    } catch (e: any) {
      console.error("[watchlist] GET failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to load watchlist" });
    }
  });

  app.post("/api/watchlist", requireUser, async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const u = (req as any).kfUser as SessionUser;
      const symbol = String(req.body?.symbol || "").toUpperCase().trim();
      const universe = await publishedUniverse();
      if (!universe.includes(symbol)) {
        return res.status(400).json({ error: "symbol not in the published set" });
      }
      await db
        .insert(watchlistSymbols)
        .values({ userId: u.id, symbol })
        .onConflictDoNothing();
      res.json({ ok: true, symbol });
    } catch (e: any) {
      console.error("[watchlist] POST failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to add symbol" });
    }
  });

  // Replace the whole watchlist in one request. The Alerts panel batches chip
  // toggles and select-all / clear into this call, so a burst of edits costs
  // one rate-limited request instead of one per symbol.
  app.put("/api/watchlist", requireUser, async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const u = (req as any).kfUser as SessionUser;
      const raw = req.body?.symbols;
      if (!Array.isArray(raw) || raw.length > 500) {
        return res.status(400).json({ error: "symbols must be a list" });
      }
      const desired = Array.from(new Set(raw.map((s) => String(s || "").toUpperCase().trim()).filter(Boolean)));
      const rev = Number(req.body?.rev);
      const hasRev = Number.isFinite(rev) && rev > 0;
      const universe = await publishedUniverse();
      const symbols = await db.transaction(async (tx) => {
        // Serialize replacements per user (two open tabs): without this, two
        // READ COMMITTED transactions can both delete before either inserts
        // and leave the union. Locks the key, not rows, so it also holds when
        // the user has no saved symbols yet; released at commit or rollback.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`watchlist:${u.id}`}, 0))`);
        const current = new Set(
          (await tx.select({ symbol: watchlistSymbols.symbol }).from(watchlistSymbols)
            .where(eq(watchlistSymbols.userId, u.id))).map((r) => r.symbol),
        );
        // The lock orders arrival, not edit order: a save sent on page exit can
        // overtake an earlier save still in flight. Drop anything older than
        // the last applied revision and report what is stored instead.
        if (hasRev && rev <= (lastWatchlistRev.get(u.id) ?? 0)) {
          return { stale: [...current].sort() };
        }
        // Symbols already saved may stay even if the published set dropped them;
        // anything newly added must be published.
        const invalid = desired.filter((s) => !current.has(s) && !universe.includes(s));
        if (invalid.length) return { invalid };
        await tx.delete(watchlistSymbols).where(
          desired.length
            ? and(eq(watchlistSymbols.userId, u.id), notInArray(watchlistSymbols.symbol, desired))
            : eq(watchlistSymbols.userId, u.id),
        );
        if (desired.length) {
          await tx.insert(watchlistSymbols)
            .values(desired.map((symbol) => ({ userId: u.id, symbol })))
            .onConflictDoNothing();
        }
        if (hasRev) lastWatchlistRev.set(u.id, rev);
        return { saved: desired.sort() };
      });
      if ("invalid" in symbols) {
        return res.status(400).json({ error: `not in the published set: ${symbols.invalid!.join(", ")}` });
      }
      if ("stale" in symbols) {
        return res.json({ ok: true, stale: true, symbols: symbols.stale });
      }
      res.json({ ok: true, symbols: symbols.saved });
    } catch (e: any) {
      console.error("[watchlist] PUT failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to save watchlist" });
    }
  });

  app.delete("/api/watchlist/:symbol", requireUser, async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const u = (req as any).kfUser as SessionUser;
      const symbol = String(req.params.symbol || "").toUpperCase().trim();
      await db
        .delete(watchlistSymbols)
        .where(and(eq(watchlistSymbols.userId, u.id), eq(watchlistSymbols.symbol, symbol)));
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[watchlist] DELETE failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to remove symbol" });
    }
  });

  // ---- alert prefs --------------------------------------------------------
  app.get("/api/alerts/prefs", requireUser, async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const u = (req as any).kfUser as SessionUser;
      const eligibleForDefaults = u.emailVerified && await hasAcceptedCurrentTos(u.id);
      if (eligibleForDefaults) await ensureDefaultAlertPrefs(u.id);
      const rows = await db.select().from(alertPrefs).where(eq(alertPrefs.userId, u.id));
      const prefs = Object.fromEntries(
        ALERT_KINDS.map((kind) => [
          kind,
          { enabled: eligibleForDefaults, settings: normalizeAlertSettings(kind, {}) },
        ]),
      ) as Record<AlertKind, { enabled: boolean; settings: unknown }>;
      for (const row of rows) {
        if (!ALERT_KINDS.includes(row.kind as AlertKind)) continue;
        const kind = row.kind as AlertKind;
        prefs[kind] = {
          enabled: row.enabled,
          settings: normalizeAlertSettings(kind, row.settings),
        };
      }
      res.json({ prefs, kinds: ALERT_KINDS });
    } catch (e: any) {
      console.error("[alerts] prefs GET failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to load alert prefs" });
    }
  });

  // Enabling ANY alert requires: verified email + accepted CURRENT ToS.
  // Disabling is always allowed.
  app.put("/api/alerts/prefs", requireUser, async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const u = (req as any).kfUser as SessionUser;
      const kind = String(req.body?.kind || "");
      const enabled = Boolean(req.body?.enabled);
      if (!ALERT_KINDS.includes(kind as AlertKind)) {
        return res.status(400).json({ error: "unknown alert kind" });
      }
      const alertKind = kind as AlertKind;
      const hasSettings = Object.prototype.hasOwnProperty.call(req.body ?? {}, "settings");
      let settings: unknown;
      if (hasSettings) {
        try {
          settings = parseAlertSettings(alertKind, req.body.settings);
        } catch (error: any) {
          return res.status(400).json({ error: error?.message || "invalid alert settings" });
        }
      }
      if (enabled) {
        if (!u.emailVerified) {
          return res.status(403).json({ error: "verify your email before enabling alerts", code: "EMAIL_UNVERIFIED" });
        }
        if (!(await hasAcceptedCurrentTos(u.id))) {
          return res.status(403).json({ error: "accept the current terms before enabling alerts", code: "TOS_REQUIRED" });
        }
        // Re-enabling clears a prior unsubscribe-all suppression for this address —
        // an explicit signed-in opt-in outranks the old opt-out.
        await db.delete(emailSuppression).where(eq(emailSuppression.email, u.email.toLowerCase()));
      }
      await db
        .insert(alertPrefs)
        .values({
          userId: u.id,
          kind: alertKind,
          enabled,
          ...(hasSettings ? { settings } : {}),
        })
        .onConflictDoUpdate({
          target: [alertPrefs.userId, alertPrefs.kind],
          set: {
            enabled,
            updatedAt: new Date(),
            ...(hasSettings ? { settings } : {}),
          },
        });
      res.json({
        ok: true,
        kind: alertKind,
        enabled,
        ...(hasSettings ? { settings } : {}),
      });
    } catch (e: any) {
      console.error("[alerts] prefs PUT failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to update alert prefs" });
    }
  });

  // ---- unsubscribe (no login: signed token from the email) ---------------
  // GET = human landing page with a confirm button; POST = RFC 8058 one-click
  // (mail clients POST with no body) AND the landing page's confirm action.
  app.get("/api/alerts/unsubscribe", (req: Request, res: Response) => {
    const parsed = verifyUnsubToken(String(req.query.token || ""));
    if (!parsed) return res.status(400).send(unsubPage("Invalid or expired unsubscribe link.", null));
    res.send(unsubPage(null, String(req.query.token)));
  });

  app.post("/api/alerts/unsubscribe", async (req: Request, res: Response) => {
    try {
      const parsed = verifyUnsubToken(String(req.query.token || ""));
      if (!parsed) return res.status(400).json({ error: "invalid token" });
      await applyUnsubscribe(parsed.userId, parsed.kind);
      // One-click callers ignore the body; the landing page reads ok.
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[alerts] unsubscribe failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to unsubscribe" });
    }
  });

  // ---- Resend webhook: bounces/complaints -> suppression ------------------
  app.post("/api/resend/webhook", async (req: Request, res: Response) => {
    try {
      if (!process.env.RESEND_WEBHOOK_SECRET) {
        return res.status(503).json({ error: "webhook not configured" });
      }
      if (!verifySvix(req)) return res.status(401).json({ error: "bad signature" });
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const type = String(req.body?.type || "");
      if (type === "email.bounced" || type === "email.complained") {
        const tos: string[] = req.body?.data?.to || [];
        const reason = type === "email.bounced" ? "bounce" : "complaint";
        for (const email of tos) {
          await db
            .insert(emailSuppression)
            .values({ email: String(email).toLowerCase(), reason })
            .onConflictDoNothing();
        }
        console.log(`[resend-webhook] ${reason}: suppressed ${tos.length} address(es)`);
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[resend-webhook] failed:", e?.message ?? e);
      res.status(500).json({ error: "webhook processing failed" });
    }
  });
}

function unsubPage(error: string | null, token: string | null): string {
  const body = error
    ? `<p class="err">${error}</p>`
    : `<p>Stop receiving these alert emails?</p>
       <form method="POST" action="/api/alerts/unsubscribe?token=${encodeURIComponent(token || "")}">
         <button type="submit">Unsubscribe</button>
       </form>
       <p class="mut">You can re-enable alerts any time from your account page.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe · KineFractal</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:ui-monospace,Menlo,Consolas,monospace;background:#0a0e14;color:#e6edf3;display:flex;justify-content:center;padding-top:12vh}
.card{max-width:420px;padding:32px;border:1px solid #1f2733;border-radius:8px}
.brand{color:#00ff88;font-size:12px;letter-spacing:2px;margin-bottom:16px}
button{background:#00ff88;color:#0a0e14;border:0;padding:10px 20px;border-radius:4px;font-weight:bold;cursor:pointer;font-family:inherit}
.err{color:#f87171}.mut{color:#6b7280;font-size:12px}</style></head>
<body><div class="card"><div class="brand">KINE FRACTAL</div>${body}</div></body></html>`;
}
