// P2 account page: sign in / sign up / request a password reset (?mode=forgot;
// the emailed link lands on /reset-password), email verification status, and the
// versioned ToS acceptance that gates alert enablement (platform/P2-DESIGN.md).
// Watchlist and alert settings live on /alerts.

import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { Link } from "wouter";
import { ShieldCheck, MailCheck, MailWarning, LogOut, FileCheck2 } from "lucide-react";
import { useSession, signIn, signUp, signOut, authClient, csrfFetch } from "@/lib/auth-client";
import { TOS_VERSION, TOS_POINTS } from "@shared/tos";
import { safeNext, nextLabel } from "@/lib/safe-next";
import { clearChartLineCache } from "@/lib/chart-line-cache";

// Where to send the visitor after signing in (?next=, same-origin paths only).
function readNext(): string | null {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

type Me = {
  user: { id: string; email: string; name: string; emailVerified: boolean } | null;
  tosAccepted?: boolean;
  tosVersion?: string;
};

type AuthMode = "signin" | "signup" | "forgot";

function readMode(): AuthMode {
  const m = new URLSearchParams(window.location.search).get("mode");
  return m === "signup" || m === "forgot" ? m : "signin";
}

// Where the emailed reset link lands; carries ?next= so the visitor can sign in
// afterwards and still get back to where they started.
function resetRedirect(): string {
  const next = readNext();
  return next ? `/reset-password?next=${encodeURIComponent(next)}` : "/reset-password";
}

function AuthForms() {
  const [mode, setModeState] = useState<AuthMode>(readMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setMode = (m: AuthMode) => {
    setModeState(m);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "forgot") {
        const r = await authClient.requestPasswordReset({ email, redirectTo: resetRedirect() });
        if (r.error) throw new Error(r.error.message || "could not send reset link");
        setNotice(`If an account exists for ${email}, a reset link is on its way. It expires in 1 hour.`);
      } else if (mode === "signup") {
        const r = await signUp.email({ email, password, name: email.split("@")[0] });
        if (r.error) throw new Error(r.error.message || "sign up failed");
        clearChartLineCache();
        setNotice("Account created. Check your inbox for a verification link.");
      } else {
        const r = await signIn.email({ email, password });
        if (r.error) throw new Error(r.error.message || "sign in failed");
        clearChartLineCache();
        const next = readNext();
        if (next) window.location.assign(next);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full bg-black/40 border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60";

  return (
    <div className="max-w-md mx-auto border border-border rounded-lg p-6 bg-card/50">
      <div className="flex gap-2 mb-6 text-xs font-mono uppercase tracking-widest">
        <button
          onClick={() => setMode("signin")}
          data-active={mode === "signin"}
          className="px-3 py-1.5 rounded border border-border data-[active=true]:border-primary data-[active=true]:text-primary"
        >
          Sign in
        </button>
        <button
          onClick={() => setMode("signup")}
          data-active={mode === "signup"}
          className="px-3 py-1.5 rounded border border-border data-[active=true]:border-primary data-[active=true]:text-primary"
        >
          Create account
        </button>
      </div>
      {mode === "forgot" && (
        <div className="mb-4">
          <h2 className="text-sm font-mono uppercase tracking-widest">Reset password</h2>
          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
            Enter your account email. We'll send a link to choose a new password.
          </p>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <input className={input} type="email" required placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        {mode !== "forgot" && (
          <input
            className={input}
            type="password"
            required
            minLength={8}
            placeholder={mode === "signup" ? "password (8+ characters)" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        )}
        {mode === "signin" && (
          <div className="text-right -mt-2">
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-xs font-mono text-muted-foreground underline hover:text-primary py-1"
            >
              Forgot password?
            </button>
          </div>
        )}
        <div role="status" aria-live="polite">
          {error && <div className="text-red-400 text-xs font-mono">{error}</div>}
          {notice && <div className="text-primary text-xs font-mono">{notice}</div>}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-primary-foreground font-bold rounded py-2 text-sm uppercase tracking-widest disabled:opacity-50"
        >
          {busy ? "…" : mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="w-full text-xs font-mono text-muted-foreground underline hover:text-primary py-1"
          >
            Back to sign in
          </button>
        )}
      </form>
      <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        Accounts are free and only exist to keep a watchlist and opt into email alerts.
        Informational use only · see <Link href="/legal/disclaimer" className="underline">terms</Link>.
      </p>
    </div>
  );
}

function TosCard({ accepted, onAccepted }: { accepted: boolean; onAccepted: () => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await csrfFetch("/api/tos/accept", { method: "POST", body: JSON.stringify({}) });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      onAccepted();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-card/50">
      <div className="flex items-center gap-2 mb-3">
        <FileCheck2 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest">Terms &amp; disclaimers</h2>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">v{TOS_VERSION}</span>
      </div>
      {accepted ? (
        <p className="text-xs text-primary font-mono flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Accepted (version {TOS_VERSION}). Alerts can be enabled.
        </p>
      ) : (
        <>
          <ul className="space-y-2 mb-4 text-xs text-muted-foreground leading-relaxed list-disc pl-4 max-h-56 overflow-y-auto pr-2">
            {TOS_POINTS.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-xs mb-4 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
            <span>
              I have read and accept the <Link href="/legal/disclaimer" className="underline">terms of service</Link> and understand
              this is not investment advice.
            </span>
          </label>
          {error && <div className="text-red-400 text-xs font-mono mb-2">{error}</div>}
          <button
            onClick={accept}
            disabled={!checked || busy}
            className="bg-primary text-primary-foreground font-bold rounded px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-40"
          >
            {busy ? "…" : "Accept terms"}
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Required once (per terms version) before email alerts can be enabled. Browsing never requires it.
          </p>
        </>
      )}
    </div>
  );
}

export default function Account() {
  const { data: session, isPending } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [resent, setResent] = useState(false);
  const [next] = useState(readNext);

  useDocumentMeta({ title: "Account", description: "Manage your Kine Fractal account and alert preferences." });

  const loadMe = () => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe(null));
  };

  useEffect(() => {
    if (session?.user) loadMe();
  }, [session?.user?.id]);

  const resendVerification = async () => {
    if (!session?.user?.email) return;
    await authClient.sendVerificationEmail({ email: session.user.email, callbackURL: "/account" });
    setResent(true);
  };

  return (
    <div className="bg-background text-foreground font-sans">
      <Navbar />
      <main className="pt-24 pb-16 container px-4 md:px-6 max-w-3xl mx-auto">
        <h1 className="beam-heading mb-8" data-drawn="1">
          Account<span className="text-primary">_</span>
        </h1>

        {session?.user && next && (
          <a
            href={next}
            className="mb-6 flex items-center justify-between gap-4 border border-primary/60 rounded-lg px-5 py-4 font-mono text-sm text-primary hover:bg-primary/5"
          >
            <span>You're signed in.</span>
            <span className="uppercase tracking-widest text-xs">Back to {nextLabel(next)} →</span>
          </a>
        )}

        {isPending ? (
          <div className="text-xs font-mono text-muted-foreground">loading…</div>
        ) : !session?.user ? (
          <AuthForms />
        ) : (
          <div className="space-y-6">
            <div className="border border-border rounded-lg p-6 bg-card/50 flex flex-wrap items-center gap-4">
              <div>
                <div className="text-sm font-mono">{session.user.email}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
                  {session.user.emailVerified ? (
                    <span className="text-primary flex items-center gap-1">
                      <MailCheck className="w-3.5 h-3.5" /> email verified
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <MailWarning className="w-3.5 h-3.5" /> email not verified · required for alerts
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                {!session.user.emailVerified && (
                  <button onClick={resendVerification} disabled={resent} className="text-xs font-mono underline disabled:opacity-50">
                    {resent ? "sent · check inbox" : "resend verification"}
                  </button>
                )}
                <button
                  onClick={async () => {
                    const r = await signOut();
                    if (!r?.error) clearChartLineCache();
                  }}
                  className="flex items-center gap-1.5 text-xs font-mono border border-border rounded px-3 py-1.5 hover:border-primary/60"
                >
                  <LogOut className="w-3.5 h-3.5" /> sign out
                </button>
              </div>
            </div>

            <TosCard accepted={!!me?.tosAccepted} onAccepted={loadMe} />

            <div data-phosphor="ice" className="border border-[hsl(var(--beam-ghost))] p-6">
              <div className="etched text-beam-dim">ALERT CONTROL MOVED</div>
              <h2 className="mt-3 font-mono text-lg font-semibold text-beam-hot">Alert Terminal</h2>
              <p className="mt-3 max-w-[58ch] font-mono text-xs leading-relaxed text-beam-dim">
                Choose symbols, alert families, gap stages, structure events, and weekly qualification rules from one dedicated instrument.
              </p>
              <Link
                href="/alerts"
                className="mt-6 inline-block border border-beam-hot px-4 py-2 font-mono text-xs font-semibold tracking-[0.12em] text-beam-hot hover:bg-[hsl(var(--beam-ghost))]"
              >
                OPEN ALERT TERMINAL →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
