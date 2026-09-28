// Live FearLab data hooks (TanStack Query) — bucket-backed /api/fearlab/*
// endpoints with the static /fearlab/*.json snapshot as graceful fallback
// (board only; there is no static signals snapshot). Every result exposes the
// server freshness envelope: {live, stale, age_hours}.
//
// - live:      true when the payload came from the bucket API (false = static fallback)
// - stale:     true when the artifact is older than the server's staleness window
// - age_hours: hours since the artifact was generated (null when unknown/static)
import { useQuery } from "@tanstack/react-query";
import {
  fetchBoardLive,
  type Board,
  type LiveMeta,
  type LiveResult,
} from "@/data/lab-data";
import { DEPLOY } from "@/data/fearlab-board";

// ---- signals.v1 (worker artifact contract) ----------------------------------
export type SignalState =
  | "long"
  | "break_pending"
  | "protect_broken"
  | "reclaim_pending"
  | "protect_off";

export interface TriggerBand { l: number; h: number }

export interface SignalCell {
  cell_key: string;
  symbol: string;
  tf: string;
  variant: string;
  state: SignalState;
  price: number;
  trigger_levels: { l1: TriggerBand; l2: TriggerBand; l3: TriggerBand };
  as_of_bar: string | number;
  intents?: unknown[];
}

export interface SignalsLatest {
  schema_version?: string;
  generated?: string;
  engine_tag?: string;
  trading_date: string;
  cells: SignalCell[];
  intents?: unknown[];
}

// Staleness window — matches the server's board threshold (platform/PLAN.md: 36h).
const STALE_AFTER_HOURS = 36;

async function fetchSignalsLatest(): Promise<LiveResult<SignalsLatest>> {
  const r = await fetch("/api/fearlab/signals/latest");
  if (!r.ok) throw new Error(`signals/latest: ${r.status}`);
  const j: any = await r.json();
  const data = (j?.data ?? j) as SignalsLatest;
  if (!data || !Array.isArray(data.cells)) throw new Error("signals/latest: bad payload");
  // The signals route returns the raw signals.v1 artifact (no envelope fields);
  // derive freshness from its `generated` stamp. Envelope fields win if present.
  let age: number | null = typeof j?.age_hours === "number" ? j.age_hours : null;
  if (age == null && data.generated) {
    const t = Date.parse(data.generated);
    if (!Number.isNaN(t)) age = (Date.now() - t) / 3_600_000;
  }
  const meta: LiveMeta = {
    live: j?.live !== false,
    stale: j?.stale === true || (j?.stale === undefined && (age == null || age > STALE_AFTER_HOURS)),
    age_hours: age,
  };
  return { data, meta };
}

const FIVE_MIN = 5 * 60 * 1000;

// ---- hooks ------------------------------------------------------------------
// Board: live API first, static snapshot fallback (inside fetchBoardLive) —
// the query only errors when BOTH sources fail, so consumers can treat
// `board === undefined` as "still loading / totally offline".
export function useBoard() {
  const q = useQuery<LiveResult<Board>>({
    queryKey: ["fearlab", "board"],
    queryFn: fetchBoardLive,
    staleTime: FIVE_MIN,
    retry: 1,
  });
  return {
    board: q.data?.data,
    live: q.data?.meta.live ?? false,
    stale: q.data?.meta.stale ?? false,
    age_hours: q.data?.meta.age_hours ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
  };
}

// Engine label for display copy — the LIVE board's variant set (e.g.
// "v4.2+v4.6", per-cell deploys joined by emit_site.py) with the DEPLOY
// snapshot's per-fund variants joined as a pre-fetch/offline fallback.
// Display must never hardcode a version: the deployed variants change
// without this repo changing (that is how "V3.8 ENGINE" went stale on the
// live site).
const SNAPSHOT_LABEL = Array.from(new Set(DEPLOY.map((d) => d.variant))).sort().join("+");
export function useEngineLabel(): string {
  const { board } = useBoard();
  return board?.variant ?? SNAPSHOT_LABEL;
}

// Latest engine signals — no static fallback exists; isError = feed offline.
// No page consumes this yet; it is here (typed + query-cached) for the design
// session to build on.
export function useSignalsLatest() {
  const q = useQuery<LiveResult<SignalsLatest>>({
    queryKey: ["fearlab", "signals", "latest"],
    queryFn: fetchSignalsLatest,
    staleTime: FIVE_MIN,
    retry: 1,
  });
  return {
    signals: q.data?.data,
    live: q.data?.meta.live ?? false,
    stale: q.data?.meta.stale ?? false,
    age_hours: q.data?.meta.age_hours ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
  };
}
