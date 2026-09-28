"""Focused tests for the static FearLab snapshot regenerator."""
from __future__ import annotations

import importlib.util
import copy
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = pathlib.Path(__file__).with_name("regen_fearlab_snapshot.py")

# The deploy set the fixtures below encode. Injected explicitly so the version
# gate is tested against fixed data, decoupled from the real cells.py (which
# moves with every live flip).
EXPECTED = {"SPY": ("1d", "v4.6"), "QQQ": ("1d", "v4.2"), "IWM": ("1d", "v4.2")}


def load_module():
    spec = importlib.util.spec_from_file_location("regen_fearlab_snapshot", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def cohort_board(keys):
    return {
        "data": {
            "generated": "2026-07-12T12:00:00Z",
            "aux": [{"name": "HYG daily", "date": "2026-07-10",
                     "ts": 1783641600, "warn": 7}],
            "combos": [
                {"key": key, "sym": key.split("-")[0].upper(), "tf": "1d",
                 "variant": key.rsplit("-", 1)[1]}
                for key in keys
            ],
            "startCohorts": {
                "basis": "cohort_flat", "symbol": "SPY", "tf": "1d",
                "preset": "fav-spy-v4.6-1d",
                "rows": [
                    {"year": 2025, "start": "2025-01-02", "end": "2026-07-10",
                     "strategy_pct": 20.0, "benchmark_pct": 15.0, "edge_pp": 5.0},
                    {"year": 2026, "start": "2026-01-02", "end": "2026-07-10",
                     "strategy_pct": 10.0, "benchmark_pct": 8.0, "edge_pp": 2.0},
                ],
            },
        },
        "live": True, "stale": False, "age_hours": 0.1,
    }


def normalized_report(key):
    sym = key.split("-")[0].upper()
    variant = key.rsplit("-", 1)[1]
    return {
        "data": {
            "key": key, "sym": sym, "tf": "1d", "variant": variant,
            "window": {"start": "2025-01-02", "end": "2026-07-10"},
            "headline": {"ret": 20.0, "bench_ret": 15.0, "irr": 10.0,
                         "bench_irr": 8.0, "dd": -5.0, "trades": 3},
            "fear": {}, "curveBasis": "cash_flow_adjusted", "yearlyBasis": "flat",
            "attribution": [{"eng": "Fav", "buys": 1, "buy_flow_pct": 100.0,
                             "return_contrib_pp": 5.0}],
            "recent": [{"ts": 1, "side": "buy", "label": "Fear buy", "n": 1,
                        "price": 100.0, "account_pct": 10.0,
                        "lot_return_pct": None}],
            "yearly": [],
        },
        "live": True, "stale": False, "age_hours": 0.1,
    }


class SnapshotScriptTests(unittest.TestCase):
    def test_import_does_not_fetch_from_the_network(self):
        with patch("urllib.request.urlopen", side_effect=AssertionError("network called on import")):
            load_module()

    def test_old_contracts_are_rejected_before_any_file_is_written_or_deleted(self):
        module = load_module()
        keys = ["spy-1d-full-v4.6", "qqq-1d-full-v4.2", "iwm-1d-full-v4.2"]
        valid = {
            "/board": cohort_board(keys),
            "/combo/spy-1d-full-v4.6": normalized_report(keys[0]),
            "/combo/qqq-1d-full-v4.2": normalized_report(keys[1]),
            "/combo/iwm-1d-full-v4.2": normalized_report(keys[2]),
        }
        cases = {
            "null aux": lambda r: r["/board"]["data"].update(
                {"aux": [{"name": "missing", "date": None, "ts": None, "warn": 7}]}),
            "missing deployed fund": lambda r: (
                r["/board"]["data"].update(
                    {"combos": r["/board"]["data"]["combos"][:-1]}),
                r.pop("/combo/iwm-1d-full-v4.2")),
            "missing start cohorts": lambda r: r["/board"]["data"].pop("startCohorts"),
            "wrong cohort identity": lambda r: r["/board"]["data"]["startCohorts"].update(
                {"basis": "carried", "symbol": "QQQ", "tf": "2h"}),
            "empty cohorts": lambda r: r["/board"]["data"]["startCohorts"].update({"rows": []}),
            "gapped cohorts": lambda r: r["/board"]["data"]["startCohorts"]["rows"][1].update(
                {"year": 2027, "start": "2027-01-02"}),
            "duplicate cohorts": lambda r: r["/board"]["data"]["startCohorts"]["rows"][1].update(
                {"year": 2025, "start": "2025-01-03"}),
            "mismatched cohort ends": lambda r: r["/board"]["data"]["startCohorts"]["rows"][0].update(
                {"end": "2026-07-09"}),
            "old curve": lambda r: r["/combo/qqq-1d-full-v4.2"]["data"].pop("curveBasis"),
            "unknown yearly basis": lambda r: r["/combo/qqq-1d-full-v4.2"]["data"].update(
                {"yearlyBasis": "monthly"}),
            "old attribution": lambda r: r["/combo/qqq-1d-full-v4.2"]["data"]["attribution"][0].pop(
                "buy_flow_pct"),
            "nonfinite attribution": lambda r: r["/combo/qqq-1d-full-v4.2"]["data"]["attribution"][0].update(
                {"buy_flow_pct": float("nan")}),
            "old recent": lambda r: r["/combo/qqq-1d-full-v4.2"]["data"]["recent"][0].pop(
                "account_pct"),
            "malformed yearly rows": lambda r: r["/combo/qqq-1d-full-v4.2"]["data"].update(
                {"yearly": [None]}),
        }

        for label, make_old in cases.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as tmp:
                responses = copy.deepcopy(valid)
                make_old(responses)

                def fetch(url):
                    return responses[next(path for path in responses if url.endswith(path))]

                out = pathlib.Path(tmp)
                (out / "board.json").write_text("sentinel", encoding="utf-8")
                (out / "old-v3.8.json").write_text("keep", encoding="utf-8")

                with self.assertRaises(ValueError):
                    module.regenerate(fetch, out, io.StringIO(), expected_cells=EXPECTED)

                self.assertEqual((out / "board.json").read_text(encoding="utf-8"), "sentinel")
                self.assertEqual((out / "old-v3.8.json").read_text(encoding="utf-8"), "keep")
                self.assertFalse((out / f"{keys[0]}.json").exists())

    def test_normalized_snapshot_and_generated_json_are_written(self):
        module = load_module()
        keys = ["spy-1d-full-v4.6", "spy-1d-2026-v4.6",
                "qqq-1d-full-v4.2", "iwm-1d-full-v4.2"]
        responses = {"/board": cohort_board(keys)}
        responses.update({f"/combo/{key}": normalized_report(key) for key in keys})

        def fetch(url):
            return responses[next(path for path in responses if url.endswith(path))]

        with tempfile.TemporaryDirectory() as tmp:
            # Mirror the real client/public/fearlab layout so the derived
            # generated-JSON path (out/../../src/data) also lands inside tmp.
            out = pathlib.Path(tmp) / "client" / "public" / "fearlab"
            out.mkdir(parents=True)
            (out / "old-v3.8.json").write_text("old", encoding="utf-8")
            stdout = io.StringIO()
            module.regenerate(fetch, out, stdout, expected_cells=EXPECTED)

            saved_board = json.loads((out / "board.json").read_text(encoding="utf-8"))
            self.assertNotIn("live", saved_board)
            self.assertNotIn("stale", saved_board)
            self.assertNotIn("age_hours", saved_board)
            self.assertFalse((out / "old-v3.8.json").exists())
            self.assertTrue(all((out / f"{key}.json").exists() for key in keys))

            snap_path = out.parent.parent / "src" / "data" / "fearlab-snapshot.generated.json"
            snap = json.loads(snap_path.read_text(encoding="utf-8"))
            self.assertEqual(snap["generated"], "2026-07-12")
            self.assertEqual([f["sym"] for f in snap["funds"]], ["SPY", "QQQ", "IWM"])
            spy = next(f for f in snap["funds"] if f["sym"] == "SPY")
            self.assertEqual(spy["variant"], "v4.6")
            self.assertEqual(spy["reportKey"], "spy-1d-full-v4.6")
            self.assertEqual(spy["tf"], "1d")
            self.assertEqual(spy["full"]["label"], "Full")
            self.assertEqual([y["label"] for y in spy["years"]], ["2026"])

            summary = stdout.getvalue()
            self.assertIn("snapshot generated 2026-07-12", summary)
            self.assertIn("start cohorts: 2 (2025..2026), end=2026-07-10", summary)

    def test_version_pin_flags_a_flip_prod_has_not_published(self):
        """cells.py declares IWM v4.7 but the live board still serves v4.2 ->
        refuse (do not bake a snapshot that disagrees with the engine)."""
        module = load_module()
        keys = ["spy-1d-full-v4.6", "qqq-1d-full-v4.2", "iwm-1d-full-v4.2"]
        responses = {"/board": cohort_board(keys)}
        responses.update({f"/combo/{key}": normalized_report(key) for key in keys})

        def fetch(url):
            return responses[next(path for path in responses if url.endswith(path))]

        ahead = {"SPY": ("1d", "v4.6"), "QQQ": ("1d", "v4.2"), "IWM": ("1d", "v4.7")}
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / "client" / "public" / "fearlab"
            out.mkdir(parents=True)
            with self.assertRaises(ValueError):
                module.regenerate(fetch, out, io.StringIO(), expected_cells=ahead)

    def test_structural_gate_accepts_any_version_when_cells_absent(self):
        module = load_module()
        keys = ["spy-1d-full-v4.6", "iwm-1d-full-v4.9"]
        responses = {"/board": cohort_board(keys)}
        responses.update({f"/combo/{key}": normalized_report(key) for key in keys})

        def fetch(url):
            return responses[next(path for path in responses if url.endswith(path))]

        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / "client" / "public" / "fearlab"
            out.mkdir(parents=True)
            module.regenerate(fetch, out, io.StringIO(), expected_cells=None)
            self.assertTrue((out / "spy-1d-full-v4.6.json").exists())
            self.assertTrue((out / "iwm-1d-full-v4.9.json").exists())

    def test_deploy_cells_parses_the_engine_source_of_truth(self):
        module = load_module()
        cells = module._deploy_cells()
        if cells is None:
            self.skipTest("cells.py not fetched (set FEARLAB_CELLS or run npm run sync:snapshot first)")
        self.assertEqual(set(cells), {"SPY", "QQQ", "IWM"})
        for _sym, (tf, variant) in cells.items():
            self.assertEqual(tf, "1d")
            self.assertRegex(variant, r"^v\d+(\.\d+)?$")


if __name__ == "__main__":
    unittest.main(verbosity=2)
