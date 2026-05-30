"""GIfTI mesh export for Niivue — Meta TRIBE demo layout."""

from __future__ import annotations

import gzip
import logging
import shutil
from pathlib import Path
from typing import Literal

import nibabel as nib
import numpy as np
from nibabel import gifti
from nilearn import datasets

from nerve.types import N_VERTICES_FSAVERAGE5, split_hemispheres

logger = logging.getLogger(__name__)

ASSETS_DIR = Path(__file__).resolve().parents[4] / "data" / "assets" / "fsaverage5"

_INTENT_POINTSET = 1008
_INTENT_TRIANGLE = 1009

SurfaceKind = Literal["pial", "half", "inflated"]


def load_gifti(path: Path) -> gifti.GiftiImage:
    """Load GIfTI, transparently decompressing gzip-wrapped files from nilearn."""
    raw = path.read_bytes()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return gifti.GiftiImage.from_bytes(raw)


def save_gifti_uncompressed(img: gifti.GiftiImage, path: Path) -> None:
    """Write uncompressed XML GIfTI (Niivue/nibabel-friendly)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    nib.save(img, str(path))


def _geometry_darrays(gii: gifti.GiftiImage) -> list[gifti.GiftiDataArray]:
    return [d for d in gii.darrays if d.intent in (_INTENT_POINTSET, _INTENT_TRIANGLE)]


def _pointset_and_faces(gii: gifti.GiftiImage) -> tuple[np.ndarray, np.ndarray]:
    pts = faces = None
    for darray in gii.darrays:
        if darray.intent == _INTENT_POINTSET:
            pts = np.asarray(darray.data, dtype=np.float32)
        elif darray.intent == _INTENT_TRIANGLE:
            faces = np.asarray(darray.data, dtype=np.int32)
    if pts is None or faces is None:
        raise ValueError("GIfTI missing pointset or triangle array")
    return pts, faces


def _write_geometry(
    coords: np.ndarray,
    faces: np.ndarray,
    out_path: Path,
) -> Path:
    geom = gifti.GiftiImage()
    geom.add_gifti_data_array(
        gifti.GiftiDataArray(
            data=coords.astype(np.float32),
            intent=_INTENT_POINTSET,
        )
    )
    geom.add_gifti_data_array(
        gifti.GiftiDataArray(
            data=faces.astype(np.int32),
            intent=_INTENT_TRIANGLE,
        )
    )
    save_gifti_uncompressed(geom, out_path)
    return out_path


def _write_scalar_frames(vertex_timeseries: np.ndarray, out_path: Path) -> Path:
    """Write T per-vertex scalar frames (no geometry) for Niivue mesh layers."""
    if vertex_timeseries.ndim != 2:
        raise ValueError(f"expected (T, n_verts), got {vertex_timeseries.shape}")

    img = gifti.GiftiImage()
    n_verts = vertex_timeseries.shape[1]
    for t in range(vertex_timeseries.shape[0]):
        frame = vertex_timeseries[t].astype(np.float32).reshape(n_verts, 1)
        img.add_gifti_data_array(gifti.GiftiDataArray(data=frame))
    save_gifti_uncompressed(img, out_path)
    return out_path


def ensure_fsaverage5_assets(assets_dir: Path | None = None) -> dict[str, Path]:
    """Fetch/cache fsaverage5 pial, inflated, and sulcal maps."""
    assets_dir = assets_dir or ASSETS_DIR
    assets_dir.mkdir(parents=True, exist_ok=True)

    keys = {
        "lh_pial": "lh.pial.gii",
        "rh_pial": "rh.pial.gii",
        "lh_infl": "lh.inflated.gii",
        "rh_infl": "rh.inflated.gii",
        "lh_sulc": "lh.sulc.gii",
        "rh_sulc": "rh.sulc.gii",
    }
    paths = {k: assets_dir / v for k, v in keys.items()}

    if all(p.is_file() for p in paths.values()):
        try:
            for p in paths.values():
                load_gifti(p)
            return paths
        except Exception:
            for p in paths.values():
                p.unlink(missing_ok=True)

    logger.info("Fetching fsaverage5 surface templates via nilearn...")
    fsaverage = datasets.fetch_surf_fsaverage(mesh="fsaverage5")
    mapping = [
        ("pial_left", "lh_pial"),
        ("pial_right", "rh_pial"),
        ("infl_left", "lh_infl"),
        ("infl_right", "rh_infl"),
        ("sulc_left", "lh_sulc"),
        ("sulc_right", "rh_sulc"),
    ]
    for src_key, dest_key in mapping:
        src = Path(fsaverage[src_key])
        dest = paths[dest_key]
        save_gifti_uncompressed(load_gifti(src), dest)
        logger.info("Wrote %s", dest)

    return paths


def ensure_fsaverage5_meshes(assets_dir: Path | None = None) -> tuple[Path, Path]:
    """Backward-compatible inflated mesh paths."""
    assets = ensure_fsaverage5_assets(assets_dir)
    return assets["lh_infl"], assets["rh_infl"]


def _half_inflated_coords(pial: np.ndarray, inflated: np.ndarray) -> np.ndarray:
    """Meta TRIBE default: 50% pial + 50% inflated."""
    return (0.5 * pial + 0.5 * inflated).astype(np.float32)


def write_surface_geometry(
    surface: SurfaceKind,
    assets: dict[str, Path],
    mesh_dir: Path,
) -> tuple[Path, Path]:
    """Write lh/rh geometry-only GIfTI for the requested surface kind."""
    mesh_dir.mkdir(parents=True, exist_ok=True)
    suffix = {"pial": "pial", "half": "half", "inflated": "inflated"}[surface]
    out: dict[str, Path] = {}

    for hemi, pial_key, infl_key in (
        ("lh", "lh_pial", "lh_infl"),
        ("rh", "rh_pial", "rh_infl"),
    ):
        pial_pts, faces = _pointset_and_faces(load_gifti(assets[pial_key]))
        infl_pts, _ = _pointset_and_faces(load_gifti(assets[infl_key]))

        if surface == "pial":
            coords = pial_pts
        elif surface == "inflated":
            coords = infl_pts
        else:
            coords = _half_inflated_coords(pial_pts, infl_pts)

        dest = mesh_dir / f"{hemi}.{suffix}.gii"
        _write_geometry(coords, faces, dest)
        out[hemi] = dest

    return out["lh"], out["rh"]


def write_sulc_maps(assets: dict[str, Path], mesh_dir: Path) -> tuple[Path, Path]:
    """Write sulcal depth as scalar GIfTI layers (Meta bg_map underlay)."""
    mesh_dir.mkdir(parents=True, exist_ok=True)
    out_lh = mesh_dir / "lh.sulc.gii"
    out_rh = mesh_dir / "rh.sulc.gii"

    for src_key, dest in (("lh_sulc", out_lh), ("rh_sulc", out_rh)):
        sulc = load_gifti(assets[src_key])
        data = np.asarray(sulc.darrays[0].data, dtype=np.float32).reshape(-1, 1)
        img = gifti.GiftiImage()
        img.add_gifti_data_array(gifti.GiftiDataArray(data=data))
        save_gifti_uncompressed(img, dest)

    return out_lh, out_rh


def write_mesh_with_4d_scalars(
    geometry_path: Path,
    vertex_timeseries: np.ndarray,
    out_path: Path,
) -> Path:
    """Legacy: geometry + embedded 4D scalars in one GIfTI."""
    if vertex_timeseries.ndim != 2:
        raise ValueError(f"expected (T, n_verts), got {vertex_timeseries.shape}")

    gii = load_gifti(geometry_path)
    geom = gifti.GiftiImage()
    for darray in _geometry_darrays(gii):
        geom.add_gifti_data_array(darray)

    if not geom.darrays:
        raise ValueError(f"No geometry in {geometry_path}")

    n_verts = vertex_timeseries.shape[1]
    for t in range(vertex_timeseries.shape[0]):
        frame = vertex_timeseries[t].astype(np.float32).reshape(n_verts, 1)
        geom.add_gifti_data_array(gifti.GiftiDataArray(data=frame))

    save_gifti_uncompressed(geom, out_path)
    return out_path


def write_scalars_4d_gifti(
    vertex_timeseries: np.ndarray,
    out_path: Path,
    lh_mesh: Path,
    rh_mesh: Path,
) -> Path:
    """
    Write Meta-style Niivue bundle:
    - pial / half / inflated geometry (no scalars)
    - lh/rh.activations.gii (T frames, layer overlay)
    - lh/rh.sulc.gii (sulcal underlay)
    - lh/rh.inflated.gii (legacy embedded scalars for older viewers)
    """
    if vertex_timeseries.ndim != 2:
        raise ValueError(f"expected (T, V), got {vertex_timeseries.shape}")
    if vertex_timeseries.shape[1] != N_VERTICES_FSAVERAGE5:
        raise ValueError(f"expected {N_VERTICES_FSAVERAGE5} vertices")

    mesh_dir = out_path.parent
    assets = ensure_fsaverage5_assets(ASSETS_DIR)

    lh_ts, rh_ts = split_hemispheres(vertex_timeseries)

    for surface in ("pial", "half", "inflated"):
        write_surface_geometry(surface, assets, mesh_dir)

    write_sulc_maps(assets, mesh_dir)
    _write_scalar_frames(lh_ts, mesh_dir / "lh.activations.gii")
    _write_scalar_frames(rh_ts, mesh_dir / "rh.activations.gii")

    return out_path


def copy_mesh_templates(web_mesh_dir: Path, assets_dir: Path | None = None) -> tuple[Path, Path]:
    """Stage lh/rh inflated geometry templates (overwritten by export)."""
    assets = ensure_fsaverage5_assets(assets_dir)
    web_mesh_dir.mkdir(parents=True, exist_ok=True)
    lh_dest = web_mesh_dir / "lh.inflated.gii"
    rh_dest = web_mesh_dir / "rh.inflated.gii"
    for src_key, dest in (("lh_infl", lh_dest), ("rh_infl", rh_dest)):
        save_gifti_uncompressed(load_gifti(assets[src_key]), dest)
    return lh_dest, rh_dest
