# Nerve — Design

## Architecture

Nerve is an interpretability layer on [TRIBE v2](https://github.com/facebookresearch/tribev2) predicted BOLD. The monorepo splits:

| Area | Role |
|------|------|
| `src/nerve/` | Python only — inference, parcellation, contrast, export |
| `web/` | Next.js only — reads pre-exported bundles |
| `data/` | Gitignored weights, caches, run outputs |
| `stimuli/` | OSS audio manifest + processed WAVs |

**Boundary:** `nerve export-web` is the only handoff to the frontend. No PyTorch in `web/`, no React in `src/nerve/`.

## Data contracts

### BrainPrediction

- `data`: `(T, 20484)` float32 — fsaverage5 cortical vertices at 1 Hz
- Vertex order: **lh 10242** then **rh 10242** (TRIBE `vol_to_surf` stack order)
- `inference_mode`: `acoustic_only` in v1 (`audio_only=True` always)

### DeviceReport

Serialized in every run `manifest.json` and `.npz` metadata. Resolution: `auto` → `mps` if built+available, else `cpu`.

### Web bundle (`{run}/web/`)

```
web/
├── manifest.json
├── mesh/
│   ├── lh.inflated.gii
│   ├── rh.inflated.gii
│   └── scalars_4d.gii    # (20484 × T)
└── matrices/
    ├── parcel_time.json
    ├── parcel_labels.json
    └── contrast/         # contrast runs only
```

Niivue: inflated meshes, `hot` colormap, 1 Hz playback.

## Modules

- `backends/tribe_v2.py` — wraps `TribeModel`, always `audio_only=True`
- `preprocess/hemodynamic.py` — stable window from TR 5+
- `parcellation/schaefer.py` — Schaefer 2018 on fsaverage5 (default 100 parcels)
- `analysis/contrast.py` — A−B vertex maps
- `export/web_bundle.py` — GIfTI 4D + JSON for Next.js

## v1 vs v1.1

| Feature | v1 | v1.1+ |
|---------|----|----|
| Modality | Audio only | Video, text, lyrics ablation |
| Checkpoint | `facebook/tribev2` | + `facebook/tribev2-subcortical` |
| Stimuli | OSS `manifest.yaml` | `manifest.user.yaml` overlay |

## Open questions

- Vertex order validated at spike — document any tribev2 drift in `navigating-nerve` skill
- Niivue 4D GIfTI layout may need lh/rh separate loads vs combined file
