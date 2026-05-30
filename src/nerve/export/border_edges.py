"""Extract cortical region border edges for Niivue connectome rendering."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from nerve.export.gifti_writer import load_gifti, _pointset_and_faces


def extract_border_edges(
    faces: np.ndarray,
    labels: np.ndarray,
    *,
    skip_unlabeled: bool = True,
) -> list[list[int]]:
    """
    Unique undirected mesh edges where adjacent vertices have different labels.

    faces: (n_tri, 3) vertex indices
    labels: (n_verts,) integer region IDs
    """
    edges: set[tuple[int, int]] = set()
    for tri in faces:
        v0, v1, v2 = int(tri[0]), int(tri[1]), int(tri[2])
        for a, b in ((v0, v1), (v1, v2), (v0, v2)):
            la, lb = int(labels[a]), int(labels[b])
            if skip_unlabeled and (la <= 0 or lb <= 0):
                continue
            if la != lb:
                edges.add((min(a, b), max(a, b)))
    return [[a, b] for a, b in sorted(edges)]


def write_border_edges(
    geometry_path: Path,
    labels: np.ndarray,
    out_path: Path,
) -> Path:
    """Write border edge index pairs for one hemisphere."""
    _, faces = _pointset_and_faces(load_gifti(geometry_path))
    edge_list = extract_border_edges(faces, labels)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(
            {
                "n_vertices": int(labels.shape[0]),
                "n_edges": len(edge_list),
                "edges": edge_list,
            }
        ),
        encoding="utf-8",
    )
    return out_path
