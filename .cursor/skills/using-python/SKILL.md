---
name: using-python
description: Enforce a Python-first workflow for nerve. Use when setting up Python envs, installing dependencies, running scripts, or running tests. Prefer `uv` commands over `pip`/`venv` unless explicitly instructed otherwise.
---

# using-python Workflow (nerve)

## Purpose

When working in `nerve`, use `uv` for all environment, installation, and execution tasks.

## Core Rules

- Default to `uv` for Python package management and command execution.
- Avoid `pip install`, `python -m pip`, and unscoped `python`/`pytest` calls.
- Prefer `uv run` for one-off command execution.

## Mandatory Commands

1. Install/update dependencies: `uv sync`
2. Install a runtime dependency: `uv add <package>`
3. Install a dev dependency: `uv add --dev <package>`
4. Run a script: `uv run python path/to/script.py`
5. Run tests: `uv run pytest`
6. CLI: `uv run nerve predict …`, `uv run nerve doctor`
7. After `pyproject.toml` changes: `uv sync`

## Environment

```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
export HF_HOME="$PWD/data/weights/huggingface"
export NERVE_CACHE="$PWD/data/features"
export NERVE_OUTPUTS="$PWD/data/outputs"
```

## Hard No-Go

- Do not use standalone `pip` for routine dependency changes.
- Do not float `numpy` — tribev2 requires `numpy==2.2.6`.
- Do not commit `data/outputs/` or processed stimuli.
