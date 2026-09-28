import { motion } from "framer-motion";
import { Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { LegalFooter } from "@/components/legal-footer";

export default function DivergenceCTA() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden flex flex-col">
      <Navbar />
      
      <style>{`
        @keyframes scanline-drift {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes ascii-glow {
          0%, 100% { 
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.4), 0 0 20px rgba(0, 255, 136, 0.2);
            filter: drop-shadow(0 0 8px rgba(0, 255, 136, 0.3));
          }
          50% { 
            text-shadow: 0 0 30px rgba(0, 255, 136, 0.8), 0 0 50px rgba(0, 255, 136, 0.4), 0 0 80px rgba(0, 255, 136, 0.2);
            filter: drop-shadow(0 0 20px rgba(0, 255, 136, 0.6));
          }
        }
        @keyframes button-pulse {
          0% { 
            box-shadow: 0 0 15px rgba(0, 255, 136, 0.3), inset 0 0 15px rgba(0, 255, 136, 0.05);
          }
          50% { 
            box-shadow: 0 0 40px rgba(0, 255, 136, 0.8), inset 0 0 30px rgba(0, 255, 136, 0.15);
          }
          100% { 
            box-shadow: 0 0 15px rgba(0, 255, 136, 0.3), inset 0 0 15px rgba(0, 255, 136, 0.05);
          }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .terminal-bg {
          background: 
            repeating-linear-gradient(
              0deg,
              rgba(0, 255, 136, 0.03),
              rgba(0, 255, 136, 0.03) 1px,
              transparent 1px,
              transparent 2px
            ),
            linear-gradient(135deg, rgba(0, 255, 136, 0.02) 0%, rgba(0, 0, 0, 0.95) 100%);
          animation: scanline-drift 8s linear infinite;
        }
        .ascii-button {
          animation: ascii-glow 2s ease-in-out infinite;
          font-family: 'Courier New', monospace;
          line-height: 1.1;
          letter-spacing: -0.02em;
          white-space: pre;
        }
        .button-container {
          animation: button-pulse 4s cubic-bezier(0.4, 0.0, 0.6, 1.0) infinite;
          border: 2px solid rgba(0, 255, 136, 0.5);
          border-radius: 2px;
          padding: 12px;
          display: inline-block;
        }
        .float-element {
          animation: float-up 3s ease-in-out infinite;
        }
      `}</style>

      <div className="flex-1 flex items-center justify-center px-4 terminal-bg">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-center space-y-12 max-w-4xl"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="space-y-4"
          >
            <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
              &gt; INSTITUTIONAL ANALYSIS ENGINE
            </div>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tighter text-white uppercase mb-4">
              Catch Inflection <span className="text-primary">Points</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-mono max-w-2xl mx-auto">
              Real-time divergence detection across 4 fundamental regimes.
              <br />
              Acceleration vs. Deceleration in Revenue, Margins, Earnings &amp; FCF.
            </p>
          </motion.div>

          {/* ASCII Button */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="float-element"
          >
            <Link href="/divergence-dashboard">
              <div className="flex justify-center w-full">
                <div className="button-container cursor-pointer hover:border-primary transition-all duration-300 group">
                  <pre className="ascii-button text-primary text-xs md:text-sm leading-tight group-hover:text-primary">
{`█████████████████████████████████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░█▀▄░▀█▀░█░█░█▀▀░█▀▄░█▀▀░█▀▀░█▀█░█▀▀░█▀▀░░░░░░░░░░░░░░░░░░█
█░░░░░░█░█░░█░░▀▄▀░█▀▀░█▀▄░█░█░█▀▀░█░█░█░░░█▀▀░░░░░░░░░░░░░░░░░░█
█░░░░░░▀▀░░▀▀▀░░▀░░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░░░░░░░░░░░░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█████████████████████████████████████████████████████████████████████`}
                  </pre>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16"
          >
            {[
              {
                icon: "⚡",
                title: "POWER REGIME",
                desc: "Accelerating revenue + Expanding margins = Best risk/reward setup",
              },
              {
                icon: "🔵",
                title: "TREND REGIME",
                desc: "Decelerating revenue + Expanding margins = Transitional phase",
              },
              {
                icon: "🔴",
                title: "WARN REGIME",
                desc: "Decelerating revenue + Contracting margins = Bearish signal",
              },
              {
                icon: "⚠️",
                title: "WATCH REGIME",
                desc: "Accelerating revenue + Contracting margins = Turnaround play",
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + idx * 0.1, duration: 0.6 }}
                className="p-4 bg-black/40 border border-primary/30 rounded-sm backdrop-blur-sm hover:border-primary/60 transition-all duration-300 text-left"
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <div className="font-mono font-bold text-primary uppercase text-sm mb-2">
                  {feature.title}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="pt-8 border-t border-primary/20 space-y-4"
          >
            <p className="text-sm text-muted-foreground font-mono">
              &gt; READY_FOR_ANALYSIS? Click the button above to begin.
            </p>
            <p className="text-xs text-muted-foreground font-mono opacity-60">
              Track company-level acceleration across 4 metrics • Detect divergences before price moves • QoQ &amp; YoY analysis
            </p>
          </motion.div>
        </motion.div>
        <LegalFooter />
      </div>
    </div>
  );
}
