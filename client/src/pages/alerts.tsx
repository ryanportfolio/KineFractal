import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BellRing, MailCheck, Radar, SlidersHorizontal } from "lucide-react";

import { AlertControlPanel } from "@/components/alert-control-panel";
import { BeamHeading } from "@/components/beam-heading";
import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { useSession } from "@/lib/auth-client";

type Me = {
  user: { id: string; email: string; name: string; emailVerified: boolean } | null;
  tosAccepted?: boolean;
};

export default function Alerts() {
  const { data: session, isPending } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [mePending, setMePending] = useState(false);

  useDocumentMeta({
    title: "Free email alerts",
    description:
      "Free watchlist emails built after each market close from the same data that draws the charts, arriving the next morning. Alerts stay off until you turn them on, and a quiet day sends nothing.",
  });

  useEffect(() => {
    if (!session?.user) {
      setMe(null);
      return;
    }
    const controller = new AbortController();
    setMePending(true);
    fetch("/api/me", { credentials: "include", signal: controller.signal })
      .then((response) => response.json())
      .then(setMe)
      .catch((reason) => {
        if (reason?.name !== "AbortError") setMe(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMePending(false);
      });
    return () => controller.abort();
  }, [session?.user?.id]);

  const verified = !!session?.user?.emailVerified;
  const tosAccepted = !!me?.tosAccepted;
  const canEnable = verified && tosAccepted;
  const gateHint = mePending
    ? "checking your account…"
    : !verified
      ? "Verify your email before turning on alerts"
      : !tosAccepted
        ? "Accept the current terms before turning on alerts"
        : null;
  // the signed-out pitch waits for the session check, so a signed-in visitor
  // never sees it flash before the header shrinks
  const showPitch = !isPending && !session?.user;

  return (
    <div className="bg-background text-foreground">
      <Navbar />
      <main data-phosphor="ice" className="px-5 pb-10 pt-28 md:px-10 md:pb-12">
        <div className="mx-auto max-w-6xl">
          {/* Signed in, the panel's own summary explains the page, so the header
              shrinks to the title; signed out, it carries the pitch. */}
          <section
            className={
              !showPitch
                ? "pb-8"
                : "border-b border-[hsl(var(--beam-ghost))] pb-12 md:grid md:grid-cols-[1fr_0.72fr] md:items-start md:gap-16"
            }
          >
            <div>
              <div className="etched mb-4 text-beam-dim">EMAIL ALERTS · AFTER THE CLOSE</div>
              <div className={!showPitch ? "max-w-[360px]" : "max-w-[560px]"}>
                <BeamHeading text="ALERTS" as="h1" active instant={false} />
              </div>
              {showPitch && (
                <p className="mt-8 max-w-[58ch] font-mono text-sm leading-relaxed text-beam-mid md:text-base">
                  Free watchlist emails built after each market close from the same data that draws the charts and delivered the next morning; you choose what qualifies, and a quiet day sends nothing
                </p>
              )}
            </div>
            {showPitch && (
              <div className="mt-12 border-t border-[hsl(var(--beam-ghost))] pt-6 md:mt-0">
                <div className="grid grid-cols-2 gap-x-6 gap-y-6 font-mono text-[12px] xl:text-xs">
                  <div><Radar className="mb-2 h-4 w-4 text-beam-hot" aria-hidden="true" /><span className="text-beam-dim">WATCHLIST DRIVEN</span></div>
                  <div><MailCheck className="mb-2 h-4 w-4 text-beam-hot" aria-hidden="true" /><span className="text-beam-dim">INBOX DELIVERY</span></div>
                  <div><SlidersHorizontal className="mb-2 h-4 w-4 text-beam-hot" aria-hidden="true" /><span className="text-beam-dim">YOUR FILTERS</span></div>
                  <div><BellRing className="mb-2 h-4 w-4 text-beam-hot" aria-hidden="true" /><span className="text-beam-dim">FREE · UNSUBSCRIBE</span></div>
                </div>
              </div>
            )}
          </section>

          <section id="control" className={session?.user ? "pb-8 md:pb-10" : "py-8 md:py-10"}>
            {isPending ? (
              <div className="etched py-10 text-beam-dim">checking session…</div>
            ) : session?.user ? (
              <>
                {gateHint && !mePending && (
                  <Link href="/account?next=%2Falerts" className="mb-8 inline-block font-mono text-xs text-accent underline underline-offset-4">
                    {gateHint}: open Account →
                  </Link>
                )}
                <AlertControlPanel canEnable={canEnable} gateHint={gateHint} />
              </>
            ) : (
              <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
                <p className="max-w-[62ch] font-mono text-sm leading-relaxed text-beam-mid">
                  Create a free account, then choose tickers and filters here and turn on the alerts you want; nothing is sent until you do
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/account?mode=signup&next=%2Falerts" className="border border-beam-hot bg-[hsl(var(--beam-hot))] px-5 py-3 font-mono text-xs font-semibold tracking-[0.12em] text-[hsl(var(--primary-foreground))]">
                    CREATE FREE ACCOUNT
                  </Link>
                  <Link href="/account?next=%2Falerts" className="border border-[hsl(var(--beam-ghost))] px-5 py-3 font-mono text-xs font-semibold tracking-[0.12em] text-beam-mid hover:border-beam-hot hover:text-beam-hot">
                    SIGN IN
                  </Link>
                </div>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
