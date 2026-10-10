// CommandLine — the working KF terminal. Quake-style drawer, opens with `/`
// (or the status-bar button via openKfTerminal()). Every command reads the
// same real data the pages read: board.json + /fearlab/<key>.json. Read-only
// by construction — it can navigate and print, nothing else.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  fetchBoardCached as getBoard, fetchReportCached as getReport, ord,
  fmtPct, fmtPp, engineName, trimName, TF_LABEL, SYM_NAME,
} from "@/data/lab-data";
import { DEPLOY } from "@/data/fearlab-board";

const OPEN_EVENT = "kf:terminal";
export function openKfTerminal() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

import { setPhosphor } from "@/lib/phosphor";
import { KINE_FRACTAL_BANNER } from "@/lib/ascii-banner";

const SYMS = ["SPY", "QQQ", "IWM"];
const TFS = ["1d", "2h", "4h"];
const COMMANDS = ["help", "board", "scan", "trades", "fear", "signals", "report", "replay", "sweep", "trace", "phosphor", "clear", "about", "exit"];
const PHOSPHORS = ["emerald", "amber", "ice"] as const;
type Phosphor = (typeof PHOSPHORS)[number];

const day = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

// signals.v1 regime states in plain words; the raw enum never reaches the screen
const STATE_TEXT: Record<string, string> = {
  long: "protection line intact",
  break_pending: "protection line broke · protective sell queued for the next open",
  protect_broken: "protection line broken · stepped aside",
  reclaim_pending: "protection line reclaimed · rebuy queued for the next open",
  protect_off: "no protection rule on this fund",
};
const CAUTION_STATES = new Set(["break_pending", "protect_broken"]);

// ---- output line primitives -------------------------------------------------
type Line = { id: number; node: ReactNode };
let lineId = 0;

const G = "text-primary";
const DIM = "text-muted-foreground";
const ERR = "text-[hsl(0_100%_62%)]";

function Kv({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="pl-1">
      <span className={`${DIM} inline-block w-28`}>{k}</span>
      {children}
    </div>
  );
}

function parseTarget(args: string[]): { sym: string; tf: string } | string {
  const sym = (args[0] || "").toUpperCase();
  const tf = (args[1] || "1d").toLowerCase();
  if (!SYMS.includes(sym)) return `unknown symbol '${args[0] ?? ""}' · try ${SYMS.join(" | ")}`;
  if (!TFS.includes(tf)) return `unknown timeframe '${args[1]}' · try ${TFS.join(" | ")}`;
  return { sym, tf };
}
// Resolve the full-window artifact key from the LIVE board (per-fund variants
// move without a repo change); snapshot DEPLOY key as the offline fallback.
async function keyOf(sym: string, tf: string): Promise<string> {
  try {
    const b = await getBoard();
    const hit = b.combos.find((c) => c.sym === sym && c.tf === tf && c.start === "full");
    if (hit) return hit.key;
  } catch { /* board offline — snapshot key below */ }
  const d = DEPLOY.find((x) => x.sym === sym && x.tf === tf);
  if (d) return d.reportKey;
  const v = DEPLOY.find((x) => x.sym === sym)?.variant ?? DEPLOY[0].variant;
  return `${sym.toLowerCase()}-${tf}-full-${v}`;
}

// ---- the component -----------------------------------------------------------
export function CommandLine() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const histRef = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);
  const [, navigate] = useLocation();

  const print = useCallback((node: ReactNode) => {
    setLines((prev) => [...prev, { id: ++lineId, node }]);
  }, []);

  // welcome banner, once per open lifetime of the page
  const boot = useCallback(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    print(
      <div className="mb-1">
        <pre
          aria-hidden="true"
          className={`${G} hidden sm:block text-[10px] leading-[1.15] tracking-normal mb-2 overflow-x-auto`}
        >
          {KINE_FRACTAL_BANNER}
        </pre>
        <div className={DIM}>read-only · latest EOD decisions and simulated backtest results, each labelled</div>
        <div className={DIM}>
          try <span className={G}>board</span> · <span className={G}>trades SPY</span> ·{" "}
          <span className={G}>fear SPY</span> · or <span className={G}>help</span> for everything
        </div>
      </div>,
    );
  }, [print]);

  // open/close wiring: `/` hotkey, Esc, custom event from status bar button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      boot();
      // remember the opener so focus lands back where the user was on close
      const opener = document.activeElement as HTMLElement | null;
      // focus after the slide-in starts so the browser doesn't scroll-jump
      requestAnimationFrame(() => inputRef.current?.focus());
      // lock the page behind the drawer — only the terminal output scrolls
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
        opener?.focus?.();
      };
    }
  }, [open, boot]);

  // keep output pinned to the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // ---- command implementations ----------------------------------------------
  const cmdHelp = () => {
    const rows: [string, string][] = [
      ["help", "this list"],
      ["board [SYM]", "simulated backtest results · full windows, or every window for one fund"],
      ["scan SYM [TF]", "simulated backtest metrics for a fund (default 1d) · e.g. scan SPY 1d"],
      ["trades SYM [TF]", "recent simulated backtest fills for a fund"],
      ["fear SYM [TF]", "the fear gauge at the report's last close"],
      ["signals", "latest EOD decision per fund · protection line and ETF quote"],
      ["report SYM [TF]", "open the full lab report page"],
      ["sweep", "run the 33-year storage sweep (alias: replay)"],
      ["trace", "jump to the verdict channels"],
      ["phosphor [color]", "recolor the tube · emerald | amber | ice"],
      ["clear", "wipe the screen"],
      ["exit", "close the terminal (or press Esc)"],
    ];
    print(
      <div>
        {rows.map(([c, d]) => (
          <div key={c}><span className={`${G} inline-block w-44`}>{c}</span><span className={DIM}>{d}</span></div>
        ))}
      </div>,
    );
  };

  const cmdBoard = async (args: string[]) => {
    const b = await getBoard();
    const symArg = (args[0] || "").toUpperCase();
    const rows = b.combos.filter((c) =>
      symArg ? c.sym === symArg : c.start === "full",
    );
    if (!rows.length) { print(<div className={ERR}>no board rows{symArg ? ` for ${symArg}` : ""}</div>); return; }
    print(
      <div>
        <div className={DIM}>backtest board · simulated returns, hypothetical next-open fills · generated {b.generated}</div>
        <div className={`${DIM} grid grid-cols-[110px_70px_1fr_1fr_1fr_64px] gap-2 border-b border-primary/20 pb-1 mt-1`}>
          <span>fund</span><span>window</span><span className="text-right">strategy</span>
          <span className="text-right">buy&amp;hold</span><span className="text-right">ahead</span><span className="text-right">trades</span>
        </div>
        {rows.map((c) => (
          <div key={c.key} className="grid grid-cols-[110px_70px_1fr_1fr_1fr_64px] gap-2 tabular-nums">
            <span>{c.sym} · {c.tf}</span>
            <span className={DIM}>{c.start}</span>
            <span className={`${G} text-right`}>{fmtPct(c.ret)}</span>
            <span className="text-right text-beam-dim">{fmtPct(c.bench_ret)}</span>
            <span className={`${G} text-right font-bold`}>{fmtPp(c.ret - c.bench_ret)}pp</span>
            <span className={`${DIM} text-right`}>{c.trades}</span>
          </div>
        ))}
      </div>,
    );
  };

  const cmdScan = async (args: string[]) => {
    const t = parseTarget(args);
    if (typeof t === "string") { print(<div className={ERR}>{t}</div>); return; }
    const r = await getReport(await keyOf(t.sym, t.tf));
    const h = r.headline;
    print(
      <div>
        <div className={DIM}>$ scan {t.sym} {t.tf} · {SYM_NAME[t.sym]} · {TF_LABEL[t.tf]} · simulated backtest {r.window.start} → {r.window.end} · hypothetical next-open fills</div>
        <div className={`${G} font-bold my-1`}>{h.trades} SIMULATED TRADES · {fmtPct(h.ret)} vs {fmtPct(h.bench_ret)} buy&amp;hold · {fmtPp(h.edge_pp)}pp ahead</div>
        <Kv k="irr">{fmtPct(h.irr, 2)} <span className={DIM}>vs {fmtPct(h.bench_irr, 2)} bench</span></Kv>
        <Kv k="max drawdown">{h.dd.toFixed(1)}% <span className={DIM}>vs {h.bench_dd.toFixed(1)}% bench</span></Kv>
        <Kv k="win rate">{h.win_rate}% <span className={DIM}>· profit factor {h.profit_factor ?? "n/a"}</span></Kv>
        <Kv k="exposure">{h.exposure_end.toFixed(1)}% <span className={DIM}>at window end · {h.exposure_avg.toFixed(1)}% average · open lots {h.open_lots}</span></Kv>
        <div className={`${DIM} mt-1`}>generated {r.generated} · src /fearlab/{r.key}.json</div>
      </div>,
    );
  };

  const cmdTrades = async (args: string[]) => {
    const t = parseTarget(args);
    if (typeof t === "string") { print(<div className={ERR}>{t}</div>); return; }
    const r = await getReport(await keyOf(t.sym, t.tf));
    const rows = r.recent.slice(-10).reverse();
    if (!rows.length) { print(<div className={ERR}>no recent simulated fills for {t.sym} {t.tf}</div>); return; }
    print(
      <div>
        <div className={DIM}>{t.sym} {TF_LABEL[t.tf]} · last {rows.length} simulated backtest fills · hypothetical next-open fills · newest first</div>
        {rows.map((f, i) => (
          <div key={i} className="tabular-nums">
            <span className={DIM}>{day(f.ts)}</span>{" "}
            <span className={f.side === "buy" ? G : "text-accent"}>{f.side === "buy" ? "▲ BUY " : "▼ SELL"}</span>{" "}
            <span>{f.side === "buy" ? engineName(f.label) : trimName(f.label)}</span>{" "}
            <span className={DIM}>
              · account move {f.account_pct == null ? "n/a" : `${f.account_pct.toFixed(2)}%`}
              {f.side === "buy"
                ? (f.price == null ? " · ETF price n/a" : ` · ETF price $${f.price.toFixed(2)}`)
                : (f.lot_return_pct == null ? " · lot return n/a" : ` · lot return ${fmtPct(f.lot_return_pct, 2)}`)}
            </span>
          </div>
        ))}
      </div>,
    );
  };

  const cmdFear = async (args: string[]) => {
    const t = parseTarget(args);
    if (typeof t === "string") { print(<div className={ERR}>{t}</div>); return; }
    const r = await getReport(await keyOf(t.sym, t.tf));
    const f = r.fear;
    if (!f.on || f.nowPct == null) { print(<div className={DIM}>fear engine not active on {t.sym} {t.tf}</div>); return; }
    const armed = f.nowPct >= f.floorPct;
    const w = 30;
    const filled = Math.round((f.nowPct / 100) * w);
    const floorAt = Math.round((f.floorPct / 100) * w);
    const bar = Array.from({ length: w }, (_, i) =>
      i === floorAt ? "|" : i < filled ? "█" : "·",
    ).join("");
    print(
      <div>
        <div className={DIM}>{t.sym} {TF_LABEL[t.tf]} · Williams VIX Fix percentile · {r.window.end} close</div>
        <div className="tabular-nums my-1">
          <span className={armed ? G : DIM}>[{bar}]</span>{" "}
          <span className={`${G} font-bold`}>{ord(f.nowPct)}</span>{" "}
          <span className={DIM}>· buy line {ord(f.floorPct)}</span>
        </div>
        <div className={armed ? `${G} font-bold` : DIM}>
          {armed
            ? "▲ above the buy line · first buy check passed; cooldown, protection and cash can still block a buy"
            : "quiet · below the buy line, engine waits"}
        </div>
      </div>,
    );
  };

  const cmdReport = async (args: string[]) => {
    const t = parseTarget(args);
    if (typeof t === "string") { print(<div className={ERR}>{t}</div>); return; }
    const key = await keyOf(t.sym, t.tf);
    print(<div><span className={DIM}>$ open</span> <span className={G}>/lab/{key}</span></div>);
    setOpen(false);
    navigate(`/lab/${key}`);
  };

  const cmdSignals = async () => {
    // signals.v1 straight from the worker — no static fallback exists, so an
    // offline feed prints as offline, never as stale numbers
    let s: { trading_date: string; cells: { symbol: string; tf: string; state: string; price: number }[] };
    try {
      const r = await fetch("/api/fearlab/signals/latest");
      if (!r.ok) throw new Error(String(r.status));
      const j: any = await r.json();
      s = j?.data ?? j;
      if (!Array.isArray(s.cells)) throw new Error("bad payload");
    } catch {
      print(<div className={DIM}>signal feed offline</div>);
      return;
    }
    print(
      <div>
        <div className={DIM}>latest EOD decision · {s.trading_date} close · decisions, not broker fills · src signals/latest</div>
        {s.cells.map((cell) => (
          <div key={`${cell.symbol}-${cell.tf}`} className="tabular-nums">
            <span className={`${G} inline-block w-12`}>{cell.symbol}</span>
            <span className={DIM}>{TF_LABEL[cell.tf] ?? cell.tf} · </span>
            <span className={CAUTION_STATES.has(cell.state) ? "text-accent" : G}>{STATE_TEXT[cell.state] ?? "state not recognized"}</span>
            <span className={DIM}> · ETF quote ${cell.price.toFixed(2)}</span>
          </div>
        ))}
      </div>,
    );
  };

  const cmdReplay = () => {
    // the sweep section is off the homepage for now — don't pretend to launch it
    print(
      <div className={DIM}>
        the storage sweep is off the bench right now · try <span className={G}>trace</span>
      </div>,
    );
  };

  const cmdTrace = () => {
    print(<div className={DIM}>tracing the verdict channels…</div>);
    setOpen(false);
    navigate("/");
    setTimeout(() => document.getElementById("verdict")?.scrollIntoView({ behavior: "smooth" }), 250);
  };

  const cmdPhosphor = (args: string[]) => {
    const cur = (document.documentElement.getAttribute("data-phosphor") as Phosphor | null) ?? "emerald";
    const want = (args[0] || "").toLowerCase() as Phosphor;
    if (!args[0]) {
      print(
        <div>
          <div className={DIM}>current phosphor: <span className={G}>{cur}</span></div>
          <div className={DIM}>usage: phosphor emerald | amber | ice</div>
        </div>,
      );
      return;
    }
    if (!PHOSPHORS.includes(want)) {
      print(<div className={ERR}>unknown phosphor '{args[0]}' · try {PHOSPHORS.join(" | ")}</div>);
      return;
    }
    setPhosphor(want);
    print(
      <div>
        <span className={DIM}>tube recolored ·</span> <span className={G}>{want} phosphor</span>{" "}
        <span className={DIM}>{want === "emerald" ? "(P1, the classic)" : want === "amber" ? "(P3, vintage)" : "(3270, ice)"}</span>
      </div>,
    );
  };

  const cmdAbout = async () => {
    // snapshot join of the per-fund deploys; the live board's variant wins
    let gen = "", variant = Array.from(new Set(DEPLOY.map((d) => d.variant))).sort().join("+");
    try {
      const b = await getBoard();
      gen = b.generated;
      variant = b.variant ?? variant;
    } catch { /* board offline */ }
    print(
      <div>
        <div><span className={G}>Kine Fractal</span> · FearLab {variant} engine · buys fear, trims the strength</div>
        <div className={DIM}>numbers come from labeled EOD signal and backtest artifacts{gen ? ` · board generated ${gen}` : ""}</div>
        <div className={DIM}>educational content only · not investment advice</div>
      </div>,
    );
  };

  const run = async (raw: string) => {
    const input = raw.trim();
    print(
      <div className="mt-1">
        <span className={G}>kf@fearlab</span><span className={DIM}>:~$</span> <span>{input}</span>
      </div>,
    );
    if (!input) return;
    histRef.current.push(input);
    histIdx.current = histRef.current.length;

    const [cmd, ...args] = input.split(/\s+/);
    const c = cmd.toLowerCase();
    setBusy(true);
    try {
      if (c === "help" || c === "?") cmdHelp();
      else if (c === "board" || c === "ls") await cmdBoard(args);
      else if (c === "scan") await cmdScan(args);
      else if (c === "trades") await cmdTrades(args);
      else if (c === "fear") await cmdFear(args);
      else if (c === "report" || c === "open") await cmdReport(args);
      else if (c === "signals" || c === "posture") await cmdSignals();
      else if (c === "replay" || c === "sweep") cmdReplay();
      else if (c === "trace") cmdTrace();
      else if (c === "phosphor" || c === "theme") cmdPhosphor(args);
      else if (c === "clear" || c === "cls") setLines([]);
      else if (c === "about" || c === "version") await cmdAbout();
      else if (c === "exit" || c === "quit" || c === "q") setOpen(false);
      else if (c === "whoami") print(<div className={DIM}>guest · read-only workbench</div>);
      else if (c === "sudo") print(<div className={DIM}>nice try. this bench is read-only.</div>);
      else if (c === "matrix") print(<div className={DIM}>wrong movie. try <span className={G}>replay</span>.</div>);
      else print(<div className={ERR}>command not found: {cmd} · try help</div>);
    } catch {
      print(<div className={ERR}>data feed offline · {c} needs the EOD board assets</div>);
    } finally {
      setBusy(false);
      // async work must not strand keyboard users — pull focus back to the prompt
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !busy) {
      const v = value;
      setValue("");
      void run(v);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = histRef.current;
      if (!h.length) return;
      histIdx.current = Math.max(0, histIdx.current - 1);
      setValue(h[histIdx.current] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = histRef.current;
      histIdx.current = Math.min(h.length, histIdx.current + 1);
      setValue(h[histIdx.current] ?? "");
    } else if (e.key === "Tab") {
      e.preventDefault();
      const parts = value.split(/\s+/);
      const last = parts[parts.length - 1].toLowerCase();
      if (!last) return;
      const pool = parts.length === 1
        ? COMMANDS
        : parts[0].toLowerCase() === "phosphor" || parts[0].toLowerCase() === "theme"
          ? [...PHOSPHORS]
          : [...SYMS.map((s) => s.toLowerCase()), ...TFS];
      const hit = pool.find((p) => p.startsWith(last));
      if (hit) {
        parts[parts.length - 1] = parts.length === 1 ? hit : (SYMS.map((s) => s.toLowerCase()).includes(hit) ? hit.toUpperCase() : hit);
        setValue(parts.join(" ") + " ");
      }
    }
  };

  return (
    <>
      {/* click-below-to-close backdrop; also dims the page while the drawer is up */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[299] bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
      role="dialog"
      aria-modal="true"
      aria-label="Kine Fractal terminal"
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-x-0 top-0 z-[300] transition-transform duration-300 ease-out ${
        open ? "translate-y-0" : "-translate-y-full pointer-events-none"
      }`}
    >
      <div className="relative bg-black/[0.97] border-b-2 border-primary shadow-[0_0_40px_hsl(var(--primary)/0.25)]">
        <div className="absolute inset-0 scanlines opacity-[0.07] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-8 py-4 font-mono text-[13px] leading-relaxed">
          <div className="flex items-center justify-between border-b border-primary/20 pb-2 mb-2">
            <span className={`${DIM} text-[10px] tracking-[0.25em] uppercase`}>
              <span className={G}>●</span> kf terminal · EOD decisions · simulated backtests
            </span>
            <button
              onClick={() => setOpen(false)}
              className={`${DIM} text-[10px] tracking-[0.2em] uppercase hover:text-primary`}
            >
              esc to close ✕
            </button>
          </div>
          <div ref={scrollRef} className="max-h-[46vh] min-h-[120px] overflow-y-auto pr-1 overscroll-contain">
            {lines.map((l) => <div key={l.id}>{l.node}</div>)}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-primary/10 mt-2">
            <span className="shrink-0"><span className={G}>kf@fearlab</span><span className={DIM}>:~$</span></span>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onInputKey}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="flex-1 bg-transparent outline-none border-none text-foreground caret-[hsl(var(--primary))] placeholder:text-muted-foreground"
              placeholder={busy ? "…" : "type help"}
              aria-label="terminal command input"
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
