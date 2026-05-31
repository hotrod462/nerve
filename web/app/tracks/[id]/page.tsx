import path from "path";
import { notFound } from "next/navigation";
import { DeviceBadge } from "@/components/DeviceBadge";
import type { MeshBundle, SurfaceMode } from "@/components/BrainViewer";
import { TrackEngagementPanel } from "./TrackEngagementPanel";
import { getRun, readJsonFile } from "@/lib/loadRun";
import type { MeshManifest } from "@/lib/loadRun";
import type { EngagementData, AcousticFeaturesData } from "@/lib/engagement";
import type { SubcorticalEngagementData } from "@/lib/subcortical";

function bundleUrl(base: string, rel: string) {
  return `${base}/${rel}`;
}

function buildMeshBundle(base: string, mesh?: MeshManifest): MeshBundle | undefined {
  if (!mesh?.activations) return undefined;

  const surfaces = mesh.surfaces
    ? (Object.fromEntries(
        (["pial", "half", "inflated"] as const)
          .filter((k) => mesh.surfaces?.[k])
          .map((k) => [
            k,
            {
              lh: bundleUrl(base, mesh.surfaces![k]!.lh),
              rh: bundleUrl(base, mesh.surfaces![k]!.rh),
            },
          ])
      ) as MeshBundle["surfaces"])
    : undefined;

  return {
    surfaces,
    activations: {
      lh: bundleUrl(base, mesh.activations.lh),
      rh: bundleUrl(base, mesh.activations.rh),
    },
    sulc: mesh.sulc
      ? {
          lh: bundleUrl(base, mesh.sulc.lh),
          rh: bundleUrl(base, mesh.sulc.rh),
        }
      : undefined,
    sulcRange: mesh.sulc_range,
    atlas: mesh.atlas
      ? {
          parcels: mesh.atlas.parcels
            ? {
                lh: bundleUrl(base, mesh.atlas.parcels.lh),
                rh: bundleUrl(base, mesh.atlas.parcels.rh),
              }
            : undefined,
          yeo: mesh.atlas.yeo
            ? {
                lh: bundleUrl(base, mesh.atlas.yeo.lh),
                rh: bundleUrl(base, mesh.atlas.yeo.rh),
              }
            : undefined,
          lut: mesh.atlas.lut ? bundleUrl(base, mesh.atlas.lut) : undefined,
          borders: mesh.atlas.borders
            ? {
                yeo: mesh.atlas.borders.yeo
                  ? {
                      lh: bundleUrl(base, mesh.atlas.borders.yeo.lh),
                      rh: bundleUrl(base, mesh.atlas.borders.yeo.rh),
                    }
                  : undefined,
                parcels: mesh.atlas.borders.parcels
                  ? {
                      lh: bundleUrl(base, mesh.atlas.borders.parcels.lh),
                      rh: bundleUrl(base, mesh.atlas.borders.parcels.rh),
                    }
                  : undefined,
              }
            : undefined,
          region_labels: mesh.atlas.region_labels
            ? {
                lh: bundleUrl(base, mesh.atlas.region_labels.lh),
                rh: bundleUrl(base, mesh.atlas.region_labels.rh),
              }
            : undefined,
        }
      : undefined,
  };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) notFound();

  const engagementPath = path.join(run.webDir, "matrices", "engagement.json");
  const engagement = readJsonFile<EngagementData>(engagementPath);
  const acousticPath = path.join(run.webDir, "matrices", "acoustic_features.json");
  const acoustic = readJsonFile<AcousticFeaturesData>(acousticPath);
  const subcorticalPath = path.join(
    run.webDir,
    "matrices",
    "subcortical_engagement.json"
  );
  const subcortical = readJsonFile<SubcorticalEngagementData>(subcorticalPath);

  const base = `/api/runs/${run.id}`;
  const meshBundle = buildMeshBundle(base, run.manifest.mesh);
  const defaultSurface = (run.manifest.default_surface ?? "pial") as SurfaceMode;
  const stimulusPath = run.manifest.stimulus?.path;
  const stimulusAudioUrl = stimulusPath
    ? `/api/stimulus/${stimulusPath.split("/").map(encodeURIComponent).join("/")}`
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {run.manifest.stimulus?.id ?? run.id}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {run.manifest.stimulus?.genre && (
            <span className="text-sm text-muted-foreground">
              {run.manifest.stimulus.genre}
            </span>
          )}
          <DeviceBadge
            resolved={run.manifest.device_report?.resolved}
            deviceOk={run.manifest.device_report?.device_ok}
          />
        </div>
      </div>

      <TrackEngagementPanel
        engagement={engagement}
        subcortical={subcortical}
        acoustic={acoustic}
        runApiBase={base}
        lhMeshUrl={`${base}/mesh/lh.inflated.gii`}
        rhMeshUrl={`${base}/mesh/rh.inflated.gii`}
        mesh={meshBundle}
        defaultSurface={defaultSurface}
        stimulusAudioUrl={stimulusAudioUrl}
        colormap={run.manifest.colormap ?? "redyell"}
        vmin={run.manifest.vmin}
        vmax={run.manifest.vmax}
        fps={run.manifest.fps ?? 1}
        totalFrames={run.manifest.T ?? 45}
      />
    </div>
  );
}
