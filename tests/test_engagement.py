"""Engagement metric tests."""

from __future__ import annotations

import numpy as np
import pytest

from nerve.analysis.engagement import (
    YEO_NETWORK_ORDER,
    compute_engagement,
    compute_network_raw_traces,
)
from nerve.parcellation.schaefer import SchaeferParcellation


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

    assert doc["version"] == 1
    assert doc["n_trs"] == n_trs
    assert len(doc["networks"]) == 7
    assert doc["networks"]["Cont"]["headline"] == "Focus"
    assert len(doc["networks"]["SalVentAttn"]["zscore"]) == n_trs
    assert len(doc["derived"]["dominant_network_tr"]) == n_trs
    assert "SomMot_Limbic" in doc["derived"]["coupling"]


@pytest.mark.slow
def test_engagement_from_schaefer_aggregate():
    rng = np.random.default_rng(2)
    vertex_ts = rng.standard_normal((12, 20484)).astype(np.float32) * 0.1
    parceler = SchaeferParcellation(n_parcels=100)
    parcels = parceler.aggregate(vertex_ts)
    doc = compute_engagement(
        parcels,
        parceler.parcel_networks(),
        n_parcels=100,
    )
    assert doc["atlas"]["n_parcels"] == 100
    assert all(doc["summaries"][n]["peak_tr"] < 12 for n in YEO_NETWORK_ORDER)
