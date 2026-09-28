// About — the story page, told as a scroll film.
//
// The hero introduces the brand while AboutRail draws the ignition figure in
// the margin; AboutStory then pins a full-screen canvas
// and plays the engine's story from bundled report data as the reader
// scrolls. The short note underneath keeps the page's standing caveats.
import { Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { AboutHero } from "@/components/about-hero";
import { AboutRail } from "@/components/about-rail";
import { AboutStory } from "@/components/about-story/about-story";
import { DEPLOY } from "@/data/fearlab-board";
import { useEngineLabel } from "@/hooks/use-fearlab-live";

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
      <main className="pb-24">
        {/* above the margin figure, so its coils pass behind the hero cards */}
        <div className="relative z-10 px-5 pt-28 md:px-10">
          <AboutHero />
        </div>
        <AboutStory />
        <div className="mx-auto max-w-4xl px-5 pt-16 md:px-10">
          <p className="etched mb-6 text-beam-dim">
            {funds} · engine {variants} · end-of-day · long only
          </p>
          <p className="max-w-[68ch] font-mono text-[15px] leading-relaxed text-beam-mid">
            Not investment advice and not a signal service: one person's research engine, with its
            record published where anyone can read it. Past results say nothing certain about future
            ones · read the{" "}
            <Link href="/legal/disclaimer" className="text-beam-hot underline underline-offset-4">
              disclaimer
            </Link>{" "}
            before taking anything here as more than research.
          </p>
        </div>
      </main>
    </div>
  );
}
