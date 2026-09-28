import { useState, useEffect } from "react";

interface TextDecryptProps {
  text: string;
  className?: string;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";

export function TextDecrypt({ text, className }: TextDecryptProps) {
  const [display, setDisplay] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((char, index) => {
            if (index < iteration) {
              return text[index];
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );

      if (iteration >= text.length) {
        clearInterval(interval);
        setIsComplete(true);
      }

      iteration += 1 / 3; // Speed of decryption
    }, 30);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className}>
      {display}
    </span>
  );
}
