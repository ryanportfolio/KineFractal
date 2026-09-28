// Better Auth instance (P2 accounts — platform/P2-DESIGN.md).
// Email + password only; NO billing, no OAuth providers. Accounts exist so
// users can keep a watchlist and opt into email alerts. Email verification is
// required before alerts can be ENABLED (enforced in /api/alerts/prefs), but
// browsing and sign-in never require it — the site stays fully public.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "@shared/schema";

const FROM = process.env.ALERTS_FROM || "KineFractal <onboarding@resend.dev>";
const RESEND_KEY = process.env.RESEND_API_KEY || "";

async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!RESEND_KEY) {
    console.warn("[auth] RESEND_API_KEY unset — verification email NOT sent to", to);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[auth] Resend send failed ${res.status}: ${body.slice(0, 300)}`);
  }
}

function verificationEmail(url: string): { html: string; text: string } {
  const text = `Verify your KineFractal email\n\nClick to verify: ${url}\n\nIf you didn't create an account, ignore this email.`;
  const html = `<div style="font-family:ui-monospace,Menlo,Consolas,monospace;background:#0a0e14;color:#e6edf3;padding:32px;border-radius:8px;max-width:520px">
  <div style="color:#00ff88;font-size:13px;letter-spacing:2px;margin-bottom:16px">KINE FRACTAL</div>
  <h2 style="margin:0 0 12px;font-size:18px;color:#e6edf3">Verify your email</h2>
  <p style="font-size:14px;line-height:1.6;color:#9aa4b2">Confirm this address to finish setting up your account. Verification is required before email alerts can be enabled.</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#00ff88;color:#0a0e14;text-decoration:none;padding:10px 20px;border-radius:4px;font-weight:bold;font-size:14px">Verify email</a></p>
  <p style="font-size:12px;color:#6b7280">If you didn't create a KineFractal account, ignore this email.</p>
</div>`;
  return { html, text };
}

// db may be null in dev without DATABASE_URL — auth is then unavailable and the
// /api/auth mount answers 503 (see app.ts).
export const auth = db
  ? betterAuth({
      database: drizzleAdapter(db, { provider: "pg", schema }),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
      trustedOrigins: [
        "https://kinefractal.com",
        "https://www.kinefractal.com",
        "https://web-production-781bd.up.railway.app",
        "http://localhost:5000",
      ],
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // gate is on ALERT enablement, not login
        minPasswordLength: 8,
      },
      session: {
        // Keep users signed in as long as practically possible: sessions live a
        // year, and any visit inside that year rolls the expiry forward another
        // year (sliding window). A user is only signed out after a full year of
        // no visits, an explicit sign-out, or clearing cookies.
        expiresIn: 60 * 60 * 24 * 365, // 1 year
        updateAge: 60 * 60 * 24, // refresh expiry at most once per day of activity
      },
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          const { html, text } = verificationEmail(url);
          await sendViaResend(user.email, "Verify your KineFractal email", html, text);
        },
      },
      advanced: {
        database: { generateId: undefined }, // Better Auth default ids
      },
    })
  : null;

export type Auth = NonNullable<typeof auth>;
