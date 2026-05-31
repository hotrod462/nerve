#!/usr/bin/env python3
"""Transcode processed WAV stimuli to MP3 for web/GCS deployment.

TRIBE predict/export still use WAV locally; web manifests prefer sibling .mp3
when present (see nerve.export.web_bundle.prefer_mp3_stimulus_path).

Requires ffmpeg.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_DIRS = (
    REPO_ROOT / "stimuli" / "user" / "processed",
    REPO_ROOT / "stimuli" / "processed",
)


def _has_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def _transcode(wav: Path, bitrate: str, force: bool) -> bool:
    mp3 = wav.with_suffix(".mp3")
    if mp3.is_file() and not force and mp3.stat().st_mtime >= wav.stat().st_mtime:
        print(f"  skip (up to date): {mp3.relative_to(REPO_ROOT)}")
        return False

    mp3.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(wav),
        "-codec:a",
        "libmp3lame",
        "-b:a",
        bitrate,
        "-ar",
        "44100",
        "-ac",
        "2",
        str(mp3),
    ]
    subprocess.run(cmd, check=True)
    print(f"  → {mp3.relative_to(REPO_ROOT)}")
    return True


def collect_wavs(dirs: list[Path]) -> list[Path]:
    wavs: list[Path] = []
    for root in dirs:
        if not root.is_dir():
            continue
        wavs.extend(sorted(root.rglob("*.wav")))
    return wavs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Transcode WAV stimuli to MP3 for web deploy")
    parser.add_argument(
        "--bitrate",
        default="128k",
        help="MP3 bitrate passed to ffmpeg -b:a (default: 128k)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-encode even when .mp3 is newer than .wav",
    )
    parser.add_argument(
        "--dir",
        action="append",
        type=Path,
        metavar="PATH",
        help="Directory to scan for .wav (repeatable; default: user/processed + processed)",
    )
    args = parser.parse_args(argv)

    if not _has_ffmpeg():
        print("ffmpeg required (brew install ffmpeg)", file=sys.stderr)
        return 1

    scan_dirs = [p.resolve() for p in args.dir] if args.dir else list(DEFAULT_DIRS)
    wavs = collect_wavs(scan_dirs)
    if not wavs:
        print("No .wav files found under:", ", ".join(str(d) for d in scan_dirs))
        return 1

    created = 0
    for wav in wavs:
        print(wav.relative_to(REPO_ROOT))
        if _transcode(wav, args.bitrate, args.force):
            created += 1

    print(f"\nTranscoded {created}/{len(wavs)} file(s).")
    print("Next: uv run python scripts/patch_manifests_mp3.py")
    print("  or re-run export-web on each run.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
