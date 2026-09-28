import { useEffect, useRef } from 'react';

export function VectorFieldFractal({
  kicker = "Kinematics + Fractal Geometry",
  label = "Physics Engine",
  title = "Predict Turns",
  titleAccent = "Before They Happen",
  heightClass = "h-[250px]",
}: {
  kicker?: string;
  label?: string;
  title?: string;
  titleAccent?: string;
  heightClass?: string;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = container.offsetWidth;
    let height = container.offsetHeight;

    // Theme-following colors: read the phosphor vars once, re-read on
    // [data-phosphor] swaps so the canvas recolors with the theme.
    let primary = '';
    let particleColor = '';
    const readPhosphor = () => {
      primary = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary').trim();
      // lighter derivative of primary for the streaming particles
      const m = primary.match(/^([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%$/);
      particleColor = m
        ? `hsl(${m[1]} ${m[2]}% ${Math.min(parseFloat(m[3]) + 22, 88)}%)`
        : `hsl(${primary})`;
    };
    readPhosphor();
    const themeObs = new MutationObserver(readPhosphor);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-phosphor'] });

    // Set initial size
    canvas.width = width;
    canvas.height = height;

    // Configuration
    const PARTICLE_COUNT = 300; // Increased for mouse effect
    const SPEED_BASE = 2;
    
    // Dynamic Attractors (Gravity Wells)
    const attractors = [
        { x: 0.25 * width, y: 0.5 * height, vx: 1.5, vy: 0.8, r: 80 }, 
        { x: 0.75 * width, y: 0.5 * height, vx: -1.2, vy: -1.5, r: 80 }
    ];

    // Particle State: x, y, vx, vy, state(0=flow, 1=cryst), life
    const particles = new Float32Array(PARTICLE_COUNT * 6); 
    
    // Initialize
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        resetParticle(i, true);
    }

    function resetParticle(i: number, randomX: boolean = false) {
        const idx = i * 6;
        
        // Mouse Emitter Logic: 
        // If mouse is active, small chance to spawn there to simulate "adding" particles
        // But primarily we want to fill the screen, so we balance it.
        if (mouseRef.current.active && Math.random() < 0.1) {
             particles[idx] = mouseRef.current.x + (Math.random() - 0.5) * 20;
             particles[idx + 1] = mouseRef.current.y + (Math.random() - 0.5) * 20;
             particles[idx + 2] = (Math.random() - 0.5) * 4; // Explosion velocity
             particles[idx + 3] = (Math.random() - 0.5) * 4;
        } else {
            // Odd-indexed particles stream in from the right (moving left),
            // even-indexed from the left (moving right) -> field fills both sides.
            const fromRight = i % 2 === 1;
            const speed = SPEED_BASE + Math.random();
            particles[idx] = randomX
                ? Math.random() * width
                : (fromRight ? width + 10 : -10);
            particles[idx + 1] = Math.random() * height;
            particles[idx + 2] = fromRight ? -speed : speed;
            particles[idx + 3] = (Math.random() - 0.5) * 0.5;
        }
        
        particles[idx + 4] = 0; // State: Flowing
        particles[idx + 5] = 100 + Math.random() * 100; // Life
    }

    const render = () => {
        // Clear
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Draw Grid
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y <= height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();

        // Update & Draw Attractors
        attractors.forEach(attr => {
            // Bounce Logic
            attr.x += attr.vx;
            attr.y += attr.vy;

            if (attr.x < 50 || attr.x > width - 50) attr.vx *= -1;
            if (attr.y < 50 || attr.y > height - 50) attr.vy *= -1;

            // Draw Glow
            const gradient = ctx.createRadialGradient(attr.x, attr.y, 0, attr.x, attr.y, attr.r);
            gradient.addColorStop(0, `hsl(${primary} / 0.2)`);
            gradient.addColorStop(1, `hsl(${primary} / 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(attr.x, attr.y, attr.r, 0, Math.PI * 2);
            ctx.fill();

            // Core
            ctx.strokeStyle = `hsl(${primary})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(attr.x, attr.y, 15, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Update Particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const idx = i * 6;
            let x = particles[idx];
            let y = particles[idx + 1];
            let vx = particles[idx + 2];
            let vy = particles[idx + 3];
            let state = particles[idx + 4];
            let life = particles[idx + 5];

            life--;
            particles[idx + 5] = life;

            // Respawn if dead or off screen
            if (life <= 0 || x > width + 10 || x < -50 || y > height + 50 || y < -50) {
                resetParticle(i);
                continue; // Skip rest of loop for this particle
            }

            let influenced = false;

            if (state === 0) { // Flowing
                for (const attr of attractors) {
                    const dx = attr.x - x;
                    const dy = attr.y - y;
                    
                    if (Math.abs(dx) < attr.r && Math.abs(dy) < attr.r) {
                        const distSq = dx*dx + dy*dy;
                        if (distSq < attr.r * attr.r) {
                            influenced = true;
                            vx += dx * 0.005;
                            vy += dy * 0.005;
                            vx *= 0.9;
                            vy *= 0.9;

                            if (distSq < 400) { 
                                state = 1; // Crystallize
                                particles[idx + 4] = 1;
                            }
                        }
                    }
                }

                if (!influenced) {
                    const dir = i % 2 === 1 ? -1 : 1; // restore toward origin-side flow
                    vx += (dir * SPEED_BASE - vx) * 0.05;
                    vy += (0 - vy) * 0.05;
                }
            } else { // Crystallized
                vx *= 0.8;
                vy *= 0.8;
                if (Math.random() < 0.02) {
                    state = 0;
                    particles[idx + 4] = 0;
                    vx = (i % 2 === 1 ? -1 : 1) * SPEED_BASE;
                }
            }

            x += vx;
            y += vy;

            particles[idx] = x;
            particles[idx + 1] = y;
            particles[idx + 2] = vx;
            particles[idx + 3] = vy;

            // Draw
            if (state === 1) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(x, y - 4);
                ctx.lineTo(x + 4, y);
                ctx.lineTo(x, y + 4);
                ctx.lineTo(x - 4, y);
                ctx.fill();
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = `hsl(${primary})`;
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = particleColor;
                ctx.fillRect(x, y, 4, 2);
            }
        }
        
        // Mouse Trail Emitter (Extra visual)
        if (mouseRef.current.active) {
             // Occasionally spawn a burst from mouse just for visual flair
             // (Handled by resetParticle mostly, but we could force some here if needed)
        }

        animationFrameId = requestAnimationFrame(render);
    };

    render();

    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width: w, height: h } = entry.contentRect;
            if (w > 0 && h > 0) {
                width = w;
                height = h;
                canvas.width = w;
                canvas.height = h;
            }
        }
    });
    
    observer.observe(container);

    // Mouse Handlers
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            active: true
        };
    };

    const handleMouseLeave = () => {
        mouseRef.current.active = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
        observer.disconnect();
        themeObs.disconnect();
        cancelAnimationFrame(animationFrameId);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className={`w-full ${heightClass} relative bg-black border border-white/10 overflow-hidden mb-6`}>
      <canvas ref={canvasRef} className="absolute inset-0 z-10 block cursor-crosshair" />

      {/* Overlay Content */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center pointer-events-none">
         <div className="text-[9px] font-mono text-primary/60 mb-1 tracking-[0.2em] uppercase opacity-70">
            {kicker}
         </div>
         <div className="text-[10px] font-mono text-primary mb-2 tracking-[0.2em] uppercase opacity-80">
            {label}
         </div>
         <h3 className="text-xl md:text-3xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)] px-4">
            {title} <br/><span className="text-primary">{titleAccent}</span>
         </h3>
      </div>
      
      {/* Scanline Overlay */}
      <div className="absolute inset-0 z-30 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] opacity-30 pointer-events-none mix-blend-overlay"></div>
    </div>
  );
}