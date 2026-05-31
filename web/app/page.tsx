import { GeoFaq } from "@/components/GeoFaq";
import { TrackGalleryRow } from "@/components/TrackGalleryRow";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { siteMetadata } from "@/lib/geo";
import { sortGalleryRuns } from "@/lib/galleryOrder";
import { listRuns } from "@/lib/loadRun";

export const metadata = siteMetadata({
  title: "Track gallery",
  description:
    "Browse in-silico TRIBE v2 brain engagement predictions — cortical Yeo networks, subcortical ROIs, and synced 3D Niivue viewer.",
});

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const runs = sortGalleryRuns(
    (await listRuns()).filter((r) => !r.manifest.contrast)
  );

  if (runs.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Nerve gallery</h1>
        <p className="text-muted-foreground">No export bundles found.</p>
        <Card>
          <CardContent className="pt-6">
            <pre className="overflow-x-auto text-left text-xs text-muted-foreground">
              {`uv run nerve predict --audio stimuli/processed/musopen_egmont.wav \\
  --out data/outputs/runs/egmont/
uv run nerve export-web --run data/outputs/runs/egmont/`}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Track gallery</h1>
        <p className="text-sm text-muted-foreground">
          {runs.length} run{runs.length !== 1 ? "s" : ""} with web bundles
        </p>
      </div>
      <div className="grid gap-3">
        {runs.map((run) => (
          <TrackGalleryRow key={run.id} run={run} />
        ))}
      </div>
      <GeoFaq />
    </div>
  );
}
