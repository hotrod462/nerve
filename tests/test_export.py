"""Export tests with synthetic (T, 20484) data — no TRIBE."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from nerve.export.npz_io import (
    load_prediction,
    load_subcortical_prediction,
    save_prediction,
    save_subcortical_prediction,
)
from nerve.export.web_bundle import export_web_bundle
from nerve.types import (
    BrainPrediction,
    InferenceMode,
    Modality,
    N_VERTICES_FSAVERAGE5,
    N_VOXELS_SUBCORTICAL,
    StimulusSpec,
    SubcorticalPrediction,
)


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


@pytest.fixture
def synthetic_subcortical(synthetic_prediction: BrainPrediction) -> SubcorticalPrediction:
    rng = np.random.default_rng(43)
    t = synthetic_prediction.data.shape[0]
    data = rng.standard_normal((t, N_VOXELS_SUBCORTICAL)).astype(np.float32) * 0.1
    return SubcorticalPrediction(
        data=data,
        stimulus=synthetic_prediction.stimulus,
        inference_mode=InferenceMode.ACOUSTIC_ONLY,
    )


def test_save_load_subcortical_prediction(
    tmp_path: Path, synthetic_subcortical: SubcorticalPrediction
):
    out = tmp_path / "run"
    save_subcortical_prediction(synthetic_subcortical, out / "prediction_subcortical.npz")
    loaded = load_subcortical_prediction(out / "prediction_subcortical.npz")
    assert loaded.data.shape == synthetic_subcortical.data.shape


def test_save_load_prediction(tmp_path: Path, synthetic_prediction: BrainPrediction):
    out = tmp_path / "run"
    save_prediction(synthetic_prediction, out / "prediction.npz")
    loaded = load_prediction(out / "prediction.npz")
    assert loaded.data.shape == synthetic_prediction.data.shape
    assert loaded.stimulus.id == "synthetic"


def test_export_web_bundle(
    tmp_path: Path,
    synthetic_prediction: BrainPrediction,
    synthetic_subcortical: SubcorticalPrediction,
):
    run_dir = tmp_path / "synthetic_run"
    save_prediction(synthetic_prediction, run_dir / "prediction.npz")
    save_subcortical_prediction(synthetic_subcortical, run_dir / "prediction_subcortical.npz")
    web_dir = export_web_bundle(run_dir, n_parcels=100)

    assert (web_dir / "manifest.json").is_file()
    assert (web_dir / "mesh" / "lh.inflated.gii").is_file()
    assert (web_dir / "mesh" / "rh.inflated.gii").is_file()
    assert (web_dir / "mesh" / "lh.activations.gii").is_file()
    assert (web_dir / "mesh" / "lh.sulc.gii").is_file()
    assert (web_dir / "matrices" / "parcel_time.json").is_file()
    assert (web_dir / "matrices" / "atlas.json").is_file()
    assert (web_dir / "matrices" / "vertex_yeo.json").is_file()
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
    assert labels["atlas"] == "Schaefer2018_Yeo17"
    assert labels["n_regions"] >= 7
    assert len(labels["regions"][0]["anchor"]) == 3

    yeo_edges = json.loads((web_dir / "matrices" / "atlas" / "yeo_lh_edges.json").read_text())
    assert yeo_edges["n_edges"] > 1000
    assert len(yeo_edges["edges"][0]) == 2

    atlas = json.loads((web_dir / "matrices" / "atlas.json").read_text())
    assert atlas["n_parcels"] == 100
    assert len(atlas["yeo_lut"]["labels"]) == 18  # background + 17 networks
    assert len(atlas["parcel_lut"]["labels"]) == 101  # background + 100 parcels

    parcel = json.loads((web_dir / "matrices" / "parcel_time.json").read_text())
    assert parcel["n_parcels"] == 100
    assert len(parcel["data"]) == 100

    engagement = json.loads((web_dir / "matrices" / "engagement.json").read_text())
    assert engagement["n_trs"] == 10
    assert engagement["version"] == 2
    assert engagement["networks"]["Cont"]["headline"] == "Focus"
    assert "subnetworks" in engagement
    assert len(engagement["networks"]["Vis"]["zscore"]) == 10
    assert len(engagement["derived"]["dominant_segments"]) >= 1
    assert len(engagement["derived"]["epoch_segments"]) >= 1

    sub_eng = json.loads((web_dir / "matrices" / "subcortical_engagement.json").read_text())
    assert sub_eng["n_trs"] == 10
    assert sub_eng["regions"]["Hippocampus"]["headline"] == "Memory"
    assert manifest["matrices"]["subcortical_engagement"] == "matrices/subcortical_engagement.json"
    assert manifest["subcortical"]["n_voxels"] == N_VOXELS_SUBCORTICAL
    assert "mesh" in manifest and "subcortical" in manifest["mesh"]
    sub_mesh = manifest["mesh"]["subcortical"]
    assert len(sub_mesh["rois"]) == 7
    for roi in sub_mesh["rois"]:
        assert (web_dir / roi["geometry"]).is_file()
        assert (web_dir / roi["activations"]).is_file()
    assert manifest["matrices"]["engagement"] == "matrices/engagement.json"
    assert manifest["matrices"]["vertex_yeo"] == "matrices/vertex_yeo.json"

    vertex_yeo = json.loads((web_dir / "matrices" / "vertex_yeo.json").read_text())
    assert len(vertex_yeo["lh"]) == 10242
    assert len(vertex_yeo["rh"]) == 10242
