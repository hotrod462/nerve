"""Parcel and network summaries."""

from __future__ import annotations

import numpy as np


def global_mean_trace(data: np.ndarray) -> np.ndarray:
    """Mean BOLD across vertices per TR — shape (T,)."""
    return data.mean(axis=1)


def rank_parcels_by_contrast(
    parcel_contrast: np.ndarray,
    labels: list[str],
    top_k: int = 10,
) -> list[tuple[str, float]]:
    """Rank parcels by absolute contrast magnitude."""
    if parcel_contrast.ndim == 2:
        scores = np.abs(parcel_contrast).mean(axis=1)
    else:
        scores = np.abs(parcel_contrast)
    order = np.argsort(scores)[::-1][:top_k]
    return [(labels[i], float(scores[i])) for i in order]
