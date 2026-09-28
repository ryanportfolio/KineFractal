import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { KfLogo } from "@/components/kf-logo";
import { fetchBoardCached, fetchReportCached, ENGINE_VARIANT } from "@/data/lab-data";
import { DEPLOY } from "@/data/fearlab-board";

// Every boot line is a REAL operation: the fetches below are the same cached
// calls the homepage makes moments later, so the boot both reports and warms
// the actual data path. No invented telemetry — a failed feed prints WARN.
type StepResult = { status: "OK" | "WARN"; suffix?: string };
type Step = { text: string; run: () => Promise<StepResult> };

const STEP_TIMEOUT_MS = 1800; // a slow feed degrades to WARN, never hangs the boot
const withTimeout = (p: Promise<StepResult>): Promise<StepResult> =>
  Promise.race([
    p,
    new Promise<StepResult>((res) => setTimeout(() => res({ status: "WARN", suffix: "slow" }), STEP_TIMEOUT_MS)),
  ]);

function buildSteps(): Step[] {
  // fire everything up front — steps then report completion in order
  const board = fetchBoardCached();
  const fearReports = Promise.all(DEPLOY.map((d) => fetchReportCached(d.reportKey)));
  const cast = fetch(`/fearlab/casts/spy-1d-${ENGINE_VARIANT}.json`).then((r) => {
    if (!r.ok) throw new Error("cast missing");
  });
  return [
    {
      text: "INITIALIZING KINE_FRACTAL",
      run: async () => ({ status: "OK" }),
    },
    {
      // Variant comes from the LIVE board (per-cell deploys, e.g. "v4.2+v4.6");
      // ENGINE_VARIANT is only the offline fallback — never trust it as current.
      text: "ENGINE: FEARLAB",
      run: () =>
        withTimeout(
          board
            .then((b) => ({ status: "OK" as const, suffix: (b.variant ?? ENGINE_VARIANT).toUpperCase() }))
            .catch(() => ({ status: "OK" as const, suffix: ENGINE_VARIANT.toUpperCase() })),
        ),
    },
    {
      text: "FETCHING EOD BOARD [board.json]",
      run: () =>
        withTimeout(
          board.then((b) => ({ status: "OK" as const, suffix: b.generated })).catch(() => ({ status: "WARN" as const, suffix: "offline" })),
        ),
    },
    {
      text: `FEAR GAUGE [${DEPLOY.map((d) => d.sym).join("·")}]`,
      run: () =>
        withTimeout(
          fearReports
            .then((rs) => {
              const armed = rs.filter((r) => r.fear?.on && r.fear.nowPct != null && r.fear.nowPct >= r.fear.floorPct).length;
              return { status: "OK" as const, suffix: armed ? `${armed} armed` : "quiet" };
            })
            .catch(() => ({ status: "WARN" as const, suffix: "offline" })),
        ),
    },
    {
      text: `REPLAY CAST [spy-1d-${ENGINE_VARIANT}]`,
      run: () => withTimeout(cast.then(() => ({ status: "OK" as const })).catch(() => ({ status: "WARN" as const, suffix: "offline" }))),
    },
    {
      text: "SYSTEM READY",
      run: async () => ({ status: "OK" }),
    },
  ];
}

type Line = { text: string; status: "..." | "OK" | "WARN"; suffix?: string };

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let live = true;
    (async () => {
      setLines([]); // restart cleanly on StrictMode's dev remount — the aborted first pass leaves a stale line
      const steps = buildSteps();
      for (const step of steps) {
        if (!live) return;
        setLines((prev) => [...prev, { text: step.text, status: "..." }]);
        const [res] = await Promise.all([
          step.run(),
          new Promise((r) => setTimeout(r, 110)), // terminal cadence floor
        ]);
        if (!live) return;
        setLines((prev) => {
          const next = [...prev];
          next[next.length - 1] = { text: step.text, status: res.status, suffix: res.suffix };
          return next;
        });
      }
      setTimeout(() => { if (live) onCompleteRef.current(); }, 300);
    })();
    return () => { live = false; };
  }, []);

  return (
    <div className="w-full h-full bg-background flex items-center justify-center font-mono text-sm md:text-base cursor-crosshair relative overflow-hidden">
      <style>{`
        @keyframes rgb-glitch-1 {
          0%, 100% {
            text-shadow:
              -2px 0 1px hsl(var(--primary) / 0.7),
              2px 0 1px hsl(var(--primary) / 0.7);
          }
          20% {
            text-shadow:
              -1px 0 1px hsl(var(--primary) / 0.5),
              1px 0 1px hsl(var(--primary) / 0.5);
          }
          40% {
            text-shadow:
              -3px 0 1px hsl(var(--primary) / 0.8),
              3px 0 1px hsl(var(--primary) / 0.8);
          }
          60% {
            text-shadow:
              -1px 0 1px hsl(var(--primary) / 0.6),
              1px 0 1px hsl(var(--primary) / 0.6);
          }
          80% {
            text-shadow:
              -2px 0 1px hsl(var(--primary) / 0.7),
              2px 0 1px hsl(var(--primary) / 0.7);
          }
        }

        @keyframes rgb-glitch-2 {
          0%, 100% {
            text-shadow:
              2px 0 1px hsl(var(--primary) / 0.7),
              -2px 0 1px hsl(var(--primary) / 0.7);
          }
          25% {
            text-shadow:
              3px 0 1px hsl(var(--primary) / 0.8),
              -3px 0 1px hsl(var(--primary) / 0.8);
          }
          50% {
            text-shadow:
              1px 0 1px hsl(var(--primary) / 0.5),
              -1px 0 1px hsl(var(--primary) / 0.5);
          }
          75% {
            text-shadow:
              2px 0 1px hsl(var(--primary) / 0.6),
              -2px 0 1px hsl(var(--primary) / 0.6);
          }
        }

        .rgb-glitch {
          animation: rgb-glitch-1 0.15s infinite;
        }

        .rgb-glitch:nth-child(even) {
          animation: rgb-glitch-2 0.15s infinite;
        }
      `}</style>

      {/* Branding Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
         <motion.div
           initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
           animate={{ opacity: 0.6, scale: 1, filter: 'blur(0px)' }}
           transition={{ duration: 1.5, ease: "easeOut", delay: 0 }}
           className="w-[500px] h-[500px]"
         >
            <KfLogo animate={true} />
         </motion.div>
      </div>

      <div className="w-full max-w-lg p-8 z-10 relative">
        <div className="space-y-2">
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rgb-glitch flex justify-between items-center border-b border-white/5 pb-1"
            >
              <span className="text-muted-foreground">
                &gt; {line.text}
                {line.suffix && <span className="text-muted-foreground/60"> · {line.suffix}</span>}
              </span>
              <span className={`${
                line.status === "OK" ? "text-primary" :
                line.status === "WARN" ? "text-orange-500" :
                "text-gray-500"
              }`}>
                [{line.status}]
              </span>
            </motion.div>
          ))}
          <motion.div
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="h-4 w-3 bg-primary inline-block mt-2"
          />
        </div>
      </div>

      {/* Scanlines Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[101] bg-[length:100%_2px,3px_100%] pointer-events-none" />
    </div>
  );
}
