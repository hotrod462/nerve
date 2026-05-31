import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RunSummary } from "@/lib/loadRun";
import {
  getTrackSource,
  isYouTubeSource,
} from "@/lib/trackSources";

export function TrackGalleryRow({ run }: { run: RunSummary }) {
  const label = run.manifest.stimulus?.id ?? run.id;
  const source = getTrackSource(run.id);

  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
        <Link
          href={`/tracks/${run.id}`}
          className="flex min-w-0 flex-1 items-center gap-4"
        >
          {source && isYouTubeSource(source) ? (
            <img
              src={source.thumbnailUrl}
              alt=""
              width={128}
              height={72}
              className="h-[4.5rem] w-32 shrink-0 rounded-md object-cover"
            />
          ) : source && !isYouTubeSource(source) ? (
            <div className="flex h-[4.5rem] w-32 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/40 px-2 text-center text-xs text-muted-foreground">
              Created by {source.createdBy}
            </div>
          ) : null}

          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {label}
              {run.manifest.stimulus?.genre && (
                <span className="text-sm font-normal text-muted-foreground">
                  {run.manifest.stimulus.genre}
                </span>
              )}
            </CardTitle>

            {source && isYouTubeSource(source) ? (
              <div className="space-y-0.5 text-sm text-muted-foreground">
                <p className="truncate">{source.title}</p>
                <p className="truncate">{source.channel}</p>
              </div>
            ) : source && !isYouTubeSource(source) ? (
              <p className="text-sm text-muted-foreground">
                {source.note ?? `Created by ${source.createdBy}`}
              </p>
            ) : null}

            <CardDescription>T={run.manifest.T ?? "?"}</CardDescription>
          </div>
        </Link>

        {source && isYouTubeSource(source) ? (
          <a
            href={source.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            YouTube
          </a>
        ) : null}
      </CardHeader>
    </Card>
  );
}
