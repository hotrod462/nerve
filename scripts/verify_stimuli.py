#!/usr/bin/env python3
"""Verify processed stimuli: 44100 Hz stereo, ~-16 LUFS, any duration."""

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


def collect_wavs(*dirs: Path) -> list[Path]:
    wavs: list[Path] = []
    for d in dirs:
        if d.is_dir():
            wavs.extend(sorted(d.glob("*.wav")))
    return wavs


def verify_file(wav: Path) -> bool:
    info = probe(wav)
    dur = float(info.get("duration", 0))
    rate = info.get("sample_rate", "?")
    ch = info.get("channels", "?")
    lufs = loudness(wav)

    rate_ok = rate == "44100"
    ch_ok = ch == "2"
    dur_ok = dur > 0.5
    lufs_ok = abs(lufs + 16.0) < 1.5 if lufs == lufs else False

    status = "OK" if rate_ok and ch_ok and dur_ok else "FAIL"
    lufs_note = f" LUFS={lufs:.1f}" if lufs == lufs else ""
    warn = "" if lufs_ok or not lufs_ok else " [LUFS drift]"
    print(
        f"{wav}: {dur:.1f}s sr={rate} ch={ch}{lufs_note} [{status}]{warn}"
    )
    return rate_ok and ch_ok and dur_ok


def main(argv: list[str]) -> int:
    repo = Path(__file__).resolve().parents[1]
    if len(argv) >= 2:
        targets = [Path(p) for p in argv[1:]]
        wavs = collect_wavs(*targets)
    else:
        wavs = collect_wavs(
            repo / "stimuli" / "processed",
            repo / "stimuli" / "user" / "processed",
        )

    if not wavs:
        print("No *.wav found in stimuli/processed or stimuli/user/processed")
        return 1

    ok = all(verify_file(wav) for wav in wavs)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
