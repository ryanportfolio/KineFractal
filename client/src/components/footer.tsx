// Footer — quiet brand plate, navigation, and legal context.
import { Link } from "wouter";
import { KINE_FRACTAL_BANNER } from "@/lib/ascii-banner";

export function Footer() {
  return (
    <footer className="relative border-t border-beam-ghost/70 mt-4" aria-label="Site information">
      <div className="absolute inset-0 graticule opacity-30" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-5 md:px-10 py-14">
        {/* the parked beam dot — the tube is on */}
        <span
          aria-hidden="true"
          className="absolute left-5 md:left-10 top-14 inline-block w-[6px] h-[6px]"
          style={{
            background: "hsl(var(--beam-hot))",
            boxShadow: "0 0 8px hsl(var(--beam-mid) / 0.7)",
            animation: "footer-dot-breathe 4s ease-in-out infinite",
          }}
        />
        <style>{`
          @keyframes footer-dot-breathe { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        `}</style>

        <div className="pl-6">
          {/* the wordmark stamped in plain text — the register the site grew up in */}
          <pre
            aria-hidden="true"
            className="hidden md:block font-mono text-[10px] leading-[1.15] tracking-normal text-beam-dim/80 mb-4 select-none"
          >
            {KINE_FRACTAL_BANNER}
          </pre>
        </div>

        <div className="pl-6 mt-6 flex flex-wrap gap-x-6 gap-y-2">
          {[
            { href: "/lab", label: "board" },
            { href: "/sector-rotation", label: "sectors" },
            { href: "/about", label: "about" },
            { href: "/legal/disclaimer", label: "disclaimer" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="etched text-beam-dim hover:text-beam-dim transition-colors">
              {l.label}
            </Link>
          ))}
        </div>

        <p className="pl-6 mt-8 max-w-[78ch] font-mono text-[12px] leading-relaxed text-beam-dim">
          Educational content only. Not investment, financial, or trading advice. Past performance
          does not guarantee future results. Trading involves substantial risk of loss.
        </p>
      </div>
    </footer>
  );
}
