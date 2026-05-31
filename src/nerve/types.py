"""Canonical data types for Nerve runs and artifacts."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import numpy as np

# fsaverage5: 10242 lh + 10242 rh
N_VERTICES_FSAVERAGE5 = 20484
N_VERTICES_LH = 10242
N_VERTICES_RH = 10242
N_VOXELS_SUBCORTICAL = 8808
TR_SECONDS = 1.0


class InferenceMode(str, Enum):
    ACOUSTIC_ONLY = "acoustic_only"
    WITH_LYRICS = "with_lyrics"  # v2 — not used in v1


class Modality(str, Enum):
    AUDIO = "audio"
    VIDEO = "video"
    TEXT = "text"


@dataclass
class DeviceReport:
    requested: str
    resolved: str
    mps_available: bool
    mps_built: bool
    fallback_env: bool
    modules: dict[str, str] = field(default_factory=dict)
    forward_trace: dict[str, str] | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def device_ok(self) -> bool:
        if self.resolved == "cpu" and self.requested in ("mps", "auto"):
            return self.requested == "auto"
        if self.resolved == "mps":
            critical = [v for k, v in self.modules.items() if k in ("tribe_fusion", "wav2vec")]
            return all(v == "mps" for v in critical) if critical else True
        return True

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["device_ok"] = self.device_ok
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DeviceReport:
        data = dict(data)
        data.pop("device_ok", None)
        defaults = {
            "requested": "auto",
            "resolved": "cpu",
            "mps_available": False,
            "mps_built": False,
            "fallback_env": False,
            "modules": {},
            "forward_trace": None,
            "warnings": [],
        }
        for k, v in data.items():
            if k in cls.__dataclass_fields__:
                defaults[k] = v
        return cls(**defaults)  # type: ignore[arg-type]


@dataclass
class StimulusSpec:
    id: str
    path: str | Path
    modality: Modality = Modality.AUDIO
    genre: str | None = None
    license: str | None = None
    source_url: str | None = None
    user_supplied: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "path": str(self.path),
            "modality": self.modality.value,
            "genre": self.genre,
            "license": self.license,
            "source_url": self.source_url,
            "user_supplied": self.user_supplied,
            "metadata": self.metadata,
        }


@dataclass
class BrainPrediction:
    """Predicted BOLD on fsaverage5: shape (T, 20484)."""

    data: np.ndarray  # (T, N_VERTICES)
    stimulus: StimulusSpec
    inference_mode: InferenceMode = InferenceMode.ACOUSTIC_ONLY
    tr: float = TR_SECONDS
    space: str = "cortical_fsaverage5"
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.data.ndim != 2:
            raise ValueError(f"data must be 2D (T, V), got shape {self.data.shape}")
        if self.data.shape[1] != N_VERTICES_FSAVERAGE5:
            raise ValueError(
                f"expected {N_VERTICES_FSAVERAGE5} vertices, got {self.data.shape[1]}"
            )

    @property
    def n_trs(self) -> int:
        return int(self.data.shape[0])

    @property
    def device_report(self) -> DeviceReport | None:
        raw = self.metadata.get("device_report")
        if raw is None:
            return None
        if isinstance(raw, DeviceReport):
            return raw
        return DeviceReport.from_dict(raw)

    def save(self, path: str | Path) -> Path:
        from nerve.export.npz_io import save_prediction

        return save_prediction(self, path)

    @classmethod
    def load(cls, path: str | Path) -> BrainPrediction:
        from nerve.export.npz_io import load_prediction

        return load_prediction(path)


@dataclass
class SubcorticalPrediction:
    """Predicted BOLD in Harvard-Oxford subcortical mask voxels: shape (T, 8808)."""

    data: np.ndarray  # (T, N_VOXELS_SUBCORTICAL)
    stimulus: StimulusSpec
    inference_mode: InferenceMode = InferenceMode.ACOUSTIC_ONLY
    tr: float = TR_SECONDS
    space: str = "subcortical_harvard_oxford"
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.data.ndim != 2:
            raise ValueError(f"data must be 2D (T, V), got shape {self.data.shape}")
        if self.data.shape[1] != N_VOXELS_SUBCORTICAL:
            raise ValueError(
                f"expected {N_VOXELS_SUBCORTICAL} subcortical voxels, "
                f"got {self.data.shape[1]}"
            )

    @property
    def n_trs(self) -> int:
        return int(self.data.shape[0])

    @property
    def device_report(self) -> DeviceReport | None:
        raw = self.metadata.get("device_report")
        if raw is None:
            return None
        if isinstance(raw, DeviceReport):
            return raw
        return DeviceReport.from_dict(raw)

    def save(self, path: str | Path) -> Path:
        from nerve.export.npz_io import save_subcortical_prediction

        return save_subcortical_prediction(self, path)

    @classmethod
    def load(cls, path: str | Path) -> SubcorticalPrediction:
        from nerve.export.npz_io import load_subcortical_prediction

        return load_subcortical_prediction(path)


@dataclass
class DualBrainPrediction:
    """Cortical + subcortical TRIBE predictions from the same stimulus."""

    cortical: BrainPrediction
    subcortical: SubcorticalPrediction


@dataclass
class ContrastResult:
    """Vertex-wise contrast A − B over time."""

    vertex_map: np.ndarray  # (T, 20484) or (20484,) if aggregated
    stimulus_a_id: str
    stimulus_b_id: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def save(self, path: str | Path) -> Path:
        from nerve.export.npz_io import save_contrast

        return save_contrast(self, path)

    @classmethod
    def load(cls, path: str | Path) -> ContrastResult:
        from nerve.export.npz_io import load_contrast

        return load_contrast(path)


def split_hemispheres(vertices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Split (..., 20484) into lh (..., 10242) and rh (..., 10242)."""
    if vertices.shape[-1] != N_VERTICES_FSAVERAGE5:
        raise ValueError(f"expected last dim {N_VERTICES_FSAVERAGE5}, got {vertices.shape[-1]}")
    return vertices[..., :N_VERTICES_LH], vertices[..., N_VERTICES_LH:]


def stack_hemispheres(lh: np.ndarray, rh: np.ndarray) -> np.ndarray:
    return np.concatenate([lh, rh], axis=-1)
