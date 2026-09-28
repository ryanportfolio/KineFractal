import { useId } from "react";
import { motion } from "framer-motion";

export function KfLogo({
  className = "w-full h-full",
  animate = true,
  revealFx = false,
}: {
  className?: string;
  animate?: boolean;
  revealFx?: boolean;
}) {
  // Stable per-instance ID: rerenders must not replace live SVG paint servers.
  const id = `kine-logo-${useId().replace(/:/g, "")}`;

  // Animation configuration
  const transitionProps = animate ? {
    duration: 1.5,
    ease: "easeInOut" as const
  } : {
    duration: 0
  };

  const circleTransition = animate ? { duration: 1, delay: 0 } : { duration: 0 };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Top line: a continuous warm supply zone blending into green demand. */}
          <linearGradient id={`${id}-top-gradient`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="18%" stopColor="#f97366" />
            <stop offset="36%" stopColor="#fb923c" />
            <stop offset="56%" stopColor="#facc15" />
            <stop offset="76%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>

          {/* Circle Gradient: Aqua -> Green */}
          <linearGradient id={`${id}-circle-gradient`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan-500 */}
            <stop offset="100%" stopColor="hsl(var(--primary))" /> {/* Acid Lime */}
          </linearGradient>
          
          <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Circle - Aqua/Green Gradient */}
        <motion.circle 
          cx="50" 
          cy="50" 
          r="48" 
          stroke={`url(#${id}-circle-gradient)`}
          strokeWidth="2"
          fill="transparent"
          className="opacity-100"
          initial={animate ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={circleTransition}
        />
        
        {/* Outer Circle Glow Layer (Static) */}
        <circle 
          cx="50" 
          cy="50" 
          r="48" 
          stroke={`url(#${id}-circle-gradient)`}
          strokeWidth="4"
          className="opacity-30 blur-md"
        />

        {/* Waves Group */}
        <g className="drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {[0, 1, 2, 3, 4].map((i) => {
                // Top line (index 0) gets the Red->Green gradient
                // Bottom lines (index 1-4) get solid Primary Green
                const isTopLine = i === 0;
                const strokeColor = isTopLine ? `url(#${id}-top-gradient)` : "hsl(var(--primary))";
                
                return (
                <motion.path
                    key={i}
                    d={[
                        "M20 35 C 35 25, 65 45, 80 35",   // Top
                        "M15 42.5 C 30 32.5, 60 52.5, 85 42.5",
                        "M12 50 C 27 40, 57 60, 88 50",   // Middle
                        "M15 57.5 C 30 47.5, 60 67.5, 85 57.5",
                        "M20 65 C 35 55, 65 75, 80 65"    // Bottom
                    ][i]}
                    stroke={strokeColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    initial={animate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ 
                        ...transitionProps,
                        delay: animate ? i * 0.1 : 0 
                    }}
                    style={{
                        filter: `url(#${id}-glow)`
                    }}
                />
            )})}
            
            {/* "White Hot" Core - Subtle overlay for neon effect */}
             {[0, 1, 2, 3, 4].map((i) => (
                <motion.path
                    key={`core-${i}`}
                    d={[
                        "M20 35 C 35 25, 65 45, 80 35",
                        "M15 42.5 C 30 32.5, 60 52.5, 85 42.5",
                        "M12 50 C 27 40, 57 60, 88 50",
                        "M15 57.5 C 30 47.5, 60 67.5, 85 57.5",
                        "M20 65 C 35 55, 65 75, 80 65"
                    ][i]}
                    stroke="white"
                    strokeWidth="1" 
                    strokeLinecap="round"
                    fill="none"
                    className="opacity-80" 
                    initial={animate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 0.8 }}
                    animate={{ pathLength: 1, opacity: 0.8 }}
                    transition={{ 
                        ...transitionProps,
                        delay: animate ? i * 0.1 : 0 
                    }}
                />
            ))}
        </g>
      </svg>
      
      {/* Ambient Background Glow - using a neutral mix to not clash */}
      <div className="absolute inset-0 rounded-full bg-white/5 blur-xl pointer-events-none animate-pulse-slow" />

      {revealFx && (
        <motion.div
          aria-hidden="true"
          initial={animate ? { y: "-100%", opacity: 0 } : false}
          animate={animate ? { y: "100%", opacity: [0, 0.22, 0] } : { opacity: 0 }}
          transition={{ duration: 1.1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(transparent_46%,hsl(var(--beam-core)/0.28)_50%,transparent_54%)]"
        />
      )}
    </div>
  );
}
