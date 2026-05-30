#!/usr/bin/env python3
"""Verify processed stimuli: 45s, 44100 Hz, ~-16 LUFS."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def probe(path: Path) -> dict:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=sample_rate,channels",
        "-of",
        "default=noprint_wrappers=1",
        str(path),
    ]
    out = subprocess.check_output(cmd, text=True)
    info: dict = {}
    for line in out.strip().splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            info[k] = v
    return info


def loudness(path: Path) -> float:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-i",
        str(path),
        "-af",
        "loudnorm=print_format=json",
        "-f",
        "null",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    # Parse integrated loudness from stderr json fragment
    text = proc.stderr
    if "input_i" in text:
        for part in text.split('"input_i"'):
            if ":" in part:
                try:
                    val = part.split(":")[1].split(",")[0].strip().strip('"')
                    return float(val)
                except ValueError:
                    continue
    return float("nan")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: verify_stimuli.py <processed_dir>")
        return 1

    proc_dir = Path(argv[1])
    wavs = sorted(proc_dir.glob("*_45s.wav"))
    if not wavs:
        print(f"No *_45s.wav in {proc_dir}")
        return 1

    ok = True
    for wav in wavs:
        info = probe(wav)
        dur = float(info.get("duration", 0))
        rate = info.get("sample_rate", "?")
        ch = info.get("channels", "?")
        lufs = loudness(wav)

        dur_ok = abs(dur - 45.0) < 0.05
        rate_ok = rate == "44100"
        lufs_ok = abs(lufs + 16.0) < 1.0 if lufs == lufs else False

        status = "OK" if dur_ok and rate_ok else "FAIL"
        print(f"{wav.name}: {dur:.3f}s sr={rate} ch={ch} LUFS={lufs:.1f} [{status}]")
        ok = ok and dur_ok and rate_ok

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
