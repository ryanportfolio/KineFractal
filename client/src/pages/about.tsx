// About — the story page, in the beam register.
//
// Same voice rules as the rest of the site: plain verbs, no em dashes,
// fragments joined with · and →, no proof-chips. Numbers stay on the home
// page and /lab; this page explains what the thing IS and what it is not.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { BeamHeading } from "@/components/beam-heading";
import { AboutHero } from "@/components/about-hero";
import { AboutRail } from "@/components/about-rail";
import { DEPLOY } from "@/data/fearlab-board";
import { useEngineLabel } from "@/hooks/use-fearlab-live";

const SECTIONS: { n: string; title: string; body: ReactNode }[] = [
  {
    n: "01",
    title: "WHAT THIS IS",
    body: (
      <>
        <p className="mb-4">
          Kine Fractal is one rules engine pointed at three index funds: SPY, QQQ and IWM. It buys
          when the market is afraid, sized to how afraid · it takes profit only into strength · on
          SPY it steps aside entirely when price breaks its long-term protection line.
        </p>
        <p>
          No shorts, no leverage, no intraday trading. The engine re-reads the full price history
          after each close and derives every decision from fixed rules. The{" "}
          <Link href="/#rulebook" className="text-beam-hot underline underline-offset-4">
            rulebook
          </Link>{" "}
          on the home page walks through all five rules with the deployed numbers.
        </p>
      </>
    ),
  },
  {
    n: "02",
    title: "WHY IT EXISTS",
    body: (
      <>
        <p className="mb-4">
          A falling market makes selling feel safe and buying feel reckless, which is exactly
          backwards for a long-term holder of index funds. The fix here is mechanical: write the
          rules while calm, then let them run while everyone panics.
        </p>
        <p>
          The bar it has to clear is honest and hard: buy and hold, same deposits, same dates.
          Every chart on this site draws that comparison, year by year, window by window. When the
          engine loses a year to holding, the chart says so.
        </p>
      </>
    ),
  },
  {
    n: "03",
    title: "WHAT'S ON THE SITE",
    body: (
      <>
        <div className="space-y-3">
          <p>
            <Link href="/" className="text-beam-hot underline underline-offset-4">home</Link>
            <span className="text-beam-dim"> → </span>
            the live verdict: strategy vs holding, the yearly record, the rulebook, the engine's
            posture right now
          </p>
          <p>
            <Link href="/lab" className="text-beam-hot underline underline-offset-4">lab</Link>
            <span className="text-beam-dim"> → </span>
            every fund, every start year · each cell opens a full report: equity curves, monthly
            heat, recent fills
          </p>
          <p>
            <a href="/charts/" className="text-beam-hot underline underline-offset-4">charts</a>
            <span className="text-beam-dim"> → </span>
            the levels workbench: support and resistance, trendlines, dark-pool prints, drawn by
            the same pipeline the engine uses
          </p>
          <p>
            <Link href="/account" className="text-beam-hot underline underline-offset-4">account</Link>
            <span className="text-beam-dim"> → </span>
            watchlists and email alerts, tied to the same end-of-day data
          </p>
        </div>
      </>
    ),
  },
  {
    n: "04",
    title: "WHAT IT ISN'T",
    body: (
      <>
        <p className="mb-4">
          Not investment advice, not a product, not a signal service. It is one person's research
          engine with its record published where anyone can read it.
        </p>
        <p>
          Past results say nothing certain about future ones · read the{" "}
          <Link href="/legal/disclaimer" className="text-beam-hot underline underline-offset-4">
            disclaimer
          </Link>{" "}
          before taking anything here as more than research.
        </p>
      </>
    ),
  },
  {
    n: "05",
    title: "HOW IT RUNS",
    body: (
      <>
        <p>
          After each market close, the engine replays its full history from scratch and publishes
          the results as plain data files · this site reads those files and draws them · nothing on
          a page is typed in by hand. When a feed is unreachable the page says offline instead of
          guessing.
        </p>
      </>
    ),
  },
];

export default function About() {
  // Live board's variant set wins; the DEPLOY snapshot is only the offline
  // fallback (useEngineLabel). A deploy flip must not need a repo edit here.
  const variants = useEngineLabel();
  const funds = DEPLOY.map((d) => d.sym).join(" · ");

  useDocumentMeta({
    title: "About",
    description:
      "How the Kine Fractal engine buys fear in SPY, QQQ and IWM and trims into strength: the rules, the record, the method.",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <AboutRail />
      <main className="px-5 md:px-10 pt-28 pb-24">
        <AboutHero />
        <div className="max-w-4xl mx-auto pt-20">
          <div className="max-w-[320px] mb-3">
            <BeamHeading text="ABOUT" as="h2" active instant={false} />
          </div>
          <p className="etched text-beam-dim mb-16">
            {funds} · engine {variants} · end-of-day · long only
          </p>

          <div className="space-y-16">
            {SECTIONS.map((s) => (
              <section key={s.n} aria-label={s.title}>
                <div className="etched text-beam-dim mb-1">{s.n}</div>
                <h2 className="font-mono font-semibold tracking-[0.14em] text-beam-hot mb-4">
                  {s.title}
                </h2>
                <div className="font-mono text-[15px] leading-relaxed text-beam-mid max-w-[68ch]">
                  {s.body}
                </div>
              </section>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
