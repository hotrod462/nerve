#!/usr/bin/env python3
"""Batch engagement analysis across exported runs → CSV summaries."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

from nerve.analysis.engagement import parse_dominant_segments

REPO = Path(__file__).resolve().parents[1]
DEFAULT_RUNS = REPO / "data" / "outputs" / "runs"
DEFAULT_OUT = REPO / "data" / "outputs" / "engagement_analysis"


def _load_engagement(path: Path) -> dict | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _network_fractions(dominant: list[str]) -> dict[str, float]:
    if not dominant:
        return {}
    counts = Counter(dominant)
    n = len(dominant)
    return {net: counts[net] / n for net in counts}


def _mean_coupling(doc: dict) -> dict[str, float]:
    out: dict[str, float] = {}
    for key, payload in doc.get("derived", {}).get("coupling", {}).items():
        series = payload.get("series") or []
        if series:
            out[key] = sum(series) / len(series)
    return out


def analyze_run(run_dir: Path) -> dict[str, object] | None:
    engagement_path = run_dir / "web" / "matrices" / "engagement.json"
    doc = _load_engagement(engagement_path)
    if doc is None:
        return None

    run_id = run_dir.name
    dominant = doc.get("derived", {}).get("dominant_network_tr") or []
    segments = doc.get("derived", {}).get("dominant_segments") or parse_dominant_segments(
        dominant
    )
    summaries = doc.get("summaries") or {}
    fractions = _network_fractions(dominant)
    coupling = _mean_coupling(doc)

    longest = max(segments, key=lambda s: s.get("duration_s", 0), default=None)
    top_net = max(fractions, key=fractions.get) if fractions else ""

    row: dict[str, object] = {
        "run_id": run_id,
        "n_trs": doc.get("n_trs", 0),
        "n_segments": len(segments),
        "top_network": top_net,
        "top_network_fraction": round(fractions.get(top_net, 0.0), 4) if top_net else 0.0,
        "longest_segment_net": longest.get("net", "") if longest else "",
        "longest_segment_start_s": longest.get("start_tr", "") if longest else "",
        "longest_segment_end_s": longest.get("end_tr", "") if longest else "",
        "longest_segment_duration_s": longest.get("duration_s", "") if longest else "",
    }

    for net in doc.get("networks", {}):
        summary = summaries.get(net, {})
        row[f"{net}_active_fraction"] = round(float(summary.get("active_fraction", 0.0)), 4)
        row[f"{net}_peak_tr"] = summary.get("peak_tr", "")
        row[f"{net}_peak_z"] = round(float(summary.get("peak_z", 0.0)), 4)

    for key, val in coupling.items():
        row[f"coupling_{key}"] = round(val, 4)

    return row


def write_segments_csv(run_dir: Path, out_path: Path) -> bool:
    engagement_path = run_dir / "web" / "matrices" / "engagement.json"
    doc = _load_engagement(engagement_path)
    if doc is None:
        return False

    segments = doc.get("derived", {}).get("dominant_segments") or parse_dominant_segments(
        doc.get("derived", {}).get("dominant_network_tr") or []
    )
    networks = doc.get("networks") or {}

    epoch_segments = doc.get("derived", {}).get("epoch_segments") or []
    epoch_by_key = {
        (str(s.get("net", "")), s.get("start_tr"), s.get("end_tr")): s.get("template")
        for s in epoch_segments
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "run_id",
                "net",
                "headline",
                "start_tr",
                "end_tr",
                "duration_s",
                "epoch_template",
                "epoch_score",
            ],
        )
        writer.writeheader()
        for seg in segments:
            net = str(seg.get("net", ""))
            key = (net, seg.get("start_tr"), seg.get("end_tr"))
            template = epoch_by_key.get(key) or {}
            writer.writerow(
                {
                    "run_id": run_dir.name,
                    "net": net,
                    "headline": networks.get(net, {}).get("headline", net),
                    "start_tr": seg.get("start_tr", ""),
                    "end_tr": seg.get("end_tr", ""),
                    "duration_s": seg.get("duration_s", ""),
                    "epoch_template": template.get("label", "") if template else "",
                    "epoch_score": template.get("score", "") if template else "",
                }
            )
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze engagement.json across runs")
    parser.add_argument(
        "--runs",
        type=Path,
        default=DEFAULT_RUNS,
        help="Directory containing run subfolders",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Output directory for CSV files",
    )
    parser.add_argument(
        "--run-id",
        action="append",
        dest="run_ids",
        help="Limit to specific run id(s); repeatable",
    )
    args = parser.parse_args()

    runs_root: Path = args.runs
    if not runs_root.is_dir():
        print(f"Runs directory not found: {runs_root}", file=sys.stderr)
        return 1

    run_dirs = sorted(p for p in runs_root.iterdir() if p.is_dir())
    if args.run_ids:
        wanted = set(args.run_ids)
        run_dirs = [p for p in run_dirs if p.name in wanted]

    rows: list[dict[str, object]] = []
    for run_dir in run_dirs:
        row = analyze_run(run_dir)
        if row:
            rows.append(row)
            write_segments_csv(run_dir, args.out / f"{run_dir.name}_segments.csv")

    if not rows:
        print("No engagement.json files found. Re-run export-web on your runs.", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    summary_path = args.out / "engagement_summary.csv"

    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)

    with summary_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {summary_path} ({len(rows)} runs)")
    print(f"Per-run segment CSVs → {args.out}/<run_id>_segments.csv")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
