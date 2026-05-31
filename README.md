# Nerve

Interpretability layer on [TRIBE v2](https://github.com/facebookresearch/tribev2) predicted BOLD — audio-only v1, Schaefer parcellation, and a Next.js + Niivue brain viewer.

**Scope:** acoustic → predicted group-average BOLD on fsaverage5 `(T, 20484)`. Not real scanner data.

## Quick start

```bash
# Prerequisites: Python 3.11, uv, ffmpeg, Node.js
cp .env.example .env
cp web/.env.example web/.env.local

# Or export manually:
# export PYTORCH_ENABLE_MPS_FALLBACK=1
# export HF_HOME="$PWD/data/weights/huggingface"
# export NERVE_CACHE="$PWD/data/features"
# export NERVE_OUTPUTS="$PWD/data/outputs"

set -a && source .env && set +a
uv sync
uv run nerve doctor

./scripts/prepare_stimuli.sh   # downloads OSS tracks (Pixabay may need manual step)
uv run python scripts/verify_stimuli.py stimuli/processed/

uv run nerve predict \
  --audio stimuli/processed/musopen_egmont.wav \
  --out data/outputs/runs/egmont/
uv run nerve export-web --run data/outputs/runs/egmont/

cd web && npm install && npm run dev -- --webpack
```

## CLI

| Command | Purpose |
|---------|---------|
| `nerve doctor` | MPS/CPU smoke test |
| `nerve predict --audio … --out …` | TRIBE audio-only inference |
| `nerve contrast --a … --b … --out …` | A−B contrast between runs |
| `nerve export-web --run …` | GIfTI 4D + JSON for `web/` |

## Example

```bash
uv run python examples/music_genre_contrast.py --pair classical_vs_edm
```

Headline contrast: Beethoven Egmont vs Pixabay EDM.

## License

- Nerve code: your repo license (add as needed)
- TRIBE v2 weights: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
- Stimuli: see `stimuli/LICENSES.md`

## Docs

- [DESIGN.md](docs/DESIGN.md) — architecture and data contracts
- [LIMITATIONS.md](docs/LIMITATIONS.md) — scientific and technical caveats
