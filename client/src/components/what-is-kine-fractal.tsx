import { Layers, Terminal } from "lucide-react";
import { Link } from "wouter";

export function WhatIsKineFractal() {
  return (
    <section className="relative py-12 px-4 md:px-6 border-b border-primary/20 overflow-hidden">
      {/* Seamless Blend Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-black/40 z-0 pointer-events-none" />
      {/* Matrix Grid Background */}
      <div className="absolute inset-0 matrix-bg-grid opacity-30 z-0 pointer-events-none" />
      {/* Scanning Line Effect */}
      <div className="matrix-scan-line z-0 pointer-events-none" />
      <div className="container max-w-5xl mx-auto relative z-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3 text-shadow-glow">
            <Layers className="w-6 h-6 text-primary animate-pulse" />
            WHAT IS KINE FRACTAL?
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-transparent shadow-[0_0_10px_rgba(0,255,136,0.5)]"></div>
          <div className="mt-3 space-y-1 text-sm font-mono text-primary/60">
            <div>&gt; KINE: Kinematics</div>
            <div className="text-primary/40">&gt; The study of motion and momentum in markets</div>
          </div>
        </div>

        <div className="relative">
          <style>{`
            .terminal-description {
              position: relative;
              overflow: hidden;
              background: linear-gradient(135deg, rgba(0, 255, 136, 0.03) 0%, rgba(0, 255, 136, 0.01) 100%);
              border: 1px solid rgba(0, 255, 136, 0.2);
              border-left: 3px solid rgba(0, 255, 136, 0.6);
            }
            .terminal-description::before {
              content: '';
              position: absolute;
              inset: 0;
              background: linear-gradient(90deg, rgba(0, 255, 136, 0.05), transparent);
              pointer-events: none;
            }
            .terminal-description::after {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 1px;
              background: linear-gradient(90deg, transparent, rgba(0, 255, 136, 0.3), transparent);
              animation: scan-line-pulse 3s ease-in-out infinite;
            }
            @keyframes scan-line-pulse {
              0%, 100% { opacity: 0.2; }
              50% { opacity: 0.6; }
            }
            @keyframes pulse-underline {
              0%, 100% { 
                border-bottom-color: rgba(0, 255, 136, 0.4);
              }
              50% { 
                border-bottom-color: rgba(0, 255, 136, 1);
              }
            }
            .terminal-text {
              position: relative;
              z-index: 2;
            }
            .terminal-prefix {
              color: rgba(0, 255, 136, 0.8);
              font-weight: bold;
            }
            .terminal-content {
              color: rgba(0, 255, 136, 0.9);
              text-shadow: 0 0 8px rgba(0, 255, 136, 0.3), 0 0 16px rgba(0, 255, 136, 0.1);
            }
            .indicator-link {
              font-weight: bold;
              color: rgba(0, 255, 136, 0.9);
              text-decoration: none;
              position: relative;
              display: inline;
              border-bottom: 2px solid rgba(0, 255, 136, 0.4);
              animation: pulse-underline 2s ease-in-out infinite;
              transition: color 0.3s ease;
            }
            .indicator-link:hover {
              color: rgba(0, 255, 136, 1);
            }
          `}</style>
          <div className="terminal-description backdrop-blur-md p-6 md:p-8 rounded-sm">
            <div className="terminal-text font-mono text-sm md:text-base leading-relaxed">
              <span className="terminal-prefix">&gt; UNIFIED_DECISION_ENGINE</span>
              <br />
              <span className="terminal-content block mt-3">
                Kine Fractal synthesizes market complexity into a unified decision engine. By fusing five distinct analytical domains (<Link href="/divergence-dashboard"><span className="indicator-link">momentum derivatives</span></Link>, <Link href="/indicator/macro-data"><span className="indicator-link">market breadth</span></Link>, <Link href="/indicator/context"><span className="indicator-link">volume profiling</span></Link>, <Link href="/indicator/structure"><span className="indicator-link">institutional structure</span></Link>, and <Link href="/indicator/risk-dashboard"><span className="indicator-link">volatility regimes</span></Link>), it acts based on a Stack of Probability, rather than isolated signals.
              </span>
            </div>
          </div>
        </div>

        {/* Playbook CTA */}
        <div className="mt-12 flex justify-start relative">
          <style>{`
            @keyframes matrix-pulse {
              0%, 100% { 
                box-shadow: 0 0 12px rgba(0, 255, 136, 0.4), inset 0 0 12px rgba(0, 255, 136, 0.1);
                border-color: rgba(0, 255, 136, 0.6);
              }
              50% { 
                box-shadow: 0 0 30px rgba(0, 255, 136, 0.9), 0 0 50px rgba(0, 255, 136, 0.5), inset 0 0 25px rgba(0, 255, 136, 0.3);
                border-color: rgba(0, 255, 136, 1);
              }
            }
            @keyframes matrix-text-glow {
              0%, 100% { text-shadow: 0 0 10px rgba(0, 255, 136, 0.5), 0 0 20px rgba(0, 255, 136, 0.2); }
              50% { text-shadow: 0 0 20px rgba(0, 255, 136, 0.8), 0 0 40px rgba(0, 255, 136, 0.6), 0 0 60px rgba(0, 255, 136, 0.4); }
            }
            @keyframes matrix-scan {
              0% { top: -100%; }
              100% { top: 100%; }
            }
            @keyframes cyber-shimmer {
              0%, 100% { transform: scaleX(1); opacity: 0.3; }
              50% { opacity: 0.8; }
            }
            .matrix-cta {
              animation: matrix-pulse 2.5s ease-in-out infinite;
              position: relative;
              overflow: hidden;
            }
            .matrix-cta::before {
              content: '';
              position: absolute;
              top: -100%;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(to bottom, transparent, #00ff88, transparent);
              animation: matrix-scan 3s linear infinite;
              opacity: 0.6;
            }
            .matrix-cta::after {
              content: '';
              position: absolute;
              inset: 0;
              background: linear-gradient(45deg, transparent 30%, rgba(0, 255, 136, 0.1) 50%, transparent 70%);
              animation: cyber-shimmer 3s ease-in-out infinite;
            }
            .matrix-text {
              animation: matrix-text-glow 2s ease-in-out infinite;
              position: relative;
              z-index: 10;
            }
            .matrix-icon {
              animation: matrix-text-glow 2s ease-in-out infinite;
              position: relative;
              z-index: 10;
            }
            @keyframes terminal-cursor-blink {
              0%, 49% { opacity: 1; }
              50%, 100% { opacity: 0; }
            }
            .terminal-cursor-char {
              animation: terminal-cursor-blink 1s infinite;
            }
          `}</style>
          
          <Link href="/indicator/playbook">
            <button 
              className="matrix-cta group relative px-8 py-4 border-2 border-[#00ff88] bg-black/80 backdrop-blur-lg text-[#00ff88] font-mono font-bold uppercase tracking-[0.2em] text-lg hover:bg-[#00ff88]/10 transition-all duration-300 rounded-sm"
              data-testid="button-cta-playbook"
            >
              <div className="flex items-center gap-3 relative z-20">
                <Terminal className="matrix-icon w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="matrix-text">&gt; EXECUTE_PLAYBOOK_STRATEGY</span>
                <span className="matrix-text terminal-cursor-char">▌</span>
              </div>
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
