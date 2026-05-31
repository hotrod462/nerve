#!/usr/bin/env python3
"""Point web/manifest.json stimulus.path at sibling .mp3 when available."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def resolve_outputs_root() -> Path:
    raw = os.environ.get("NERVE_OUTPUTS", "data/outputs")
    p = Path(raw)
    if p.is_absolute():
        return p
    return (REPO_ROOT / raw.replace("../", "")).resolve()


def patch_manifest(manifest_path: Path, dry_run: bool) -> bool:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    stimulus = manifest.get("stimulus")
    if not isinstance(stimulus, dict):
        return False

    path_str = stimulus.get("path")
    if not isinstance(path_str, str) or not path_str.lower().endswith(".wav"):
        return False

    wav = REPO_ROOT / path_str
    if not wav.is_file():
        wav = Path(path_str)
    mp3 = wav.with_suffix(".mp3")
    if not mp3.is_file():
        return False

    try:
        rel = str(mp3.relative_to(REPO_ROOT)).replace("\\", "/")
    except ValueError:
        rel = str(mp3).replace("\\", "/")

    if stimulus.get("path") == rel:
        return False

    if dry_run:
        print(f"  would patch {manifest_path.parent.parent.name}: {path_str} → {rel}")
    else:
        stimulus["path"] = rel
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"  patched {manifest_path.parent.parent.name} → {rel}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Patch web manifests to use MP3 paths")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    runs_dir = resolve_outputs_root() / "runs"
    if not runs_dir.is_dir():
        print(f"No runs directory: {runs_dir}", file=sys.stderr)
        return 1

    patched = 0
    for run_dir in sorted(runs_dir.iterdir()):
        if not run_dir.is_dir():
            continue
        manifest_path = run_dir / "web" / "manifest.json"
        if manifest_path.is_file() and patch_manifest(manifest_path, args.dry_run):
            patched += 1

    print(f"\n{'Would patch' if args.dry_run else 'Patched'} {patched} manifest(s).")
    if patched and not args.dry_run:
        print("Regenerate index: uv run python scripts/generate_runs_index.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
