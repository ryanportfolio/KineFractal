// P2 account page: sign in / sign up, email verification status, and the
// versioned ToS acceptance that gates alert enablement (platform/P2-DESIGN.md).
// Watchlist + alert toggles land here in the follow-up PR.

import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { Link } from "wouter";
import { ShieldCheck, MailCheck, MailWarning, LogOut, FileCheck2, ListChecks, BellRing } from "lucide-react";
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

function AuthForms() {
  const [mode, setMode] = useState<"signin" | "signup">(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
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
      <form onSubmit={submit} className="space-y-4">
        <input className={input} type="email" required placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
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
        {error && <div className="text-red-400 text-xs font-mono">{error}</div>}
        {notice && <div className="text-primary text-xs font-mono">{notice}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-primary-foreground font-bold rounded py-2 text-sm uppercase tracking-widest disabled:opacity-50"
        >
          {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        Accounts are free and only exist to keep a watchlist and opt into email alerts.
        Informational use only · see <Link href="/legal/disclaimer" className="underline">terms</Link>.
      </p>
    </div>
  );
}

function WatchlistCard() {
  const [universe, setUniverse] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/watchlist", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setUniverse(d.universe || []);
        setSymbols(d.symbols || []);
      })
      .catch(() => setError("failed to load watchlist"));
  };
  useEffect(load, []);

  const toggle = async (sym: string) => {
    const on = symbols.includes(sym);
    setError(null);
    // optimistic
    setSymbols((prev) => (on ? prev.filter((s) => s !== sym) : [...prev, sym].sort()));
    try {
      const r = on
        ? await csrfFetch(`/api/watchlist/${sym}`, { method: "DELETE" })
        : await csrfFetch("/api/watchlist", { method: "POST", body: JSON.stringify({ symbol: sym }) });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
    } catch (e: any) {
      setError(e.message);
      load(); // resync
    }
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-card/50">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest">Watchlist</h2>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          {symbols.length}/{universe.length}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Pick from the symbols published nightly (charts + alerts follow your selection).
      </p>
      {universe.length === 0 ? (
        <div className="text-xs font-mono text-muted-foreground">symbol list unavailable · try again later</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {universe.map((sym) => {
            const on = symbols.includes(sym);
            return (
              <button
                key={sym}
                onClick={() => toggle(sym)}
                data-on={on}
                className="px-3 py-1.5 rounded border text-xs font-mono border-border text-muted-foreground data-[on=true]:border-primary data-[on=true]:text-primary data-[on=true]:bg-primary/10"
              >
                {sym}
              </button>
            );
          })}
        </div>
      )}
      {error && <div className="text-red-400 text-xs font-mono mt-3">{error}</div>}
    </div>
  );
}

const ALERT_KIND_META: { kind: string; label: string; desc: string }[] = [
  {
    kind: "levels_weekly",
    label: "Weekly buy-limit digest",
    desc: "Mon + Fri: the strongest recently-tested support level below price for each watchlist symbol, framed as a suggested limit.",
  },
  {
    kind: "gap_daily",
    label: "Daily structure alerts",
    desc: "End of day: unfilled-gap, order-block and equilibrium transitions on your watchlist symbols. Only sends when something changed.",
  },
];

function AlertsCard({ canEnable, gateHint }: { canEnable: boolean; gateHint: string | null }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/alerts/prefs", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPrefs(d.prefs || {}))
      .catch(() => setError("failed to load alert settings"));
  }, []);

  const toggle = async (kind: string) => {
    const enabled = !prefs[kind];
    setError(null);
    setPrefs((p) => ({ ...p, [kind]: enabled })); // optimistic
    try {
      const r = await csrfFetch("/api/alerts/prefs", {
        method: "PUT",
        body: JSON.stringify({ kind, enabled }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
    } catch (e: any) {
      setError(e.message);
      setPrefs((p) => ({ ...p, [kind]: !enabled })); // revert
    }
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-card/50">
      <div className="flex items-center gap-2 mb-3">
        <BellRing className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-widest">Email alerts</h2>
      </div>
      {!canEnable && gateHint && (
        <p className="text-[11px] text-amber-400 font-mono mb-4">{gateHint}</p>
      )}
      <div className="space-y-4">
        {ALERT_KIND_META.map(({ kind, label, desc }) => (
          <label key={kind} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!prefs[kind]}
              disabled={!canEnable && !prefs[kind]}
              onChange={() => toggle(kind)}
            />
            <span>
              <span className="block text-sm">{label}</span>
              <span className="block text-[11px] text-muted-foreground leading-relaxed">{desc}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <div className="text-red-400 text-xs font-mono mt-3">{error}</div>}
      <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        Identical signal content for every recipient, on a fixed schedule. Informational only ·
        never investment advice. Every email carries a one-click unsubscribe.
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
        <h1 className="text-2xl font-bold uppercase tracking-tighter mb-8">
          Account<span className="text-primary">_</span>
        </h1>

        {session?.user && next && (
          <a
            href={next}
            className="mb-6 flex items-center justify-between gap-4 border border-primary/60 rounded-lg px-5 py-4 font-mono text-sm text-primary hover:bg-primary/5"
          >
            <span>Signed in. Your account is ready to use on {nextLabel(next)}.</span>
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
