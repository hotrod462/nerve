#!/usr/bin/env python3
"""
Music genre contrast example — driven by stimuli/manifest.yaml and config/contrast_pairs.yaml.

Headline demo: classical (Egmont) vs EDM (Pixabay Forever).

Usage:
  ./scripts/prepare_stimuli.sh
  uv run python examples/music_genre_contrast.py
  uv run python examples/music_genre_contrast.py --pair classical_vs_edm
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import yaml

from nerve.analysis.contrast import compute_contrast
from nerve.backends.tribe_v2 import TribeBackend
from nerve.export.npz_io import save_contrast, save_prediction, write_run_manifest
from nerve.export.web_bundle import export_web_bundle
from nerve.types import Modality, StimulusSpec

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "stimuli" / "manifest.yaml"
PAIRS = REPO / "examples" / "config" / "contrast_pairs.yaml"
OUTPUTS = Path(os.environ.get("NERVE_OUTPUTS", REPO / "data" / "outputs"))


def load_tracks() -> dict[str, dict]:
    with open(MANIFEST, encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    return {t["id"]: t for t in doc["tracks"]}


def predict_track(backend: TribeBackend, track: dict, out_root: Path) -> Path:
    audio = REPO / track["path"]
    if not audio.is_file():
        raise FileNotFoundError(f"Missing {audio} — run ./scripts/prepare_stimuli.sh first")

    run_dir = out_root / track["id"]
    run_dir.mkdir(parents=True, exist_ok=True)

    stimulus = StimulusSpec(
        id=track["id"],
        path=audio,
        modality=Modality.AUDIO,
        genre=track.get("genre"),
        license=track.get("license"),
        source_url=track.get("source_url"),
        user_supplied=track.get("user_supplied", False),
    )
    pred = backend.predict_audio(audio, stimulus=stimulus)
    save_prediction(pred, run_dir / "prediction.npz")
    write_run_manifest(
        run_dir,
        {"stimulus": stimulus.to_dict(), "shape": list(pred.data.shape)},
    )
    export_web_bundle(run_dir)
    print(f"predict + export-web → {run_dir}")
    return run_dir


def run_pair(
    backend: TribeBackend,
    pair: dict,
    tracks: dict[str, dict],
    out_root: Path,
) -> Path:
    run_a = predict_track(backend, tracks[pair["a"]], out_root)
    run_b = predict_track(backend, tracks[pair["b"]], out_root)

    from nerve.export.npz_io import load_prediction

    pred_a = load_prediction(run_a)
    pred_b = load_prediction(run_b)
    contrast = compute_contrast(pred_a, pred_b, window=(5, None))
    contrast_dir = out_root / pair["id"]
    contrast_dir.mkdir(parents=True, exist_ok=True)
    save_contrast(contrast, contrast_dir / "contrast.npz")
    export_web_bundle(contrast_dir)
    print(f"contrast → {contrast_dir}")
    return contrast_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pair", default="classical_vs_edm")
    parser.add_argument("--device", default=os.environ.get("NERVE_DEVICE", "auto"))
    parser.add_argument("--all", action="store_true", help="Run all pairs in contrast_pairs.yaml")
    args = parser.parse_args()

    tracks = load_tracks()
    with open(PAIRS, encoding="utf-8") as f:
        pairs_doc = yaml.safe_load(f)

    cache = REPO / "data" / "features"
    backend = TribeBackend(cache_dir=cache, device=args.device)

    pairs = pairs_doc["pairs"]
    if args.all:
        for pair in pairs:
            run_pair(backend, pair, tracks, OUTPUTS / "runs")
    else:
        pair = next(p for p in pairs if p["id"] == args.pair)
        run_pair(backend, pair, tracks, OUTPUTS / "runs")


if __name__ == "__main__":
    main()
