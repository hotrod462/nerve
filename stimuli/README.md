# Stimuli

V1 uses **five OSS tracks** defined in `manifest.yaml`. No user audio is required to test the pipeline.

## Setup

```bash
./scripts/prepare_stimuli.sh
uv run python scripts/verify_stimuli.py stimuli/processed/
```

Requires `ffmpeg` and network access on first run.

## Layout

| Path | Purpose |
|------|---------|
| `manifest.yaml` | Committed OSS track definitions |
| `manifest.user.yaml.example` | v2 template for personal tracks |
| `raw/` | Downloaded sources (gitignored) |
| `work/` | Intermediate WAVs (gitignored) |
| `processed/` | Final 45s TRIBE inputs (gitignored) |
| `user/` | v2 personal rips (gitignored) |

## Processed spec

- WAV PCM 16-bit, 44100 Hz stereo
- Exactly **45.000 s**
- **−16 LUFS** integrated (±0.3 LU)

See `LICENSES.md` for attributions.
