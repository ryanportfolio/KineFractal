// 404 — a terminal session that can't resolve the path. Same register as the
// mobile nav shell (guest@kinefractal:~$), beam palette, faint scanlines.
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function NotFound() {
  const [location] = useLocation();

  useEffect(() => {
    const prev = document.title;
    document.title = "404 · not found · Kine Fractal";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <main
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden px-6"
      aria-label="Page not found"
    >
      <div aria-hidden="true" className="scanlines pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-[640px] font-mono text-[14px] leading-relaxed">
        <div className="text-beam-dim/80 text-[11px] mb-4 select-none">
          <div>KINEFRACTAL OS — path resolver</div>
          <div className="text-beam-ghost">─────────────────────────────</div>
        </div>

        <div className="text-beam-dim">
          <span className="text-beam-mid">guest@kinefractal</span>
          <span>:~$ </span>
          <span className="text-beam-mid">cat {location}</span>
        </div>
        <div className="text-accent mt-1">
          cat: {location}: No such file or directory
        </div>

        <div className="mt-6 text-beam-dim">
          <span className="text-beam-mid">guest@kinefractal</span>
          <span>:~$ </span>
          <span className="text-beam-mid">status</span>
        </div>
        <div className="mt-1">
          <span className="text-beam-hot font-semibold">404</span>
          <span className="text-beam-dim"> · the page you asked for isn't on this machine</span>
        </div>

        <div className="mt-8 text-beam-dim">
          <span className="text-beam-mid">guest@kinefractal</span>
          <span>:~$ </span>
          <span className="text-beam-mid">ls ./go</span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <Link href="/" className="group flex items-baseline gap-3 uppercase tracking-[0.14em] text-beam-dim hover:text-beam-hot transition-colors">
            <span className="text-beam-ghost normal-case tracking-normal">01</span>
            <span className="text-beam-mid">&gt;</span>
            <span>home</span>
          </Link>
          <Link href="/lab" className="group flex items-baseline gap-3 uppercase tracking-[0.14em] text-beam-dim hover:text-beam-hot transition-colors">
            <span className="text-beam-ghost normal-case tracking-normal">02</span>
            <span className="text-beam-mid">&gt;</span>
            <span>board</span>
          </Link>
        </div>

        <div className="mt-8 text-[12px] text-beam-dim select-none">
          <span className="text-beam-mid">guest@kinefractal</span>
          <span>:~$ </span>
          <span className="beam-caret" />
        </div>
      </div>
    </main>
  );
}
