import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, ListChecks } from "lucide-react";

import {
  ALERT_KINDS,
  parseAlertSettings,
  type GapDailySettings,
  type LevelsWeeklySettings,
} from "@shared/alert-settings";
import { csrfFetch } from "@/lib/auth-client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createDefaultAlertPrefs,
  normalizeAlertPrefsResponse,
  setAlertEnabled,
  type AlertPrefsState,
} from "@/lib/alert-control-model";

type Props = {
  canEnable: boolean;
  gateHint?: string | null;
};

const CONTROL_HELP = {
  gapEvents: "A gap alerts once each time it advances to or beyond your selected minimum stage",
  orderBlockEvents: "Alerts the first time the latest close enters a chart order-block zone; re-entry stays quiet unless the zone is new",
  equilibriumEvents: "Price must fall from the premium half of the recent 300-bar range to or below its midpoint; it rearms only after price returns above",
  supportGaps: "Includes unfilled gap-up zones below price, acting as potential support or buy areas",
  resistanceGaps: "Includes unfilled gap-down zones above price, acting as potential resistance or sell areas",
  gapStage: "Approaching means price is within 1% of the near edge; tagged means price is inside the zone; about to fill means within 1% of the far edge; filled means price crossed, or reached within 0.1% of, the far edge",
  minStrength: "How many of 2h, 4h, and 1d confirm the same support level; higher values produce fewer, stronger candidates",
  recency: "Only support the chart traded down to within this many days can qualify for the weekly digest",
  maxBelow: "Drops levels farther than this percentage below the latest close; set zero to remove the distance cap",
  resultCap: "Keeps only the strongest N qualifying rows across the watchlist; set zero to keep every qualifying row",
  confluence: "Adds an extra buy-limit zone when an unfilled gap and a fresh bullish order block sit close together below price",
  confluenceDistance: "Maximum percentage separation allowed between the unfilled gap and fresh bullish order block",
  tripleDistance: "Maximum spread among an unfilled gap, fresh bullish order block, and S/R level; their midpoint becomes the major level",
  dedupDays: "Suppresses a symbol and level already emailed to you within this many days, then lets it back into your inbox once the window passes; set zero to send the standing plan every run",
  dedupTolerance: "Two levels within this percentage of each other count as the same setup; a level that moves more than this is treated as new and sends again",
} as const;

function InfoTip({ label, text, large = false }: { label: string; text: string; large?: boolean }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Explain ${label}`}
          className={`inline-flex shrink-0 items-center justify-center border border-[hsl(var(--beam-ghost))] font-mono text-beam-dim transition-colors hover:border-beam-hot hover:text-beam-hot focus-visible:border-beam-hot focus-visible:text-beam-hot focus-visible:outline-none ${large ? "h-5 w-5 text-xs" : "h-4 w-4 text-[9px]"}`}
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent
        data-phosphor="ice"
        side="top"
        sideOffset={10}
        collisionPadding={12}
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
      className="group flex w-full items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 border transition-colors duration-200 ${
          checked
            ? "border-beam-hot bg-[hsl(var(--beam-ghost))]"
            : "border-[hsl(var(--beam-ghost))] bg-transparent"
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 transition-transform duration-200 ease-[var(--ease-out-expo)] ${
            checked
              ? "translate-x-[22px] bg-[hsl(var(--beam-hot))] shadow-[0_0_10px_hsl(var(--beam-hot)/0.65)]"
              : "translate-x-[3px] bg-[hsl(var(--beam-dim))]"
          }`}
        />
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
  large?: boolean;
}) {
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
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
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
  const [prefs, setPrefs] = useState<AlertPrefsState>(createDefaultAlertPrefs);
  const [savedPrefs, setSavedPrefs] = useState<AlertPrefsState>(createDefaultAlertPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const failedSnapshot = useRef<string | null>(null);

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

  // Chip clicks and select all / clear only edit local state; one PUT saves the
  // settled list. Saving per click tripped the server rate limit mid-selection.
  const editSymbols = (next: string[]) => {
    setSymbols([...new Set(next)].sort());
    setWatchError(null);
    setWatchStatus(null);
    failedWatchKey.current = null;
  };

  const toggleSymbol = (symbol: string) => {
    editSymbols(selected.has(symbol) ? symbols.filter((item) => item !== symbol) : [...symbols, symbol]);
  };

  const persistWatchlist = useCallback(async (next: string[], key: string) => {
    setWatchSaving(true);
    setWatchError(null);
    try {
      const response = await csrfFetch("/api/watchlist", {
        method: "PUT",
        body: JSON.stringify({ symbols: next }),
      });
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
      // later clicks may have landed while this request was in flight; keep them
      setSymbols((current) => (current.join(",") === key ? saved : current));
      setWatchStatus("watchlist saved");
    } catch (reason: any) {
      failedWatchKey.current = key;
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
    const timer = setTimeout(() => {
      void persistWatchlist(symbols, watchKey);
    }, 600);
    return () => clearTimeout(timer);
  }, [loading, persistWatchlist, symbols, watchDirty, watchKey, watchSaving]);

  const updateWeekly = (patch: Partial<LevelsWeeklySettings>) => {
    setPrefs((current) => ({
      ...current,
      levels_weekly: {
        ...current.levels_weekly,
        settings: { ...current.levels_weekly.settings, ...patch },
      },
    }));
    setStatus(null);
  };

  const updateDaily = (patch: Partial<GapDailySettings>) => {
    setPrefs((current) => ({
      ...current,
      gap_daily: {
        ...current.gap_daily,
        settings: { ...current.gap_daily.settings, ...patch },
      },
    }));
    setStatus(null);
  };

  const toggleKind = (kind: (typeof ALERT_KINDS)[number], enabled: boolean) => {
    if (enabled && !canEnable) {
      setError(gateHint || "complete account setup before enabling alerts");
      return;
    }
    setPrefs((current) => setAlertEnabled(current, kind, enabled, canEnable));
    setStatus(null);
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

  if (loading) {
    return <div className="etched py-12 text-beam-dim">loading alert channels…</div>;
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
            {symbols.length}/{universe.length} ACTIVE
          </span>
        </div>
        <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <p className="max-w-[68ch] font-mono text-xs leading-relaxed text-beam-dim">
            Choose the symbols the nightly pipeline should inspect for your emails
          </p>
          {universe.length > 0 && (
            <div className="ml-auto flex gap-2 font-mono text-[11px] tracking-[0.12em]">
              <button
                type="button"
                onClick={() => editSymbols(universe)}
                disabled={symbols.length === universe.length}
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
          <div className="flex flex-wrap gap-2" role="group" aria-label="Watchlist symbols">
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
                      ? "border-beam-hot bg-[hsl(var(--beam-ghost))] text-beam-hot shadow-[inset_0_0_0_1px_hsl(var(--beam-hot)/0.35)]"
                      : "border-[hsl(var(--beam-ghost))] text-beam-dim hover:border-beam-dim hover:text-beam-mid"
                  }`}
                >
                  {symbol}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="font-mono text-xs text-beam-dim">published symbol list unavailable · try again later</p>
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
            ALERT CHANNELS
          </h2>
        </div>

        <div className="grid gap-px bg-[hsl(var(--beam-ghost))] md:grid-cols-2">
          <div className="bg-background p-5 md:p-6">
            <Toggle
              checked={prefs.levels_weekly.enabled}
              onChange={(enabled) => toggleKind("levels_weekly", enabled)}
              label="Weekly buy-limit digest"
              disabled={!canEnable && !prefs.levels_weekly.enabled}
            />
            <p className="mt-4 font-mono text-xs leading-relaxed text-beam-dim">
              Monday + Friday: strong recently-tested support and gap/order-block confluence below price
            </p>
          </div>
          <div className="bg-background p-5 md:p-6">
            <Toggle
              checked={prefs.gap_daily.enabled}
              onChange={(enabled) => toggleKind("gap_daily", enabled)}
              label="Daily structure alerts"
              disabled={!canEnable && !prefs.gap_daily.enabled}
            />
            <p className="mt-4 font-mono text-xs leading-relaxed text-beam-dim">
              End of day, only when a selected structure event advances or fires
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="daily-heading" className="border-t border-[hsl(var(--beam-ghost))] pt-6">
        <div className="etched mb-2 text-beam-dim">DAILY STRUCTURE FILTERS</div>
        <h2 id="daily-heading" className="mb-6 font-mono text-lg font-semibold text-beam-hot">
          Choose what earns an email
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          <fieldset>
            <legend className="etched mb-3 text-beam-dim">EVENT TYPES</legend>
            <div className="space-y-3 font-mono text-sm text-beam-mid">
              {([
                ["gaps", "Gap stage changes", CONTROL_HELP.gapEvents],
                ["orderBlocks", "Order-block hits", CONTROL_HELP.orderBlockEvents],
                ["equilibrium", "EQ midpoint falls", CONTROL_HELP.equilibriumEvents],
              ] as const).map(([key, label, help]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-3">
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
            <div className="space-y-3 font-mono text-sm text-beam-mid">
              {([
                ["support", "Below price · buy area", CONTROL_HELP.supportGaps],
                ["resistance", "Above price · sell area", CONTROL_HELP.resistanceGaps],
              ] as const).map(([key, label, help]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-3">
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
              <option value="tagged">Tagged</option>
              <option value="about">About to fill</option>
              <option value="filled">Filled</option>
            </select>
            <span className="mt-2 block font-mono text-[11px] leading-relaxed text-beam-dim">
              Higher stages mean fewer, more decisive gap emails
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="weekly-heading" className="border-y border-[hsl(var(--beam-ghost))] py-6">
        <h2 id="weekly-heading" className="font-mono text-sm font-semibold tracking-[0.14em] text-beam-hot">
          ADVANCED WEEKLY QUALIFICATION
        </h2>
        <p className="mt-4 max-w-[68ch] font-mono text-xs leading-relaxed text-beam-dim">
          Tune what counts as an actionable level; defaults match the established local email pipeline
        </p>

        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <div className="etched text-lg text-beam-dim">MINIMUM STRENGTH</div>
            <InfoTip label="Minimum strength" text={CONTROL_HELP.minStrength} large />
          </div>
          <div className="inline-flex border border-[hsl(var(--beam-ghost))] p-1" role="group" aria-label="Minimum timeframe strength">
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={weekly.minTfs === value}
                onClick={() => updateWeekly({ minTfs: value })}
                className={`px-4 py-2 font-mono text-lg ${
                  weekly.minTfs === value
                    ? "bg-[hsl(var(--beam-ghost))] text-beam-hot shadow-[inset_0_0_0_1px_hsl(var(--beam-hot)/0.35)]"
                    : "text-beam-dim hover:text-beam-mid"
                }`}
              >
                {"━".repeat(value)} {value} TF
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-sm text-beam-dim">Timeframes agreeing: 2h · 4h · 1d</p>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <NumberField large={true} id="lookback-days" label="RECENCY WINDOW" value={weekly.lookbackDays} min={1} max={3650} unit="days" hint="Only levels traded within this window qualify" tooltip={CONTROL_HELP.recency} onChange={(value) => updateWeekly({ lookbackDays: value })} />
          <NumberField large={true} id="max-below" label="MAX DISTANCE BELOW" value={weekly.maxBelowPct} min={0} max={100} step={0.5} unit="%" hint="Skip support deeper than this; zero removes the limit" tooltip={CONTROL_HELP.maxBelow} onChange={(value) => updateWeekly({ maxBelowPct: value })} />
          <NumberField large={true} id="max-setups" label="RESULT CAP" value={weekly.maxSetups} min={0} max={1000} unit="rows" hint="Keep only the strongest N setups; zero sends all" tooltip={CONTROL_HELP.resultCap} onChange={(value) => updateWeekly({ maxSetups: value })} />
        </div>

        <div className="mt-9 border-t border-[hsl(var(--beam-ghost))] pt-7">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Toggle checked={weekly.confluenceEnabled} onChange={(checked) => updateWeekly({ confluenceEnabled: checked })} label="Highlight gap × order-block confluence" large />
            </div>
            <InfoTip label="Gap × order-block confluence" text={CONTROL_HELP.confluence} large />
          </div>
          <div className="mt-7 grid gap-8 md:grid-cols-2">
            <NumberField large={true} id="confluence-distance" label="CONFLUENCE DISTANCE" value={weekly.confluencePct} min={0.1} max={50} step={0.1} unit="%" hint="Maximum distance between a gap and bullish order block" tooltip={CONTROL_HELP.confluenceDistance} onChange={(value) => updateWeekly({ confluencePct: value })} />
            <NumberField large={true} id="triple-distance" label="TRIPLE DISTANCE" value={weekly.triplePct} min={0.1} max={50} step={0.1} unit="%" hint="Maximum spread for gap + order block + S/R major zones" tooltip={CONTROL_HELP.tripleDistance} onChange={(value) => updateWeekly({ triplePct: value })} />
          </div>
        </div>

        <div className="mt-9 border-t border-[hsl(var(--beam-ghost))] pt-7">
          <div className="etched mb-3 text-beam-dim">REPEAT SUPPRESSION</div>
          <p className="mb-6 max-w-[68ch] font-mono text-xs leading-relaxed text-beam-dim">
            Skip a symbol and level already emailed to you recently, so a standing level does not repeat every Monday and Friday
          </p>
          <div className="grid gap-8 md:grid-cols-2">
            <NumberField large={true} id="dedup-days" label="DON'T REPEAT WITHIN" value={weekly.dedupDays} min={0} max={3650} unit="days" hint="Re-sends once the window passes; zero repeats every run" tooltip={CONTROL_HELP.dedupDays} onChange={(value) => updateWeekly({ dedupDays: value })} />
            <NumberField large={true} id="dedup-tolerance" label="SAME-LEVEL TOLERANCE" value={weekly.dedupPct} min={0} max={10} step={0.1} unit="%" hint="Levels within this percent count as the same setup" tooltip={CONTROL_HELP.dedupTolerance} onChange={(value) => updateWeekly({ dedupPct: value })} />
          </div>
        </div>

        <div aria-live="polite" className="mt-6 min-h-5 font-mono text-xs">
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : saving ? (
            <span className="text-beam-dim">saving settings…</span>
          ) : status ? (
            <span className="text-beam-mid">{status}</span>
          ) : dirty ? (
            <span className="text-beam-dim">changes pending…</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
