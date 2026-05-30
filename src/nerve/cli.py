"""Nerve CLI — predict, contrast, export-web, doctor."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from nerve import __version__
from nerve.analysis.contrast import compute_contrast
from nerve.backends.tribe_v2 import TribeBackend
from nerve.device import build_device_report, resolve_device, smoke_matmul
from nerve.export.npz_io import load_prediction, save_contrast, save_prediction, write_run_manifest
from nerve.export.web_bundle import export_web_bundle
from nerve.types import Modality, StimulusSpec

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CACHE = REPO_ROOT / "data" / "features"
DEFAULT_OUTPUTS = REPO_ROOT / "data" / "outputs"


def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s - %(message)s")


def _load_manifest_tracks(manifest_path: Path) -> list[dict]:
    import yaml

    with open(manifest_path, encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    return doc.get("tracks", [])


def cmd_predict(args: argparse.Namespace) -> int:
    audio = Path(args.audio)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    cache = Path(args.cache or os.environ.get("NERVE_CACHE", DEFAULT_CACHE))
    device = args.device or os.environ.get("NERVE_DEVICE", "auto")

    stimulus = None
    if args.stimulus_id:
        stimulus = StimulusSpec(id=args.stimulus_id, path=audio, modality=Modality.AUDIO)

    backend = TribeBackend(cache_dir=cache, device=device)
    pred = backend.predict_audio(audio, stimulus=stimulus)
    save_prediction(pred, out / "prediction.npz")

    manifest = {
        "command": "predict",
        "stimulus": pred.stimulus.to_dict(),
        "shape": list(pred.data.shape),
        "inference_mode": pred.inference_mode.value,
        "device_report": pred.metadata.get("device_report"),
    }
    write_run_manifest(out, manifest)

    dr = pred.device_report
    if dr:
        print(
            f"[nerve] device={dr.resolved} · inference_mode=acoustic_only · "
            f"shape={pred.data.shape}"
        )
        if not dr.device_ok:
            print("[nerve] WARNING: device_ok=false — see manifest for details", file=sys.stderr)
    return 0


def cmd_contrast(args: argparse.Namespace) -> int:
    run_a = Path(args.a)
    run_b = Path(args.b)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    pred_a = load_prediction(run_a)
    pred_b = load_prediction(run_b)
    window = (args.window_start, args.window_end)
    result = compute_contrast(pred_a, pred_b, window=window, aggregate=args.aggregate)
    save_contrast(result, out / "contrast.npz")

    manifest = {
        "command": "contrast",
        "a": pred_a.stimulus.to_dict(),
        "b": pred_b.stimulus.to_dict(),
        "metadata": result.metadata,
    }
    write_run_manifest(out, manifest)
    print(f"[nerve] contrast saved · L2={result.metadata.get('temporal_divergence_l2', 0):.4f}")
    return 0


def cmd_export_web(args: argparse.Namespace) -> int:
    run_dir = Path(args.run)
    export_web_bundle(run_dir, n_parcels=args.parcels)
    print(f"[nerve] export-web → {run_dir / 'web'}")
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    import torch

    requested = args.device or os.environ.get("NERVE_DEVICE", "auto")
    try:
        device = resolve_device(requested)
    except RuntimeError as e:
        print(f"Nerve doctor\n  ERROR: {e}")
        return 1

    print("Nerve doctor")
    print(f"  PyTorch {torch.__version__} · nerve {__version__}")
    print(
        f"  MPS available: {torch.backends.mps.is_available() if hasattr(torch.backends, 'mps') else False} · "
        f"built: {torch.backends.mps.is_built() if hasattr(torch.backends, 'mps') else False} · "
        f"fallback env: {os.environ.get('PYTORCH_ENABLE_MPS_FALLBACK', '') == '1'}"
    )
    print(f"  Resolved device: {device.type}")

    elapsed = smoke_matmul(device) * 1000
    print(f"  Smoke matmul on {device.type}: {elapsed:.1f} ms")

    report = build_device_report(
        requested=requested,
        resolved=device,
        modules={"smoke": device.type},
    )
    print(f"  Device OK: {report.device_ok}")

    if args.strict and requested == "mps" and device.type != "mps":
        return 1
    if args.strict and device.type == "mps" and not report.device_ok:
        return 1

    if args.audio:
        print(f"  Running TRIBE predict on {args.audio}...")
        backend = TribeBackend(
            cache_dir=Path(args.cache or DEFAULT_CACHE),
            device=requested,
        )
        pred = backend.predict_audio(args.audio)
        dr = pred.device_report
        if dr:
            print("  Module audit:")
            for k, v in dr.modules.items():
                print(f"    {k:14s} → {v}")
            print(f"  Predict shape: {pred.data.shape}")
            print(f"  Device OK: {dr.device_ok}")
            if args.strict and not dr.device_ok:
                return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="nerve", description="Nerve — TRIBE v2 interpretability")
    parser.add_argument("--version", action="version", version=f"nerve {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p_predict = sub.add_parser("predict", help="Run audio-only TRIBE inference")
    p_predict.add_argument("--audio", required=True, help="Path to WAV/audio file")
    p_predict.add_argument("--out", required=True, help="Output run directory")
    p_predict.add_argument("--device", default=None, choices=["auto", "mps", "cpu"])
    p_predict.add_argument("--cache", default=None, help="TRIBE feature cache dir")
    p_predict.add_argument("--stimulus-id", default=None)
    p_predict.set_defaults(func=cmd_predict)

    p_contrast = sub.add_parser("contrast", help="Contrast two prediction runs")
    p_contrast.add_argument("--a", required=True, help="Run dir A")
    p_contrast.add_argument("--b", required=True, help="Run dir B")
    p_contrast.add_argument("--out", required=True, help="Output contrast run dir")
    p_contrast.add_argument("--window-start", type=int, default=5)
    p_contrast.add_argument("--window-end", type=int, default=None)
    p_contrast.add_argument("--aggregate", action="store_true", help="Mean over window → (20484,)")
    p_contrast.set_defaults(func=cmd_contrast)

    p_export = sub.add_parser("export-web", help="Export GIfTI 4D bundle for web/")
    p_export.add_argument("--run", required=True, help="Run directory with prediction.npz")
    p_export.add_argument("--parcels", type=int, default=100)
    p_export.set_defaults(func=cmd_export_web)

    p_doctor = sub.add_parser("doctor", help="Device and environment smoke test")
    p_doctor.add_argument("--device", default="auto", choices=["auto", "mps", "cpu"])
    p_doctor.add_argument("--strict", action="store_true", help="Exit 1 if MPS not verified")
    p_doctor.add_argument("--audio", default=None, help="Optional short audio for full predict test")
    p_doctor.add_argument("--cache", default=None)
    p_doctor.set_defaults(func=cmd_doctor)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    _setup_logging(args.verbose)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
