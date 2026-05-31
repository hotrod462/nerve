"""Subcortical ROI engagement traces for web export."""

from __future__ import annotations

from typing import Any

import numpy as np

from nerve.parcellation.subcortical import (
    SUBCORTICAL_DISPLAY_ORDER,
    SUBCORTICAL_ROI_ORDER,
    aggregate_voxels_to_rois,
)

DISCLAIMER = (
    "Predicted group-average subcortical engagement (in-silico). "
    "Exploratory; not clinical or individual inference."
)

ROI_META: dict[str, dict[str, str]] = {
    "Accumbens": {
        "headline": "Reward",
        "tagline": "Pleasure and wanting",
    },
    "Caudate": {
        "headline": "Anticipation",
        "tagline": "Predictive reward and timing",
    },
    "Putamen": {
        "headline": "Groove",
        "tagline": "Rhythmic motor reward",
    },
    "Pallidum": {
        "headline": "Integration",
        "tagline": "Motor–reward coupling",
    },
    "Amygdala": {
        "headline": "Arousal",
        "tagline": "Emotional salience and tension",
    },
    "Hippocampus": {
        "headline": "Memory",
        "tagline": "Familiarity and episodic context",
    },
    "Thalamus": {
        "headline": "Relay",
        "tagline": "Sensory gating and arousal",
    },
    "Lateral Ventricle": {
        "headline": "Ventricle",
        "tagline": "CSF — not interpretable for music",
    },
}

ACTIVE_Z_THRESHOLD = 0.5


def _zscore(series: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    std = float(series.std())
    if std < eps:
        return np.zeros_like(series)
    return (series - series.mean()) / (std + eps)


def _derivative(z: np.ndarray) -> np.ndarray:
    out = np.zeros_like(z)
    if z.size > 1:
        out[1:] = z[1:] - z[:-1]
    return out


def summarize_trace(z: np.ndarray) -> dict[str, float | int]:
    peak_tr = int(np.argmax(z)) if z.size else 0
    return {
        "mean_z": float(z.mean()) if z.size else 0.0,
        "peak_z": float(z.max()) if z.size else 0.0,
        "peak_tr": peak_tr,
        "active_fraction": float(np.mean(z > ACTIVE_Z_THRESHOLD)) if z.size else 0.0,
    }


def compute_subcortical_engagement(
    voxel_data: np.ndarray,
    *,
    inference_mode: str = "acoustic_only",
    fps: int = 1,
) -> dict[str, Any]:
    """
    Build subcortical_engagement.json from (n_voxels, T) TRIBE subcortical output.
    """
    if voxel_data.ndim != 2:
        raise ValueError(f"expected (n_voxels, T), got {voxel_data.shape}")

    roi_raw = aggregate_voxels_to_rois(voxel_data)
    n_trs = int(voxel_data.shape[1])

    regions: dict[str, Any] = {}
    summaries: dict[str, Any] = {}
    z_traces: dict[str, np.ndarray] = {}

    for i, roi in enumerate(SUBCORTICAL_ROI_ORDER):
        raw = roi_raw[i]
        z = _zscore(raw)
        d = _derivative(z)
        meta = ROI_META[roi]
        z_traces[roi] = z
        regions[roi] = {
            "roi_key": roi,
            "headline": meta["headline"],
            "tagline": meta["tagline"],
            "raw": raw.tolist(),
            "zscore": z.tolist(),
            "derivative": d.tolist(),
        }
        summaries[roi] = summarize_trace(z)

    display_order = SUBCORTICAL_DISPLAY_ORDER
    z_stack = np.stack([z_traces[r] for r in display_order], axis=0)
    dominant = [display_order[i] for i in np.argmax(z_stack, axis=0).tolist()]

    return {
        "version": 1,
        "fps": fps,
        "n_trs": n_trs,
        "atlas": {
            "name": "HarvardOxford",
            "n_voxels": int(voxel_data.shape[0]),
            "n_rois": len(SUBCORTICAL_ROI_ORDER),
        },
        "inference_mode": inference_mode,
        "preprocessing": {
            "aggregate": "mean_over_bilateral_voxels",
            "zscore": "per_roi_within_clip",
        },
        "regions": regions,
        "summaries": summaries,
        "derived": {
            "dominant_roi_tr": dominant,
            "display_order": display_order,
            "roi_order": list(SUBCORTICAL_ROI_ORDER),
        },
        "disclaimer": DISCLAIMER,
    }
