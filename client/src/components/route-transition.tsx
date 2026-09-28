// RouteTransition — every in-app navigation prints itself as a terminal
// command. A brief veil with `$ open <target>` ties the pages into one
// coherent machine. Skipped on first load.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const MS = 620;

function pathCmd(path: string): string {
  if (path === "/") return "open home";
  if (path === "/lab") return "open lab/board";
  return `open ${path.replace(/^\//, "")}`;
}

export function RouteTransition() {
  const [loc] = useLocation();
  const [cmd, setCmd] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setCmd(pathCmd(loc));
    const t = setTimeout(() => setCmd(null), MS);
    return () => clearTimeout(t);
  }, [loc]);

  if (!cmd) return null;
  return (
    <div aria-hidden className="fixed inset-0 z-[280] pointer-events-none rtx-veil">
      <style>{RTX_CSS}</style>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[1.5px]" />
      <div className="absolute inset-0 scanlines opacity-10" />
      <div className="relative flex items-start justify-center pt-[30vh]">
        <span className="font-mono text-sm md:text-base text-primary tracking-wide">
          <span className="text-muted-foreground">kf@fearlab:~$</span> {cmd}
          <span className="rtx-cur">▍</span>
        </span>
      </div>
    </div>
  );
}

const RTX_CSS = `
.rtx-veil{animation:rtx-fade ${MS}ms ease-out forwards;}
@keyframes rtx-fade{0%{opacity:0}12%{opacity:1}70%{opacity:1}100%{opacity:0}}
.rtx-cur{display:inline-block;margin-left:2px;animation:rtx-blink .5s steps(1) infinite;}
@keyframes rtx-blink{50%{opacity:0;}}
`;
