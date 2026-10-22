import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronRight, Mail } from "lucide-react";

import {
  ALERT_KINDS,
  CLOSE_DAYS,
  LEVELS_WEEKLY_DEFAULTS,
  type CloseDay,
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
import { TICKER_NAMES, groupTickers } from "@/lib/ticker-groups";
import {
  CombinedLevelsChart,
  GapAboveMini,
  GapBelowMini,
  GapLimitChart,
  GapStageChart,
  OpenGapEvent,
  OrderBlockEvent,
  RangeMiddleEvent,
  gapLimitTop,
  gapStageTop,
} from "@/components/alert-illustrations";

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

// Where the last settings change was made (the email switches or one of the
// settings cards); a save error shows there, next to the control just touched.
type StatusZone = "emails" | "weekly" | "daily";

type Props = {
  canEnable: boolean;
  gateHint?: string | null;
};

const CONTROL_HELP = {
  gapEvents: "Emails once each time an open gap reaches the step you pick below or a later one",
  orderBlockEvents: "Emails the first time the latest close lands inside an order block, a zone where a strong move started; going back into the same zone stays quiet until a new zone forms",
  equilibriumEvents: "Emails when price falls from the upper half of its recent range to the middle of the range or below; the middle is halfway between the high and low of the last 300 bars on the 2-hour chart; it can email again only after price climbs back above the middle",
  supportGaps: "Includes open gaps below the price, left by a gap up; they can act as support, a buy area on the chart, not a FearLab decision",
  resistanceGaps: "Includes open gaps above the price, left by a gap down; they can act as resistance, a sell area on the chart, not a FearLab decision",
  gapStage: "Getting close: price is within 1% of the gap's near edge; inside the gap: price has moved into it; about to fill: price is within 1% of the far edge; filled: price crossed the far edge or came within 0.1% of it",
  minStrength: "How many of the three timeframes (2-hour, 4-hour and daily) show the same support level; a higher number sends fewer, stronger levels",
  recency: "Only support levels that price traded down to within this many days can make the weekly email",
  maxBelow: "Leaves out levels more than this percent below the latest close; zero removes the limit",
  resultCap: "Keeps only the strongest levels across your whole ticker list, up to this many; zero keeps every level that qualifies",
  gapPlacement: "Where the suggested buy limit sits inside an open gap below the price: the top is the first price a drop reaches, the middle is halfway in, and a full fill is the bottom of the gap, where it closes completely; the weekly email prices gap + order block and Triple levels this way, and so does the Limit Buy dialog on the charts page",
  confluence: "Adds gap + order block levels: an open gap below the price whose middle sits close to the middle of a fresh order block, the zone where a strong move up started; fresh means price has not come back into that zone since it formed; the price shown is the gap at your gap limit price",
  confluenceDistance: "How far apart, in percent, the middles of an open gap and a fresh order block (price has not come back into it since it formed) can be and still count as a gap + order block level",
  tripleDistance: "How far apart, in percent, an open gap, a fresh order block (price has not come back into it since it formed) and a support level can be and still count as a Triple level; the email prices it at the gap, using your gap limit price",
  dedupDays: "Skips a ticker and level already emailed to you within this many days, then lets it back in once that time passes; zero sends every standing level in every weekly email",
  dedupTolerance: "Two levels within this percent of each other count as the same level; a level that moves farther than this counts as new and sends again",
} as const;

const GAP_PLACEMENT_LABEL: Record<GapPlacement, string> = { top: "Top", middle: "Middle", fill: "Full fill" };

const STRENGTH_CHOICES = [
  { value: 1, label: "Any one timeframe" },
  { value: 2, label: "Two of three agree" },
  { value: 3, label: "All three agree" },
] as const;

const GAP_STAGES: ReadonlyArray<{ value: GapDailySettings["minGapStage"]; label: string }> = [
  { value: "approaching", label: "Getting close" },
  { value: "tagged", label: "Inside the gap" },
  { value: "about", label: "About to fill" },
  { value: "filled", label: "Filled" },
];

// Each morning the weekly email can land, and the close it follows.
const MORNINGS: ReadonlyArray<{ day: string; long: string; close: CloseDay; after: string; afterLong: string }> = [
  { day: "TUE", long: "Tuesday", close: "mon", after: "Mon close", afterLong: "Monday's close" },
  { day: "WED", long: "Wednesday", close: "tue", after: "Tue close", afterLong: "Tuesday's close" },
  { day: "THU", long: "Thursday", close: "wed", after: "Wed close", afterLong: "Wednesday's close" },
  { day: "FRI", long: "Friday", close: "thu", after: "Thu close", afterLong: "Thursday's close" },
  { day: "SAT", long: "Saturday", close: "fri", after: "Fri close", afterLong: "Friday's close" },
];

// The weekly tuning values "reset to starting values" restores; the mornings
// picked in the top block are a separate choice and stay as they are.
const WEEKLY_TUNING_DEFAULTS: Partial<LevelsWeeklySettings> = Object.fromEntries(
  Object.entries(LEVELS_WEEKLY_DEFAULTS).filter(([key]) => key !== "closeDays"),
);

// Readable text only: bright beam for headings and labels, never the dim
// afterglow tone or the 13px etched style on this page.
const HEADING = "font-mono text-base font-semibold tracking-[0.14em] text-beam-hot";
const LABEL = "font-mono text-sm font-semibold uppercase tracking-[0.12em] text-beam-hot";

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
            className={`inline-flex items-center justify-center border border-[hsl(var(--beam-mid))] font-mono text-beam-mid transition-colors group-hover/tip:border-beam-hot group-hover/tip:text-beam-hot group-focus-visible/tip:border-beam-hot group-focus-visible/tip:text-beam-hot group-aria-expanded/tip:border-beam-hot group-aria-expanded/tip:text-beam-hot ${large ? "h-6 w-6 text-sm" : "h-5 w-5 text-xs"}`}
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
        className={`max-w-[min(20rem,calc((100vw_-_24px)_/_var(--pz)))] rounded-none border border-[hsl(var(--beam-mid))] bg-background px-3 py-2 font-mono leading-relaxed text-beam-hot shadow-[0_0_18px_hsl(var(--beam-ghost)/0.55)] ${large ? "text-base" : "text-sm"}`}
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
        className={`w-[3ch] shrink-0 font-mono text-xs font-semibold tracking-[0.08em] ${checked ? "text-beam-hot" : "text-beam-mid"}`}
      >
        {checked ? "ON" : "OFF"}
      </span>
      <span className={`min-w-0 font-mono text-left text-beam-hot ${large ? "text-lg" : "text-base"}`}>{label}</span>
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
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
  tooltip?: string;
  onChange: (value: number) => void;
  // true while the box holds text that is not the saved value yet (waiting to
  // go out, or invalid until blur puts the saved value back)
  onPending?: (pending: boolean) => void;
}) {
  // The field edits a draft string so it can sit empty or half-typed; only a
  // number within [min, max] reaches the settings (and so the autosave). A
  // whole-number step means a whole-number setting, so decimals stay a draft.
  // A valid draft goes out after a short pause (or on blur), so typing "2.5"
  // never sends the "2" on its way to an invalid value. The minus and plus
  // buttons move by one step and send at once.
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
  const nudge = (direction: 1 | -1) => {
    cancelPush();
    const next = Math.min(max, Math.max(min, Math.round((value + direction * step) * 100) / 100));
    setDraft(String(next));
    onPending?.(false);
    if (next !== value) onChange(next);
  };
  const stepButton = "flex w-11 shrink-0 items-center justify-center font-mono text-lg text-beam-hot hover:bg-[hsl(var(--beam-ghost))] disabled:cursor-not-allowed disabled:opacity-35";
  return (
    <div className="block min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={id} className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-beam-hot">{label}</label>
        <InfoTip label={label} text={tooltip ?? hint ?? label} />
      </div>
      <span className="flex max-w-72 items-stretch border border-[hsl(var(--beam-mid))] focus-within:border-beam-hot">
        <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => nudge(-1)} className={`${stepButton} border-r border-[hsl(var(--beam-mid))]`}>
          −
        </button>
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
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-center font-mono text-lg tabular-nums text-beam-hot outline-none"
        />
        <span className="flex items-center px-2 font-mono text-xs uppercase tracking-[0.1em] text-beam-mid">
          {unit}
        </span>
        <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => nudge(1)} className={`${stepButton} border-l border-[hsl(var(--beam-mid))]`}>
          +
        </button>
      </span>
      {hint && (
        <span className="mt-2 block max-w-[40ch] font-mono text-sm leading-snug text-beam-mid">
          {hint}
        </span>
      )}
    </div>
  );
}

// A row of mutually exclusive choices drawn as one bordered strip; the
// selected one carries the beam fill.
function ChoiceStrip<T extends string | number>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label?: string;
  labelledBy?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-1 border border-[hsl(var(--beam-mid))] p-1 sm:[grid-template-columns:repeat(var(--choices),minmax(0,1fr))]"
      style={{ "--choices": options.length } as CSSProperties}
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`min-h-[44px] px-2 py-2 font-mono text-sm leading-tight disabled:cursor-not-allowed disabled:opacity-40 min-[600px]:min-h-0 ${
            value === option.value
              ? "bg-[hsl(var(--beam-ghost))] text-beam-hot shadow-[inset_0_0_0_1px_hsl(var(--beam-hot)/0.35)]"
              : "text-beam-mid hover:text-beam-hot"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// A closed-by-default section for settings most people never change.
function Disclosure({ id, title, summary, children }: { id: string; title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[hsl(var(--beam-ghost))]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="group flex min-h-[44px] w-full items-start gap-3 py-4 text-left"
      >
        <ChevronRight
          aria-hidden="true"
          className={`mt-1 h-5 w-5 shrink-0 text-beam-hot transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0">
          <span className="block font-mono text-base text-beam-hot">{title}</span>
          <span className="mt-1 block font-mono text-sm leading-snug text-beam-mid">{summary}</span>
        </span>
      </button>
      {open && (
        <div id={id} className="pb-6">
          {children}
        </div>
      )}
    </div>
  );
}

// A month of daily closes as a thin line; decorative next to the ticker's name.
function Sparkline({ closes, on }: { closes?: number[]; on: boolean }) {
  if (!closes || closes.length < 2) return null;
  const lo = Math.min(...closes);
  const span = Math.max(...closes) - lo || 1;
  const points = closes.map((close, index) => `${(index / (closes.length - 1)) * 100},${27 - ((close - lo) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" className="mt-1 block h-6 w-full">
      <polyline points={points} fill="none" stroke={on ? "hsl(var(--beam-hot))" : "hsl(var(--beam-mid))"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// A chart drawing with its choices stacked beside it, each button set at the
// height of the price it stands for (`top` is a percentage of the drawing).
// Below lg the drawing is too short for that, so the buttons sit in a grid under it.
function ChartChoices<T extends string>({
  labelledBy,
  chart,
  options,
  value,
  onChange,
  disabled = false,
}: {
  labelledBy: string;
  chart: ReactNode;
  options: ReadonlyArray<{ value: T; label: string; top: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div className="min-w-0 flex-1">{chart}</div>
      <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 lg:relative lg:block lg:w-[8.5rem] lg:shrink-0">
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              style={{ top: option.top }}
              className={`min-h-[44px] lg:absolute lg:left-0 lg:right-0 lg:-translate-y-1/2 border px-2 py-1 text-left font-mono text-xs font-semibold tracking-[0.06em] disabled:cursor-not-allowed min-[600px]:min-h-0 ${
                on
                  ? "border-beam-hot bg-[hsl(var(--beam-hot))] text-[hsl(var(--primary-foreground))]"
                  : "border-[hsl(var(--beam-mid))] bg-background text-beam-hot hover:border-beam-hot"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AlertControlPanel({ canEnable, gateHint = null }: Props) {
  const [universe, setUniverse] = useState<string[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [savedSymbols, setSavedSymbols] = useState<string[]>([]);
  const savedSymbolsRef = useRef<string[]>([]);
  const [watchSaving, setWatchSaving] = useState(false);
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
  const [error, setError] = useState<string | null>(null);
  // the first load failed: the switches show defaults, not the saved settings
  const [loadError, setLoadError] = useState<string | null>(null);
  const failedSnapshot = useRef<string | null>(null);
  const [statusZone, setStatusZone] = useState<StatusZone>("weekly");
  // flips once anything on the page saves, so the top status can say so
  const [everSaved, setEverSaved] = useState(false);
  // Gap limit placement lives with the chart preferences (/api/chart-prefs),
  // not in alert_prefs: the Limit Buy dialog uses it whether or not alerts are
  // on. A click saves it; one save is in flight at a time and clicks made
  // meanwhile collapse into the latest, so the stored value is the last choice.
  const [gapPlacement, setGapPlacement] = useState<GapPlacement>("top");
  const [gapPlacementState, setGapPlacementState] = useState<"loading" | "idle" | "saving" | "saved">("loading");
  const [gapPlacementError, setGapPlacementError] = useState<string | null>(null);
  const [gapPlacementLoadError, setGapPlacementLoadError] = useState<string | null>(null);
  const savedGapPlacement = useRef<GapPlacement>("top");
  const gapPlacementSaving = useRef(false);
  const gapPlacementQueued = useRef<GapPlacement | null>(null);
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
        setGapPlacementLoadError("this choice is unavailable right now · try again later");
      });
    return () => controller.abort();
  }, []);
  const saveGapPlacement = async (value: GapPlacement) => {
    gapPlacementSaving.current = true;
    let failure: string | null = null;
    try {
      const response = await csrfFetch("/api/chart-prefs", { method: "PUT", body: JSON.stringify({ gapPlacement: value }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      savedGapPlacement.current = value;
    } catch (reason: any) {
      failure = reason?.message || "failed to save";
    }
    gapPlacementSaving.current = false;
    const next = gapPlacementQueued.current;
    gapPlacementQueued.current = null;
    if (next !== null && next !== savedGapPlacement.current) return saveGapPlacement(next);
    if (failure && next === null) {
      setGapPlacement(savedGapPlacement.current);
      setGapPlacementState("idle");
      setGapPlacementError(`${failure} · gap limit price restored to the last saved choice`);
      return;
    }
    setGapPlacementState("saved");
    setEverSaved(true);
  };
  const chooseGapPlacement = (value: GapPlacement) => {
    setGapPlacement(value);
    setGapPlacementError(null);
    setGapPlacementState("saving");
    if (gapPlacementSaving.current) gapPlacementQueued.current = value;
    else void saveGapPlacement(value);
  };
  // number boxes whose typed value has not reached the settings yet
  const [pendingDrafts, setPendingDrafts] = useState<ReadonlySet<string>>(() => new Set());
  const trackDraft = (id: string) => (pending: boolean) => {
    setPendingDrafts((current) => {
      if (current.has(id) === pending) return current;
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
    if (pending) setStatusZone("weekly");
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
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
        if (reason?.name !== "AbortError") setLoadError(reason?.message || "failed to load alert settings");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const selected = useMemo(() => new Set(symbols), [symbols]);
  const groups = useMemo(() => groupTickers(universe), [universe]);
  // decoration only: tickers without data simply show no line
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/watchlist/sparklines", { credentials: "include", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { closes: {} }))
      .then((body) => setSparklines(body?.closes ?? {}))
      .catch(() => {});
    return () => controller.abort();
  }, []);
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
    failedWatchKey.current = null;
  };

  const toggleSymbol = (symbol: string) => {
    editSymbols(selected.has(symbol) ? symbols.filter((item) => item !== symbol) : [...symbols, symbol]);
  };

  const toggleGroup = (groupSymbols: string[], on: boolean) => {
    const inGroup = new Set(groupSymbols);
    editSymbols(on ? [...symbols, ...groupSymbols] : symbols.filter((item) => !inGroup.has(item)));
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
            ? `${body.error || "too many ticker changes"} · selection restored to the last saved list`
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
      setEverSaved(true);
    } catch (reason: any) {
      failedWatchKey.current = key;
      // this list never reached the server, so it no longer counts as sent
      // (a newer request's key stays); otherwise re-selecting it never saves
      if (sentWatchKey.current === key) sentWatchKey.current = savedSymbolsRef.current.join(",");
      // show what the server actually holds instead of an unsaved selection
      setSymbols((current) => (current.join(",") === key ? savedSymbolsRef.current : current));
      setWatchError(reason?.message || "failed to save tickers");
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
        })
        .catch(() => setWatchError("could not reload your saved tickers · refresh the page"));
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("pageshow", reconcile);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("pageshow", reconcile);
      flush();
    };
  }, []);

  const updateWeekly = (patch: Partial<LevelsWeeklySettings>) => {
    setPrefs((current) => ({
      ...current,
      levels_weekly: {
        ...current.levels_weekly,
        settings: { ...current.levels_weekly.settings, ...patch },
      },
    }));
    setStatusZone("weekly");
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
    setError(null);
  };

  const toggleKind = (kind: (typeof ALERT_KINDS)[number], enabled: boolean) => {
    setStatusZone("emails");
    if (enabled && !canEnable) {
      setError(gateHint ? `${gateHint} · use the Account link above` : "Finish account setup on the Account page before turning on alerts");
      return;
    }
    setPrefs((current) => setAlertEnabled(current, kind, enabled, canEnable));
    setError(null);
  };

  const persist = useCallback(async (snapshot: AlertPrefsState, snapshotKey: string) => {
    setSaving(true);
    setError(null);
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
      setEverSaved(true);
    } catch (reason: any) {
      failedSnapshot.current = snapshotKey;
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
  const weeklyOn = prefs.levels_weekly.enabled;
  const dailyOn = prefs.gap_daily.enabled;
  const weeklyAtDefaults = (Object.keys(WEEKLY_TUNING_DEFAULTS) as (keyof LevelsWeeklySettings)[]).every(
    (key) => weekly[key] === WEEKLY_TUNING_DEFAULTS[key],
  );

  // One status for the whole page, at the top. Saving errors also show inside
  // the card or list they came from, next to the control that caused them.
  const anyError = watchError || error || gapPlacementError;
  const pageStatus = anyError ? (
    <span className="text-red-400">a change was not saved · details below</span>
  ) : watchSaving || saving || gapPlacementState === "saving" ? (
    <span className="text-beam-mid">saving settings…</span>
  ) : watchDirty || dirty || pendingDrafts.size > 0 ? (
    <span className="text-beam-mid">changes pending…</span>
  ) : everSaved ? (
    <span className="text-beam-hot">all changes saved</span>
  ) : (
    <span className="text-beam-mid">changes save as you make them</span>
  );

  const zoneError = (zone: StatusZone) => (
    <div aria-live="polite" className="min-h-5 font-mono text-sm">
      {statusZone === zone && error ? <span className="text-red-400">{error}</span> : null}
    </div>
  );

  if (loading) {
    return <div className="py-12 font-mono text-sm text-beam-mid">loading your alert settings…</div>;
  }
  // Nothing to edit until the saved settings arrive: default values on screen
  // would be saved over the real ones by the first click.
  if (loadError) {
    return (
      <p role="alert" className="py-12 font-mono text-base text-red-400">
        {loadError} · refresh the page to try again
      </p>
    );
  }

  const closeDays = weekly.closeDays;
  const toggleCloseDay = (close: CloseDay) => {
    if (closeDays.includes(close)) {
      // the weekly email always follows at least one close; turning it off is the switch's job
      if (closeDays.length === 1) return;
      updateWeekly({ closeDays: closeDays.filter((day) => day !== close) });
    } else {
      updateWeekly({ closeDays: CLOSE_DAYS.filter((day) => day === close || closeDays.includes(day)) });
    }
    setStatusZone("emails");
  };
  const weeklyCount = closeDays.length;
  const weeklyTip =
    "Buy-limit prices below the latest close for your tickers, built after the closes you pick and in your inbox the next morning; with the starting Tuesday and Saturday pick it follows the week's first and last trading days, so a holiday moves it; with any other pick, a holiday close sends nothing that week";
  const dailyTip =
    "Built after each market close and in your inbox the next morning, only after a day when one of the events you pick happens; a quiet day sends nothing";

  return (
    <div className="space-y-12">
      <section aria-labelledby="emails-heading">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="emails-heading" className={HEADING}>YOUR EMAILS</h2>
          <span aria-live="polite" className="font-mono text-sm">{pageStatus}</span>
        </div>
        <div className="border-y border-[hsl(var(--beam-ghost))] py-6">
          <div aria-hidden="true" className="mb-4 hidden grid-cols-[22rem_repeat(5,minmax(0,1fr))] md:grid">
            <span />
            {MORNINGS.map((morning) => (
              <span key={morning.day} className="text-center font-mono">
                <span className="block text-sm font-semibold tracking-[0.14em] text-beam-hot">{morning.day}</span>
                <span className="block text-xs text-beam-mid">after {morning.after}</span>
              </span>
            ))}
          </div>
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-[22rem_1fr] md:items-center">
              <div className="flex items-start gap-1">
                <div className="min-w-0">
                  <Toggle
                    checked={weeklyOn}
                    onChange={(enabled) => toggleKind("levels_weekly", enabled)}
                    label="Weekly buy-limit email"
                    disabled={!canEnable && !weeklyOn}
                  />
                  <span className="mt-1 block font-mono text-xs text-beam-mid">
                    {weeklyCount} email{weeklyCount === 1 ? "" : "s"} a week · pick the mornings
                  </span>
                </div>
                <InfoTip label="Weekly buy-limit email" text={weeklyTip} />
              </div>
              <div role="group" aria-label="Weekly email mornings" className={`grid grid-cols-5 gap-2 ${weeklyOn ? "" : "opacity-60"}`}>
                {MORNINGS.map((morning) => {
                  const picked = closeDays.includes(morning.close);
                  return (
                    <button
                      key={morning.day}
                      type="button"
                      aria-pressed={picked}
                      aria-label={`${morning.long} morning, after ${morning.afterLong}`}
                      onClick={() => toggleCloseDay(morning.close)}
                      className={`relative flex min-h-[56px] flex-col items-center justify-center border py-2 transition-colors ${
                        picked
                          ? "border-beam-hot bg-[hsl(var(--beam-ghost))] text-beam-hot"
                          : "border-[hsl(var(--beam-ghost))] text-beam-mid hover:border-beam-mid"
                      }`}
                    >
                      <Mail aria-hidden="true" className="h-7 w-7" strokeWidth={picked ? 2 : 1.4} />
                      {picked && <Check aria-hidden="true" className="absolute right-1 top-1 h-4 w-4" strokeWidth={3} />}
                      <span aria-hidden="true" className="mt-1 font-mono text-xs md:hidden">{morning.day}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[22rem_1fr] md:items-center">
              <div className="flex items-start gap-1">
                <div className="min-w-0">
                  <Toggle
                    checked={dailyOn}
                    onChange={(enabled) => toggleKind("gap_daily", enabled)}
                    label="Daily price alerts"
                    disabled={!canEnable && !dailyOn}
                  />
                  <span className="mt-1 block font-mono text-xs text-beam-mid">Only after a day with one of your events</span>
                </div>
                <InfoTip label="Daily price alerts" text={dailyTip} />
              </div>
              <ul aria-label="Daily price alerts can arrive on these mornings" className={`grid grid-cols-5 gap-2 ${dailyOn ? "" : "opacity-60"}`}>
                {MORNINGS.map((morning) => (
                  <li key={morning.day} className="flex min-h-[56px] flex-col items-center justify-center border border-dashed border-[hsl(var(--beam-mid)/0.6)] py-2 text-beam-mid">
                    <span className="sr-only">{morning.long}</span>
                    <Mail aria-hidden="true" className="h-7 w-7" strokeWidth={1.4} />
                    <span aria-hidden="true" className="mt-1 font-mono text-xs md:hidden">{morning.day}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {zoneError("emails")}
        </div>
      </section>

      <section id="alert-tickers" aria-labelledby="tickers-heading" className="scroll-mt-28">
        <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-3">
          <h2 id="tickers-heading" className={HEADING}>YOUR TICKERS</h2>
          <span className="font-mono text-sm tabular-nums text-beam-hot">
            {symbols.length} of {universe.length} picked
          </span>
          {universe.length > 0 && (
            <div className="ml-auto flex gap-2 font-mono text-xs tracking-[0.12em]">
              {([
                ["SELECT ALL", () => editSymbols([...symbols, ...universe]), allSelected],
                ["CLEAR", () => editSymbols([]), symbols.length === 0],
              ] as const).map(([text, action, off]) => (
                <button
                  key={text}
                  type="button"
                  onClick={action}
                  disabled={off}
                  className="min-h-[44px] border border-[hsl(var(--beam-mid))] px-4 py-2 text-beam-hot hover:border-beam-hot disabled:cursor-not-allowed disabled:opacity-40 min-[600px]:min-h-0"
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mb-6 font-mono text-sm text-beam-mid">Both emails cover these tickers · lines show the last month</p>
        {groups.length ? (
          <div className="space-y-7">
            {groups.map((group) => {
              const picked = group.symbols.filter((symbol) => selected.has(symbol)).length;
              const all = picked === group.symbols.length;
              return (
                <fieldset key={group.id}>
                  <legend className="mb-3 flex items-center gap-3">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 min-[600px]:min-h-0">
                      <input
                        type="checkbox"
                        checked={all}
                        ref={(element) => {
                          if (element) element.indeterminate = picked > 0 && !all;
                        }}
                        onChange={() => toggleGroup(group.symbols, !all)}
                        className="h-5 w-5 accent-[hsl(var(--beam-hot))]"
                      />
                      <span className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-beam-hot">{group.label}</span>
                    </label>
                    <span className="font-mono text-sm tabular-nums text-beam-mid">{picked} / {group.symbols.length}</span>
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {group.symbols.map((symbol) => {
                      const on = selected.has(symbol);
                      const name = TICKER_NAMES[symbol];
                      return (
                        <button
                          key={symbol}
                          type="button"
                          aria-pressed={on}
                          aria-label={name ? `${symbol}, ${name}` : symbol}
                          onClick={() => toggleSymbol(symbol)}
                          className={`relative min-h-[44px] border px-3 py-2 text-left font-mono transition-colors ${
                            on
                              ? "border-beam-hot bg-[hsl(var(--beam-ghost))] forced-colors:outline forced-colors:outline-2 forced-colors:outline-offset-[-5px]"
                              : "border-[hsl(var(--beam-ghost))] hover:border-beam-mid"
                          }`}
                        >
                          {on && <Check aria-hidden="true" className="absolute right-2 top-2 h-5 w-5 text-beam-hot" strokeWidth={3} />}
                          <span className="block text-lg font-semibold text-beam-hot">{symbol}</span>
                          <span className="block min-h-[1.25em] text-xs text-beam-mid">{name ?? ""}</span>
                          <Sparkline closes={sparklines[symbol]} on={on} />
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        ) : (
          <p className="font-mono text-sm text-beam-mid">ticker list unavailable · try again later</p>
        )}
        <div aria-live="polite" className="mt-4 min-h-5 font-mono text-sm">
          {watchError ? <span className="text-red-400">{watchError}</span> : null}
        </div>
      </section>

      <div className="space-y-6">
        {weeklyOn && (
        <section
          id="alert-weekly"
          aria-labelledby="weekly-heading"
          className="scroll-mt-28 border border-[hsl(var(--beam-dim))] p-5 md:p-7"
        >
          <h2 id="weekly-heading" className={HEADING}>WEEKLY BUY-LIMIT EMAIL · SETTINGS</h2>
          {zoneError("weekly")}
          <div className="mt-4 space-y-8">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span id="strength-label" className={LABEL}>HOW STRONG SHOULD A LEVEL BE</span>
                  <InfoTip label="How strong should a level be" text={CONTROL_HELP.minStrength} />
                </div>
                <ChoiceStrip
                  labelledBy="strength-label"
                  options={STRENGTH_CHOICES}
                  value={weekly.minTfs as 1 | 2 | 3}
                  onChange={(value) => updateWeekly({ minTfs: value })}
                />
                <p className="mt-2 font-mono text-sm text-beam-mid">Compares the 2-hour, 4-hour and daily charts; stronger sends fewer</p>
              </div>
              <NumberField id="max-setups" label="MOST LEVELS PER EMAIL" value={weekly.maxSetups} min={0} max={1000} unit="levels" hint="Zero sends every level that qualifies" tooltip={CONTROL_HELP.resultCap} onPending={trackDraft("max-setups")} onChange={(value) => updateWeekly({ maxSetups: value })} />
            </div>

            <Disclosure id="weekly-advanced" title="Advanced weekly settings" summary="Gap buy price, gap + order block levels, distances and repeats · the starting values work if you are unsure">
              <div className="space-y-10">
                <div className="max-w-[720px]">
                  <div className="mb-3 flex items-center gap-2">
                    <span id="gap-placement-label" className={LABEL}>WHERE TO BUY IN A GAP</span>
                    <InfoTip label="Where to buy in a gap" text={CONTROL_HELP.gapPlacement} />
                  </div>
                  <ChartChoices
                    labelledBy="gap-placement-label"
                    chart={<GapLimitChart placement={gapPlacement} />}
                    options={GAP_PLACEMENTS.map((value) => ({ value, label: GAP_PLACEMENT_LABEL[value], top: gapLimitTop(value) }))}
                    value={gapPlacement}
                    disabled={gapPlacementState === "loading"}
                    onChange={chooseGapPlacement}
                  />
                  <p className="mt-3 font-mono text-sm text-beam-mid">Also sets gap prices in the Limit Buy dialog on the charts page</p>
                  <div aria-live="polite" className="mt-2 min-h-5 font-mono text-sm">
                    {gapPlacementError || gapPlacementLoadError ? <span className="text-red-400">{gapPlacementError ?? gapPlacementLoadError}</span> : null}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <Toggle checked={weekly.confluenceEnabled} onChange={(checked) => updateWeekly({ confluenceEnabled: checked })} label="Include gap + order block and Triple levels" />
                    </div>
                    <InfoTip label="Gap + order block and Triple levels" text={CONTROL_HELP.confluence} />
                  </div>
                  <fieldset disabled={!weekly.confluenceEnabled} className={`mt-5 grid gap-6 lg:grid-cols-2 ${weekly.confluenceEnabled ? "" : "opacity-50"}`}>
                    {([
                      ["confluence-distance", "GAP + ORDER BLOCK", false, weekly.confluencePct, CONTROL_HELP.confluenceDistance, (value: number) => updateWeekly({ confluencePct: value })],
                      ["triple-distance", "TRIPLE", true, weekly.triplePct, CONTROL_HELP.tripleDistance, (value: number) => updateWeekly({ triplePct: value })],
                    ] as const).map(([id, title, triple, value, tip, change]) => (
                      <div key={id} className="border border-[hsl(var(--beam-ghost))] p-4">
                        <div className="mb-2 font-mono text-base font-semibold tracking-[0.1em] text-beam-hot">{title}</div>
                        <CombinedLevelsChart triple={triple} distance={`${value}%`} />
                        <div className="mt-3">
                          <NumberField id={id} label="MIDDLES WITHIN" value={value} min={0.1} max={50} step={0.5} unit="%" tooltip={tip} onPending={trackDraft(id)} onChange={change} />
                        </div>
                      </div>
                    ))}
                  </fieldset>
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <NumberField id="lookback-days" label="LAST TESTED WITHIN" value={weekly.lookbackDays} min={1} max={3650} step={5} unit="days" hint="Only support price touched this recently counts" tooltip={CONTROL_HELP.recency} onPending={trackDraft("lookback-days")} onChange={(value) => updateWeekly({ lookbackDays: value })} />
                  <NumberField id="max-below" label="MAX DISTANCE BELOW" value={weekly.maxBelowPct} min={0} max={100} step={0.5} unit="%" hint="Skips levels farther below the close; zero means no limit" tooltip={CONTROL_HELP.maxBelow} onPending={trackDraft("max-below")} onChange={(value) => updateWeekly({ maxBelowPct: value })} />
                  <NumberField id="dedup-days" label="DON'T REPEAT WITHIN" value={weekly.dedupDays} min={0} max={180} unit="days" hint="A level already emailed stays out this long; zero repeats it" tooltip={CONTROL_HELP.dedupDays} onPending={trackDraft("dedup-days")} onChange={(value) => updateWeekly({ dedupDays: value })} />
                  <NumberField id="dedup-tolerance" label="SAME-LEVEL TOLERANCE" value={weekly.dedupPct} min={0} max={10} step={0.1} unit="%" hint="Levels this close count as the same level" tooltip={CONTROL_HELP.dedupTolerance} onPending={trackDraft("dedup-tolerance")} onChange={(value) => updateWeekly({ dedupPct: value })} />
                </div>

                <button
                  type="button"
                  disabled={weeklyAtDefaults}
                  onClick={() => updateWeekly(WEEKLY_TUNING_DEFAULTS)}
                  className="min-h-[44px] font-mono text-sm text-beam-hot underline underline-offset-4 disabled:cursor-not-allowed disabled:text-beam-mid disabled:no-underline min-[600px]:min-h-0"
                >
                  {weeklyAtDefaults ? "Using the starting values" : "Reset these settings to the starting values"}
                </button>
              </div>
            </Disclosure>
          </div>
        </section>
        )}

        {dailyOn && (
        <section
          id="alert-daily"
          aria-labelledby="daily-heading"
          className="scroll-mt-28 border border-[hsl(var(--beam-dim))] p-5 md:p-7"
        >
          <h2 id="daily-heading" className={HEADING}>DAILY PRICE ALERTS · SETTINGS</h2>
          {zoneError("daily")}
          <div className="mt-4 space-y-10">
            <fieldset>
              <legend className={`${LABEL} mb-3`}>EMAIL ME WHEN</legend>
              <div className="grid gap-3 md:grid-cols-3">
                {([
                  ["gaps", "OPEN GAP", "Price comes back to a gap it jumped over", OpenGapEvent, CONTROL_HELP.gapEvents],
                  ["orderBlocks", "ORDER BLOCK", "Price returns to where a strong rise started", OrderBlockEvent, CONTROL_HELP.orderBlockEvents],
                  ["equilibrium", "MIDDLE OF RANGE", "Price falls to halfway between the recent high and low", RangeMiddleEvent, CONTROL_HELP.equilibriumEvents],
                ] as const).map(([key, title, line, Drawing, help]) => {
                  const on = daily.eventTypes[key];
                  return (
                    <div key={key} className={`relative border ${on ? "border-beam-hot" : "border-[hsl(var(--beam-ghost))]"}`}>
                      <label className="block h-full cursor-pointer p-4">
                        <span className="flex items-center gap-3 pr-10">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(event) => updateDaily({ eventTypes: { ...daily.eventTypes, [key]: event.target.checked } })}
                            className="h-5 w-5 shrink-0 accent-[hsl(var(--beam-hot))]"
                          />
                          <span className="font-mono text-base font-semibold tracking-[0.08em] text-beam-hot">{title}</span>
                        </span>
                        <span className="mt-3 block">
                          <Drawing on={on} />
                        </span>
                        <span className="mt-3 block font-mono text-sm leading-snug text-beam-mid">{line}</span>
                      </label>
                      <div className="absolute right-2 top-2">
                        <InfoTip label={title} text={help} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <div className={`space-y-8 ${daily.eventTypes.gaps ? "" : "opacity-50"}`}>
              <div className="max-w-[720px]">
                <div className="mb-3 flex items-center gap-2">
                  <span id="gap-stage-label" className={LABEL}>GAP EMAILS START WHEN PRICE IS</span>
                  <InfoTip label="Gap emails start when price is" text={CONTROL_HELP.gapStage} />
                </div>
                <ChartChoices
                  labelledBy="gap-stage-label"
                  chart={<GapStageChart activeFrom={GAP_STAGES.findIndex((stage) => stage.value === daily.minGapStage)} />}
                  options={GAP_STAGES.map((stage) => ({ value: stage.value, label: stage.label, top: gapStageTop(stage.value) }))}
                  value={daily.minGapStage}
                  disabled={!daily.eventTypes.gaps}
                  onChange={(value) => updateDaily({ minGapStage: value })}
                />
                <p className="mt-3 font-mono text-sm text-beam-mid">Emails start at the bright line; a later step sends fewer</p>
              </div>

              <fieldset disabled={!daily.eventTypes.gaps}>
                <legend className={`${LABEL} mb-3`}>WHICH GAPS</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {([
                    ["support", "Below price · buy area", GapBelowMini, CONTROL_HELP.supportGaps],
                    ["resistance", "Above price · sell area", GapAboveMini, CONTROL_HELP.resistanceGaps],
                  ] as const).map(([key, label, Mini, help]) => {
                    const on = daily.gapDirections[key];
                    return (
                      <div key={key} className={`relative border ${on ? "border-beam-hot" : "border-[hsl(var(--beam-ghost))]"}`}>
                        <label className="block cursor-pointer p-4 pr-12">
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(event) => updateDaily({ gapDirections: { ...daily.gapDirections, [key]: event.target.checked } })}
                              className="h-5 w-5 shrink-0 accent-[hsl(var(--beam-hot))]"
                            />
                            <span className="font-mono text-sm text-beam-hot">{label}</span>
                          </span>
                          <span className="mt-3 block max-w-[13rem]"><Mini /></span>
                        </label>
                        <div className="absolute right-1 top-1">
                          <InfoTip label={label} text={help} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>
        </section>
        )}
      </div>
    </div>
  );
}
