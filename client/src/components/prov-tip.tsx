// ProvTip — provenance on hover. Wrap any number the EOD board produced and
// the tooltip says exactly where it came from, debugger-style. Reinforces the
// honesty contract: every figure on the site is inspectable.
import type { ReactNode } from "react";

export function ProvTip({ src, children }: { src: string; children: ReactNode }) {
  return (
    <span className="relative group/prov cursor-help">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-40 hidden group-hover/prov:block whitespace-nowrap border border-primary/40 bg-black/95 px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-muted-foreground shadow-[0_0_14px_rgba(0,255,136,0.12)]"
      >
        <span className="text-primary">src:</span> {src}
      </span>
    </span>
  );
}
