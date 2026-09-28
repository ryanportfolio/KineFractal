// AsciiHeading — section headlines in the terminal's own register.
//
// Renders the headline as a figlet-small ASCII banner (lib/ascii-banner) in
// beam-hot phosphor with a soft glow, wiped in left-to-right when `active`
// flips true — the same reveal contract as TracedText, which it replaces for
// the big headings. A visually-hidden real-text twin carries accessibility
// and copy-paste. Font size auto-fits the container so long banners never
// overflow on any viewport.
import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { asciiBanner } from "@/lib/ascii-banner";

interface AsciiHeadingProps {
  text: string;
  /** wipe the banner in (one-shot); false = invisible, waiting for the beam */
  active?: boolean;
  /** render fully visible with zero motion (return visits) */
  instant?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3" | "div" | "span";
  /** ms added before the wipe starts */
  delay?: number;
  /** upper bound on the banner font size, px */
  maxPx?: number;
}

// with the container widths in use this lands 10-16px for long banners and
// caps the short ones (ABOUT, EVERY YEAR) before they turn into billboards
const DEFAULT_MAX_PX = 16;

export function AsciiHeading({
  text,
  active = false,
  instant = false,
  className = "",
  as = "h2",
  delay = 0,
  maxPx = DEFAULT_MAX_PX,
}: AsciiHeadingProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [px, setPx] = useState(maxPx);
  const banner = useMemo(() => asciiBanner(text), [text]);
  const cols = useMemo(
    () => banner.split("\n").reduce((m, r) => Math.max(m, r.length), 1),
    [banner],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      // ui-monospace advance ≈ 0.602em; clamp so tiny screens stay legible
      const w = el.clientWidth;
      if (w > 0) setPx(Math.max(4.5, Math.min(maxPx, w / (cols * 0.602))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, maxPx]);

  const drawn = instant || active;
  const children: ReactNode = (
    <>
      <span className="sr-only">{text}</span>
      <div ref={wrapRef} className="w-full">
        <pre
          aria-hidden="true"
          className={`ascii-heading ${drawn ? "on" : ""} ${instant ? "instant" : ""}`}
          style={{ fontSize: `${px}px`, transitionDelay: instant ? undefined : `${delay}ms` }}
        >
          {banner}
        </pre>
      </div>
    </>
  );
  return createElement(as, { className: `block ${className}` }, children);
}
