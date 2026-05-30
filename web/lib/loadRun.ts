import fs from "fs";
import path from "path";

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
  // Support ../data/outputs (from web/) or data/outputs (from repo root)
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
  webDir: string;
  manifest: WebManifest;
}

function readManifest(webDir: string): WebManifest | null {
  const p = path.join(webDir, "manifest.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as WebManifest;
}

export function listRuns(): RunSummary[] {
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

export function getRun(runId: string): RunSummary | null {
  const webDir = path.join(RUNS_DIR, runId, "web");
  const manifest = readManifest(webDir);
  if (!manifest) return null;
  return { id: runId, webDir, manifest };
}

export function webPublicPath(webDir: string, rel: string): string {
  return path.join(webDir, rel);
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export { RUNS_DIR, REPO_ROOT };
