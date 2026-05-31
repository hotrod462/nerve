#!/usr/bin/env bash
# Sync Nerve export bundles and stimuli to Google Cloud Storage.
#
# Prerequisites: gcloud + gsutil installed and authenticated.
# Usage:
#   export GCS_BUCKET=your-bucket-name
#   ./scripts/upload_gcs.sh
#
# Optional:
#   NERVE_OUTPUTS=data/outputs  (default)
#   GCS_PREFIX=                 (optional path prefix inside bucket)
#   GCS_SKIP_WAV=1              (default: skip .wav on upload; use MP3 for web)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

: "${GCS_BUCKET:?Set GCS_BUCKET to your GCS bucket name}"

# macOS: gsutil -m default multiprocessing can SIGSEGV (fork + Network.framework).
# See https://bugs.python.org/issue33725 — use one process; multithreading still helps.
GSUTIL_OPTS=()
if [[ "$(uname -s)" == "Darwin" && -z "${GSUTIL_PARALLEL:-}" ]]; then
  GSUTIL_OPTS=(-o "GSUtil:parallel_process_count=1")
  echo "Note: using GSUtil:parallel_process_count=1 on macOS (set GSUTIL_PARALLEL=1 to override)."
fi

gsutil_rsync() {
  gsutil "${GSUTIL_OPTS[@]}" -m rsync -r "$@"
}


GCS_PREFIX="${GCS_PREFIX:-}"
if [[ -n "$GCS_PREFIX" ]]; then
  GCS_PREFIX="${GCS_PREFIX%/}/"
fi

OUTPUTS="${NERVE_OUTPUTS:-data/outputs}"
if [[ ! "$OUTPUTS" = /* ]]; then
  OUTPUTS="$REPO_ROOT/$OUTPUTS"
fi

echo "Generating runs-index.json..."
(
  unset VIRTUAL_ENV
  uv run python scripts/generate_runs_index.py
)

if ! ls "$REPO_ROOT"/stimuli/**/*.mp3 >/dev/null 2>&1 && ! ls "$REPO_ROOT"/stimuli/*/*.mp3 >/dev/null 2>&1; then
  echo "Tip: run 'uv run python scripts/transcode_stimuli_mp3.py' before upload to shrink audio."
fi

echo "Uploading run bundles to gs://${GCS_BUCKET}/${GCS_PREFIX}runs/ ..."
gsutil_rsync "$OUTPUTS/runs" "gs://${GCS_BUCKET}/${GCS_PREFIX}runs"

echo "Uploading runs-index.json..."
gsutil cp "$OUTPUTS/runs-index.json" "gs://${GCS_BUCKET}/${GCS_PREFIX}runs-index.json"

GCS_SKIP_WAV="${GCS_SKIP_WAV:-1}"
if [[ "$GCS_SKIP_WAV" == "1" ]]; then
  echo "Uploading stimuli/ (MP3 + metadata only; skipping .wav) ..."
  gsutil_rsync -x '.*\.wav$' "$REPO_ROOT/stimuli" "gs://${GCS_BUCKET}/${GCS_PREFIX}stimuli"
else
  echo "Uploading stimuli/ (including .wav) ..."
  gsutil_rsync "$REPO_ROOT/stimuli" "gs://${GCS_BUCKET}/${GCS_PREFIX}stimuli"
fi

echo ""
echo "Done. Set on Vercel (and locally for testing):"
if [[ -n "$GCS_PREFIX" ]]; then
  echo "  NEXT_PUBLIC_NERVE_ASSETS_BASE=https://storage.googleapis.com/${GCS_BUCKET}/${GCS_PREFIX%/}"
else
  echo "  NEXT_PUBLIC_NERVE_ASSETS_BASE=https://storage.googleapis.com/${GCS_BUCKET}"
fi
