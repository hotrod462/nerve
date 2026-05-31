# Deploy Nerve with Vercel + Google Cloud Storage

Host the Next.js frontend on **Vercel** and serve large artifacts (meshes, audio, JSON) from **GCS**. The web app reads a remote base URL when `NEXT_PUBLIC_NERVE_ASSETS_BASE` is set; otherwise it uses the local filesystem (dev default).

## Architecture

```
Browser ──► Vercel (Next.js UI)
   │
   └──► GCS (runs/, stimuli/, runs-index.json)
```

GCS object layout mirrors local paths:

| Local | GCS |
|-------|-----|
| `data/outputs/runs-index.json` | `gs://BUCKET/runs-index.json` |
| `data/outputs/runs/{id}/web/` | `gs://BUCKET/runs/{id}/web/` |
| `stimuli/` | `gs://BUCKET/stimuli/` |

## Step 1 — Create a GCS bucket

1. Open [Google Cloud Console](https://console.cloud.google.com/storage/browser).
2. **Create bucket**
   - Name: globally unique (e.g. `nerve-demo-assets-12345`)
   - Location: region near your users (e.g. `us-central1`)
   - Storage class: **Standard**
   - Access control: **Uniform** (recommended)
3. Note the bucket name as `GCS_BUCKET`.

## Step 2 — Install and authenticate gcloud

```bash
# macOS (Homebrew)
brew install google-cloud-sdk

gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

Verify:

```bash
gsutil ls
```

## Step 3 — Make objects publicly readable (demo / portfolio)

For a public demo, grant **objectViewer** to all users on the bucket:

```bash
export GCS_BUCKET=your-bucket-name

gsutil iam ch allUsers:objectViewer gs://${GCS_BUCKET}
```

For private buckets, use signed URLs or Cloud CDN with authenticated origin instead (not covered here).

## Step 4 — Configure CORS (required for browser loads)

Niivue and `<audio>` fetch assets cross-origin from Vercel → GCS.

```bash
gsutil cors set scripts/gcs-cors.json gs://${GCS_BUCKET}
gsutil cors get gs://${GCS_BUCKET}
```

For production, replace `"origin": ["*"]` in `scripts/gcs-cors.json` with your Vercel domain(s), e.g. `https://nerve.vercel.app`.

## Step 5 — Compress audio for deploy (recommended)

WAV stimuli are ~4 GB; MP3 cuts that to ~350–450 MB. **Keep WAV locally** for `nerve predict` / acoustic export; serve **MP3** on GCS.

```bash
# Requires ffmpeg (brew install ffmpeg)
uv run python scripts/transcode_stimuli_mp3.py

# Patch existing web manifests (or re-run export-web per run)
uv run python scripts/patch_manifests_mp3.py
uv run python scripts/generate_runs_index.py
```

`export-web` also prefers sibling `.mp3` automatically when re-exporting.

Upload skips `.wav` by default (`GCS_SKIP_WAV=1`). Set `GCS_SKIP_WAV=0` to upload WAV too.

## Step 6 — Generate index and upload files

From the repo root, after you have run `nerve predict` + `nerve export-web` for your tracks:

```bash
export GCS_BUCKET=your-bucket-name
chmod +x scripts/upload_gcs.sh
./scripts/upload_gcs.sh
```

This will:

1. Run `scripts/generate_runs_index.py` → `data/outputs/runs-index.json`
2. `gsutil rsync` all of `data/outputs/runs/` → `gs://BUCKET/runs/`
3. Upload `runs-index.json` to the bucket root
4. `gsutil rsync` `stimuli/` → `gs://BUCKET/stimuli/` (MP3 only by default)

Re-run after adding new tracks or re-exporting bundles.

### Manual upload (alternative)

```bash
uv run python scripts/generate_runs_index.py

gsutil -m rsync -r data/outputs/runs gs://${GCS_BUCKET}/runs
gsutil cp data/outputs/runs-index.json gs://${GCS_BUCKET}/runs-index.json
gsutil -m rsync -r -x '.*\.wav$' stimuli gs://${GCS_BUCKET}/stimuli
```

### Optional: cache headers on upload

```bash
gsutil -m setmeta -h "Cache-Control:public,max-age=31536000,immutable" \
  "gs://${GCS_BUCKET}/runs/**/*.gii"
```

## Step 7 — Set environment variables

### Vercel (Project → Settings → Environment Variables)

| Variable | Example | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_NERVE_ASSETS_BASE` | `https://storage.googleapis.com/your-bucket-name` | No trailing slash |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | For sitemap / Open Graph |

Redeploy after setting env vars.

### Local testing against GCS

Create `web/.env.local`:

```bash
NEXT_PUBLIC_NERVE_ASSETS_BASE=https://storage.googleapis.com/your-bucket-name
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then:

```bash
cd web && npm run dev -- --webpack
```

Leave `NEXT_PUBLIC_NERVE_ASSETS_BASE` unset to use local `data/outputs/` + `/api/runs` routes (default dev workflow).

## Step 8 — Deploy frontend to Vercel

1. Import the repo in [Vercel](https://vercel.com/new).
2. Set **Root Directory** to `web`.
3. Add the env vars from Step 6.
4. Deploy.

Gallery, compare, matrix, and sitemap fetch `runs-index.json` from GCS at request time (`force-dynamic`).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty gallery on Vercel | Check `NEXT_PUBLIC_NERVE_ASSETS_BASE`; verify `runs-index.json` is public and reachable |
| CORS errors in browser console | Run `gsutil cors set scripts/gcs-cors.json gs://BUCKET` |
| `gsutil` crashes on macOS (Python SIGSEGV) | Re-run `./scripts/upload_gcs.sh` (uses `parallel_process_count=1`) or `export GSUTIL_PARALLEL=1` only if you know you need it |
| 403 on GCS URLs | Bucket/objects not public, or IAM not applied |
| Track page 404 | Confirm `gs://BUCKET/runs/{id}/web/manifest.json` exists |
| Audio won't play | Run transcode + patch manifests; confirm `manifest.stimulus.path` ends in `.mp3` and file exists on GCS |

## Cost ballpark

With MP3 + meshes: **~1 GB** stored ≈ **$0.02/month**. Egress depends on traffic; a portfolio demo is usually a few dollars/month or less.

## Related files

- `web/lib/assets.ts` — URL builders
- `web/lib/loadRun.ts` — local vs remote run loading
- `scripts/generate_runs_index.py` — builds `runs-index.json`
- `scripts/transcode_stimuli_mp3.py` — WAV → MP3 for deploy
- `scripts/patch_manifests_mp3.py` — update manifest paths
- `scripts/upload_gcs.sh` — one-shot GCS sync
