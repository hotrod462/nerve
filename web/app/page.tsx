import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listRuns } from "@/lib/loadRun";

export default function GalleryPage() {
  const runs = listRuns().filter((r) => !r.manifest.contrast);

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
          <Link key={run.id} href={`/tracks/${run.id}`} className="block">
            <Card className="transition-colors hover:bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {run.manifest.stimulus?.id ?? run.id}
                  {run.manifest.stimulus?.genre && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {run.manifest.stimulus.genre}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  T={run.manifest.T ?? "?"} ·{" "}
                  {run.manifest.device_report?.resolved ?? "—"}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
