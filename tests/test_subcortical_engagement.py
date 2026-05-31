"""Subcortical engagement tests."""

from __future__ import annotations

import numpy as np

from nerve.analysis.subcortical_engagement import compute_subcortical_engagement
from nerve.parcellation.subcortical import SUBCORTICAL_ROI_ORDER, aggregate_voxels_to_rois
from nerve.types import N_VOXELS_SUBCORTICAL


def test_aggregate_voxels_to_rois():
    rng = np.random.default_rng(0)
    voxels = rng.standard_normal((N_VOXELS_SUBCORTICAL, 6))
    rois = aggregate_voxels_to_rois(voxels)
    assert rois.shape == (len(SUBCORTICAL_ROI_ORDER), 6)


def test_compute_subcortical_engagement():
    rng = np.random.default_rng(1)
    voxels = rng.standard_normal((N_VOXELS_SUBCORTICAL, 10))
    doc = compute_subcortical_engagement(voxels)
    assert doc["version"] == 1
    assert doc["n_trs"] == 10
    assert len(doc["regions"]) == len(SUBCORTICAL_ROI_ORDER)
    assert doc["regions"]["Accumbens"]["headline"] == "Reward"
    assert len(doc["derived"]["dominant_roi_tr"]) == 10
    assert "Lateral Ventricle" not in doc["derived"]["display_order"]
