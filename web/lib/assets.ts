/**
 * Asset URL helpers for local dev (filesystem + /api routes) vs remote (GCS/CDN).
 *
 * Set NEXT_PUBLIC_NERVE_ASSETS_BASE to enable remote mode, e.g.
 * https://storage.googleapis.com/your-bucket-name
 */

/** Public GCS/CDN base URL (no trailing slash), or null for local filesystem mode. */
export function nerveAssetsBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_NERVE_ASSETS_BASE?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function isRemoteAssets(): boolean {
  return nerveAssetsBase() !== null;
}

function encodePath(rel: string): string {
  return rel
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

/** Base URL for a run's web bundle (meshes, matrices, manifest-relative paths). */
export function runWebBase(runId: string): string {
  const remote = nerveAssetsBase();
  if (remote) {
    return `${remote}/runs/${encodeURIComponent(runId)}/web`;
  }
  return `/api/runs/${encodeURIComponent(runId)}`;
}

/** Public URL for a repo-relative stimulus path (e.g. stimuli/user/processed/foo.wav). */
export function stimulusUrl(repoRelativePath: string): string {
  const remote = nerveAssetsBase();
  const encoded = encodePath(repoRelativePath);
  if (remote) return `${remote}/${encoded}`;
  return `/api/stimulus/${encoded}`;
}

/** Public URL for files under data/outputs/runs/ (e.g. stimulus_parcel.json). */
export function outputsRunsUrl(rel: string): string {
  const remote = nerveAssetsBase();
  const encoded = encodePath(rel);
  if (remote) return `${remote}/runs/${encoded}`;
  return `/api/outputs/runs/${encoded}`;
}

/** Resolve a manifest-relative path inside a run web bundle. */
export function runWebUrl(runId: string, rel: string): string {
  return `${runWebBase(runId)}/${encodePath(rel)}`;
}
