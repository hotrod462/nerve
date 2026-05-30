#!/usr/bin/env bash
# Download OSS stimuli, trim to 45s, normalize to -16 LUFS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="${1:-$ROOT/stimuli/manifest.yaml}"
RAW="$ROOT/stimuli/raw"
WORK="$ROOT/stimuli/work"
OUT="$ROOT/stimuli/processed"

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg required"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl required"; exit 1; }

mkdir -p "$RAW" "$WORK" "$OUT"

# Parse manifest track ids (minimal yaml grep — full parse in verify_stimuli.py)
download_track() {
  local id="$1"
  local raw_dir="$RAW/$id"
  mkdir -p "$raw_dir"

  case "$id" in
    musopen_egmont)
      # Musopen Beethoven Egmont — archive.org direct search; user may need manual fetch
      URL="https://archive.org/download/MusopenCollectionAsFlac/Beethoven%20-%20Egmont%20Overture%20Op.%2084.flac"
      DEST="$raw_dir/source.flac"
      if [[ ! -f "$DEST" ]]; then
        echo "Downloading $id..."
        curl -fL --retry 3 -o "$DEST" "$URL" || {
          echo "WARN: Auto-download failed for $id. Place FLAC manually at $DEST"
          return 1
        }
      fi
      ;;
    bopd_aint_no_thing)
      URL="https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/BOPD/2005_Stayin_Alive_InstruMentals/BOPD_-_aint_no_thing.mp3"
      DEST="$raw_dir/source.mp3"
      if [[ ! -f "$DEST" ]]; then curl -fL --retry 3 -o "$DEST" "$URL"; fi
      ;;
    pkjazz_spirit_of_the_road)
      URL="https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Pk_jazz_Collective/Pearls_of_our_Life/Pk_jazz_Collective_-_Spirit_of_the_road.mp3"
      DEST="$raw_dir/source.mp3"
      if [[ ! -f "$DEST" ]]; then curl -fL --retry 3 -o "$DEST" "$URL"; fi
      ;;
    pixabay_forever_edm)
      echo "Pixabay track: download MP3 from manifest source_url and save as $raw_dir/source.mp3"
      DEST="$raw_dir/source.mp3"
      if [[ ! -f "$DEST" ]]; then
        echo "  https://pixabay.com/music/edm/forever-edm-trance-vibes-256003/"
        return 1
      fi
      ;;
    holizna_endless_grind)
      URL="https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/holiznacc0/City_Slacker/holiznacc0_-_Endless_Grind.mp3"
      DEST="$raw_dir/source.mp3"
      if [[ ! -f "$DEST" ]]; then curl -fL --retry 3 -o "$DEST" "$URL"; fi
      ;;
    *)
      echo "Unknown track id: $id"
      return 1
      ;;
  esac
}

trim_and_normalize() {
  local id="$1" trim_start="$2"
  local raw_dir="$RAW/$id"
  local src
  src="$(find "$raw_dir" -maxdepth 1 -type f \( -name '*.flac' -o -name '*.mp3' -o -name '*.wav' \) | head -1)"
  [[ -n "$src" ]] || { echo "No source in $raw_dir"; return 1; }

  local work_wav="$WORK/${id}_full.wav"
  local out_wav="$OUT/${id}_45s.wav"

  ffmpeg -y -hide_banner -loglevel error -i "$src" -ar 44100 -ac 2 "$work_wav"
  ffmpeg -y -hide_banner -loglevel error -ss "$trim_start" -i "$work_wav" -t 45 \
    -af loudnorm=I=-16:TP=-1.5:LRA=11 "$out_wav"
  echo "Wrote $out_wav"
}

# Default v1 tracks from manifest
TRACKS=(
  "musopen_egmont|00:01:30"
  "bopd_aint_no_thing|00:00:30"
  "pkjazz_spirit_of_the_road|00:00:45"
  "pixabay_forever_edm|00:00:30"
  "holizna_endless_grind|00:00:20"
)

for entry in "${TRACKS[@]}"; do
  id="${entry%%|*}"
  trim="${entry##*|}"
  download_track "$id" || true
  if find "$RAW/$id" -type f | grep -q .; then
    trim_and_normalize "$id" "$trim"
  fi
done

echo "Done. Run: uv run python scripts/verify_stimuli.py stimuli/processed/"
