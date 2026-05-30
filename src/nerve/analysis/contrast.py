"""Contrast maps between two BrainPredictions."""

from __future__ import annotations

from typing import Any

import numpy as np

from nerve.preprocess.hemodynamic import stable_window_slice
from nerve.types import BrainPrediction, ContrastResult


def compute_contrast(
    pred_a: BrainPrediction,
    pred_b: BrainPrediction,
    window: tuple[int | None, int | None] = (5, None),
    aggregate: bool = False,
) -> ContrastResult:
    """
    Vertex-wise A − B.

    window: TR slice (start, end); default skips first ~5 TRs for hemodynamic lag.
    aggregate: if True, return mean contrast over window as (20484,).
    """
    if pred_a.data.shape[1] != pred_b.data.shape[1]:
        raise ValueError("Predictions must share vertex dimension")

    n_tr = min(pred_a.data.shape[0], pred_b.data.shape[0])
    a = pred_a.data[:n_tr]
    b = pred_b.data[:n_tr]

    start, end = window
    sl = stable_window_slice(n_tr, start, end)
    diff = a[sl] - b[sl]

    if aggregate:
        vertex_map = diff.mean(axis=0)
    else:
        vertex_map = diff

    return ContrastResult(
        vertex_map=vertex_map,
        stimulus_a_id=pred_a.stimulus.id,
        stimulus_b_id=pred_b.stimulus.id,
        metadata={
            "window": [start, end],
            "n_trs": n_tr,
            "temporal_divergence_l2": temporal_divergence_l2(diff),
        },
    )


def temporal_divergence_l2(diff: np.ndarray) -> float:
    """Global L2 norm of vertex contrast over time."""
    return float(np.linalg.norm(diff))
