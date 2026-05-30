"""Schaefer 2018 atlas on fsaverage5 via Nilearn vol_to_surf."""

from __future__ import annotations

import logging
from functools import lru_cache

import numpy as np
from nilearn import datasets
from nilearn.surface import vol_to_surf

from nerve.types import N_VERTICES_FSAVERAGE5, N_VERTICES_LH

logger = logging.getLogger(__name__)

YEO_NETWORK_ORDER = [
    "Vis",
    "SomMot",
    "DorsAttn",
    "SalVentAttn",
    "Limbic",
    "Cont",
    "Default",
]


@lru_cache(maxsize=4)
def _load_schaefer_vertex_labels(n_parcels: int, yeo_networks: int) -> tuple[np.ndarray, list[str]]:
    """Project Schaefer MNI volume labels onto fsaverage5 lh+rh vertices."""
    atlas = datasets.fetch_atlas_schaefer_2018(
        n_rois=n_parcels,
        yeo_networks=yeo_networks,
        resolution_mm=2,
    )
    labels = [str(l) for l in atlas.labels]
    fsaverage = datasets.fetch_surf_fsaverage(mesh="fsaverage5")

    hemis = []
    for hemi in ("left", "right"):
        surf_labels = vol_to_surf(
            atlas.maps,
            surf_mesh=fsaverage[f"pial_{hemi}"],
            radius=3.0,
            interpolation="nearest_most_frequent",
        )
        hemis.append(np.round(surf_labels).astype(np.int32))

    vertex_labels = np.concatenate(hemis)
    if vertex_labels.shape[0] > N_VERTICES_FSAVERAGE5:
        vertex_labels = vertex_labels[:N_VERTICES_FSAVERAGE5]
    elif vertex_labels.shape[0] < N_VERTICES_FSAVERAGE5:
        pad = np.zeros(N_VERTICES_FSAVERAGE5 - vertex_labels.shape[0], dtype=np.int32)
        vertex_labels = np.concatenate([vertex_labels, pad])
    return vertex_labels, labels


class SchaeferParcellation:
    """Aggregate vertex-wise BOLD to Schaefer parcel means."""

    def __init__(self, n_parcels: int = 100, yeo_networks: int = 7) -> None:
        self.n_parcels = n_parcels
        self.yeo_networks = yeo_networks
        self._vertex_to_parcel: np.ndarray | None = None
        self._labels: list[str] | None = None

    def _ensure_loaded(self) -> None:
        if self._vertex_to_parcel is None:
            self._vertex_to_parcel, self._labels = _load_schaefer_vertex_labels(
                self.n_parcels, self.yeo_networks
            )

    def labels(self) -> list[str]:
        self._ensure_loaded()
        assert self._labels is not None
        return list(self._labels)

    def aggregate(self, vertex_data: np.ndarray) -> np.ndarray:
        """
        vertex_data: (V,) → (n_parcels,)
        vertex_data: (T, V) → (n_parcels, T)
        """
        self._ensure_loaded()
        assert self._vertex_to_parcel is not None
        v2p = self._vertex_to_parcel

        if vertex_data.ndim == 1:
            out = np.zeros(self.n_parcels, dtype=np.float64)
            counts = np.zeros(self.n_parcels, dtype=np.int32)
            for v_idx, parcel_id in enumerate(v2p):
                if parcel_id <= 0:
                    continue
                pid = int(parcel_id) - 1
                if 0 <= pid < self.n_parcels:
                    out[pid] += vertex_data[v_idx]
                    counts[pid] += 1
            counts = np.maximum(counts, 1)
            return out / counts

        if vertex_data.ndim == 2:
            n_tr = vertex_data.shape[0]
            out = np.zeros((self.n_parcels, n_tr), dtype=np.float64)
            counts = np.zeros(self.n_parcels, dtype=np.int32)
            for v_idx, parcel_id in enumerate(v2p):
                if parcel_id <= 0:
                    continue
                pid = int(parcel_id) - 1
                if 0 <= pid < self.n_parcels:
                    out[pid] += vertex_data[:, v_idx]
                    counts[pid] += 1
            counts = np.maximum(counts, 1)[:, None]
            return out / counts

        raise ValueError(f"expected 1D or 2D vertex data, got {vertex_data.ndim}D")

    def parcel_networks(self) -> list[str]:
        """Yeo network name per parcel from label strings."""
        labs = self.labels()
        networks = []
        for lab in labs:
            parts = str(lab).split("_")
            networks.append(parts[2] if len(parts) > 2 else "Unknown")
        return networks

    def vertex_parcel_ids(self) -> np.ndarray:
        """Per-vertex Schaefer parcel ID (0 = medial wall / unlabeled)."""
        self._ensure_loaded()
        assert self._vertex_to_parcel is not None
        return self._vertex_to_parcel.copy()

    def vertex_yeo_ids(self) -> np.ndarray:
        """Per-vertex Yeo network ID (0 = unlabeled, 1–7 = YEO_NETWORK_ORDER)."""
        net_to_id = {n: i + 1 for i, n in enumerate(YEO_NETWORK_ORDER)}
        networks = self.parcel_networks()
        v2p = self.vertex_parcel_ids()
        out = np.zeros_like(v2p)
        for v_idx, parcel_id in enumerate(v2p):
            if parcel_id <= 0:
                continue
            pid = int(parcel_id) - 1
            if 0 <= pid < len(networks):
                out[v_idx] = net_to_id.get(networks[pid], 0)
        return out
