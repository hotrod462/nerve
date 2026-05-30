"""Export tests with synthetic (T, 20484) data — no TRIBE."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from nerve.export.npz_io import load_prediction, save_prediction
from nerve.export.web_bundle import export_web_bundle
from nerve.types import BrainPrediction, InferenceMode, Modality, N_VERTICES_FSAVERAGE5, StimulusSpec


@pytest.fixture
def synthetic_prediction() -> BrainPrediction:
    rng = np.random.default_rng(42)
    t, v = 10, N_VERTICES_FSAVERAGE5
    data = rng.standard_normal((t, v)).astype(np.float32) * 0.1
    return BrainPrediction(
        data=data,
        stimulus=StimulusSpec(id="synthetic", path="test.wav", modality=Modality.AUDIO),
        inference_mode=InferenceMode.ACOUSTIC_ONLY,
        metadata={
            "device_report": {
                "requested": "cpu",
                "resolved": "cpu",
                "mps_available": False,
                "mps_built": False,
                "fallback_env": False,
                "modules": {},
                "device_ok": True,
            }
        },
    )


def test_save_load_prediction(tmp_path: Path, synthetic_prediction: BrainPrediction):
    out = tmp_path / "run"
    save_prediction(synthetic_prediction, out / "prediction.npz")
    loaded = load_prediction(out / "prediction.npz")
    assert loaded.data.shape == synthetic_prediction.data.shape
    assert loaded.stimulus.id == "synthetic"


def test_export_web_bundle(tmp_path: Path, synthetic_prediction: BrainPrediction):
    run_dir = tmp_path / "synthetic_run"
    save_prediction(synthetic_prediction, run_dir / "prediction.npz")
    web_dir = export_web_bundle(run_dir, n_parcels=100)

    assert (web_dir / "manifest.json").is_file()
    assert (web_dir / "mesh" / "lh.inflated.gii").is_file()
    assert (web_dir / "mesh" / "rh.inflated.gii").is_file()
    assert (web_dir / "mesh" / "lh.activations.gii").is_file()
    assert (web_dir / "mesh" / "lh.sulc.gii").is_file()
    assert (web_dir / "matrices" / "parcel_time.json").is_file()
    assert (web_dir / "matrices" / "atlas.json").is_file()
    assert (web_dir / "mesh" / "lh.parcels.gii").is_file()
    assert (web_dir / "mesh" / "lh.yeo.gii").is_file()

    assert (web_dir / "matrices" / "atlas" / "yeo_lh_edges.json").is_file()
    assert (web_dir / "matrices" / "atlas" / "parcels_lh_edges.json").is_file()

    manifest = json.loads((web_dir / "manifest.json").read_text())
    assert manifest["T"] == 10
    assert manifest["n_vertices"] == N_VERTICES_FSAVERAGE5
    assert manifest["default_surface"] == "pial"
    assert "activations" in manifest["mesh"]
    assert "atlas" in manifest["mesh"]
    assert manifest["mesh"]["atlas"]["lut"] == "matrices/atlas.json"
    assert "borders" in manifest["mesh"]["atlas"]
    assert "region_labels" in manifest["mesh"]["atlas"]

    assert (web_dir / "matrices" / "atlas" / "labels_lh.json").is_file()

    labels = json.loads((web_dir / "matrices" / "atlas" / "labels_lh.json").read_text())
    assert labels["atlas"] == "Schaefer2018_Yeo7"
    assert labels["n_regions"] == 7
    assert len(labels["regions"][0]["anchor"]) == 3

    yeo_edges = json.loads((web_dir / "matrices" / "atlas" / "yeo_lh_edges.json").read_text())
    assert yeo_edges["n_edges"] > 1000
    assert len(yeo_edges["edges"][0]) == 2

    atlas = json.loads((web_dir / "matrices" / "atlas.json").read_text())
    assert atlas["n_parcels"] == 100
    assert len(atlas["yeo_lut"]["labels"]) == 8  # background + 7 networks
    assert len(atlas["parcel_lut"]["labels"]) == 101  # background + 100 parcels

    parcel = json.loads((web_dir / "matrices" / "parcel_time.json").read_text())
    assert parcel["n_parcels"] == 100
    assert len(parcel["data"]) == 100
