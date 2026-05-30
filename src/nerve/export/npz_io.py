"""Save/load BrainPrediction and ContrastResult as .npz artifacts."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from nerve.types import BrainPrediction, ContrastResult, InferenceMode, Modality, StimulusSpec


def save_prediction(pred: BrainPrediction, path: str | Path) -> Path:
    path = Path(path)
    if path.suffix != ".npz":
        path = path / "prediction.npz"
    path.parent.mkdir(parents=True, exist_ok=True)

    stim = pred.stimulus.to_dict()
    meta = dict(pred.metadata)
    if meta.get("device_report") and hasattr(meta["device_report"], "to_dict"):
        meta["device_report"] = meta["device_report"].to_dict()

    np.savez_compressed(
        path,
        data=pred.data,
        inference_mode=pred.inference_mode.value,
        tr=pred.tr,
        space=pred.space,
        stimulus_json=json.dumps(stim),
        metadata_json=json.dumps(meta),
    )
    return path


def load_prediction(path: str | Path) -> BrainPrediction:
    path = Path(path)
    if path.is_dir():
        path = path / "prediction.npz"
    with np.load(path, allow_pickle=False) as z:
        stim = json.loads(str(z["stimulus_json"]))
        meta = json.loads(str(z["metadata_json"]))
        return BrainPrediction(
            data=z["data"],
            stimulus=StimulusSpec(
                id=stim["id"],
                path=stim["path"],
                modality=Modality(stim.get("modality", "audio")),
                genre=stim.get("genre"),
                license=stim.get("license"),
                source_url=stim.get("source_url"),
                user_supplied=stim.get("user_supplied", False),
                metadata=stim.get("metadata", {}),
            ),
            inference_mode=InferenceMode(str(z["inference_mode"])),
            tr=float(z["tr"]),
            space=str(z["space"]),
            metadata=meta,
        )


def save_contrast(contrast: ContrastResult, path: str | Path) -> Path:
    path = Path(path)
    if path.suffix != ".npz":
        path = path / "contrast.npz"
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path,
        vertex_map=contrast.vertex_map,
        stimulus_a_id=contrast.stimulus_a_id,
        stimulus_b_id=contrast.stimulus_b_id,
        metadata_json=json.dumps(contrast.metadata),
    )
    return path


def load_contrast(path: str | Path) -> ContrastResult:
    path = Path(path)
    if path.is_dir():
        path = path / "contrast.npz"
    with np.load(path, allow_pickle=False) as z:
        return ContrastResult(
            vertex_map=z["vertex_map"],
            stimulus_a_id=str(z["stimulus_a_id"]),
            stimulus_b_id=str(z["stimulus_b_id"]),
            metadata=json.loads(str(z["metadata_json"])),
        )


def write_run_manifest(run_dir: Path, manifest: dict) -> Path:
    run_dir.mkdir(parents=True, exist_ok=True)
    out = run_dir / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return out
