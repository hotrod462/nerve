#!/usr/bin/env bash
# Prepare OSS (+ optional user) tracks from manifest YAML.
# Full-length by default; set duration_s in manifest to clip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec uv run python scripts/prepare_stimuli.py "$@"
