"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StimulusAudio } from "./StimulusAudio";
import { Timeline } from "./Timeline";

export interface StimulusPlaybackProps {
  src?: string;
  frame: number;
  totalFrames: number;
  fps?: number;
  playing: boolean;
  onFrameChange: (f: number) => void;
  onPlayingChange: (p: boolean) => void;
}

export function StimulusPlayback({
  src,
  frame,
  totalFrames,
  fps = 1,
  playing,
  onFrameChange,
  onPlayingChange,
}: StimulusPlaybackProps) {
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  useEffect(() => {
    if (!playing) return;

    const n = Math.max(1, totalFrames);
    const interval = setInterval(() => {
      const next = (frameRef.current + 1) % n;
      onFrameChangeRef.current(next);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [playing, fps, totalFrames]);

  return (
    <Card className="stimulus-playback mt-5">
      <CardContent className="space-y-2 pt-4">
        {src ? (
          <StimulusAudio
            src={src}
            frame={frame}
            total={totalFrames}
            playing={playing}
            fps={fps}
            onSeek={onFrameChange}
          />
        ) : null}
        <Timeline
          frame={frame}
          total={totalFrames}
          playing={playing}
          onFrame={onFrameChange}
          onPlaying={onPlayingChange}
        />
      </CardContent>
    </Card>
  );
}
