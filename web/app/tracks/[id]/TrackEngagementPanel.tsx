"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { EngagementTimeline } from "@/components/EngagementTimeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import type { BrainViewerProps } from "@/components/BrainViewer";
import type { EngagementData } from "@/lib/engagement";

const BrainViewer = dynamic(
  () => import("@/components/BrainViewer").then((m) => m.BrainViewer),
  { ssr: false }
);

export function TrackEngagementPanel({
  engagement,
  totalFrames,
  ...brainProps
}: BrainViewerProps & {
  engagement?: EngagementData | null;
  totalFrames: number;
}) {
  const [frame, setFrame] = useState(0);

  const handleFrameChange = useCallback((f: number) => {
    setFrame(f);
  }, []);

  const handleSeek = useCallback((f: number) => {
    setFrame(f);
  }, []);

  return (
    <>
      <div className="mt-5">
        <BrainViewer
          {...brainProps}
          frame={frame}
          onFrameChange={handleFrameChange}
          totalFrames={totalFrames}
        />
      </div>
      {engagement ? (
        <EngagementTimeline
          engagement={engagement}
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
    </>
  );
}
