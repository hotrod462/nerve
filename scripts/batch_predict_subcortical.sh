#!/usr/bin/env bash
# Subcortical-only predict + export-web for runs that already have cortical prediction.npz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export PYTORCH_ENABLE_MPS_FALLBACK="${PYTORCH_ENABLE_MPS_FALLBACK:-1}"

LOG="$ROOT/data/outputs/batch_predict_subcortical.log"
RUNS="$ROOT/data/outputs/runs"

{
  echo "=== batch subcortical-only started $(date) ==="
  for run_dir in "$RUNS"/*/; do
    [[ -d "$run_dir" ]] || continue
    id="$(basename "$run_dir")"
    cortical="$run_dir/prediction.npz"
    subcortical="$run_dir/prediction_subcortical.npz"

    if [[ ! -f "$cortical" ]]; then
      echo "SKIP $id — no prediction.npz"
      continue
    fi
    if [[ -f "$subcortical" ]]; then
      echo "SKIP $id — subcortical already present"
      continue
    fi

    audio="$(uv run python -c "
from pathlib import Path
from nerve.export.npz_io import load_prediction
pred = load_prediction(Path('$cortical'))
print(pred.stimulus.path)
")"

    if [[ ! -f "$audio" && ! -f "$ROOT/$audio" ]]; then
      echo "SKIP $id — audio missing: $audio"
      continue
    fi
    if [[ ! -f "$audio" ]]; then
      audio="$ROOT/$audio"
    fi

    echo ""
    echo ">>> subcortical predict $id $(date)"
    uv run nerve predict --subcortical-only --audio "$audio" --stimulus-id "$id" --out "$run_dir"
    echo ">>> export-web $id $(date)"
    uv run nerve export-web --run "$run_dir"
    echo ">>> done $id $(date)"
  done
  echo "=== batch subcortical-only finished $(date) ==="
} 2>&1 | tee -a "$LOG"
