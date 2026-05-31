"""TRIBE v2 backend — cortical + subcortical audio-only inference."""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
import torch
import yaml
from exca import ConfDict

from nerve.device import audit_module_devices, build_device_report, resolve_device
from nerve.types import (
    BrainPrediction,
    DeviceReport,
    DualBrainPrediction,
    InferenceMode,
    Modality,
    N_VOXELS_SUBCORTICAL,
    StimulusSpec,
    SubcorticalPrediction,
)

logger = logging.getLogger(__name__)

CHECKPOINT_CORTICAL = "facebook/tribev2"
CHECKPOINT_SUBCORTICAL = "facebook/tribev2-subcortical"

_DEFAULT_BUILD_ARGS = {
    "feature_dims": {
        "text": (2, 3072),
        "audio": (2, 1024),
        "video": (2, 1408),
    },
    "n_output_timesteps": 100,
}


def _extractor_device(resolved: str) -> str:
    """neuralset extractors only accept auto/cpu/cuda/accelerate — not mps."""
    if resolved == "cuda":
        return "cuda"
    return "cpu"


def _tribe_config_device_overrides(resolved: str) -> dict[str, str]:
    """TRIBE HF config.yaml hardcodes cuda; override extractors on Mac."""
    ext = _extractor_device(resolved)
    return {
        "data.audio_feature.device": ext,
        "data.text_feature.device": ext,
        "data.video_feature.image.device": ext,
    }


def _infer_build_args(ckpt: dict) -> dict:
    if "model_build_args" in ckpt:
        return dict(ckpt["model_build_args"])

    sd = ckpt["state_dict"]
    if "model.predictor.weights" in sd:
        n_outputs = int(sd["model.predictor.weights"].shape[-1])
    elif "model.predictor.bias" in sd:
        n_outputs = int(sd["model.predictor.bias"].shape[-1])
    else:
        raise KeyError("Cannot infer TRIBE model build args from checkpoint")

    return {**_DEFAULT_BUILD_ARGS, "n_outputs": n_outputs}


def _load_tribe_model(
    checkpoint: str,
    *,
    cache_dir: Path,
    device_type: str,
    config_overrides: dict[str, str] | None = None,
):
    from tribev2 import TribeModel

    config_path: Path | str
    ckpt_path: Path | str
    checkpoint_path = Path(checkpoint)
    if checkpoint_path.exists():
        config_path = checkpoint_path / "config.yaml"
        ckpt_path = checkpoint_path / "best.ckpt"
    else:
        from huggingface_hub import hf_hub_download

        repo_id = str(checkpoint)
        config_path = hf_hub_download(repo_id, "config.yaml")
        ckpt_path = hf_hub_download(repo_id, "best.ckpt")

    with open(config_path, "r") as f:
        config = ConfDict(yaml.load(f, Loader=yaml.UnsafeLoader))

    for modality in ["text", "audio", "video"]:
        config[f"data.{modality}_feature.infra.folder"] = str(cache_dir)
        config[f"data.{modality}_feature.infra.cluster"] = None

    for param in [
        "infra.workdir",
        "data.study.infra_timelines",
        "data.neuro.infra",
        "data.image_feature.infra",
    ]:
        config.pop(param, None)
    config["data.study.path"] = "."
    config["average_subjects"] = True
    config["checkpoint_path"] = str(ckpt_path)
    config["cache_folder"] = str(cache_dir)
    if config_overrides:
        config.update(config_overrides)

    xp = TribeModel(**config)
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    build_args = _infer_build_args(ckpt)
    state_dict = {k.removeprefix("model."): v for k, v in ckpt["state_dict"].items()}

    model = xp.brain_model_config.build(**build_args)
    model.load_state_dict(state_dict, strict=True, assign=True)
    model.to(device_type)
    model.eval()
    xp._model = model
    return xp, build_args


class TribeBackend:
    """Wrap TribeModel with Nerve device policy and audio_only=True always."""

    def __init__(
        self,
        cache_dir: str | Path = "./data/features",
        device: str = "auto",
        checkpoint: str = CHECKPOINT_CORTICAL,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.requested_device = device
        self._torch_device = resolve_device(device)
        self.checkpoint = checkpoint
        self._model = None
        self._device_report: DeviceReport | None = None

    @property
    def resolved_device(self) -> str:
        return self._torch_device.type

    @property
    def device_report(self) -> DeviceReport | None:
        return self._device_report

    def _load_model(self) -> None:
        if self._model is not None:
            return

        logger.info(
            "Loading TRIBE from %s on device=%s",
            self.checkpoint,
            self._torch_device.type,
        )
        overrides = _tribe_config_device_overrides(self._torch_device.type)
        self._model, _ = _load_tribe_model(
            self.checkpoint,
            cache_dir=self.cache_dir,
            device_type=self._torch_device.type,
            config_overrides=overrides,
        )
        modules = self._collect_audit_modules()
        self._device_report = build_device_report(
            requested=self.requested_device,
            resolved=self._torch_device,
            modules=audit_module_devices(modules),
        )
        fusion_dev = self._device_report.modules.get("tribe_fusion", "?")
        logger.info(
            "[nerve] device=%s (fusion=%s) · checkpoint=%s · inference_mode=acoustic_only",
            self._device_report.resolved,
            fusion_dev,
            self.checkpoint,
        )
        if not self._device_report.device_ok:
            logger.warning(
                "Device audit warnings: %s",
                "; ".join(self._device_report.warnings) or "module mismatch",
            )

    def _collect_audit_modules(self) -> dict:
        import torch.nn as nn

        modules: dict[str, nn.Module] = {}
        if self._model is None:
            return modules
        if getattr(self._model, "_model", None) is not None:
            modules["tribe_fusion"] = self._model._model
        data = getattr(self._model, "data", None)
        if data is not None:
            audio_feat = getattr(data, "audio_feature", None)
            if audio_feat is not None:
                extractor = getattr(audio_feat, "extractor", None) or getattr(
                    audio_feat, "_extractor", None
                )
                if extractor is not None:
                    modules["wav2vec"] = extractor
        return modules

    def _run_predict(
        self,
        audio_path: Path,
        *,
        checkpoint: str,
        space: str,
        expected_width: int,
    ) -> tuple:
        from tribev2.demo_utils import get_audio_and_text_events

        backend = TribeBackend(
            cache_dir=self.cache_dir,
            device=self.requested_device,
            checkpoint=checkpoint,
        )
        backend._load_model()

        event = {
            "type": "Audio",
            "filepath": str(audio_path.resolve()),
            "start": 0,
            "timeline": "default",
            "subject": "default",
        }
        events = get_audio_and_text_events(pd.DataFrame([event]), audio_only=True)
        preds, _segments = backend._model.predict(events=events, verbose=True)

        if preds.shape[1] != expected_width:
            raise ValueError(
                f"{checkpoint} returned shape {preds.shape}, "
                f"expected (*, {expected_width})"
            )

        metadata = {
            "checkpoint": checkpoint,
            "device_report": backend.device_report.to_dict()
            if backend.device_report
            else None,
            "audio_only": True,
            "space": space,
        }
        return preds, metadata, backend.device_report

    def predict_audio(
        self,
        audio_path: str | Path,
        stimulus: StimulusSpec | None = None,
    ) -> BrainPrediction:
        """Run cortical TRIBE inference; always uses audio_only=True."""
        audio_path = Path(audio_path)
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio not found: {audio_path}")

        if stimulus is None:
            stimulus = StimulusSpec(
                id=audio_path.stem,
                path=audio_path,
                modality=Modality.AUDIO,
            )

        preds, metadata, device_report = self._run_predict(
            audio_path,
            checkpoint=CHECKPOINT_CORTICAL,
            space="cortical_fsaverage5",
            expected_width=20484,
        )
        self._device_report = device_report

        return BrainPrediction(
            data=preds,
            stimulus=stimulus,
            inference_mode=InferenceMode.ACOUSTIC_ONLY,
            metadata=metadata,
        )

    def predict_subcortical_audio(
        self,
        audio_path: str | Path,
        stimulus: StimulusSpec | None = None,
    ) -> SubcorticalPrediction:
        """Run subcortical TRIBE inference; always uses audio_only=True."""
        audio_path = Path(audio_path)
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio not found: {audio_path}")

        if stimulus is None:
            stimulus = StimulusSpec(
                id=audio_path.stem,
                path=audio_path,
                modality=Modality.AUDIO,
            )

        preds, metadata, device_report = self._run_predict(
            audio_path,
            checkpoint=CHECKPOINT_SUBCORTICAL,
            space="subcortical_harvard_oxford",
            expected_width=N_VOXELS_SUBCORTICAL,
        )
        self._device_report = device_report

        return SubcorticalPrediction(
            data=preds,
            stimulus=stimulus,
            inference_mode=InferenceMode.ACOUSTIC_ONLY,
            metadata=metadata,
        )

    def predict_full_audio(
        self,
        audio_path: str | Path,
        stimulus: StimulusSpec | None = None,
    ) -> DualBrainPrediction:
        """Run cortical then subcortical TRIBE inference on the same audio."""
        audio_path = Path(audio_path)
        if stimulus is None:
            stimulus = StimulusSpec(
                id=audio_path.stem,
                path=audio_path,
                modality=Modality.AUDIO,
            )

        cortical = self.predict_audio(audio_path, stimulus=stimulus)
        subcortical = self.predict_subcortical_audio(audio_path, stimulus=stimulus)
        if cortical.n_trs != subcortical.n_trs:
            logger.warning(
                "Cortical T=%d != subcortical T=%d — truncating to min",
                cortical.n_trs,
                subcortical.n_trs,
            )
            n = min(cortical.n_trs, subcortical.n_trs)
            cortical.data = cortical.data[:n]
            subcortical.data = subcortical.data[:n]

        return DualBrainPrediction(cortical=cortical, subcortical=subcortical)
