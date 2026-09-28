#!/usr/bin/env python
"""Emit the hero terminal's real-data cast asset.

Reads REAL fearlab engine output from the `range` repo (the v3.8 dashboard
payload + a captured vnext/scan.py run) and writes a trimmed JSON the v6
<RealTerminal/> hero widget replays. NOTHING runs at request time on the site —
this bakes genuine numbers/output into a static asset, exactly like the existing
client/public/fearlab/*.json reports.

Usage (run from anywhere; paths resolve off this file's repo):
  py scripts/emit_cast.py
  RANGE_FEARLAB=/path/to/range/fearlab py scripts/emit_cast.py

Source of truth:
  <RANGE>/dashboard/data-spy-1d-full-v3.8.js   full v3.8 payload (trades/equity/yearly/metrics)
  <RANGE>/vnext/scan.py                         the real script source (typewritten on screen)
  .tmp/scan-spy-1d.txt                          captured `py vnext/scan.py SPY 1d` stdout (UTF-8)

P3 will move this into range's EOD refresh so the cast stays fresh.
"""
import json, os, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # v6 repo root (worktree)
RANGE = os.environ.get("RANGE_FEARLAB", r"C:/Users/Home/CoreWise/range/fearlab")
DASH = os.path.join(RANGE, "dashboard")
KEY = "spy-1d-full-v3.8"
OUT = os.path.join(REPO, "client", "public", "fearlab", "casts", "spy-1d-v3.8.json")
SCAN_TXT = os.path.join(REPO, ".tmp", "scan-spy-1d.txt")
EQ_POINTS = 200  # downsample target for the ASCII equity curve

# Ambient backdrop: thousands of lines of the REAL engine source the hero streams
# as a living texture. Order = most representative first; capped so the DOM stays
# light. These are genuine fearlab modules, not filler.
CORPUS_OUT = os.path.join(REPO, "client", "public", "fearlab", "casts", "corpus.txt")
CORPUS_FILES = ["strategy.py", "supertrend.py", "broker.py", "data.py", "divstrat.py",
                "vnext/edge.py", "vnext/year_table.py", "vnext/robust.py",
                "vnext/trace.py", "vnext/scan.py"]
MAX_CORPUS_LINES = 4500


def load_reg(path):
    txt = open(path, encoding="utf-8").read()
    j = txt.index("]={")  # payload starts at the '{' of  ...["key"]={...}
    return json.loads(txt[j + 2:].strip().rstrip(";").strip())


def r2(x):
    return round(x, 2) if isinstance(x, (int, float)) else x


def main():
    p = load_reg(os.path.join(DASH, f"data-{KEY}.js"))
    meta, m = p["meta"], p["metrics"]

    # --- captured real scan stdout (sanitize any redirect mojibake -> em dash) ---
    scan = ""
    if os.path.exists(SCAN_TXT):
        scan = open(SCAN_TXT, encoding="utf-8", errors="replace").read()
        scan = scan.replace("�", "—").rstrip("\n")
    else:
        print(f"WARN: {SCAN_TXT} missing — scan section will be empty", file=sys.stderr)

    # --- real script source (typewritten on screen) ---
    src = open(os.path.join(RANGE, "vnext", "scan.py"), encoding="utf-8").read().rstrip("\n")

    # --- per-year table: [year, strat%, bench%, edge, partial] ---
    years = [[y["y"], r2(y["spct"]), r2(y["bpct"]), r2(y["edge"]), 1 if y.get("partial") else 0]
             for y in p["yearly"]]
    neg_years = sum(1 for y in p["yearly"] if y["spct"] < 0)
    edge_pos = sum(1 for y in p["yearly"] if y["edge"] > 0)

    # --- closed-trade ledger (compact): [e_ts, x_ts, eng, tag, entry, exit, pct, pnl] ---
    fills = [[t["e_ts"], t["x_ts"], t["eng"], t["tag"],
              r2(t["entry"]), r2(t["exit"]), r2(t["pct"]), r2(t["pnl"])]
             for t in p["trades"]]

    # --- equity curve downsampled to ~EQ_POINTS: [t, strat, bench] (indexed to 1000) ---
    eq, bn = p["equity"], p["bench"]
    n = len(eq)
    step = max(1, n // EQ_POINTS)
    idxs = list(range(0, n, step))
    if idxs[-1] != n - 1:
        idxs.append(n - 1)
    equity = [[eq[i]["time"], round(eq[i]["value"]), round(bn[i]["value"])] for i in idxs]

    cast = {
        "schema": 1,
        "meta": {
            "sym": meta["symbol"], "tf": meta["tf"], "variant": "v3.8",
            "label": "Full", "window": f'{meta["start"]}..{meta["end"]}',
            "start": meta["start"], "end": meta["end"], "generated": meta["generated"],
        },
        "command": "py vnext/scan.py SPY 1d",
        "source": {"file": "vnext/scan.py", "code": src},
        "scan": scan,
        "metrics": {
            "trades": m["sell_fills"], "irr": r2(m["irr_pct"]), "bench_irr": r2(m["bench_irr_pct"]),
            "ret": r2(m["net_pct_on_money_in"]), "bench_ret": r2(m["bench_net_pct_on_money_in"]),
            "board_edge": r2(m["net_pct_on_money_in"] - m["bench_net_pct_on_money_in"]),
            "max_dd": r2(m["max_dd_pct"]), "bench_max_dd": r2(m["bench_max_dd_pct"]),
            "profit_factor": r2(m["profit_factor"]), "win_rate": r2(m["realized_win_rate_pct"]),
            "final_equity": round(m["final_equity"]), "money_in": round(m["money_in"]),
            "realized": round(m["realized_pnl"]), "exposure_avg": r2(m["exposure_avg_pct"]),
            "net_pnl": round(m["net_pnl"]),
        },
        "stress": {
            "profit_factor": r2(m["profit_factor"]), "win_rate": r2(m["realized_win_rate_pct"]),
            "max_dd": r2(m["max_dd_pct"]), "neg_years": neg_years,
            "edge_pos_years": edge_pos, "total_years": len(years),
        },
        "years": years,
        "fills": fills,
        "equity": equity,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(cast, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(OUT)
    print(f"wrote {OUT}  ({size/1024:.1f} KB)")
    print(f"  trades={len(fills)} years={len(years)} equity_pts={len(equity)} "
          f"edge_pos={edge_pos}/{len(years)} neg_years={neg_years} scan_chars={len(scan)}")

    # --- ambient code corpus ---
    parts = []
    for rel in CORPUS_FILES:
        fp = os.path.join(RANGE, *rel.split("/"))
        if not os.path.exists(fp):
            print(f"  WARN corpus file missing: {rel}", file=sys.stderr)
            continue
        body = open(fp, encoding="utf-8").read().rstrip("\n")
        parts.append(f"# {'=' * 10} {rel} {'=' * 10}\n{body}")
    corpus_lines = "\n\n\n".join(parts).split("\n")[:MAX_CORPUS_LINES]
    with open(CORPUS_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(corpus_lines))
    print(f"wrote {CORPUS_OUT}  ({os.path.getsize(CORPUS_OUT)/1024:.1f} KB, {len(corpus_lines)} lines)")


if __name__ == "__main__":
    main()
