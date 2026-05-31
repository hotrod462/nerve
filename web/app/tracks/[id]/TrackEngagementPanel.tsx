"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EngagementTimeline } from "@/components/EngagementTimeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import type { BrainViewerProps } from "@/components/BrainViewer";
import type { EngagementData, AcousticFeaturesData } from "@/lib/engagement";
import type { SubcorticalEngagementData } from "@/lib/subcortical";
import { SubcorticalEngagementTimeline } from "@/components/SubcorticalEngagementTimeline";

const BrainViewer = dynamic(
  () => import("@/components/BrainViewer").then((m) => m.BrainViewer),
  { ssr: false }
);

export function TrackEngagementPanel({
  engagement,
  subcortical,
  acoustic,
  totalFrames,
  runApiBase,
  ...brainProps
}: BrainViewerProps & {
  engagement?: EngagementData | null;
  subcortical?: SubcorticalEngagementData | null;
  acoustic?: AcousticFeaturesData | null;
  totalFrames: number;
  runApiBase?: string;
}) {
  const [frame, setFrame] = useState(0);

  const handleFrameChange = useCallback((f: number) => {
    setFrame(f);
  }, []);

  const handleSeek = useCallback((f: number) => {
    setFrame(f);
  }, []);

  const analysisUrls = useMemo(
    () =>
      runApiBase
        ? {
            vertexYeo: `${runApiBase}/matrices/vertex_yeo.json`,
            atlasLut: `${runApiBase}/matrices/atlas.json`,
          }
        : undefined,
    [runApiBase]
  );

  const dominantNetworkTr = engagement?.derived.dominant_network_tr;

  return (
    <>
      <div className="mt-5">
        <BrainViewer
          {...brainProps}
          frame={frame}
          onFrameChange={handleFrameChange}
          totalFrames={totalFrames}
          dominantNetworkTr={dominantNetworkTr}
          analysisUrls={analysisUrls}
        />
      </div>
      {engagement ? (
        <EngagementTimeline
          engagement={engagement}
          acoustic={acoustic}
          currentFrame={frame}
          onSeek={handleSeek}
        />
      ) : (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <Alert>
              <AlertTitle>Engagement data unavailable</AlertTitle>
              <AlertDescription>
                Re-run <code>nerve export-web</code> to generate network
                engagement traces.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
      {subcortical ? (
        <SubcorticalEngagementTimeline
          subcortical={subcortical}
          acoustic={acoustic}
          currentFrame={frame}
          onSeek={handleSeek}
        />
      ) : (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <Alert>
              <AlertTitle>Subcortical data unavailable</AlertTitle>
              <AlertDescription>
                Re-run <code>nerve predict</code> and <code>nerve export-web</code>{" "}
                to generate subcortical TRIBE predictions.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </>
  );
}
