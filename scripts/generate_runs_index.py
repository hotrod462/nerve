#!/usr/bin/env python3
"""Generate runs-index.json for remote (GCS) asset loading."""

from __future__ import annotations

import json
import os
from pathlib import Path


def resolve_outputs_root(repo_root: Path) -> Path:
    raw = os.environ.get("NERVE_OUTPUTS", "data/outputs")
    p = Path(raw)
    if p.is_absolute():
        return p
    return (repo_root / raw.replace("../", "")).resolve()


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    runs_dir = resolve_outputs_root(repo_root) / "runs"
    if not runs_dir.is_dir():
        raise SystemExit(f"Runs directory not found: {runs_dir}")

    entries: list[dict] = []
    for run_dir in sorted(runs_dir.iterdir()):
        if not run_dir.is_dir():
            continue
        manifest_path = run_dir / "web" / "manifest.json"
        if not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        entries.append({"id": run_dir.name, "manifest": manifest})

    out_path = resolve_outputs_root(repo_root) / "runs-index.json"
    payload = {"runs": entries}
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} ({len(entries)} runs)")


if __name__ == "__main__":
    main()
