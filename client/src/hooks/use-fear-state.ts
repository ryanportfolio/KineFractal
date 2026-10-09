// useFearState — where the fear gauge sits right now, per deployed fund.
// Reads fear.nowPct / fear.floorPct from the same report JSONs the /lab pages
// use (cached, one fetch per page load). A fund is "armed" when its Williams
// VIX Fix percentile is at or above its buy floor — the engine's real posture
// today, not a vibe.
import { useEffect, useState } from "react";
import { DEPLOY } from "@/data/fearlab-board";
import { fetchReportCached } from "@/data/lab-data";

export interface FundFear {
  sym: string;
  tf: string;
  tfLabel: string;
  // engine generation of the report these numbers came from; follows the live
  // board ahead of the bundled DEPLOY snapshot after a worker-only flip
  variant: string;
  nowPct: number;
  floorPct: number;
  armed: boolean;
  headroom: number; // pp still below the floor; 0 when armed
  // the fund's live sizing policy (report JSON `fear` block): size =
  // minPct + (maxPct - minPct) * F^power, F = pctile position above the floor
  power: number;
  minPct: number;
  maxPct: number;
}

export interface FearState {
  funds: FundFear[];
  hottest: FundFear | null; // closest to (or deepest past) its floor
  armed: boolean; // any deployed fund at/above its floor
}

export function useFearState(): FearState {
  const [funds, setFunds] = useState<FundFear[]>([]);

  useEffect(() => {
    let live = true;
    Promise.allSettled(
      DEPLOY.map(async (d): Promise<FundFear | null> => {
        const r = await fetchReportCached(d.reportKey);
        const f = r.fear;
        if (!f?.on || f.nowPct == null) return null;
        return {
          sym: d.sym,
          tf: d.tf,
          tfLabel: d.tfLabel,
          variant: r.variant ?? d.variant,
          nowPct: f.nowPct,
          floorPct: f.floorPct,
          armed: f.nowPct >= f.floorPct,
          headroom: Math.max(0, f.floorPct - f.nowPct),
          power: f.power,
          minPct: f.minPct,
          maxPct: f.maxPct,
        };
      }),
    ).then((results) => {
      if (!live) return;
      setFunds(
        results
          .filter((x): x is PromiseFulfilledResult<FundFear | null> => x.status === "fulfilled")
          .map((x) => x.value)
          .filter((x): x is FundFear => x != null),
      );
    });
    return () => { live = false; };
  }, []);

  const hottest = funds.length
    ? [...funds].sort((a, b) => a.headroom - b.headroom || b.nowPct - a.nowPct)[0]
    : null;
  return { funds, hottest, armed: funds.some((f) => f.armed) };
}
