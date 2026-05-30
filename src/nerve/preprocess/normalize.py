"""Within-clip normalization helpers."""

from __future__ import annotations

import numpy as np


def zscore_time(data: np.ndarray, axis: int = 0, eps: float = 1e-8) -> np.ndarray:
    """Z-score along time axis per vertex."""
    mean = data.mean(axis=axis, keepdims=True)
    std = data.std(axis=axis, keepdims=True)
    return (data - mean) / (std + eps)
