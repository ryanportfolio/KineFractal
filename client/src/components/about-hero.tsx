import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";

import { KfLogo } from "@/components/kf-logo";
import { ABOUT_CTA_CHANNELS, KINE_WORDS, nextKineWordIndex } from "@/lib/about-hero-model";

export function AboutHero() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const sync = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
        interval = null;
      } else if (!interval) {
        interval = setInterval(() => setWordIndex(nextKineWordIndex), 2500);
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <section
      aria-labelledby="about-hero-title"
      className="relative mx-auto flex min-h-[88svh] max-w-6xl flex-col items-center justify-center overflow-hidden pb-20 pt-8 text-center"
    >
      <div className="pointer-events-none absolute inset-x-[10%] top-[18%] h-[46%] rounded-full bg-[hsl(var(--beam-hot)/0.06)] blur-[90px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8 h-40 w-40 md:h-56 md:w-56"
      >
        <div className="absolute inset-3 rounded-full bg-[hsl(var(--beam-hot)/0.12)] blur-3xl" />
        <KfLogo className="relative h-full w-full" animate revealFx />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full"
      >
        <h1
          id="about-hero-title"
          className="flex min-h-[1.15em] w-full items-baseline justify-center font-mono text-[clamp(1.5rem,7vw,5.75rem)] font-semibold leading-none tracking-[-0.08em] text-beam-mid"
        >
          <span>KINE</span>
          <span className="relative ml-[0.08em] inline-grid w-[9ch] text-left text-beam-hot drop-shadow-[0_0_16px_hsl(var(--beam-hot)/0.45)]">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1">STRUCTURE</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={KINE_WORDS[wordIndex]}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                className="col-start-1 row-start-1 inline-block"
              >
                {KINE_WORDS[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        <div className="relative mx-auto mt-7 max-w-xl border-y border-[hsl(var(--beam-ghost))] px-6 py-4">
          <p className="font-mono text-sm font-semibold tracking-[0.18em] text-beam-hot md:text-base">
            CONFLUENCE IS RELEVANCE
          </p>
        </div>
      </motion.div>

      <nav aria-label="Kine Fractal terminals" className="relative mt-14 grid w-full gap-4 md:grid-cols-3 md:gap-5">
        {ABOUT_CTA_CHANNELS.map((channel, index) => (
          <motion.div
            key={channel.href}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.6 + index * 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={channel.href}
              data-phosphor={channel.phosphor}
              className="group relative flex min-h-36 flex-col justify-center overflow-hidden border border-[hsl(var(--beam-hot)/0.45)] bg-[hsl(var(--tube-h)_28%_3.2%)] p-6 text-left shadow-[0_0_20px_hsl(var(--beam-hot)/0.12),inset_0_0_24px_hsl(var(--beam-hot)/0.035)] transition-[border-color,box-shadow,transform] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-beam-hot hover:shadow-[0_0_32px_hsl(var(--beam-hot)/0.28),inset_0_0_28px_hsl(var(--beam-hot)/0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--beam-hot))] focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            >
              <motion.span
                aria-hidden="true"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 0.8, 0.2] }}
                transition={{ duration: 0.7, delay: 0.72 + index * 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 top-0 h-px origin-left bg-[hsl(var(--beam-core))] shadow-[0_0_12px_hsl(var(--beam-hot))]"
              />
              <div className="font-mono text-lg font-semibold tracking-[0.06em] text-beam-hot md:text-xl">
                → {channel.title}
              </div>
              <div className="mt-3 font-mono text-sm leading-relaxed text-beam-dim group-hover:text-beam-mid md:text-base">
                {channel.description}
              </div>
            </Link>
          </motion.div>
        ))}
      </nav>
    </section>
  );
}
