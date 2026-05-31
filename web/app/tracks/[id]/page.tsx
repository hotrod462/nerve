import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SurfaceMode } from "@/components/BrainViewer";
import { TrackEngagementPanel } from "./TrackEngagementPanel";
import { trackPageMetadata } from "@/lib/geo";
import { runWebBase, runWebUrl, stimulusUrl } from "@/lib/assets";
import { buildMeshBundle } from "@/lib/meshBundle";
import { getRun, readRunJson } from "@/lib/loadRun";
import type { EngagementData, AcousticFeaturesData } from "@/lib/engagement";
import type { SubcorticalEngagementData } from "@/lib/subcortical";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) {
    return { title: "Track not found" };
  }
  return trackPageMetadata(run.manifest.stimulus?.id ?? run.id, {
    genre: run.manifest.stimulus?.genre,
    durationTr: run.manifest.T,
  });
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const engagement = await readRunJson<EngagementData>(
    run,
    "matrices/engagement.json"
  );
  const acoustic = await readRunJson<AcousticFeaturesData>(
    run,
    "matrices/acoustic_features.json"
  );
  const subcortical = await readRunJson<SubcorticalEngagementData>(
    run,
    "matrices/subcortical_engagement.json"
  );

  const base = runWebBase(run.id);
  const meshBundle = buildMeshBundle(run.id, run.manifest.mesh);
  const defaultSurface = (run.manifest.default_surface ?? "pial") as SurfaceMode;
  const stimulusPath = run.manifest.stimulus?.path;
  const stimulusAudioUrl = stimulusPath ? stimulusUrl(stimulusPath) : undefined;

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
        </div>
      </div>

      <TrackEngagementPanel
        engagement={engagement}
        subcortical={subcortical}
        acoustic={acoustic}
        runApiBase={base}
        lhMeshUrl={runWebUrl(run.id, "mesh/lh.inflated.gii")}
        rhMeshUrl={runWebUrl(run.id, "mesh/rh.inflated.gii")}
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
