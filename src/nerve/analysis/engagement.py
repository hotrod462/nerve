"""Yeo-7 network engagement traces for web export."""

from __future__ import annotations

from typing import Any

import numpy as np

from nerve.parcellation.schaefer import YEO_NETWORK_ORDER

DISCLAIMER = (
    "Predicted group-average cortical engagement (in-silico). "
    "Exploratory; not clinical or individual inference."
)

NETWORK_META: dict[str, dict[str, str]] = {
    "Cont": {
        "headline": "Focus",
        "tagline": "Sustained active processing",
    },
    "SalVentAttn": {
        "headline": "Surprise",
        "tagline": "Bottom-up salient events",
    },
    "DorsAttn": {
        "headline": "Tracking",
        "tagline": "Sustained top-down attention",
    },
    "Default": {
        "headline": "Resonance",
        "tagline": "Internal, self-relevant processing",
    },
    "Limbic": {
        "headline": "Feeling",
        "tagline": "Affective and evaluative tone",
    },
    "SomMot": {
        "headline": "Pulse",
        "tagline": "Rhythm and motor-related coupling",
    },
    "Vis": {
        "headline": "Imagery",
        "tagline": "Visual sensory engagement",
    },
}

ACTIVE_Z_THRESHOLD = 0.5
SALIENCE_DERIVATIVE_THRESHOLD = 1.5
COUPLING_WINDOW_TRS = 8

COUPLING_PAIRS: tuple[tuple[str, str], ...] = (
    ("SomMot", "Limbic"),
    ("Cont", "Default"),
    ("SalVentAttn", "SomMot"),
)


def _zscore(series: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    mean = float(series.mean())
    std = float(series.std())
    if std < eps:
        return np.zeros_like(series)
    return (series - mean) / (std + eps)


def _derivative(z: np.ndarray) -> np.ndarray:
    out = np.zeros_like(z)
    if z.size > 1:
        out[1:] = z[1:] - z[:-1]
    return out


def _rolling_correlation(a: np.ndarray, b: np.ndarray, window: int) -> np.ndarray:
    n = a.size
    out = np.zeros(n, dtype=np.float64)
    if n < 2 or window < 2:
        return out
    w = min(window, n)
    for t in range(n):
        start = max(0, t - w + 1)
        chunk_a = a[start : t + 1]
        chunk_b = b[start : t + 1]
        if chunk_a.size < 2:
            continue
        sa = chunk_a.std()
        sb = chunk_b.std()
        if sa < 1e-8 or sb < 1e-8:
            continue
        out[t] = float(np.corrcoef(chunk_a, chunk_b)[0, 1])
    return out


def _network_indices(networks: list[str]) -> dict[str, list[int]]:
    grouped: dict[str, list[int]] = {n: [] for n in YEO_NETWORK_ORDER}
    for idx, net in enumerate(networks):
        if net in grouped:
            grouped[net].append(idx)
    return grouped


def _align_networks(networks: list[str], n_parcels: int) -> list[str]:
    """Drop Background label row when labels outnumber parcel rows."""
    if len(networks) == n_parcels + 1 and networks[0] in ("Unknown", ""):
        return networks[1 : n_parcels + 1]
    if len(networks) > n_parcels:
        return networks[:n_parcels]
    if len(networks) < n_parcels:
        raise ValueError(
            f"networks length {len(networks)} != n_parcels {n_parcels}"
        )
    return networks


def compute_network_raw_traces(
    parcel_data: np.ndarray,
    networks: list[str],
) -> dict[str, np.ndarray]:
    """
    Aggregate parcel time series to Yeo-7 network means.

    parcel_data: (n_parcels, T)
    """
    if parcel_data.ndim != 2:
        raise ValueError(f"expected (n_parcels, T), got {parcel_data.shape}")

    networks = _align_networks(networks, parcel_data.shape[0])

    grouped = _network_indices(networks)
    traces: dict[str, np.ndarray] = {}
    for net in YEO_NETWORK_ORDER:
        idxs = grouped[net]
        if not idxs:
            traces[net] = np.zeros(parcel_data.shape[1], dtype=np.float64)
        else:
            traces[net] = parcel_data[idxs, :].mean(axis=0)
    return traces


def summarize_trace(z: np.ndarray) -> dict[str, float | int]:
    peak_tr = int(np.argmax(z)) if z.size else 0
    return {
        "mean_z": float(z.mean()) if z.size else 0.0,
        "peak_z": float(z.max()) if z.size else 0.0,
        "peak_tr": peak_tr,
        "active_fraction": float(np.mean(z > ACTIVE_Z_THRESHOLD)) if z.size else 0.0,
    }


def compute_engagement(
    parcel_data: np.ndarray,
    networks: list[str],
    *,
    n_parcels: int,
    yeo_networks: int = 7,
    inference_mode: str = "acoustic_only",
    fps: int = 1,
    skip_trs: int = 0,
) -> dict[str, Any]:
    """Build engagement.json document from (n_parcels, T) parcel matrix."""
    networks = _align_networks(networks, parcel_data.shape[0])
    raw_traces = compute_network_raw_traces(parcel_data, networks)
    n_trs = int(parcel_data.shape[1])

    z_traces: dict[str, np.ndarray] = {}
    d_traces: dict[str, np.ndarray] = {}
    network_docs: dict[str, Any] = {}
    summaries: dict[str, Any] = {}

    grouped = _network_indices(networks)

    for net in YEO_NETWORK_ORDER:
        raw = raw_traces[net]
        z = _zscore(raw)
        d = _derivative(z)
        z_traces[net] = z
        d_traces[net] = d
        meta = NETWORK_META[net]
        network_docs[net] = {
            "yeo_key": net,
            "headline": meta["headline"],
            "tagline": meta["tagline"],
            "parcel_count": len(grouped[net]),
            "raw": raw.tolist(),
            "zscore": z.tolist(),
            "derivative": d.tolist(),
        }
        summaries[net] = summarize_trace(z)

    z_stack = np.stack([z_traces[n] for n in YEO_NETWORK_ORDER], axis=0)
    dominant = [YEO_NETWORK_ORDER[i] for i in np.argmax(z_stack, axis=0).tolist()]

    salience_deriv = d_traces["SalVentAttn"]
    salience_events = [
        int(t)
        for t in np.where(salience_deriv >= SALIENCE_DERIVATIVE_THRESHOLD)[0].tolist()
        if t >= skip_trs
    ]

    coupling: dict[str, Any] = {}
    for a, b in COUPLING_PAIRS:
        key = f"{a}_{b}"
        series = _rolling_correlation(z_traces[a], z_traces[b], COUPLING_WINDOW_TRS)
        coupling[key] = {
            "networks": [a, b],
            "window_s": COUPLING_WINDOW_TRS,
            "series": series.tolist(),
        }

    return {
        "version": 1,
        "fps": fps,
        "n_trs": n_trs,
        "atlas": {
            "name": "Schaefer2018",
            "n_parcels": n_parcels,
            "yeo_networks": yeo_networks,
        },
        "inference_mode": inference_mode,
        "preprocessing": {
            "network_aggregate": "mean_over_parcels",
            "zscore": "per_network_within_clip",
            "skip_trs": skip_trs,
        },
        "networks": network_docs,
        "summaries": summaries,
        "derived": {
            "dominant_network_tr": dominant,
            "coupling": coupling,
            "salience_events": {
                "threshold_z_derivative": SALIENCE_DERIVATIVE_THRESHOLD,
                "trs": salience_events,
            },
        },
        "disclaimer": DISCLAIMER,
    }
