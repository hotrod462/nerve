# Nerve

Interpretability layer on [TRIBE v2](https://github.com/facebookresearch/tribev2) predicted BOLD. Nerve turns audio into in-silico cortical and subcortical engagement traces, exports them for a Next.js gallery, and syncs everything to a Niivue 3D brain viewer.

**Scope:** acoustic → predicted group-average BOLD on fsaverage5 `(T, 20484)` cortex plus Harvard-Oxford subcortical voxels. This is not real scanner data. See [LIMITATIONS.md](docs/LIMITATIONS.md) before drawing scientific conclusions.

---

## In plain English

Nerve answers a simple question: **if you could watch a generic human brain respond to a piece of audio, what might light up, when, and where?**

You feed it a WAV file — a song, a podcast clip, a TikTok hook, a film score. A deep learning model ([TRIBE v2](https://github.com/facebookresearch/tribev2)) trained on naturalistic media predicts a **simulated fMRI-like signal** second-by-second: first on the brain’s outer surface (cortex), then in deeper structures (subcortical nuclei). Nerve rolls those raw predictions up into **readable timelines** — “Pulse,” “Surprise,” “Reward,” and so on — and paints them onto a **3D brain** you can scrub through in sync with the audio.

Nothing here came out of a real MRI scanner. It is a **research and exploration tool**: a way to compare clips, spot where predicted engagement rises, and reason about acoustic structure in neuro-ish language. Treat every number as **exploratory**, not clinical or individual truth.

---

## What you see in the app (metrics guide)

All timelines share the same clock: **1 second = 1 TR** (one time point). The playhead on the audio player, the engagement charts, and the brain viewer all refer to the same second index.

### Z-scores (the wiggly lines)

Every trace is **z-scored within the clip** — subtract the clip’s average, divide by its spread. So **0 means “typical for this track.”** Positive values mean above-average engagement for that network or region; negative means below. You are always comparing moments **relative to the same audio file**, not to other tracks or to population norms.

The dashed horizontal line at the middle of each chart is zero.

### Cortical engagement (left panel)

Seven **Yeo brain networks**, each with a plain headline:

| Headline | Network | Rough meaning |
|----------|---------|---------------|
| **Focus** | Control | Effortful parsing — dense structure, complex passages |
| **Surprise** | Salience | Bottom-up events — drops, sudden timbre or dynamic changes |
| **Tracking** | Dorsal attention | Sustained top-down attention — following a melody or motif |
| **Resonance** | Default mode | Internal, self-relevant listening — narrative, nostalgia, meaning |
| **Feeling** | Limbic | Affective tone — warmth, tension, emotional weight |
| **Pulse** | Somatomotor | Rhythm and groove — beat, entrainment, danceability |
| **Imagery** | Visual | Evoked scenes or “color” — cinematic or spatial feel |

Each row shows:

- **The line** — z-scored predicted engagement over time.
- **Shaded bands** — seconds where this network was the **dominant** one (highest z among all seven).
- **Expandable detail** — Yeo-17 subnetworks (e.g. insula under Surprise, medial prefrontal under Resonance) with finer-grained traces.

Click a chart to seek the playhead to that second.

### Track summaries (collapsible)

Whole-clip stats per network:

- **Active %** — fraction of seconds where z > 0.5 (“ noticeably above baseline for this clip”).
- **Peak** — highest z-score and the second it occurred (`@ 12s` = TR 12).

### Dominant network epochs (collapsible)

When one network leads for several seconds in a row, that stretch becomes a **segment**. The panel shows:

- **Network chips** — e.g. `Pulse · 34%` = that network was dominant for 34% of the clip.
- **Mean coupling** — rolling correlation between network pairs over an 8-second window:
  - Pulse ↔ Feeling (SomMot ↔ Limbic) — groove + affect
  - Focus ↔ Resonance (Cont ↔ Default) — effort vs internal drift
  - Surprise ↔ Pulse (SalVentAttn ↔ SomMot) — events tied to motor engagement
- **Segment list** — start/end time, duration, and optional **epoch badges** (heuristic labels):
  - *Groove / entrainment* — Pulse + Feeling co-elevated
  - *Event / drop* — Surprise spike (often insula-linked)
  - *Active parsing* — Focus + Tracking co-elevated
  - *Narrative / lyrical* — language/default regions co-elevated
  - *Decoupling bridge* — Resonance up while Focus dips

Badges are literature-inspired guesses, not ground truth. Click a segment to jump the playhead.

### Acoustic overlay (toggle on cortical charts)

Thin overlay lines derived from the **audio waveform**, not the brain model — useful context only:

| Overlay | Meaning |
|---------|---------|
| **Loudness** | RMS energy per second |
| **Brightness** | Spectral centroid — sharp vs dull timbre |
| **Timbre change** | How much the spectrum shifts frame to frame |
| **Onset strength** | Transients — beats, note attacks |

Correlational only: loud does not *cause* Surprise, but a drop and a Surprise spike may line up.

### Subcortical engagement (right panel)

Seven deep-brain regions (Harvard-Oxford), each with a headline:

| Headline | Region | Rough meaning |
|----------|--------|---------------|
| **Reward** | Accumbens | Pleasure, wanting, peak moments |
| **Anticipation** | Caudate | Predictive reward, timing the next beat |
| **Groove** | Putamen | Rhythmic motor reward |
| **Integration** | Pallidum | Motor–reward coupling |
| **Arousal** | Amygdala | Emotional salience, tension |
| **Memory** | Hippocampus | Familiarity, episodic context |
| **Relay** | Thalamus | Sensory gating, overall subcortical drive |

Same z-score logic and dominant-region shading as cortex. Expand a row for a short interpretation blurb.

### Brain viewer (collapsible 3D panel)

- **Activation color** — predicted BOLD-like intensity on the surface (red/yellow scale). Brighter = higher predicted signal at that vertex for the current second.
- **Surface** — Normal (pial), Smooth (half), or Inflated anatomy.
- **Map mode**
  - *Absolute* — raw predicted activation
  - *Residual* — each frame minus its whole-brain mean (highlights relative hotspots)
  - *Network* — only vertices belonging to the **dominant network** at that second are shown
- **View** — Both, Cortical only, or Subcortical only (colored deep-structure meshes).
- **Yeo** — atlas overlay tinting regions by network.
- **Labels** — Schaefer region names on the surface.
- **Face** — faint inflated “ghost” behind the cortex for depth.

Scrubbing time updates the 3D colors in sync with audio.

### Compare page (`/compare?a=…&b=…`)

Two brain viewers side by side with a **linked playhead**. If you ran `nerve contrast`, a third panel may show the **A−B difference map** (where B exceeds A in predicted activation, and vice versa). Contrast uses a blue–red symmetric scale.

### Matrix page (`/matrix`)

A table of **mean predicted activation per Schaefer parcel** for each track in your library, plus a **pairwise L2 distance heatmap** — which clips produce similar vs dissimilar parcel profiles. Useful for clustering a catalog, not for ranking “quality.”

### Gallery metadata

Each track card shows stimulus id, optional genre tag, clip length (`T`), and which device ran inference (MPS/CPU).

---

## Possible use cases

Nerve is **not validated for any of these out of the box** — but the workflow (audio in → timed engagement out → visual compare) supports several exploratory workflows:

**Content and media**

- **Social clip auditing** — Score hooks, intros, and outros on predicted Surprise, Pulse, and Reward traces; compare alternate edits of the same TikTok/Reels cut before posting.
- **Virality hypothesis testing** — Does the “winning” variant show more salience events, longer groove segments, or stronger Pulse↔Feeling coupling? Batch-export a folder of clips and scan dominant-epoch badges.
- **Podcast / ad pacing** — Find seconds where Focus or Tracking stays elevated (dense information) vs Resonance-dominant bridges (reflective tone).
- **Trailer and game audio** — Map predicted Imagery and Surprise to cinematic stingers; contrast boss themes vs menu music.

**Music and catalog intelligence**

- **A&R and playlist research** — Matrix similarity across your library: which tracks sit near each other in predicted parcel space?
- **Genre contrast demos** — Classical vs EDM (included example): where do predicted networks diverge?
- **Remix / stem comparison** — Contrast original vs remaster, or dry vs produced mix.

**Research and education**

- **Teaching neuroimaging concepts** — Yeo networks, subcortical anatomy, and HRF-ish timing without scanner access.
- **Hypothesis generation** — “Does this passage look like a groove epoch?” before designing a real fMRI study.
- **Acoustic ↔ engagement alignment** — Overlay loudness/onsets on Surprise and Pulse to spot model–acoustic agreement or mismatch.

**What it is not**

- Not a lie detector, emotion classifier, or guaranteed virality predictor.
- Not individual brain data — group-average simulation only.
- Not a substitute for A/B testing with real humans or platform analytics.

For commercial or high-stakes decisions, use Nerve as **one qualitative signal among many**, and read [LIMITATIONS.md](docs/LIMITATIONS.md) first.

---

## What it does

```
audio (WAV)
  → TRIBE v2 cortical + subcortical inference (1 Hz)
  → Schaefer parcellation + Yeo network engagement
  → GIfTI meshes + JSON matrices
  → Next.js gallery / compare / matrix / brain viewer
```

| Layer | Role |
|-------|------|
| `src/nerve/` | Python — inference, parcellation, contrast, analysis, export |
| `web/` | Next.js — reads pre-exported bundles only (no PyTorch) |
| `data/` | Gitignored weights, caches, run outputs |
| `stimuli/` | OSS demo tracks + optional user manifest |

The handoff between Python and the frontend is **`nerve export-web`**. Everything the web app renders comes from `{run}/web/`.

---

## Inference

### Cortical (`facebook/tribev2`)

- Audio-only inference (`audio_only=True`)
- Output: `(T, 20484)` float32 on fsaverage5 — lh 10242 vertices, then rh 10242
- Default temporal resolution: 1 TR/s (1 Hz playback in the viewer)

### Subcortical (`facebook/tribev2-subcortical`)

- Runs alongside cortical on every `nerve predict` (or alone via `--subcortical-only`)
- Harvard-Oxford bilateral ROIs: Accumbens, Caudate, Putamen, Pallidum, Amygdala, Hippocampus, Thalamus (+ ventricle in data, excluded from UI)
- Exported as ROI engagement traces and marching-cubes meshes in the brain viewer

### Contrast

- `nerve contrast --a … --b …` computes A−B vertex maps between two runs
- Optional temporal window (default skips first 5 TRs for hemodynamic stabilization)
- Contrast bundles export with a symmetric colormap for the compare view

---

## Analysis & export artifacts

`nerve export-web` writes `{run}/web/`:

```
web/
├── manifest.json
├── mesh/
│   ├── lh|rh.{pial,half,inflated}.gii
│   ├── lh|rh.activations.gii          # 4D BOLD per vertex
│   ├── lh|rh.sulc.gii
│   ├── subcortical/{roi}.gii          # geometry + activations per ROI
│   └── atlas/                         # Yeo + Schaefer overlays
└── matrices/
    ├── engagement.json                # Yeo-7/17 network z-traces
    ├── subcortical_engagement.json    # ROI z-traces
    ├── vertex_yeo.json                # per-vertex Yeo IDs for map masking
    ├── parcel_time.json               # Schaefer parcel time series
    ├── acoustic_features.json         # RMS, spectral centroid, etc.
    └── contrast/                      # contrast runs only
```

### Cortical engagement (`engagement.json`)

- Macro Yeo-7 networks rolled up from Schaefer parcels (default 400 parcels, 17 Yeo subnetworks)
- Per-network z-scored traces, derivatives, active fractions
- **Dominant network timeline** — which network leads each TR
- **Epoch templates** — heuristic labels (groove, event/drop, narrative, active parsing, decoupling)
- **Network coupling** — rolling correlation pairs (SomMot↔Limbic, Cont↔Default, SalVentAttn↔SomMot)
- **Salience events** — TRs where salience derivative exceeds threshold

### Subcortical engagement (`subcortical_engagement.json`)

- Per-ROI z-traces with human-readable headlines (Reward, Groove, Memory, etc.)
- Dominant ROI timeline per TR

### Acoustic features

- Lightweight per-TR descriptors extracted from the stimulus WAV (correlational only, not causal)

---

## Web app

Run the dev server after exporting at least one track:

```bash
cd web && npm install && npm run dev -- --webpack
```

| Route | Purpose |
|-------|---------|
| `/` | Track gallery — all exported runs |
| `/tracks/[id]` | Full track page: playback, engagement panels, brain viewer |
| `/compare?a=…&b=…` | Side-by-side A vs B with contrast overlay |
| `/matrix` | Stimulus × parcel mean matrix across library |

### Track page

- **Stimulus playback** — audio + playhead synced to 1 Hz TR index
- **Cortical engagement timeline** — Yeo network traces, dominant segments, epoch badges, acoustic overlay
- **Subcortical engagement timeline** — ROI traces alongside cortex
- **Brain viewer** (collapsible) — Niivue 3D surface with:
  - Surface modes: pial, half, inflated
  - Map modes: absolute, residual, network-focus
  - View: both / cortical / subcortical
  - Optional Yeo atlas overlay, region labels, inflated face ghost
  - Activation playback synced to audio

---

## Quick start

```bash
# Prerequisites: Python 3.11, uv, ffmpeg, Node.js
cp .env.example .env
cp web/.env.example web/.env.local

set -a && source .env && set +a
uv sync
uv run nerve doctor

./scripts/prepare_stimuli.sh   # OSS demo tracks
uv run python scripts/verify_stimuli.py stimuli/processed/

uv run nerve predict \
  --audio stimuli/processed/musopen_egmont.wav \
  --stimulus-id egmont \
  --out data/outputs/runs/egmont/
uv run nerve export-web --run data/outputs/runs/egmont/

cd web && npm install && npm run dev -- --webpack
```

### Your own tracks

See [stimuli/README.md](stimuli/README.md). Copy `manifest.user.yaml.example`, drop audio in `stimuli/user/raw/`, run `./scripts/prepare_stimuli.sh --user`, then predict + export-web.

### Batch processing

```bash
./scripts/batch_predict_user.sh          # predict + export-web for user manifest tracks
./scripts/batch_predict_subcortical.sh   # subcortical-only backfill for existing runs
```

Log output goes to `data/outputs/batch_*.log`.

---

## CLI

| Command | Purpose |
|---------|---------|
| `nerve doctor` | MPS/CPU smoke test; optional full predict on short audio |
| `nerve predict --audio … --out …` | Dual cortical + subcortical TRIBE inference |
| `nerve predict --subcortical-only …` | Subcortical only (skip cortical if already present) |
| `nerve contrast --a … --b … --out …` | A−B contrast between two runs |
| `nerve export-web --run …` | GIfTI 4D + JSON bundle for `web/` |

Common flags:

- `--device auto|mps|cpu` — default `auto` (MPS on Apple Silicon when available)
- `--stimulus-id` — label stored in manifest and gallery
- `export-web --parcels 400 --yeo-networks 17` — Schaefer parcellation settings

Environment (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `PYTORCH_ENABLE_MPS_FALLBACK=1` | Required for TRIBE on MPS |
| `HF_HOME` | Hugging Face / TRIBE weight cache |
| `NERVE_CACHE` | TRIBE feature cache |
| `NERVE_OUTPUTS` | Run output root (web reads `{NERVE_OUTPUTS}/runs/*/web/`) |

---

## Example: genre contrast

```bash
uv run python examples/music_genre_contrast.py --pair classical_vs_edm
```

Headline pair: Beethoven Egmont vs Pixabay EDM — predict both, contrast, export-web.

---

## Repo layout

```
src/nerve/
  backends/tribe_v2.py       TRIBE v2 + subcortical wrappers
  parcellation/              Schaefer 2018, Harvard-Oxford subcortical
  analysis/                  engagement, contrast, acoustic features
  export/                    GIfTI writer, atlas, subcortical mesh, web bundle
  cli.py                     nerve command entry point
web/
  app/                       Gallery, track, compare, matrix pages
  components/                BrainViewer, engagement timelines, playback
  lib/                       loadRun, engagement, subcortical helpers
scripts/                     Stimuli prep, batch predict, engagement analysis
stimuli/                     manifest.yaml + user overlay
data/assets/                 fsaverage5 meshes, subcortical ROI geometry cache
examples/                    music_genre_contrast.py
tests/                       export, engagement, parcellation tests
docs/                        DESIGN.md, LIMITATIONS.md
```

---

## Tests

```bash
uv run pytest
uv run pytest -m "not slow"    # skip slow integration tests
```

---

## License

- Nerve code: your repo license (add as needed)
- TRIBE v2 weights: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — non-commercial research only
- Stimuli: see [stimuli/LICENSES.md](stimuli/LICENSES.md)

---

## Docs

- [DESIGN.md](docs/DESIGN.md) — architecture, data contracts, module map
- [LIMITATIONS.md](docs/LIMITATIONS.md) — scientific and technical caveats
- [docs/AI.md](docs/AI.md) — structured FAQ and facts for LLMs / coding agents
- [docs/GEO.md](docs/GEO.md) — generative engine optimization (llms.txt, JSON-LD, metadata)
- [llms.txt](llms.txt) — machine-readable project index ([llms.txt spec](https://llmstxt.org/))
- [AGENTS.md](AGENTS.md) — onboarding for AI coding agents
