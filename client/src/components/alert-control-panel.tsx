import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, ListChecks } from "lucide-react";

import {
  ALERT_KINDS,
  parseAlertSettings,
  type GapDailySettings,
  type LevelsWeeklySettings,
} from "@shared/alert-settings";
import { GAP_PLACEMENTS, normalizeGapPlacement, type GapPlacement } from "@shared/gap-placement";
import { csrfFetch } from "@/lib/auth-client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createDefaultAlertPrefs,
  normalizeAlertPrefsResponse,
  setAlertEnabled,
  type AlertPrefsState,
} from "@/lib/alert-control-model";

// Each page load numbers its watchlist saves 1, 2, 3... under a random tab id,
// so the server can drop a save from this tab that arrives after a later one
// (the exit flush can overtake a save still in flight). No clocks involved.
const watchTab =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
let watchSeq = 0;

function putWatchlist(symbols: string[]): Promise<Response> {
  watchSeq += 1;
  // keepalive lets a save already in flight finish if the tab closes or reloads
  return csrfFetch("/api/watchlist", {
    method: "PUT",
    body: JSON.stringify({ symbols, tab: watchTab, seq: watchSeq }),
    keepalive: true,
  });
}

// Where the last settings change was made; the save status shows there, so a
// phone user sees "saved" or an error next to the control they just touched.
type StatusZone = "channels" | "daily" | "strength" | "limits" | "confluence" | "repeat";

type Props = {
  canEnable: boolean;
  gateHint?: string | null;
};

const CONTROL_HELP = {
  gapEvents: "Emails once each time an open gap reaches your minimum stage or a later one",
  orderBlockEvents: "Emails the first time the latest close lands inside an order block, a zone where a strong move started; going back into the same zone stays quiet until a new zone forms",
  equilibriumEvents: "Emails when price falls from the upper half of its recent range to the middle of the range or below; the middle is halfway between the high and low of the last 300 bars on the 2-hour chart; it can email again only after price climbs back above the middle",
  supportGaps: "Includes open gaps below the price, left by a gap up; they can act as support, a buy area on the chart, not a FearLab decision",
  resistanceGaps: "Includes open gaps above the price, left by a gap down; they can act as resistance, a sell area on the chart, not a FearLab decision",
  gapStage: "Approaching: price is within 1% of the gap's near edge; inside the gap: price has moved into it; about to fill: price is within 1% of the far edge; filled: price crossed the far edge or came within 0.1% of it",
  minStrength: "How many of the three timeframes (2-hour, 4-hour and daily) show the same support level; a higher number sends fewer, stronger levels",
  recency: "Only support levels that price traded down to within this many days can make the weekly digest",
  maxBelow: "Leaves out levels more than this percent below the latest close; zero removes the limit",
  resultCap: "Keeps only the strongest levels across your whole watchlist, up to this many; zero keeps every level that qualifies",
  gapPlacement: "Where the suggested buy limit sits inside an open gap below the price: the top is the first price a drop reaches, the middle is halfway in, and a full fill is the bottom of the gap, where it closes completely; the weekly email prices gap + order block and Triple levels this way, and so does the Limit Buy dialog on the charts page",
  confluence: "Adds gap + order block levels: an open gap below the price whose middle sits close to the middle of a fresh order block, the zone where a strong move up started; fresh means price has not come back into that zone since it formed; the price shown is the gap at your gap limit price",
  confluenceDistance: "How far apart, in percent, the middles of an open gap and a fresh order block (price has not come back into it since it formed) can be and still count as a gap + order block level",
  tripleDistance: "How far apart, in percent, an open gap, a fresh order block (price has not come back into it since it formed) and a support level can be and still count as a Triple level; the email prices it at the gap, using your gap limit price",
  dedupDays: "Skips a ticker and level already emailed to you within this many days, then lets it back in once that time passes; zero sends every standing level in every digest",
  dedupTolerance: "Two levels within this percent of each other count as the same level; a level that moves farther than this counts as new and sends again",
} as const;

const GAP_PLACEMENT_LABEL: Record<GapPlacement, string> = { top: "Top", middle: "Middle", fill: "Full fill" };

function InfoTip({ label, text, large = false }: { label: string; text: string; large?: boolean }) {
  // Hover and keyboard focus open the tip while they last (Radix's own state).
  // A click or tap pins it open until another click or tap on it, Esc, a press
  // elsewhere, or focus leaving it. Radix alone closes a tooltip on pointer
  // down, so it never opened on a touch screen. Radix also closes on any page
  // scroll; that only ends the hover state, so a pinned tip survives a scroll.
  const [transient, setTransient] = useState(false);
  const [pinned, setPinned] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Tooltip delayDuration={0} open={transient || pinned} onOpenChange={setTransient}>
      <TooltipTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Explain ${label}`}
          aria-expanded={transient || pinned}
          onClick={(event) => {
            // skip Radix's close-on-click; toggle the pinned state instead
            event.preventDefault();
            setPinned((current) => !current);
          }}
          onBlur={() => setPinned(false)}
          className={`group/tip inline-flex shrink-0 items-center justify-center focus-visible:outline-none ${large ? "h-[44px] w-[44px] min-[600px]:h-[30px] min-[600px]:w-[30px]" : "h-[44px] w-[44px] min-[600px]:h-[26px] min-[600px]:w-[26px]"}`}
        >
          <span
            aria-hidden="true"
            className={`inline-flex items-center justify-center border border-[hsl(var(--beam-ghost))] font-mono text-beam-dim transition-colors group-hover/tip:border-beam-hot group-hover/tip:text-beam-hot group-focus-visible/tip:border-beam-hot group-focus-visible/tip:text-beam-hot group-aria-expanded/tip:border-beam-hot group-aria-expanded/tip:text-beam-hot ${large ? "h-5 w-5 text-xs" : "h-4 w-4 text-[9px]"}`}
          >
            ?
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        data-phosphor="ice"
        side="top"
        sideOffset={10}
        collisionPadding={12}
        onEscapeKeyDown={() => setPinned(false)}
        onPointerDownOutside={(event) => {
          // a press on the trigger itself is handled by its click
          if (!triggerRef.current?.contains(event.target as Node)) setPinned(false);
        }}
        className={`max-w-[min(20rem,calc((100vw_-_24px)_/_var(--pz)))] rounded-none border border-[hsl(var(--beam-dim))] bg-background px-3 py-2 font-mono leading-relaxed text-beam-mid shadow-[0_0_18px_hsl(var(--beam-ghost)/0.55)] ${large ? "text-sm" : "text-[11px]"}`}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  large = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center gap-[12px] text-left min-[600px]:gap-3 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 border transition-colors duration-200 ${
          checked
            ? "border-beam-hot bg-[hsl(var(--beam-ghost))]"
            : "border-[hsl(var(--beam-ghost))] bg-transparent"
        }`}
      >
        {/* knob: hollow outline at the left end when off, filled at the right end when on */}
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 border-[1.5px] transition-[left,background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-expo)] ${
            checked
              ? "left-[calc(100%-1rem-4px)] border-beam-hot bg-[hsl(var(--beam-hot))] shadow-[0_0_10px_hsl(var(--beam-hot)/0.65)]"
              : "left-[4px] border-beam-dim bg-transparent"
          }`}
        />
      </span>
      <span
        aria-hidden="true"
        className={`w-[3ch] shrink-0 font-mono text-xs font-semibold tracking-[0.08em] ${checked ? "text-beam-hot" : "text-beam-dim"}`}
      >
        {checked ? "ON" : "OFF"}
      </span>
      <span className={`min-w-0 font-mono text-left text-beam-mid group-hover:text-beam-hot ${large ? "text-lg" : "text-sm"}`}>{label}</span>
    </button>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  tooltip,
  onChange,
  onPending,
  large = false,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint: string;
  tooltip?: string;
  onChange: (value: number) => void;
  // true while the box holds text that is not the saved value yet (waiting to
  // go out, or invalid until blur puts the saved value back)
  onPending?: (pending: boolean) => void;
  large?: boolean;
}) {
  // The field edits a draft string so it can sit empty or half-typed; only a
  // number within [min, max] reaches the settings (and so the autosave). A
  // whole-number step means a whole-number setting, so decimals stay a draft.
  // A valid draft goes out after a short pause (or on blur), so typing "2.5"
  // never sends the "2" on its way to an invalid value.
  const [draft, setDraft] = useState(String(value));
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPush = () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = null;
  };
  const pendingRef = useRef(onPending);
  pendingRef.current = onPending;
  useEffect(() => () => {
    cancelPush();
    pendingRef.current?.(false);
  }, []);
  const parse = (raw: string) => {
    const next = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(next) || next < min || next > max) return null;
    if (Number.isInteger(step) && !Number.isInteger(next)) return null;
    return next;
  };
  useEffect(() => {
    // follow outside changes, but keep a draft that already means this value ("4.50")
    setDraft((current) => (parse(current) === value ? current : String(value)));
  }, [value]);
  return (
    <div className="block min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={id} className={`etched text-beam-dim ${large ? "text-lg" : ""}`}>{label}</label>
        <InfoTip label={label} text={tooltip ?? hint} large={large} />
      </div>
      <span className={`flex items-stretch border border-[hsl(var(--beam-ghost))] focus-within:border-beam-hot ${large ? "max-w-56" : "max-w-48"}`}>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            cancelPush();
            const next = parse(event.target.value);
            onPending?.(next !== value);
            if (next !== null && next !== value) pushTimer.current = setTimeout(() => {
              pushTimer.current = null;
              onChange(next);
              onPending?.(false);
            }, 400);
          }}
          onBlur={() => {
            cancelPush();
            const next = parse(draft);
            if (next === null) setDraft(String(value));
            else if (next !== value) onChange(next);
            onPending?.(false);
          }}
          className={`min-w-0 flex-1 bg-transparent px-3 py-2 font-mono tabular-nums text-beam-hot outline-none ${large ? "text-xl" : "text-sm"}`}
        />
        <span className={`flex items-center border-l border-[hsl(var(--beam-ghost))] px-3 py-2 font-mono uppercase tracking-[0.12em] text-beam-dim ${large ? "text-base" : "text-[10px]"}`}>
          {unit}
        </span>
      </span>
      <span className={`mt-2 block max-w-[34ch] font-mono leading-relaxed text-beam-dim ${large ? "text-sm" : "text-[11px]"}`}>
        {hint}
      </span>
    </div>
  );
}

export function AlertControlPanel({ canEnable, gateHint = null }: Props) {
  const [universe, setUniverse] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [savedSymbols, setSavedSymbols] = useState<string[]>([]);
  const savedSymbolsRef = useRef<string[]>([]);
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchStatus, setWatchStatus] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const failedWatchKey = useRef<string | null>(null);
  // key of the list last loaded from or sent to the server; null until loaded
  const sentWatchKey = useRef<string | null>(null);
  const latestSymbols = useRef<string[]>([]);
  const watchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // bumps on every watchlist edit, so a slow reload can tell it is outdated
  const watchEdits = useRef(0);
  const [prefs, setPrefs] = useState<AlertPrefsState>(createDefaultAlertPrefs);
  const [savedPrefs, setSavedPrefs] = useState<AlertPrefsState>(createDefaultAlertPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const failedSnapshot = useRef<string | null>(null);
  const [statusZone, setStatusZone] = useState<StatusZone>("channels");
  // Gap limit placement lives with the chart preferences (/api/chart-prefs),
  // not in alert_prefs: the Limit Buy dialog uses it whether or not alerts are
  // on. It saves on click; only the latest click's answer is shown.
  const [gapPlacement, setGapPlacement] = useState<GapPlacement>("top");
  const [gapPlacementState, setGapPlacementState] = useState<"loading" | "idle" | "saving" | "saved">("loading");
  const [gapPlacementError, setGapPlacementError] = useState<string | null>(null);
  const savedGapPlacement = useRef<GapPlacement>("top");
  const gapPlacementSeq = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chart-prefs", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((body) => {
        if (!body.account || !body.stored) throw new Error("unavailable");
        const value = normalizeGapPlacement(body.gapPlacement);
        savedGapPlacement.current = value;
        setGapPlacement(value);
        setGapPlacementState("idle");
      })
      .catch((reason) => {
        if (reason?.name === "AbortError") return;
        setGapPlacementState("idle");
        setGapPlacementError("gap limit price is unavailable right now · try again later");
      });
    return () => controller.abort();
  }, []);
  const chooseGapPlacement = async (value: GapPlacement) => {
    const seq = ++gapPlacementSeq.current;
    setGapPlacement(value);
    setGapPlacementError(null);
    setGapPlacementState("saving");
    try {
      const response = await csrfFetch("/api/chart-prefs", { method: "PUT", body: JSON.stringify({ gapPlacement: value }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      savedGapPlacement.current = value;
      if (seq === gapPlacementSeq.current) setGapPlacementState("saved");
    } catch (reason: any) {
      if (seq !== gapPlacementSeq.current) return;
      setGapPlacement(savedGapPlacement.current);
      setGapPlacementState("idle");
      setGapPlacementError(`${reason?.message || "failed to save"} · gap limit price restored to the last saved choice`);
    }
  };
  // number boxes whose typed value has not reached the settings yet
  const [pendingDrafts, setPendingDrafts] = useState<ReadonlySet<string>>(() => new Set());
  const trackDraft = (id: string, zone: StatusZone) => (pending: boolean) => {
    setPendingDrafts((current) => {
      if (current.has(id) === pending) return current;
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
    if (pending) {
      setStatusZone(zone);
      setStatus(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/watchlist", { credentials: "include", signal: controller.signal }),
      fetch("/api/alerts/prefs", { credentials: "include", signal: controller.signal }),
    ])
      .then(async ([watchlistResponse, prefsResponse]) => {
        if (!watchlistResponse.ok || !prefsResponse.ok) {
          throw new Error("alert settings are unavailable right now");
        }
        const [watchlist, alertPrefs] = await Promise.all([
          watchlistResponse.json(),
          prefsResponse.json(),
        ]);
        const normalized = normalizeAlertPrefsResponse(alertPrefs.prefs);
        setUniverse(watchlist.universe ?? []);
        const savedList: string[] = [...(watchlist.symbols ?? [])].sort();
        setSymbols(savedList);
        setSavedSymbols(savedList);
        sentWatchKey.current = savedList.join(",");
        void csrfFetch.prime().catch(() => {});
        setPrefs(normalized);
        setSavedPrefs(normalized);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason?.message || "failed to load alert settings");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const selected = useMemo(() => new Set(symbols), [symbols]);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs);
  const watchKey = symbols.join(",");
  const watchDirty = watchKey !== savedSymbols.join(",");
  // saved symbols can include tickers since dropped from the published set,
  // so compare membership rather than counts
  const allSelected = universe.every((symbol) => selected.has(symbol));

  // Chip clicks and select all / clear only edit local state; one PUT saves the
  // settled list. Saving per click tripped the server rate limit mid-selection.
  const editSymbols = (next: string[]) => {
    watchEdits.current += 1;
    setSymbols([...new Set(next)].sort());
    setWatchError(null);
    setWatchStatus(null);
    failedWatchKey.current = null;
  };

  const toggleSymbol = (symbol: string) => {
    editSymbols(selected.has(symbol) ? symbols.filter((item) => item !== symbol) : [...symbols, symbol]);
  };

  const persistWatchlist = useCallback(async (next: string[], key: string) => {
    // the exit flush may already have sent this list
    if (key === sentWatchKey.current) return;
    sentWatchKey.current = key;
    setWatchSaving(true);
    setWatchError(null);
    try {
      const response = await putWatchlist(next);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? `${body.error || "too many watchlist changes"} · selection restored to the last saved list`
            : `${body.error || `HTTP ${response.status}`} · selection restored to the last saved list`,
        );
      }
      const saved: string[] = Array.isArray(body.symbols) ? body.symbols : next;
      setSavedSymbols(saved);
      // the server now holds `saved`, unless a later list was sent meanwhile
      if (sentWatchKey.current === key) sentWatchKey.current = saved.join(",");
      // later clicks may have landed while this request was in flight; keep
      // them. A stale reply (this tab's later save got there first) carries
      // the stored list and is not an error.
      setSymbols((current) => (current.join(",") === key ? saved : current));
      setWatchStatus("watchlist saved");
    } catch (reason: any) {
      failedWatchKey.current = key;
      // this list never reached the server, so it no longer counts as sent
      // (a newer request's key stays); otherwise re-selecting it never saves
      if (sentWatchKey.current === key) sentWatchKey.current = savedSymbolsRef.current.join(",");
      // show what the server actually holds instead of an unsaved selection
      setSymbols((current) => (current.join(",") === key ? savedSymbolsRef.current : current));
      setWatchStatus(null);
      setWatchError(reason?.message || "failed to save watchlist");
    } finally {
      setWatchSaving(false);
    }
  }, []);

  useEffect(() => {
    savedSymbolsRef.current = savedSymbols;
  }, [savedSymbols]);

  useEffect(() => {
    if (loading || watchSaving || !watchDirty) return;
    if (failedWatchKey.current === watchKey) return;
    watchTimer.current = setTimeout(() => {
      watchTimer.current = null;
      void persistWatchlist(symbols, watchKey);
    }, 600);
    return () => {
      if (watchTimer.current) clearTimeout(watchTimer.current);
      watchTimer.current = null;
    };
  }, [loading, persistWatchlist, symbols, watchDirty, watchKey, watchSaving]);

  // On unmount or tab close, send any list that never went out, once, and
  // cancel the pending debounce so a page restored from the back/forward cache
  // does not send it again. It may overtake this tab's save still in flight;
  // its higher seq makes the server keep it either way.
  latestSymbols.current = symbols;
  useEffect(() => {
    const flush = () => {
      if (watchTimer.current) clearTimeout(watchTimer.current);
      watchTimer.current = null;
      const sent = sentWatchKey.current;
      const next = latestSymbols.current;
      const key = next.join(",");
      if (sent === null || key === sent || key === failedWatchKey.current) return;
      sentWatchKey.current = key;
      void putWatchlist(next).catch(() => {});
    };
    // A page restored from the back/forward cache shows what is stored now,
    // which another tab may have changed while this one was hidden.
    const reconcile = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const editsAtStart = watchEdits.current;
      fetch("/api/watchlist", { credentials: "include" })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
        .then((watchlist) => {
          const savedList: string[] = [...(watchlist.symbols ?? [])].sort();
          // chips clicked while this reload was in flight win, and their save
          // may already have landed: leave both lists to that save
          if (watchEdits.current !== editsAtStart) return;
          failedWatchKey.current = null;
          sentWatchKey.current = savedList.join(",");
          setSavedSymbols(savedList);
          setSymbols(savedList);
          setWatchError(null);
          setWatchStatus(null);
        })
        .catch(() => setWatchError("could not reload the saved watchlist · refresh the page"));
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("pageshow", reconcile);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("pageshow", reconcile);
      flush();
    };
  }, []);

  const updateWeekly = (zone: StatusZone, patch: Partial<LevelsWeeklySettings>) => {
    setPrefs((current) => ({
      ...current,
      levels_weekly: {
        ...current.levels_weekly,
        settings: { ...current.levels_weekly.settings, ...patch },
      },
    }));
    setStatusZone(zone);
    setStatus(null);
    setError(null);
  };

  const updateDaily = (patch: Partial<GapDailySettings>) => {
    setPrefs((current) => ({
      ...current,
      gap_daily: {
        ...current.gap_daily,
        settings: { ...current.gap_daily.settings, ...patch },
      },
    }));
    setStatusZone("daily");
    setStatus(null);
    setError(null);
  };

  const toggleKind = (kind: (typeof ALERT_KINDS)[number], enabled: boolean) => {
    setStatusZone("channels");
    if (enabled && !canEnable) {
      setError(gateHint ? `${gateHint} · use the Account link above` : "Finish account setup on the Account page before turning on alerts");
      return;
    }
    setPrefs((current) => setAlertEnabled(current, kind, enabled, canEnable));
    setStatus(null);
    setError(null);
  };

  const persist = useCallback(async (snapshot: AlertPrefsState, snapshotKey: string) => {
    setSaving(true);
    setError(null);
    setStatus("saving settings…");
    try {
      const normalized: AlertPrefsState = {
        levels_weekly: {
          enabled: snapshot.levels_weekly.enabled,
          settings: parseAlertSettings("levels_weekly", snapshot.levels_weekly.settings),
        },
        gap_daily: {
          enabled: snapshot.gap_daily.enabled,
          settings: parseAlertSettings("gap_daily", snapshot.gap_daily.settings),
        },
      };
      const responses = await Promise.all(
        ALERT_KINDS.map((kind) =>
          csrfFetch("/api/alerts/prefs", {
            method: "PUT",
            body: JSON.stringify({
              kind,
              enabled: normalized[kind].enabled,
              settings: normalized[kind].settings,
            }),
          }),
        ),
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error((await failed.json()).error || `HTTP ${failed.status}`);
      setSavedPrefs(snapshot);
      failedSnapshot.current = null;
      setStatus("saved");
    } catch (reason: any) {
      failedSnapshot.current = snapshotKey;
      setStatus(null);
      setError(reason?.message || "failed to save alert settings");
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (loading || saving || !dirty) return;
    const snapshotKey = JSON.stringify(prefs);
    if (failedSnapshot.current === snapshotKey) return;
    const timer = setTimeout(() => {
      void persist(prefs, snapshotKey);
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, loading, persist, prefs, saving]);

  const daily = prefs.gap_daily.settings;
  const weekly = prefs.levels_weekly.settings;

  // Every zone keeps an empty live region in the page so screen readers
  // announce the status when it lands in whichever zone was last changed.
  // An edit still waiting to go out outranks "saved" from an earlier save.
  const saveStatus = (zone: StatusZone) => (
    <div aria-live="polite" className="mt-4 min-h-5 font-mono text-xs">
      {statusZone !== zone ? null : error ? (
        <span className="text-red-400">{error}</span>
      ) : saving ? (
        <span className="text-beam-dim">saving settings…</span>
      ) : dirty || pendingDrafts.size > 0 ? (
        <span className="text-beam-dim">changes pending…</span>
      ) : status ? (
        <span className="text-beam-mid">{status}</span>
      ) : null}
    </div>
  );

  if (loading) {
    return <div className="etched py-12 text-beam-dim">loading your alert settings…</div>;
  }

  return (
    <div className="space-y-12">
      <section aria-labelledby="watchlist-heading" className="border-t border-[hsl(var(--beam-ghost))] pt-6">
        <div className="mb-4 flex items-center gap-3">
          <ListChecks className="h-4 w-4 text-beam-hot" aria-hidden="true" />
          <h2 id="watchlist-heading" className="font-mono text-sm font-semibold tracking-[0.14em] text-beam-hot">
            WATCHLIST
          </h2>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-beam-dim">
            {symbols.length} OF {universe.length} SELECTED
          </span>
        </div>
        <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <p className="max-w-[68ch] font-mono text-xs leading-relaxed text-beam-dim">
            Choose the tickers your alert emails cover
          </p>
          {universe.length > 0 && (
            <div className="ml-auto flex gap-2 font-mono text-[11px] tracking-[0.12em]">
              <button
                type="button"
                onClick={() => editSymbols([...symbols, ...universe])}
                disabled={allSelected}
                className="border border-[hsl(var(--beam-ghost))] px-3 py-1.5 text-beam-mid hover:border-beam-hot hover:text-beam-hot disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[hsl(var(--beam-ghost))] disabled:hover:text-beam-mid"
              >
                SELECT ALL
              </button>
              <button
                type="button"
                onClick={() => editSymbols([])}
                disabled={symbols.length === 0}
                className="border border-[hsl(var(--beam-ghost))] px-3 py-1.5 text-beam-mid hover:border-beam-hot hover:text-beam-hot disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[hsl(var(--beam-ghost))] disabled:hover:text-beam-mid"
              >
                CLEAR
              </button>
            </div>
          )}
        </div>
        {universe.length ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Watchlist tickers">
            {universe.map((symbol) => {
              const on = selected.has(symbol);
              return (
                <button
                  key={symbol}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSymbol(symbol)}
                  className={`border px-3 py-2 font-mono text-xs transition-colors ${
                    on
                      ? "border-beam-hot bg-[hsl(var(--beam-ghost))] text-beam-hot shadow-[inset_0_0_0_1px_hsl(var(--beam-hot)/0.35)] forced-colors:outline forced-colors:outline-2 forced-colors:outline-offset-[-5px]"
                      : "border-[hsl(var(--beam-ghost))] text-beam-dim hover:border-beam-dim hover:text-beam-mid"
                  }`}
                >
                  {symbol}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="font-mono text-xs text-beam-dim">ticker list unavailable · try again later</p>
        )}
        {symbols.length === 0 && (
          <p className="mt-4 font-mono text-xs text-beam-mid">No tickers selected · no emails are sent until you choose at least one</p>
        )}
        <div aria-live="polite" className="mt-4 min-h-5 font-mono text-xs">
          {watchError ? (
            <span className="text-red-400">{watchError}</span>
          ) : watchSaving ? (
            <span className="text-beam-dim">saving watchlist…</span>
          ) : watchDirty ? (
            <span className="text-beam-dim">changes pending…</span>
          ) : watchStatus ? (
            <span className="text-beam-mid">{watchStatus}</span>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="channels-heading" className="border-t border-[hsl(var(--beam-ghost))] pt-6">
        <div className="mb-6 flex items-center gap-3">
          <BellRing className="h-4 w-4 text-beam-hot" aria-hidden="true" />
          <h2 id="channels-heading" className="font-mono text-sm font-semibold tracking-[0.14em] text-beam-hot">
            ALERT EMAILS
          </h2>
        </div>

        <div className="grid gap-px bg-[hsl(var(--beam-ghost))] md:grid-cols-2">
          <div className="bg-background py-5 md:p-6">
            <Toggle
              checked={prefs.levels_weekly.enabled}
              onChange={(enabled) => toggleKind("levels_weekly", enabled)}
              label="Weekly buy-limit digest"
              disabled={!canEnable && !prefs.levels_weekly.enabled}
            />
            <p className="mt-4 font-mono text-xs leading-relaxed text-beam-dim">
              Buy-limit levels below the price after the first and last trading days of each week, usually Monday and Friday, in your inbox the next morning
            </p>
          </div>
          <div className="bg-background py-5 md:p-6">
            <Toggle
              checked={prefs.gap_daily.enabled}
              onChange={(enabled) => toggleKind("gap_daily", enabled)}
              label="Daily structure alerts"
              disabled={!canEnable && !prefs.gap_daily.enabled}
            />
            <p className="mt-4 font-mono text-xs leading-relaxed text-beam-dim">
              Built after each close and sent the next morning, only when an event you selected happens; a quiet day sends nothing
            </p>
          </div>
        </div>
        {saveStatus("channels")}
      </section>

      <section aria-labelledby="daily-heading" className="border-t border-[hsl(var(--beam-ghost))] pt-6">
        <div className="etched mb-2 text-beam-dim">DAILY STRUCTURE FILTERS</div>
        <h2 id="daily-heading" className="mb-6 font-mono text-lg font-semibold text-beam-hot">
          Choose what earns an email
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          <fieldset>
            <legend className="etched mb-3 text-beam-dim">EVENT TYPES</legend>
            <div className="space-y-1 font-mono text-sm text-beam-mid min-[600px]:space-y-3">
              {([
                ["gaps", "Open gap stage changes", CONTROL_HELP.gapEvents],
                ["orderBlocks", "Price reaches an order block", CONTROL_HELP.orderBlockEvents],
                ["equilibrium", "Price falls to the middle of the range", CONTROL_HELP.equilibriumEvents],
              ] as const).map(([key, label, help]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 min-[600px]:min-h-0">
                    <input
                      type="checkbox"
                      checked={daily.eventTypes[key]}
                      onChange={(event) =>
                        updateDaily({ eventTypes: { ...daily.eventTypes, [key]: event.target.checked } })
                      }
                      className="accent-[hsl(var(--beam-hot))]"
                    />
                    {label}
                  </label>
                  <InfoTip label={label} text={help} />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="etched mb-3 text-beam-dim">GAP DIRECTION</legend>
            <div className="space-y-1 font-mono text-sm text-beam-mid min-[600px]:space-y-3">
              {([
                ["support", "Below price · buy area", CONTROL_HELP.supportGaps],
                ["resistance", "Above price · sell area", CONTROL_HELP.resistanceGaps],
              ] as const).map(([key, label, help]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 min-[600px]:min-h-0">
                    <input
                      type="checkbox"
                      checked={daily.gapDirections[key]}
                      onChange={(event) =>
                        updateDaily({ gapDirections: { ...daily.gapDirections, [key]: event.target.checked } })
                      }
                      className="accent-[hsl(var(--beam-hot))]"
                    />
                    {label}
                  </label>
                  <InfoTip label={label} text={help} />
                </div>
              ))}
            </div>
          </fieldset>

          <div className="block">
            <div className="mb-3 flex items-center gap-2">
              <label htmlFor="gap-stage" className="etched text-beam-dim">MINIMUM GAP STAGE</label>
              <InfoTip label="Minimum gap stage" text={CONTROL_HELP.gapStage} />
            </div>
            <select
              id="gap-stage"
              value={daily.minGapStage}
              onChange={(event) => updateDaily({ minGapStage: event.target.value as GapDailySettings["minGapStage"] })}
              className="w-full border border-[hsl(var(--beam-ghost))] bg-background px-3 py-2 font-mono text-sm text-beam-mid outline-none focus:border-beam-hot"
            >
              <option value="approaching">Approaching</option>
              <option value="tagged">Inside the gap</option>
              <option value="about">About to fill</option>
              <option value="filled">Filled</option>
            </select>
            <span className="mt-2 block font-mono text-[11px] leading-relaxed text-beam-dim">
              A later stage sends fewer gap emails
            </span>
          </div>
        </div>
        {saveStatus("daily")}
      </section>

      <section aria-labelledby="weekly-heading" className="border-y border-[hsl(var(--beam-ghost))] py-6">
        <h2 id="weekly-heading" className="font-mono text-sm font-semibold tracking-[0.14em] text-beam-hot">
          WEEKLY DIGEST FILTERS
        </h2>
        <p className="mt-4 max-w-[68ch] font-mono text-xs leading-relaxed text-beam-dim">
          Choose which levels make the weekly digest; the starting values work if you are unsure
        </p>

        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <div className="etched text-lg text-beam-dim">MINIMUM TIMEFRAME RELEVANCE</div>
            <InfoTip label="Minimum timeframe relevance" text={CONTROL_HELP.minStrength} large />
          </div>
          <div className="inline-flex border border-[hsl(var(--beam-ghost))] p-1" role="group" aria-label="Minimum timeframe relevance">
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={weekly.minTfs === value}
                onClick={() => updateWeekly("strength", { minTfs: value })}
                className={`whitespace-nowrap px-4 py-2 font-mono text-lg max-[600px]:px-3 max-[600px]:text-[16px] ${
                  weekly.minTfs === value
                    ? "bg-[hsl(var(--beam-ghost))] text-beam-hot shadow-[inset_0_0_0_1px_hsl(var(--beam-hot)/0.35)]"
                    : "text-beam-dim hover:text-beam-mid"
                }`}
              >
                {value} of 3
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-sm text-beam-dim">Timeframes agreeing: 2-hour · 4-hour · daily</p>
          {saveStatus("strength")}
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <NumberField large={true} id="lookback-days" label="LAST TESTED WITHIN" value={weekly.lookbackDays} min={1} max={3650} unit="days" hint="Only support price touched within this many days counts" tooltip={CONTROL_HELP.recency} onPending={trackDraft("lookback-days", "limits")} onChange={(value) => updateWeekly("limits", { lookbackDays: value })} />
          <NumberField large={true} id="max-below" label="MAX DISTANCE BELOW" value={weekly.maxBelowPct} min={0} max={100} step={0.5} unit="%" hint="Skips levels farther below the close than this; zero removes the limit" tooltip={CONTROL_HELP.maxBelow} onPending={trackDraft("max-below", "limits")} onChange={(value) => updateWeekly("limits", { maxBelowPct: value })} />
          <NumberField large={true} id="max-setups" label="LEVELS PER EMAIL" value={weekly.maxSetups} min={0} max={1000} unit="levels" hint="Keeps the strongest levels up to this number; zero sends them all" tooltip={CONTROL_HELP.resultCap} onPending={trackDraft("max-setups", "limits")} onChange={(value) => updateWeekly("limits", { maxSetups: value })} />
        </div>
        {saveStatus("limits")}

        <div className="mt-9 border-t border-[hsl(var(--beam-ghost))] pt-7">
          <div className="mb-3 flex items-center gap-2">
            <div id="gap-placement-label" className="etched text-lg text-beam-dim">GAP LIMIT PRICE</div>
            <InfoTip label="Gap limit price" text={CONTROL_HELP.gapPlacement} large />
          </div>
          <div className="inline-flex border border-[hsl(var(--beam-ghost))] p-1" role="group" aria-labelledby="gap-placement-label">
            {GAP_PLACEMENTS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={gapPlacement === value}
                disabled={gapPlacementState === "loading"}
                onClick={() => chooseGapPlacement(value)}
                className={`whitespace-nowrap px-4 py-2 font-mono text-lg disabled:opacity-40 max-[600px]:px-3 max-[600px]:text-[16px] ${
                  gapPlacement === value
                    ? "bg-[hsl(var(--beam-ghost))] text-beam-hot shadow-[inset_0_0_0_1px_hsl(var(--beam-hot)/0.35)]"
                    : "text-beam-dim hover:text-beam-mid"
                }`}
              >
                {GAP_PLACEMENT_LABEL[value]}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-sm text-beam-dim">Also sets gap prices in the Limit Buy dialog on the charts page</p>
          <div aria-live="polite" className="mt-4 min-h-5 font-mono text-xs">
            {gapPlacementError ? (
              <span className="text-red-400">{gapPlacementError}</span>
            ) : gapPlacementState === "saving" ? (
              <span className="text-beam-dim">saving…</span>
            ) : gapPlacementState === "saved" ? (
              <span className="text-beam-mid">saved</span>
            ) : null}
          </div>
        </div>

        <div className="mt-9 border-t border-[hsl(var(--beam-ghost))] pt-7">
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <Toggle checked={weekly.confluenceEnabled} onChange={(checked) => updateWeekly("confluence", { confluenceEnabled: checked })} label="Gap + order block levels" large />
            </div>
            <InfoTip label="Gap + order block levels" text={CONTROL_HELP.confluence} large />
          </div>
          <div className="mt-7 grid gap-8 md:grid-cols-2">
            <NumberField large={true} id="confluence-distance" label="GAP + ORDER BLOCK DISTANCE" value={weekly.confluencePct} min={0.1} max={50} step={0.1} unit="%" hint="How far apart the gap and order block can be" tooltip={CONTROL_HELP.confluenceDistance} onPending={trackDraft("confluence-distance", "confluence")} onChange={(value) => updateWeekly("confluence", { confluencePct: value })} />
            <NumberField large={true} id="triple-distance" label="TRIPLE DISTANCE" value={weekly.triplePct} min={0.1} max={50} step={0.1} unit="%" hint="How far apart a gap, an order block and a support level can be for a Triple level" tooltip={CONTROL_HELP.tripleDistance} onPending={trackDraft("triple-distance", "confluence")} onChange={(value) => updateWeekly("confluence", { triplePct: value })} />
          </div>
          {saveStatus("confluence")}
        </div>

        <div className="mt-9 border-t border-[hsl(var(--beam-ghost))] pt-7">
          <div className="etched mb-3 text-beam-dim">SKIP REPEATS</div>
          <p className="mb-6 max-w-[68ch] font-mono text-xs leading-relaxed text-beam-dim">
            Skip a ticker and level already emailed to you recently, so a level that stays in place is not repeated in every digest
          </p>
          <div className="grid gap-8 md:grid-cols-2">
            <NumberField large={true} id="dedup-days" label="DON'T REPEAT WITHIN" value={weekly.dedupDays} min={0} max={180} unit="days" hint="Sends it again once this time passes; zero repeats it in every digest" tooltip={CONTROL_HELP.dedupDays} onPending={trackDraft("dedup-days", "repeat")} onChange={(value) => updateWeekly("repeat", { dedupDays: value })} />
            <NumberField large={true} id="dedup-tolerance" label="SAME-LEVEL TOLERANCE" value={weekly.dedupPct} min={0} max={10} step={0.1} unit="%" hint="Levels within this percent count as the same level" tooltip={CONTROL_HELP.dedupTolerance} onPending={trackDraft("dedup-tolerance", "repeat")} onChange={(value) => updateWeekly("repeat", { dedupPct: value })} />
          </div>
        </div>

        {saveStatus("repeat")}
      </section>
    </div>
  );
}
