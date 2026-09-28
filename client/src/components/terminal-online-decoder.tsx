import { useState, useEffect, useRef } from "react";

interface TerminalOnlineDecoderProps {
  text: string;
}

const CHARSET = "█▓▒░<>/\\!@#*";
const DECODE_DURATION = 2400; // milliseconds - longer for more dramatic effect
const REVEAL_DELAY = 3000; // milliseconds (3 seconds)

export function TerminalOnlineDecoder({ text }: TerminalOnlineDecoderProps) {
  const [display, setDisplay] = useState<string[]>(text.split("").map(() => CHARSET[0]));
  const [hasStarted, setHasStarted] = useState(false);
  const stateRef = useRef({
    revealed: Array(text.length).fill(false),
    frameCount: 0,
  });

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setHasStarted(true);
      stateRef.current.frameCount = 0;
    }, REVEAL_DELAY);

    return () => clearTimeout(revealTimer);
  }, [text]);

  useEffect(() => {
    if (!hasStarted) return;

    let animationFrameId: number;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DECODE_DURATION, 1);

      // Calculate how many characters should be revealed
      const revealCount = Math.floor(progress * text.length);

      // Update state
      stateRef.current.frameCount += 1;
      const state = stateRef.current;

      // Mark revealed characters
      for (let i = 0; i < revealCount && i < text.length; i++) {
        state.revealed[i] = true;
      }

      // Build display
      const newDisplay = text.split("").map((char, index) => {
        if (state.revealed[index]) {
          // Character is revealed - show the final letter
          return text[index];
        } else {
          // Character is not yet revealed - cycle through random chars
          return CHARSET[Math.floor(Math.random() * CHARSET.length)];
        }
      });

      setDisplay(newDisplay);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [hasStarted, text]);

  return (
    <span className="inline-block font-mono text-sm text-primary uppercase tracking-widest">
      {display.join("")}
    </span>
  );
}
