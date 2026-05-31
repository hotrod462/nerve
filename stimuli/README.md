# Stimuli

Tracks are defined in YAML manifests and processed to WAV for TRIBE.

## Setup (OSS demo bundle)

```bash
./scripts/prepare_stimuli.sh
uv run python scripts/verify_stimuli.py
```

Requires `ffmpeg`, `uv`, and network access on first OSS download.

## Your own clips (full length or clipped)

1. Copy the example manifest:
   ```bash
   cp stimuli/manifest.user.yaml.example stimuli/manifest.user.yaml
   ```
2. **Drop source audio** in:
   ```
   stimuli/user/raw/<track_id>/
   ```
   Any single file: `.mp3`, `.wav`, `.flac`, `.m4a`, `.ogg`
3. Edit `stimuli/manifest.user.yaml` — set `id`, `path`, `genre`, etc.
4. Process:
   ```bash
   ./scripts/prepare_stimuli.sh --user
   uv run python scripts/verify_stimuli.py stimuli/user/processed/
   ```
5. Predict (full processed file, whatever length):
   ```bash
   uv run nerve predict \
     --audio stimuli/user/processed/my_song.wav \
     --stimulus-id my_song \
     --out data/outputs/runs/my_song/
   uv run nerve export-web --run data/outputs/runs/my_song/
   ```

**Full length:** omit `duration_s` from the manifest entry.  
**Clip a section:** set `trim_start` and optionally `duration_s`.

Personal audio and `manifest.user.yaml` are gitignored — do not commit rips unless you have rights.

## Layout

| Path | Purpose |
|------|---------|
| `manifest.yaml` | Committed OSS tracks (45s demo clips via `duration_s`) |
| `manifest.user.yaml` | Your tracks (gitignored) |
| `manifest.user.yaml.example` | Template |
| `raw/<id>/` | OSS downloads (gitignored) |
| `user/raw/<id>/` | **Your source files** (gitignored) |
| `work/` | Intermediate WAVs (gitignored) |
| `processed/` | OSS outputs (gitignored) |
| `user/processed/` | **Your processed WAVs** (gitignored) |

## Processed spec

- WAV PCM, **44100 Hz stereo**
- **−16 LUFS** integrated (±1.5 LU tolerance in verify)
- **Any duration** unless `duration_s` is set in the manifest

See `LICENSES.md` for OSS attributions.
