import { useEffect, useRef } from 'react';

export function DataRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    let height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;

    // Characters to drop: Mix of numbers, katakana (classic matrix), and math symbols
    const chars = '0123456789ABCDEFxyz+-=<>[]{}'; 
    const charArray = chars.split('');
    
    const fontSize = 14;
    const columns = width / fontSize;
    
    // Array to keep track of the y coordinate of each drop
    const drops: number[] = [];
    for (let i = 0; i < columns; i++) {
      // Random start positions to stagger the rain
      drops[i] = Math.random() * -100; 
    }

    const draw = () => {
      // Black with very low opacity to create the trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Randomize color for "glitch" chars, mostly green/primary
        const isGlitch = Math.random() > 0.99;
        if (isGlitch) {
             ctx.fillStyle = '#ffffff'; // White sparkle
        } else {
             // Use the primary emerald color, very faint
             ctx.fillStyle = 'rgba(0, 255, 136, 0.16)';
        }

        const text = charArray[Math.floor(Math.random() * charArray.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Reset drop to top randomly after it has crossed the screen
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        // Increment y coordinate
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50); // Speed of rain

    const handleResize = () => {
        width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
        height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none z-0 mix-blend-screen opacity-40"
    />
  );
}
