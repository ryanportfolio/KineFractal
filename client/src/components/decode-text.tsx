// DecodeText — the old homepage's scramble-decoder, retuned for THE SIGNAL.
//
// When the beam arrives (the caller's `active` flips), the line resolves
// left-to-right out of raw binary — the terminal register the site used to
// speak in. One shot, beam-choreographed (no wall-clock timers), instant
// under `instant`, sr-only twin so screen readers never hear the static.
import { useEffect, useRef, useState } from "react";

const STATIC = "01";

export function DecodeText({
  text,
  active,
  instant = false,
  className = "",
}: {
  text: string;
  active: boolean;
  instant?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(instant ? text : "");
  const done = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (done.current) {
      // a prop flip mid-scramble (e.g. the beam releasing sets `instant`)
      // re-runs this effect and the cleanup killed the interval — never
      // leave the line frozen half-decoded; snap to the real text
      setShown(text);
      return;
    }
    done.current = true;
    if (instant) {
      setShown(text);
      return;
    }
    let i = 0;
    const iv = setInterval(() => {
      i += 1.5; // resolve ~1.5 chars per tick — quick, not showy
      const at = Math.min(Math.floor(i), text.length);
      setShown(
        text.slice(0, at) +
          text
            .slice(at)
            .split("")
            .map((ch) => (ch === " " || ch === "·" ? ch : STATIC[(Math.random() * 2) | 0]))
            .join(""),
      );
      if (at >= text.length) clearInterval(iv);
    }, 28);
    return () => clearInterval(iv);
  }, [active, instant, text]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown || " "}</span>
    </span>
  );
}
