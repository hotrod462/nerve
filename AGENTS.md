# AGENTS.md — Nerve monorepo

Guidance for AI coding agents working in this repository.

## What this repo is

Nerve wraps **TRIBE v2** to predict in-silico BOLD from audio, export web bundles, and visualize them in Next.js + Niivue. Read [docs/AI.md](docs/AI.md) for authoritative facts and [docs/LIMITATIONS.md](docs/LIMITATIONS.md) before changing scientific copy.

## Layout

| Path | Stack | Notes |
|------|-------|-------|
| `src/nerve/` | Python 3.11, uv, PyTorch | Inference, export — **no React** |
| `web/` | Next.js 16, Niivue | Local: `{NERVE_OUTPUTS}/runs/*/web/`; prod: GCS via `NEXT_PUBLIC_NERVE_ASSETS_BASE` — **no PyTorch** |
| `data/` | gitignored | Weights, caches, run outputs |
| `stimuli/` | YAML manifests + WAV | OSS + optional user overlay |

**Boundary:** `nerve export-web` is the only handoff to the frontend.

## Commands

```bash
uv sync
uv run nerve doctor
uv run nerve predict --audio PATH --out data/outputs/runs/ID/
uv run nerve export-web --run data/outputs/runs/ID/
uv run pytest
cd web && npm run dev -- --webpack
```

Use `uv run`, not bare `python`/`pip`. NumPy is pinned to `2.2.6` for tribev2.

## Conventions

- Minimize diff scope; match existing patterns
- Do not commit `data/outputs/` or user stimuli
- TRIBE weights: CC BY-NC 4.0 — non-commercial only
- Mesh IDs in Niivue are UUID strings — never `Number(mesh.id)`

## GEO / docs

- Update [llms.txt](llms.txt) and [docs/AI.md](docs/AI.md) when changing user-visible capabilities
- Web metadata lives in [web/lib/geo.ts](web/lib/geo.ts)

## Key files

- `src/nerve/cli.py` — CLI entry
- `src/nerve/backends/tribe_v2.py` — TRIBE wrappers
- `src/nerve/export/web_bundle.py` — web bundle export
- `web/components/BrainViewer.tsx` — 3D viewer
- `web/lib/loadRun.ts` — run manifests (local disk or GCS)
- `web/lib/assets.ts` — asset URL helpers for local vs remote
- `docs/DEPLOY_GCS.md` — Vercel + GCS deployment
