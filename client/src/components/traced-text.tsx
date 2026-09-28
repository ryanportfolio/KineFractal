// TracedText — headlines are traces, not fonts.
//
// Renders text as single-stroke SVG glyph paths (lib/trace-font) that DRAW
// via stroke-dashoffset when `active` flips true: 700ms expo-out per letter,
// 45ms stagger, and each letter flashes beam-core for a beat as the beam
// leaves it, then settles to beam-hot with a soft mid-glow underlay.
// A visually-hidden real-text twin carries accessibility and copy-paste.
// `instant`: fully drawn, no animation.
import { useMemo, useId } from "react";
import { layoutTraceText, TRACE_CAP, TRACE_PAD } from "@/lib/trace-font";

interface TracedTextProps {
  text: string;
  /** draw the strokes (one-shot); false = invisible, waiting for the beam */
  active?: boolean;
  /** render fully drawn with zero motion (return visits) */
  instant?: boolean;
  /** CSS height of the cap, e.g. "clamp(28px,4vw,44px)" — width follows */
  className?: string;
  as?: "h1" | "h2" | "h3" | "div" | "span";
  /** ms per-letter stagger */
  stagger?: number;
  /** ms added before the first letter starts */
  delay?: number;
  strokeWidth?: number;
}

export function TracedText({
  text,
  active = false,
  instant = false,
  className,
  as: Tag = "div",
  stagger = 45,
  delay = 0,
  strokeWidth = 1.35,
}: TracedTextProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const line = useMemo(() => layoutTraceText(text), [text]);
  const H = TRACE_CAP + TRACE_PAD * 2;
  const drawn = instant || active;

  return (
    <Tag className={className} style={{ position: "relative", display: "block" }}>
      <span className="sr-only">{text}</span>
      <svg
        viewBox={`0 ${-TRACE_PAD} ${Math.max(line.width, 1)} ${H}`}
        style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <filter id={`tglow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="0.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {line.glyphs.map((g, i) => {
          const d = instant ? 0 : delay + i * stagger;
          return (
            <g key={i} filter={`url(#tglow-${uid})`}>
              {/* afterglow underlay — the phosphor around the stroke */}
              <path
                d={g.d}
                fill="none"
                stroke="hsl(var(--beam-mid) / 0.22)"
                strokeWidth={strokeWidth * 2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={drawn ? 0 : 1}
                style={
                  instant
                    ? undefined
                    : {
                        transition: `stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1) ${d}ms`,
                      }
                }
              />
              {/* the beam stroke itself */}
              <path
                d={g.d}
                fill="none"
                stroke="hsl(var(--beam-hot))"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={drawn ? 0 : 1}
                style={
                  instant
                    ? undefined
                    : {
                        transition: `stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1) ${d}ms`,
                      }
                }
              >
                {/* core flash as the beam finishes the letter */}
                {!instant && active && (
                  <animate
                    attributeName="stroke"
                    values="hsl(var(--beam-hot));hsl(var(--beam-core));hsl(var(--beam-hot))"
                    keyTimes="0;0.5;1"
                    dur="0.24s"
                    begin={`${(d + 560) / 1000}s`}
                    fill="freeze"
                  />
                )}
              </path>
            </g>
          );
        })}
      </svg>
    </Tag>
  );
}
