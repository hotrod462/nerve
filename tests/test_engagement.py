"""Engagement metric tests."""

from __future__ import annotations

import numpy as np
import pytest

from nerve.analysis.engagement import (
    YEO_NETWORK_ORDER,
    classify_epoch_template,
    compute_engagement,
    compute_network_raw_traces,
    parse_dominant_segments,
)
from nerve.parcellation.schaefer import SchaeferParcellation, YEO_17_NETWORK_ORDER


def test_compute_network_raw_traces():
    rng = np.random.default_rng(0)
    parcel_data = rng.standard_normal((10, 5))
    networks = ["Vis"] * 4 + ["Cont"] * 3 + ["Default"] * 3
    traces = compute_network_raw_traces(parcel_data, networks)
    assert set(traces.keys()) == set(YEO_NETWORK_ORDER)
    assert traces["Vis"].shape == (5,)
    np.testing.assert_allclose(traces["Vis"], parcel_data[:4].mean(axis=0))


def test_compute_engagement_shape():
    rng = np.random.default_rng(1)
    n_parcels, n_trs = 20, 8
    parcel_data = rng.standard_normal((n_parcels, n_trs))
    networks = [YEO_NETWORK_ORDER[i % 7] for i in range(n_parcels)]

    doc = compute_engagement(
        parcel_data,
        networks,
        n_parcels=n_parcels,
        inference_mode="acoustic_only",
    )

    assert doc["version"] == 2
    assert doc["n_trs"] == n_trs
    assert len(doc["networks"]) == 7
    assert doc["networks"]["Cont"]["headline"] == "Focus"
    assert len(doc["networks"]["SalVentAttn"]["zscore"]) == n_trs
    assert len(doc["derived"]["dominant_network_tr"]) == n_trs
    assert len(doc["derived"]["dominant_segments"]) >= 1
    assert len(doc["derived"]["epoch_segments"]) == len(doc["derived"]["dominant_segments"])
    assert "SomMot_Limbic" in doc["derived"]["coupling"]


def test_compute_engagement_with_subnetworks():
    rng = np.random.default_rng(3)
    n_parcels, n_trs = len(YEO_17_NETWORK_ORDER) * 2, 12
    networks = [YEO_17_NETWORK_ORDER[i % len(YEO_17_NETWORK_ORDER)] for i in range(n_parcels)]
    parcel_data = rng.standard_normal((n_parcels, n_trs))

    doc = compute_engagement(
        parcel_data,
        networks,
        n_parcels=n_parcels,
        yeo_networks=17,
    )

    assert doc["atlas"]["yeo_networks"] == 17
    assert "subnetworks" in doc
    assert "SalVentAttnA" in doc["subnetworks"]
    assert doc["derived"]["deep_dive_subnets"]["Default"] == [
        "DefaultA",
        "DefaultB",
        "DefaultC",
        "TempPar",
    ]


def test_classify_epoch_template_decoupling():
    n_trs = 10
    macro_z = {net: np.zeros(n_trs) for net in YEO_NETWORK_ORDER}
    macro_z["Default"] = np.array([0.0, 0.0, 1.2, 1.3, 1.1, 0.0, 0.0, 0.0, 0.0, 0.0])
    macro_z["Cont"] = np.array([0.0, 0.0, -0.8, -0.7, -0.6, 0.0, 0.0, 0.0, 0.0, 0.0])

    segment = {"net": "Default", "start_tr": 2, "end_tr": 4, "duration_s": 3}
    template = classify_epoch_template(segment, macro_z)
    assert template is not None
    assert template["id"] == "decoupling"


def test_parse_dominant_segments():
    dominant = ["Vis", "Vis", "Cont", "Cont", "Cont", "Default"]
    segments = parse_dominant_segments(dominant)
    assert segments == [
        {"net": "Vis", "start_tr": 0, "end_tr": 1, "duration_s": 2},
        {"net": "Cont", "start_tr": 2, "end_tr": 4, "duration_s": 3},
        {"net": "Default", "start_tr": 5, "end_tr": 5, "duration_s": 1},
    ]


@pytest.mark.slow
def test_engagement_from_schaefer_aggregate():
    rng = np.random.default_rng(2)
    vertex_ts = rng.standard_normal((12, 20484)).astype(np.float32) * 0.1
    parceler = SchaeferParcellation(n_parcels=100, yeo_networks=17)
    parcels = parceler.aggregate(vertex_ts)
    doc = compute_engagement(
        parcels,
        parceler.parcel_networks(),
        n_parcels=100,
        yeo_networks=17,
    )
    assert doc["atlas"]["n_parcels"] == 100
    assert doc["atlas"]["yeo_networks"] == 17
    assert "subnetworks" in doc
    assert all(doc["summaries"][n]["peak_tr"] < 12 for n in YEO_NETWORK_ORDER)
