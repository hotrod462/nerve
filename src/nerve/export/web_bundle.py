"""Export run artifacts to Next.js-readable web bundle."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

from nerve.analysis.acoustic_features import try_extract_acoustic_features
from nerve.analysis.contrast import compute_contrast
from nerve.analysis.engagement import compute_engagement
from nerve.analysis.subcortical_engagement import compute_subcortical_engagement
from nerve.export.atlas_export import export_atlas_mesh
from nerve.export.gifti_writer import (
    copy_mesh_templates,
    ensure_fsaverage5_assets,
    write_scalars_4d_gifti,
)
from nerve.export.subcortical_mesh import export_subcortical_meshes
from nerve.export.npz_io import (
    load_contrast,
    load_prediction,
    load_subcortical_prediction,
    write_run_manifest,
)
from nerve.parcellation.schaefer import YEO_NETWORK_ORDER, SchaeferParcellation
from nerve.types import (
    BrainPrediction,
    ContrastResult,
    N_VERTICES_FSAVERAGE5,
    SubcorticalPrediction,
    split_hemispheres,
)

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[4]
ASSETS_FSAVERAGE5 = REPO_ROOT / "data" / "assets" / "fsaverage5"


def _vmin_vmax(data: np.ndarray, symmetric: bool = False) -> tuple[float, float]:
    """Meta-style range: floor at 0, cap at 95th pct of positive values (red-heavy, sparse yellow)."""
    if symmetric:
        m = float(np.percentile(np.abs(data), 99))
        return (-m, m)
    positive = data[data > 0]
    if positive.size > 0:
        hi = float(np.percentile(positive, 95))
    else:
        hi = float(np.percentile(data, 99))
    return (0.0, max(hi, 1e-6))


def _parcel_json(parceler: SchaeferParcellation, vertex_ts: np.ndarray) -> dict[str, Any]:
    parcels = parceler.aggregate(vertex_ts)
    if parcels.ndim == 2:
        parcels = parcels.tolist()
    else:
        parcels = parcels.tolist()
    return {
        "n_parcels": parceler.n_parcels,
        "n_trs": vertex_ts.shape[0],
        "data": parcels,
        "labels": parceler.labels(),
        "networks": parceler.parcel_networks(),
    }


def _write_vertex_yeo_json(parceler: SchaeferParcellation, matrices_dir: Path) -> None:
    """Per-vertex macro Yeo IDs (1–7) for client-side map masking."""
    yeo_ids = parceler.vertex_yeo_ids(macro=True)
    lh_yeo, rh_yeo = split_hemispheres(yeo_ids)
    doc = {
        "yeo_order": list(YEO_NETWORK_ORDER),
        "macro_order": list(YEO_NETWORK_ORDER),
        "lh": lh_yeo.astype(np.int16).tolist(),
        "rh": rh_yeo.astype(np.int16).tolist(),
    }
    (matrices_dir / "vertex_yeo.json").write_text(
        json.dumps(doc),
        encoding="utf-8",
    )


def _write_engagement_json(
    parceler: SchaeferParcellation,
    vertex_ts: np.ndarray,
    matrices_dir: Path,
    inference_mode: str = "acoustic_only",
) -> None:
    parcels = parceler.aggregate(vertex_ts)
    doc = compute_engagement(
        parcels,
        parceler.parcel_networks(),
        n_parcels=parceler.n_parcels,
        yeo_networks=parceler.yeo_networks,
        inference_mode=inference_mode,
    )
    (matrices_dir / "engagement.json").write_text(
        json.dumps(doc),
        encoding="utf-8",
    )


def _write_subcortical_engagement_json(
    subcortical: SubcorticalPrediction,
    matrices_dir: Path,
) -> None:
    # TRIBE outputs (T, n_voxels); ROI aggregation expects (n_voxels, T).
    voxels = subcortical.data.T
    doc = compute_subcortical_engagement(
        voxels,
        inference_mode=subcortical.inference_mode.value,
    )
    (matrices_dir / "subcortical_engagement.json").write_text(
        json.dumps(doc),
        encoding="utf-8",
    )


def _resolve_stimulus_wav(stimulus_path: str | None) -> Path | None:
    if not stimulus_path:
        return None
    path = Path(stimulus_path)
    if path.is_file():
        return path
    repo_path = REPO_ROOT / path
    if repo_path.is_file():
        return repo_path
    return None


def prefer_mp3_stimulus_path(
    resolved_wav: Path,
    fallback: str | Path,
    repo_root: Path | None = None,
) -> str:
    """Use a sibling .mp3 for web playback when present; keep WAV for inference/export."""
    root = repo_root or REPO_ROOT
    mp3 = resolved_wav.with_suffix(".mp3")
    if mp3.is_file():
        try:
            return str(mp3.relative_to(root)).replace("\\", "/")
        except ValueError:
            return str(mp3).replace("\\", "/")
    return str(fallback).replace("\\", "/")


def export_web_bundle(
    run_dir: str | Path,
    n_parcels: int = 400,
    yeo_networks: int = 17,
    colormap: str = "redyell",
) -> Path:
    """
    Write GIfTI 4D + JSON matrices to {run_dir}/web/.

    Accepts prediction-only or contrast runs.
    """
    run_dir = Path(run_dir)
    web_dir = run_dir / "web"
    mesh_dir = web_dir / "mesh"
    matrices_dir = web_dir / "matrices"
    mesh_dir.mkdir(parents=True, exist_ok=True)
    matrices_dir.mkdir(parents=True, exist_ok=True)

    pred_path = run_dir / "prediction.npz"
    subcortical_path = run_dir / "prediction_subcortical.npz"
    contrast_path = run_dir / "contrast.npz"

    prediction: BrainPrediction | None = None
    subcortical: SubcorticalPrediction | None = None
    contrast: ContrastResult | None = None

    if pred_path.is_file():
        prediction = load_prediction(pred_path)
    if subcortical_path.is_file():
        subcortical = load_subcortical_prediction(subcortical_path)
    if contrast_path.is_file():
        contrast = load_contrast(contrast_path)

    if prediction is None and contrast is None:
        raise FileNotFoundError(
            f"No prediction.npz or contrast.npz in {run_dir}"
        )

    parceler = SchaeferParcellation(n_parcels=n_parcels, yeo_networks=yeo_networks)
    lh_mesh, rh_mesh = copy_mesh_templates(mesh_dir, ASSETS_FSAVERAGE5)
    assets = ensure_fsaverage5_assets(ASSETS_FSAVERAGE5)
    atlas_manifest = export_atlas_mesh(mesh_dir, matrices_dir, parceler)
    _write_vertex_yeo_json(parceler, matrices_dir)

    manifest: dict[str, Any] = {
        "run_id": run_dir.name,
        "n_vertices": N_VERTICES_FSAVERAGE5,
        "fps": 1,
        "colormap": colormap,
        "space": "fsaverage5",
        "inference_mode": "acoustic_only",
        "default_surface": "pial",
        "mesh": {
            "surfaces": {
                "pial": {"lh": "mesh/lh.pial.gii", "rh": "mesh/rh.pial.gii"},
                "half": {"lh": "mesh/lh.half.gii", "rh": "mesh/rh.half.gii"},
                "inflated": {"lh": "mesh/lh.inflated.gii", "rh": "mesh/rh.inflated.gii"},
            },
            "activations": {
                "lh": "mesh/lh.activations.gii",
                "rh": "mesh/rh.activations.gii",
            },
            "sulc": {"lh": "mesh/lh.sulc.gii", "rh": "mesh/rh.sulc.gii"},
            "atlas": atlas_manifest,
        },
    }

    if prediction is not None:
        ts = prediction.data
        manifest["stimulus"] = prediction.stimulus.to_dict()
        wav_path = _resolve_stimulus_wav(prediction.stimulus.path)
        if wav_path is not None:
            manifest["stimulus"]["path"] = prefer_mp3_stimulus_path(
                wav_path,
                prediction.stimulus.path,
            )
        manifest["T"] = int(ts.shape[0])
        vmin, vmax = _vmin_vmax(ts)
        manifest["vmin"] = vmin
        manifest["vmax"] = vmax
        if prediction.device_report:
            manifest["device_report"] = prediction.device_report.to_dict()
        elif prediction.metadata.get("device_report"):
            manifest["device_report"] = prediction.metadata["device_report"]

        write_scalars_4d_gifti(ts, mesh_dir / "scalars_4d.gii", lh_mesh, rh_mesh)

        import nibabel as nib

        sulc_lh = np.asarray(nib.load(str(assets["lh_sulc"])).darrays[0].data)
        sulc_rh = np.asarray(nib.load(str(assets["rh_sulc"])).darrays[0].data)
        sulc_all = np.concatenate([sulc_lh, sulc_rh])
        manifest["mesh"]["sulc_range"] = {
            "min": float(sulc_all.min()),
            "max": float(sulc_all.max()),
        }
        (matrices_dir / "parcel_time.json").write_text(
            json.dumps(_parcel_json(parceler, ts)),
            encoding="utf-8",
        )
        (matrices_dir / "parcel_labels.json").write_text(
            json.dumps(
                {"labels": parceler.labels(), "networks": parceler.parcel_networks()},
            ),
            encoding="utf-8",
        )
        _write_engagement_json(
            parceler,
            ts,
            matrices_dir,
            inference_mode=prediction.inference_mode.value,
        )
        acoustic = try_extract_acoustic_features(
            wav_path,
            wav_path,
            n_trs=int(ts.shape[0]),
            fps=manifest.get("fps", 1),
        )
        manifest["matrices"] = {
            "engagement": "matrices/engagement.json",
            "vertex_yeo": "matrices/vertex_yeo.json",
            "atlas": "matrices/atlas.json",
        }
        if subcortical is not None:
            _write_subcortical_engagement_json(subcortical, matrices_dir)
            manifest["matrices"]["subcortical_engagement"] = (
                "matrices/subcortical_engagement.json"
            )
            sub_mesh = export_subcortical_meshes(subcortical, mesh_dir)
            manifest["mesh"]["subcortical"] = sub_mesh
            manifest["subcortical"] = {
                "n_voxels": int(subcortical.data.shape[1]),
                "space": subcortical.space,
                "vmin": sub_mesh["vmin"],
                "vmax": sub_mesh["vmax"],
            }
        if acoustic is not None:
            (matrices_dir / "acoustic_features.json").write_text(
                json.dumps(acoustic),
                encoding="utf-8",
            )
            manifest["matrices"]["acoustic_features"] = "matrices/acoustic_features.json"

    if contrast is not None:
        vm = contrast.vertex_map
        if vm.ndim == 1:
            vm = vm[None, :]
        manifest["contrast"] = {
            "a": contrast.stimulus_a_id,
            "b": contrast.stimulus_b_id,
            "metadata": contrast.metadata,
        }
        manifest["contrast_colormap"] = "cold_hot"
        vmin, vmax = _vmin_vmax(vm, symmetric=True)
        manifest["contrast_vmin"] = vmin
        manifest["contrast_vmax"] = vmax

        contrast_dir = matrices_dir / "contrast"
        contrast_dir.mkdir(exist_ok=True)
        write_scalars_4d_gifti(
            vm, contrast_dir / "scalars_4d.gii", lh_mesh, rh_mesh
        )
        (contrast_dir / "parcel_time.json").write_text(
            json.dumps(_parcel_json(parceler, vm)),
            encoding="utf-8",
        )
        _write_engagement_json(parceler, vm, contrast_dir, inference_mode="contrast")

    write_run_manifest(web_dir, manifest)
    logger.info("Exported web bundle to %s", web_dir)
    return web_dir


def export_multi_stimulus_matrix(
    run_dirs: list[Path],
    out_dir: Path,
    n_parcels: int = 400,
) -> None:
    """Build stimulus×parcel matrix JSON for /matrix page."""
    parceler = SchaeferParcellation(n_parcels=n_parcels, yeo_networks=17)
    rows = []
    ids = []
    for rd in run_dirs:
        pred_path = rd / "prediction.npz"
        if not pred_path.is_file():
            continue
        pred = load_prediction(pred_path)
        parcels = parceler.aggregate(pred.data)
        if parcels.ndim == 2:
            mean_parcels = parcels.mean(axis=1)
        else:
            mean_parcels = parcels
        rows.append(mean_parcels.tolist())
        ids.append(pred.stimulus.id)

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "stimulus_parcel.json").write_text(
        json.dumps({"stimulus_ids": ids, "data": rows, "n_parcels": n_parcels}),
        encoding="utf-8",
    )
