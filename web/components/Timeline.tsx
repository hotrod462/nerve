"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function Timeline({
  frame,
  total,
  playing,
  onFrame,
  onPlaying,
}: {
  frame: number;
  total: number;
  playing: boolean;
  onFrame: (f: number) => void;
  onPlaying: (p: boolean) => void;
}) {
  const max = Math.max(0, total - 1);

  return (
    <div className="mt-2 flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => onPlaying(!playing)}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <Slider
        className="flex-1"
        min={0}
        max={max}
        step={1}
        value={[frame]}
        onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value;
          onFrame(next ?? 0);
        }}
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        t={frame}s / {max}s
      </span>
    </div>
  );
}
