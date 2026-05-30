"""Device resolution and audit for TRIBE / Wav2Vec on Apple Silicon."""

from __future__ import annotations

import os
import time
from typing import Any

import torch
from torch import nn

from nerve.types import DeviceReport


def mps_available() -> bool:
    return bool(
        getattr(torch.backends, "mps", None)
        and torch.backends.mps.is_available()
        and torch.backends.mps.is_built()
    )


def resolve_device(requested: str = "auto") -> torch.device:
    """Resolve device: auto → mps if available, else cpu."""
    requested = requested.lower().strip()
    if requested == "auto":
        if mps_available():
            return torch.device("mps")
        return torch.device("cpu")
    if requested == "mps":
        if not mps_available():
            raise RuntimeError(
                "MPS requested but not available. "
                "Set NERVE_DEVICE=cpu or use --device cpu."
            )
        return torch.device("mps")
    if requested == "cpu":
        return torch.device("cpu")
    raise ValueError(f"Unknown device {requested!r}; use auto, mps, or cpu")


def resolved_device_name(device: torch.device) -> str:
    return device.type


def audit_module_devices(
    modules: dict[str, nn.Module],
) -> dict[str, str]:
    """Report device type of first parameter per labeled module."""
    out: dict[str, str] = {}
    for label, module in modules.items():
        try:
            param = next(module.parameters())
            out[label] = param.device.type
        except StopIteration:
            out[label] = "none"
    return out


def trace_forward_devices(
    modules: dict[str, nn.Module],
    forward_fn: dict[str, Any],
) -> dict[str, str]:
    """Record output tensor device per module label via one-shot hooks."""
    trace: dict[str, str] = {}
    handles = []

    def make_hook(name: str):
        def hook(_module, _inputs, output):
            t = output[0] if isinstance(output, tuple) else output
            if hasattr(t, "device"):
                trace[name] = t.device.type

        return hook

    for label, module in modules.items():
        if label in forward_fn:
            handles.append(module.register_forward_hook(make_hook(label)))

    try:
        for label, fn in forward_fn.items():
            fn()
    finally:
        for h in handles:
            h.remove()

    return trace


def build_device_report(
    requested: str,
    resolved: torch.device,
    modules: dict[str, str],
    forward_trace: dict[str, str] | None = None,
    extra_warnings: list[str] | None = None,
) -> DeviceReport:
    warnings: list[str] = list(extra_warnings or [])
    resolved_str = resolved_device_name(resolved)

    if requested == "mps" and resolved_str != "mps":
        warnings.append(f"Requested mps but resolved to {resolved_str}")

    for label, dev in modules.items():
        if resolved_str == "mps" and dev == "cpu" and label in ("tribe_fusion", "wav2vec"):
            warnings.append(f"{label} parameters on cpu despite device=mps")

    return DeviceReport(
        requested=requested,
        resolved=resolved_str,
        mps_available=mps_available(),
        mps_built=bool(getattr(torch.backends.mps, "is_built", lambda: False)()),
        fallback_env=os.environ.get("PYTORCH_ENABLE_MPS_FALLBACK", "") == "1",
        modules=modules,
        forward_trace=forward_trace,
        warnings=warnings,
    )


def smoke_matmul(device: torch.device) -> float:
    """Quick matmul timing in seconds."""
    a = torch.randn(512, 512, device=device)
    b = torch.randn(512, 512, device=device)
    start = time.perf_counter()
    _ = a @ b
    if device.type == "mps":
        torch.mps.synchronize()
    elif device.type == "cuda":
        torch.cuda.synchronize()
    return time.perf_counter() - start
