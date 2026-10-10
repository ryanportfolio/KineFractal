// Navbar — one 52px bar of quiet chrome, imported by every page.
//
// The logo is KineFractalLogo: the ring-and-waves mark beside the traced
// wordmark, drawn by its intro on the first page load (the only glowing
// element in the bar);
// links speak in the etched-label register; a 2px beam cursor
// slides to rest under the active route; the far right carries the terminal
// button — a labeled key, not a bare "/", so people who never touch
// terminals still know there's a drawer that answers questions. No second
// tier, no status strips, no live numbers: the old HUD's soul lives in the
// terminal drawer.
import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { KineFractalLogo } from "@/components/kine-fractal-logo";
import { openKfTerminal } from "@/components/command-line";

// `external` = full-page app served by the server (not a SPA route) -> plain <a>
const LINKS: { href: string; label: string; match: (loc: string) => boolean; external?: boolean }[] = [
  { href: "/lab", label: "board", match: (l) => l.startsWith("/lab") },
  { href: "/ratio-relevance", label: "sectors", match: (l) => l === "/ratio-relevance" },
  { href: "/charts/", label: "charts", match: () => false, external: true },
  { href: "/about", label: "about", match: (l) => l === "/about" },
  { href: "/alerts", label: "alerts", match: (l) => l === "/alerts" },
  { href: "/account", label: "account", match: (l) => l === "/account" },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<{ left: number; width: number } | null>(null);

  // the beam rests under the active route
  useEffect(() => {
    const measure = () => {
      const list = listRef.current;
      if (!list) return;
      const active = list.querySelector<HTMLElement>("[data-active='true']");
      if (!active) {
        setCursor(null);
        return;
      }
      const lr = list.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      // rects come back in zoomed px under the desktop CSS zoom; the style
      // below is layout px (re-zoomed on paint) — divide once or it doubles
      const z = parseFloat(getComputedStyle(document.documentElement).zoom as unknown as string) || 1;
      setCursor({ left: (ar.left - lr.left) / z, width: ar.width / z });
    };
    measure();
    // re-measure once fonts settle and on resize
    document.fonts?.ready?.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [location]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // lock page scroll while the mobile overlay is open so the page underneath
  // doesn't scroll behind it. The scroll container is <html> (documentElement),
  // not <body>, so overflow:hidden must go on the root element; lock body too
  // for engines that scroll it. Restore prior values on close/unmount.
  useEffect(() => {
    if (!mobileOpen) return;
    const root = document.documentElement;
    const prevRoot = root.style.overflow;
    const prevBody = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      root.style.overflow = prevRoot;
      document.body.style.overflow = prevBody;
    };
  }, [mobileOpen]);

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-beam-ghost/70 backdrop-blur-[8px]"
      style={{ background: "hsl(var(--background) / 0.85)" }}>
      <div className="relative flex items-center justify-between h-[52px] px-4 md:px-8 max-w-[1400px] mx-auto">
        <Link href="/" className="flex items-center shrink-0" aria-label="Kine Fractal · home">
          <div className="w-[168px] md:w-[200px]">
            <KineFractalLogo />
          </div>
        </Link>

        {/* desktop links */}
        <div ref={listRef} className="relative hidden md:flex items-center gap-7 h-full">
          {LINKS.map((l) => {
            const active = l.match(location);
            const cls = `etched h-full flex items-center transition-colors ${
              active ? "text-beam-mid" : "text-beam-dim hover:text-beam-mid"
            }`;
            return l.external ? (
              <a key={l.href} href={l.href} data-active={active} className={cls}>
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} data-active={active} className={cls}>
                {l.label}
              </Link>
            );
          })}
          {/* the sliding beam cursor */}
          <span
            aria-hidden="true"
            className="beam-cursor absolute bottom-0 h-[2px]"
            style={{
              left: cursor?.left ?? 0,
              width: cursor?.width ?? 0,
              opacity: cursor ? 1 : 0,
            }}
          />
        </div>

        <div className="flex items-center gap-4">
          {/* the terminal, named — ask it for the record, trades, fear, posture */}
          <button
            type="button"
            onClick={openKfTerminal}
            className="etched hidden md:inline-flex items-center gap-2 border border-beam-ghost px-2.5 py-1 text-beam-dim hover:text-beam-mid hover:border-beam-dim transition-colors"
            aria-label="Open the terminal"
            title="ask the engine directly: board, trades, fear, posture, replay · or press / anywhere"
          >
            <span className="text-beam-mid border border-beam-ghost px-[5px] leading-tight">/</span>
            terminal
          </button>
          {/* mobile toggle */}
          <button
            type="button"
            className="md:hidden text-beam-dim hover:text-beam-mid p-2 -mr-2"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* mobile overlay — a terminal session, not a menu.
          NOTE: `absolute top-full` + explicit height, NOT `fixed bottom-0` —
          the nav's backdrop-filter makes it the containing block for fixed
          descendants, so a fixed overlay collapses to the 53px nav box. */}
      {mobileOpen && (
        <div
          className="md:hidden absolute inset-x-0 top-full z-[80] border-t border-beam-ghost/70 overflow-y-auto"
          style={{
            background: "hsl(var(--background) / 0.97)",
            height: "calc(100dvh - 52px)",
          }}
        >
          {/* faint CRT scanlines over the whole session */}
          <div aria-hidden="true" className="scanlines pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative flex flex-col px-5 py-6 font-mono text-[14px]">
            {/* session header */}
            <div className="text-beam-dim/80 text-[11px] leading-relaxed mb-4 select-none">
              <div>KINEFRACTAL OS — nav shell</div>
              <div className="text-beam-ghost">─────────────────────────────</div>
              <div>
                <span className="text-beam-mid">guest@kinefractal</span>
                <span>:~$ </span>
                <span className="text-beam-mid">ls ./nav</span>
              </div>
            </div>
            {LINKS.map((l, i) => {
              const active = l.match(location);
              const cls = `group flex items-baseline gap-3 py-3 uppercase tracking-[0.14em] ${
                active ? "text-beam-hot" : "text-beam-dim"
              }`;
              const inner = (
                <>
                  <span className="text-beam-ghost normal-case tracking-normal">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={active ? "text-beam-hot" : "text-beam-mid"}>&gt;</span>
                  <span>{l.label}</span>
                  {active && (
                    <span className="ml-auto text-[10px] text-beam-dim normal-case tracking-normal">
                      [active]
                    </span>
                  )}
                </>
              );
              return l.external ? (
                <a key={l.href} href={l.href} className={cls} onClick={() => setMobileOpen(false)}>
                  {inner}
                </a>
              ) : (
                <Link key={l.href} href={l.href} className={cls} onClick={() => setMobileOpen(false)}>
                  {inner}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openKfTerminal();
              }}
              className="group flex items-baseline gap-3 py-3 uppercase tracking-[0.14em] text-beam-dim text-left"
            >
              <span className="text-beam-ghost normal-case tracking-normal">
                {String(LINKS.length + 1).padStart(2, "0")}
              </span>
              <span className="text-beam-mid">&gt;</span>
              <span>terminal</span>
              <span className="ml-auto text-[10px] text-beam-dim normal-case tracking-normal">[/]</span>
            </button>
            {/* live prompt with blinking block cursor */}
            <div className="mt-6 text-[12px] text-beam-dim select-none">
              <span className="text-beam-mid">guest@kinefractal</span>
              <span>:~$ </span>
              <span className="beam-caret" />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
