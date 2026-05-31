#!/usr/bin/env python3
"""Prepare manifest tracks: optional trim, optional duration, -16 LUFS."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
OSS_MANIFEST = REPO_ROOT / "stimuli" / "manifest.yaml"
USER_MANIFEST = REPO_ROOT / "stimuli" / "manifest.user.yaml"

DOWNLOAD_URLS: dict[str, str] = {
    "musopen_egmont": (
        "https://archive.org/download/MusopenCollectionAsFlac/"
        "Beethoven%20-%20Egmont%20Overture%20Op.%2084.flac"
    ),
    "bopd_aint_no_thing": (
        "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/"
        "no_curator/BOPD/2005_Stayin_Alive_InstruMentals/BOPD_-_aint_no_thing.mp3"
    ),
    "pkjazz_spirit_of_the_road": (
        "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/"
        "ccCommunity/Pk_jazz_Collective/Pearls_of_our_Life/"
        "Pk_jazz_Collective_-_Spirit_of_the_road.mp3"
    ),
    "holizna_endless_grind": (
        "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/"
        "no_curator/holiznacc0/City_Slacker/holiznacc0_-_Endless_Grind.mp3"
    ),
}


def load_tracks(include_user: bool) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []
    if OSS_MANIFEST.is_file():
        with open(OSS_MANIFEST, encoding="utf-8") as f:
            tracks.extend(yaml.safe_load(f).get("tracks", []))
    if include_user and USER_MANIFEST.is_file():
        with open(USER_MANIFEST, encoding="utf-8") as f:
            tracks.extend(yaml.safe_load(f).get("tracks", []))
    return tracks


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def _curl(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    _run(["curl", "-fL", "--retry", "3", "-o", str(dest), url])


def ensure_source(track: dict[str, Any]) -> Path | None:
    track_id = track["id"]
    user_supplied = bool(track.get("user_supplied", False))
    raw_dir = (
        REPO_ROOT / "stimuli" / "user" / "raw" / track_id
        if user_supplied
        else REPO_ROOT / "stimuli" / "raw" / track_id
    )
    raw_dir.mkdir(parents=True, exist_ok=True)

    existing = sorted(
        p
        for p in raw_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".flac", ".mp3", ".wav", ".m4a", ".ogg"}
    )
    if existing:
        return existing[0]

    if user_supplied:
        print(
            f"  Place source audio in {raw_dir}/ "
            f"(any .mp3/.wav/.flac/.m4a/.ogg filename)"
        )
        return None

    if track_id == "pixabay_forever_edm":
        print(
            "  Download MP3 manually from manifest source_url → "
            f"{raw_dir}/source.mp3"
        )
        return None

    url = DOWNLOAD_URLS.get(track_id)
    if not url:
        print(f"  No auto-download for {track_id}")
        return None

    ext = ".flac" if track_id == "musopen_egmont" else ".mp3"
    dest = raw_dir / f"source{ext}"
    print(f"  Downloading {track_id}...")
    try:
        _curl(url, dest)
    except subprocess.CalledProcessError:
        print(f"  WARN: download failed — place file manually in {raw_dir}/")
        return None
    return dest


def process_track(track: dict[str, Any], source: Path) -> Path:
    out_rel = Path(track["path"])
    out_path = REPO_ROOT / out_rel
    out_path.parent.mkdir(parents=True, exist_ok=True)

    work_dir = REPO_ROOT / "stimuli" / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    work_wav = work_dir / f"{track['id']}_full.wav"

    trim_start = str(track.get("trim_start") or "0")
    duration_s = track.get("duration_s")

    _run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-ar",
            "44100",
            "-ac",
            "2",
            str(work_wav),
        ]
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        trim_start,
        "-i",
        str(work_wav),
    ]
    if duration_s is not None:
        cmd.extend(["-t", str(duration_s)])
    cmd.extend(
        [
            "-ar",
            "44100",
            "-ac",
            "2",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            str(out_path),
        ]
    )
    _run(cmd)
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepare stimuli from manifest(s)")
    parser.add_argument(
        "--user",
        action="store_true",
        help="Include stimuli/manifest.user.yaml (personal tracks)",
    )
    parser.add_argument(
        "--only",
        action="append",
        metavar="ID",
        help="Process only these track ids (repeatable)",
    )
    args = parser.parse_args(argv)

    if not _has_ffmpeg():
        print("ffmpeg required", file=sys.stderr)
        return 1

    tracks = load_tracks(include_user=args.user)
    if args.only:
        wanted = set(args.only)
        tracks = [t for t in tracks if t["id"] in wanted]

    if not tracks:
        print("No tracks found in manifest(s)")
        return 1

    ok = 0
    for track in tracks:
        track_id = track["id"]
        print(f"[{track_id}]")
        source = ensure_source(track)
        if source is None:
            continue
        try:
            out = process_track(track, source)
            dur_flag = (
                f"clip {track['duration_s']}s"
                if track.get("duration_s") is not None
                else "full length"
            )
            print(f"  → {out.relative_to(REPO_ROOT)} ({dur_flag})")
            ok += 1
        except subprocess.CalledProcessError as exc:
            print(f"  FAIL: ffmpeg error ({exc})")

    print(f"\nPrepared {ok}/{len(tracks)} track(s).")
    print("Verify: uv run python scripts/verify_stimuli.py")
    return 0 if ok else 1


def _has_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


if __name__ == "__main__":
    sys.exit(main())
