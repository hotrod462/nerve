"""Harvard-Oxford subcortical ROI meshes for Niivue — aligned with TRIBE v2."""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

import numpy as np

from nerve.export.gifti_writer import _write_geometry, _write_scalar_frames
from nerve.parcellation.subcortical import SUBCORTICAL_DISPLAY_ORDER
from nerve.types import SubcorticalPrediction

logger = logging.getLogger(__name__)

ASSETS_SUBCORTICAL = (
    Path(__file__).resolve().parents[3] / "data" / "assets" / "subcortical"
)


def roi_slug(roi: str) -> str:
    return roi.lower().replace(" ", "_")


def _pyvista_to_gifti(mesh, out_path: Path) -> tuple[int, np.ndarray]:
    """Write PyVista PolyData as geometry-only GIfTI; return (n_verts, faces)."""
    coords = np.asarray(mesh.points, dtype=np.float32)
    raw_faces = np.asarray(mesh.faces, dtype=np.int32)
    if raw_faces.size == 0:
        raise ValueError(f"Empty mesh for {out_path.name}")
    faces = raw_faces.reshape(-1, 4)[:, 1:]
    _write_geometry(coords, faces, out_path)
    return int(coords.shape[0]), faces


def _build_subcortical_roi_mesh(roi: str, resolution: str = "2mm"):
    """Marching-cubes mesh for a bilateral ROI (robust level for small structures)."""
    import nibabel as nib
    import pyvista as pv
    from scipy.ndimage import gaussian_filter
    from skimage import measure
    from tribev2.plotting.subcortical import get_mask

    nii_mask = get_mask(roi, resolution)  # type: ignore[arg-type]
    volume = gaussian_filter(nii_mask.get_fdata().astype(float), sigma=1)
    peak = float(volume.max())
    if peak <= 0:
        raise ValueError(f"Empty subcortical mask for ROI {roi!r}")

    level = min(0.9, peak * 0.5)
    verts, faces, _, _ = measure.marching_cubes(volume, level=level)
    verts = nib.affines.apply_affine(nii_mask.affine, verts)
    faces_pv = np.hstack([np.full((faces.shape[0], 1), 3), faces]).astype(np.int32)
    return pv.PolyData(verts.astype(np.float64), faces_pv)


def _voxel_scores_to_roi_vertices(
    voxel_scores: np.ndarray,
    roi: str,
    pv_mesh,
    *,
    resolution: str = "2mm",
) -> np.ndarray:
    import copy

    import nibabel as nib
    from tribev2.plotting.subcortical import get_mask, get_subcortical_mask, nii_to_mesh

    subcortical_mask = copy.deepcopy(get_subcortical_mask())
    data = subcortical_mask.get_fdata()
    data[data > 0] = voxel_scores
    nii = nib.Nifti1Image(data, subcortical_mask.affine, subcortical_mask.header)
    roi_mask = get_mask(roi, resolution)  # type: ignore[arg-type]
    return np.asarray(nii_to_mesh(nii, pv_mesh, mask_img=roi_mask), dtype=np.float32)


def _roi_vertex_timeseries(
    voxel_ts: np.ndarray,
    roi: str,
    *,
    resolution: str = "2mm",
) -> np.ndarray:
    """Project (T, n_voxels) TRIBE output to ROI mesh vertices via vol_to_surf."""
    pv_mesh = _build_subcortical_roi_mesh(roi, resolution)
    n_verts = int(pv_mesh.n_points)
    n_tr = int(voxel_ts.shape[0])
    out = np.zeros((n_tr, n_verts), dtype=np.float32)
    for t in range(n_tr):
        out[t] = _voxel_scores_to_roi_vertices(
            voxel_ts[t], roi, pv_mesh, resolution=resolution
        )
    return out


def ensure_subcortical_mesh_assets(
    assets_dir: Path | None = None,
    *,
    resolution: str = "2mm",
) -> dict[str, Path]:
    """Generate/cache bilateral ROI surface templates (marching cubes)."""
    assets_dir = assets_dir or ASSETS_SUBCORTICAL
    assets_dir.mkdir(parents=True, exist_ok=True)

    paths: dict[str, Path] = {}
    for roi in SUBCORTICAL_DISPLAY_ORDER:
        slug = roi_slug(roi)
        dest = assets_dir / f"{slug}.gii"
        paths[roi] = dest
        if dest.is_file():
            continue
        logger.info("Building subcortical mesh template: %s", roi)
        mesh = _build_subcortical_roi_mesh(roi, resolution)
        _pyvista_to_gifti(mesh, dest)

    return paths


def export_subcortical_meshes(
    subcortical: SubcorticalPrediction,
    mesh_dir: Path,
    *,
    assets_dir: Path | None = None,
) -> dict[str, object]:
    """
    Write subcortical ROI geometry + 4D activation layers under mesh/subcortical/.

    Returns manifest fragment for web manifest.json.
    """
    assets = ensure_subcortical_mesh_assets(assets_dir)
    sub_dir = mesh_dir / "subcortical"
    sub_dir.mkdir(parents=True, exist_ok=True)

    voxel_ts = subcortical.data.astype(np.float32)
    roi_entries: list[dict[str, str]] = []
    all_vals: list[np.ndarray] = []

    for roi in SUBCORTICAL_DISPLAY_ORDER:
        slug = roi_slug(roi)
        geom_name = f"{slug}.gii"
        act_name = f"{slug}.activations.gii"
        geom_dest = sub_dir / geom_name
        act_dest = sub_dir / act_name

        if not geom_dest.is_file():
            shutil.copy2(assets[roi], geom_dest)

        logger.info("Projecting subcortical activations: %s", roi)
        ts = _roi_vertex_timeseries(voxel_ts, roi)
        all_vals.append(ts)
        _write_scalar_frames(ts, act_dest)

        roi_entries.append(
            {
                "id": roi,
                "geometry": f"mesh/subcortical/{geom_name}",
                "activations": f"mesh/subcortical/{act_name}",
            }
        )

    stacked = np.concatenate(all_vals, axis=1)
    vmin = float(np.percentile(stacked, 2))
    vmax = float(np.percentile(stacked, 98))
    if vmax <= vmin:
        vmax = vmin + 1e-6

    return {
        "rois": roi_entries,
        "vmin": vmin,
        "vmax": vmax,
        "resolution": "2mm",
        "space": subcortical.space,
    }
