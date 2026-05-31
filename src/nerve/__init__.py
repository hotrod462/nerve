"""Nerve — interpretability layer on TRIBE v2 BOLD predictions.

Turns audio into predicted cortical (T, 20484) and subcortical engagement,
with Schaefer/Yeo rollup and web export. See llms.txt and docs/AI.md.
"""

from nerve.types import (
    BrainPrediction,
    ContrastResult,
    DeviceReport,
    InferenceMode,
    StimulusSpec,
)

__version__ = "0.1.0"

__all__ = [
    "BrainPrediction",
    "ContrastResult",
    "DeviceReport",
    "InferenceMode",
    "StimulusSpec",
    "__version__",
]
