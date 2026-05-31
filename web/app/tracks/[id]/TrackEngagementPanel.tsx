"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EngagementTimeline } from "@/components/EngagementTimeline";
import { StimulusPlayback } from "@/components/StimulusPlayback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { BrainViewerProps } from "@/components/BrainViewer";
import type { EngagementData, AcousticFeaturesData } from "@/lib/engagement";
import type { SubcorticalEngagementData } from "@/lib/subcortical";
import { SubcorticalEngagementTimeline } from "@/components/SubcorticalEngagementTimeline";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  stimulusAudioUrl,
  fps,
  ...brainProps
}: BrainViewerProps & {
  engagement?: EngagementData | null;
  subcortical?: SubcorticalEngagementData | null;
  acoustic?: AcousticFeaturesData | null;
  totalFrames: number;
  runApiBase?: string;
}) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);

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
      <Collapsible
        open={brainOpen}
        onOpenChange={setBrainOpen}
        className="track-brain-panel engagement-collapsible-section mt-5"
      >
        <CollapsibleTrigger
          className="engagement-collapsible-section__trigger track-brain-panel__trigger"
          aria-label={brainOpen ? "Collapse 3D brain viewer" : "Expand 3D brain viewer"}
        >
          <BrainIcon className="track-brain-panel__icon" aria-hidden />
          <div className="engagement-collapsible-section__heading">
            <h2 className="track-brain-panel__title">Brain viewer</h2>
            <p className="track-brain-panel__hint">
              3D cortical activation synced to playback — click to{" "}
              {brainOpen ? "hide" : "show"} the spatial map.
            </p>
          </div>
          <span className="track-brain-panel__toggle" aria-hidden>
            <span className="track-brain-panel__toggle-label">
              {brainOpen ? "Collapse" : "Expand"}
            </span>
            <ChevronDownIcon className="engagement-row__chevron track-brain-panel__chevron" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="engagement-collapsible-section__content track-brain-panel__content">
          <BrainViewer
            {...brainProps}
            frame={frame}
            onFrameChange={handleFrameChange}
            playing={playing}
            onPlayingChange={setPlaying}
            totalFrames={totalFrames}
            dominantNetworkTr={dominantNetworkTr}
            analysisUrls={analysisUrls}
            externalPlayback
            showTimeline={false}
          />
        </CollapsibleContent>
      </Collapsible>

      <StimulusPlayback
        src={stimulusAudioUrl}
        frame={frame}
        totalFrames={totalFrames}
        fps={fps}
        playing={playing}
        onFrameChange={handleFrameChange}
        onPlayingChange={setPlaying}
      />

      <div className="engagement-panels-grid">
        {engagement ? (
          <EngagementTimeline
            engagement={engagement}
            acoustic={acoustic}
            currentFrame={frame}
            onSeek={handleSeek}
            className="engagement-panel-card min-w-0"
          />
        ) : (
          <Card className="engagement-panel-card min-w-0">
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
            className="engagement-panel-card min-w-0"
          />
        ) : (
          <Card className={cn("engagement-panel-card min-w-0")}>
            <CardContent className="pt-6">
              <Alert>
                <AlertTitle>Subcortical data unavailable</AlertTitle>
                <AlertDescription>
                  Re-run <code>nerve predict --subcortical-only</code> and{" "}
                  <code>nerve export-web</code> to generate subcortical traces.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
