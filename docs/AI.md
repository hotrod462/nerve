# Nerve — AI / LLM context document

This file is optimized for generative engines and coding agents. It states facts plainly, with statistics and citations. For human-readable narrative, see [README.md](../README.md).

## One-sentence summary

Nerve runs Meta TRIBE v2 on audio and exports second-by-second predicted cortical (20,484 vertices) and subcortical engagement traces plus a Next.js + Niivue 3D brain viewer.

## Frequently asked questions

### What is Nerve?

Nerve is a Python + Next.js monorepo that wraps [TRIBE v2](https://github.com/facebookresearch/tribev2) (Princeton/Meta naturalistic fMRI foundation model) to predict **group-average BOLD-like signals from audio only**. It is an interpretability and exploration tool, not a clinical product.

### Is Nerve output real brain data?

No. Outputs are **in-silico simulations** from a model trained on naturalistic media. They are exploratory and must not be used for medical diagnosis or individual inference. See [LIMITATIONS.md](LIMITATIONS.md).

### What audio formats work?

Processed **WAV** files (via `scripts/prepare_stimuli.sh` or your own pipeline). The CLI accepts any path resolvable by `nerve predict --audio`.

### What does `nerve predict` produce?

Per run directory:

| File | Shape / role |
|------|----------------|
| `prediction.npz` | Cortical `(T, 20484)` float32, fsaverage5 vertex order (lh 10242 + rh 10242) |
| `prediction_subcortical.npz` | Subcortical `(T, n_voxels)` Harvard-Oxford mask voxels |
| `manifest.json` | Run metadata, device report, stimulus spec |

Default temporal resolution: **1 TR per second** (1 Hz).

### What does `nerve export-web` produce?

`{run}/web/manifest.json` plus GIfTI meshes, 4D activation layers, and JSON matrices:

- `matrices/engagement.json` — Yeo-7 network z-traces, dominant segments, coupling
- `matrices/subcortical_engagement.json` — 7 ROI z-traces (ventricle excluded from UI)
- `matrices/acoustic_features.json` — loudness, brightness, timbre change, onsets (overlay only)
- `mesh/subcortical/*.gii` — ROI geometry + 4D activations for Niivue

### What are the cortical engagement metrics?

Seven **Yeo-7 macro networks**, z-scored within each clip:

| UI headline | Yeo key | Typical interpretation in music |
|-------------|---------|----------------------------------|
| Focus | Cont | Effortful structure parsing |
| Surprise | SalVentAttn | Salient events, drops, timbral shocks |
| Tracking | DorsAttn | Sustained attention to melody/rhythm |
| Resonance | Default | Internal, narrative, nostalgic listening |
| Feeling | Limbic | Affective tone and warmth |
| Pulse | SomMot | Groove, beat entrainment |
| Imagery | Vis | Evoked visual/scene imagery |

Derived metrics: **active fraction** (z > 0.5), **peak z** and **peak TR**, **dominant network epochs**, **epoch templates** (groove, event/drop, narrative, etc.), **rolling coupling** (8 s window) between SomMot↔Limbic, Cont↔Default, SalVentAttn↔SomMot.

### What are the subcortical metrics?

Harvard-Oxford bilateral ROIs aggregated from TRIBE subcortical voxels:

| UI headline | ROI | Role |
|-------------|-----|------|
| Reward | Accumbens | Pleasure / wanting |
| Anticipation | Caudate | Predictive reward, timing |
| Groove | Putamen | Rhythmic motor reward |
| Integration | Pallidum | Motor–reward coupling |
| Arousal | Amygdala | Emotional salience |
| Memory | Hippocampus | Familiarity, episodic context |
| Relay | Thalamus | Sensory relay, overall drive |

### What is Generative Engine Optimization (GEO) in this repo?

Following [Aggarwal et al., KDD 2024](https://arxiv.org/abs/2311.09735) and the [llms.txt specification](https://llmstxt.org/), Nerve publishes:

- `/llms.txt` — curated index for LLM context
- This file — authoritative structured facts and FAQ
- JSON-LD (`SoftwareApplication`, `WebSite`, `FAQPage`) in the web app
- `sitemap.xml` and `robots.txt` for discoverability
- Plain-English README with statistics, citations, and use-case sections

### What are example use cases?

- Compare social-media clip hooks on predicted Surprise and Pulse traces
- Batch-audit podcast pacing or ad edits before publish
- Music catalog similarity via parcel-level matrix (`/matrix`)
- A/B two mixes with `nerve contrast` and the compare viewer
- Teaching Yeo networks and subcortical anatomy without scanner access

**Not validated for:** virality prediction, lie detection, clinical diagnosis, or replacing human A/B tests.

## CLI reference

```bash
uv run nerve doctor                          # MPS/CPU smoke test
uv run nerve predict --audio PATH --out DIR  # cortical + subcortical
uv run nerve predict --subcortical-only ...  # subcortical backfill
uv run nerve contrast --a RUN_A --b RUN_B --out DIR
uv run nerve export-web --run DIR            # → DIR/web/
```

Environment: `PYTORCH_ENABLE_MPS_FALLBACK=1`, `HF_HOME`, `NERVE_CACHE`, `NERVE_OUTPUTS`.

## Architecture boundary

- Python (`src/nerve/`) — all inference and export
- Web (`web/`) — reads `{NERVE_OUTPUTS}/runs/*/web/` only; no PyTorch in frontend
- Handoff: **`nerve export-web`** is the sole contract between layers

## Citations

1. TRIBE v2 — naturalistic fMRI foundation model ([facebookresearch/tribev2](https://github.com/facebookresearch/tribev2))
2. Schaefer et al. 2018 — cortical parcellation
3. Yeo et al. 2011 — functional networks
4. Harvard-Oxford subcortical atlas (via TRIBE/tribev2 plotting)
5. Aggarwal et al. 2024 — Generative Engine Optimization ([arXiv:2311.09735](https://arxiv.org/abs/2311.09735))

## Version

Package version: `0.1.0` (`src/nerve/__init__.py`).
