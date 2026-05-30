"""Tests for nerve.device — no TRIBE required."""

from __future__ import annotations

import pytest
import torch

from nerve.device import (
    audit_module_devices,
    build_device_report,
    mps_available,
    resolve_device,
)
from nerve.types import DeviceReport


class TinyModule(torch.nn.Module):
    def __init__(self, device: torch.device):
        super().__init__()
        self.linear = torch.nn.Linear(4, 4).to(device)


def test_resolve_device_cpu():
    dev = resolve_device("cpu")
    assert dev.type == "cpu"


def test_resolve_device_auto_returns_cpu_or_mps():
    dev = resolve_device("auto")
    assert dev.type in ("cpu", "mps")


def test_resolve_device_mps_raises_when_unavailable(monkeypatch):
    monkeypatch.setattr("nerve.device.mps_available", lambda: False)
    with pytest.raises(RuntimeError, match="MPS requested"):
        resolve_device("mps")


def test_audit_module_devices():
    mod_a = TinyModule(torch.device("cpu"))
    mod_b = TinyModule(torch.device("cpu"))
    out = audit_module_devices({"a": mod_a, "b": mod_b})
    assert out == {"a": "cpu", "b": "cpu"}


def test_device_report_device_ok_cpu():
    report = DeviceReport(
        requested="cpu",
        resolved="cpu",
        mps_available=False,
        mps_built=False,
        fallback_env=False,
        modules={"tribe_fusion": "cpu", "wav2vec": "cpu"},
    )
    assert report.device_ok is True


def test_build_device_report_warns_on_cpu_modules_with_mps():
    report = build_device_report(
        requested="mps",
        resolved=torch.device("mps"),
        modules={"tribe_fusion": "cpu", "wav2vec": "mps"},
    )
    assert any("tribe_fusion" in w for w in report.warnings)
