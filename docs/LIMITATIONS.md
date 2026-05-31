# Limitations

## Scientific

- **In-silico ≠ real fMRI.** TRIBE predicts group-average BOLD from naturalistic training data. Music genre effects in predictions are exploratory simulation, not empirical neuroscience without validation.
- **Acoustic-only v1.** No lyrics, no multimodal context. Claims are **acoustic → predicted BOLD**, not full naturalistic listening.
- **No uncertainty.** Point estimates only; contrast maps are descriptive, not inferential (no permutation tests, FDR).
- **Training bias.** Western-heavy media diet in TRIBE training may not generalize across cultures.

## Technical

- **CC BY-NC 4.0** on TRIBE weights — non-commercial research only.
- **MPS is best-effort.** Official TRIBE targets CUDA. Use `nerve doctor` and check `device_report` in artifacts.
- **First run ~2–3 GB download** (TRIBE + Wav2Vec-BERT). Cache under `data/weights/` via `HF_HOME`.
- **NumPy pinned** to `2.2.6` for tribev2 compatibility.
- **Subcortical** uses `facebook/tribev2-subcortical` — saved as `prediction_subcortical.npz`; ROI panel in web UI (no volume mesh yet).

## Product

- No demo export bundles in git — you must run `predict` → `export-web` before the web gallery shows brains.
- Pixabay track may require manual download if automated fetch fails.
