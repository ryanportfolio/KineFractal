// BeamHeading — a legible section headline that still reads as a beam trace.
//
// Interior section titles used TracedText, whose hand-authored single-stroke
// skeleton font is gorgeous at the flagship KINE FRACTAL scale but unreadable
// at heading size. BeamHeading renders REAL text in the display face, phosphor-
// hot with a soft glow, and reveals it with a left-to-right beam wipe when
// `active` flips true — so the scope still "draws" the headline, but you can
// read it. TracedText stays for the hero + navbar wordmark only.
//
// Drop-in for TracedText's heading props (text / as / active / instant), plus
// an optional delay. A visually-hidden twin is not needed: the text is real,
// so it is already accessible and selectable.
interface BeamHeadingProps {
  text: string;
  /** run the wipe reveal (one-shot) when true; false = hidden, waiting */
  active?: boolean;
  /** render fully shown with no motion (no-beam pages) */
  instant?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3" | "div" | "span";
  /** ms before the wipe starts */
  delay?: number;
}

export function BeamHeading({
  text,
  active = false,
  instant = false,
  className = "",
  as: Tag = "h2",
  delay = 0,
}: BeamHeadingProps) {
  const drawn = instant || active;
  return (
    <Tag
      className={`beam-heading ${className}`}
      data-drawn={drawn ? "1" : "0"}
      style={instant || !delay ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {text}
    </Tag>
  );
}
