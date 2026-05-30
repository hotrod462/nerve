"""Optional Nilearn surface PNG for dev/debug."""

from __future__ import annotations

from pathlib import Path

import numpy as np


def plot_surface_png(
    vertex_map: np.ndarray,
    out_path: str | Path,
    title: str = "",
) -> Path:
    """Save a quick lh surface snapshot (requires matplotlib)."""
    from nilearn import plotting

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if vertex_map.ndim == 2:
        vertex_map = vertex_map.mean(axis=0)

    lh = vertex_map[:10242]
    view = plotting.view_surf(
        surf_mesh="fsaverage5",
        surf_map=lh,
        hemispheres="left",
        title=title,
    )
    view.save_as_html(str(out_path.with_suffix(".html")))
    return out_path
