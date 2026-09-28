import { useState, useEffect } from "react";

interface TextRevealDecoderProps {
  text: string;
  className?: string;
}

const SYMBOLS = "01";

export function TextRevealDecoder({ text, className = "" }: TextRevealDecoderProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    const finalVal = text;
    let iteration = 0;

    // Wait 2 seconds before starting
    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplay(
          finalVal
            .split("")
            .map((letter, index) => {
              if (index < iteration) {
                return finalVal[index];
              }
              return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            })
            .join("")
        );

        if (iteration >= finalVal.length) {
          clearInterval(interval);
        }

        iteration += 1 / 2;
      }, 30);

      return () => clearInterval(interval);
    }, 1100);

    return () => clearTimeout(startTimer);
  }, [text]);

  return <span className={className}>{display}</span>;
}
