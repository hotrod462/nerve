#!/usr/bin/env bash
# Copy music from ~/Downloads into stimuli/user/raw/<id>/ for manifest.user.yaml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DL="$HOME/Downloads"
RAW="$ROOT/stimuli/user/raw"

copy() {
  local id="$1" src="$2"
  mkdir -p "$RAW/$id"
  local ext="${src##*.}"
  cp -f "$DL/$src" "$RAW/$id/source.${ext}"
  echo "  $id ← $src"
}

echo "Importing music from Downloads..."
copy back_to_truth_darius_syrossian "Back to Truth (Nick Curly Remix) - Darius Syrossian (youtube).mp3"
copy fell_in_luv_carlita "Fell In Luv - Carlita (youtube).mp3"
copy its_in_your_eyes_diode "It's in Your Eyes (Diode Eins Remix) - Disappeared Completely (youtube).mp3"
copy blue_space_jody_wisternoff "Jody Wisternoff & James Grant feat. Jinadu - Blue Space (Official Lyric Video).mp3"
copy escape_john_summit "Kx5 - Escape (John Summit Remix) [Extended Mix] - John Summit.mp3"
copy la_noche_chris_lake "La Noche Chris Lake Skrillex Anita B.mp3"
copy let_it_happen_omnom "Let It Happen OMNOM Remix.mp3"
copy mrs_negi_remix_v2 "Mrs Negi Remix V2.mp3"
copy sunflower_post_malone "Post Malone, Swae Lee - Sunflower (Spider-Man_ Into the Spider-Verse).mp3"
copy paris_chainsmokers "The Chainsmokers - Paris (Official Video).mp3"
copy drifting_tiesto "Tiësto - Drifting (Official Music Video) - Tiësto.mp3"
copy avicii_wake_me_up "avicii-wake-me-up-official-lyric-video-0-sst-3-s.wav"
copy beethoven_fur_elise "beethoven-fur-elise-xqko-0-t.wav"
copy beethoven_moonlight_sonata "beethoven-moonlight-sonata-3-rd-movement-fntupt.wav"
copy eminem_rap_god "eminem-rap-god-explicit-y-3-r-34-s.wav"
copy martin_garrix_animals "martin-garrix-animals-official-video-zanecx.wav"
copy succession_main_theme "succession-main-title-theme-o-3-ryir.wav"
echo "Done. Run: ./scripts/prepare_stimuli.sh --user"
