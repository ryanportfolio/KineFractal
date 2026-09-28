"""Regenerate the website's static FearLab snapshot from the live prod API.

Run from the repo root: ``npm run sync:snapshot`` (fetches cells.py from the
range repo, then runs this script).

The script downloads and validates the board plus every listed combo before it
touches the existing fallback snapshot. It then writes two things atomically:

  * ``client/public/fearlab/*.json`` — the per-combo offline fallback files.
  * ``client/src/data/fearlab-snapshot.generated.json`` — the machine-written
    data the TypeScript ``fearlab-board.ts`` imports (variant, reportKey, the
    featured/full window, and recent per-year rows for each deploy fund). This
    replaces the old hand-copy-from-stdout step, so the snapshot cannot drift
    from what was actually fetched.

The deploy-coverage gate is DERIVED from range's ``fearlab/bridge/cells.py``
``DEPLOY_CELLS`` (the engine-side source of truth), not a hardcoded triple, so a
version flip cannot leave a stale literal here that blocks its own regen — the
exact failure that stranded the site on IWM v4.2 after the v4.7 flip. The path
comes from the ``FEARLAB_CELLS`` env var. When the file is absent the gate
degrades to a structural
"every deployed symbol has a -full- combo" check.
"""
from __future__ import annotations

import copy
from datetime import date
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
from typing import Any, Callable, Optional, TextIO
import urllib.request


BASE = "https://web-production-781bd.up.railway.app/api/fearlab"
WEB = Path(__file__).resolve().parent.parent            # repo root
OUT = WEB / "client" / "public" / "fearlab"
# range's fearlab/bridge/cells.py; scripts/sync-snapshot.mjs fetches it and sets this.
CELLS = Path(os.environ.get("FEARLAB_CELLS", WEB / ".tmp" / "range-src" / "cells.py"))
LIVE_FIELDS = ("live", "stale", "age_hours")
# Canonical fund order for the generated snapshot (DEPLOY array stays stable).
SYM_ORDER = ["SPY", "QQQ", "IWM"]
_UNSET = object()   # "resolve expected cells from cells.py" sentinel


def get(url: str) -> Any:
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode())


def _deploy_cells() -> Optional[dict[str, tuple[str, str]]]:
    """``{sym: (tf, variant)}`` parsed from ``fearlab/bridge/cells.py``
    ``DEPLOY_CELLS`` — the engine-side source of truth the worker also resolves
    at runtime. ``None`` when cells.py is absent (not fetched), so the
    gate degrades to a structural check instead of failing. Import is cheap:
    cells.py's module body only defines dataclasses (strategy is imported lazily
    inside bear helpers, never at module load)."""
    if not CELLS.exists():
        return None
    spec = importlib.util.spec_from_file_location("_deploy_cells_mod", CELLS)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    # Register before exec: cells.py's @dataclass(frozen=True) triggers a
    # KW_ONLY lookup that resolves cls.__module__ via sys.modules, which fails
    # if the module is not registered under its spec name first.
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    out: dict[str, tuple[str, str]] = {}
    for sym, cell in mod.DEPLOY_CELLS.items():
        m = re.match(rf"^fav-{sym.lower()}-(v[\d.]+)-{cell.tf}$", cell.preset)
        out[sym] = (cell.tf, m.group(1) if m else cell.preset)
    return out


def _payload(envelope: Any) -> dict[str, Any]:
    if not isinstance(envelope, dict):
        raise ValueError("live response is not a JSON object")
    raw = envelope.get("data", envelope)
    if not isinstance(raw, dict):
        raise ValueError("live response data is not a JSON object")
    payload = copy.deepcopy(raw)
    for field in LIVE_FIELDS:
        payload.pop(field, None)
    return payload


def _number(value: Any) -> bool:
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value))


def _nullable_number(value: Any) -> bool:
    return value is None or _number(value)


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _validate_board(board: dict[str, Any],
                    expected_cells: Optional[dict[str, tuple[str, str]]]) -> list[str]:
    aux = board.get("aux")
    _require(isinstance(aux, list) and bool(aux), "board aux rows must be nonempty")
    for index, row in enumerate(aux):
        prefix = f"board aux row {index}"
        valid = (isinstance(row, dict)
                 and isinstance(row.get("name"), str) and bool(row["name"])
                 and isinstance(row.get("date"), str) and bool(row["date"])
                 and _number(row.get("ts")) and _number(row.get("warn")))
        _require(valid, f"{prefix} must contain name, date, finite ts, and finite warn")
        try:
            date.fromisoformat(row["date"])
        except ValueError as error:
            raise ValueError(f"{prefix} date must be ISO-8601") from error

    cohorts = board.get("startCohorts")
    _require(isinstance(cohorts, dict), "board lacks startCohorts")
    _require(cohorts.get("basis") == "cohort_flat", "startCohorts basis must be cohort_flat")
    _require(cohorts.get("symbol") == "SPY", "startCohorts symbol must be SPY")
    _require(cohorts.get("tf") == "1d", "startCohorts timeframe must be 1d")
    _require(isinstance(cohorts.get("preset"), str) and bool(cohorts["preset"]),
             "startCohorts preset must be nonempty")
    rows = cohorts.get("rows")
    _require(isinstance(rows, list) and bool(rows), "startCohorts rows must be nonempty")
    years: list[int] = []
    ends: set[date] = set()
    for index, row in enumerate(rows):
        prefix = f"startCohorts row {index}"
        _require(isinstance(row, dict), f"{prefix} must be an object")
        _require(isinstance(row.get("year"), int) and not isinstance(row.get("year"), bool),
                 f"{prefix} lacks year")
        _require(all(isinstance(row.get(field), str) and row[field]
                     for field in ("start", "end")), f"{prefix} lacks dates")
        try:
            start_date = date.fromisoformat(row["start"])
            end_date = date.fromisoformat(row["end"])
        except ValueError as error:
            raise ValueError(f"{prefix} dates must be ISO-8601") from error
        _require(start_date.year == row["year"], f"{prefix} start must match its year")
        _require(start_date <= end_date, f"{prefix} start must not follow end")
        _require(all(_number(row.get(field))
                     for field in ("strategy_pct", "benchmark_pct", "edge_pp")),
                 f"{prefix} lacks normalized returns")
        years.append(row["year"])
        ends.add(end_date)
    _require(years == list(range(years[0], years[-1] + 1)),
             "startCohorts years must be unique, ascending, and contiguous")
    _require(len(ends) == 1, "startCohorts rows must share the latest end date")

    combos = board.get("combos")
    _require(isinstance(combos, list) and bool(combos), "board combos must be nonempty")
    keys: list[str] = []
    deployed: set[tuple[str, str, str]] = set()
    for index, combo in enumerate(combos):
        key = combo.get("key") if isinstance(combo, dict) else None
        _require(isinstance(key, str) and bool(key), f"board combo {index} lacks key")
        keys.append(key)
        deployed.add((combo.get("sym"), combo.get("tf"), combo.get("variant")))
    _require(len(keys) == len(set(keys)), "board combo keys must be unique")

    if expected_cells is not None:
        # Version-pinned gate derived from cells.py DEPLOY_CELLS: every deploy
        # cell the engine declares must be present in the live board at the SAME
        # version. A mismatch means the worker has not republished since the
        # flip (promote prod + wait for the next cron), or cells.py is ahead of
        # what prod serves — either way, do NOT bake a snapshot that disagrees.
        expected = {(sym, tf, var) for sym, (tf, var) in expected_cells.items()}
        missing = sorted(expected - deployed)
        _require(not missing,
                 "live board is missing deploy cell(s) that cells.py DEPLOY_CELLS "
                 f"declares: {missing}. The worker has not republished since the "
                 "flip (promote prod + await the next cron), or cells.py is ahead "
                 "of prod. Re-run once the live board catches up.")
    else:
        full_syms = {c.get("sym") for c in combos
                     if isinstance(c.get("key"), str) and "-full-" in c["key"]}
        _require(bool(full_syms),
                 "board has no -full- combos (nothing to snapshot)")
    return keys


def _validate_report(report: dict[str, Any], expected_key: str) -> None:
    prefix = f"combo {expected_key}"
    _require(report.get("key") == expected_key, f"{prefix} key mismatch")
    _require(report.get("curveBasis") == "cash_flow_adjusted",
             f"{prefix} curveBasis must be cash_flow_adjusted")
    _require(report.get("yearlyBasis") in ("flat", "carried"),
             f"{prefix} yearlyBasis must be flat or carried")

    attribution = report.get("attribution")
    _require(isinstance(attribution, list), f"{prefix} lacks normalized attribution")
    for index, row in enumerate(attribution):
        valid = (isinstance(row, dict)
                 and isinstance(row.get("eng"), str) and bool(row["eng"])
                 and _number(row.get("buys"))
                 and _number(row.get("buy_flow_pct"))
                 and _number(row.get("return_contrib_pp")))
        _require(valid, f"{prefix} attribution row {index} is not normalized")

    recent = report.get("recent")
    _require(isinstance(recent, list), f"{prefix} lacks normalized recent activity")
    for index, row in enumerate(recent):
        valid = (isinstance(row, dict)
                 and _number(row.get("ts")) and _number(row.get("n"))
                 and row.get("side") in ("buy", "sell")
                 and isinstance(row.get("label"), str) and bool(row["label"])
                 and "price" in row and _nullable_number(row["price"])
                 and "account_pct" in row and _nullable_number(row["account_pct"])
                 and "lot_return_pct" in row and _nullable_number(row["lot_return_pct"]))
        _require(valid, f"{prefix} recent row {index} is not normalized")

    window = report.get("window")
    headline = report.get("headline")
    _require(isinstance(window, dict)
             and all(isinstance(window.get(field), str) and window[field]
                     for field in ("start", "end")), f"{prefix} lacks window")
    _require(isinstance(headline, dict), f"{prefix} lacks headline")
    for field in ("ret", "bench_ret", "irr", "bench_irr", "dd"):
        _require(_nullable_number(headline.get(field)), f"{prefix} headline lacks {field}")
    _require(isinstance(headline.get("trades"), int)
             and not isinstance(headline.get("trades"), bool),
             f"{prefix} headline lacks trades")
    _require(isinstance(report.get("sym"), str) and bool(report["sym"]),
             f"{prefix} lacks symbol")
    _require(isinstance(report.get("tf"), str) and bool(report["tf"]),
             f"{prefix} lacks timeframe")
    _require(isinstance(report.get("variant"), str) and bool(report["variant"]),
             f"{prefix} lacks variant")
    yearly = report.get("yearly")
    _require(isinstance(yearly, list), f"{prefix} lacks yearly rows")
    for index, row in enumerate(yearly):
        valid = (isinstance(row, dict)
                 and ("partial" not in row or isinstance(row["partial"], bool))
                 and ("edge" not in row or _nullable_number(row["edge"])))
        _require(valid, f"{prefix} yearly row {index} is invalid")


def _board_combo(report: dict[str, Any], label: str) -> dict[str, Any]:
    """The BoardCombo shape fearlab-board.ts expects (offline fallback numbers)."""
    h = report["headline"]
    w = report["window"]
    return {
        "sym": report["sym"], "tf": report["tf"], "label": label,
        "window": f'{w["start"]}..{w["end"]}',
        "ret": h["ret"], "bench_ret": h["bench_ret"], "irr": h["irr"],
        "bench_irr": h["bench_irr"], "dd": h["dd"], "trades": h["trades"],
    }


def _build_funds(board: dict[str, Any],
                 reports: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Per-deploy-fund snapshot rows: variant, reportKey, featured/full window,
    and the recent per-year rows. One entry per ``-full-`` combo, ordered
    SPY, QQQ, IWM, then anything else."""
    funds: list[dict[str, Any]] = []
    for combo in board["combos"]:
        key = combo["key"]
        if "-full-" not in key:
            continue
        rep = reports[key]
        sym, tf, variant = rep["sym"], rep["tf"], rep["variant"]
        prefix, suffix = f"{sym.lower()}-{tf}-", f"-{variant}"
        years = [_board_combo(reports[f"{prefix}{year}{suffix}"], year)
                 for year in ("2024", "2025", "2026")
                 if f"{prefix}{year}{suffix}" in reports]
        funds.append({
            "sym": sym, "variant": variant, "reportKey": key, "tf": tf,
            "sinceYear": rep["window"]["start"][:4],
            "full": _board_combo(rep, "Full"), "years": years,
        })
    funds.sort(key=lambda f: (SYM_ORDER.index(f["sym"]) if f["sym"] in SYM_ORDER else 99,
                              f["sym"]))
    return funds


def _prune_superseded(board: dict[str, Any], keys: list[str], out_dir: Path) -> int:
    """Delete public/fearlab combo files that a version flip left behind
    (``iwm-1d-*-v4.2.json`` after the v4.7 flip) so the offline fallback can't
    serve a stale generation. Only touches ``<sym>-<tf>-*-v*.json`` for the
    CURRENT deploy syms/tfs plus the legacy ``*-v3.8.json`` sweep — board.json,
    casts/, episodes/ and non-deploy files are untouched."""
    current = set(keys)
    removed = 0
    for sym, tf in {(c["sym"].lower(), c["tf"]) for c in board["combos"]}:
        for path in out_dir.glob(f"{sym}-{tf}-*-v*.json"):
            if path.stem not in current:
                path.unlink()
                removed += 1
    for path in out_dir.glob("*-v3.8.json"):
        if path.exists():
            path.unlink()
            removed += 1
    return removed


def _print_summary(board: dict[str, Any], reports: dict[str, dict[str, Any]],
                   snapshot: dict[str, Any], output: TextIO) -> None:
    print(f'\nsnapshot generated {snapshot["generated"]}', file=output)
    for fund in snapshot["funds"]:
        full = fund["full"]
        print(f'  {fund["sym"]} {fund["tf"]} {fund["variant"]} '
              f'({fund["reportKey"]}): ret {full["ret"]} vs bench {full["bench_ret"]}, '
              f'{len(fund["years"])} recent year row(s)', file=output)

    cohorts = board["startCohorts"]["rows"]
    years = [row["year"] for row in cohorts]
    end = max(cohorts, key=lambda row: row["year"])["end"]
    print(f"start cohorts: {len(cohorts)} ({min(years)}..{max(years)}), end={end}",
          file=output)

    print("\nyears ahead of hold (full window, complete years)", file=output)
    for report in reports.values():
        if "-full-" not in report["key"]:
            continue
        years_complete = [row for row in report["yearly"] if not row.get("partial")]
        ahead = sum(1 for row in years_complete if (row.get("edge") or 0) >= 0)
        print(f"  {report['sym']}: {ahead}/{len(years_complete)} years ahead", file=output)


def regenerate(fetcher: Callable[[str], Any] = get, out_dir: Path = OUT,
               output: TextIO = sys.stdout,
               expected_cells: Any = _UNSET,
               snapshot_path: Optional[Path] = None) -> None:
    """Fetch, validate, then replace the static snapshot.

    ``expected_cells`` defaults to the live ``cells.py`` deploy set; tests inject
    an explicit dict (or ``None`` for the structural gate). ``snapshot_path``
    defaults to ``<out_dir>/../../src/data/fearlab-snapshot.generated.json`` so a
    test writing to a temp public/ dir never rewrites the real src file."""
    board = _payload(fetcher(f"{BASE}/board"))
    expected = _deploy_cells() if expected_cells is _UNSET else expected_cells
    keys = _validate_board(board, expected)

    reports: dict[str, dict[str, Any]] = {}
    for key in keys:
        report = _payload(fetcher(f"{BASE}/combo/{key}"))
        _validate_report(report, key)
        reports[key] = report

    # No filesystem mutation is allowed above this line. A stale/partial live
    # publish must never replace a known-good offline fallback.
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "board.json").write_text(
        json.dumps(board, separators=(",", ":")), encoding="utf-8")
    for key, report in reports.items():
        (out_dir / f"{key}.json").write_text(
            json.dumps(report, separators=(",", ":")), encoding="utf-8")

    # Machine-written data for fearlab-board.ts. Path derives from out_dir so a
    # test pointed at a temp public/ dir keeps its generated JSON isolated too.
    if snapshot_path is None:
        snapshot_path = out_dir.parent.parent / "src" / "data" / "fearlab-snapshot.generated.json"
    snapshot_path = Path(snapshot_path)
    snapshot = {"generated": str(board.get("generated", ""))[:10],
                "funds": _build_funds(board, reports)}
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    snapshot_path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")

    removed = _prune_superseded(board, keys, out_dir)

    print(f"board: {len(keys)} combos, variant={board.get('variant')}, "
          f"generated={board.get('generated')}", file=output)
    print(f"wrote {len(reports)} combo files + {snapshot_path.name}", file=output)
    print(f"removed {removed} superseded file(s)", file=output)
    _print_summary(board, reports, snapshot, output)


def main() -> None:
    regenerate()


if __name__ == "__main__":
    main()
