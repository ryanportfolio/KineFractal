import { motion } from "framer-motion";
import { Cpu, ShieldAlert, Zap, Terminal } from "lucide-react";
import { Link } from "wouter";
import heroBg from "@assets/generated_images/industrial_brutalist_grid_texture.webp";
import { FloatingIconsBackground } from "@/components/floating-icons-background";
import { KineFractalWordmark } from "@/components/kine-fractal-wordmark";
import { TerminalOnlineDecoder } from "@/components/terminal-online-decoder";
import { TextRevealDecoder } from "@/components/text-reveal-decoder";
import { DataRain } from "@/components/data-rain";

export function Hero() {
  return (
    <div className="relative min-h-[90vh] flex flex-col justify-center overflow-visible border-b border-white/10">
      {/* Conic Gradient Background */}
      <div 
        className="absolute inset-0 z-0 opacity-20 mix-blend-screen"
        style={{
          background: 'conic-gradient(#a257c8, #40eda4)',
        }}
      />

      {/* Background */}
      <div 
        className="absolute inset-0 z-0 opacity-20 mix-blend-luminosity"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Data Rain Layer */}
      <DataRain />

      {/* Floating Icons Ether */}
      <FloatingIconsBackground />

      {/* Scanlines Overlay */}
      <div className="absolute inset-0 z-0 scanlines opacity-10 pointer-events-none" />

      {/* Dot Matrix Texture Overlay */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 255, 136, 0.6) 1px, transparent 1px)',
          backgroundSize: '4px 4px',
        }}
      />

      <div className="container relative z-10 px-4 md:px-6 overflow-visible">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">

          {/* Left Column: Main Typography */}
          <div className="lg:col-span-8 relative">
            {/* Local CRT Overlay for Logo Area */}
            <div className="absolute -inset-4 z-0 pointer-events-none opacity-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-10"
            >
              <style>{`
                @keyframes glitch-cycle {
                  0% {
                    text-shadow: 
                      2px 2px rgba(255, 0, 0, 0.8),
                      -2px -2px rgba(0, 255, 255, 0.8),
                      4px 4px rgba(255, 255, 0, 0.6),
                      -4px -4px rgba(0, 255, 136, 0.6);
                    transform: skewX(-0.05deg);
                    opacity: 0.85;
                    letter-spacing: 0px;
                  }
                  8% {
                    text-shadow: 
                      -3px 3px rgba(255, 0, 255, 0.9),
                      3px -3px rgba(0, 255, 100, 0.9),
                      -5px 5px rgba(255, 100, 0, 0.7);
                    transform: scaleX(0.95) skewX(-0.1deg);
                    opacity: 0.7;
                    letter-spacing: 2px;
                  }
                  16% {
                    text-shadow: 
                      4px -4px rgba(0, 100, 255, 0.9),
                      -4px 4px rgba(255, 255, 0, 0.9),
                      5px -5px rgba(0, 255, 136, 0.8);
                    transform: scaleX(1.05) skewX(0.08deg);
                    opacity: 0.65;
                    letter-spacing: -1px;
                  }
                  24% {
                    text-shadow: 
                      -2px -2px rgba(255, 0, 0, 0.8),
                      2px 2px rgba(0, 255, 255, 0.8),
                      3px 3px rgba(100, 255, 0, 0.7);
                    transform: scaleX(0.98) skewX(-0.06deg);
                    opacity: 0.75;
                    letter-spacing: 1px;
                  }
                  32% {
                    text-shadow: 
                      5px 0px rgba(255, 100, 200, 0.8),
                      -5px 0px rgba(0, 255, 100, 0.8),
                      0px 5px rgba(100, 100, 255, 0.6);
                    transform: scaleX(1.02) skewX(0.03deg);
                    opacity: 0.8;
                    letter-spacing: 0.5px;
                  }
                  40% {
                    text-shadow: none;
                    transform: scaleX(1) skewX(0deg);
                    opacity: 1;
                    letter-spacing: 0px;
                  }
                  100% {
                    text-shadow: none;
                    transform: scaleX(1) skewX(0deg);
                    opacity: 1;
                    letter-spacing: 0px;
                  }
                }
                @keyframes decode-reveal {
                  0% {
                    opacity: 0;
                    clip-path: inset(0 100% 0 0);
                  }
                  100% {
                    opacity: 1;
                    clip-path: inset(0 0 0 0);
                  }
                }
                .glitch-online {
                  animation: glitch-cycle 4s infinite, decode-reveal 1.2s ease-out 3s forwards;
                  display: inline-block;
                  position: relative;
                }
                .glitch-online::before {
                  content: 'Online';
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  opacity: 0;
                  animation: glitch-glyphify 4s infinite;
                  color: rgba(255, 0, 0, 0.8);
                }
                .glitch-online::after {
                  content: 'Online';
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  opacity: 0;
                  animation: glitch-glyphify-alt 4s infinite;
                  color: rgba(0, 255, 255, 0.8);
                }
                @keyframes glitch-glyphify {
                  0% { opacity: 0; }
                  7% { opacity: 0.8; clip-path: inset(0 0 65% 0); }
                  8% { opacity: 0.8; clip-path: inset(35% 0 0 0); }
                  9% { opacity: 0; }
                  32% { opacity: 0; }
                  33% { opacity: 0.7; clip-path: inset(0 20% 0 0); }
                  34% { opacity: 0; }
                  100% { opacity: 0; }
                }
                @keyframes glitch-glyphify-alt {
                  0% { opacity: 0; }
                  6% { opacity: 0; }
                  7% { opacity: 0.7; clip-path: inset(60% 0 0 0); }
                  8% { opacity: 0.7; clip-path: inset(0 0 30% 0); }
                  9% { opacity: 0; }
                  24% { opacity: 0; }
                  25% { opacity: 0.8; clip-path: inset(0 0 0 70%); }
                  26% { opacity: 0; }
                  100% { opacity: 0; }
                }
                @keyframes rgb-glitch-1 {
                  0%, 100% { 
                    text-shadow: 
                      -2px 0 1px rgba(255,0,0,0.7),
                      2px 0 1px rgba(0,0,255,0.7);
                  }
                  20% {
                    text-shadow: 
                      -1px 0 1px rgba(255,0,0,0.5),
                      1px 0 1px rgba(0,0,255,0.5);
                  }
                  40% {
                    text-shadow: 
                      -3px 0 1px rgba(255,0,0,0.8),
                      3px 0 1px rgba(0,0,255,0.8);
                  }
                  60% {
                    text-shadow: 
                      -1px 0 1px rgba(255,0,0,0.6),
                      1px 0 1px rgba(0,0,255,0.6);
                  }
                  80% {
                    text-shadow: 
                      -2px 0 1px rgba(255,0,0,0.7),
                      2px 0 1px rgba(0,0,255,0.7);
                  }
                }
                .rgb-glitch {
                  animation: rgb-glitch-1 0.15s infinite;
                }
              `}</style>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px w-12 bg-primary" />
                <span className="glitch-online">
                  <TerminalOnlineDecoder text="ONLINE" />
                </span>
              </div>

              <Link href="/about">
                <motion.h1
                  className="mb-8 group cursor-pointer w-full max-w-4xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <span className="sr-only">Kine Fractal</span>
                  <KineFractalWordmark className="block w-full transition-transform duration-300 group-hover:scale-[1.02] origin-left" />
                </motion.h1>
              </Link>

              <p className="text-xl md:text-2xl font-mono text-muted-foreground max-w-2xl leading-relaxed border-l-2 border-primary pl-6">
                <span className="rgb-glitch text-xs md:text-sm">// PROTOCOL V6.0</span>
                <br/>
                <span className="rgb-glitch text-white font-bold">
                  <TextRevealDecoder text="Decode Market Structure" />
                </span>
              </p>
            </motion.div>
          </div>

          {/* Right Column: Technical Specs */}
          <div className="lg:col-span-4">
             <Link href="/indicator/divergence">
               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.2, duration: 0.5 }}
                 className="bg-white/3 border border-primary/30 p-6 backdrop-blur-xl cursor-pointer hover:border-primary/60 hover:bg-white/7 transition-all duration-300 shadow-lg shadow-primary/10 rounded-lg"
               >
                 <div className="font-mono text-sm text-muted-foreground mb-4 flex justify-between">
                    <span>MODULE_STATUS</span>
                    <span className="text-green-500">ACTIVE</span>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                       <div className="flex items-center gap-2 text-sm font-bold">
                          <Cpu className="w-4 h-4 text-primary" />
                          PHYSICS_ENGINE
                       </div>
                       <div className="text-sm font-mono">RUNNING</div>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                       <div className="flex items-center gap-2 text-sm font-bold">
                          <ShieldAlert className="w-4 h-4 text-accent" />
                          TRAP_FILTER
                       </div>
                       <div className="text-sm font-mono">ENABLED</div>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                       <div className="flex items-center gap-2 text-sm font-bold">
                          <Zap className="w-4 h-4 text-white" />
                          EXECUTION
                       </div>
                       <div className="text-sm font-mono">AUTO</div>
                    </div>
                 </div>

                 <div className="mt-6 pt-4 border-t border-white/10 relative overflow-hidden rounded-sm">
                    <style>{`
                      @keyframes terminal-glow {
                        0%, 100% { text-shadow: 0 0 8px rgba(0, 255, 136, 0.5), 0 0 16px rgba(0, 255, 136, 0.2); }
                        50% { text-shadow: 0 0 16px rgba(0, 255, 136, 0.8), 0 0 32px rgba(0, 255, 136, 0.5), 0 0 48px rgba(0, 255, 136, 0.3); }
                      }
                      @keyframes cursor-blink {
                        0%, 49% { opacity: 1; }
                        50%, 100% { opacity: 0; }
                      }
                      @keyframes typing-1 {
                        0% { width: 0; opacity: 1; }
                        100% { width: 32ch; opacity: 1; }
                      }
                      @keyframes typing-2 {
                        0% { width: 0; opacity: 1; }
                        100% { width: 31ch; opacity: 1; }
                      }
                      @keyframes typing-3 {
                        0% { width: 0; opacity: 1; }
                        100% { width: 7ch; opacity: 1; }
                      }
                      @keyframes scanline-move {
                        0% { top: -100%; }
                        100% { top: 100%; }
                      }
                      .terminal-container {
                        background: linear-gradient(135deg, rgba(0, 255, 136, 0.02) 0%, rgba(0, 255, 136, 0.01) 100%);
                        border: 1px solid rgba(0, 255, 136, 0.3);
                        padding: 16px;
                        font-family: 'JetBrains Mono', 'Courier New', monospace;
                        position: relative;
                        box-shadow: 0 0 20px rgba(0, 255, 136, 0.1) inset, 0 0 10px rgba(0, 255, 136, 0.05);
                      }
                      .terminal-container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(0, 255, 136, 0.4), transparent);
                        animation: none;
                      }
                      .terminal-container::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: repeating-linear-gradient(
                          0deg,
                          rgba(0, 255, 136, 0.02),
                          rgba(0, 255, 136, 0.02) 1px,
                          transparent 1px,
                          transparent 2px
                        );
                        animation: scanline-move 8s linear infinite;
                        pointer-events: none;
                        z-index: 1;
                      }
                      .terminal-text {
                        position: relative;
                        z-index: 2;
                      }
                      .terminal-line {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                        font-size: 13px;
                        color: rgba(0, 255, 136, 0.9);
                        text-shadow: 0 0 8px rgba(0, 255, 136, 0.5), 0 0 16px rgba(0, 255, 136, 0.2);
                        letter-spacing: 0.5px;
                      }
                      .terminal-line:last-child {
                        margin-bottom: 0;
                      }
                      .terminal-prompt {
                        color: rgba(0, 255, 136, 0.7);
                        margin-right: 8px;
                        font-weight: bold;
                      }
                      .terminal-output-1 {
                        overflow: hidden;
                        white-space: nowrap;
                        animation: typing-1 2s steps(32, end) 0.3s forwards;
                      }
                      .terminal-output-2 {
                        overflow: hidden;
                        white-space: nowrap;
                        animation: typing-2 2s steps(31, end) 2.3s forwards;
                      }
                      .terminal-output-3 {
                        overflow: hidden;
                        white-space: nowrap;
                        animation: typing-3 1.5s steps(7, end) 4.3s forwards;
                      }
                      .terminal-cursor {
                        display: none;
                      }
                      .terminal-output-3 .terminal-cursor {
                        display: inline-block;
                        width: 8px;
                        height: 1em;
                        background: rgba(0, 255, 136, 0.8);
                        margin-left: 2px;
                        animation: cursor-blink 1s infinite;
                        box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
                      }
                    `}</style>
                    <div className="terminal-container">
                      <div className="terminal-text">
                        <div className="terminal-line">
                          <span className="terminal-prompt">&gt;</span>
                          <span className="terminal-output-1">LISTENING FOR DAILY DIV SIGNALS<span className="terminal-cursor" /></span>
                        </div>
                        <div className="terminal-line">
                          <span className="terminal-prompt">&gt;</span>
                          <span className="terminal-output-2">CALCULATING VELOCITY VECTORS<span className="terminal-cursor" /></span>
                        </div>
                        <div className="terminal-line">
                          <span className="terminal-prompt">&gt;</span>
                          <span className="terminal-output-3">READY<span className="terminal-cursor" /></span>
                        </div>
                      </div>
                    </div>
                 </div>
               </motion.div>
             </Link>
          </div>

        </div>

        {/* MATRIX CTA BUTTON - DIALED TO 1000% */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-16 flex justify-center relative overflow-visible"
        >
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
            @keyframes stroke-pulse {
              0% { text-shadow: 0 0 0px #0f0; opacity: 1; }
              50% { text-shadow: 0 0 10px #0f0; opacity: 0.8; }
              100% { text-shadow: 0 0 0px #0f0; opacity: 1; }
            }
            .access-outline {
              animation: stroke-pulse 4s ease-in-out infinite;
            }
          `}</style>

          <Link href="/indicator-library">
            <button 
              className="matrix-cta group relative px-8 py-4 border-2 border-[#00ff88] bg-black/80 backdrop-blur-lg text-[#00ff88] font-mono font-bold uppercase tracking-[0.2em] text-lg hover:bg-[#00ff88]/10 transition-all duration-300 rounded-sm"
              data-testid="button-cta-indicator-library"
            >
              <div className="flex items-center gap-3 relative z-20">
                <Terminal className="matrix-icon w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="matrix-text access-outline">&gt; ACCESS_INDICATOR_LIBRARY</span>
                <span className="matrix-text terminal-cursor-char">▌</span>
              </div>
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}