"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ENGAGEMENT_COLORS,
  ENGAGEMENT_NETWORK_ORDER,
  epochTemplateForSegment,
  formatSegmentTime,
  getDominantSegments,
  networkFractions,
  type DominantSegment,
  type EngagementData,
} from "@/lib/engagement";
import { cn } from "@/lib/utils";

const MIN_SEGMENT_SECONDS = 3;
const MAX_SEGMENTS_SHOWN = 24;

interface DominantSegmentTimelineProps {
  engagement: EngagementData;
  currentFrame: number;
  onSeek?: (frame: number) => void;
}

function segmentAtFrame(
  segments: DominantSegment[],
  frame: number
): DominantSegment | undefined {
  return segments.find((s) => frame >= s.start_tr && frame <= s.end_tr);
}

export function DominantSegmentTimeline({
  engagement,
  currentFrame,
  onSeek,
}: DominantSegmentTimelineProps) {
  const segments = getDominantSegments(engagement);
  const fractions = networkFractions(engagement.derived.dominant_network_tr);
  const longSegments = [...segments]
    .filter((s) => s.duration_s >= MIN_SEGMENT_SECONDS)
    .sort((a, b) => b.duration_s - a.duration_s)
    .slice(0, MAX_SEGMENTS_SHOWN);

  const activeSegment = segmentAtFrame(segments, currentFrame);

  const couplingEntries = Object.entries(engagement.derived.coupling).map(
    ([key, payload]) => {
      const series = payload.series;
      const mean =
        series.length > 0
          ? series.reduce((a, b) => a + b, 0) / series.length
          : 0;
      return { key, networks: payload.networks, mean };
    }
  );

  return (
    <div className="engagement-segments">
      <div className="engagement-segments__header">
        <h3 className="engagement-segments__title">Dominant network epochs</h3>
        <p className="engagement-segments__hint">
          Segments where each network wins the per-second z-score argmax. Literature
          templates are exploratory in-silico hypotheses — re-export with{" "}
          <code>nerve export-web</code> for Yeo-17 deep dive and epoch labels.
        </p>
      </div>

      <div className="engagement-segments__chips">
        {ENGAGEMENT_NETWORK_ORDER.map((net) => {
          const frac = fractions[net];
          if (frac == null) return null;
          const headline = engagement.networks[net]?.headline ?? net;
          return (
            <Badge
              key={net}
              variant="outline"
              className="engagement-segments__chip"
              style={{
                borderColor: ENGAGEMENT_COLORS[net],
                color: ENGAGEMENT_COLORS[net],
              }}
            >
              {headline} · {Math.round(frac * 100)}%
            </Badge>
          );
        })}
      </div>

      {couplingEntries.length > 0 && (
        <div className="engagement-segments__coupling">
          <span className="engagement-segments__coupling-label">
            Mean coupling
          </span>
          {couplingEntries.map(({ key, mean, networks }) => (
            <span key={key} className="engagement-segments__coupling-item">
              {networks.map((n) => engagement.networks[n]?.headline ?? n).join(" ↔ ")}{" "}
              r̄={mean.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      <ul className="engagement-segments__list">
        {longSegments.map((seg) => {
          const color = ENGAGEMENT_COLORS[seg.net] ?? "var(--foreground)";
          const headline =
            engagement.networks[seg.net]?.headline ?? seg.net;
          const template = epochTemplateForSegment(engagement, seg);
          const isActive =
            activeSegment?.start_tr === seg.start_tr &&
            activeSegment?.net === seg.net;

          return (
            <li key={`${seg.net}-${seg.start_tr}`}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "engagement-segments__item",
                  isActive && "engagement-segments__item--active"
                )}
                onClick={() => onSeek?.(seg.start_tr)}
              >
                <span
                  className="engagement-segments__swatch"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="engagement-segments__item-label">{headline}</span>
                {template ? (
                  <Badge
                    variant="secondary"
                    className="engagement-segments__epoch-badge"
                    title={`${template.hypothesis}\n\n${template.caveat}`}
                  >
                    {template.label}
                  </Badge>
                ) : null}
                <span className="engagement-segments__item-time">
                  {formatSegmentTime(seg.start_tr)}–{formatSegmentTime(seg.end_tr)}
                </span>
                <span className="engagement-segments__item-dur">
                  {seg.duration_s}s
                </span>
              </Button>
            </li>
          );
        })}
      </ul>

      {longSegments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No dominant segments ≥ {MIN_SEGMENT_SECONDS}s in this clip.
        </p>
      )}
    </div>
  );
}
