import fs from "fs";
import path from "path";
import { nerveAssetsBase, runWebUrl } from "@/lib/assets";

/** Walk up from cwd until we find the nerve repo root (pyproject.toml + web/). */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (
      fs.existsSync(path.join(dir, "pyproject.toml")) &&
      fs.existsSync(path.join(dir, "web"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume Next.js cwd is web/
  return path.resolve(process.cwd(), "..");
}

function resolveOutputsRoot(): string {
  const repoRoot = findRepoRoot();
  const raw = process.env.NERVE_OUTPUTS;
  if (!raw) {
    return path.join(repoRoot, "data", "outputs");
  }
  if (path.isAbsolute(raw)) {
    return raw;
  }
  const normalized = raw.replace(/^\.\.\//, "");
  return path.resolve(repoRoot, normalized);
}

const REPO_ROOT = findRepoRoot();
const RUNS_DIR = path.join(resolveOutputsRoot(), "runs");

export interface MeshAtlasManifest {
  parcels?: { lh: string; rh: string };
  yeo?: { lh: string; rh: string };
  lut?: string;
  borders?: {
    yeo?: { lh: string; rh: string };
    parcels?: { lh: string; rh: string };
  };
  region_labels?: { lh: string; rh: string };
}

export interface MeshManifest {
  surfaces?: {
    pial?: { lh: string; rh: string };
    half?: { lh: string; rh: string };
    inflated?: { lh: string; rh: string };
  };
  activations?: { lh: string; rh: string };
  sulc?: { lh: string; rh: string };
  sulc_range?: { min: number; max: number };
  atlas?: MeshAtlasManifest;
  subcortical?: {
    rois: Array<{ id: string; geometry: string; activations: string }>;
    vmin?: number;
    vmax?: number;
  };
}

export interface WebManifest {
  run_id: string;
  T?: number;
  fps?: number;
  colormap?: string;
  vmin?: number;
  vmax?: number;
  default_surface?: "pial" | "half" | "inflated";
  mesh?: MeshManifest;
  stimulus?: {
    id: string;
    genre?: string;
    path?: string;
  };
  device_report?: {
    resolved: string;
    device_ok?: boolean;
    modules?: Record<string, string>;
  };
  contrast?: {
    a: string;
    b: string;
  };
}

export interface RunSummary {
  id: string;
  /** Local filesystem web bundle dir; empty when loading from remote assets. */
  webDir: string;
  manifest: WebManifest;
}

interface RunsIndex {
  runs: Array<{ id: string; manifest: WebManifest }>;
}

function readManifest(webDir: string): WebManifest | null {
  const p = path.join(webDir, "manifest.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as WebManifest;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function listRunsLocal(): RunSummary[] {
  if (!fs.existsSync(RUNS_DIR)) return [];

  const entries = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
  const runs: RunSummary[] = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const webDir = path.join(RUNS_DIR, ent.name, "web");
    const manifest = readManifest(webDir);
    if (manifest) {
      runs.push({ id: ent.name, webDir, manifest });
    }
  }

  return runs.sort((a, b) => a.id.localeCompare(b.id));
}

async function listRunsRemote(): Promise<RunSummary[]> {
  const base = nerveAssetsBase();
  if (!base) return [];

  const index = await fetchJson<RunsIndex>(`${base}/runs-index.json`);
  if (!index?.runs?.length) return [];

  return index.runs
    .map((entry) => ({
      id: entry.id,
      webDir: "",
      manifest: entry.manifest,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function listRuns(): Promise<RunSummary[]> {
  if (nerveAssetsBase()) return listRunsRemote();
  return listRunsLocal();
}

export async function getRun(runId: string): Promise<RunSummary | null> {
  const remote = nerveAssetsBase();
  if (remote) {
    const manifest = await fetchJson<WebManifest>(
      runWebUrl(runId, "manifest.json")
    );
    if (!manifest) return null;
    return { id: runId, webDir: "", manifest };
  }

  const webDir = path.join(RUNS_DIR, runId, "web");
  const manifest = readManifest(webDir);
  if (!manifest) return null;
  return { id: runId, webDir, manifest };
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

/** Read JSON from a run web bundle (local fs or remote URL). */
export async function readRunJson<T>(
  run: RunSummary,
  rel: string
): Promise<T | null> {
  if (nerveAssetsBase()) {
    return fetchJson<T>(runWebUrl(run.id, rel));
  }
  return readJsonFile<T>(path.join(run.webDir, rel));
}

/** Read JSON from under data/outputs/runs/ (e.g. stimulus_parcel.json). */
export async function readOutputsRunsJson<T>(rel: string): Promise<T | null> {
  if (nerveAssetsBase()) {
    const base = nerveAssetsBase()!;
    const encoded = rel
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    return fetchJson<T>(`${base}/runs/${encoded}`);
  }
  return readJsonFile<T>(path.join(RUNS_DIR, rel));
}

export function webPublicPath(webDir: string, rel: string): string {
  return path.join(webDir, rel);
}

export { RUNS_DIR, REPO_ROOT };
