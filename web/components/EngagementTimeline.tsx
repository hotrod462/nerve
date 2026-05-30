"use client";

import {
  ENGAGEMENT_COLORS,
  ENGAGEMENT_NETWORK_ORDER,
  type EngagementData,
  type NetworkEngagementTrace,
} from "@/lib/engagement";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface EngagementTimelineProps {
  engagement: EngagementData;
  currentFrame?: number;
  onSeek?: (frame: number) => void;
}

const CHART_W = 320;
const CHART_H = 36;
const PAD_X = 2;
const PAD_Y = 4;

function tracePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;
  const zMin = Math.min(-2, ...values);
  const zMax = Math.max(2, ...values);
  const span = zMax - zMin || 1;

  const points = values.map((v, i) => {
    const x = PAD_X + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = PAD_Y + innerH - ((v - zMin) / span) * innerH;
    return `${x},${y}`;
  });
  return `M ${points.join(" L ")}`;
}

function NetworkRow({
  trace,
  nTrs,
  color,
  currentFrame,
  onSeek,
}: {
  net: string;
  trace: NetworkEngagementTrace;
  nTrs: number;
  color: string;
  currentFrame: number;
  onSeek?: (frame: number) => void;
}) {
  const summary = trace.zscore.length
    ? {
        peak: Math.max(...trace.zscore),
        peakTr: trace.zscore.indexOf(Math.max(...trace.zscore)),
      }
    : { peak: 0, peakTr: 0 };

  const playheadX =
    nTrs > 1
      ? PAD_X + (currentFrame / (nTrs - 1)) * (CHART_W - PAD_X * 2)
      : PAD_X;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek || nTrs <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - PAD_X;
    const innerW = CHART_W - PAD_X * 2;
    const t = Math.round((x / innerW) * (nTrs - 1));
    onSeek(Math.max(0, Math.min(nTrs - 1, t)));
  };

  return (
    <div className="engagement-row">
      <div className="engagement-row__label">
        <span
          className="engagement-row__swatch"
          style={{ background: color }}
          aria-hidden
        />
        <div>
          <div className="engagement-row__headline">{trace.headline}</div>
          <div className="engagement-row__tagline">{trace.tagline}</div>
        </div>
      </div>
      <div className="engagement-row__chart-wrap">
        <svg
          className="engagement-row__chart"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          width="100%"
          height={CHART_H}
          onClick={handleClick}
          role="img"
          aria-label={`${trace.headline} engagement over time`}
        >
          <line
            x1={PAD_X}
            y1={CHART_H / 2}
            x2={CHART_W - PAD_X}
            y2={CHART_H / 2}
            stroke="var(--border)"
            strokeWidth={0.5}
            strokeDasharray="2 3"
          />
          <path
            d={tracePath(trace.zscore, CHART_W, CHART_H)}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={playheadX}
            y1={0}
            x2={playheadX}
            y2={CHART_H}
            stroke="var(--foreground)"
            strokeWidth={1}
            opacity={0.85}
          />
        </svg>
        <div className="engagement-row__stats">
          <span title="Within-clip z-score at playhead">
            {trace.zscore[currentFrame]?.toFixed(2) ?? "—"}
          </span>
          <span className="engagement-row__stats-muted" title="Peak z-score">
            peak {summary.peak.toFixed(2)} @ {summary.peakTr}s
          </span>
        </div>
      </div>
    </div>
  );
}

export function EngagementTimeline({
  engagement,
  currentFrame = 0,
  onSeek,
}: EngagementTimelineProps) {
  const frame = Math.max(0, Math.min(engagement.n_trs - 1, currentFrame));
  const salienceSet = new Set(engagement.derived.salience_events.trs);
  const dominantColor =
    ENGAGEMENT_COLORS[engagement.derived.dominant_network_tr[frame]] ??
    "var(--foreground)";

  return (
    <Card className="mt-4">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Network engagement</CardTitle>
          <CardDescription>{engagement.disclaimer}</CardDescription>
        </div>
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Now
          </span>
          <span className="text-lg font-semibold" style={{ color: dominantColor }}>
            {engagement.networks[engagement.derived.dominant_network_tr[frame]]
              ?.headline ?? "—"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="engagement-rows">
          {ENGAGEMENT_NETWORK_ORDER.map((net) => {
            const trace = engagement.networks[net];
            if (!trace) return null;
            return (
              <NetworkRow
                key={net}
                net={net}
                trace={trace}
                nTrs={engagement.n_trs}
                color={ENGAGEMENT_COLORS[net] ?? "var(--primary)"}
                currentFrame={frame}
                onSeek={onSeek}
              />
            );
          })}
        </div>

        {engagement.derived.salience_events.trs.length > 0 && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Surprise events (Δz ≥{" "}
              {engagement.derived.salience_events.threshold_z_derivative}):{" "}
              {engagement.derived.salience_events.trs
                .map((t) => `${t}s`)
                .join(", ")}
              {salienceSet.has(frame) ? " · at playhead" : ""}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
