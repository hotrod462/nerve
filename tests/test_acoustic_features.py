"""Acoustic feature extraction tests."""

from __future__ import annotations

import numpy as np
from scipy.io import wavfile

from nerve.analysis.acoustic_features import extract_acoustic_features


def test_extract_acoustic_features(tmp_path):
    sr = 22050
    t = np.linspace(0, 4, sr * 4, endpoint=False)
    audio = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    wav_path = tmp_path / "tone.wav"
    wavfile.write(wav_path, sr, audio)

    doc = extract_acoustic_features(wav_path, n_trs=4, fps=1)
    assert doc["n_trs"] == 4
    assert len(doc["feature_order"]) == 4
    for key in doc["feature_order"]:
        assert len(doc["features"][key]["zscore"]) == 4
