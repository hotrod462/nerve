"""Schaefer / Yeo atlas export for Niivue mesh label overlays."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
from nibabel import gifti

from nerve.export.border_edges import write_border_edges
from nerve.export.gifti_writer import ensure_fsaverage5_assets, save_gifti_uncompressed
from nerve.export.region_labels import write_yeo_region_labels
from nerve.parcellation.schaefer import (
    YEO_17_NETWORK_ORDER,
    YEO_17_TO_MACRO,
    YEO_NETWORK_ORDER,
    SchaeferParcellation,
    yeo_network_order,
)
from nerve.types import split_hemispheres

logger = logging.getLogger(__name__)

# Connectome Workbench / Schaefer 2018 canonical Yeo-7 colors (RGB 0–255).
YEO_RGB: dict[str, tuple[int, int, int]] = {
    "Vis": (120, 18, 134),
    "SomMot": (70, 130, 180),
    "DorsAttn": (0, 118, 14),
    "SalVentAttn": (230, 148, 34),
    "Limbic": (220, 0, 115),
    "Cont": (120, 94, 224),
    "Default": (255, 0, 0),
}

YEO_17_RGB: dict[str, tuple[int, int, int]] = {
    "VisCent": (120, 18, 134),
    "VisPeri": (160, 60, 170),
    "SomMotA": (70, 130, 180),
    "SomMotB": (110, 160, 205),
    "DorsAttnA": (0, 118, 14),
    "DorsAttnB": (40, 160, 50),
    "SalVentAttnA": (230, 148, 34),
    "SalVentAttnB": (255, 190, 90),
    "LimbicA": (220, 0, 115),
    "LimbicB": (255, 80, 150),
    "ContA": (120, 94, 224),
    "ContB": (150, 120, 235),
    "ContC": (180, 150, 245),
    "DefaultA": (255, 0, 0),
    "DefaultB": (255, 80, 80),
    "DefaultC": (255, 130, 130),
    "TempPar": (200, 40, 40),
}


def _short_parcel_name(label: str) -> str:
    """Turn '7Networks_LH_Vis_1' into 'LH Vis 1'."""
    parts = str(label).split("_")
    if len(parts) >= 4:
        return f"{parts[1]} {parts[2]} {parts[3]}"
    return str(label)


def _parcel_rgb(parcel_idx: int) -> tuple[int, int, int]:
    """Distinct hue per parcel (golden-angle spacing)."""
    hue = (parcel_idx * 137.508) % 360.0
    sat = 0.62
    light = 0.52
    c = (1.0 - abs(2.0 * light - 1.0)) * sat
    x = c * (1.0 - abs((hue / 60.0) % 2.0 - 1.0))
    m = light - c / 2.0
    if hue < 60:
        r, g, b = c, x, 0.0
    elif hue < 120:
        r, g, b = x, c, 0.0
    elif hue < 180:
        r, g, b = 0.0, c, x
    elif hue < 240:
        r, g, b = 0.0, x, c
    elif hue < 300:
        r, g, b = x, 0.0, c
    else:
        r, g, b = c, 0.0, x
    return (
        int(round((r + m) * 255)),
        int(round((g + m) * 255)),
        int(round((b + m) * 255)),
    )


def _write_label_gifti(labels: np.ndarray, out_path: Path) -> Path:
    """Single-frame per-vertex integer labels as a GIfTI scalar overlay."""
    data = labels.astype(np.float32).reshape(-1, 1)
    img = gifti.GiftiImage()
    img.add_gifti_data_array(gifti.GiftiDataArray(data=data))
    save_gifti_uncompressed(img, out_path)
    return out_path


def _build_yeo_lut(network_order: list[str]) -> dict[str, Any]:
    palette = YEO_17_RGB if len(network_order) > 7 else YEO_RGB
    R, G, B, I, labels = [], [], [], [], []
    R.append(0)
    G.append(0)
    B.append(0)
    I.append(0)
    labels.append("")
    for net in network_order:
        rgb = palette.get(net, YEO_RGB.get(YEO_17_TO_MACRO.get(net, "Vis"), (128, 128, 128)))
        R.append(rgb[0])
        G.append(rgb[1])
        B.append(rgb[2])
        I.append(len(I))
        labels.append(net)
    return {"R": R, "G": G, "B": B, "I": I, "labels": labels}


def _build_parcel_lut(parceler: SchaeferParcellation) -> dict[str, Any]:
    labs = parceler.labels()
    networks = parceler.parcel_networks()
    R, G, B, I, labels = [], [], [], [], []
    R.append(0)
    G.append(0)
    B.append(0)
    I.append(0)
    labels.append("")
    for pid in range(1, parceler.n_parcels + 1):
        rgb = _parcel_rgb(pid)
        R.append(rgb[0])
        G.append(rgb[1])
        B.append(rgb[2])
        I.append(pid)
        short = _short_parcel_name(labs[pid - 1])
        net = networks[pid - 1]
        labels.append(f"{short} ({net})")
    return {"R": R, "G": G, "B": B, "I": I, "labels": labels}


def export_atlas_mesh(
    mesh_dir: Path,
    matrices_dir: Path,
    parceler: SchaeferParcellation,
) -> dict[str, Any]:
    """
    Write lh/rh parcel + Yeo label GIfTI overlays and Niivue LUT JSON.

    Returns manifest fragment for mesh.atlas + matrices.atlas path.
    """
    mesh_dir.mkdir(parents=True, exist_ok=True)
    matrices_dir.mkdir(parents=True, exist_ok=True)

    network_order = yeo_network_order(parceler.yeo_networks)
    parcel_ids = parceler.vertex_parcel_ids()
    yeo_ids = parceler.vertex_yeo_ids(macro=False)
    lh_parcels, rh_parcels = split_hemispheres(parcel_ids)
    lh_yeo, rh_yeo = split_hemispheres(yeo_ids)

    _write_label_gifti(lh_parcels, mesh_dir / "lh.parcels.gii")
    _write_label_gifti(rh_parcels, mesh_dir / "rh.parcels.gii")
    _write_label_gifti(lh_yeo, mesh_dir / "lh.yeo.gii")
    _write_label_gifti(rh_yeo, mesh_dir / "rh.yeo.gii")

    yeo_lut = _build_yeo_lut(network_order)
    parcel_lut = _build_parcel_lut(parceler)
    atlas_doc = {
        "atlas": "Schaefer2018",
        "n_parcels": parceler.n_parcels,
        "yeo_networks": parceler.yeo_networks,
        "yeo_lut": yeo_lut,
        "parcel_lut": parcel_lut,
        "yeo_order": list(network_order),
        "macro_order": list(YEO_NETWORK_ORDER),
    }
    atlas_path = matrices_dir / "atlas.json"
    atlas_path.write_text(json.dumps(atlas_doc), encoding="utf-8")

    atlas_sub = matrices_dir / "atlas"
    assets = ensure_fsaverage5_assets()
    lh_geom = assets["lh_pial"]
    rh_geom = assets["rh_pial"]

    border_manifest = {
        "yeo": {
            "lh": "matrices/atlas/yeo_lh_edges.json",
            "rh": "matrices/atlas/yeo_rh_edges.json",
        },
        "parcels": {
            "lh": "matrices/atlas/parcels_lh_edges.json",
            "rh": "matrices/atlas/parcels_rh_edges.json",
        },
    }
    write_border_edges(lh_geom, lh_yeo, atlas_sub / "yeo_lh_edges.json")
    write_border_edges(rh_geom, rh_yeo, atlas_sub / "yeo_rh_edges.json")
    write_border_edges(lh_geom, lh_parcels, atlas_sub / "parcels_lh_edges.json")
    write_border_edges(rh_geom, rh_parcels, atlas_sub / "parcels_rh_edges.json")

    write_yeo_region_labels(
        lh_geom, lh_yeo, list(network_order), atlas_sub / "labels_lh.json", hemi="lh"
    )
    write_yeo_region_labels(
        rh_geom, rh_yeo, list(network_order), atlas_sub / "labels_rh.json", hemi="rh"
    )

    logger.info("Wrote cortical atlas overlays to %s", mesh_dir)

    return {
        "parcels": {"lh": "mesh/lh.parcels.gii", "rh": "mesh/rh.parcels.gii"},
        "yeo": {"lh": "mesh/lh.yeo.gii", "rh": "mesh/rh.yeo.gii"},
        "lut": "matrices/atlas.json",
        "borders": border_manifest,
        "region_labels": {
            "lh": "matrices/atlas/labels_lh.json",
            "rh": "matrices/atlas/labels_rh.json",
        },
    }
