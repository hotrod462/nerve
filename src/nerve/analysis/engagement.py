"""Yeo network engagement traces for web export."""

from __future__ import annotations

from typing import Any

import numpy as np

from nerve.parcellation.schaefer import (
    MACRO_DEEP_DIVE_SUBNETS,
    YEO_17_NETWORK_ORDER,
    YEO_17_TO_MACRO,
    YEO_NETWORK_ORDER,
    rollup_to_macro,
)

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

SUBNETWORK_META: dict[str, dict[str, str]] = {
    "VisCent": {"headline": "Central visual", "tagline": "Early visual cortex"},
    "VisPeri": {"headline": "Peripheral visual", "tagline": "Peripheral visual field"},
    "SomMotA": {"headline": "Motor A", "tagline": "Primary motor / premotor"},
    "SomMotB": {"headline": "Motor B", "tagline": "Secondary somatomotor"},
    "DorsAttnA": {"headline": "Dorsal attention A", "tagline": "Frontoparietal top-down"},
    "DorsAttnB": {"headline": "Dorsal attention B", "tagline": "Posterior attention"},
    "SalVentAttnA": {"headline": "Salience A (insula)", "tagline": "Anterior salience / insula"},
    "SalVentAttnB": {"headline": "Salience B", "tagline": "Ventral attention / TPJ"},
    "LimbicA": {"headline": "Limbic A", "tagline": "Orbitofrontal / temporal pole"},
    "LimbicB": {"headline": "Limbic B", "tagline": "Cingulate / parahippocampal"},
    "ContA": {"headline": "Control A", "tagline": "Frontoparietal control"},
    "ContB": {"headline": "Control B", "tagline": "Mid-cingulo-insular"},
    "ContC": {"headline": "Control C", "tagline": "Posterior control"},
    "DefaultA": {"headline": "Default A", "tagline": "Medial prefrontal core"},
    "DefaultB": {"headline": "Default B", "tagline": "Temporal / angular DMN"},
    "DefaultC": {"headline": "Default C", "tagline": "Posterior DMN hub"},
    "TempPar": {"headline": "Temporal parietal", "tagline": "Language / narrative integration"},
}

EPOCH_TEMPLATES: tuple[dict[str, Any], ...] = (
    {
        "id": "decoupling",
        "label": "Decoupling bridge",
        "hypothesis": (
            "Default-mode engagement rises while control dips — exploratory pattern "
            "associated with internally directed, less effortful listening."
        ),
    },
    {
        "id": "event_drop",
        "label": "Event / drop",
        "hypothesis": (
            "Salience (especially insula-linked SalVentAttnA) spikes — pattern "
            "consistent with a bottom-up orienting response to a salient acoustic event."
        ),
    },
    {
        "id": "groove",
        "label": "Groove / entrainment",
        "hypothesis": (
            "Somatomotor and limbic co-elevation — exploratory pattern linked to "
            "rhythmic motor coupling and affective groove in music cognition literature."
        ),
    },
    {
        "id": "active_parsing",
        "label": "Active parsing",
        "hypothesis": (
            "Control and dorsal attention co-elevation — pattern consistent with "
            "effortful tracking of complex or dense musical structure."
        ),
    },
    {
        "id": "narrative",
        "label": "Narrative / lyrical",
        "hypothesis": (
            "Temporal-parietal and default-A co-elevation — exploratory pattern "
            "associated with semantic / narrative processing during music with lyrics."
        ),
    },
)

ACTIVE_Z_THRESHOLD = 0.5
SALIENCE_DERIVATIVE_THRESHOLD = 1.5
COUPLING_WINDOW_TRS = 8
EPOCH_Z_THRESHOLD = 0.35

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


def _network_indices(networks: list[str], order: list[str]) -> dict[str, list[int]]:
    grouped: dict[str, list[int]] = {n: [] for n in order}
    for idx, net in enumerate(networks):
        if net in grouped:
            grouped[net].append(idx)
    return grouped


def _macro_indices(networks: list[str]) -> dict[str, list[int]]:
    grouped: dict[str, list[int]] = {n: [] for n in YEO_NETWORK_ORDER}
    for idx, net in enumerate(networks):
        macro = rollup_to_macro(net)
        if macro in grouped:
            grouped[macro].append(idx)
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
    *,
    macro: bool = True,
) -> dict[str, np.ndarray]:
    """
    Aggregate parcel time series to Yeo network means.

    parcel_data: (n_parcels, T)
    macro=True → Yeo-7 rollup; macro=False → native subnetwork labels.
    """
    if parcel_data.ndim != 2:
        raise ValueError(f"expected (n_parcels, T), got {parcel_data.shape}")

    networks = _align_networks(networks, parcel_data.shape[0])
    order = YEO_NETWORK_ORDER if macro else _subnetwork_order(networks)
    grouped = _macro_indices(networks) if macro else _network_indices(networks, order)

    traces: dict[str, np.ndarray] = {}
    for net in order:
        idxs = grouped[net]
        if not idxs:
            traces[net] = np.zeros(parcel_data.shape[1], dtype=np.float64)
        else:
            traces[net] = parcel_data[idxs, :].mean(axis=0)
    return traces


def _subnetwork_order(networks: list[str]) -> list[str]:
    present = set(networks)
    if present <= set(YEO_NETWORK_ORDER):
        return list(YEO_NETWORK_ORDER)
    return [n for n in YEO_17_NETWORK_ORDER if n in present]


def _has_subnetworks(networks: list[str]) -> bool:
    return any(n in YEO_17_TO_MACRO for n in networks)


def parse_dominant_segments(dominant_network_tr: list[str]) -> list[dict[str, int | str]]:
    """Contiguous runs where each network wins the per-TR z-score argmax."""
    if not dominant_network_tr:
        return []

    segments: list[dict[str, int | str]] = []
    start = 0
    current = dominant_network_tr[0]

    for i in range(1, len(dominant_network_tr)):
        if dominant_network_tr[i] != current:
            segments.append(
                {
                    "net": current,
                    "start_tr": start,
                    "end_tr": i - 1,
                    "duration_s": i - start,
                }
            )
            start = i
            current = dominant_network_tr[i]

    segments.append(
        {
            "net": current,
            "start_tr": start,
            "end_tr": len(dominant_network_tr) - 1,
            "duration_s": len(dominant_network_tr) - start,
        }
    )
    return segments


def summarize_trace(z: np.ndarray) -> dict[str, float | int]:
    peak_tr = int(np.argmax(z)) if z.size else 0
    return {
        "mean_z": float(z.mean()) if z.size else 0.0,
        "peak_z": float(z.max()) if z.size else 0.0,
        "peak_tr": peak_tr,
        "active_fraction": float(np.mean(z > ACTIVE_Z_THRESHOLD)) if z.size else 0.0,
    }


def _segment_mean(z: np.ndarray, start: int, end: int) -> float:
    if z.size == 0:
        return 0.0
    return float(z[start : end + 1].mean())


def classify_epoch_template(
    segment: dict[str, int | str],
    macro_z: dict[str, np.ndarray],
    sub_z: dict[str, np.ndarray] | None = None,
) -> dict[str, Any] | None:
    """Score literature-inspired epoch templates for a dominant segment."""
    start = int(segment["start_tr"])
    end = int(segment["end_tr"])

    def m(key: str, traces: dict[str, np.ndarray]) -> float:
        arr = traces.get(key)
        if arr is None:
            return 0.0
        return _segment_mean(arr, start, end)

    scores: dict[str, float] = {}

    default_z = m("Default", macro_z)
    cont_z = m("Cont", macro_z)
    scores["decoupling"] = max(0.0, default_z - cont_z)

    sal_a = m("SalVentAttnA", sub_z) if sub_z else m("SalVentAttn", macro_z)
    scores["event_drop"] = sal_a

    scores["groove"] = min(m("SomMot", macro_z), m("Limbic", macro_z))

    cont_a = m("ContA", sub_z) if sub_z else cont_z
    dors_a = m("DorsAttnA", sub_z) if sub_z else m("DorsAttn", macro_z)
    scores["active_parsing"] = min(cont_a, dors_a)

    temp_par = m("TempPar", sub_z) if sub_z else 0.0
    default_a = m("DefaultA", sub_z) if sub_z else default_z
    scores["narrative"] = min(temp_par, default_a) if sub_z else 0.0

    best_id = max(scores, key=scores.get)
    best_score = scores[best_id]
    if best_score < EPOCH_Z_THRESHOLD:
        return None

    template = next(t for t in EPOCH_TEMPLATES if t["id"] == best_id)
    return {
        "id": template["id"],
        "label": template["label"],
        "hypothesis": template["hypothesis"],
        "score": round(best_score, 3),
        "caveat": (
            "Exploratory in-silico hypothesis from predicted group-average BOLD; "
            "not validated fMRI inference."
        ),
    }


def classify_segment_epoch_templates(
    segments: list[dict[str, int | str]],
    macro_z: dict[str, np.ndarray],
    sub_z: dict[str, np.ndarray] | None = None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for seg in segments:
        template = classify_epoch_template(seg, macro_z, sub_z)
        entry: dict[str, Any] = {
            "net": seg["net"],
            "start_tr": seg["start_tr"],
            "end_tr": seg["end_tr"],
            "duration_s": seg["duration_s"],
        }
        if template:
            entry["template"] = template
        out.append(entry)
    return out


def _build_network_docs(
    raw_traces: dict[str, np.ndarray],
    grouped: dict[str, list[int]],
    meta: dict[str, dict[str, str]],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, np.ndarray], dict[str, np.ndarray]]:
    z_traces: dict[str, np.ndarray] = {}
    d_traces: dict[str, np.ndarray] = {}
    network_docs: dict[str, Any] = {}
    summaries: dict[str, Any] = {}

    for net, raw in raw_traces.items():
        z = _zscore(raw)
        d = _derivative(z)
        z_traces[net] = z
        d_traces[net] = d
        info = meta.get(net, {"headline": net, "tagline": ""})
        network_docs[net] = {
            "yeo_key": net,
            "headline": info["headline"],
            "tagline": info["tagline"],
            "parcel_count": len(grouped.get(net, [])),
            "raw": raw.tolist(),
            "zscore": z.tolist(),
            "derivative": d.tolist(),
        }
        summaries[net] = summarize_trace(z)

    return network_docs, summaries, z_traces, d_traces


def compute_engagement(
    parcel_data: np.ndarray,
    networks: list[str],
    *,
    n_parcels: int,
    yeo_networks: int = 17,
    inference_mode: str = "acoustic_only",
    fps: int = 1,
    skip_trs: int = 0,
) -> dict[str, Any]:
    """Build engagement.json document from (n_parcels, T) parcel matrix."""
    networks = _align_networks(networks, parcel_data.shape[0])
    n_trs = int(parcel_data.shape[1])
    use_sub = _has_subnetworks(networks)

    macro_raw = compute_network_raw_traces(parcel_data, networks, macro=True)
    macro_grouped = _macro_indices(networks)
    network_docs, summaries, z_traces, d_traces = _build_network_docs(
        macro_raw, macro_grouped, NETWORK_META
    )

    subnetwork_docs: dict[str, Any] | None = None
    sub_summaries: dict[str, Any] | None = None
    sub_z_traces: dict[str, np.ndarray] | None = None

    if use_sub:
        sub_raw = compute_network_raw_traces(parcel_data, networks, macro=False)
        sub_grouped = _network_indices(networks, _subnetwork_order(networks))
        subnetwork_docs, sub_summaries, sub_z_traces, _ = _build_network_docs(
            sub_raw, sub_grouped, SUBNETWORK_META
        )

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

    segments = parse_dominant_segments(dominant)
    epoch_segments = classify_segment_epoch_templates(segments, z_traces, sub_z_traces)

    doc: dict[str, Any] = {
        "version": 2,
        "fps": fps,
        "n_trs": n_trs,
        "atlas": {
            "name": "Schaefer2018",
            "n_parcels": n_parcels,
            "yeo_networks": yeo_networks if use_sub else 7,
        },
        "inference_mode": inference_mode,
        "preprocessing": {
            "network_aggregate": "mean_over_parcels",
            "zscore": "per_network_within_clip",
            "skip_trs": skip_trs,
            "macro_rollup": use_sub,
        },
        "networks": network_docs,
        "summaries": summaries,
        "derived": {
            "dominant_network_tr": dominant,
            "dominant_segments": segments,
            "epoch_segments": epoch_segments,
            "coupling": coupling,
            "salience_events": {
                "threshold_z_derivative": SALIENCE_DERIVATIVE_THRESHOLD,
                "trs": salience_events,
            },
            "deep_dive_subnets": {
                macro: list(subs) for macro, subs in MACRO_DEEP_DIVE_SUBNETS.items()
            },
        },
        "disclaimer": DISCLAIMER,
    }

    if subnetwork_docs is not None:
        doc["subnetworks"] = subnetwork_docs
        doc["sub_summaries"] = sub_summaries

    return doc
