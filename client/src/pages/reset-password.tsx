// Landing page for the emailed reset link. Better Auth checks the token at
// /api/auth/reset-password/:token and redirects here with ?token= (valid) or
// ?error=INVALID_TOKEN (unknown, used or expired). A successful reset signs the
// account out on every device (revokeSessionsOnPasswordReset in server/auth.ts).

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { clearChartLineCache } from "@/lib/chart-line-cache";

function accountHref(mode: "signin" | "forgot", next: string | null): string {
  const q = new URLSearchParams();
  if (mode === "forgot") q.set("mode", "forgot");
  if (next) q.set("next", next);
  const s = q.toString();
  return s ? `/account?${s}` : "/account";
}

export default function ResetPassword() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const token = params.get("token");
  const next = safeNext(params.get("next"));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(!token || params.get("error") === "INVALID_TOKEN");
  const [done, setDone] = useState(false);

  useDocumentMeta({ title: "Reset password", description: "Choose a new password for your Kine Fractal account." });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await authClient.resetPassword({ newPassword: password, token: token! });
      if (r.error) {
        if (r.error.code === "INVALID_TOKEN") {
          setInvalid(true);
          return;
        }
        throw new Error(r.error.message || "could not reset password");
      }
      clearChartLineCache();
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full bg-black/40 border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60";
  const primaryLink =
    "block w-full text-center bg-primary text-primary-foreground font-bold rounded py-2 text-sm uppercase tracking-widest";

  return (
    <div className="bg-background text-foreground font-sans">
      <Navbar />
      <main className="pt-24 pb-16 container px-4 md:px-6 max-w-3xl mx-auto">
        <h1 className="beam-heading mb-8" data-drawn="1">
          Reset password<span className="text-primary">_</span>
        </h1>
        <div className="max-w-md mx-auto border border-border rounded-lg p-6 bg-card/50">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-mono uppercase tracking-widest">
              {done ? "Password updated" : invalid ? "Link not valid" : "Choose a new password"}
            </h2>
          </div>

          {done ? (
            <>
              <p role="status" className="text-xs font-mono text-primary leading-relaxed mb-6">
                Your password is changed. For safety, every device that was signed in to this account is now signed out.
              </p>
              <a href={accountHref("signin", next)} className={primaryLink}>
                Sign in
              </a>
            </>
          ) : invalid ? (
            <>
              <p className="text-xs font-mono text-amber-400 leading-relaxed mb-6">
                This reset link is invalid, already used, or older than 1 hour. Request a new one.
              </p>
              <a href={accountHref("forgot", next)} className={primaryLink}>
                Send a new link
              </a>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input
                className={input}
                type="password"
                required
                minLength={8}
                placeholder="new password (8+ characters)"
                aria-label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <input
                className={input}
                type="password"
                required
                minLength={8}
                placeholder="repeat new password"
                aria-label="Repeat new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              <div role="status" aria-live="polite">
                {error && <div className="text-red-400 text-xs font-mono">{error}</div>}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-primary text-primary-foreground font-bold rounded py-2 text-sm uppercase tracking-widest disabled:opacity-50"
              >
                {busy ? "Set new password…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
