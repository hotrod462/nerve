"""Harvard-Oxford subcortical ROI mapping aligned with TRIBE v2 subcortical targets."""

from __future__ import annotations

from functools import lru_cache

import numpy as np

# Bilateral ROI keys in display order (ventricle last — low interpretability).
SUBCORTICAL_ROI_ORDER = [
    "Accumbens",
    "Caudate",
    "Putamen",
    "Pallidum",
    "Amygdala",
    "Hippocampus",
    "Thalamus",
    "Lateral Ventricle",
]

# Headline UI excludes CSF ventricle.
SUBCORTICAL_DISPLAY_ORDER = [
    roi for roi in SUBCORTICAL_ROI_ORDER if roi != "Lateral Ventricle"
]


@lru_cache(maxsize=1)
def _subcortical_mask_and_flat_indices() -> tuple[np.ndarray, np.ndarray]:
    """Match tribev2.plotting.subcortical.get_subcortical_mask flatten order."""
    from tribev2.plotting.subcortical import get_subcortical_mask

    mask = get_subcortical_mask()
    data = mask.get_fdata()
    flat_indices = np.flatnonzero(data > 0)
    flat_labels = data.ravel()[flat_indices].astype(np.int32)
    return flat_labels, flat_indices


@lru_cache(maxsize=1)
def roi_voxel_indices() -> dict[str, np.ndarray]:
    """Voxel column indices per bilateral ROI in TRIBE subcortical output."""
    from tribev2.plotting.subcortical import cached_ho_atlas, get_subcortical_mask

    flat_labels, _ = _subcortical_mask_and_flat_indices()
    ho_sub = cached_ho_atlas(resolution="2mm")
    atlas_labels = ho_sub.labels

    grouped: dict[str, list[int]] = {roi: [] for roi in SUBCORTICAL_ROI_ORDER}
    for voxel_idx, atlas_id in enumerate(flat_labels):
        label = atlas_labels[int(atlas_id)]
        if not label.startswith("Left "):
            continue
        roi = label.replace("Left ", "")
        if roi in grouped:
            grouped[roi].append(voxel_idx)

    return {roi: np.asarray(idxs, dtype=np.int32) for roi, idxs in grouped.items()}


def n_subcortical_voxels() -> int:
    flat_labels, _ = _subcortical_mask_and_flat_indices()
    return int(flat_labels.size)


def aggregate_voxels_to_rois(voxel_data: np.ndarray) -> np.ndarray:
    """
    Aggregate TRIBE subcortical voxels to bilateral ROI means.

    voxel_data: (n_voxels, T) or (n_voxels,)
    returns: (n_rois, T) or (n_rois,)
    """
    indices = roi_voxel_indices()
    order = SUBCORTICAL_ROI_ORDER
    if voxel_data.ndim == 1:
        out = np.zeros(len(order), dtype=np.float64)
        for i, roi in enumerate(order):
            idxs = indices[roi]
            if idxs.size:
                out[i] = voxel_data[idxs].mean()
        return out

    if voxel_data.ndim == 2:
        n_tr = voxel_data.shape[1]
        out = np.zeros((len(order), n_tr), dtype=np.float64)
        for i, roi in enumerate(order):
            idxs = indices[roi]
            if idxs.size:
                out[i] = voxel_data[idxs, :].mean(axis=0)
        return out

    raise ValueError(f"expected 1D or 2D voxel data, got {voxel_data.ndim}D")
