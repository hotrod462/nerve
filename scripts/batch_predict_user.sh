#!/usr/bin/env bash
# Predict + export-web for all tracks in manifest.user.yaml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

LOG="$ROOT/data/outputs/batch_predict.log"
mkdir -p "$ROOT/data/outputs/runs"

ids=(
  back_to_truth_darius_syrossian
  fell_in_luv_carlita
  its_in_your_eyes_diode
  blue_space_jody_wisternoff
  escape_john_summit
  la_noche_chris_lake
  let_it_happen_omnom
  mrs_negi_remix_v2
  sunflower_post_malone
  paris_chainsmokers
  drifting_tiesto
  avicii_wake_me_up
  beethoven_fur_elise
  beethoven_moonlight_sonata
  eminem_rap_god
  martin_garrix_animals
  succession_main_theme
)

{
  echo "=== batch predict started $(date) ==="
  for id in "${ids[@]}"; do
    audio="stimuli/user/processed/${id}.wav"
    out="data/outputs/runs/${id}"
    if [[ ! -f "$audio" ]]; then
      echo "SKIP $id — missing $audio"
      continue
    fi
    if [[ -f "$out/prediction.npz" && -f "$out/prediction_subcortical.npz" && -f "$out/web/manifest.json" ]]; then
      echo "SKIP $id — already predicted (cortical + subcortical) and exported"
      continue
    fi
    echo ""
    echo ">>> predict $id $(date)"
    uv run nerve predict --audio "$audio" --stimulus-id "$id" --out "$out"
    echo ">>> export-web $id $(date)"
    uv run nerve export-web --run "$out"
    echo ">>> done $id $(date)"
  done
  echo "=== batch predict finished $(date) ==="
} 2>&1 | tee -a "$LOG"
