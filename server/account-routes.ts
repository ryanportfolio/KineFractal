// P2 account routes: session info + ToS acceptance (platform/P2-DESIGN.md).
// Watchlist CRUD + alert prefs land in the follow-up PR on the same surface.

import type { Express, Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { tosAcceptances } from "@shared/schema";
import { TOS_VERSION } from "@shared/tos";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/** Resolve the Better Auth session user, or null. */
export async function sessionUser(req: Request): Promise<SessionUser | null> {
  if (!auth) return null;
  const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!s?.user) return null;
  const u = s.user;
  return { id: u.id, email: u.email, name: u.name, emailVerified: !!u.emailVerified };
}

/** Middleware: 401 unless signed in; attaches req.kfUser. */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  sessionUser(req)
    .then((u) => {
      if (!u) {
        res.status(401).json({ error: "sign in required" });
        return;
      }
      (req as any).kfUser = u;
      next();
    })
    .catch((e) => {
      console.error("[account] session resolve failed:", e?.message ?? e);
      res.status(500).json({ error: "session check failed" });
    });
}

export async function hasAcceptedCurrentTos(userId: string): Promise<boolean> {
  if (!db) return false;
  const rows = await db
    .select({ id: tosAcceptances.id })
    .from(tosAcceptances)
    .where(and(eq(tosAcceptances.userId, userId), eq(tosAcceptances.version, TOS_VERSION)))
    .limit(1);
  return rows.length > 0;
}

export function registerAccountRoutes(app: Express): void {
  // Session summary for the account page. Signed out => 200 {user:null} so the
  // client needs no error path to render the signed-out state.
  app.get("/api/me", async (req: Request, res: Response) => {
    try {
      const u = await sessionUser(req);
      if (!u) return res.json({ user: null });
      const tosAccepted = await hasAcceptedCurrentTos(u.id);
      res.json({ user: u, tosAccepted, tosVersion: TOS_VERSION });
    } catch (e: any) {
      console.error("[account] /api/me failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to load account" });
    }
  });

  // Record acceptance of the CURRENT ToS version. Idempotent.
  app.post("/api/tos/accept", requireUser, async (req: Request, res: Response) => {
    try {
      if (!db) return res.status(503).json({ error: "database unavailable" });
      const u = (req as any).kfUser as SessionUser;
      await db
        .insert(tosAcceptances)
        .values({ userId: u.id, version: TOS_VERSION })
        .onConflictDoNothing();
      res.json({ ok: true, tosVersion: TOS_VERSION });
    } catch (e: any) {
      console.error("[account] /api/tos/accept failed:", e?.message ?? e);
      res.status(500).json({ error: "failed to record acceptance" });
    }
  });
}
