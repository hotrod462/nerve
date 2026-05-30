"""TRIBE v2 backend — audio-only inference in v1."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from nerve.device import audit_module_devices, build_device_report, resolve_device
from nerve.types import (
    BrainPrediction,
    DeviceReport,
    InferenceMode,
    Modality,
    StimulusSpec,
)

logger = logging.getLogger(__name__)

CHECKPOINT_CORTICAL = "facebook/tribev2"
CHECKPOINT_SUBCORTICAL = "facebook/tribev2-subcortical"


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

        from tribev2 import TribeModel

        logger.info(
            "Loading TRIBE from %s on device=%s",
            self.checkpoint,
            self._torch_device.type,
        )
        self._model = TribeModel.from_pretrained(
            self.checkpoint,
            cache_folder=str(self.cache_dir),
            device=self._torch_device.type,
            config_update=_tribe_config_device_overrides(self._torch_device.type),
        )
        modules = self._collect_audit_modules()
        self._device_report = build_device_report(
            requested=self.requested_device,
            resolved=self._torch_device,
            modules=audit_module_devices(modules),
        )
        fusion_dev = self._device_report.modules.get("tribe_fusion", "?")
        logger.info(
            "[nerve] device=%s (fusion=%s) · inference_mode=acoustic_only",
            self._device_report.resolved,
            fusion_dev,
        )
        if not self._device_report.device_ok:
            logger.warning(
                "Device audit warnings: %s",
                "; ".join(self._device_report.warnings) or "module mismatch",
            )

    def _collect_audit_modules(self) -> dict[str, Any]:
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

    def predict_audio(
        self,
        audio_path: str | Path,
        stimulus: StimulusSpec | None = None,
    ) -> BrainPrediction:
        """Run audio-only TRIBE inference; always uses audio_only=True."""
        from tribev2.demo_utils import get_audio_and_text_events

        audio_path = Path(audio_path)
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio not found: {audio_path}")

        self._load_model()

        if stimulus is None:
            stimulus = StimulusSpec(
                id=audio_path.stem,
                path=audio_path,
                modality=Modality.AUDIO,
            )

        event = {
            "type": "Audio",
            "filepath": str(audio_path.resolve()),
            "start": 0,
            "timeline": "default",
            "subject": "default",
        }
        events = get_audio_and_text_events(pd.DataFrame([event]), audio_only=True)
        preds, _segments = self._model.predict(events=events, verbose=True)

        metadata: dict[str, Any] = {
            "checkpoint": self.checkpoint,
            "device_report": self._device_report.to_dict()
            if self._device_report
            else None,
            "audio_only": True,
        }

        return BrainPrediction(
            data=preds,
            stimulus=stimulus,
            inference_mode=InferenceMode.ACOUSTIC_ONLY,
            metadata=metadata,
        )
