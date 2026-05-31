"""Schaefer Yeo-7 network labels with outward leader-line anchors."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

import numpy as np

from nerve.export.gifti_writer import _pointset_and_faces, load_gifti

# Display names for Schaefer / Yeo-7 networks.
YEO_DISPLAY: dict[str, str] = {
    "Vis": "Visual",
    "SomMot": "Somatomotor",
    "DorsAttn": "Dorsal Attention",
    "SalVentAttn": "Salience / Ventral Attention",
    "Limbic": "Limbic",
    "Cont": "Control",
    "Default": "Default Mode",
}


def _vertex_normals(pts: np.ndarray, faces: np.ndarray) -> np.ndarray:
    n_verts = pts.shape[0]
    accum = np.zeros((n_verts, 3), dtype=np.float64)

    for tri in faces:
        i0, i1, i2 = int(tri[0]), int(tri[1]), int(tri[2])
        a, b, c = pts[i0], pts[i1], pts[i2]
        n = np.cross(b - a, c - a)
        for vi in (i0, i1, i2):
            accum[vi] += n

    norms = np.linalg.norm(accum, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-12)
    return (accum / norms).astype(np.float32)


def _network_label_entries(
    pts: np.ndarray,
    faces: np.ndarray,
    network_ids: np.ndarray,
    network_order: list[str],
    *,
    hemi: Literal["lh", "rh"],
    leader_length: float = 12.0,
) -> list[dict[str, Any]]:
    """One Meta-style label per Yeo network on this hemisphere."""
    normals = _vertex_normals(pts, faces)
    hemi_tag = "LH" if hemi == "lh" else "RH"
    entries: list[dict[str, Any]] = []

    for net_id in range(1, len(network_order) + 1):
        mask = network_ids == net_id
        if not np.any(mask):
            continue

        net_key = network_order[net_id - 1]
        display = YEO_DISPLAY.get(net_key, net_key)
        name = f"{hemi_tag} {display}"

        verts = pts[mask]
        centroid = verts.mean(axis=0)
        n_mean = normals[mask].mean(axis=0)
        n_len = float(np.linalg.norm(n_mean)) or 1.0
        normal = (n_mean / n_len).astype(np.float32)
        label_pt = centroid + normal * leader_length

        entries.append(
            {
                "id": net_id,
                "name": name,
                "network": net_key,
                "anchor": [float(c) for c in centroid],
                "label": [float(c) for c in label_pt],
            }
        )

    return entries


def write_yeo_region_labels(
    geometry_path: Path,
    network_ids: np.ndarray,
    network_order: list[str],
    out_path: Path,
    *,
    hemi: Literal["lh", "rh"],
    leader_length: float = 12.0,
) -> list[dict[str, Any]]:
    """Write lh or rh Yeo network label anchors."""
    pts, faces = _pointset_and_faces(load_gifti(geometry_path))
    entries = _network_label_entries(
        pts,
        faces,
        network_ids,
        network_order,
        hemi=hemi,
        leader_length=leader_length,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    atlas_name = "Schaefer2018_Yeo17" if len(network_order) > 7 else "Schaefer2018_Yeo7"
    out_path.write_text(
        json.dumps(
            {
                "atlas": atlas_name,
                "n_regions": len(entries),
                "regions": entries,
            }
        ),
        encoding="utf-8",
    )
    return entries
