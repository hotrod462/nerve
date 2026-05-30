"""Hemodynamic lag handling — TR=1s, stable window from ~5s onward."""

from __future__ import annotations

from typing import Sequence

import numpy as np

from nerve.types import TR_SECONDS

DEFAULT_HEMO_OFFSET_TRS = 5


def hemodynamic_offset_trs(tr: float = TR_SECONDS) -> int:
    """Default TR offset before BOLD stabilizes (~5–6 s)."""
    return max(1, int(round(5.0 / tr)))


def stable_window_slice(
    n_trs: int,
    start_tr: int | None = None,
    end_tr: int | None = None,
    tr: float = TR_SECONDS,
) -> slice:
    """Slice TR indices for hemodynamically stable window."""
    if start_tr is None:
        start_tr = hemodynamic_offset_trs(tr)
    if end_tr is None:
        end_tr = n_trs
    start_tr = max(0, min(start_tr, n_trs))
    end_tr = max(start_tr, min(end_tr, n_trs))
    return slice(start_tr, end_tr)


def aggregate_stable_window(
    data: np.ndarray,
    window: tuple[int | None, int | None] = (None, None),
    reducer: str = "mean",
) -> np.ndarray:
    """
    Aggregate (T, V) over stable window → (V,) or keep (T', V) if reducer is none.

    window: (start_tr, end_tr) — None uses hemodynamic offset / end.
    """
    if data.ndim != 2:
        raise ValueError(f"expected (T, V), got {data.shape}")

    start, end = window
    sl = stable_window_slice(data.shape[0], start, end)
    chunk = data[sl]

    if reducer == "mean":
        return chunk.mean(axis=0)
    if reducer == "max":
        return chunk.max(axis=0)
    if reducer == "none":
        return chunk
    raise ValueError(f"unknown reducer {reducer!r}")
