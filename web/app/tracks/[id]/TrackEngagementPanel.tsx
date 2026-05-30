"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { EngagementTimeline } from "@/components/EngagementTimeline";
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
      <div className="track-hero">
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
        <div className="card engagement-panel" style={{ marginTop: "1rem" }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
            Re-run <code>nerve export-web</code> to generate network engagement
            traces.
          </p>
        </div>
      )}
    </>
  );
}
