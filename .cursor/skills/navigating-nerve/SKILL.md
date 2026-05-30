---
name: navigating-nerve
description: Repo map and workflows for the nerve monorepo. Use when touching src/nerve/, web/, stimuli/, data/outputs/, CLI, or export bundles.
---

# Navigating Nerve

## Repo map

| Path | Contents |
|------|----------|
| `src/nerve/` | Python — types, device, TRIBE backend, parcellation, export, CLI |
| `web/` | Next.js + Niivue — gallery, track, compare, matrix |
| `data/weights/` | HF cache (gitignored) |
| `data/features/` | tribev2 feature cache |
| `data/outputs/runs/` | `.npz` + `web/` export bundles |
| `stimuli/` | `manifest.yaml` + processed WAVs |
| `scripts/` | `prepare_stimuli.sh`, `verify_stimuli.py` |

## Boundaries

- No PyTorch in `web/`
- No React in `src/nerve/`
- Frontend reads **only** `{run}/web/` from `export-web`
- **No demo bundles committed** — empty gallery until you predict + export

## First-run workflow

```bash
uv sync
./scripts/prepare_stimuli.sh
uv run nerve predict --audio stimuli/processed/musopen_egmont_45s.wav --out data/outputs/runs/egmont/
uv run nerve export-web --run data/outputs/runs/egmont/
cd web && npm install && npm run dev
```

## Data contracts

- Predictions: `(T, 20484)` — lh 10242 + rh 10242
- `inference_mode`: `acoustic_only` (v1 always `audio_only=True`)
- Web: `mesh/scalars_4d.gii`, `matrices/parcel_time.json`, `manifest.json`

## Pitfalls

- Pin `numpy==2.2.6` — do not upgrade for tribev2
- Set `PYTORCH_ENABLE_MPS_FALLBACK=1` on Mac
- `nerve doctor` before blaming slow predict on MPS
- TRIBE weights: CC BY-NC — non-commercial
- v1: no HF token; v2 personal tracks use `manifest.user.yaml`

## Docs

- `docs/DESIGN.md`, `docs/LIMITATIONS.md`, `stimuli/LICENSES.md`
