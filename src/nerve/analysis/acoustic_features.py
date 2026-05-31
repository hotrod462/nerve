"""Lightweight MIR features synced to TRIBE 1 Hz TRs (Alluri-style overlay)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

logger = logging.getLogger(__name__)

FEATURE_ORDER = ("rms", "spectral_centroid", "spectral_flux", "onset_strength")

FEATURE_META: dict[str, dict[str, str]] = {
    "rms": {
        "label": "Loudness",
        "description": "Root-mean-square energy per second — proxy for overall intensity.",
    },
    "spectral_centroid": {
        "label": "Brightness",
        "description": "Spectral centroid — timbral brightness / sharpness.",
    },
    "spectral_flux": {
        "label": "Timbre change",
        "description": "Frame-to-frame spectral change — timbral motion.",
    },
    "onset_strength": {
        "label": "Onset strength",
        "description": "Positive spectral flux — note / beat onsets and transients.",
    },
}


def _load_mono_float(wav_path: Path) -> tuple[np.ndarray, int]:
    sr, audio = wavfile.read(wav_path)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if audio.dtype.kind in ("i", "u"):
        peak = np.iinfo(audio.dtype).max
        audio = audio.astype(np.float64) / max(peak, 1)
    else:
        audio = audio.astype(np.float64)
    return audio, int(sr)


def _zscore(series: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    std = float(series.std())
    if std < eps:
        return np.zeros_like(series)
    return (series - series.mean()) / (std + eps)


def _frame_features(audio: np.ndarray, sr: int, hop: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    n_frames = max(1, 1 + (len(audio) - 2048) // hop) if len(audio) >= 2048 else 1
    rms = np.zeros(n_frames, dtype=np.float64)
    centroid = np.zeros(n_frames, dtype=np.float64)
    flux = np.zeros(n_frames, dtype=np.float64)
    prev_mag: np.ndarray | None = None

    for i in range(n_frames):
        start = i * hop
        chunk = audio[start : start + 2048]
        if chunk.size < 2048:
            chunk = np.pad(chunk, (0, 2048 - chunk.size))
        windowed = chunk * np.hanning(2048)
        mag = np.abs(np.fft.rfft(windowed))
        freqs = np.fft.rfftfreq(2048, d=1.0 / sr)
        power = mag**2
        total = power.sum()
        rms[i] = float(np.sqrt(np.mean(chunk**2)))
        centroid[i] = float((freqs * power).sum() / total) if total > 1e-12 else 0.0
        if prev_mag is not None:
            diff = mag - prev_mag
            flux[i] = float(np.sum(np.clip(diff, 0.0, None) ** 2))
        prev_mag = mag

    return rms, centroid, flux


def _resample_to_trs(frame_series: np.ndarray, n_trs: int) -> np.ndarray:
    if frame_series.size == 0:
        return np.zeros(n_trs, dtype=np.float64)
    if frame_series.size == n_trs:
        return frame_series.astype(np.float64)
    return resample_poly(frame_series, n_trs, frame_series.size).astype(np.float64)


def extract_acoustic_features(
    wav_path: str | Path,
    *,
    n_trs: int,
    fps: int = 1,
) -> dict[str, Any]:
    """
    Extract per-TR acoustic descriptors aligned to predicted BOLD TRs.

    Returns z-scored within-clip series for overlay on engagement charts.
    """
    path = Path(wav_path)
    if not path.is_file():
        raise FileNotFoundError(path)

    audio, sr = _load_mono_float(path)
    hop = max(256, sr // fps)
    rms, centroid, flux = _frame_features(audio, sr, hop)
    onset = np.clip(flux, 0.0, None)

    raw = {
        "rms": _resample_to_trs(rms, n_trs),
        "spectral_centroid": _resample_to_trs(centroid, n_trs),
        "spectral_flux": _resample_to_trs(flux, n_trs),
        "onset_strength": _resample_to_trs(onset, n_trs),
    }

    features: dict[str, Any] = {}
    for key in FEATURE_ORDER:
        z = _zscore(raw[key])
        meta = FEATURE_META[key]
        features[key] = {
            "label": meta["label"],
            "description": meta["description"],
            "raw": raw[key].tolist(),
            "zscore": z.tolist(),
        }

    return {
        "version": 1,
        "fps": fps,
        "n_trs": n_trs,
        "source": str(path.name),
        "feature_order": list(FEATURE_ORDER),
        "features": features,
        "disclaimer": (
            "Acoustic descriptors for contextual overlay (Alluri-style). "
            "Correlational only; not causal brain–music mapping."
        ),
    }


def try_extract_acoustic_features(
    wav_path: str | Path | None,
    *,
    n_trs: int,
    fps: int = 1,
) -> dict[str, Any] | None:
    if not wav_path:
        return None
    path = Path(wav_path)
    if not path.is_file():
        logger.warning("Acoustic features skipped — WAV not found: %s", path)
        return None
    try:
        return extract_acoustic_features(path, n_trs=n_trs, fps=fps)
    except Exception:
        logger.exception("Failed to extract acoustic features from %s", path)
        return None
